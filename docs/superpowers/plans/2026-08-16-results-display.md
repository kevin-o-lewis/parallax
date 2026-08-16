# Feature 4: Results Display with Traceability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Feature 3's `{facts, perspectives}` analysis output as an actual results page — cards with statements/summaries, source links, and expandable verbatim quotes — replacing the current console-log-and-summary-count stub.

**Architecture:** A single-page-app view swap inside the existing `index.html`/`app.js` (no new HTML page, no routing). A new pure module, `src/results.js`, turns the analysis data into an HTML string; `app.js` injects it and wires one delegated click listener for the per-card citation toggles. No backend or `pipeline.js` changes — this is a display layer on top of an already-complete data flow.

**Tech Stack:** Vanilla HTML/CSS/JS, Node's built-in `node:test` for unit tests. No new dependencies.

---

## Before you start

Run the existing suite once to confirm a clean baseline:

Run: `node --test "tests/*.test.js"`
Expected: `70 pass`, `0 fail` (matches the count as of Feature 3; if it differs, stop and investigate before starting).

---

### Task 1: Results rendering module

**Files:**
- Create: `src/results.js`
- Test: `tests/results.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/results.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderResultsHTML, escapeHtml } = require('../src/results.js');

const SAMPLE_ANALYSIS = {
  facts: [
    {
      statement: 'Retail prices rose 2.1% in July.',
      citations: [
        { quote: 'prices climbed 2.1% in July', sourceName: 'Reuters', url: 'https://reuters.example.com/a' },
      ],
    },
  ],
  perspectives: [
    {
      label: 'Concern about consumer cost',
      summary: 'Some economists argue costs are being passed to consumers.',
      citations: [
        { quote: 'consumers will bear the brunt', sourceName: 'WSJ', url: 'https://wsj.example.com/b' },
      ],
    },
  ],
  articlesAnalyzed: 25,
  articlesUsingFallbackText: 4,
};

test('escapeHtml escapes HTML-significant characters', () => {
  assert.equal(escapeHtml('<script>&"\''), '&lt;script&gt;&amp;&quot;&#39;');
});

test('renders the topic as an escaped heading', () => {
  const html = renderResultsHTML('AI & <regulation>', SAMPLE_ANALYSIS);
  assert.match(html, /<h2 tabindex="-1">Results for "AI &amp; &lt;regulation&gt;"<\/h2>/);
});

test('renders a fact card with statement, source link, and a hidden quotes block', () => {
  const html = renderResultsHTML('topic', SAMPLE_ANALYSIS);
  assert.match(html, /Retail prices rose 2\.1% in July\./);
  assert.match(html, /<a href="https:\/\/reuters\.example\.com\/a" target="_blank" rel="noopener noreferrer">Reuters<\/a>/);
  assert.match(html, /<div class="quotes" hidden><blockquote>"prices climbed 2\.1% in July" — Reuters<\/blockquote><\/div>/);
});

test('renders a perspective card with label, summary, source link, and a hidden quotes block', () => {
  const html = renderResultsHTML('topic', SAMPLE_ANALYSIS);
  assert.match(html, /Concern about consumer cost/);
  assert.match(html, /Some economists argue costs are being passed to consumers\./);
  assert.match(html, /<a href="https:\/\/wsj\.example\.com\/b" target="_blank" rel="noopener noreferrer">WSJ<\/a>/);
});

test('shows a facts-empty note when facts is empty but perspectives is not', () => {
  const analysis = { ...SAMPLE_ANALYSIS, facts: [] };
  const html = renderResultsHTML('topic', analysis);
  assert.match(html, /No verifiable facts found for this topic\./);
  assert.match(html, /Concern about consumer cost/);
});

test('shows a perspectives-empty note when perspectives is empty but facts is not', () => {
  const analysis = { ...SAMPLE_ANALYSIS, perspectives: [] };
  const html = renderResultsHTML('topic', analysis);
  assert.match(html, /No verifiable perspectives found for this topic\./);
  assert.match(html, /Retail prices rose 2\.1% in July\./);
});

test('diagnostics line omits the fallback clause when articlesUsingFallbackText is 0', () => {
  const analysis = { ...SAMPLE_ANALYSIS, articlesUsingFallbackText: 0 };
  const html = renderResultsHTML('topic', analysis);
  assert.match(html, /<p class="diagnostics">25 articles analyzed<\/p>/);
});

test('diagnostics line includes the fallback count when greater than 0', () => {
  const html = renderResultsHTML('topic', SAMPLE_ANALYSIS);
  assert.match(html, /<p class="diagnostics">25 articles analyzed \(4 used snippet fallback instead of full text\)<\/p>/);
});

test('escapes HTML-significant characters inside a quote and source name', () => {
  const analysis = {
    facts: [
      {
        statement: 'Statement',
        citations: [
          { quote: 'costs <will> "rise" & fall', sourceName: 'A & B News', url: 'https://example.com/x' },
        ],
      },
    ],
    perspectives: [],
    articlesAnalyzed: 1,
    articlesUsingFallbackText: 0,
  };
  const html = renderResultsHTML('topic', analysis);
  assert.match(html, /costs &lt;will&gt; &quot;rise&quot; &amp; fall/);
  assert.match(html, /A &amp; B News/);
  assert.ok(!html.includes('<will>'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results.test.js`
