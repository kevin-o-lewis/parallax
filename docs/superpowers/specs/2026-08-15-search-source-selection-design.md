# Feature 1: Search & Source Selection Interface — Design

**Date:** 2026-08-15
**Status:** Approved
**Roadmap item:** #1, MVP

## Overview

This is the entry point to Parallax. The user enters a news topic, selects which
trusted news sources to search, and submits the form to trigger the fetch-and-analyze
pipeline (Features 2–4, built separately). This spec covers only the UI, its
validation, and its client-side interaction — not the backend fetch/analysis logic.

## Stack

Vanilla HTML + CSS + JavaScript. No framework, no build step, no external
dependencies. Single `index.html` file (or `index.html` + a small `.js`/`.css`
file if it grows unwieldy) so the app can run by opening it in a browser or via
a minimal local server, with nothing to compile before a demo/recording.

This is the first feature built, so this choice sets the stack for the project.
`CLAUDE.md`'s Stack line should be updated to "Vanilla HTML/CSS/JavaScript" once
this spec is approved.

## Layout

Single-column, top-to-bottom flow:

1. App title ("Parallax")
2. Topic input
3. Source selection (label + Select All/Deselect All buttons + scrollable checkbox list)
4. Submit button
5. (After submit) staged progress indicator

Rejected alternatives:
- **Two-column** (topic left, sources right): wastes space on narrow windows, no
  benefit for this small a form.
- **Stepped/multi-step wizard**: adds an extra click and makes it harder to
  glance back at the topic while picking sources. Unnecessary ceremony for a
  two-field form.

## Components

### Topic input
- Label: "What topic do you want to research?"
- Single-line text input, placeholder: "e.g., AI regulation, Ukraine conflict, climate change"
- No autocomplete, no suggestions, no live validation against NewsAPI — plain text field
- Required

### Source selection
- Label: "Select news sources (31 available)"
- Two buttons above the list: **Select All** and **Deselect All**. These are
  plain buttons (not checkboxes) — clicking one checks or unchecks every
  checkbox in the list below it. They do not represent their own state.
- Scrollable checkbox list (`max-height: 300px`, `overflow-y: auto`) containing
  all 31 NewsAPI sources, one checkbox per source, labeled with the source's
  display name (ABC News, AP News, BBC News, Bloomberg, CNN, Fox News, Reuters,
  The Guardian, Washington Post, Wall Street Journal, etc. — full list of 31 in
  `docs/prd-parallax.md` Appendix).
- Default state: a small set of sources pre-checked (BBC News, AP News, Reuters)
  so the form is usable with zero interaction if the user just wants a fast
  default; all others start unchecked. The user can freely check/uncheck any
  source regardless of default state.
- At least one source must be checked to submit.

### Submit button
- Label: "Submit"
- Disabled (grayed out, not clickable) until the form is valid: topic non-empty
  AND at least one source checked. Re-evaluated live as the user types/checks.

## Validation & errors

Validation runs on submit attempt (not required to block-disable if that proves
awkward to implement — the priority is that invalid submits never reach the
network layer):

- **Empty topic:** inline red error text below the input: "Please enter a topic."
  Red border on the input.
- **No sources selected:** red error text below the checkbox list: "Please
  select at least one source."
- Errors clear as soon as the corresponding condition is fixed.

## Submission & loading state

On a valid submit:
1. Topic input and all checkboxes become read-only/disabled (prevents editing
   or double-submit mid-flight).
2. Submit button becomes disabled.
3. A staged progress indicator appears below the button and updates as the
   pipeline advances:
   - "Fetching articles from selected sources…"
   - "Analyzing with Claude…"
4. On success: the interface hands off to the results display (Feature 4).
   This spec doesn't define that screen's design — only that Feature 1's job
   ends once results are ready to render.
5. On error (e.g., NewsAPI or Claude API failure): show an inline error
   message in place of the progress indicator, re-enable the form (topic,
   checkboxes, submit) so the user can retry.

The exact mechanism for driving these stage transitions (e.g., how the backend
signals "fetching" vs "analyzing") is an implementation-plan concern, not a
design concern — this spec only fixes the two labels the user should see and
that they must appear in that order.

## Data handed off

On submit, the interface collects:
- `topic`: string, the trimmed value of the topic input
- `sources`: array of selected source IDs (NewsAPI source identifiers)

This object is the sole input to Feature 2 (News API integration). This spec
does not define how it's transmitted (e.g., direct function call vs. fetch to a
local backend) — that's decided when Feature 2 is designed, since it depends on
how NewsAPI calls are made from a browser-only app (likely a small local
server to keep the API key off the client).

## Out of scope for this spec

- The results display screen (Feature 4)
- How NewsAPI/Claude calls are actually made or where API keys live (Feature 2/3)
- Source logos, descriptions, or metadata beyond name
- Persisting the user's source selection between sessions (explicitly out of
  scope per PRD — no caching/search history)
- Topic suggestions or autocomplete
