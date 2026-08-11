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
- [`rates/s3-vectors.json`](rates/s3-vectors.json)
- [`rates/chroma.json`](rates/chroma.json)
- [`rates/zilliz.json`](rates/zilliz.json)
- [`rates/upstash.json`](rates/upstash.json)

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

## Every number this uses

There are no hidden constants. Everything below is either a default you can
change on the page or a rate you can change in a file — and every one of them is
here, so you can disagree with a specific number instead of the whole thing.

### Units

Decimal throughout: **1 GB = 10⁹ bytes**, because that is how storage is billed.
`GiB` (2³⁰) appears only where a vendor bills in it, and the rate card says which
([topk does](rates/topk.json)).

### Tokens

**1 token = 4 bytes.** This is the one constant with no knob on it. It makes a
1 KB chunk 250 tokens and 1 GB of English text 250M tokens, which is where every
embedding figure comes from. It is a reasonable average for English prose and
wrong for code, CJK, and heavily structured text.

### Index size

Per chunk, by index type. `q` is bytes per dimension, set by quantization:
**f32 = 4, int8 = 1, binary = 0.125**.

| type | bytes per chunk |
| --- | --- |
| **sparse / BM25** | `sparseRatio × chunkBytes` — default `0.3×`, i.e. postings are a *compression* scheme, sub-1× |
| **dense** | `dims × q` vector `+ M × 2 × 4 B` HNSW edges — default 1536-d f32 with M=16 is `6144 + 128 = 6.3 KB` |
| **multi-vector** | `(chunkBytes ÷ 4) × mvDims × q` — a vector per *token*, so a 1 KB chunk is 250 vectors; default 128-d f32 is `128 KB` |

Two modifiers, both off by default:

- **Rescore copy** — quantizing and keeping a full-precision copy to rescore
  with adds `dims × 4 B` back (or `tokens × mvDims × 4 B` for multi-vector). This
  is why binary + rescore is *larger* than plain f32, not smaller.
- **Retained source text** — adds `chunkBytes`, i.e. exactly `1×`, to every type.
  Off by default so the types stay comparable: you keep the source whichever
  index you pick, so counting it shrinks the spread, changes no decision, and
  makes sparse read `1.3×` when the postings list genuinely is `0.3×`.

Graph overhead is excluded for multi-vector — at 250 vectors per chunk it is a
rounding error against the vectors themselves.

**Write amplification** is just `index bytes ÷ source bytes`, and it is the term
that sets everything else.

### Embedding

`(bytes ÷ 4 ÷ 10⁶) × $ per M tokens`, charged on every full pass.

- Defaults are OpenAI list: `text-embedding-3-small` **$0.02/M**,
  `text-embedding-3-large` **$0.13/M**. Any rate can be typed in.
- **Sparse is $0** — BM25 has no model to run. That is the line item sparse deletes.
- **Quantization does not reduce this.** The model emits every dimension at full
  rate; you pay for all of them and then throw some away at index time.
- **Multi-vector is the crudest part of the model** — priced at the same
  per-token rate as dense, which is a floor. ColPali-style page embedding is
  usually self-hosted GPU time instead, and this does not try to model that.

### Vendor rates

Storage `$/unit-month`, write `$/unit` (plus per-write-unit and per-request
components where a vendor bills that way), billing unit, and platform minimum all
come from [`rates/<vendor>.json`](rates/) — nothing is hardcoded in the page.
Each card carries the date it was last verified and a link to the pricing page it
was read from; the [schema](rates/README.md) documents every field.

The monthly platform minimum is applied as a floor on storage + writes. At the
corpus sizes this tool is for, it rarely binds.

### Write paths, and the batch size that costs more than the rate

Some vendors sell more than one way in, and the choice is worth more than any
rate on the card. The page shows a **write path** selector, defaulting to the
bulk path because that's how a corpus this size actually lands:

- **Pinecone** — bulk **Import** at $0.25/GB, or **upsert** metered in Write
  Units at ≈$3.91/GB. Import is the default; it's ~16× cheaper and it is *not*
  an incremental path, so live updates genuinely do pay the upsert rate.
