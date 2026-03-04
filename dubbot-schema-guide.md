# DubBot API — Confirmed Schema & Field Mapping

Derived from `example-dashboard-query.json` and `example-dashboard-result.json`.
This replaces all illustrative field names in the implementation plan with
confirmed, working equivalents.

---

## Key Differences from the Plan

| Topic | Plan Assumed | Reality |
|---|---|---|
| Query signature | `site(id: $siteId)` with `ID!` | `site(siteId: $siteId, accountId: $accountId)` with `String!` — **accountId is required** |
| Score field | `accessibilityScore` (top-level) | `latestStatsSnapshot.accessibility.score` (nested) |
| PDF Count | `pdfDocumentsFound` (top-level) | Separate `assets(...)` query → `totalEntries` |
| Issues Count | `totalIssues` (top-level) | `accessibilityCount` (top-level) **or** `latestStatsSnapshot.accessibility.total` |
| Pages With Issues | `pagesWithIssues` (top-level) | `latestStatsSnapshot.accessibility.affectedPagesCount` |
| Severity breakdown | `issuesBySeverity { critical serious moderate minor }` | **Not present in this query** — see Gap section below |

---

## Confirmed Field Mapping → CSV Columns

| CSV Col | Header | Field Path | Example Value |
|---|---|---|---|
| A | `Collected At` | CLI system clock | `2026-03-02T14:00:00Z` |
| B | `Site URL` | `site.url` | `https://business.utsa.edu/` |
| C | `DubBot Site ID` | `site.id` | `5eea4b24482faf49264a90d7` |
| D | `Score (%)` | `site.latestStatsSnapshot.accessibility.score` | `99.96` |
| E | `PDF Count` | `assets.totalEntries` (separate query) | `62` |
| F | `Issues Count` | `site.accessibilityCount` | `9` |
| G | `Pages With Issues` | `site.latestStatsSnapshot.accessibility.affectedPagesCount` | `8` |
| H | `Critical Issues` | **TBD — not in this query** | — |
| I | `Serious Issues` | **TBD — not in this query** | — |
| J | `Moderate Issues` | **TBD — not in this query** | — |
| K | `Minor Issues` | **TBD — not in this query** | — |

> **Score note:** There are two score values available:
> - `latestStatsSnapshot.score` = `97.89` — overall score across *all* DubBot checks (accessibility, links, spelling, SEO, etc.)
> - `latestStatsSnapshot.accessibility.score` = `99.96` — accessibility-specific score only
>
> The plan calls col D "overall accessibility score" — **confirm which you want.**

---

## Confirmed Working Query

Both requests below must be made per site. They share the same `siteId` and `accountId`.

### Request 1 — Site Stats

```graphql
query SiteQuery($siteId: String!, $accountId: String!) {
  site(siteId: $siteId, accountId: $accountId) {
    id
    url
    accessibilityCount
    latestStatsSnapshot {
      score
      accessibility {
        score
        total
        affectedPagesCount
      }
    }
    latestCrawl {
      createdAt
    }
  }
}
```

### Request 2 — PDF Count

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
    totalEntries
  }
}
```

Both can be combined into a single GraphQL request (one HTTP round-trip) since
the DubBot API accepts multiple root-level fields per query.

---

## Config Changes Required

The `.env` and zod schema need one additional variable:

```env
# was:
DUBBOT_API_KEY=...
DUBBOT_SITE_IDS=...

# now also required:
DUBBOT_ACCOUNT_ID=5eea4a66482faf4144ada496
```

---

## Gap — Severity Breakdown (Cols H–K)

The issue severity breakdown (`critical`, `serious`, `moderate`, `minor`) is
**not returned** by the `latestStatsSnapshot` or `site` fields in the example
query. The current API only exposes the total count per category, not severity.

### Options

| Option | Description | Trade-off |
|---|---|---|
| **A — Omit cols H–K for now** | Ship without severity; add later if API exposes it | Simplest; CSV won't match full planned schema |
| **B — Query `issues` endpoint** | Fetch the full issues list and count by severity client-side | More API calls; need to confirm `issues` query exists and returns severity |
| **C — Leave cols H–K as `0` / empty** | Placeholder values to preserve column positions | Preserves schema shape; values misleading until resolved |

**Recommended:** Start with **Option A** (omit H–K), verify whether a severity
field exists on the `issues` or `accessibilityIssues` query, and add it in a
follow-up once confirmed.

---

## Updated .env Template

```env
# DubBot API credentials
DUBBOT_API_KEY=your_dubbot_api_key
DUBBOT_ACCOUNT_ID=your_dubbot_account_id

# Comma-separated site IDs to collect per run
DUBBOT_SITE_IDS=5eea4b24482faf49264a90d7,655523be21e3820001682032

# Output CSV path (omit to print to stdout)
OUTPUT_FILE=./snapshots.csv
```
