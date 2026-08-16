# Roadmap

Approved at scaffolding. One feature = one spec, one plan, one branch.

Updated at feature closeout, **once the work is on `main`** — see the
closing procedure in `CLAUDE.md`. Work that exists only on a branch is a
proposal, not project state, so it is marked *In review* rather than *Done*.

**Status vocabulary:** `Next` → `In progress` → `In review` → `Done`.
Exactly one feature should be `Next` at any time.

| # | Feature | Milestone | Status | Spec | Plan | Ledger |
|---|---|---|---|---|---|---|
| 1 | Search & source selection interface | MVP | Done | [Spec](superpowers/specs/2026-08-15-search-source-selection-design.md) | [Plan](superpowers/plans/2026-08-15-search-source-selection.md) | [Ledger](superpowers/ledgers/2026-08-15-search-source-selection.md) |
| 2 | News API integration | MVP | Done | [Spec](superpowers/specs/2026-08-15-news-api-integration-design.md) | [Plan](superpowers/plans/2026-08-15-news-api-integration.md) | [Ledger](superpowers/ledgers/2026-08-15-news-api-integration.md) |
| 3 | Claude API analysis | MVP | Done | [Spec](superpowers/specs/2026-08-15-claude-api-analysis-design.md) | [Plan](superpowers/plans/2026-08-15-claude-api-analysis.md) | [Ledger](superpowers/ledgers/2026-08-15-claude-api-analysis.md) |
| 4 | Results display with traceability | MVP | Next | — | — | — |

## Session Notes

## 2026-08-16

**Shipped:** Feature 3 — Claude API analysis. Given the articles Feature 2
already fetches, the app now scrapes each one's full text, sends it to Claude
Sonnet 5 to extract structured facts and neutral opposing perspectives with
verbatim citations, and independently verifies every citation against the
real article text server-side before it can reach the client — replacing the
"Claude analysis not yet implemented" stub with a real second pipeline stage.

**Session Summary:** The design session surfaced a real gap partway through:
NewsAPI's free tier only returns a short snippet, not full article text,
which the PM judged too thin for a tool meant to synthesize *complex* news
information. Resolution was full-text scraping — this project's first npm
dependency (`@extractus/article-extractor`), a deliberate, documented
exception to the "zero dependencies" stack rule, added specifically because
hand-rolling reliable HTML extraction across arbitrary news sites was judged
not worth the purity. Citation verification (server-side substring matching
of every quote against the actual text sent to Claude) is the resulting core
anti-hallucination mechanism — enforced in code, not prompt-trust.

Built via `subagent-driven-development` (10 tasks, two-stage review each).
Real issues were caught and fixed along the way, not rubber-stamped: a test
file that silently lost the literal characters it was supposed to test, a
scope-creep fix on the citation-matching logic that had to be trimmed back
down, a missing debug log on a real error path, and — from a final holistic
review across the whole branch after all 10 tasks — two more gaps a
per-task review couldn't have caught (no timeout on the Claude API call;
`thinking` left unconfigured on a model that shares its token budget between
thinking and output). Full task-by-task record in the ledger.

**Known gap, carried forward:** real-key end-to-end verification could not be
run in this environment — no NewsAPI or Anthropic keys were available. Every
error path and the success/zero-results branching were verified live, but a
genuine analyzed result from a real search, with real citations spot-checked
against real source text, hasn't happened yet. Do that before relying on this
for actual use.

**Still open:** results display (Feature 4, up next) will consume this
feature's structured `{facts, perspectives}` output — currently it's only
console-logged behind a progress-message summary count.

## 2026-08-15 (2)

**Shipped:** Feature 2 — News API integration. A plain Node.js server
(zero npm dependencies) now serves the app and proxies real NewsAPI
searches, replacing Feature 1's fully-stubbed pipeline. Each search makes
two NewsAPI calls (relevancy, then newest-first) and balances the combined
results so no single source can dominate — capped at 3 articles/source from
the first call, topped up to 5/source from the second, deduplicated by URL.