Expected: FAIL — `Cannot find module '../src/results.js'`

- [ ] **Step 3: Implement `src/results.js`**

Create `src/results.js`:

```js
// Pure rendering: turns Feature 3's verified {facts, perspectives,
// articlesAnalyzed, articlesUsingFallbackText} shape into an HTML string for
// the results view. app.js is the only caller, and only ever does
// resultsContent.innerHTML = renderResultsHTML(...).
//
// Every fact statement, quote, source name, and perspective label/summary
// originates from Claude's synthesis of scraped third-party article text —
// content this app does not control. This is the one place in the app that
// turns that external text into HTML, so every such field is escaped before
// interpolation.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSourceLinks(citations) {
  return citations
    .map((citation) =>
      '<a href="' + escapeHtml(citation.url) + '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(citation.sourceName) + '</a>'
    )
    .join(' ');
}

function renderQuotes(citations) {
  return citations
    .map((citation) => '<blockquote>"' + escapeHtml(citation.quote) + '" — ' + escapeHtml(citation.sourceName) + '</blockquote>')
    .join('');
}

// The toggle button and its quotes block are rendered as direct siblings
// (button immediately followed by the .quotes div) so app.js's delegated
// click handler can find the right quotes block via toggle.nextElementSibling
// without needing per-card ids.
function renderCard(headingHtml, extraHtml, citations) {
  return '<div class="result-card">' +
    headingHtml +
    extraHtml +
    '<p class="card-sources">' + renderSourceLinks(citations) + '</p>' +
    '<button type="button" class="quote-toggle" aria-expanded="false">show quotes</button>' +
    '<div class="quotes" hidden>' + renderQuotes(citations) + '</div>' +
    '</div>';
}

function renderFactCard(fact) {
  return renderCard(
    '<p class="card-statement">' + escapeHtml(fact.statement) + '</p>',
    '',
    fact.citations
  );
}

function renderPerspectiveCard(perspective) {
  return renderCard(
    '<p class="card-statement">' + escapeHtml(perspective.label) + '</p>',
    '<p class="card-summary">' + escapeHtml(perspective.summary) + '</p>',
    perspective.citations
  );
}

function renderSection(title, items, emptyNoteText, cardRenderer) {
  const body = items.length === 0
    ? '<p class="section-empty-note">' + escapeHtml(emptyNoteText) + '</p>'
    : items.map(cardRenderer).join('');
  return '<section><h3>' + escapeHtml(title) + '</h3>' + body + '</section>';
}

function renderDiagnostics(articlesAnalyzed, articlesUsingFallbackText) {
  let text = articlesAnalyzed + ' articles analyzed';
  if (articlesUsingFallbackText > 0) {
    text += ' (' + articlesUsingFallbackText + ' used snippet fallback instead of full text)';
  }
  return '<p class="diagnostics">' + text + '</p>';
}

function renderResultsHTML(topic, analysis) {
  const factsSection = renderSection(
    'Facts', analysis.facts, 'No verifiable facts found for this topic.', renderFactCard
  );
  const perspectivesSection = renderSection(
    'Perspectives', analysis.perspectives, 'No verifiable perspectives found for this topic.', renderPerspectiveCard
  );
  const diagnostics = renderDiagnostics(analysis.articlesAnalyzed, analysis.articlesUsingFallbackText);

  return '<h2 tabindex="-1">Results for "' + escapeHtml(topic) + '"</h2>' +
    factsSection + perspectivesSection + diagnostics;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderResultsHTML, escapeHtml };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/results.test.js`
