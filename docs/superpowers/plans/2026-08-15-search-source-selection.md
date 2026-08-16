# Search & Source Selection Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Feature 1 of Parallax — a single-page vanilla HTML/CSS/JS interface where the user enters a news topic, selects from 31 NewsAPI sources, and submits to trigger the (currently stubbed) fetch-and-analyze pipeline.

**Architecture:** One `index.html` with a linked stylesheet and four classic (non-module) `<script>` files loaded in dependency order: `sources.js` (static data), `validation.js` (pure form-validation logic), `pipeline.js` (stubbed async submit pipeline), and `app.js` (DOM wiring that ties the three together). The three logic modules use a CommonJS export guard (`if (typeof module !== 'undefined') module.exports = {...}`) so the exact same file works as a browser global *and* as a Node module — no bundler, no transpilation, no `package.json`. `app.js` is DOM glue only and is verified by hand in a browser rather than unit tested, since adding a DOM-testing library (jsdom, etc.) would introduce the first external dependency this project has, and the project's stack decision was zero dependencies.

**Tech Stack:** Vanilla HTML/CSS/JavaScript. Tests run with Node's built-in test runner (`node --test`), which ships with Node.js (verified present: v24.16.0) — no npm install, no `package.json`, no test framework dependency.

---

## Before Task 1: Branch

- [ ] **Create the feature branch**

```bash
git checkout -b feature/1-search-source-selection
```

## File Structure

```
index.html              # Page shell: form markup, empty containers for JS to fill
src/
  styles.css             # All styling
  sources.js             # NEWS_SOURCES (31 entries) + DEFAULT_SELECTED_SOURCE_IDS
  validation.js           # validateForm(topic, selectedSourceIds)
  pipeline.js              # runPipeline(topic, selectedSourceIds, onStageChange, delayMs) — stub
  app.js                   # DOM wiring: renders checkboxes, handles clicks/input, drives submit
tests/
  sources.test.js
  validation.test.js
  pipeline.test.js
```

---

### Task 1: Page scaffold (HTML + CSS, no logic)

**Files:**
- Create: `index.html`
- Create: `src/styles.css`

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Parallax</title>
  <link rel="stylesheet" href="src/styles.css">
</head>
<body>
  <main>
    <h1>Parallax</h1>

    <div class="field">
      <label for="topic-input">What topic do you want to research?</label>
      <input type="text" id="topic-input" placeholder="e.g., AI regulation, Ukraine conflict, climate change">
      <p class="error" id="topic-error"></p>
    </div>

    <div class="field">
      <label>Select news sources (31 available)</label>
      <div class="source-actions">
        <button type="button" id="select-all-btn">Select All</button>
        <button type="button" id="deselect-all-btn">Deselect All</button>
      </div>
      <div class="source-list" id="source-list"></div>
      <p class="error" id="sources-error"></p>
    </div>

    <button type="button" id="submit-btn" disabled>Submit</button>

    <p class="progress" id="progress"></p>
  </main>

  <script src="src/sources.js"></script>
  <script src="src/validation.js"></script>
  <script src="src/pipeline.js"></script>
  <script src="src/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `src/styles.css`**

```css
* {
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 600px;
  margin: 40px auto;
  padding: 0 20px;
  color: #1a1a1a;
}

h1 {
  font-size: 24px;
  margin-bottom: 24px;
}

.field {
  margin-bottom: 24px;
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
}

input[type="text"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

input[type="text"].invalid {
  border-color: #cc0000;
}

.source-actions {
  margin-bottom: 12px;
}

.source-actions button {
  background: #f0f0f0;
  border: 1px solid #ccc;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  margin-right: 8px;
}

.source-list {
  border: 1px solid #ddd;
  padding: 16px;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 13px;
  background: #fafafa;
}

.source-item {
  display: block;
  font-weight: normal;
  margin-bottom: 8px;
}

.error {
  color: #cc0000;
  font-size: 13px;
  margin-top: 6px;
  min-height: 16px;
}

#submit-btn {
  background: #0066cc;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}

#submit-btn:disabled {
  background: #99bbdd;
  cursor: not-allowed;
}

.progress {
  margin-top: 16px;
  font-size: 13px;
  color: #555;
}
```