**Session Summary:** The plan itself (10 tasks, subagent-driven-development,
same pattern as Feature 1) shipped cleanly — two real crash-risk bugs were
caught and fixed in review (unhandled malformed input in the static-file
path resolver; an unguarded request-parsing crash and silently-swallowed
filesystem errors in the server), both with reviewers reproducing the actual
crash live before and after the fix to confirm. The bigger story happened
*after* the first PR opened, once a real NewsAPI key made genuine
verification possible: the original 20-source list (inherited from initial
scaffolding, never actually chosen by the PM) turned out to have 3 dead
entries — CNBC, Reuters, and The Guardian have been removed from NewsAPI's
catalog entirely. That prompted starting source selection over from
scratch: pre-checked defaults were removed (another choice that had been
made unilaterally during Feature 1 and never actually confirmed), and the
PM hand-picked a fresh 20 sources directly from NewsAPI's live catalog,
screened for factual reliability and political balance against third-party
media-bias trackers. Separately, live testing of real searches found a
single relevancy-sorted query let one source dominate (13 of 20 results
from one outlet in one test) — extensive live comparison testing (documented
in `docs/decisions.md`, the project's first architecture decision record)
led to the two-call balancing strategy described above. Cost: search volume
drops from ~100/day to ~50/day against NewsAPI's free-tier request cap,
judged worth it for the diversity gain.

One process note worth naming: the first PR (`#1`) got merged early via
GitHub's UI — before the source curation and balancing work were pushed —
so a second PR (`#2`) was needed to land the rest. Nothing was lost (the
work was safely on the pushed branch throughout), but it's worth double
-checking a PR's actual merged diff matches what's expected before
considering a feature done, rather than assuming a "merged" state means
"everything intended is there."

**Still open:** Claude API integration (Feature 3, up next) and results
display (Feature 4) haven't started. NewsAPI's free tier only returns a
truncated `content` snippet per article, not full text — a real constraint
on Feature 3's "direct quotes" traceability requirement, to address in that
feature's design session. README documents the search/balancing strategy
but not the local setup workflow (`config.local.json`, `start.bat`) yet.

## 2026-08-15

**Shipped:** Feature 1 — Search & source selection interface. A single-page
vanilla HTML/CSS/JS screen: topic input, checkbox list of all 31 NewsAPI
sources (Select All/Deselect All buttons, BBC News/AP News/Reuters checked by
default), live-validated Submit button, staged progress feedback on submit.

**Session Summary:** First design session also settled the project's stack
(vanilla HTML/CSS/JS, confirmed in `CLAUDE.md`) and completed the one-time
settings checklist (NewsAPI.org and api.anthropic.com pre-approved for
WebFetch; package-manager pre-approval deferred to Feature 2, since that's
when the local-server runtime for keeping API keys off the client gets
decided; device testing declined, desktop-only for MVP). Built via
`subagent-driven-development` in an isolated worktree (`.worktrees/`, now
gitignored): 6 tasks, each with a fresh implementer subagent and a two-stage
review (spec compliance, then code quality). One real defect was caught and
fixed in review — Task 5's submit handler wasn't trimming the topic before
handing it to the pipeline, contradicting the spec's data-handoff shape.
Tests: 11/11 passing (Node's built-in `node:test`, zero dependencies, zero
build step). Merged to `main` via fast-forward; branch and worktree deleted.

Since Features 2–4 don't exist yet, the submit pipeline in this feature is an
explicit, documented stub (`src/pipeline.js`) that simulates staged progress
and logs the collected `{topic, sources}` payload to the console instead of
calling real APIs — there is no live News API or Claude API integration yet.
See the ledger for the full task-by-task review record, including two minor
non-blocking follow-up notes from the final review (no ARIA live region on
validation errors; the pipeline's error-recovery path is unverified since the
stub never rejects).
