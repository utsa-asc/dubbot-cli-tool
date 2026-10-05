# Review and recommendations

Honest review of the export CLI, scripts, GitHub workflow and dashboard as of
2026-10-02. Security findings are in [security.md](security.md) (the High finding about staff names was resolved on 2026-10-02: owner data was removed from the pipeline); this file covers
correctness, reliability and maintainability.

**Scope and limits.** I read all the source, the workflow, the scripts and the
dashboard JS. I ran the model test and a local simulation of the deploy job's
assemble and test steps. I have **not** run `publish.yml` on GitHub, run the
CLI against the live API this session, run `npm audit` (no network), or tested
with a screen reader.

## Verdict

The pipeline is simple and mostly sound. Its biggest weakness is that **the
export can fail partially and still look like a success**. That matters more now
that a workflow commits and publishes the result automatically. The dashboard
is in good shape, but only one test protects it, and that test needs real data.

## What's solid

- Static, library-free dashboard: no CDN, no build step, nothing to patch.
- Sites keyed by Site ID; one reading per site per day; deterministic rules documented in the README.
- `manifest.json` written atomically; CSVs-then-manifest ordering is the right idea.
- Workflow has least-privilege top-level permissions, secrets only reach the two export steps, serialized runs, and no fork-triggered events.
- Output escaping in the dashboard is consistent (`esc()` before every `innerHTML` use).

## Priority findings

| # | Priority | Finding | Where | Fix |
|---|---|---|---|---|
| 1 | **High** | Partial export failure exits 0. Logs show 14 `Failed to fetch site stats` errors across 11 runs; those runs wrote fewer rows (59 vs 69) and still exited 0. In CI the workflow would commit and publish a partial run with a green check. | `src/orchestrator.ts:64-76` | Exit non-zero (e.g. 3) when any site failed, after still writing the successes. Optionally add `--min-success <n or %>`. |
| 2 | **High** | No sanity check before committing data. A run with 5 rows, zeros, or a changed API shape would be published. | `publish.yml` export job | Before the commit step, compare row count and total to the previous run; fail if rows drop below e.g. 90%. |
| 3 | Medium | `validate` crashes since `DUBBOT_SITE_IDS` became optional: it reads `config.DUBBOT_SITE_IDS[0]`, which is `undefined`. | `src/index.ts:39` | Take a `--site`/`--sites-file` option or fail with a clear message. |
| 4 | Medium | All sites are requested at once (`Promise.allSettled` over ~70). Risks rate limiting from DubBot, which is more likely from shared CI IPs, and it feeds #1. | `src/orchestrator.ts:46` | Limit concurrency (5 to 10), and treat HTTP 429 as retryable with backoff. |
| 5 | Medium | `sites.csv` has 70 IDs but 68 distinct. Duplicates mean duplicate API calls and duplicate rows. | `readSiteIdsFromFile` | De-duplicate IDs in the CLI and warn. |
| 6 | Medium | `withRetry` retries every error, including auth (401/403) and bad-request errors, three times. | `src/utils/retry.ts` | Retry only network errors, 429 and 5xx. |
| 7 | Medium | Same-minute re-run appends to the same file. File names have minute resolution and the writer appends, so a double manual dispatch within a minute duplicates rows. | `publish.yml`, `src/writers/csv.ts` | Add seconds to the name, or refuse to overwrite/append in CI. |
| 8 | Medium | `publish.sh` prints "not configured" but exits 0, so a scheduler thinks it published. | `scripts/publish.sh:22` | `exit 1` until a copy command is set. (Not needed if you go all-in on GitHub Pages.) |
| 9 | Medium | The page makes ~250 requests on every first load (one per CSV), growing by ~2/day (~1,000 in a year). | `dashboard/js/load.js` | In the deploy job, also write one consolidated `snapshots-all.csv` (or JSON) and load that; keep per-run files as the source of truth. |
| 10 | Medium | Tests run only inside the deploy job and depend on real data. There are no fixture-based unit tests and nothing runs on pull requests. | `dashboard/tests/` | Add a small fixture set (a few CSVs) and unit tests for dedupe, carry-forward, stale, windows and interpolation; add a PR workflow (see below). |
| 11 | Low | The "stale" warning only covers the dashboard. A failed daily run emails whoever owns the workflow and nobody else. | workflow | On failure, open or update a GitHub issue, or post to a team channel. |
| 12 | Low | `--no-header` is documented as "accepted but not yet implemented", and the `list-sites` and `schema` commands are stubs that print TODO. | `src/index.ts` | Implement or delete; stubs invite confusion. |
| 13 | Low | The cron is fixed in UTC: 13:00 UTC is 08:00 Central in summer and 07:00 in winter. | `publish.yml:9` | Fine if you don't care; otherwise run at two UTC times and skip the one that isn't 08:00 local. |
| 14 | Low | `manifest` runs through a default-command CLI, so `node dist/index.js manifest --dir x` on a stale `dist/` fails with the confusing `unknown option '--dir'`. | `src/index.ts` | Print the build date or bump the version; mention it in errors. |
| 15 | ~~Low~~ **Done 2026-10-05** | Both jobs ran `npm ci && npm run build` just to get the manifest command (which also crashed without DubBot credentials). Now `scripts/build-manifest.mjs`; the build job runs no npm.  | `publish.yml:51,125` | Make the manifest a plain Node script (like `strip-owners.mjs`); the deploy job then needs no build. |
| 16 | Low | No `timeout-minutes` on either job; a hung API call blocks the serialized queue for up to 6 hours. | `publish.yml` | `timeout-minutes: 15` (export) and `10` (deploy). |

