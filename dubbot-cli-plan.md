# DubBot Accessibility Stats CLI — Implementation Plan

## Overview

A TypeScript CLI tool (`dubbot-stats`) that queries the DubBot GraphQL API for
accessibility statistics across all configured sites and outputs a timestamped
CSV file. Each run appends one row per site to the CSV, producing a cumulative
snapshot history that feeds the **Snapshots** sheet (Sheet 2) in the
accessibility tracking spreadsheet for trending analysis.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript (Node 20+) | Type safety, broad ecosystem |
| CLI framework | [Commander.js](https://github.com/tj/commander.js) | Lightweight, well-documented |
| HTTP / GraphQL | `graphql-request` | Minimal GraphQL client, tree-shakeable |
| CSV output | `csv-stringify` | RFC 4180-compliant, streams support |
| Config / env | `dotenv` + `zod` | Type-safe env validation at startup |
| Logging | `pino` | Structured JSON logs for CI pipelines |
| Packaging | `tsup` + `npx` | Distribute as npm package or run directly |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Entry Point                       │
│   dubbot-stats run [--sites <ids>] [--out <file>] [--append]│
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │          Orchestrator        │
              │  1. Load & validate config   │
              │  2. Fetch stats per site     │
              │  3. Transform → SnapshotRow  │
              │  4. Write / append CSV       │
              │  5. Log result / exit code   │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │        DubBot Client         │
              │  GraphQL over HTTPS          │
              │  Auth: Bearer API key        │
              └─────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │         CSV Writer           │
              │  Append rows to output file  │
              │  or print to stdout          │
              └─────────────────────────────┘
```

---

## Configuration

All secrets live in environment variables (`.env` for local, CI secrets for
pipelines).

```env
# DubBot
DUBBOT_API_KEY=your_dubbot_api_key
DUBBOT_API_URL=https://api.dubbot.com
DUBBOT_ACCOUNT_ID=your_dubbot_account_id

# Comma-separated list of DubBot site IDs to collect in a single run
# Can also be passed via --sites CLI flag
DUBBOT_SITE_IDS=5f121915482faf0a6d952013,655523be21e3820001682032

# Output file path (CSV). Omit to print to stdout.
OUTPUT_FILE=./snapshots.csv
```

A `zod` schema validates all required variables at startup and exits with a
clear error message if any are missing.

---

## CSV Output Format — Snapshots Schema

Each run produces one CSV row per site. The columns match the **Snapshots**
sheet (Sheet 2) of the accessibility tracking spreadsheet exactly, so rows can
be pasted or imported directly without column remapping.

### Column Definitions

| Col | Header | Type | Source | Description |
|---|---|---|---|---|
| A | `Collected At` | ISO 8601 datetime | CLI (system clock) | UTC timestamp of when this CLI run executed. Format: `YYYY-MM-DDTHH:mm:ssZ`. Serves as the X-axis for all trending charts. |
| B | `Site URL` | String | DubBot API | The public-facing URL of the site as configured in DubBot (e.g. `https://business.utsa.edu/`). Used as the join key back to the Sites sheet (Col A). |
| C | `DubBot Site ID` | String | DubBot API | The internal DubBot site identifier (e.g. `5f121915482faf0a6d952013`). Primary key when querying DubBot directly. |
| D | `Score (%)` | Number (0–100) | `site.latestStatsSnapshot.accessibility.score` | The accessibility-specific score as reported by DubBot. Higher is better. |
| E | `PDF Count` | Integer | `assets.totalEntries` (separate query) | Total PDF documents discovered during the most recent crawl. Fetched via the `assets` query with `assetTypes: ["pdf"]`. |
| F | `Issues Count` | Integer | `site.accessibilityCount` | Total accessibility issues found across all pages in the most recent scan. |
| G | `Pages With Issues` | Integer | `site.latestStatsSnapshot.accessibility.affectedPagesCount` | Number of distinct pages containing at least one accessibility issue. |

### Example Output

```csv
Collected At,Site URL,DubBot Site ID,Score (%),PDF Count,Issues Count,Pages With Issues
2026-03-03T14:00:00Z,https://business.utsa.edu/,5eea4b24482faf49264a90d7,99.96,62,9,8
2026-03-03T14:00:00Z,https://senate.utsa.edu/,655523be21e3820001682032,100,484,0,0
```

---

## DubBot API Integration

> DubBot exposes a **GraphQL** API (not a traditional REST API).
> Auth is via an `Authorization: Bearer <API_KEY>` header on every request.

### Confirmed Queries

Two queries are executed per site and combined into one HTTP request.

#### Query 1 — Site Stats

```graphql
query SiteQuery($siteId: String!, $accountId: String!) {
  site(siteId: $siteId, accountId: $accountId) {
    id                                              # → Col C: DubBot Site ID
    url                                             # → Col B: Site URL
    accessibilityCount                              # → Col F: Issues Count
    latestStatsSnapshot {
      accessibility {
        score                                       # → Col D: Score (%)
        affectedPagesCount                          # → Col G: Pages With Issues
      }
    }
  }
}
```

#### Query 2 — PDF Count

```graphql
query SiteAssets($siteId: String!, $accountId: String!) {
  assets(
    siteId: $siteId
    accountId: $accountId
    assetTypes: ["pdf"]
    page: 1
    perPage: 1
    sortBy: path
    sortOrder: asc
  ) {
    totalEntries                                    # → Col E: PDF Count
  }
}
```

Both queries share the same `siteId` / `accountId` variables and can be sent
as a single GraphQL request body with two root-level fields.

### Multi-Site Run

The CLI loops over all site IDs in `DUBBOT_SITE_IDS` (or `--sites` flag),
fires one GraphQL request per site, and collects all results before writing
the CSV. All rows in a single run share the same `Collected At` timestamp so
they appear as a coherent snapshot in charts.

### Client Module (`src/clients/dubbot.ts`)

```typescript
import { GraphQLClient } from 'graphql-request';
import { config } from '../config';

export async function fetchSiteStats(siteId: string): Promise<SiteStats> {
  const client = new GraphQLClient(config.DUBBOT_API_URL, {
    headers: { Authorization: `Bearer ${config.DUBBOT_API_KEY}` },
  });
  const data = await client.request(SITE_QUERY, {
    siteId,
    accountId: config.DUBBOT_ACCOUNT_ID,
  });
  return { ...data.site, pdfCount: data.assets.totalEntries };
}
```

---

## CSV Writer

The CLI uses `csv-stringify` to produce RFC 4180-compliant output.

- If `OUTPUT_FILE` is set (or `--out` flag provided), rows are **appended** to
  that file. The header row is written only when the file does not yet exist.
- If no output file is specified, rows are written to **stdout**, making the
  tool composable with shell pipelines (e.g. redirect to a file, pipe to
  another tool).

### Writer Module (`src/writers/csv.ts`)

```typescript
import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import { SNAPSHOT_HEADERS } from '../models/SnapshotRow';

export function writeRows(rows: string[][], outputPath?: string) {
  const fileExists = outputPath && fs.existsSync(outputPath);
  const data = fileExists ? rows : [SNAPSHOT_HEADERS, ...rows];
  const csv = stringify(data);

  if (outputPath) {
    fs.appendFileSync(outputPath, csv);
  } else {
    process.stdout.write(csv);
  }
}
```

---

## Project Structure

```
dubbot-stats/
├── src/
│   ├── index.ts              # CLI entry point (Commander)
│   ├── config.ts             # zod env schema + typed config object
│   ├── orchestrator.ts       # Main run() function
│   ├── clients/
│   │   └── dubbot.ts         # GraphQL client + query
│   ├── writers/
│   │   └── csv.ts            # CSV append / stdout writer
│   ├── models/
│   │   └── SnapshotRow.ts    # Data class: DubBot response → CSV row array
│   └── utils/
│       ├── logger.ts         # pino logger setup
│       └── retry.ts          # Exponential backoff for API calls
├── .env.example              # Template for all env vars
├── package.json
├── tsconfig.json
├── README.md
└── .github/
    └── workflows/
        └── dubbot-stats.yml  # GitHub Actions workflow (scheduled + manual)
```

---

## CLI Interface

```
Usage: dubbot-stats [command] [options]

Commands:
  run           Fetch stats for all configured sites and output CSV (default)
  schema        Introspect and print the DubBot GraphQL schema
  validate      Validate config + API connectivity (no output written)
  list-sites    List all sites accessible with the configured API key

Options for `run`:
  -s, --sites <ids>   Comma-separated DubBot site IDs (overrides env var)
  -o, --out <file>    Output CSV file path (appends if exists; default: stdout)
  --no-header         Skip writing the header row (useful when appending manually)
  --dry-run           Fetch data and print to stdout regardless of --out setting
  --verbose           Print full API response payloads to stderr
  --no-color          Disable colored output (useful in CI)

Exit codes:
  0  Success — all sites fetched and CSV written
  1  Config / env validation error
  2  DubBot API error (auth failure, network error, bad response)
  3  File write error
```

---

## Scheduling & Execution Contexts

### Manual (developer workstation)

```bash
# Fetch all configured sites, append to shared CSV
npx dubbot-stats run --out ./snapshots.csv

# Fetch a single site, print to stdout
npx dubbot-stats run --sites 5f121915482faf0a6d952013 --dry-run
```

### CI/CD — GitHub Actions

```yaml
# .github/workflows/dubbot-stats.yml
on:
  schedule:
    - cron: '0 8 * * 1'   # Every Monday at 8am UTC
  workflow_dispatch:        # Also allows manual trigger from GitHub UI

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build
      - run: node dist/index.js run --out snapshots.csv
        env:
          DUBBOT_API_KEY: ${{ secrets.DUBBOT_API_KEY }}
          DUBBOT_ACCOUNT_ID: ${{ secrets.DUBBOT_ACCOUNT_ID }}
          DUBBOT_SITE_IDS: ${{ secrets.DUBBOT_SITE_IDS }}
      - uses: actions/upload-artifact@v4
        with:
          name: dubbot-snapshots-${{ github.run_id }}
          path: snapshots.csv
```

### OS Cron

```bash
# Run every weekday at 7am, append to persistent CSV
0 7 * * 1-5 node /opt/dubbot-stats/dist/index.js run \
  --out /data/accessibility/snapshots.csv \
  >> /var/log/dubbot-stats.log 2>&1
```

---

## Implementation Phases

### Phase 1 — Scaffold & Config (Day 1)
- Initialize TypeScript project with `tsup` for bundling
- Implement `config.ts` with zod env validation (including `DUBBOT_ACCOUNT_ID`)
- Wire up Commander CLI with `run`, `validate`, `schema`, and `list-sites` commands
- Confirm DubBot API key + account ID auth works against confirmed field names

### Phase 2 — DubBot Integration (Day 2)
- Build `dubbot.ts` GraphQL client with `graphql-request`
- Implement `SITE_QUERY` (site stats + assets in one HTTP request) using confirmed field names
- Map API response to `SnapshotRow` model aligned to the 7-column CSV spec
- Write unit tests with mocked API responses

### Phase 3 — CSV Writer & Multi-Site Loop (Day 3)
- Build `csv.ts` writer with append / stdout modes and header detection
- Implement multi-site loop in `orchestrator.ts`
- Add retry logic with exponential backoff for transient API failures
- Integration test: run against a real site, validate CSV output matches schema

### Phase 4 — Polish & Deployment (Day 4)
- Structured logging with `pino` (stdout for output, stderr for logs)
- Implement `--dry-run`, `validate`, and `list-sites` commands
- Set up GitHub Actions workflow with artifact upload
- Write `README.md` covering setup, env vars, and importing CSV into Excel

---

## Open Questions / Next Steps

1. **Site ID list management** — Should the CLI support a config file of site IDs
   (e.g. `sites.json`) rather than a single env var, for easier management of
   large site lists?
2. **CSV import into Excel** — Determine whether rows will be imported manually
   into the Snapshots sheet or automated via Power Automate / a separate script;
   this affects whether the CSV needs any additional formatting
3. **Historical backfill** — Confirm whether DubBot exposes historical scan data
   so past snapshots can be pre-populated, or whether tracking starts fresh from
   the first CLI run

---

*Sources: [DubBot API Help Center](https://help.dubbot.com/en/collections/3084975-dubbot-api) · [csv-stringify docs](https://csv.js.org/stringify/) · [Commander.js](https://github.com/tj/commander.js)*
