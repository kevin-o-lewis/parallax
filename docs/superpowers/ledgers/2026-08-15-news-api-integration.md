# Progress Ledger: News API Integration

**Plan:** `docs/superpowers/plans/2026-08-15-news-api-integration.md`
**Spec:** `docs/superpowers/specs/2026-08-15-news-api-integration-design.md`
**Execution method:** `superpowers:subagent-driven-development` (fresh implementer subagent per task, two-stage review: spec compliance then code quality)
**Branch:** `feature/2-news-api-integration` (pushed for PR review, not yet merged)

Note: like Feature 1's ledger, this is written retrospectively at push time
from the session's actual review record, since subagent-driven-development
tracks task progress via the session's task list rather than a written
ledger file during execution.

## Task 1 — Shrink source list to 20

- **Implementer:** DONE. Trimmed `NEWS_SOURCES` 31→20 (removing the 11 lowest-priority tech/niche outlets, per product decision during design), updated `tests/sources.test.js`'s count assertion, updated `index.html`'s label.
- **Spec review:** ✅ Compliant on first pass.
- **Code quality review:** ✅ Approved on first pass. No issues.
- **Commit:** `1252bb9`

## Task 2 — NewsAPI query/response/error logic (TDD)

- **Implementer:** DONE. `src/newsapi.js` (`buildArticlesUrl`, `normalizeArticles`, `mapNewsApiError`) and `tests/newsapi.test.js` (9 tests), TDD followed. Deliberately Node-only — no browser dual-export guard.
- **Spec review:** ✅ Compliant on first pass.
- **Code quality review:** ✅ Approved on first pass. No issues (a JSDoc suggestion, non-blocking).
- **Commit:** `0c13c98`

## Task 3 — Static file path resolution (TDD)

- **Implementer:** DONE. `src/static-files.js` (`resolveFilePath`, `resolveContentType`) and `tests/static-files.test.js` (5 tests), TDD followed.
- **Spec review:** ✅ Compliant on first pass.
- **Code quality review:** ❌ **Two Important issues found on first pass** — `decodeURIComponent` could throw uncaught on malformed percent-encoding, and embedded null bytes passed the traversal check but would crash `fs.readFile` downstream. Both were real crash-the-server risks once Task 5 existed, since `server.js` calls this synchronously with no top-level safety net.
  - **Fix:** wrapped `decodeURIComponent` in try/catch (return `null` on failure), rejected decoded paths containing `\0`, added 3 regression tests (malformed encoding, null bytes, and a sibling-directory string-prefix bypass guard).
  - **Re-review:** ✅ Approved. Reviewer empirically fuzzed 10+ additional malformed-encoding and null-byte variants beyond the new tests and confirmed none crashed; reconstructed the previously-flagged broken traversal-check variant and confirmed the new regression test would catch it.
- **Commit:** `81a3381` (amended from `fae6ddb`)

## Task 4 — Config file handling

- **Implementer:** DONE. `config.example.json` (committed template) + `.gitignore` entry for `config.local.json` (never committed).
- **Spec review:** ✅ Compliant on first pass.
- **Code quality review:** ✅ Approved on first pass. No issues.
- **Commit:** `673b703`

## Task 5 — The server (server.js)

- **Implementer:** DONE. `server.js` — static file serving + `/api/articles` NewsAPI proxy, fail-fast config validation at startup. Verified live: fail-fast with no config, static serving with 20 sources, and a real NewsAPI round-trip via a placeholder key returning a genuine 401.
- **Spec review:** ✅ Compliant — reviewer independently reproduced all three verification scenarios themselves rather than trusting the report.
- **Code quality review:** ❌ **Two Important issues found on first pass** — an unguarded `new URL(req.url, ...)` in the request handler could crash the entire server process on the right malformed input (reviewer proved this empirically by reproducing a live crash against the pre-fix code); and `fs.readFile` errors in static serving were silently swallowed for all error codes, with no logging for genuine filesystem/permission problems.
  - **Fix:** wrapped URL parsing in try/catch (log + 400 on failure); added conditional logging for non-`ENOENT` filesystem errors.
  - **Re-review:** ✅ Approved. Reviewer reproduced the original crash live against the old code to confirm the finding was real, then confirmed the fix resolves it and the server stays alive under the same input.
- **Commit:** `ab8d60d` (amended from `0570858`)

## Task 6 — Windows launcher (start.bat)

- **Implementer:** DONE. 4-line `start.bat` (open browser, start server, pause on exit). Verified live: browser opens, server logs stay visible, pause prompt appears after Ctrl+C.
- **Spec review:** ⚠️ One finding — LF line endings instead of the Windows-conventional CRLF for a `.bat` file. Reviewer's own functional test still passed either way (not an actual bug), but fixed anyway since it was a free, trivial change.
  - **Fix:** normalized to CRLF.
- **Code quality review:** ✅ Approved. No issues.
- **Commit:** `dc692ea` (amended from `726b99e`)

## Task 7 — Real pipeline (TDD)

