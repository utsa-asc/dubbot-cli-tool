# dubbot-stats

CLI tool that queries the [DubBot](https://dubbot.com) GraphQL API for
accessibility statistics across a list of sites and appends one CSV row per
site per run to a cumulative snapshots file.

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

## Scheduling

### GitHub Actions (recommended)

The included workflow runs every Monday at 8am UTC and uploads `snapshots.csv`
as a build artifact.

Add these secrets to your repository (**Settings → Secrets → Actions**):

| Secret | Value |
|---|---|
| `DUBBOT_API_KEY` | Your DubBot API key |
| `DUBBOT_ACCOUNT_ID` | Your DubBot account ID |
| `DUBBOT_SITE_IDS` | Comma-separated site IDs |

To trigger manually: **Actions → DubBot Stats → Run workflow**.

### macOS — launchd (recommended for Mac)

A template plist is included in the repo at `edu.utsa.asc.dubbot-cli.plist.example`. Copy it
to the LaunchAgents directory and edit the placeholder values:

```bash
cp edu.utsa.asc.dubbot-cli.plist.example ~/Library/LaunchAgents/edu.utsa.asc.dubbot-cli.plist
```

Because launchd does not invoke a shell, `$(date ...)` expansion is not available
directly in `ProgramArguments`. The recommended approach is to point launchd at a
small wrapper script that handles the timestamped filename.

**Step 1 — create the wrapper script** (e.g. `/path/to/dubbot-cli/run.sh`):

```bash
#!/bin/bash
set -euo pipefail

DUBBOT_DIR="/path/to/dubbot-cli"
EXPORT_DIR="/path/to/dubbot-exports"

mkdir -p "$EXPORT_DIR"

"$DUBBOT_DIR/node_modules/.bin/ts-node" "$DUBBOT_DIR/dist/index.js" run \
  --sites-file "$DUBBOT_DIR/sites.csv" \
  --out "$EXPORT_DIR/snapshots-$(date +%Y-%m-%dT%H%M).csv"
```

Make it executable:

```bash
chmod +x /path/to/dubbot-cli/run.sh
```

**Step 2 — configure the plist** to call the wrapper script:

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

  <!-- Pass your credentials as environment variables -->
  <key>EnvironmentVariables</key>
  <dict>
    <key>DUBBOT_API_KEY</key>
    <string>dubbot_your_api_key_here</string>
    <key>DUBBOT_ACCOUNT_ID</key>
    <string>your_account_id_here</string>
  </dict>

  <key>StandardOutPath</key>
  <string>/tmp/dubbot-stats.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/dubbot-stats.err</string>
</dict>
</plist>
```

Replace `/path/to/dubbot-cli` and `/path/to/dubbot-exports` with absolute paths.
To find the full path to `node`, run `which node` in your terminal.

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
