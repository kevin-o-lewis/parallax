# Feature 2: News API Integration — Design

**Date:** 2026-08-15
**Status:** Approved
**Roadmap item:** #2, MVP

## Overview

This feature makes Feature 1's stubbed submit pipeline real for its first stage:
given a topic and selected sources, fetch matching recent articles from
NewsAPI.org and hand them to the next step. It does not do any article
analysis (Feature 3) or results display (Feature 4) — those remain
unbuilt. This spec covers the server that proxies NewsAPI calls, the query it
constructs, the data it returns, its error handling, and the resulting changes
to Feature 1's existing files.

## Runtime & workflow change

NewsAPI's key cannot live in any file the browser loads or that reaches git —
this repo has a real GitHub remote, and a committed key sits in history
permanently even after a later "removal" commit. A key exposed in the browser
also has no natural stopping point once Feature 3 adds a *paid* Claude key to
the same pattern; Anthropic's own SDK disables browser use by default for
exactly this reason. So a small server-side layer is required.

**Stack addition:** plain Node.js (built-in `http`, `fs`, `url` modules only —
no npm, no `package.json`, no new project dependency). This keeps the
project's "zero build step, zero dependency" stance intact; it's more code
written by hand, but nothing to install or update.

**What changes for running the app:** Feature 1 could be opened by
double-clicking `index.html`. From this feature onward, that no longer works,
because the browser needs to talk to a server for article data. The new
workflow:

1. One-time: copy `config.example.json` to `config.local.json` and paste in a
   real NewsAPI key. `config.local.json` is gitignored; `config.example.json`
   (with a placeholder value) is committed so the shape is documented.
2. Every run: double-click `start.bat`. It opens the default browser to
   `http://localhost:3000` and starts the server in the same console window,
   so server logs (including the fail-fast config error, if any) stay visible.
   Closing the console window or pressing `Ctrl+C` in it stops the server; a
   final `pause` keeps the window open after the server exits (whether from
   `Ctrl+C` or a startup failure) so any last message can actually be read
   before the window closes.

`start.bat` (Windows-only, matching this project's development environment):

```bat
@echo off
start http://localhost:3000
node server.js
pause
```

Running `node server.js` directly still works exactly as before — `start.bat`
is a thin convenience wrapper around it, not a replacement mechanism. Note the
browser opens slightly before the server is guaranteed to be listening; on a
local machine this race is essentially never noticeable, but if the page ever
loads before the server responds, a manual refresh resolves it. This is a
deliberate, disclosed trade-off in favor of staying simple, not a bug to
engineer around.

**Startup validation:** if `config.local.json` is missing, unreadable, or has
no `newsApiKey` value, the server prints `Missing config.local.json — copy
config.example.json and add your NewsAPI key.` to the terminal and exits
immediately — it does not start listening and does not fail confusingly on
the first request instead.

## Server responsibilities

One process (`server.js`), two jobs:

1. **Static file server** for `index.html` and everything under `src/` —
   replaces the double-click-to-open workflow with `http://localhost:3000`.
2. **API proxy**: `GET /api/articles?topic=<topic>&sources=<comma-separated ids>`.
   The server reads the NewsAPI key from `config.local.json`, builds the
   NewsAPI request, calls it, and returns a normalized response to the
   browser. The browser never sees the key.

## Source list change (carried over from design discussion)

`src/sources.js`'s `NEWS_SOURCES` shrinks from 31 entries to these 20:

ABC News, Al Jazeera, AP News, BBC News, Bloomberg, Business Insider, CNBC,
CNN, Fortune, Fox News, National Geographic, NBC News, Newsweek, Politico,
Reuters, The Guardian, Wall Street Journal, Washington Post, Time, USA Today.

This matches NewsAPI's hard limit of 20 sources per `/v2/everything` request
exactly, so it is now structurally impossible to select more sources than the
API allows — no new "too many selected" validation is needed anywhere.
`DEFAULT_SELECTED_SOURCE_IDS` (`bbc-news`, `associated-press`, `reuters`) is
unaffected; all three survive the cut. `index.html`'s "(31 available)" label
becomes "(20 available)". `tests/sources.test.js`'s count assertion updates
from 31 to 20.

**Source ID re-verification:** the 20 remaining NewsAPI source ids in
`src/sources.js` were written from memory during Feature 1 and never
confirmed against a live NewsAPI response. This feature's implementation must
verify each remaining id against a real call to NewsAPI's
`/v2/top-headlines/sources` endpoint (or equivalent) before relying on them,
and correct any that don't match — a wrong id silently returns zero articles
for that source with no error, which would be very hard to notice later.

## Query construction

For a request with topic `t` and selected source ids `s`, the server calls:

```
GET https://newsapi.org/v2/everything
  ?q={t}
  &sources={s joined by comma}
  &from={7 days before today, ISO 8601 date}
  &to={today, ISO 8601 date}
  &sortBy=relevancy
  &pageSize=20
  &apiKey={server's key}
```

- **Date window:** fixed 7 days, computed fresh on every request server-side.
  Not user-configurable in this feature — a deliberate simplicity choice, not
  a NewsAPI technical ceiling (the free tier allows up to 1 month).
- **`sortBy=relevancy`**: articles are being gathered for a later synthesis
  step (Feature 3), not for chronological reading, so topical relevance is
  prioritized over pure recency.
- **`pageSize=20`**: caps the sample size fed forward; keeps a future
  Feature 3 prompt from growing unbounded regardless of how many sources or
  how much volume a topic has.

## Response shape

**Success (`200`):** JSON array of normalized article objects:

```json
{ "title": "...", "description": "...", "content": "...", "url": "...", "publishedAt": "...", "sourceName": "...", "author": "..." }
```

Field values are copied directly from NewsAPI's response (`title`,
`description`, `content`, `url`, `publishedAt`, `source.name`, `author`).

