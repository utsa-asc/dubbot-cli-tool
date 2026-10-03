# Security review

Reviewed 2026-10-02: the export CLI (`src/`), scripts, the GitHub workflow
(`.github/workflows/publish.yml`), the dashboard (`dashboard/`), and local file
hygiene. Findings are ranked; each has a concrete fix.

**Not covered / unverified:** I could not check whether the GitHub repo is
public or private (the API was blocked), run `npm audit` (no network), or test
the workflow on GitHub. Where a finding depends on repo visibility, it says so.

## Summary

| ID | Severity | Finding |
|---|---|---|
| S1 | ~~High~~ **Resolved 2026-10-02** | Staff names were stored on the `data` branch. Names are now removed from the whole pipeline (see below) |
| S2 | ~~Medium~~ **Implemented 2026-10-02** (verify on first run; protect `main` still open) | A write-scoped token was available to `npm ci` and the build in the export job |
| S3 | **Medium** (partly fixed 2026-10-02) | A live DubBot API key sat in a world-readable plist. Fixed on this Mac and in the README example; the other computer, a dedicated key and rotation are still open |
| S4 | ~~Medium~~ **Resolved 2026-10-02** | `href` values from the directory CSV were not scheme-checked. Now https on `dubbot.com` only, enforced in three places |
| S5 | **Medium** | No Content Security Policy on the dashboard |
| S6 | ~~Medium~~ **Resolved 2026-10-02** | Owner stripping was a block-list. Replaced by an allow-list gate (`scripts/check-directory.mjs`) |
| S7 | ~~Medium~~ **Implemented 2026-10-02** | Third-party Actions pinned to tags, not commit SHAs; no Dependabot |
| S8 | ~~Low~~ **Fixed on this Mac 2026-10-02** | `.env` and the plist were mode 644. Now 600 here; the other computer is still open (see S3) |
| S9 | Low | CSV formula injection if exports are opened in Excel |
| S10 | Low | Public exposure of per-site accessibility data is a decision, not a bug |
| S11 | Low | Local server could expose `.env` if started from the repo root |
| S12 | Info | No log redaction configured |
| S13 | ~~Low~~ **Fixed in files 2026-10-02** (remains in pushed git history) | DubBot account ID appeared in tracked docs, reference JSON, a test and the directory links |

## Findings

### S1. Staff names stored on the `data` branch (was High) - RESOLVED
**What was wrong:** the full `sites-directory.csv`, with Site Owner 1/2 names,
was committed to the `data` branch. In a public repo that exposes names
regardless of the stripped Pages copy.

**What changed (2026-10-02):**
- **Not pulled:** the CLI query never requested people (site URL, score, issue/page/PDF counts only). Confirmed in `src/clients/dubbot.ts`.
- **Not generated:** the owner scope, owner dropdown, owner search and owner display were removed from the dashboard. Retired `#scope=owner` links fall back to "All sites".
- **Not stored:**
  - `sites-directory.csv` now has only `Site ID, Display URL, List, Dubbot URL`, both in `dashboard/data/` and on the local `data` branch.
  - The local `data` branch was recreated without names and the old commit purged (`git reflog expire` + `git prune`). `git log --all -S<name>` finds nothing and there are no dangling objects.
  - Nothing was ever pushed, and main/feature history never contained names (checked).
  - The dashboard loader reads only those four columns and ignores any other.
  - Workbooks (`xls/`, `*.xlsx`, `*.xls`) are gitignored so they can't be committed by accident.
- **Enforced:** `scripts/check-directory.mjs` fails the deploy if the file has any other column or any `@`. Tested against a file with an owner column and one with an email; both fail with exit 1. It can also run as a pre-commit hook on the `data` branch (README, "Personal data").

