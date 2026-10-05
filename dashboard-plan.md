# DubBot Accessibility Dashboard — Project Plan

> **Update (2026-10-02): no personal data.** The owner scope, owner display and
> owner columns were removed. Where this plan mentions Site Owner or contacts,
> that feature no longer exists: `sites-directory.csv` holds only
> `Site ID, Display URL, List, Dubbot URL`, enforced by
> `scripts/check-directory.mjs`. See the README's "Personal data" section.
>
> **Status (2026-10-01):** milestones 0–7 are built except the server copy step
> (waiting on the internal host). See `dashboard/README.md`.

A single-page, plain HTML + JavaScript dashboard for viewing trends in the
DubBot snapshot data collected by `dubbot-cli`. No framework, no build step.

---

## 1. What the source workbook contains

`xls/Directory of Sites-Academic Support Divisions.xlsx` has 5 sheets:

| Sheet | Contents | Role for the dashboard |
|---|---|---|
| **VPAA Support Divisions** | 97 sites. URL, Division Web Lead, College Communicator, Site Owner 1/2, Content Lead 1/2, Tech Lead 1/2, Admin Contact, latest Score/PDF/Issues/Last Pull (XLOOKUPs into `snapshots`), Dubbot URL, DubBot Site ID, Notes | Site directory and metadata (names, owners, grouping). 61 rows have a Site ID; 32 say "Not Found" in DubBot |
| **DLS-Sites** | 21 sites, same columns (no Notes). 11 have a Site ID | Second site list. 4 Site IDs appear in both lists |
| **score trends** | Pivot: rows = `Collected At` timestamp, columns = Site URL, values = Sum of Score and Sum of Issues Count, plus a line chart | What the dashboard replaces |
| **pdf trends** | Pivot: Sum of PDF Count by timestamp × site, plus a line chart | What the dashboard replaces |
| **snapshots** (Table1) | 11,684 rows of raw CLI output: `Collected At, Site URL, DubBot Site ID, Score (%), PDF Count, Issues Count, Pages With Issues`. Columns L–N hold scratch sums/diffs | Backfill only. It has errors from manual pasting (see below) |

### The `exports/` folder (the primary data source)

There are 242 CSV files, each holding exactly one CLI run: 12,099 rows from
2026-03-05 to 2026-10-01, covering 68 Site IDs. Every file has the same
header (`SNAPSHOT_HEADERS`). They come in two naming patterns:

| Pattern | Files | Rows per file | Meaning |
|---|---|---|---|
| `snapshots-YYYY-MM-DDTHHMM.csv` | 170 | 59, then 67–69 | Main (VPAA) site list |
| `snapshots-dls-YYYY-MM-DDTHHMM.csv` | 72 (from 03-09) | 10 (one file has 9) | DLS site list |
| `snapshots.csv` | 1 | 59 | A single run from 03-05, from before timestamped filenames |

- **Filenames use local time** (America/Chicago). `Collected At` inside the
  files is UTC. The page uses `Collected At` and ignores the filename's time.
- **The filename tells which list a run belongs to.** A `dls-` file is a DLS
  run. The page can tag each reading with its list without needing the
  directory.
- **Schedule history:** 11 runs at 20:41 local (from `run.sh`) in early
  March, then a steady 08:00 main run plus an 08:10–08:20 DLS run.

### The exports are more reliable than the `snapshots` sheet

Where a run appears in both places, the values match exactly. But the sheet
was built by pasting rows in by hand, and that introduced errors the exports
don't have:

- **Pasted twice:** 628 site + timestamp pairs are duplicated. For example,
  07-07, 07-13, 07-14 and 07-16 have 134 rows for a 67-site run.
- **Partial pastes:** 240 rows are missing. Most of the late-August main runs
  have 26–54 of their 67 rows. These are what showed up as "partial days" in
  the first analysis. The runs themselves were complete.
- **Only in the sheet:** 12 runs (538 rows) aren't in `exports/`:
  - the **2026-01-20 baseline** (61 sites)
  - 8 test runs on 03-03 and 03-04
  - three 51-site runs on 09-01, 09-29 and 09-30

**Plan:** use `exports/` as the source of truth. Do a one-time backfill of 4
sheet-only runs (211 rows) into `snapshots-backfill.csv`: the 01-20 baseline
and the three September runs. The March test runs are dropped. After that, the
workbook is no longer needed as a data source.

### Things in the snapshot data the dashboard has to handle

