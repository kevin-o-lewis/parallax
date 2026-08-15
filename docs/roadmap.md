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
| 2 | News API integration | MVP | Next | — | — | — |
| 3 | Claude API analysis | MVP | — | — | — | — |
| 4 | Results display with traceability | MVP | — | — | — | — |

## Session Notes

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