**Known limitation, not solved here:** NewsAPI's free tier truncates
`content` to a short snippet (not the full article body). This directly
affects Feature 3's traceability requirement (direct quotes) — flagged here
for that feature's design session, not addressed in this one.

**Zero results (`200`, empty array):** not an error. Distinct message:
"No articles found for this topic in the selected sources over the last 7
days. Try different sources or a broader topic."

**Errors:** distinct messages by category, mapped from NewsAPI's documented
error codes:

| Category | NewsAPI codes | Message shown |
|---|---|---|
| Config/key problem | `apiKeyMissing`, `apiKeyInvalid`, `apiKeyDisabled` | "NewsAPI key is missing or invalid. Check the server's config file and restart." |
| Quota exhausted | `apiKeyExhausted`, `rateLimited` | "Daily NewsAPI request limit reached. Try again tomorrow." |
| Bad request (an app bug, not a user error) | `parameterInvalid`, `parametersMissing`, `sourcesTooMany`, `sourceDoesNotExist` | "Something's wrong with the request Parallax sent to NewsAPI. Check the server logs." |
| Connection/unexpected | `unexpectedError`, network/timeout failures reaching NewsAPI | "Couldn't reach NewsAPI. Check your internet connection and try again." |

## Pipeline changes (`src/pipeline.js`, `src/app.js`)

Feature 1's `runPipeline` simulated two fake stages: "Fetching articles from
selected sources…" then "Analyzing with Claude…". This feature:

- Replaces stage 1 with a real `fetch('/api/articles?...')` call to the local
  server.
- **Removes stage 2 entirely.** Faking "Analyzing with Claude…" next to a now-real
  fetch would actively mislead the user into thinking analysis is happening
  when it isn't — worse than Feature 1's fully-stubbed version, where both
  stages were honestly fake. Feature 3 reintroduces a real second stage when
  it exists.
- On success, resolves with `{ topic, sources, articles }` (adds `articles` to
  the existing `{topic, sources}` shape from Feature 1).
- The completion message shown depends on `articles.length`: if it's `0`,
  show the distinct zero-results message from the Response shape section
  above ("No articles found for this topic in the selected sources over the
  last 7 days. Try different sources or a broader topic."); otherwise show
  "Fetched N articles. See console for data (Claude analysis not yet
  implemented)." Both cases resolve successfully — zero results is not routed
  through the error path.
- On failure, `app.js`'s existing `.catch()` branch displays whichever
  category message applies (table above) instead of the current generic
  "Something went wrong" text, and still re-enables the form as it does today.

## Documentation

`README.md` gets a short note explaining the 7-day fixed search window: that
it's a deliberate default rather than a NewsAPI technical limit, and stating
the underlying free-tier constraints that motivated it (articles searchable
only up to 1 month old; a 24-hour publish delay). This is the same file
already carrying the project's Status line.

## Testing

Query construction (building the NewsAPI URL from topic/sources/dates) and
error-code-to-message mapping are pure functions — tested the same way as
Feature 1, with Node's built-in `node:test`, no new dependencies. The actual
HTTP proxying and static file serving are thin glue around those functions,
verified manually against the real NewsAPI (same pattern Feature 1 used for
its DOM-wiring layer).

## Out of scope for this spec

- Claude API calls / article analysis (Feature 3)
- Results display (Feature 4)
- Full article text retrieval (NewsAPI free tier doesn't provide it; noted
  above as a known limitation for Feature 3 to address)
- User-configurable date range (explicitly declined; fixed 7 days)
- Cross-platform launcher scripts (macOS/Linux) — `start.bat` is Windows-only,
  matching this project's development environment; `node server.js` remains
  the manual fallback on any platform
- Caching, request retries, or offline handling beyond the error messages above
