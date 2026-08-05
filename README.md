# vector-cost

**What a vector index actually costs, month 1 to month 36.**

Vendor calculators quote you a month you will never have. They ask how many
vectors you have — a number nobody knows — and they price the steady state. The
bill that surprises people is *writes*: how much data your index actually
creates, once, and then keeps forever, multiplied by every time you re-index.

This is a single self-contained HTML page that models it from the one number you
walked in with: how much data you have.

→ **[hevmind.com/research/vector-cost](https://hevmind.com/research/vector-cost)**

---

## Vendors: your pricing lives in one JSON file

If this calculator gets your pricing wrong, it is a bug and we want the fix.
Every rate is in [`rates/`](rates/), one file per vendor:

- [`rates/turbopuffer.json`](rates/turbopuffer.json)
- [`rates/topk.json`](rates/topk.json)
- [`rates/pinecone.json`](rates/pinecone.json)

Edit the number, run `bin/check`, open a pull request. You do not need to read
the calculator, and you do not need to touch anything else. If you would rather
not open a PR, [file an issue](../../issues/new/choose) with a link to your
pricing page and it'll get done.

Adding a vendor that isn't here yet is the same one-file change — see
[CONTRIBUTING.md](CONTRIBUTING.md) and the [schema](rates/README.md).

## What it models

Five inputs. Everything in a vendor calculator is a knob on one of these:

| | |
| --- | --- |
| **dataset size** | how much source data you have, on disk |
| **write amplification** | what the index shape multiplies it by |
| **write cost** | $/unit written, billed again on every re-index |
| **storage cost** | $/unit-month, forever |
| **embedding cost** | $/M tokens, billed again on every re-index |

The interesting term is the second one, because it is the one nobody asks you
for. A 1 KB chunk becomes ~0.3 KB of BM25 postings, ~6.3 KB of 1536-d dense
vector plus HNSW edges, or ~128 KB of multi-vector — a **427× spread in the
annual storage bill** on the same corpus, decided by a choice your ML engineer
made in a notebook.

**Queries are deliberately not modelled.** They're real and every vendor prices
them, but they scale with traffic rather than corpus size, and they are not what
surprises people on the invoice.

## Using it

The build output is one file with no network dependencies. Drop it anywhere:

```sh
git clone https://github.com/hev/vector-cost
cd vector-cost
node bin/build          # -> dist/index.html
open dist/index.html
```

No dependencies, no package.json, no build toolchain. Node 18+ and a browser.

## Repo layout

```text
rates/<vendor>.json     the rate cards — the point of the repo
rates/README.md         the schema, field by field
calculator.config.json  display order + default vendor (editorial, not vendor data)
src/calculator.html     the page, with @@RATES@@ placeholders
bin/check               validate every card, show per-GB equivalents
bin/build               inline the cards -> dist/index.html   (--check for CI)
bin/test                drive the controls under a minimal DOM
bin/verify-deck         check a talk's slide figures against the model
bin/sync                push dist/ into the sites that vendor it  (--check)
dist/index.html         built output, committed so consumers can vendor it
```

`dist/` is committed and CI enforces that it matches `rates/` — a merged rate
correction that wasn't rebuilt is a failed build, not a silently stale page.

## Honesty

This is an estimate, like every vendor calculator, including the ones it argues
with. It uses list prices, ignores volume discounts and annual commits, and
models embedding at published per-million rates. The assumptions panel on the
page lists every constant it uses; if you disagree with one, change it and watch
what moves. The ratios are far more robust than the absolute numbers.

The honest version is still to sample 20–100 GB of your own corpus, build all
three index types, and measure. This tells you whether that's worth your
afternoon.

## Background

Built for *How to Choose a Vector Database*, a Maven Lightning Lesson with
Doug Turnbull, 2026-08-10.

## License

[MIT](LICENSE). The rate cards are facts about public pricing; use them freely.
