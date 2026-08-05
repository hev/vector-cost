# Rate cards

One JSON file per vendor. This directory is the whole point of the repo: if a
number here is wrong, the calculator is wrong, and the fix is a pull request
against a single file.

**If you work for one of these vendors and we've got your pricing wrong, please
just open a PR.** You do not need to understand the rest of the repo. See
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Why the schema looks like this

The three vendors modelled at launch bill in three genuinely different shapes,
and the schema exists to cover all of them declaratively — a vendor whose bill
needs custom code is a schema bug, not a special case:

- **turbopuffer** — flat per-GB stored, flat per-GB written.
- **topk** — per-**GiB** (not GB), plus a per-request fee on writes.
- **Pinecone** — per-GB stored, but upserts meter in Write Units (1 WU per 1 KB,
  where KB means 1024 bytes), and bulk import is a separate cheaper path.
- **S3 Vectors** — flat per-GB written, but with a **minimum billable size per
  request** (128 KB per PUT). The rate never changes; how many vectors you put
  in one call changes the bill by ~21×. This is the one shape where a number
  that isn't on the pricing page dominates the invoice.

## Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Lowercase slug. Must match the filename. |
| `name` | yes | Display name, however you capitalize it. |
| `homepage` | no | Vendor site. |
| `billingUnit` | yes | `GB` (10⁹ bytes) or `GiB` (2³⁰ bytes). Pick the one your invoice uses. |
| `storage.perUnitMonth` | yes | Dollars per `billingUnit` of index, per month. |
| `write.paths[]` | yes | One or more write paths. **The first is the default** — list the bulk path first. |
| `minimumMonthly` | yes | Platform minimum in dollars per month. `0` if none. |
| `supports` | no | Only if your product can't do something the page offers. See [Capabilities](#capabilities). |
| `note` | yes | One paragraph, shown verbatim in the calculator's footer whenever this vendor is selected. Keep it to the rates themselves. |
| `verified` | yes | `YYYY-MM-DD` you last checked these numbers. |
| `sources[]` | yes | Where the numbers came from. At least one, with a URL. |

### Write paths

Each path needs **at least one** of these three rate components. They add
together, so a path can carry more than one:

| Field | Meaning |
| --- | --- |
| `perUnit` | Dollars per `billingUnit` of data written. |
| `perMillionWriteUnits` + `writeUnitBytes` | Dollars per million write units, and how many bytes make one unit. |
| `perThousandRequests` | Dollars per 1,000 write requests. |

Two more optional fields describe how chunks are packed into API calls. Both
default to the naive thing, so a card that ignores them prices exactly as before:

| Field | Default | Meaning |
| --- | --- | --- |
| `chunksPerRequest` | `1` | How many chunks ride in one write request. Set it to your bulk endpoint's batch limit. |
| `minBillableBytesPerRequest` | none | Minimum billable size per request. Billable bytes become `max(actual, requests × this)`. |

`paths[0]` is what a reader sees before they touch anything, so **put the bulk
path first** — the one a corpus of this size actually arrives on. A vendor with
a single path still gets the selector, drawn as one disabled button, so the
control never leaves the row.

`minBillableBytesPerRequest` raises the **billable byte count**; it is not an
added fee. That distinction is the whole behaviour: once a batch is big enough
the floor stops mattering entirely, which is how the real invoice works and why
a vendor with a floor usually deserves two paths — one batched, one not — so the
gap is on the record instead of asserted.

It needs something priced per byte (`perUnit` or `perMillionWriteUnits`) to
apply to; a floor on a purely per-request path prices nothing and is rejected.

**When `chunksPerRequest` is wrong:** if your API bills per *vector* regardless
of how they were batched, leave it at `1` — batching the call doesn't cut the
bill, so pretending it does would understate you. [Upstash's
card](upstash.json) is the worked example, and its `sources` note says so.

## Capabilities

Optional, and only worth adding when the page offers something your product
doesn't do. Without it, a card offers everything — which is the right answer for
almost every vendor.

```json
"supports": {
  "indexTypes": ["dense", "multi"],
  "quantization": ["f32"],
  "note": "S3 Vectors is a pure vector store — no BM25 or inverted index — and stores float32 only."
}
```

| Field | Values | Meaning |
| --- | --- | --- |
| `indexTypes` | `sparse`, `dense`, `multi` | The index shapes you actually offer. Omit the key to allow all three. |
| `quantization` | `f32`, `int8`, `binary` | The precisions you actually store. Omit the key to allow all three. |
| `note` | — | Required whenever you restrict anything. Shown under the controls it disables. |

Anything you leave out is struck through in the calculator, not hidden, and the
comparison ladder keeps the row with a dash where the price would be. Restrict
only what your product genuinely can't do — this is a capability statement, not
a recommendation. "You *shouldn't* run binary here" is what `note` is for.

## What is deliberately not modelled

**Queries.** They're real and every vendor prices them, but they scale with
traffic rather than with corpus size — and they are not what surprises people on
the invoice. Adding a query rate to your card won't do anything yet.

Free tiers, annual commits, and volume discounts are also out of scope. The
calculator quotes list price on purpose; if your rate falls at volume, say so in
`note` (turbopuffer's card does).
