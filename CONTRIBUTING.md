# Contributing

## If you work for a vendor

**Correcting your own pricing is the most valuable contribution here, and it is
one file.** No CLA, no issue-first policy, no style guide to read. Open the PR.

1. Edit `rates/<your-vendor>.json`.
2. Bump `verified` to today and make sure `sources[]` points at a page a reader
   can check.
3. Run `node bin/check` — it validates the card and prints the per-GB
   equivalent, so you can see that the change did what you meant.
4. Run `node bin/build` and commit `dist/index.html` alongside it. (CI will tell
   you if you forget.)

Being wrong in your favour still counts as wrong — if this calculator makes you
look *cheaper* than you are, we want that fixed too.

### Adding a vendor that isn't here

Same shape: add `rates/<id>.json`, run `bin/check` and `bin/build`. You don't
need to touch `calculator.config.json` — anything not listed in its `order` is
appended alphabetically, so a new vendor is genuinely a one-file change.

The bar is that the pricing has to be **publicly documented and checkable**. A
rate someone can only get on a sales call isn't something a reader can verify,
so it isn't something this can carry.

### What the schema does and doesn't cover

The [schema](rates/README.md) is declarative on purpose: per-unit rates, write
units, and per-request fees, in GB or GiB. Those three components sum, which
covered every vendor modelled at launch.

**If your pricing doesn't fit, that's a bug in the schema — open an issue.** The
fix is a new declarative field that any vendor could use, not a special case
branch with your name on it. Please don't work around it by fudging a rate into
a field that means something else; a card that prices correctly today by
accident will price incorrectly the first time anything changes.

## If you spotted a modelling problem

Issues about the *model* — write amplification factors, HNSW overhead, chunking
assumptions, the re-index schedule — are very welcome, especially with a
measurement behind them. The defaults are honest estimates, not measurements,
and they're documented in the assumptions panel precisely so they can be argued
with.

The one thing that is out of scope by design is **query cost**. See the README.

## Working on the calculator itself

```sh
node bin/check          # validate the rate cards
node bin/build          # rebuild dist/index.html
node bin/test           # drive the controls under a minimal DOM
open dist/index.html    # no server needed
```

`bin/test` is worth knowing about: the numeric checks all run the model directly
and never touch the UI, so they cannot see a broken control. It exists because
one such bug shipped — the vendor objects lost `write.paths` to a spread, and the
page threw on load while every number still checked out.

Edit `src/calculator.html`, not `dist/index.html` — `dist` is generated and CI
checks it matches. Plain node, no dependencies, no package.json; please keep it
that way.

There's one non-obvious constraint. The block between `const MONTHS = 36;` and
the `FORMATTING` banner is extracted and executed on its own — by `bin/test`,
by CI, and by `bin/verify-deck`, which checks a conference talk's slide figures
against this model. It needs to keep exporting `S`, `profile`, `embedCost`,
`writeCost`, `storeCost`, `schedule`, `timeline`, `GB`, `VENDORS`, and `RATES`,
and it must stay free of DOM access. Reorganize inside it freely; just don't
move those names out of it.

`bin/verify-deck` needs a deck checked out beside this repo, so it can't run in
CI and is skipped when there isn't one. If you change a **rate**, run it — a
corrected price changes the arithmetic on someone's slide, and this is the only
thing that notices.