**Still true, outside this repo:** the names still exist in your Excel workbook (`xls/`, `Book3.xlsx`, `recovered.xlsx`) and in `dashboard/data/` backups or Time Machine copies from before today. Keep those out of the repo. If the old directory file was ever copied elsewhere (shared drive, chat), delete those copies.

### S2. Write token reachable by build-time code (was Medium) - IMPLEMENTED
**What was wrong:** the export job held `contents: write`, both checkouts left
the token on disk, and `npm ci`, the `tsup` build and the runtime dependencies
then ran in the same job. Any dependency could have read the token and pushed
to the repo. The deploy job had the same shape with `pages: write` and
`id-token: write`.

**What changed (`.github/workflows/publish.yml`, 2026-10-02):**
- **Layer 1:** `persist-credentials: false` on every checkout except the one in the `commit` job.
- **Layer 2:** the export job is split.
  - `export`: `contents: read` plus the DubBot secrets. It runs npm and the export, then uploads the CSVs as an artifact.
  - `commit`: `contents: write`, with no Node or npm. It validates each artifact file (exact name pattern, exact CSV header, at least one data row, no overwriting) and pushes to `data`. Only your own shell and pinned actions run there.
- **Layer 3:** the deploy job is split.
  - `build`: `contents: read`. It runs npm, assembles and tests the site, and uploads the Pages artifact.
  - `deploy`: `pages: write` and `id-token: write`, with no checkout and no code. It only runs `deploy-pages`.
- **Layer 5:**
  - `npm ci --ignore-scripts` in both jobs that run npm.
  - All 10 `uses:` pinned to full commit SHAs (resolved from the live tags with `git ls-remote`), with the release in a comment.
  - `.github/dependabot.yml` for Actions and npm.
- **Also:** workflow-level `permissions: {}` so each job has to request what it needs, and `timeout-minutes` on every job.

**Verified locally:**
- The YAML parses.
- All 10 actions are SHA-pinned.
- Only the `commit` job holds a write token, and it runs no npm.
- The `deploy` job has no checkout or `run` steps.
- The commit-job validation accepts good files and rejects a wrong file name, a wrong header, an empty file and an overwrite.

**Not verified (needs the first real run):**
- That `npm run build` succeeds with `--ignore-scripts`. `esbuild` should get its binary from the optional platform package, but I can't run Linux CI here. If the build fails, drop the flag from the **build** step only; do not give that job a write token.
- That `upload-artifact@v4`/`download-artifact@v4` hand-off works as written (artifact name `export-csvs`).

**Still open (layer 4, your repo settings):** protect `main` (require a pull request, block direct pushes). Then even a stolen write token can't change code on `main`. Leave `data` unprotected so the workflow can push to it.

**Residual risk:** code in the `export` job still sees the DubBot secrets at run time; that can't be avoided when calling the API. Keep the dependency set small and review Dependabot PRs.

### S3. Live API key in a world-readable plist (Medium)
`edu.utsa.asc.dubbot-cli.plist` (gitignored, so not in git) contains a 71-character
`dubbot_…` key under `EnvironmentVariables`, with mode `-rw-r--r--`. Any local
user or process can read it. `.env` is also mode 644. The README's launchd
example recommends putting the key in the plist.

**Fix:**
- `chmod 600 .env edu.utsa.asc.dubbot-cli.plist`.
- Remove the key from the plist and let the CLI read `.env` (it already does, via `dotenv`), or use the macOS keychain.
- Update the README example to stop recommending keys in the plist.
- Rotate the key if this machine is shared, or the plist was ever copied/synced (cloud backup, screen share, chat).
- Give the key the minimum DubBot permissions (read-only) if DubBot allows it.

