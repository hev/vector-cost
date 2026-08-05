// Load and validate the rate cards. No dependencies — plain node.
//
// The validation here is deliberately strict and deliberately chatty. The whole
// premise of this repo is that a vendor can correct their own pricing without
// reading the calculator, so a bad card has to fail with a message that says
// which file, which field, and what was expected.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const RATES_DIR = join(ROOT, "rates");
export const CONFIG = join(ROOT, "calculator.config.json");

export const UNITS = { GB: 1e9, GiB: 1024 ** 3 };

const RATE_COMPONENTS = ["perUnit", "perMillionWriteUnits", "perThousandRequests"];

/** Every rate card, validated and in display order. Throws on the first bad file. */
export function loadRates() {
	const files = readdirSync(RATES_DIR)
		.filter((f) => f.endsWith(".json") && !f.startsWith("_"))
		.sort();
	if (!files.length) throw new Error("rates/ has no rate cards");

	const cards = files.map((f) => {
		const path = join(RATES_DIR, f);
		let card;
		try {
			card = JSON.parse(readFileSync(path, "utf8"));
		} catch (e) {
			throw new Error(`rates/${f}: not valid JSON — ${e.message}`);
		}
		validate(card, f);
		return card;
	});

	const seen = new Set();
	for (const c of cards) {
		if (seen.has(c.id)) throw new Error(`rates/: two cards claim id "${c.id}"`);
		seen.add(c.id);
	}

	const config = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, "utf8")) : {};
	const order = config.order || [];
	for (const id of order) {
		if (!seen.has(id)) throw new Error(`calculator.config.json: order lists "${id}", but rates/${id}.json does not exist`);
	}
	// Listed vendors first in the order given; anything new lands alphabetically
	// after them, so adding a vendor stays a one-file pull request.
	const ranked = [...cards].sort((a, b) => {
		const ia = order.indexOf(a.id);
		const ib = order.indexOf(b.id);
		if (ia !== -1 && ib !== -1) return ia - ib;
		if (ia !== -1) return -1;
		if (ib !== -1) return 1;
		return a.id.localeCompare(b.id);
	});

	const defaultVendor = config.defaultVendor || ranked[0].id;
	if (!seen.has(defaultVendor)) {
		throw new Error(`calculator.config.json: defaultVendor "${defaultVendor}" has no rate card`);
	}
	return { cards: ranked, defaultVendor };
}

function validate(card, file) {
	const at = (msg) => {
		throw new Error(`rates/${file}: ${msg}`);
	};
	const expectedId = basename(file, ".json");

	if (typeof card.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(card.id)) {
		at(`"id" must be a lowercase slug, got ${JSON.stringify(card.id)}`);
	}
	if (card.id !== expectedId) at(`"id" is "${card.id}" but the filename says "${expectedId}" — they must match`);
	if (typeof card.name !== "string" || !card.name.trim()) at('"name" is required');
	if (!UNITS[card.billingUnit]) {
		at(`"billingUnit" must be one of ${Object.keys(UNITS).join(", ")}, got ${JSON.stringify(card.billingUnit)}`);
	}

	if (!card.storage || !money(card.storage.perUnitMonth)) {
		at('"storage.perUnitMonth" must be a non-negative number (dollars per billingUnit per month)');
	}

	if (!card.write || !Array.isArray(card.write.paths) || !card.write.paths.length) {
		at('"write.paths" must be a non-empty array');
	}
	const pathIds = new Set();
	card.write.paths.forEach((p, i) => {
		const where = `write.paths[${i}]`;
		if (typeof p.id !== "string" || !p.id.trim()) at(`${where}.id is required`);
		if (pathIds.has(p.id)) at(`${where}.id "${p.id}" is used twice`);
		pathIds.add(p.id);

		const present = RATE_COMPONENTS.filter((k) => p[k] !== undefined);
		if (!present.length) {
			at(`${where} ("${p.id}") has no rate — needs at least one of ${RATE_COMPONENTS.join(", ")}`);
		}
		for (const k of present) {
			if (!money(p[k])) at(`${where}.${k} must be a non-negative number, got ${JSON.stringify(p[k])}`);
		}
		if (p.perMillionWriteUnits !== undefined && !(p.writeUnitBytes > 0)) {
			at(`${where} bills in write units, so it also needs a positive "writeUnitBytes" (bytes per unit)`);
		}
		if (p.writeUnitBytes !== undefined && p.perMillionWriteUnits === undefined) {
			at(`${where} sets "writeUnitBytes" but no "perMillionWriteUnits" — the byte size alone prices nothing`);
		}
	});
	if (card.write.paths.length > 1 && !card.write.label) {
		at('"write.label" is required when a vendor has more than one write path (it labels the selector)');
	}

	if (!money(card.minimumMonthly)) at('"minimumMonthly" must be a non-negative number (0 if there is no minimum)');
	if (typeof card.note !== "string" || card.note.trim().length < 20) {
		at('"note" must be a sentence or two — it is shown verbatim in the assumptions panel');
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(card.verified || "")) at('"verified" must be a YYYY-MM-DD date');
	if (!Array.isArray(card.sources) || !card.sources.length) {
		at('"sources" must list at least one source, so a reader can check the number');
	}
	card.sources.forEach((s, i) => {
		if (!s || typeof s.url !== "string" || !/^https?:\/\//.test(s.url)) {
			at(`sources[${i}].url must be an http(s) URL`);
		}
	});
}

function money(v) {
	return typeof v === "number" && isFinite(v) && v >= 0;
}

/**
 * Price one write path, the same way the calculator does. Kept here so `bin/check`
 * can report a per-GB equivalent without duplicating the model.
 */
export function pathCost(card, path, bytes, chunks) {
	let c = 0;
	if (path.perUnit) c += (bytes / UNITS[card.billingUnit]) * path.perUnit;
	if (path.perMillionWriteUnits) c += (bytes / path.writeUnitBytes / 1e6) * path.perMillionWriteUnits;
	if (path.perThousandRequests) c += (chunks / 1000) * path.perThousandRequests;
	return c;
}
