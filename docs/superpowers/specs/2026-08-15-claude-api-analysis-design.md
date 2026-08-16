# Feature 3: Claude API Analysis — Design

**Date:** 2026-08-15
**Status:** Approved
**Roadmap item:** #3, MVP

## Overview

This feature makes Feature 2's fetched-but-unanalyzed articles useful: given a
topic and the balanced article list already returned by `/api/articles`, fetch
each article's full text, send it to Claude for synthesis into structured
facts and opposing perspectives (each backed by verbatim quotes and source
links), verify those quotes really appear in the source text, and return the
verified result to the browser. It does not build the results display —
Feature 4 renders this feature's output; here, the result is logged to the
console behind an updated progress message, matching the stub pattern
Feature 1 and 2 left in place.

## The full-text problem

NewsAPI's free tier does not return full article bodies. Its `content` field
is truncated to roughly 200 characters plus a `"[+N chars]"` marker, and
`description` is a one-sentence summary — confirmed via live inspection of
real responses during Feature 2 (see that feature's ledger). Both are far too
thin to support the PRD's "direct quotes" traceability requirement in any
meaningful way.

Resolution: **scrape each article's URL server-side for full text**, rather
than accepting NewsAPI's snippet as the quotable source material. This is a
deliberate, explicit trade against this project's "zero npm dependencies"
stack rule (see below) — accepted because the alternative (snippet-only
quotes) was judged to undermine the product's core value (synthesizing
*complex* news information) too much to ship, even though it's the cheaper,
purer-architecture option.

## Stack change: one dependency, explicitly

`CLAUDE.md`'s Stack line changes from "zero npm dependencies" to record one
named exception: **`@extractus/article-extractor`**, used exclusively to pull
full article text out of a fetched page's HTML (title/body extraction, no
headless browser, no JS execution). This is the one piece of the pipeline
where hand-rolling with built-in modules only (regex/string HTML stripping)
was judged too unreliable to be worth the purity — different sites structure
markup too differently for a hand-rolled extractor to do this well, and
silent bad extractions are exactly the failure mode this product exists to
avoid. Every other part of the stack (server, NewsAPI proxying, Claude API
calls) remains built-in-modules-only.

This is the project's first `package.json` / `node_modules`. `start.bat` and
the README's setup instructions gain an `npm install` step.

## Runtime & data flow

```
client (already has topic, sources, balanced articles from /api/articles)
  → POST /api/analyze  { topic, articles }
server:
  1. cap `articles` to the first 25 (cost/latency control, see below)
  2. scrape full text per article in parallel (fallback to NewsAPI snippet
     per-article on failure — see Full-text extraction)
  3. call Claude (Sonnet 5) with topic + article texts → structured JSON
     (facts + perspectives), via forced tool-call output
  4. verify every returned quote against the actual article text used;
     drop citations/facts/perspectives that don't verify
  5. respond with the verified result
client: shows "Analyzing articles…" progress stage, then (until Feature 4
  exists) logs the verified result to the console and shows a summary
  count, replacing the current "Claude analysis not yet implemented" stub
  message
```

## Full-text extraction

- For each capped article, fetch its `url` and run it through
  `@extractus/article-extractor` to get the article body text.
- Runs in parallel across the batch (no artificial concurrency limit needed —
  at most 25 requests, a personal local tool). Each fetch has an **8 second
  timeout** via `AbortController`, so one slow/hanging site can't stall the
  whole search.
- **Per-article fallback, not a batch failure:** if the fetch throws, times
  out, or the extracted text is under **500 characters** (a sign of a
  paywall block, a JS-rendered page with no server-rendered body, or an
  extraction failure), fall back to that article's already-available NewsAPI
  `description` + `content` for the rest of the pipeline. The search never
  fails outright because scraping had a bad day; it degrades per-article.
- **Per-article length cap sent to Claude:** truncate whatever text is
  used (extracted or fallback) to **8,000 characters** (~2,000 words) before
  it goes into the Claude request. Covers the large majority of news articles
  in full; only unusually long-form pieces get trimmed. This bounds total
  prompt size predictably regardless of how long any one article turns out
  to be.