- **Implementer:** DONE. Rewrote `src/pipeline.js` — one real `fetch()` stage, the old fake "Analyzing with Claude…" stage removed entirely (not kept as a lie next to real data). Rewrote `tests/pipeline.test.js` (4 tests) using Node's built-in `t.mock.method` to mock `fetch` — no new dependency.
- **Spec review:** ✅ Compliant — reviewer confirmed no trace of the old stub (no `setTimeout`, no `delayMs`, no second stage) and ran the full 30-test suite to confirm no regressions.
- **Code quality review:** ✅ Approved. No issues (a `.then()`-chain-vs-`async/await` style note, explicitly plan-specified so not a defect; a note about empty-source-array edge case already guarded upstream by Feature 1's form validation).
- **Commit:** `4579bf2`

## Task 8 — Update app.js submit handler messages

- **Implementer:** DONE. Updated the `.then()`/`.catch()` block to show a fetched-article count, a distinct zero-results message, or the specific server-mapped error message (`err.message`) instead of Feature 1's generic placeholder text. Verified live against a real NewsAPI round-trip (placeholder key → real 401 → correct message shown, form re-enabled).
- **Spec review:** ✅ Compliant — reviewer independently reproduced the browser verification.
- **Code quality review:** ✅ Approved. No issues.
- **Commit:** `614eb89`

## Task 9 — README note on 7-day search window

- **Implementer:** DONE. Added the "## Search window" section verbatim, correctly placed.
- **Spec review:** ✅ Compliant on first pass.
- **Code quality review:** ✅ Approved. Reviewer cross-checked the documented claims against the actual `src/newsapi.js` implementation.
- **Commit:** `cfeb73c`

## Task 10 — Full verification pass

- **Implementer:** DONE_WITH_CONCERNS (expected/designed outcome). Ran the full suite (30/30 passing — 3 more than the plan's original estimate of 27, due to Task 3's approved security-hardening tests). Verified the full flow live via `start.bat` + browser, including a genuine NewsAPI round-trip. **Could not perform source ID re-verification against a live NewsAPI response — no real API key was available in this environment.** Reported honestly rather than skipped silently, per the plan's explicit instructions for this scenario.
- **Spec review:** ✅ Compliant — reviewer independently re-ran the test suite and the live browser verification themselves, including reproducing the real NewsAPI round-trip.
- **Code quality review:** Found two real process gaps (not code defects): the implementation plan document had — again, as in Feature 1 — been written but never committed to git before the worktree was created, so it was absent from the branch; and a stray, unintentional uncommitted edit to `README.md` was discovered sitting in the *main* working directory (unrelated to any task's actual work in the worktree — origin unclear, cleaned up directly since it matched no legitimate change). Both fixed directly by the controller: plan committed to `main` and merged into the branch; stray edit discarded from `main`.
- **Commit:** `72830c6`, plus `f2a8d30` (merge bringing in the plan doc)

## Final whole-implementation review

- **Reviewer:** `superpowers:code-reviewer`, full diff `47788c7..f2a8d30` (all 10 tasks + the plan-doc merge), spec walked section by section, full test suite re-run, live manual verification against the running server.
- **Result:** **Ready to merge**, contingent on one fix.
- **Important issue found and fixed:** the source-ID-verification gap (Task 10, Step 3) had no durable, visible home outside the plan document — a future reader with a real key could hit silent empty-results bugs with no clue why. **Fixed:** added a code comment directly above `NEWS_SOURCES` in `src/sources.js` flagging the gap. Commit `67bc553`.
- **Minor / follow-up notes (not blocking, not filed as defects):**
  1. `server.js`'s missing-`topic`/`sources` branch reuses the "sent to NewsAPI" message/500-status pairing at a 400 status where no NewsAPI request is ever made — cosmetic, and the path is unreachable through the actual UI (form validation always sends both params).
  2. Raw, non-HTTP `fetch()` failures in `pipeline.js` (e.g. the local server dying mid-session) aren't caught, so the browser's native error text surfaces instead of a designed message — out of the spec's scope (which only covers NewsAPI-side errors), low-likelihood locally.
  3. README doesn't yet document the new `config.local.json` setup workflow — faithfully out of scope per the plan's narrow Task 9 (only the search-window note was in scope); a fresh clone currently has no in-README path from "clone" to "app that fetches articles."

## Outcome

All 10 plan tasks implemented, reviewed twice each (spec + quality), three real defects found and fixed across two tasks (Task 3: crash risks in path resolution; Task 5: crash risk + silent error swallowing in the server), one cosmetic fix (Task 6: line endings), one process gap resolved directly by the controller during Task 10 (missing plan-doc commit, repeating a Feature 1 mistake — worth naming plainly), and one documentation-visibility fix applied after the final holistic review. Test suite: 30/30 passing. Branch pushed for PR review; not yet merged to `main`.

**Not done / explicitly out of scope:**
- **Source ID verification against a live NewsAPI response** — no real API key was available during implementation. The 20 ids in `src/sources.js` are unverified; a wrong id fails silently (returns zero articles for that source, no error). This must be done before the feature is trusted with a real key. Now flagged both here and via a code comment in `src/sources.js`.
- Claude API integration / article analysis (Feature 3) and results display (Feature 4) — not started, as designed.
- Full article text retrieval — NewsAPI's free tier only provides a truncated `content` snippet, not full article bodies. This is a real constraint on Feature 3's "direct quotes" requirement, flagged in the design spec for that future feature's design session, not addressed here.
- README documentation of the local setup workflow (config file, `start.bat`) — out of scope per this feature's narrow documentation task; worth a follow-up.