- **S3 Vectors** — $0.20/GB either way, but PUT bills **a minimum of 128 KB per
  request**. `PutVectors` takes up to 500 vectors, so a batched load never
  reaches that floor. Send one vector per call and a 6 KB vector is billed as
  128 KB — **~21× the write bill, on a rate card that never changed.**

The selector sits last in its row and is always on screen — a vendor that sells
one way in gets a single disabled button rather than an empty space. It's the
one control whose width is set by a *different* control, so it goes where a
width change has nothing to its right to shove.

That second vendor is the case worth internalizing: the pricing page is not wrong
and the calculator is not wrong, and you can still be off by 21× because of a
line in the API docs. It's modelled declaratively — `chunksPerRequest` and
`minBillableBytesPerRequest` on a write path — so any vendor with a per-request
minimum is a rate-card change, not a code change.

### What a vendor can't sell you

A cost model that will price anything you ask it to will happily quote you a
product that doesn't exist. S3 Vectors has no BM25 and stores float32 only, so
"sparse on S3 Vectors" and "binary quantized on S3 Vectors" were both numbers
with nothing behind them.

Cards can now declare that, in a `supports` block with a `note` saying why. The
page strikes the option through rather than hiding it — an option that silently
vanishes reads as a bug, and it moves the controls — and the ladder keeps the row
while dropping the number. Cards without a `supports` block offer everything,
which is every vendor here but one.

**Queries still aren't modelled**, including S3 Vectors' query-side charges,
which are a larger share of its bill than of anyone else's here. S3 Vectors is
cheap to store and cheap to fill, and it recovers that on reads and on latency.
If your workload is query-heavy, the number this page gives you for S3 Vectors
is the most incomplete one on the vendor list.

### Timeline

36 months. Month 1 is the initial build — one full write pass and one full
embedding pass.

- **Re-indexes** are spread evenly: for `n` re-indexes, month `round(j × 36/n)`
  for each `j`, dropping anything that lands on month 1. Each one is another full
  write pass and another full embedding pass over the whole corpus.
- **Growth** compounds monthly (`0%` by default). A growth month is charged for
  the delta only — writes and embedding on the new bytes — and the re-index band
  on the page counts only the full-pass portion, so the two never get conflated.
- **Storage** is billed every month on the index size at that month.

### Defaults

| | |
| --- | --- |
| dataset | 1 TB source |
| index | dense, 1536-d, f32, no rescore copy |
| chunk | 1 KB |
| HNSW `M` | 16 |
| sparse ratio | 0.3× |
| multi-vector dims | 128 |
| re-indexes | 10 in 36 months (≈ one per quarter) |
| embedding | $0.02/M tokens |
| growth | 0%/month |
| retained source text | off |

## Using it

The build output is one file with no network dependencies. Drop it anywhere:

```sh
git clone https://github.com/hev/vector-cost
cd vector-cost
node bin/build          # -> dist/index.html
open dist/index.html
```

The one asterisk on "no network dependencies": the file carries a PostHog snippet
that is **hard-guarded to `hevmind.com`** and does nothing anywhere else. Your
copy, and `file://`, and localhost, make zero third-party requests — the guard is
a hostname comparison at the top of the last `<script>` in the file, so it is
worth ten seconds to verify rather than trust. Delete that block if you would
rather not carry it; nothing else references it.

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
models embedding at published per-million rates. [Every number it
uses](#every-number-this-uses) is written down above; if you disagree with one,
change it and watch what moves. The ratios are far more robust than the absolute
numbers.

The honest version is still to sample 20–100 GB of your own corpus, build all
three index types, and measure. This tells you whether that's worth your
afternoon.

If you'd rather not run that yourself, that's an engagement —
[get in touch](https://hevmind.com/contact).

## Background

Built for *How to Choose a Vector Database*, a Maven Lightning Lesson with
Doug Turnbull, 2026-08-10.

## License

[MIT](LICENSE). The rate cards are facts about public pricing; use them freely.