Expected: `9 pass`, `0 fail`

- [ ] **Step 5: Commit**

```bash
git add src/results.js tests/results.test.js
git commit -m "feat: add results rendering module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Results view markup in `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Wrap the existing form in `#search-view` and add `#results-view`**

Replace the `<body>` contents of `index.html` with:

```html
<body>
  <main>
    <h1>Parallax</h1>

    <div id="search-view">
      <div class="field">
        <label for="topic-input">What topic do you want to research?</label>
        <input type="text" id="topic-input" placeholder="e.g., AI regulation, Ukraine conflict, climate change">
        <p class="error" id="topic-error"></p>
      </div>

      <div class="field">
        <label>Select news sources (20 available)</label>
        <div class="source-actions">
          <button type="button" id="select-all-btn">Select All</button>
          <button type="button" id="deselect-all-btn">Deselect All</button>
        </div>
        <div class="source-list" id="source-list"></div>
        <p class="error" id="sources-error"></p>
      </div>

      <button type="button" id="submit-btn" disabled>Submit</button>

      <p class="progress" id="progress"></p>
    </div>

    <div id="results-view" hidden>
      <button type="button" id="back-to-search-btn">← Back to search</button>
      <div id="results-content"></div>
    </div>
  </main>

  <script src="src/sources.js"></script>
  <script src="src/validation.js"></script>
  <script src="src/results.js"></script>
  <script src="src/pipeline.js"></script>
  <script src="src/app.js"></script>
</body>
```

(Only the `<body>` changes — `<head>` stays as-is.)

- [ ] **Step 2: Run the full suite to confirm no regressions**

Run: `node --test "tests/*.test.js"`
Expected: `79 pass`, `0 fail` (70 existing + 9 from Task 1; `index.html` itself has no unit tests, so this just guards against an unrelated break)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add results view markup alongside the search view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Results view styling

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append results-view rules**

Add to the end of `src/styles.css`:

```css
#back-to-search-btn {
  background: #f0f0f0;
  border: 1px solid #ccc;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 20px;
}

#results-content h2 {
  font-size: 20px;
  margin-bottom: 16px;
}

#results-content h3 {
  font-size: 16px;
  margin: 24px 0 12px;
}

.result-card {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
}

.card-statement {
  font-weight: 600;
  margin: 0 0 6px;
}

.card-summary {
  font-size: 13px;
  margin: 0 0 6px;
  color: #333;
}

.card-sources {
  font-size: 12px;
  margin: 0 0 6px;
}

.card-sources a {
  color: #0066cc;
  margin-right: 8px;
}

.quote-toggle {
  background: none;
  border: none;
  padding: 0;
  color: #0066cc;
  text-decoration: underline;
  cursor: pointer;
  font-size: 12px;
}

.quotes blockquote {
  margin: 6px 0 0;
  padding: 6px 10px;
  border-left: 3px solid #ccc;
  font-size: 13px;
  color: #444;
  font-style: italic;
}

.section-empty-note {
  color: #888;
  font-size: 13px;
  font-style: italic;
}

.diagnostics {
  margin-top: 16px;
  font-size: 12px;
  color: #999;
  border-top: 1px solid #eee;
  padding-top: 8px;
}
```

- [ ] **Step 2: Run the full suite to confirm no regressions**

Run: `node --test "tests/*.test.js"`
Expected: `79 pass`, `0 fail`

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: style the results view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire view switching, citation toggle, and the form re-enable fix into `app.js`

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: Replace `src/app.js`**

Replace the full contents of `src/app.js`:

```js
document.addEventListener('DOMContentLoaded', () => {
  const topicInput = document.getElementById('topic-input');
  const topicError = document.getElementById('topic-error');
  const sourceList = document.getElementById('source-list');
  const sourcesError = document.getElementById('sources-error');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const submitBtn = document.getElementById('submit-btn');
  const progressEl = document.getElementById('progress');
  const searchView = document.getElementById('search-view');
  const resultsView = document.getElementById('results-view');
  const resultsContent = document.getElementById('results-content');
  const backToSearchBtn = document.getElementById('back-to-search-btn');

  let hasAttemptedSubmit = false;

  NEWS_SOURCES.forEach((source) => {
    const label = document.createElement('label');
    label.className = 'source-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = source.id;
    checkbox.addEventListener('change', handleFieldChange);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + source.name));
    sourceList.appendChild(label);
  });

  function getCheckboxes() {
    return Array.from(sourceList.querySelectorAll('input[type="checkbox"]'));
  }

  function getSelectedSourceIds() {
    return getCheckboxes()
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  }

  function showErrors(errors) {
    topicError.textContent = errors.topic || '';
    topicInput.classList.toggle('invalid', Boolean(errors.topic));
    sourcesError.textContent = errors.sources || '';
  }

  function handleFieldChange() {
    const { valid, errors } = validateForm(topicInput.value, getSelectedSourceIds());
    submitBtn.disabled = !valid;
    if (hasAttemptedSubmit) {
      showErrors(errors);
    }
  }

  selectAllBtn.addEventListener('click', () => {
    getCheckboxes().forEach((cb) => { cb.checked = true; });
    handleFieldChange();
  });

  deselectAllBtn.addEventListener('click', () => {
    getCheckboxes().forEach((cb) => { cb.checked = false; });
    handleFieldChange();
  });

  topicInput.addEventListener('input', handleFieldChange);

  function setFormDisabled(disabled) {
    topicInput.disabled = disabled;
    getCheckboxes().forEach((cb) => { cb.disabled = disabled; });
    selectAllBtn.disabled = disabled;
    deselectAllBtn.disabled = disabled;
    submitBtn.disabled = disabled;
  }

  function showResultsView(topic, analysis) {
    resultsContent.innerHTML = renderResultsHTML(topic, analysis);
    searchView.hidden = true;
    resultsView.hidden = false;
    const heading = resultsContent.querySelector('h2');
    if (heading) {
      heading.focus();
    }
  }

  function showSearchView() {
    resultsView.hidden = true;
    searchView.hidden = false;
    topicInput.focus();
  }

  // One delegated listener handles every citation toggle button: results
  // content is replaced wholesale via innerHTML on every search, so
  // individual toggle buttons never exist at page load to bind directly.
  // Each toggle's quotes block is rendered as its next DOM sibling (see
  // src/results.js), so no per-card ids are needed to find it.
  resultsContent.addEventListener('click', (event) => {
    const toggle = event.target.closest('.quote-toggle');
    if (!toggle) {
      return;
    }
    const quotesEl = toggle.nextElementSibling;
    if (!quotesEl) {
      return;
    }
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    quotesEl.hidden = expanded;
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.textContent = expanded ? 'show quotes' : 'hide quotes';
  });

  backToSearchBtn.addEventListener('click', () => {
    showSearchView();
  });

  submitBtn.addEventListener('click', () => {
    hasAttemptedSubmit = true;
    const topic = topicInput.value.trim();
    const selectedSourceIds = getSelectedSourceIds();
    const { valid, errors } = validateForm(topic, selectedSourceIds);

    showErrors(errors);
    if (!valid) {
      return;
    }

    resultsView.hidden = true;
    searchView.hidden = false;
    setFormDisabled(true);
    progressEl.textContent = '';

    runPipeline(topic, selectedSourceIds, (stage) => {
      progressEl.textContent = stage;
    }).then((result) => {
      if (result.articles.length === 0) {
        progressEl.textContent = 'No articles found for this topic in the selected sources over the last 7 days. Try different sources or a broader topic.';
        setFormDisabled(false);
      } else if (result.analysis.facts.length === 0 && result.analysis.perspectives.length === 0) {
        progressEl.textContent = "Claude couldn't produce verifiable results for this topic. See console for data.";
        setFormDisabled(false);
      } else {
        progressEl.textContent = '';
        setFormDisabled(false);
        showResultsView(result.topic, result.analysis);
      }
      console.log('Pipeline result:', result);
    }).catch((err) => {
      progressEl.textContent = err.message;
      setFormDisabled(false);
      console.error(err);
    });
  });

  handleFieldChange();
});
```