- [ ] **Step 3: Verify the shell renders**

Open `index.html` directly in a browser (double-click, or drag into a browser
window — no server needed since there are no ES modules). Confirm:
- Title bar/tab shows "Parallax"
- Topic input, "Select All"/"Deselect All" buttons, empty source list box, and
  a disabled "Submit" button are all visible
- No console errors (the three empty `<script>` files referenced don't exist
  yet — that's expected and fixed in the next tasks)

- [ ] **Step 4: Commit**

```bash
git add index.html src/styles.css
git commit -m "feat: add page scaffold for search & source selection"
```

---

### Task 2: Sources data module (TDD)

**Files:**
- Create: `src/sources.js`
- Test: `tests/sources.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/sources.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_SOURCES, DEFAULT_SELECTED_SOURCE_IDS } = require('../src/sources.js');

test('has exactly 31 sources', () => {
  assert.equal(NEWS_SOURCES.length, 31);
});

test('every source has a non-empty id and name', () => {
  for (const source of NEWS_SOURCES) {
    assert.equal(typeof source.id, 'string');
    assert.ok(source.id.length > 0);
    assert.equal(typeof source.name, 'string');
    assert.ok(source.name.length > 0);
  }
});

test('source ids are unique', () => {
  const ids = NEWS_SOURCES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every default selected id exists in the full source list', () => {
  const ids = new Set(NEWS_SOURCES.map((s) => s.id));
  for (const defaultId of DEFAULT_SELECTED_SOURCE_IDS) {
    assert.ok(ids.has(defaultId), `${defaultId} not found in NEWS_SOURCES`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sources.test.js`
Expected: FAIL — `Cannot find module '../src/sources.js'`

- [ ] **Step 3: Write `src/sources.js`**

```js
const NEWS_SOURCES = [
  { id: 'abc-news', name: 'ABC News' },
  { id: 'al-jazeera-english', name: 'Al Jazeera' },
  { id: 'associated-press', name: 'AP News' },
  { id: 'ars-technica', name: 'Ars Technica' },
  { id: 'bbc-news', name: 'BBC News' },
  { id: 'bloomberg', name: 'Bloomberg' },
  { id: 'business-insider', name: 'Business Insider' },
  { id: 'cnbc', name: 'CNBC' },
  { id: 'cnn', name: 'CNN' },
  { id: 'engadget', name: 'Engadget' },
  { id: 'fortune', name: 'Fortune' },
  { id: 'fox-news', name: 'Fox News' },
  { id: 'hacker-news', name: 'Hacker News' },
  { id: 'ign', name: 'IGN' },
  { id: 'mashable', name: 'Mashable' },
  { id: 'national-geographic', name: 'National Geographic' },
  { id: 'nbc-news', name: 'NBC News' },
  { id: 'new-scientist', name: 'New Scientist' },
  { id: 'newsweek', name: 'Newsweek' },
  { id: 'politico', name: 'Politico' },
  { id: 'reuters', name: 'Reuters' },
  { id: 'techcrunch', name: 'TechCrunch' },
  { id: 'techradar', name: 'TechRadar' },
  { id: 'the-guardian-uk', name: 'The Guardian' },
  { id: 'the-next-web', name: 'The Next Web' },
  { id: 'the-verge', name: 'The Verge' },
  { id: 'the-wall-street-journal', name: 'Wall Street Journal' },
  { id: 'the-washington-post', name: 'Washington Post' },
  { id: 'time', name: 'Time' },
  { id: 'usa-today', name: 'USA Today' },
  { id: 'wired', name: 'Wired' },
];

const DEFAULT_SELECTED_SOURCE_IDS = ['bbc-news', 'associated-press', 'reuters'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NEWS_SOURCES, DEFAULT_SELECTED_SOURCE_IDS };
}
```

Note: these are the 31 sources listed in `docs/prd-parallax.md`'s Appendix,
with ids matching NewsAPI.org's `/v2/top-headlines/sources` naming convention.
Feature 2 (News API integration) should re-verify these ids against a live
call to that endpoint before relying on them for real fetches.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sources.test.js`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/sources.js tests/sources.test.js
git commit -m "feat: add news sources data module"
```

---

### Task 3: Form validation logic (TDD)

**Files:**
- Create: `src/validation.js`
- Test: `tests/validation.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/validation.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateForm } = require('../src/validation.js');

test('rejects empty topic', () => {
  const result = validateForm('', ['bbc-news']);
  assert.equal(result.valid, false);
  assert.equal(result.errors.topic, 'Please enter a topic.');
});

test('rejects whitespace-only topic', () => {
  const result = validateForm('   ', ['bbc-news']);
  assert.equal(result.valid, false);
  assert.equal(result.errors.topic, 'Please enter a topic.');
});

test('rejects zero selected sources', () => {
  const result = validateForm('AI regulation', []);
  assert.equal(result.valid, false);
  assert.equal(result.errors.sources, 'Please select at least one source.');
});

test('accepts a valid topic and at least one source', () => {
  const result = validateForm('AI regulation', ['bbc-news']);
  assert.equal(result.valid, true);
  assert.equal(result.errors.topic, null);
  assert.equal(result.errors.sources, null);
});

test('reports both errors when topic and sources are both invalid', () => {
  const result = validateForm('', []);
  assert.equal(result.valid, false);
  assert.equal(result.errors.topic, 'Please enter a topic.');
  assert.equal(result.errors.sources, 'Please select at least one source.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/validation.test.js`
Expected: FAIL — `Cannot find module '../src/validation.js'`

- [ ] **Step 3: Write `src/validation.js`**

```js
function validateForm(topic, selectedSourceIds) {
  const errors = { topic: null, sources: null };

  if (!topic || topic.trim().length === 0) {
    errors.topic = 'Please enter a topic.';
  }

  if (!Array.isArray(selectedSourceIds) || selectedSourceIds.length === 0) {
    errors.sources = 'Please select at least one source.';
  }

  const valid = errors.topic === null && errors.sources === null;
  return { valid, errors };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateForm };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/validation.test.js`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/validation.js tests/validation.test.js
git commit -m "feat: add form validation logic"
```

---

### Task 4: Stubbed submit pipeline (TDD)

**Files:**
- Create: `src/pipeline.js`
- Test: `tests/pipeline.test.js`

Features 2–4 (News API fetch, Claude analysis, results display) don't exist
yet, so Feature 1 needs a self-contained stand-in for "submit and see staged
progress" that can be demoed today and swapped for the real pipeline later.
`runPipeline` simulates the two stages from the spec with a delay between
them, calling back with each stage's label, then resolves with the
`{ topic, sources }` payload Feature 2 will eventually consume.

- [ ] **Step 1: Write the failing test**

```js
// tests/pipeline.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { runPipeline, PIPELINE_STAGES } = require('../src/pipeline.js');

test('calls onStageChange with each stage label in order', async () => {
  const seenStages = [];
  await runPipeline('AI regulation', ['bbc-news'], (stage) => {
    seenStages.push(stage);
  }, 5);

  assert.deepEqual(seenStages, PIPELINE_STAGES);
});

test('resolves with the topic and selected source ids under a "sources" key', async () => {
  const result = await runPipeline('AI regulation', ['bbc-news', 'reuters'], () => {}, 5);
  assert.deepEqual(result, { topic: 'AI regulation', sources: ['bbc-news', 'reuters'] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pipeline.test.js`
Expected: FAIL — `Cannot find module '../src/pipeline.js'`

- [ ] **Step 3: Write `src/pipeline.js`**

```js
const PIPELINE_STAGES = [
  'Fetching articles from selected sources…',
  'Analyzing with Claude…',
];

function runPipeline(topic, selectedSourceIds, onStageChange, delayMs) {
  const delay = typeof delayMs === 'number' ? delayMs : 600;

  return new Promise((resolve) => {
    let stageIndex = 0;
    onStageChange(PIPELINE_STAGES[stageIndex]);

    const advance = () => {
      stageIndex += 1;
      if (stageIndex < PIPELINE_STAGES.length) {
        onStageChange(PIPELINE_STAGES[stageIndex]);
        setTimeout(advance, delay);
      } else {
        resolve({ topic, sources: selectedSourceIds });
      }
    };

    setTimeout(advance, delay);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPipeline, PIPELINE_STAGES };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/pipeline.test.js`
Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/pipeline.js tests/pipeline.test.js
git commit -m "feat: add stubbed submit pipeline with staged progress callbacks"
```

---

### Task 5: DOM wiring (app.js)

**Files:**
- Create: `src/app.js`
- Modify: none (verified manually in-browser, not unit tested — see Architecture note above)

- [ ] **Step 1: Write `src/app.js`**

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

  let hasAttemptedSubmit = false;

  NEWS_SOURCES.forEach((source) => {
    const label = document.createElement('label');
    label.className = 'source-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = source.id;
    checkbox.checked = DEFAULT_SELECTED_SOURCE_IDS.includes(source.id);
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

  submitBtn.addEventListener('click', () => {
    hasAttemptedSubmit = true;
    const topic = topicInput.value;
    const selectedSourceIds = getSelectedSourceIds();
    const { valid, errors } = validateForm(topic, selectedSourceIds);

    showErrors(errors);
    if (!valid) {
      return;
    }

    setFormDisabled(true);
    progressEl.textContent = '';

    runPipeline(topic, selectedSourceIds, (stage) => {
      progressEl.textContent = stage;
    }).then((result) => {
      progressEl.textContent = 'Done — see console for collected data (analysis not yet implemented).';
      console.log('Pipeline result:', result);
    }).catch((err) => {
      progressEl.textContent = 'Something went wrong. Please try again.';
      setFormDisabled(false);
      console.error(err);
    });
  });

  handleFieldChange();
});
```

- [ ] **Step 2: Verify in browser — initial state**

Open `index.html` (or refresh if already open). Confirm:
- All 31 source checkboxes render, with **BBC News**, **AP News**, and
  **Reuters** pre-checked and all others unchecked
- Submit button is disabled (topic is empty)

- [ ] **Step 3: Verify in browser — Select All / Deselect All**

Click **Select All**. Confirm all 31 checkboxes become checked.
Click **Deselect All**. Confirm all 31 checkboxes become unchecked, and the
Submit button becomes disabled if it wasn't already (zero sources selected).

- [ ] **Step 4: Verify in browser — form validity toggling**

With sources still deselected, type a topic (e.g. "AI regulation") into the
topic input. Confirm Submit stays disabled (no sources selected).
Click **Select All**. Confirm Submit becomes enabled.
Clear the topic field. Confirm Submit becomes disabled again.

- [ ] **Step 5: Verify in browser — submit flow**

Re-enter a topic, keep at least one source checked, click **Submit**. Confirm:
- Topic input, checkboxes, both action buttons, and Submit all become
  disabled/greyed out immediately
- The progress line shows "Fetching articles from selected sources…" then,
  after a beat, "Analyzing with Claude…"
- After both stages complete, the progress line shows "Done — see console for
  collected data (analysis not yet implemented)."
- Open the browser console and confirm a `Pipeline result:` log with the
  entered topic and the array of selected source ids under a `sources` key

- [ ] **Step 6: Commit**

```bash
git add src/app.js
git commit -m "feat: wire DOM interactions for search & source selection"
```

---

### Task 6: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `node --test`
Expected: PASS — all 11 tests across `sources.test.js`, `validation.test.js`,
and `pipeline.test.js` passing, 0 failures

- [ ] **Step 2: Re-check spec acceptance criteria against the running page**

Open `index.html` fresh (hard refresh) and walk through
`docs/superpowers/specs/2026-08-15-search-source-selection-design.md`
section by section, confirming each requirement is met:
- Single-column layout, title, topic input, source checklist, Submit button
- Select All / Deselect All are buttons, not checkboxes, and act on the list
- Topic error text + red input border when submitting empty topic (temporarily
  remove the `disabled` attribute in devtools to reach this state, since the
  button is normally disabled first — confirms the defensive validation path
  works even if the disabled check is ever bypassed)
- Sources error text when submitting with zero sources selected (same devtools
  check)
- Staged progress labels appear in the documented order and wording

- [ ] **Step 3: Update roadmap status**

In `docs/roadmap.md`, change Feature 1's Status from `Next` to `In progress`
in the table (row for "Search & source selection interface"). Per
`docs/roadmap.md`'s own rules, this table is otherwise only touched at
closeout — this one edit reflects that implementation has now started.

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark search & source selection interface in progress"
```