## Workflow-specific notes

- **Partial failure behavior is good**: DLS still runs if main fails, CSVs are still committed, and the run fails loudly. But it only works if the CLI actually exits non-zero (finding #1).
- **`!cancelled()` on deploy** republishes old data after a failed export. That is a reasonable choice because the banner warns after 36 hours. Make sure someone reads the failure email, or add the alert in finding #11.
- **`git push origin HEAD:data`** is safe only because of the `concurrency` group. Keep it.
- **Add a PR/CI workflow** (`ci.yml`) on pull requests that runs: `npx tsc --noEmit`, `npm run build`, the fixture-based dashboard tests, and `actionlint` for the workflows. Today a broken change is only caught after merge.
- **Consider splitting export and commit** into two jobs, passing CSVs as an artifact, so the job that runs `npm ci` never holds a write token (see security.md S2).

## Dashboard notes

- **Data volume in the browser:** parsing ~12k rows is fast, but the request fan-out is the real cost (finding #9). On GitHub Pages every request is cached for 10 minutes; first load over a slow connection will be noticeable.
- **Daily grouping uses `Intl` with `en-CA` formatting** to get `YYYY-MM-DD`. It works in current browsers; a unit test for it would protect against locale quirks.
- **The 2026-01-20 baseline** makes interpolated lines run diagonally for six weeks and squashes early parts of the issues and PDF charts. A "start chart at first continuous data" option, or a visible marker for interpolated stretches, would be more honest.
- **Accessibility is designed in but unverified:** keyboard-operable charts, data tables, sr-only text and non-colour cues exist, yet I have not run axe, checked contrast ratios, or tested with VoiceOver/NVDA. For an accessibility team's dashboard, that is worth doing before publishing.
- **Mobile layout** was checked at 375 px (no horizontal overflow); tablet and large sizes were not.
- **Inline style** at `dashboard/js/ui.js:183` (`style="margin-top:0"`) would be blocked by a strict Content Security Policy; replace with a class (see security.md S5).

## Documentation

- The README is accurate but long and mixes the export CLI, dashboard and scheduling. Splitting into `README.md` (overview + quick start) and `docs/` (scheduling, dashboard, GitHub Pages) would help.
- `ARCHITECTURE.md`, `dubbot-cli-plan.md` and `dashboard-plan.md` overlap and will drift. `dashboard-plan.md` is a planning document; mark it historical or fold the decisions into the README.
- The root `README.md` still describes the launchd approach with `ts-node` in the example wrapper, while the real `run.sh` calls `node`. Update the example.

## Suggested order

1. **Today (small):** findings #1, #2, #16, plus the security quick wins in security.md.
2. **This week:** #3 to #7, a PR workflow, fixture tests (#10).
3. **Before wider sharing:** consolidated data file (#9), accessibility audit, failure alerting (#11).
4. **Later:** split README, remove stubs (#12), make manifest a plain script (#15).