- **Article count cap:** analyze at most the **first 25 articles** from the
  already-balanced list returned by Feature 2 (that list is capped at 5/source
  but can still reach up to 100 across 20 sources in theory). This bounds
  scraping time and Claude token cost per search. In practice this rarely
  binds — the largest real result seen during Feature 2 testing was 44
  articles across 11 sources.
- The text actually used per article (extracted or fallback, after the
  8,000-char cap) is retained server-side through step 4, since citation
  verification checks quotes against exactly that text, not the original
  full extraction or the original NewsAPI snippet.

## Claude request & output

- **Model:** Claude Sonnet 5 — recommended balance of multi-document
  synthesis quality against cost for a paid API called on every search; Opus
  was judged unnecessary unless real usage shows Sonnet's output too shallow,
  and Haiku was judged too weak specifically at the careful verbatim-quote
  extraction this feature depends on.
- **Structured output:** a forced tool-call (Messages API tool-use with a
  fixed `input_schema`, not "ask for JSON in prose") so the response is
  reliably schema-valid, not just usually well-formed prose JSON.
- **Schema:**
  ```json
  {
    "facts": [
      {
        "statement": "string — the fact, in Claude's own words",
        "citations": [
          { "quote": "string — verbatim substring of the source article", "sourceName": "string", "url": "string" }
        ]
      }
    ],
    "perspectives": [
      {
        "label": "string — short, neutral description of the position",
        "summary": "string — Claude's synthesis of this perspective",
        "citations": [
          { "quote": "string", "sourceName": "string", "url": "string" }
        ]
      }
    ]
  }
  ```
  Every fact and every perspective carries one or more citations; a
  fact/perspective is never accepted with zero citations attached.