1. **Two runs a day.** The main run and the DLS run have different
   timestamps. The pivots used the exact timestamp, so on the charts every
   site drops to zero every other row. **Fix:** group readings by calendar day
   (America/Chicago), keeping the latest reading per site per day. The same
   rule handles any duplicate or test runs.
2. **Gaps.** There are days with no files at all: 05-26 → 06-01,
   06-28 → 07-06, 08-02 → 08-10, 09-02 → 09-27, plus a few 1–2 day gaps. The
   DLS list also has no runs from 03-10 until at least 03-29. **Fix:** totals
   across sites carry each site's last known value forward, and the trend
   charts show gaps where there was no data. A carried-forward value is marked
   **stale after 7 days** with no new reading. Stale sites are still counted
   in totals but are flagged in the site table and the KPI tiles. The
   09-02 → 09-27 gap is the main case where this shows up.
3. **Identify sites by ID, not URL.** `studyabroad.utsa.edu` and
   `testing.utsa.edu` each appear under two URL spellings. Key everything on
   `DubBot Site ID` and take the display name from the directory.
4. **Sites join partway through.** Runs grew from 59 to 69 sites in March.
   When a newly added site brings 500 issues with it, that isn't a regression,
   so gains/losses count "new site" separately from real changes.
5. **Scores above 100.** Exactly one row: `sciences.utsa.edu`, 100.23, on
   10-01. Show the raw value with a flag.
6. **Sites missing from the directory.** Two Site IDs in the data
   (`housing.utsa.edu` and `www.utsa.edu/twc`) aren't in either directory
   sheet. They show as "not in directory", with their own scope option.
7. **Baseline vs. now:** 2026-01-20 had 61 sites, an average score of 94.1
   and 26,023 issues. 2026-10-01 had 70 distinct sites, a mean score of 97.36 and
   3,043 issues. (The workbook's 77 rows and 3,124 issues double-counted
   sites that are in both the main and DLS runs; the dashboard counts each
   site once.)

---

## 2. Dashboard features

**Header / controls**
- Data loads on page open from the hosted `data/` folder (see §3). A
  drag-and-drop fallback accepts one or more CSVs for offline use
- "Data as of" date, number of sites tracked, and DubBot coverage
  (e.g. 61 of 93 directory sites are in DubBot)
- **Scope selector:**
  - All sites, VPAA list, DLS list
  - **Site Owner**: sites where the person is Site Owner 1 or 2
  - **Custom multi-select**: a checkbox list of sites, kept in the URL so it
    can be shared
  - A single site (searchable)
- **Comparison window:** since the previous pull, 7 days, **30 days
  (default)**, 90 days, or since the baseline
- The current scope and window are stored in the URL hash, so a view can be
  bookmarked (e.g. `#site=5eea4b24…&window=30`)

**KPI tiles** (each shows the current value and the change over the window,
colored good/bad)
- Average score: a simple mean of each site's latest score. Raw values are
  used, including the rare score above 100
- Total accessibility issues
- Pages with issues
- PDF count
- Sites at 100 / sites below a threshold (e.g. under 90)

**Trend charts**
- Score over time: the average for the scope, with an optional min–max band
  across sites
- Issues over time: total for the scope; pages with issues as a second series
- PDF count over time
- Single-site scope: the same charts for that one site

**Gains & losses**
- "Biggest improvements" and "Biggest regressions" tables, ranked by change
  in issues (switchable to score) over the window
- Separate counts for "new sites added" and "sites with no recent data"

**Site table**
- Every site in scope: name, latest score, issues, PDFs, change over the
  window, a sparkline, last pull date, and a link to the DubBot site
- Sortable and filterable. Clicking a row scopes the dashboard to that site
- The single-site view also shows the directory contacts (owners and leads)

---

## 3. Technical approach

**Stack:** plain HTML, CSS and JavaScript loaded with classic `<script>`
tags. ES modules are blocked over `file://` in Chrome; classic scripts let the
page open by double-clicking `index.html`.

**Libraries:**
- None. The sandbox couldn't download Chart.js, so the charts are hand-drawn
  SVG (`js/charts.js`, with hover and keyboard support) and the sparklines are
  inline SVG. CSV parsing is about 30 lines of hand-written code. Chart.js
  can still be swapped in later if wanted

**Data inputs**

The page is hosted as static files on an internal server. A browser can't
list a directory, so the page can't discover new CSV files by itself. The
`data/` folder therefore holds:

