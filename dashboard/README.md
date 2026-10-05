# DubBot Accessibility Dashboard

A one-page, plain HTML + JavaScript dashboard for the snapshot CSVs written by
`dubbot-stats`. No framework, no build step, no libraries (charts are SVG drawn
in `js/charts.js`).

## Run it locally

```bash
python3 -m http.server 8765 --directory dashboard
# then open http://localhost:8765
```

Opened straight from disk (`file://`) the page can't fetch `data/`, so it shows
a drop zone: drop `snapshots-*.csv` files (and optionally `sites-directory.csv`).

## Data folder (`dashboard/data/`, gitignored)

| File | Source |
|---|---|
| `snapshots-*.csv`, `snapshots-dls-*.csv` | One per CLI run (`dubbot-stats run --out ...`). `dls-` in the name tags the DLS list |
| `snapshots-backfill.csv` | One-time export of runs that only existed in the workbook (01-20 baseline, 09-01, 09-29, 09-30) |
| `sites-directory.csv` | **Maintained by hand.** `Site ID, Display URL, List, Dubbot URL` only. `List` is `VPAA`, `DLS`, or `VPAA;DLS`. Sites missing from it show as "not in directory". No personal data: `scripts/check-directory.mjs` enforces this |
| `manifest.json` | Written by `scripts/build-manifest.mjs dashboard/data` |

The page reads `manifest.json` first, then fetches every CSV it lists.
After new exports land, rebuild the manifest:

```bash
node scripts/build-manifest.mjs dashboard/data
```

## Publishing

`scripts/publish.sh` rebuilds the manifest and (once configured) mirrors
`dashboard/data/` to the web server: CSVs first, `manifest.json` last. Deploy
`index.html`, `css/`, `js/` once; only `data/` changes day to day. Fill in the
copy command in the script when the host is chosen.

## How the numbers work

- Readings are grouped by calendar day (America/Chicago); the latest reading per site per day wins.
- Sites are keyed by DubBot Site ID, not URL.
- Totals carry each site's last reading forward. A site with no new reading for 7 days is **stale** (still counted, flagged).
- On days when no site in scope was read, chart lines connect the neighbouring readings with a straight line (tooltip values marked `~` are estimates; data tables show real readings only).
- Average score is a simple mean across sites in scope. Scores above 100 are shown as reported with a flag.
- Change tiles compare only sites that existed at the window start; new sites are reported separately.

## Tests

```bash
node dashboard/tests/model.test.js   # checks the model against dashboard/data/
```