**Status (2026-10-02):**
- Done on this Mac: `.env` and the plist are now mode 600; the key was removed from the plist; `run.sh` now does `cd "$DUBBOT_DIR"` so `dotenv` finds `.env` under launchd. Verified with a launchd-like environment (`env -i`): from `/` the key is not found (the old behaviour), after the `cd` it loads.
- Done: the README launchd section and `edu.utsa.asc.dubbot-cli.plist.example` no longer put the key in the plist (credentials stay in a `chmod 600` `.env`, the wrapper `cd`s into the project, logs go in the project instead of `/tmp`).
- Still open: the other computer that runs the daily job (same steps), a dedicated read-only key, and rotation (see the decision rules above).

### S4. Unchecked `href` from CSV data (was Medium) - RESOLVED
**What was wrong:** `Dubbot URL` from `sites-directory.csv` went straight into
`href`. `esc()` blocks attribute breakout but not a `javascript:` URL, so anyone
who can write to the `data` branch could run script in every viewer's browser.

**What changed (2026-10-02), three layers:**
1. **Model (`dashboard/js/model.js`, `safeDubbotUrl`):** a link is used only if it parses as `https:`, has no embedded credentials, and the host is `dubbot.com` or a subdomain. Otherwise the site gets the default `https://utsa.dubbot.com/sites/<id>` link (ID URL-encoded, since site IDs also come from data). The normalized `URL.href` is used, not the raw string.
2. **Render (`dashboard/js/ui.js`, `safeHref`):** both `<a href>` outputs re-check `https://` and fall back to `#`.
3. **Build gate (`scripts/check-directory.mjs`):** the deploy fails if any `Dubbot URL` fails the same check, so a bad link is caught before it publishes.

**Tests:** `dashboard/tests/model.test.js` checks 3 allowed and 16 rejected values: `javascript:` (including mixed case and an embedded newline), `data:`, `vbscript:`, `http:`, protocol-relative `//`, other hosts, `utsa.dubbot.com.evil.com`, `evildubbot.com`, `user:pw@` credentials, `utsa.dubbot.com@evil.com`, garbage, empty and null. I also ran a hostile directory through the real page code in the browser: the `javascript:` link was replaced by the fallback and no `javascript:` href was rendered.

**Not covered by this fix:** a CSP (S5) would still be the backstop for any other injection.

### S5. No Content Security Policy (Medium)
There is no CSP, so any future XSS has full reach. The page has no third-party
resources and nearly no inline code, so a strict policy is cheap. GitHub Pages
can't set response headers, so use a `<meta>` tag.

**Fix:** in `dashboard/index.html`:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'">
```
First replace the inline `style="margin-top:0"` at `ui.js:183` with a CSS class. SVG presentation attributes and CSSOM style changes in `charts.js` are allowed. Test in the browser console for violations.

### S6. Owner stripping was a block-list (was Medium) - RESOLVED
Replaced with an allow-list: `scripts/check-directory.mjs` accepts only
`Site ID, Display URL, List, Dubbot URL`, fails on anything else, and fails on
any `@`. The deploy copy is written with only the allowed columns.

### S7. Actions pinned to tags, no update automation (was Medium) - IMPLEMENTED
All 10 `uses:` in `publish.yml` are pinned to full commit SHAs with the release in
a trailing comment, and `.github/dependabot.yml` opens weekly PRs for
`github-actions` and `npm`. SHAs came from the live release tags
(`git ls-remote`) within the major version each action already used, so behavior
shouldn't change. Newer majors exist; take them through Dependabot PRs. Still
worth adding: `npm audit --omit=dev --audit-level=high` in a PR workflow.

### S8. File permissions (Low)
`.env` and the plist are `644`. See S3. Also tighten `logs/` and `exports/` if
they ever contain anything sensitive (current `logs/` showed no key-like strings).

### S9. CSV formula injection (Low)
Exports contain `Site URL` from the API. If a value began with `=`, `+`, `-` or
`@` and someone opened the CSV in Excel, it could run as a formula. The values
are URLs you control, so risk is low.

**Fix (optional):** in the CSV writer, prefix such cells with `'`, or add a validation that rejects values not starting with `http`.