| File | Produced by | Contents |
|---|---|---|
| `snapshots-*.csv`, `snapshots-dls-*.csv` | `dist/index.js run --out …` (one per run, existing format and names, as in `exports/` today) | Snapshot rows |
| `snapshots-backfill.csv` | One-time export from the workbook (§1) | Runs that exist only in the sheet |
| `manifest.json` | New `dubbot-stats manifest` command, or a step in `run.sh` | List of CSV filenames, each tagged with its list (`main`/`dls`, from the filename), plus the generation time |
| `sites-directory.csv` | Exported once from the VPAA and DLS sheets, then **maintained by hand**. Site IDs that aren't in the file show up as "Unlisted", and the page lists them so they're easy to add | `Site ID, Display URL, List (VPAA/DLS), Site Owner 1, Site Owner 2, Dubbot URL` |

The page reads `manifest.json` first, then fetches every CSV in parallel and
merges them. The CLI change is small: a `manifest` command scans the folder
and rewrites `manifest.json` (see "Delivering data" below).

*Alternative:* `run.sh` also appends to one cumulative `snapshots-all.csv`.
The page then fetches a single file and no manifest is needed. That's simpler,
but a cumulative file would lose the `dls-` filename tag. With about 240
files today and about 2 more a day, fetching every file is fine for a year or
more (each is under 8 KB). Past that, the manifest step could also write a
combined file.

### Delivering data from the export computer (recommendation)

The daily export runs on another computer, and the dashboard lives on an
internal web server. The recommended setup:

> **The export computer keeps the complete `data/` folder. After each run it
> rebuilds `manifest.json` and mirrors the whole folder to the web server.**

```
export computer                                   internal web server
───────────────                                   ───────────────────
08:00  dubbot-stats run --out data/snapshots-…csv
08:10  dubbot-stats run --out data/snapshots-dls-…csv
08:15  dubbot-stats manifest --dir data/         ─┐
       publish.sh: mirror data/ → server          ├─►  /dubbot-dashboard/data/
                   (CSVs first, manifest last)   ─┘    (index.html, js/, css/ deployed once)
```

Why this setup:
- **One place to fix things.** The export computer has the CLI and every
  CSV, so it builds the manifest. The web server just serves files and needs
  no scripts, Node, or cron.
- **Copying the whole folder catches up on its own.** If the network or
  server is down, nothing is lost: the next successful copy brings over
  everything that's missing. Nothing has to track what was already sent.
- **No half-updated state.** Copy the CSVs first and `manifest.json` last.
  The page then never sees a manifest that lists a file that hasn't arrived
  yet.
- **The export computer is the backup.** The full history stays on the
  machine that produced it, and the server copy can be rebuilt at any time.

**How to copy**, depending on the server (decide when the job is set up):

| Server | Copy command |
|---|---|
| Linux/macOS with SSH | `rsync -a --exclude manifest.json data/ host:/srv/dubbot/data/ && rsync -a data/manifest.json host:/srv/dubbot/data/` |
| Windows / IIS file share | `robocopy data \\server\dubbot\data /E /XF manifest.json` then copy `manifest.json` |
| Mounted SMB share (from macOS) | `rsync` to the mounted share path, same two steps |

Avoid OneDrive or SharePoint sync folders as the delivery path. Sync timing
is unpredictable, the manifest can arrive before the CSVs, and SharePoint
won't reliably serve `.html` files.

**`manifest.json` format** (written by the new CLI command):
```json
{
  "generatedAt": "2026-10-01T13:15:02Z",
  "files": [
    { "name": "snapshots-backfill.csv", "list": "backfill", "rows": 211 },
    { "name": "snapshots-2026-10-01T0800.csv", "list": "main", "collectedAt": "2026-10-01T13:00:00.591Z", "rows": 67 },
    { "name": "snapshots-dls-2026-10-01T0811.csv", "list": "dls", "collectedAt": "2026-10-01T13:11:37.939Z", "rows": 10 }
  ]
}
```

**Caching:** once a CSV is written it never changes, so the browser can
cache it for a long time. The page requests `manifest.json?t=<now>` to get a
fresh copy, then fetches each CSV by name. Repeat visits only download the
new files. If the server allows it, set `Cache-Control: no-cache` on
`manifest.json`.

**Data health check on the page:** show the newest `collectedAt` for the main
and DLS lists. Show a warning banner when either is more than 36 hours old,
so a broken export job is noticed within a day instead of after a 27-day gap
like September's.