- **Prompt instructions include:**
  - Quotes must be copied verbatim from the given article text — never
    paraphrased, extended, or combined across sentences.
  - `url` must be copied exactly from the source article list provided, never
    invented or altered.
  - Detect however many distinct perspectives genuinely exist in the given
    sources (variable count, per the PRD's stated recommendation), rather
    than forcing a fixed number.
  - Perspective `label`s must describe the substantive position neutrally
    (e.g. "concern about economic impact") — never a political party or
    ideological label (Republican/Democrat/Conservative/Liberal/etc.), per
    the PRD's explicit out-of-scope rule.

## Citation verification (the hallucination backstop)

Traceability is the product's only defense against hallucination per the
PRD, so this is enforced in code, not left to prompt instructions alone.
For every citation Claude returns:

1. **URL check:** `url` must exactly match one of the article URLs actually
   sent to Claude in this request. Anything else is dropped — Claude cannot
   cite a source it wasn't given.
2. **Quote check:** `quote` must be an exact substring of that article's text
   as used in the request (post-extraction/fallback, post-truncation).
   Comparison normalizes whitespace runs and straight-vs-curly quote/dash
   characters (formatting differences Claude may introduce when copying),
   but never normalizes content — a quote that isn't a real substring after
   that normalization is dropped.

A citation that fails either check is removed from its fact/perspective. A
fact or perspective left with zero citations after filtering is dropped
entirely (never shown without at least one verified citation). Dropped
items are logged server-side for visibility during development; there is no
user-facing secondary review screen in MVP, matching the PRD's stated
approach.

If verification empties the result completely (zero facts and zero
perspectives survive), the endpoint still returns `200` with empty
arrays — this is a distinct, honest outcome ("Claude couldn't produce
verifiable results for this topic"), not an error, and not silently blank.

## Response shape

**Success (`200`):**

```json
{
  "topic": "...",
  "facts": [ { "statement": "...", "citations": [ { "quote": "...", "sourceName": "...", "url": "..." } ] } ],
  "perspectives": [ { "label": "...", "summary": "...", "citations": [ { "quote": "...", "sourceName": "...", "url": "..." } ] } ],
  "articlesAnalyzed": 25,
  "articlesUsingFallbackText": 4
}
```

`articlesAnalyzed` and `articlesUsingFallbackText` are diagnostic counts, not
required for Feature 4 but cheap to include now and useful for spot-checking
during personal use (the PRD's own test method calls for exactly this kind of
verification).

**Errors:** distinct messages by category, mapped the same way
`mapNewsApiError` already handles NewsAPI errors:

| Category | Cause | Message shown |
|---|---|---|
| Config/key problem | `claudeApiKey` missing/invalid in `config.local.json` | "Claude API key is missing or invalid. Check the server's config file and restart." |
| Quota/rate limit | Anthropic API rate-limit or quota error | "Claude API rate limit reached. Try again in a moment." |
| Malformed response | Tool-call response fails schema validation | "Something went wrong analyzing the articles. Check the server logs." (logged with detail server-side) |
| Connection/unexpected | Network failure reaching the Anthropic API | "Couldn't reach the Claude API. Check your internet connection and try again." |

Scraping failures are never surfaced as endpoint-level errors — they degrade
per-article via the snippet fallback, as described above.

## Config

`config.local.json` / `config.example.json` gain a `claudeApiKey` field,
validated at server startup the same way `newsApiKey` already is: missing or
non-string means the server logs a clear message and exits before listening,
rather than failing confusingly on the first request.

```json
{
  "newsApiKey": "YOUR_NEWS_API_KEY_HERE",
  "claudeApiKey": "YOUR_CLAUDE_API_KEY_HERE"
}
```

## Pipeline changes (`src/pipeline.js`, `src/app.js`)

- `runPipeline` gains a second real stage after the existing articles fetch:
  `"Analyzing articles…"`, calling `POST /api/analyze` with `{topic,
  articles}` from the first stage's result.
- If the first stage returns zero articles, the second stage is skipped
  entirely — Feature 2's existing zero-results message still applies, and
  `/api/analyze` is never called on an empty list.
- On success, resolves with `{ topic, sources, articles, analysis }`, adding
  `analysis` (the verified `{facts, perspectives, articlesAnalyzed,
  articlesUsingFallbackText}` shape) to Feature 2's existing result shape.
- The completion message (still console-log-and-summary, pending Feature 4):
  shows counts — e.g. "Analyzed N articles → found F facts and P
  perspectives. See console for full data." If both `facts` and
  `perspectives` come back empty, shows the distinct "Claude couldn't
  produce verifiable results for this topic" message instead.
- On failure, the existing `.catch()` branch in `app.js` displays whichever
  category message applies (table above) and re-enables the form, same
  pattern as Feature 2's error handling.

## Testing

Pure-logic pieces are unit tested with Node's built-in `node:test`, no new
test dependency, consistent with Features 1–2:

- Citation verification (URL matching, quote substring matching with
  whitespace/quote-character normalization, rejection of non-substrings)
- Article capping (25-article limit, 8,000-char per-article truncation)
- Fallback-threshold logic (500-char extraction floor)
- Claude tool-call response schema validation
- Error-code-to-message mapping (new Claude-specific table above)

Network-dependent pieces (`@extractus/article-extractor` calls, the Claude
API call itself) are exercised with the network boundary mocked, keeping the
suite fast and offline — same approach Feature 2 used for NewsAPI calls. The
end-to-end scrape → Claude → verify path is verified manually against real
sources and a real Claude key once implementation is functional, the same
way Feature 2's real-key verification happened post-implementation.

## Out of scope for this spec

- Results display (Feature 4) — this feature's output is consumed by the
  console/progress-message stub only
- Retrying failed article scrapes or Claude calls
- Caching analysis results across searches
- A secondary human-review/approval screen before showing results (explicitly
  out of scope per the PRD; traceability is the sole safety mechanism for MVP)
- Cross-platform (`npm install`, `start.bat`) tooling beyond documenting the
  new one-time `npm install` step for this project's existing Windows-only
  `start.bat` workflow
