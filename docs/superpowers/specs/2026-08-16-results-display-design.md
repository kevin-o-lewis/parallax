# Feature 4: Results Display with Traceability — Design

**Date:** 2026-08-16
**Status:** Approved
**Roadmap item:** #4, MVP

## Overview

This feature makes Feature 3's analysis output visible. Today, a successful
search shows only a summary count in the progress area ("Analyzed 25
articles → found 6 facts and 3 perspectives. See console for full data.")
and logs the real `{facts, perspectives}` payload to the console. This
feature renders that payload as an actual results page: facts and
perspectives as cards, each backed by its verbatim quotes and source links,
so the user can review and spot-check the output per the PRD's stated MVP
safety mechanism (traceability is the sole defense against hallucination;
there is no secondary approval screen).

No backend changes. `/api/analyze`'s response shape and citation-verification
guarantees are unchanged from Feature 3 — this feature is purely a rendering
layer on top of the pipeline's existing result.

## View structure & data flow

`index.html` gains two top-level containers inside `<main>`:

- `#search-view` — wraps the existing form (topic input, source checkboxes,
  Select All/Deselect All, Submit, progress area), unchanged.
- `#results-view` — new, starts with the `hidden` attribute. Contains a
  "← Back to search" button and an empty `#results-content` div that
  `src/results.js`'s output gets injected into.

No new HTML page, no client-side routing, no URL change — `src/app.js`
toggles which container is visible via the `hidden` attribute. This keeps
Feature 1–3's single-page-app pattern and avoids passing result data across
a navigation.

**Submit flow**, in `app.js`'s existing submit handler:

1. Hide `#results-view` (in case a previous result is showing), show
   `#search-view`, clear the progress text, disable the form, run
   `runPipeline` — all unchanged from today.
2. On resolve:
   - **Zero articles**, or **zero facts and zero perspectives** (Claude
     produced nothing verifiable) — stay on `#search-view`, show the
     existing distinct message in the progress area. No view switch: the
     results view is reserved for when there's actually content to show.
   - **Otherwise** — call `renderResultsHTML(topic, analysis)`, set
     `resultsContent.innerHTML` to it, hide `#search-view`, show
     `#results-view`, and move focus to the results heading (screen-reader
     users need a cue that the view changed under them).
3. **In every case** (success with content, empty-result, and the existing
   `.catch()` error path) the form re-enables once the request settles.
   Today, only the `.catch()` branch calls `setFormDisabled(false)` — a
   successful search leaves the form disabled indefinitely, a stub-era gap
   this feature fixes as part of wiring the new flow.

**Back to search:** hides `#results-view`, shows `#search-view` (topic input
and source checkboxes still hold whatever was last submitted — nothing is
cleared), re-enables the form, and moves focus to the topic input.

No caching of past results and no result history — consistent with the
PRD's explicit "no caching, search history" out-of-scope line. Only the most
recent result is ever in the DOM; a new submit replaces it.

## Rendering module (`src/results.js`)

One pure function: `renderResultsHTML(topic, analysis)` → an HTML string,
where `analysis` is Feature 3's existing `{facts, perspectives,
articlesAnalyzed, articlesUsingFallbackText}` shape. `app.js` is the only
caller, and only does `resultsContent.innerHTML = renderResultsHTML(...)` —
no other file builds result markup.

Structure (matches the approved mockup):

```
<h2>Results for "<topic>"</h2>