**Directory metadata and privacy:** `sites-directory.csv` only includes the
columns the page needs: Site Owner (for scoping), list membership and the
DubBot link. The other contact columns (Content, Tech, Admin leads) stay out
of the published folder unless you decide otherwise.

**Data pipeline (in the browser)**
```
manifest.json → fetch CSVs + sites-directory.csv
     → parse → normalize (types, Site ID key, Chicago-local day)
     → dedupe (latest reading per site per day)
     → daily series per site
     → carry-forward aggregate per scope
     → metrics (KPIs, deltas, movers) → render
```
Fetching the CSVs needs HTTP. Opened from `file://`, the page falls back to
drag-and-drop (which is why it uses classic scripts). For local testing, run
`npx serve dashboard` or `python3 -m http.server`.

**Proposed layout** (new folder, separate from the CLI's TypeScript):
```
dashboard/
  index.html
  css/styles.css
  js/
    load.js      # manifest + CSV fetch, CSV parser, drag-drop fallback
    model.js     # normalize, dedupe, daily series, carry-forward
    metrics.js   # KPIs, window deltas, movers
    charts.js    # SVG line chart, sparklines, data-table fallback
    ui.js        # scope/window/owner/multi-select controls, tables, URL hash state
    app.js       # wiring
  data/          # gitignored; deployed alongside the page
    manifest.json
    sites-directory.csv
    snapshots-*.csv
  README.md      # deploy steps
src/commands/manifest.ts   # new: writes data/manifest.json (CLI side)
scripts/publish.sh         # new: manifest + mirror data/ to the server (runs on the export computer)
```

**Accessibility:** this is an a11y dashboard, so it should meet WCAG 2.1 AA
itself:
- Keyboard-operable controls
- A data-table fallback for each chart
- Color isn't the only signal for good/bad changes (arrows and +/− signs too)
- Contrast checked in both light and dark modes

---

## 4. Milestones

0. **Seed the data.**
   - Copy `exports/*.csv` into `dashboard/data/`
   - Write `snapshots-backfill.csv`, containing the 4 sheet-only runs from §1
     (211 rows, no March test runs)
   - Build `sites-directory.csv` from the VPAA and DLS sheets
1. **CLI manifest.** Add the `dubbot-stats manifest --dir <folder>` command,
   and a `scripts/publish.sh` stub. Wiring it into the export computer's
   schedule happens later.
2. **Scaffold and load data.** `index.html`, the fetch + CSV parser, and the
   drag-drop fallback. Show row and file counts. *Check: 242 export files
   with 12,099 rows load, plus 211 backfill rows.*
3. **Data model.** Day bucketing, dedupe, Site ID join with the directory,
   carry-forward. *Check: 2026-01-20 and 2026-10-01 totals match §1.*
4. **KPIs and trend charts** for the All-sites scope, plus the window
   selector (defaults to 30 days).
5. **Scopes.** VPAA/DLS lists, Site Owner, custom multi-select and single
   site, with URL hash state so links can be shared.
6. **Gains/losses tables and the site table** with sparklines.
7. **Polish and deploy:** a11y pass, dark mode, print styles, README with
   deploy steps for the internal server.

---

## 5. Decisions so far

- **Data:** the per-run CSVs written by `dist/index.js` (the `exports/`
  format), served from `data/` next to the page. The workbook is used only
  for a one-time backfill and to build the directory
- **Scopes:** All, VPAA list, DLS list, Site Owner, custom multi-select,
  single site
- **Default window:** 30 days
- **Audience:** shared internally, as static files on an internal server
- **Delivery:** the daily export runs on another computer. That computer
  builds `manifest.json` and mirrors `data/` to the web server, CSVs first and
  manifest last (§3). The exact copy command gets set up later
- **Backfill:** the 01-20 baseline plus three September runs. The March test
  runs are dropped
- **Stale threshold:** 7 days with no new reading
- **Directory:** `sites-directory.csv` is maintained by hand. The CLI's
  `--sites-file` stays a plain list of IDs
- **Average score:** a simple mean of each site's latest score across the
  sites in scope (including stale sites, which carry forward)
- **Scores above 100:** shown as reported, with a flag icon and a tooltip
  ("DubBot reported a score above 100"). The flag also appears in the data
  table fallback

## 6. Open questions

1. **Which internal host?** This decides which copy command goes into
   `publish.sh`: a Linux server with SSH, an IIS/Windows share, or something
   else. SharePoint isn't recommended (§3).