### S10. Public exposure of accessibility data (Low, decision)
The published page lists every property's score, issue count, PDF count, and
trend. Some properties look internal (`datarqst.ir.utsa.edu`, `rowdylink`).
This is not a technical flaw, but it is a disclosure: it shows which sites are
least accessible, and your institution may have compliance or communications
views on that.

**Action:** get a yes from the right owner (compliance / communications) before the first public deploy. The `noindex` meta tag keeps search engines out but does not make the page private.

### S11. Local server exposure (Low)
`python3 -m http.server` serves the directory it starts in. Started from the
repo root it would serve `.env`, the plist and `exports/`. The documented
command uses `--directory dashboard`, which is safe.

**Fix:** keep that flag, add a one-line warning to the README, and bind to localhost (`--bind 127.0.0.1`).

### S12. Logging (Info)
The pino logger has no redaction. Current code does not log the API key, and the
existing log file contains none, but errors serialize whole objects. Add
`redact: ['err.config.headers', 'err.request.headers', '*.apiKey']` as insurance.

### S13. DubBot account ID in tracked files (Low) - FIXED IN FILES
The account ID is an identifier, not a credential (the API key is the secret),
but it was in `dubbot-schema-guide.md`, `reference/*.json`, a test I wrote, and
every `Dubbot URL` in the directory (`.../a/<account id>/sites/<id>/`).

**Done:** replaced with placeholders (`YOUR_ACCOUNT_ID`, `your_account_id_here`, a dummy
ID in the test); directory links now use `https://utsa.dubbot.com/sites/<id>`
(the same form as the dashboard's built-in fallback); the local `data` branch was
amended and its old commit purged. `git grep` finds no occurrence in tracked or
committable files or on the `data` branch.

**Not done:** `origin/main` already has the ID in history since the initial
commit. Scrubbing that means rewriting pushed history (`git filter-repo` plus a
force-push), which breaks everyone's clones. Because the ID alone grants
nothing, I'd leave it. It stays in your gitignored `.env` and local plist, where
the CLI needs it.

## Checked and found OK

- **Personal data:** none pulled, generated or stored in the repo pipeline (S1).
- **XSS in the dashboard:** every `innerHTML` use passes dynamic text through `esc()`, picker items use `textContent`, URL-hash state is validated (scope list, window, rank, site IDs). The one gap is the `href` scheme (S4).
- **Secrets in git:** `.env`, the plist and `sites.csv` are gitignored and were never committed (`git log -- .env` is empty). No secrets are in the workflow file.
- **Workflow triggers:** only `schedule`, `push` to `main`, and `workflow_dispatch`. No `pull_request_target`, so fork PRs can't reach secrets.
- **Secret handling in steps:** secrets are passed through `env:` and written with `printf`, never interpolated into the script text (no shell injection through secret values).
- **Permissions:** workflow default is `contents: read`; only the export job gets `contents: write`; only the deploy job gets `pages`/`id-token`.
- **Pages environment:** `github-pages` limits deployment to the default branch.
- **Dependencies:** lockfile present and `npm ci` used. Versions are current majors. Not audited (see above).
- **Network:** the page loads no third-party code or fonts; the CLI talks only to `DUBBOT_API_URL`.

## Do now (about 30 minutes)

1. ~~Decide S1 before pushing the `data` branch.~~ Done: no names remain, so the branch is safe to push either way. (Still check repo visibility for S10.)
2. `chmod 600 .env edu.utsa.asc.dubbot-cli.plist`; move the key out of the plist (S3).
3. ~~`persist-credentials: false` and token-at-push-only (S2).~~ Done; also protect `main` in repo settings.
4. ~~Validate `https:` on `dubbotUrl`~~ (S4, done) and add the CSP (S5).
5. ~~Switch `strip-owners.mjs` to an allow-list (S6).~~ Done.
6. ~~Pin Actions to SHAs and add Dependabot (S7).~~ Done.