<section> <h3>Facts</h3>
  [one .result-card per fact, or a "No verifiable facts found for this
   topic." note if facts.length === 0]
</section>

<section> <h3>Perspectives</h3>
  [one .result-card per perspective, or the equivalent note if
   perspectives.length === 0]
</section>

<p class="diagnostics">N articles analyzed (M used snippet fallback
instead of full text)</p>   <!-- fallback clause omitted when M is 0 -->
```

Both section-empty notes are reachable: the results view is only entered
when *not* both arrays are empty (per the submit flow above), so exactly one
of the two sections being empty is a real, expected state — e.g. facts
found but no opposing perspectives detected.

**Fact card:** statement, then a row of source name(s) as links, then a
"show quotes" toggle button, then a hidden block with one blockquoted
verbatim quote per citation.

**Perspective card:** same shape, with the perspective's `summary` line
between the statement-equivalent (`label`) and the sources row.

**Citation toggle:** each card gets one real `<button aria-expanded="false"
class="quote-toggle">show quotes</button>` immediately followed by a
`<div class="quotes" hidden>` holding the blockquotes. `app.js` wires a
single delegated click listener on `#results-content` (set up once at
`DOMContentLoaded`, since the content itself is replaced wholesale on every
search) that: finds the clicked `.quote-toggle`, toggles `hidden` on its
next sibling `.quotes` div, flips `aria-expanded`, and swaps the button
label between "show quotes" / "hide quotes".

**Escaping (required, not optional):** fact statements, quotes, source
names, and perspective labels/summaries all originate from Claude's
synthesis of scraped third-party article text — content this app does not
control. `results.js` HTML-escapes every one of these fields before string
interpolation; this is the only place in the app that turns external text
into HTML, and therefore the only place that needs this. Citation `url`
values (already verified server-side in Feature 3 to match an article URL
actually sent to Claude) are escaped for the `href` attribute and rendered
with `target="_blank" rel="noopener noreferrer"`.

## Styling (`src/styles.css`)

New rules, following the existing file's plain/utilitarian style (no new
build step, no CSS framework):

- `.result-card` — bordered box per fact/perspective, consistent with the
  existing `.source-list` border/radius treatment
- `.quote-toggle` — inline text-button styling (underline, no border/bg),
  distinct from the filled `#submit-btn` style
- `.quotes blockquote` — left border, italic, muted color (per the approved
  mockup)
- `.diagnostics` — small, muted footer text
- `.section-empty-note` — muted, italic, for the "no verifiable X found" case
- `#back-to-search-btn` — reuses the existing `.source-actions button` look

## Testing

Consistent with this project's existing split (pure logic gets `node:test`
unit coverage; DOM-wiring code is verified manually in-browser — `app.js`
itself has never had a unit test file, across Features 1–3):

- `tests/results.test.js` — pure string-in/string-out tests for
  `renderResultsHTML`:
  - Facts and perspectives render with correct statement/summary, source
    names, links, and quote text
  - Empty `facts` (non-empty `perspectives`) renders the facts-empty note,
    and vice versa
  - Diagnostics footer text is correct for `articlesUsingFallbackText === 0`
    (fallback clause omitted) and `> 0` (clause present with correct count)
  - HTML-escaping: a quote, statement, or topic containing `<`, `&`, or `"`
    renders as escaped entities in the output string, never as a raw tag or
    unescaped attribute break
- The new view-switching (`#search-view` / `#results-view` toggle), focus
  management, and click-delegation wiring in `app.js` is exercised manually
  against a real search once implemented — the same "verify live once
  functional" approach Feature 3 used for its scrape → Claude → verify path.

No new dependencies. This feature stays inside the zero-npm-dependency rule
for application code; the one existing exception
(`@extractus/article-extractor`, Feature 3) is unrelated.

## Out of scope for this spec

- Any backend/`/api/analyze` changes — Feature 3's response shape and
  citation verification are consumed as-is
- Search history, caching, or saved topics (explicitly out of scope per the
  PRD)
- A secondary human-review/approval screen or hallucination-flagging UI
  (explicitly out of scope per the PRD and Feature 3's spec; traceability —
  quotes + links — is the sole safety mechanism for MVP)
- Sorting, filtering, or re-ordering facts/perspectives within a result
- Printing/exporting the results view
- Mobile-specific layout work (desktop/web only for MVP, per the PRD)
