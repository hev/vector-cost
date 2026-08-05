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

## Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Lowercase slug. Must match the filename. |
| `name` | yes | Display name, however you capitalize it. |
| `homepage` | no | Vendor site. |
| `billingUnit` | yes | `GB` (10⁹ bytes) or `GiB` (2³⁰ bytes). Pick the one your invoice uses. |
| `storage.perUnitMonth` | yes | Dollars per `billingUnit` of index, per month. |
| `write.label` | no | Label for the write-path selector. Only needed with 2+ paths. |
| `write.paths[]` | yes | One or more write paths. First is the default. |
| `minimumMonthly` | yes | Platform minimum in dollars per month. `0` if none. |
| `note` | yes | One paragraph shown verbatim in the calculator's assumptions panel. |
| `verified` | yes | `YYYY-MM-DD` you last checked these numbers. |
| `sources[]` | yes | Where the numbers came from. At least one, with a URL. |

### Write paths

Each path needs **at least one** of these three rate components. They add
together, so a path can carry more than one:

| Field | Meaning |
| --- | --- |
| `perUnit` | Dollars per `billingUnit` of data written. |
| `perMillionWriteUnits` + `writeUnitBytes` | Dollars per million write units, and how many bytes make one unit. |
| `perThousandRequests` | Dollars per 1,000 write requests. One request per chunk. |

## What is deliberately not modelled

**Queries.** They're real and every vendor prices them, but they scale with
traffic rather than with corpus size — and they are not what surprises people on
the invoice. Adding a query rate to your card won't do anything yet.

Free tiers, annual commits, and volume discounts are also out of scope. The
calculator quotes list price on purpose; if your rate falls at volume, say so in
`note` (turbopuffer's card does).
