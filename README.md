# Token launch radar

Entry for the make.fun **token-radar-01** bounty: rank pre-token protocols by the
implied value of the token each might one day issue, each with a concrete farm plan,
presented as a working static dashboard.

## Model — radar-2

Every implied value is a pure function of the sealed DefiLlama snapshot
(`input/snapshot.json`, as of 2026-11-14; 758 protocols, watchlist of 40 with
TVL ≥ $50M and no token recorded). No protocol names are hardcoded anywhere.

```
implied = round(TVL × category multiple × growth × maturity × youth × breadth)
```

- **Category multiple**: for each category, the median mcap/TVL of its already-tokened
  protocols, shrunk toward the global median — `(n·category + 6·global) / (n + 6)` —
  clamped to [0.05, 0.50]. Global median is 0.2138. Single-sample categories cannot
  set their own price.
- **Growth**: `change_7d` clamped to [-60, +120]. Rises count 0.6×, falls 0.35× — a
  shrinking protocol keeps most of its TVL base.
- **Maturity**: `0.55 + 0.45 · min(age_days, 1095) / 1095`; unknown age counts as 365 days.
- **Youth**: protocols younger than 120 days get a ×0.85 discount for a thin track record.
- **Breadth**: `1 + 0.02 · min(chains - 1, 3)`.

The board holds 226 rows: all 40 watchlist protocols plus 186 early (below-floor)
pre-token protocols. The 24 already-tokened protocols are shown apart in a Live tab
and never mixed into the ranking. Each row carries a 7-step farm plan with concrete
costs and times, generated from the row's own category, chains, TVL tier and age.

Top of the board: Steakhouse Financial $1,119,834,854 · Gauntlet $668,384,503 ·
Veda $213,001,120 · USDD $173,124,898 · Nonce Capital $122,302,383.

## Run it

Node 22.18+ (standard library only, no dependencies):

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

This writes `out/board.json`, `out/data.js`, copies `dashboard/` and `screenshots/`
to `out/`, and writes `out/dossier.json` last via the vendored `vendor/makefun-board.ts`
`buildDossier`. Two runs produce byte-identical output.

## Validate

```sh
node check.js   # gate + agreement checks (in the workspace, not part of the entry)
```

20 checks: board shape and ranks, implied-value ordering, farm-step lengths,
full watchlist coverage, data/dashboard agreement (the dashboard recomputes every
implied value from the row's own figures and must match the board exactly),
no-network dashboard, and size caps.

## Layout

- `main.ts` — entry program: reads the snapshot, validates the board, writes the output.
- `lib/model.ts` — the radar-2 model and farm-plan generator.
- `vendor/makefun-board.ts` — vendored dossier builder (copied verbatim from the kit).
- `dashboard/` — the static dashboard (`index.html`, `app.css`, `app.js`). Fully
  offline: no external URLs anywhere.
- `screenshots/` — the three dossier screenshots (board, detail view, filtered view),
  1440×900 JPEG.

## License

MIT — see `LICENSE`.
