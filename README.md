# dubbot-stats

CLI tool that queries the [DubBot](https://dubbot.com) GraphQL API for
accessibility statistics across a list of sites and appends one CSV row per
site per run to a cumulative snapshots file.

**What's in this repo**

| Piece | Purpose | Docs |
|---|---|---|
| `dubbot-stats run` | Export one CSV of stats per run | [Usage](#usage) |
| `scripts/build-manifest.mjs` | Index the CSVs so the dashboard can find them (plain Node, no credentials) | [Manifest](#manifest-command) |
| `scripts/publish.sh` | Rebuild the manifest and copy `dashboard/data/` to the web server | [Publishing](#publishing-the-dashboard-data) |
| `dashboard/` | One-page HTML/JS dashboard over the CSVs | [Dashboard](#dashboard) |
| `.github/workflows/publish.yml` | Daily export in GitHub Actions + deploy the dashboard to GitHub Pages | [GitHub Pages](#publishing-to-github-pages) |

---

## Requirements

- Node.js 20 or later
- A DubBot account with an API key
- Your DubBot Account ID and one or more Site IDs

---

## Installation

```bash
# Clone and install dependencies
git clone <repo-url>
cd dubbot-cli
npm install

# Build the CLI
npm run build
```

---

## Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Then fill in your credentials:

```env
DUBBOT_API_KEY=dubbot_your_api_key_here
DUBBOT_ACCOUNT_ID=your_account_id_here
DUBBOT_SITE_IDS=siteId1,siteId2,siteId3
DUBBOT_API_URL=https://api.dubbot.com/graphql
OUTPUT_FILE=./snapshots.csv
```

### Finding your credentials

| Value | Where to find it |
|---|---|
| `DUBBOT_API_KEY` | DubBot dashboard → Account → API Keys |
| `DUBBOT_ACCOUNT_ID` | DubBot dashboard URL or Account settings |
| `DUBBOT_SITE_IDS` | DubBot dashboard → Sites (24-character hex IDs) |

> **Note:** `DUBBOT_API_URL` and `OUTPUT_FILE` are optional — the defaults
> shown above will be used if omitted.

---

## Usage

### Verify your setup

Before running a full collection, confirm your credentials and API connectivity:

```bash
node dist/index.js validate
```

Expected output:
```
OK — connected to DubBot API, site: https://business.utsa.edu/
```

---

### Collect stats for all configured sites

```bash
# Append one row per site to snapshots.csv (creates file on first run)
node dist/index.js run --out snapshots.csv

# Uses OUTPUT_FILE from .env if --out is not specified
node dist/index.js run

# Print to stdout instead of writing to a file (useful for testing)
node dist/index.js run --dry-run
```

---

### Specify site IDs at runtime

You have three ways to supply site IDs, in priority order:

#### 1. Inline flag (highest priority)

```bash
node dist/index.js run --sites "siteId1,siteId2,siteId3" --out snapshots.csv
```

#### 2. CSV file

Provide a plain text or CSV file with one site ID per line:

```
# sites.csv
site_id
5eea4b24482faf49264a90d7
655523be21e3820001682032
5f121915482faf0a6d952013
```

```bash
node dist/index.js run --sites-file ./sites.csv --out snapshots.csv
```

Supported file formats:
- One ID per line (with or without a header row)
- Comma-separated IDs on a single line
- A mix of both
- Blank lines are ignored
- A non-hex first line is automatically treated as a header and skipped

#### 3. Environment variable (fallback)

```env
DUBBOT_SITE_IDS=siteId1,siteId2,siteId3
```

---

### Options reference

Commands: `run` (default), `validate`, `list-sites` and `schema`
(the last two are stubs).

```
Usage: dubbot-stats run [options]

Options:
  -s, --sites <ids>        Comma-separated DubBot site IDs (overrides env var)
  -f, --sites-file <path>  CSV file of site IDs, one per line (overrides env var)
  -o, --out <file>         Output CSV file path (appends if exists; default: stdout)
  --dry-run                Fetch data and print to stdout regardless of --out
  --verbose                Print full API response payloads to stderr
  --no-header              Skip writing the header row (accepted but not yet implemented)
```

---

## CSV Output

Each run appends one row per site. The header is written only once (when the
file is first created).

```csv
Collected At,Site URL,DubBot Site ID,Score (%),PDF Count,Issues Count,Pages With Issues
2026-03-03T08:00:00.000Z,https://business.utsa.edu/,5eea4b24482faf49264a90d7,99.96,62,9,8
2026-03-03T08:00:00.000Z,https://www.utsa.edu/senate,655523be21e3820001682032,100,484,0,0
```

All rows from a single run share the same `Collected At` timestamp so they
form a coherent snapshot for trending charts.

### Column definitions

| Column | Source |
|---|---|
| Collected At | System clock at run start (UTC ISO 8601) |
| Site URL | `site.url` from DubBot API |
| DubBot Site ID | `site.id` from DubBot API |
| Score (%) | `site.latestStatsSnapshot.accessibility.score` |
| PDF Count | `assets.totalEntries` (filtered to PDFs) |
| Issues Count | `site.accessibilityCount` |
| Pages With Issues | `site.latestStatsSnapshot.accessibility.affectedPagesCount` |

---

## Manifest command

The dashboard is static files, and a browser can't list a folder, so
`scripts/build-manifest.mjs` writes `manifest.json` listing every `snapshots*.csv`
in a folder (name, list, first `Collected At`, row count). It is plain Node: no
`npm install`, no build, no DubBot credentials.

```bash
node scripts/build-manifest.mjs dashboard/data
```

List tags come from the filename: `snapshots-dls-*` is `dls`,
`snapshots-backfill*` is `backfill`, anything else is `main`. Run it after every
export. The file is written atomically (temp file + rename).

---

## Dashboard

A one-page, plain HTML + JavaScript dashboard (no framework, no build step, no
libraries): KPI tiles with change over a comparison window (default 30 days),
score / issues / PDF trend charts, biggest gains and losses, and a sortable
site table. Scope it to all sites, the VPAA or DLS list, a custom
selection, or one site. The URL hash stores the view, so links are shareable.

### Run it locally

```bash
python3 -m http.server 8765 --directory dashboard
# open http://localhost:8765
```

Opened from disk (`file://`) the page can't fetch `data/`, so it shows a drop
zone for CSV files instead.

### Data folder

`dashboard/data/` is gitignored and holds:

| File | Source |
|---|---|
| `snapshots-*.csv`, `snapshots-dls-*.csv` | One per export run (`run --out dashboard/data/snapshots-$(date +%Y-%m-%dT%H%M).csv`) |
| `snapshots-backfill.csv` | One-time rows that only existed in the old workbook (01-20 baseline, 09-01, 09-29, 09-30) |
| `sites-directory.csv` | **Maintained by hand**: `Site ID, Display URL, List, Dubbot URL` and nothing else. `List` is `VPAA`, `DLS`, or `VPAA;DLS`. Sites missing from it show as "not in directory". **No names, emails or other personal data**: see [Personal data](#personal-data) |
| `manifest.json` | Generated by `scripts/build-manifest.mjs` |

### Rebuilding the data folder from `exports/`

Use this whenever `exports/` changes (new daily runs, fixed files) and you want
`dashboard/data/` to match it exactly. Run from the repo root:

```bash
# 1. Remove the old copies and manifest. Keep snapshots-backfill.csv and
#    sites-directory.csv: they do NOT come from exports/.
find dashboard/data -maxdepth 1 -name 'snapshots*.csv' ! -name 'snapshots-backfill.csv' -delete
rm -f dashboard/data/manifest.json

# 2. Copy every export in
cp exports/*.csv dashboard/data/

# 3. Regenerate the manifest
node scripts/build-manifest.mjs dashboard/data

# 4. Check it
node dashboard/tests/model.test.js

# 5. Reload the dashboard (python3 -m http.server 8765 --directory dashboard)
```

Notes:
- Step 3 needs `exports/` to be the complete history. Anything not in it is not in the dashboard.
- `snapshots-backfill.csv` holds the 2026-01-20 baseline and the 09-01, 09-29 and 09-30 runs that only existed in the old workbook. Deleting it drops those readings.
- `sites-directory.csv` is maintained by hand. If it's missing, the VPAA and DLS lists are unavailable.

### How the numbers work

- Readings are grouped by calendar day (America/Chicago); the latest reading per site per day wins.
- Sites are keyed by DubBot Site ID, not URL.
- Totals carry each site's last reading forward. A site with no new reading for 7 days is **stale** (still counted, flagged).
- On days when no site in scope was read, chart lines connect the neighbouring readings with a straight line. The tooltip marks those values with `~` as estimates; the data tables list only real readings.
- Average score is a simple mean across sites in scope. Scores above 100 are shown as reported, with a flag.
- With more than one site in scope, the **score**, **issues** and **PDF** charts draw one thin line per site (no legend). Hover to highlight the nearest line and see its site name and value, with the scope total or average in the same tooltip; with the keyboard, use Left/Right for days and Up/Down to step through sites. A single site keeps its own labelled lines. The data tables under the charts still list scope totals; per-site values are in the Sites table.
- **Compare with** sets the period for everything: the change tiles, the gains/losses, and the x axis of every chart, chart table and table sparkline (7, 30, 90 days, since the previous reading, or since the baseline). The y axis refits to that period.
- Change tiles compare only sites present at the window start; new sites are reported separately.
- A banner warns when the newest main or DLS export is over 36 hours old.

### Personal data

The pipeline is designed to hold **no staff names or other personal data**:

- **Pulled:** the CLI's GraphQL query asks DubBot only for site URL, score, issue count, affected-page count and PDF count. It never requests people.
- **Generated:** the CSVs contain only those fields. The dashboard has no owner or contact scopes, filters or displays.
- **Stored:** the dashboard's directory loader reads only `Site ID, Display URL, List, Dubbot URL` and ignores any other column. `scripts/check-directory.mjs` fails the deploy if any other column or an email-like value appears. Workbooks (`*.xlsx`, `xls/`) are gitignored.

Keep owner/contact spreadsheets outside this repo. To enforce the rule at commit time on the `data` branch, add a pre-commit hook in that checkout:

```bash
# in the data branch worktree (git worktree add ../dubbot-data data)
printf '#!/bin/sh\nnode ../dubbot-cli/scripts/check-directory.mjs sites-directory.csv\n' > "$(git rev-parse --git-path hooks/pre-commit)"
chmod +x "$(git rev-parse --git-path hooks/pre-commit)"
```

### Tests

```bash
node dashboard/tests/model.test.js
```

Checks the loader, model and metrics against the real `dashboard/data/`
(at least 243 files and 12,310 rows, plus the fixed 2026-01-20 and 2026-10-01
totals) and prints a summary. It needs a generated `manifest.json`. Prints `OK`
on success and exits non-zero on a failed assertion. Set `DATA_DIR=<folder>` to
test a different data folder (CI does this).

### Publishing to GitHub Pages

`.github/workflows/publish.yml` runs the export and deploys the dashboard to
`https://utsa-asc.github.io/dubbot-cli-tool/` every day.

```
main branch: code, dashboard/, workflow          data branch: CSVs only
                                                 (snapshots-*.csv, backfill, sites-directory.csv)
publish.yml (four jobs; no job that runs npm holds a write token or deploy rights)
  export  (read-only + DubBot secrets)  npm ci, build, run main then DLS list, upload CSVs as an artifact
  commit  (contents: write, no npm)     validate file names/headers, commit new CSVs to `data`
  build   (read-only)                   copy dashboard + data, check the directory,
                                        build manifest, run tests, upload the Pages artifact (no npm, no secrets)
  deploy  (pages + id-token, no code)   publish the artifact
```

**Triggers**
- Daily at 13:00 UTC (08:00 US Central during daylight time; 07:00 in winter).
- Push to `main` touching `dashboard/`, `scripts/`, `src/` or the workflow: redeploys only, no export.
- Manual: **Actions → Publish dashboard → Run workflow** (untick *run_export* to redeploy without exporting).

**How it behaves**
- The main and DLS exports run back to back. If one fails, the other still runs, any new CSVs are still committed and deployed, and the run is marked failed so you get notified.
- The `commit` job only accepts files named `snapshots[-dls]-YYYY-MM-DDTHHMM.csv` with the exact CSV header and at least one data row, and never overwrites an existing file.
- Actions are pinned to commit SHAs (release in the trailing comment) and installs use `npm ci --ignore-scripts`. Dependabot (`.github/dependabot.yml`) opens weekly PRs for both; review them, don't auto-merge.
- If the export failed entirely, the deploy still publishes the existing data. The dashboard banner warns when data is over 36 hours old.
- The deploy job runs `scripts/check-directory.mjs` on `sites-directory.csv`. It fails the deploy if the file has any column other than `Site ID, Display URL, List, Dubbot URL`, any cell containing `@`, or a `Dubbot URL` that is not an https link on `dubbot.com`.
- The deploy job runs `dashboard/tests/model.test.js` against the assembled site and stops if it fails.
- CSV file names use US Central time (like the old local job); `Collected At` inside is UTC.

**One-time setup**
1. Merge `feature/web-dashboard` into `main` (Pages deploys from `main` only).
2. Push the seeded `data` branch: `git push -u origin data`.
3. Add repository secrets (**Settings → Secrets and variables → Actions**). The two site lists hold the file contents as-is:
   ```bash
   gh secret set DUBBOT_API_KEY
   gh secret set DUBBOT_ACCOUNT_ID
   gh secret set SITES_MAIN_CSV < sites.csv
   gh secret set SITES_DLS_CSV  < sites-dls.csv
   ```
4. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
5. Run the workflow manually once and check the result.

**Updating the directory**: edit `sites-directory.csv` on the `data` branch (the four allowed columns only; run `node scripts/check-directory.mjs sites-directory.csv` first) and push; it goes live on the next deploy (run the workflow manually to publish sooner).

**Switching over from the local job**: both can run in parallel while you test. The local job's CSVs (`exports/`) and the Actions CSVs (`data` branch) are separate histories; after switching, copy any local-only runs into the `data` branch if you want them in the dashboard.

### Publishing the dashboard data (alternative: your own web server)

The export computer keeps the full `dashboard/data/` folder. After each day's
exports it rebuilds the manifest and mirrors the folder to the web server:

```bash
scripts/publish.sh
```

The script runs `scripts/build-manifest.mjs` (using `DATA_DIR`, `NODE` env overrides) and then
needs the copy command for your host, which is **not yet configured** (the
`rsync` / `robocopy` lines are commented in the script). Copy CSVs first and
`manifest.json` last so the page never sees a manifest listing files that
haven't arrived. Avoid OneDrive/SharePoint sync folders for this. Deploy
`index.html`, `css/` and `js/` once; only `data/` changes daily.

---

## Scheduling

### GitHub Actions

The daily export now lives in `.github/workflows/publish.yml`, which also
publishes the dashboard. See [Publishing to GitHub Pages](#publishing-to-github-pages).

### macOS — launchd (recommended for Mac)

A template plist is included in the repo at `edu.utsa.asc.dubbot-cli.plist.example`. Copy it
to the LaunchAgents directory and edit the placeholder paths (it contains no credentials):

```bash
cp edu.utsa.asc.dubbot-cli.plist.example ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist
```

Because launchd does not invoke a shell, `$(date ...)` expansion is not available
directly in `ProgramArguments`. The recommended approach is to point launchd at a
small wrapper script that handles the timestamped filename.

**Credentials stay in `.env`, not in the plist.** The CLI reads `DUBBOT_API_KEY`
and `DUBBOT_ACCOUNT_ID` from `.env` (see [Configuration](#configuration)). A plist
is plain text and often world-readable, so do not put the API key in it. launchd
starts jobs in `/`, and `.env` is read from the current directory, so the wrapper
script below `cd`s into the project first.

**Step 1 — lock down `.env`:**

```bash
chmod 600 .env
```

**Step 2 — create the wrapper script** (e.g. `/path/to/dubbot-cli/run.sh`):

```bash
#!/bin/bash
set -euo pipefail

DUBBOT_DIR="/path/to/dubbot-cli"
EXPORT_DIR="$DUBBOT_DIR/exports"
NODE="/path/to/node"   # launchd has a minimal PATH; use the output of `which node`

# dotenv reads ./.env and launchd starts jobs in /, so run from the project dir
cd "$DUBBOT_DIR"

mkdir -p "$EXPORT_DIR" "$DUBBOT_DIR/logs"

# Main list (file name has no prefix)
"$NODE" "$DUBBOT_DIR/dist/index.js" run \
  --sites-file "$DUBBOT_DIR/sites.csv" \
  --out "$EXPORT_DIR/snapshots-$(date +%Y-%m-%dT%H%M).csv"

# Optional second list (the dashboard tells lists apart by the `snapshots-dls-` prefix)
# "$NODE" "$DUBBOT_DIR/dist/index.js" run \
#   --sites-file "$DUBBOT_DIR/sites-dls.csv" \
#   --out "$EXPORT_DIR/snapshots-dls-$(date +%Y-%m-%dT%H%M).csv"
```

Make it executable:

```bash
chmod +x /path/to/dubbot-cli/run.sh
```

**Step 3 — configure the plist** to call the wrapper script. Note there is no
`EnvironmentVariables` block and no secret in it:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>edu.utsa.asc.dubbot-cli</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/path/to/dubbot-cli/run.sh</string>
  </array>

  <!-- Run every day at 08:00 local time -->
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <!-- Logs go in the project, not /tmp (which other users can read) -->
  <key>StandardOutPath</key>
  <string>/path/to/dubbot-cli/logs/dubbot-stats.log</string>
  <key>StandardErrorPath</key>
  <string>/path/to/dubbot-cli/logs/dubbot-stats.err</string>
</dict>
</plist>
```

Replace `/path/to/dubbot-cli` and `/path/to/node` with absolute paths. To find the
full path to `node`, run `which node` in your terminal. Create the `logs/` folder
before the first run (launchd will not create it): `mkdir -p /path/to/dubbot-cli/logs`.

**Step 4 — check it before loading:**

```bash
chmod 600 ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist
```

```bash
plutil -lint ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist
```

```bash
grep -c "dubbot_" ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist   # should print 0
```

Load and enable the job:

```bash
launchctl load ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist
```

Other useful commands:

```bash
# Unload (disable) the job
launchctl unload ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist

# Reload after editing the plist (unload first, then load again)
launchctl unload ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist
launchctl load ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist

# Trigger a run immediately (without waiting for the schedule)
launchctl start edu.utsa.asc.dubbot-cli

# Check whether the job is loaded
launchctl list | grep dubbot
```

> **Note:** The job only runs while your Mac is awake and logged in. If the
> machine is asleep at the scheduled time, the run is skipped (launchd does
> **not** catch up missed jobs by default).

### Cron (Linux / local machine)

```bash
# Run every Monday at 7am, write a timestamped CSV per run
0 7 * * 1 node /path/to/dubbot-cli/dist/index.js run \
  --sites-file /path/to/dubbot-cli/sites.csv \
  --out "/path/to/dubbot-exports/snapshots-$(date +%Y-%m-%dT%H%M).csv" \
  >> /var/log/dubbot-stats.log 2>&1
```

The shell expands `$(date +%Y-%m-%dT%H%M)` at run time, producing filenames like
`snapshots-2026-03-09T0700.csv`. Make sure the output directory exists before the
first run:

```bash
mkdir -p /path/to/dubbot-exports
```

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Config / env validation error or unhandled exception |
| `2` | API error — connectivity failure (`validate`) or no sites returned data (`run`) |

---

## Troubleshooting

**`expired_token` error**
The API key in your `.env` is using the wrong header format or has expired.
Run `validate` to check connectivity. The API uses an `X-Api-Key` header, not
`Authorization: Bearer`.

**Only one row per run despite multiple site IDs**
Check your `DUBBOT_SITE_IDS` value is comma-separated with no spaces between
IDs: `id1,id2,id3` — not `id1, id2` or separate lines.

**All rows in the CSV show the same site**
The rows are from separate runs, not one run with multiple sites. Each run
stamps a unique `Collected At` timestamp — check if all rows share the exact
same timestamp (same run, wrong config) or have different timestamps (multiple
runs, only one site configured).

**CSV has no header row**
The file already existed when the first run wrote to it (header-once logic).
Delete the file and run again, or manually prepend the header:
```
Collected At,Site URL,DubBot Site ID,Score (%),PDF Count,Issues Count,Pages With Issues
```