Note the fix folded in here: the success branch now calls `setFormDisabled(false)` (all three outcome branches do), where previously only the `.catch()` path re-enabled the form — a successful search used to leave it disabled indefinitely.

- [ ] **Step 2: Run the full suite to confirm no regressions**

Run: `node --test "tests/*.test.js"`
Expected: `79 pass`, `0 fail` (`app.js` has no unit tests of its own, consistent with Features 1–3 — its DOM wiring is verified manually in Task 5)

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: wire results view switching and citation toggle into app.js

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Manual verification

This exercises the fully wired feature end-to-end in a real browser — the DOM wiring from Task 4 has no unit tests, matching this project's existing convention (`app.js` has never had one). No real NewsAPI/Claude keys are needed for this task: it verifies the display layer directly, independent of the network calls Feature 3 already covers.

**Files:**
- Create (temporary, gitignored, delete or leave in place when done — never commit): `config.local.json`

- [ ] **Step 1: Create a placeholder config so the server will start**

`server.js` refuses to start without a `config.local.json` containing non-empty string values for both keys — it never validates the keys are *real*, only that they're present. Create `config.local.json` in the project root:

```json
{
  "newsApiKey": "placeholder-for-manual-ui-verification",
  "claudeApiKey": "placeholder-for-manual-ui-verification"
}
```

(This file is already in `.gitignore` — confirm with `git status` that it doesn't show as a new file to commit.)

- [ ] **Step 2: Start the server**

Run: `node server.js`
Expected stdout: `Parallax running at http://localhost:3000`
Leave this running in the background for the rest of this task.

- [ ] **Step 3: Open the app and inject a fixture result**

Open `http://localhost:3000` in a browser. Open the developer console and run:

```js
document.getElementById('results-content').innerHTML = renderResultsHTML('AI regulation', {
  facts: [
    { statement: 'Test fact statement.', citations: [
      { quote: 'test fact quote', sourceName: 'Test Source', url: 'https://example.com/a' }
    ] }
  ],
  perspectives: [
    { label: 'Test perspective', summary: 'Test perspective summary.', citations: [
      { quote: 'test perspective quote', sourceName: 'Test Source 2', url: 'https://example.com/b' }
    ] }
  ],
  articlesAnalyzed: 12,
  articlesUsingFallbackText: 3,
});
document.getElementById('search-view').hidden = true;
document.getElementById('results-view').hidden = false;
```

This calls the exact same `renderResultsHTML` function `app.js` calls on a real successful search, and flips the same `hidden` attributes `showResultsView` does — it only skips the network round trip, which Feature 3 already verified separately.

Expected: the search form disappears; a "← Back to search" button, an "AI regulation" heading, a Facts section with one card, a Perspectives section with one card, and a diagnostics line reading "12 articles analyzed (3 used snippet fallback instead of full text)" all appear.

- [ ] **Step 4: Verify the citation toggle**

Click "show quotes" on the fact card.
Expected: the button label changes to "hide quotes", and the blockquote `"test fact quote" — Test Source` becomes visible below it. Click it again — expected: it collapses and the label reverts to "show quotes".

- [ ] **Step 5: Verify "Back to search"**

Click "← Back to search".
Expected: the results view disappears, the search form reappears, and keyboard focus is on the topic input (confirm by checking `document.activeElement.id === 'topic-input'` in the console, or by pressing a character key and seeing it appear in the topic field).

- [ ] **Step 6: Stop the server**

Stop the `node server.js` process (Ctrl+C, or however it was started).

No commit for this task — it's verification only, no files change as a result (aside from the temporary, gitignored `config.local.json`, which can be left in place for future local dev or deleted).

---

## Notes for closeout

- This feature adds no new backend behavior, so the "known gap" carried forward from Feature 3 (no real NewsAPI/Claude key was available in this environment to verify the live scrape → Claude → verify path end-to-end) is unchanged by this work — Task 5 above verifies the display layer, not the network path. Record this plainly in the ledger, the same way Feature 3's ledger did.
