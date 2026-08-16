# Claude API Analysis — Progress Ledger

**Plan:** `docs/superpowers/plans/2026-08-15-claude-api-analysis.md`
**Spec:** `docs/superpowers/specs/2026-08-15-claude-api-analysis-design.md`
**Branch:** `feature/3-claude-api-analysis`
**Method:** `subagent-driven-development` — fresh implementer subagent per task, two-stage review (spec compliance, then code quality) after each.

## Summary

All 10 plan tasks implemented and reviewed. Two tasks needed real fix-and-re-review
rounds (Task 4, twice; Task 6, once) — not rubber-stamped. A final holistic review
across the whole branch (after all 10 tasks) found two more real gaps, fixed
directly by the controller. Test suite: 70/70 passing (35 pre-existing + 33 new
from Tasks 2–4 and 7 + 2 more from the holistic-review fixes).

## Task-by-task

**Task 1 — Article-extraction dependency:** `package.json`
(`@extractus/article-extractor` — the project's first npm dependency),
`.gitignore`, `CLAUDE.md` stack-line update. Spec review ✅, code quality ✅ clean.
Commit `0446237`.

**Task 2 — Article text preparation (TDD):** `src/articleText.js` /
`tests/articleText.test.js` (12 tests). Pure functions for capping/truncating
articles and resolving extracted-vs-fallback text; `extractArticleText` never
throws (any failure degrades to fallback). Spec review ✅, code quality ✅ (minor
doc suggestions only, non-blocking). Commit `c81d172`.

**Task 3 — Claude request/response/error logic (TDD):** `src/claude.js` /
`tests/claude.test.js` (11 tests, later 13 after the holistic-review fix). Forced
tool-call request building, strict schema validation on the response, error
mapping. Spec review ✅ (independently verified full 58-test suite, no
regressions). Code quality ✅ clean — reviewer specifically verified the API key
is never logged and JSON-injection safety of the interpolated article text.
Commit `dac64fc`.

**Task 4 — Citation verification (TDD):** `src/citations.js` /
`tests/citations.test.js` (9 tests) — the product's core anti-hallucination
mechanism. **Two real issues found and fixed:**
1. The required test file lost its literal curly-quote characters (silently
   replaced with straight ASCII quotes during writing), which meant two of the
   nine tests no longer exercised the curly-quote normalization they were named
   for. Confirmed via direct codepoint inspection, not just re-running tests.
   Fixed and re-verified.
2. The fix for #1 introduced scope creep: extra, unrequested Unicode character
   ranges added to `normalizeForMatch` (plus one with an actual mapping defect)
   — a real concern on the product's core safety mechanism, since it silently
   widened what counts as a "matching quote." Fixed by trimming back to exactly
   the six specified characters.

   Both rounds were independently re-verified by the controller (codepoint
   checks, full test suite reruns, diff inspection) rather than trusted from the
   subagent's own report. A subsequent code-quality pass flagged one more
   Important issue — missing module documentation on this safety-critical
   file — fixed (module doc comment + `Object.create(null)` defensive fix in
   `buildArticleTextByUrl`). Final commit `91b618a`.

**Task 5 — `claudeApiKey` config:** `config.example.json`, `server.js`
(`loadConfig` + fail-fast message only). Spec review ✅ (exact wording match,
confirmed no stray edits elsewhere in `server.js`). Code quality ✅ clean.
Commit `7d07851`.

**Task 6 — `/api/analyze` endpoint:** `server.js` — wires article
capping/scraping, the Claude call, and citation verification into one route.
Spec review ✅, extensively independently verified live (curl against a running
server with placeholder keys; GET-fallthrough, missing-topic, non-array-articles,
malformed-JSON edge cases all tested beyond the plan's own script). Code
quality found **one Important issue**: the schema-validation-failure (500) path
never actually logged anything, despite its own error message claiming "check
the server logs" — a real debuggability gap on exactly the failure mode most
worth a diagnostic trail. Fixed (added the missing `console.error`), re-verified
(diff limited to the one line, 67/67 tests). Final commit `f511cc0`.

**Task 7 — Real pipeline (TDD):** `src/pipeline.js` / `tests/pipeline.test.js`
(5 tests, replacing the old single-stage 4). Adds the second real stage,
skipped entirely when zero articles are found. Spec review ✅ (line-for-line
match to the plan), code quality ✅ clean, no issues. Commit `7fe9273`.

**Task 8 — `app.js` completion messages:** Small three-branch update to the
submit handler. The implementer's own manual-test claim was weaker than
reported — their placeholder NewsAPI key meant their browser check never
actually reached the new code, only the pre-existing NewsAPI-error path. The
controller caught this and independently verified all three new branches (plus
the pre-existing `.catch()` path) directly in the browser by mocking
`window.fetch` with `javascript_tool` to simulate zero-verified-results,
successful-analysis, and Claude-error scenarios — genuine proof, not a
self-report. Code quality ✅ clean. Commit `4ec75e1`.

**Task 9 — `start.bat` / `README.md`:** `npm install` step added to the
launcher; new Setup section in the README. Spec review ✅ byte-perfect match,
code quality ✅ clean (minor, non-blocking notes on unconditional `npm install`
and no batch-script error handling — acceptable for a personal local tool).
Commit `cf56006`.

**Task 10 — Full verification pass:** Automated suite confirmed at 70/70
(after the holistic-review fixes below). Manual end-to-end walked through the
real UI with placeholder keys — the real `/api/articles` → NewsAPI 401 path was
exercised live (unchanged from Feature 2, confirming Feature 3's changes didn't
break it). Roadmap status updated `Next` → `In progress` (commit `ad60ad2`).
**Real-key verification (Step 3) could not be performed — see "Not done" below.**

## Final holistic review (after all 10 tasks)

A last full-branch review (not task-by-task) traced the citation-verification
chain end to end, checked cost/failure containment across all the pipeline's
caps, and verified the `@extractus/article-extractor` integration against the
library's actual shipped type signature. Found the codebase in good shape
overall — no duplicated logic worth consolidating, consistent naming, no file
needing a split — but surfaced two real, Important gaps that per-task review
structurally couldn't have caught with confidence, since both are specifically
about real third-party API behavior under real load rather than something a
mocked-response test could expose:

1. **No timeout on the Claude API call.** Every other stage of the pipeline
   (8s scrape timeout, 25-article cap, 8,000-char truncation) has an explicit
   time bound; the one network call most likely to actually stall in practice
   — the paid third-party API call — had none. A hang would leave the
   browser's "Analyzing articles…" stage stuck indefinitely with no recovery
   path but a reload.
2. **`max_tokens: 8192` with no `thinking` configuration.** Verified directly
   against the authoritative Claude API reference (not from memory, given the
   reviewer's claim touched exact model behavior): Claude Sonnet 5 runs
   adaptive thinking by default when `thinking` is omitted, and thinking
   shares the `max_tokens` budget with the response. On the largest article
   batches this feature is designed to handle, that could plausibly truncate
   the tool-call JSON mid-response, surfacing as a spurious 500 on exactly the
   case that matters most.

**Fixed directly by the controller** (small, well-understood, no need for a
fresh subagent round): added a 60s `AbortSignal` timeout to the Claude API
`fetch` call, and set `thinking: { type: 'disabled' }` explicitly in
`buildAnalysisRequest` — this is a deterministic extraction task (find and cite
facts already present in given text), not open-ended reasoning, so disabling
thinking removes the token-budget ambiguity entirely rather than just papering
over it with a larger `max_tokens`. Added two new tests
(`disables thinking...`, `sends a request with a timeout signal`) — full suite
confirmed at 70/70 after the fix. Commit `755dfec`.

Three minor findings from this review were **not** applied, to avoid scope
creep beyond the plan: no request-body size cap on `readRequestBody` (fine for
an explicitly local-only, single-user tool per `CLAUDE.md`'s own constraints),
no `"scripts": {"test": ...}` entry in `package.json`, and the observation that
`docs/roadmap.md` correctly shows `In progress` pre-closeout (not a defect).

## Not done / explicitly out of scope

- **Real-key end-to-end verification (the plan's own Task 10, Step 3) could
  not be performed in this environment.** No real NewsAPI or Anthropic API
  keys were available. All error paths and the full success/zero-results
  branching were verified live against a running server (with placeholder
  keys) or via mocked `fetch` responses in a real browser — but a genuine
  analyzed result from real articles and a real Claude call, including
  spot-checking real citations against real source text, has not happened.
  This is a real, disclosed gap, not a silent skip — per the plan's explicit
  instruction, this is reported rather than glossed over.
- Results display (Feature 4) — out of scope for this feature by design; the
  verified analysis result is currently only console-logged behind a
  progress-message summary.
- Retrying failed article scrapes or Claude calls, caching analysis results,
  and a secondary human-review/approval screen — all explicitly out of scope
  per the design spec.

## Outcome

Ready for PR review, contingent on a reviewer (or the PM, once a real key is
available) confirming the real-key path actually produces sane, verifiable
output before this is relied on for real use. Nothing here is silently
incomplete — every open item above is named.
