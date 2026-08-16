# News API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Feature 1's stubbed submit pipeline real for article fetching — construct a NewsAPI query from the user's topic and selected sources, fetch matching articles through a small local Node proxy server (so the API key never reaches the browser or git), and hand the results forward.

**Architecture:** A plain Node.js server (`server.js`, built-in `http`/`fs`/`path` only) serves the existing static files and exposes `GET /api/articles`, which builds a NewsAPI request, calls it, and returns normalized JSON. Query construction, response normalization, error-code mapping, and static-file path resolution are pure functions in `src/newsapi.js` and `src/static-files.js`, unit tested the same way Feature 1 tested its logic. `src/pipeline.js`'s stub is replaced with a real `fetch()` call; its fake second stage is removed entirely rather than kept as a lie next to real data.

**Tech Stack:** Vanilla HTML/CSS/JavaScript (browser) + plain Node.js (server), zero npm packages. Tests via Node's built-in `node:test`, including its built-in `t.mock.method` for mocking `fetch` in `pipeline.test.js` — still zero dependencies.

---

## Before Task 1: Branch

- [ ] **Create the feature branch**

```bash
git checkout -b feature/2-news-api-integration
```

## File Structure

```
server.js                    # NEW — Node HTTP server: static files + /api/articles proxy
config.example.json          # NEW — committed template for the NewsAPI key
config.local.json            # NEW, gitignored — real key goes here, never committed
start.bat                    # NEW — Windows double-click launcher
src/
  newsapi.js                  # NEW — pure: query URL, response normalization, error mapping
  static-files.js              # NEW — pure: URL path → safe file path, extension → MIME type
  sources.js                   # MODIFIED — 31 → 20 sources (NewsAPI's per-request limit)
  pipeline.js                  # MODIFIED — real fetch, fake second stage removed
  app.js                       # MODIFIED — new completion/error message text
tests/
  newsapi.test.js              # NEW
  static-files.test.js         # NEW
  sources.test.js               # MODIFIED — count assertion 31 → 20
  pipeline.test.js              # MODIFIED — rewritten for real-fetch behavior
index.html                    # MODIFIED — "31 available" → "20 available"
README.md                     # MODIFIED — note on the fixed 7-day search window
.gitignore                    # MODIFIED — add config.local.json
```

---

### Task 1: Shrink the source list to 20

**Files:**
- Modify: `src/sources.js`
- Modify: `tests/sources.test.js`
- Modify: `index.html`

NewsAPI's `/v2/everything` endpoint accepts a maximum of 20 sources per
request. Feature 1 shipped with 31. This task removes the 11 lowest-priority
sources (per product decision) so it becomes structurally impossible to
select more than the API allows — no new validation needed anywhere.

- [ ] **Step 1: Update the test to expect 20 sources (will fail against current data)**

In `tests/sources.test.js`, change:

```js
test('has exactly 31 sources', () => {
  assert.equal(NEWS_SOURCES.length, 31);
});
```

to:

```js
test('has exactly 20 sources', () => {
  assert.equal(NEWS_SOURCES.length, 20);
});
```

Leave the other three tests in that file (`every source has a non-empty id
and name`, `source ids are unique`, `every default selected id exists in the
full source list`) unchanged — they still apply.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sources.test.js`
Expected: FAIL — `has exactly 20 sources` fails because `NEWS_SOURCES.length` is still 31

- [ ] **Step 3: Update `src/sources.js` — remove 11 sources**

Replace the `NEWS_SOURCES` array so it contains exactly these 20 entries, in
this order (removing Ars Technica, Engadget, Hacker News, IGN, Mashable, New
Scientist, TechCrunch, TechRadar, The Next Web, The Verge, and Wired from the
original 31):

```js
const NEWS_SOURCES = [
  { id: 'abc-news', name: 'ABC News' },
  { id: 'al-jazeera-english', name: 'Al Jazeera' },
  { id: 'associated-press', name: 'AP News' },
  { id: 'bbc-news', name: 'BBC News' },
  { id: 'bloomberg', name: 'Bloomberg' },
  { id: 'business-insider', name: 'Business Insider' },
  { id: 'cnbc', name: 'CNBC' },
  { id: 'cnn', name: 'CNN' },
  { id: 'fortune', name: 'Fortune' },
  { id: 'fox-news', name: 'Fox News' },
  { id: 'national-geographic', name: 'National Geographic' },
  { id: 'nbc-news', name: 'NBC News' },
  { id: 'newsweek', name: 'Newsweek' },
  { id: 'politico', name: 'Politico' },
  { id: 'reuters', name: 'Reuters' },
  { id: 'the-guardian-uk', name: 'The Guardian' },
  { id: 'the-wall-street-journal', name: 'Wall Street Journal' },
  { id: 'the-washington-post', name: 'Washington Post' },
  { id: 'time', name: 'Time' },
  { id: 'usa-today', name: 'USA Today' },
];

const DEFAULT_SELECTED_SOURCE_IDS = ['bbc-news', 'associated-press', 'reuters'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NEWS_SOURCES, DEFAULT_SELECTED_SOURCE_IDS };
}
```

(`DEFAULT_SELECTED_SOURCE_IDS` is unchanged — all three defaults survive the cut.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sources.test.js`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Update the label in `index.html`**

Find:

```html
<label>Select news sources (31 available)</label>
```

Replace with:

```html
<label>Select news sources (20 available)</label>
```

- [ ] **Step 6: Commit**

```bash
git add src/sources.js tests/sources.test.js index.html
git commit -m "feat: trim source list to 20 to match NewsAPI's per-request limit"
```

---

### Task 2: NewsAPI query/response/error logic (TDD)

**Files:**
- Create: `src/newsapi.js`
- Test: `tests/newsapi.test.js`

Three pure functions: building the NewsAPI request URL, normalizing its
article response shape, and mapping its documented error codes to the
category messages from the design spec. This file is Node-only (required by
`server.js`, never loaded in the browser), so it does not need the
browser/Node dual-export guard used elsewhere in this project — plain
`module.exports` is correct here.

- [ ] **Step 1: Write the failing tests**

```js
// tests/newsapi.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildArticlesUrl, normalizeArticles, mapNewsApiError } = require('../src/newsapi.js');

test('includes topic, sources, and API key in the query string', () => {
  const url = buildArticlesUrl('AI regulation', ['bbc-news', 'reuters'], 'test-key', new Date('2026-08-15T12:00:00Z'));
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://newsapi.org/v2/everything');
  assert.equal(parsed.searchParams.get('q'), 'AI regulation');
  assert.equal(parsed.searchParams.get('sources'), 'bbc-news,reuters');
  assert.equal(parsed.searchParams.get('apiKey'), 'test-key');
});

test('sets a 7 day date window ending on the reference date', () => {
  const url = buildArticlesUrl('AI regulation', ['bbc-news'], 'test-key', new Date('2026-08-15T12:00:00Z'));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('to'), '2026-08-15');
  assert.equal(parsed.searchParams.get('from'), '2026-08-08');
});

test('sorts by relevancy with a fixed page size of 20', () => {
  const url = buildArticlesUrl('AI regulation', ['bbc-news'], 'test-key', new Date('2026-08-15T12:00:00Z'));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('sortBy'), 'relevancy');
  assert.equal(parsed.searchParams.get('pageSize'), '20');
});

test('maps NewsAPI article fields to the normalized shape', () => {
  const raw = [{
    source: { id: 'bbc-news', name: 'BBC News' },
    author: 'Jane Doe',
    title: 'Example headline',
    description: 'Example description',
    url: 'https://example.com/article',
    urlToImage: 'https://example.com/image.jpg',
    publishedAt: '2026-08-15T09:00:00Z',
    content: 'Example truncated content... [+120 chars]',
  }];

  const result = normalizeArticles(raw);

  assert.deepEqual(result, [{
    title: 'Example headline',
    description: 'Example description',
    content: 'Example truncated content... [+120 chars]',
    url: 'https://example.com/article',
    publishedAt: '2026-08-15T09:00:00Z',
    sourceName: 'BBC News',
    author: 'Jane Doe',
  }]);
});

test('handles an empty articles array', () => {
  assert.deepEqual(normalizeArticles([]), []);
});

test('maps key problem codes to a 401 with a config message', () => {
  for (const code of ['apiKeyMissing', 'apiKeyInvalid', 'apiKeyDisabled']) {
    const result = mapNewsApiError(code);
    assert.equal(result.status, 401);
    assert.match(result.message, /key is missing or invalid/);
  }
});

test('maps quota codes to a 429 with a quota message', () => {
  for (const code of ['apiKeyExhausted', 'rateLimited']) {
    const result = mapNewsApiError(code);
    assert.equal(result.status, 429);
    assert.match(result.message, /Daily NewsAPI request limit reached/);
  }
});

test('maps bad-request codes to a 500 with an internal-bug message', () => {
  for (const code of ['parameterInvalid', 'parametersMissing', 'sourcesTooMany', 'sourceDoesNotExist']) {
    const result = mapNewsApiError(code);
    assert.equal(result.status, 500);
    assert.match(result.message, /Something's wrong with the request Parallax sent/);
  }
});

test('maps unrecognized or connection codes to a 502 with a connection message', () => {
  for (const code of ['unexpectedError', 'somethingNewAndUnknown']) {
    const result = mapNewsApiError(code);
    assert.equal(result.status, 502);
    assert.match(result.message, /Couldn't reach NewsAPI/);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/newsapi.test.js`
Expected: FAIL — `Cannot find module '../src/newsapi.js'`

- [ ] **Step 3: Write `src/newsapi.js`**

```js
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildArticlesUrl(topic, sourceIds, apiKey, now) {
  const referenceDate = now || new Date();
  const to = new Date(referenceDate);
  const from = new Date(referenceDate);
  from.setDate(from.getDate() - 7);

  const params = new URLSearchParams({
    q: topic,
    sources: sourceIds.join(','),
    from: formatDate(from),
    to: formatDate(to),
    sortBy: 'relevancy',
    pageSize: '20',
    apiKey,
  });

  return 'https://newsapi.org/v2/everything?' + params.toString();
}

function normalizeArticles(rawArticles) {
  return rawArticles.map((article) => ({
    title: article.title,
    description: article.description,
    content: article.content,
    url: article.url,
    publishedAt: article.publishedAt,
    sourceName: article.source && article.source.name,
    author: article.author,
  }));
}

const KEY_PROBLEM_CODES = new Set(['apiKeyMissing', 'apiKeyInvalid', 'apiKeyDisabled']);
const QUOTA_CODES = new Set(['apiKeyExhausted', 'rateLimited']);
const BAD_REQUEST_CODES = new Set(['parameterInvalid', 'parametersMissing', 'sourcesTooMany', 'sourceDoesNotExist']);

function mapNewsApiError(code) {
  if (KEY_PROBLEM_CODES.has(code)) {
    return { status: 401, message: "NewsAPI key is missing or invalid. Check the server's config file and restart." };
  }
  if (QUOTA_CODES.has(code)) {
    return { status: 429, message: 'Daily NewsAPI request limit reached. Try again tomorrow.' };
  }
  if (BAD_REQUEST_CODES.has(code)) {
    return { status: 500, message: "Something's wrong with the request Parallax sent to NewsAPI. Check the server logs." };
  }
  return { status: 502, message: "Couldn't reach NewsAPI. Check your internet connection and try again." };
}

module.exports = { buildArticlesUrl, normalizeArticles, mapNewsApiError };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/newsapi.test.js`
Expected: PASS — 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/newsapi.js tests/newsapi.test.js
git commit -m "feat: add NewsAPI query building, response normalization, and error mapping"
```

---

### Task 3: Static file path resolution (TDD)

**Files:**
- Create: `src/static-files.js`
- Test: `tests/static-files.test.js`

Two pure functions the server uses to turn a request URL into a safe file
path and a Content-Type header. `resolveFilePath` must reject any path that
would escape the project root (path traversal), including URL-encoded
attempts — this is a real security property, not just convenience, since the
server will read whatever file this function points it to.

- [ ] **Step 1: Write the failing tests**

```js
// tests/static-files.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveFilePath, resolveContentType } = require('../src/static-files.js');

const ROOT = path.resolve(__dirname, '..');

test('maps the root path to index.html', () => {
  assert.equal(resolveFilePath('/', ROOT), path.join(ROOT, 'index.html'));
});

test('maps a nested path to the matching file under the root', () => {
  assert.equal(resolveFilePath('/src/app.js', ROOT), path.join(ROOT, 'src', 'app.js'));
});

test('rejects path traversal attempts, raw and URL-encoded', () => {
  assert.equal(resolveFilePath('/../../../etc/passwd', ROOT), null);
  assert.equal(resolveFilePath('/..%2f..%2f..%2fetc%2fpasswd', ROOT), null);
});

test('resolves content type by file extension', () => {
  assert.equal(resolveContentType('/a/b/index.html'), 'text/html');
  assert.equal(resolveContentType('/a/b/styles.css'), 'text/css');
  assert.equal(resolveContentType('/a/b/app.js'), 'text/javascript');
  assert.equal(resolveContentType('/a/b/config.json'), 'application/json');
});

test('falls back to a generic binary content type for unknown extensions', () => {
  assert.equal(resolveContentType('/a/b/file.xyz'), 'application/octet-stream');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/static-files.test.js`
Expected: FAIL — `Cannot find module '../src/static-files.js'`

- [ ] **Step 3: Write `src/static-files.js`**

```js
const path = require('path');

function resolveFilePath(pathname, rootDir) {
  const decoded = decodeURIComponent(pathname);
  const urlPath = decoded === '/' ? '/index.html' : decoded;
  const normalizedRoot = path.resolve(rootDir);
  const candidate = path.resolve(normalizedRoot, '.' + urlPath);

  if (candidate !== normalizedRoot && !candidate.startsWith(normalizedRoot + path.sep)) {
    return null;
  }

  return candidate;
}

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
};

function resolveContentType(filePath) {
  const ext = path.extname(filePath);
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

module.exports = { resolveFilePath, resolveContentType };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/static-files.test.js`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/static-files.js tests/static-files.test.js
git commit -m "feat: add static file path resolution with path traversal protection"
```

---

### Task 4: Config file handling

**Files:**
- Create: `config.example.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write `config.example.json`**

```json
{
  "newsApiKey": "YOUR_NEWS_API_KEY_HERE"
}
```

- [ ] **Step 2: Add `config.local.json` to `.gitignore`**

Open `.gitignore` (already contains `.worktrees/` and `.superpowers/` from
Feature 1) and add a new line:

```
config.local.json
```

- [ ] **Step 3: Verify it's ignored**

Run: `git check-ignore -v config.local.json`
Expected: prints a match against the `.gitignore` line just added (exit code 0)

If nothing prints and the command exits 1, the line wasn't added correctly —
check the file was saved.

- [ ] **Step 4: Commit**

```bash
git add config.example.json .gitignore
git commit -m "feat: add config template and gitignore the real config file"
```

---

### Task 5: The server (`server.js`)

**Files:**
- Create: `server.js`

This is the HTTP server wiring: reads the local config, serves static files
via `src/static-files.js`, and proxies `/api/articles` requests via
`src/newsapi.js`. Like `src/app.js` in Feature 1, this is glue code verified
manually rather than unit tested — the logic it calls into is already covered
by Task 2 and Task 3's tests.

- [ ] **Step 1: Write `server.js`**

```js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildArticlesUrl, normalizeArticles, mapNewsApiError } = require('./src/newsapi.js');
const { resolveFilePath, resolveContentType } = require('./src/static-files.js');

const ROOT_DIR = __dirname;
const PORT = 3000;

function loadConfig() {
  const configPath = path.join(ROOT_DIR, 'config.local.json');
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.newsApiKey || typeof parsed.newsApiKey !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const config = loadConfig();
if (!config) {
  console.error('Missing config.local.json — copy config.example.json and add your NewsAPI key.');
  process.exit(1);
}

function serveStaticFile(pathname, res) {
  const filePath = resolveFilePath(pathname, ROOT_DIR);
  if (!filePath) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': resolveContentType(filePath) });
    res.end(data);
  });
}

async function handleArticlesRequest(url, res) {
  const topic = url.searchParams.get('topic');
  const sourcesParam = url.searchParams.get('sources');

  if (!topic || !sourcesParam) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to NewsAPI. Check the server logs." }));
    return;
  }

  const sourceIds = sourcesParam.split(',').filter(Boolean);
  const newsApiUrl = buildArticlesUrl(topic, sourceIds, config.newsApiKey, new Date());

  let newsApiResponse;
  try {
    newsApiResponse = await fetch(newsApiUrl);
  } catch (err) {
    console.error('Failed to reach NewsAPI:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Couldn't reach NewsAPI. Check your internet connection and try again." }));
    return;
  }

  const data = await newsApiResponse.json();

  if (data.status === 'error') {
    const mapped = mapNewsApiError(data.code);
    console.error('NewsAPI error:', data.code, data.message);
    res.writeHead(mapped.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: mapped.message }));
    return;
  }

  const articles = normalizeArticles(data.articles || []);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(articles));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/articles') {
    handleArticlesRequest(url, res).catch((err) => {
      console.error('Unexpected error handling /api/articles:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to NewsAPI. Check the server logs." }));
    });
    return;
  }

  serveStaticFile(url.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Parallax running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Verify fail-fast startup with no config**

Make sure `config.local.json` does not exist (it shouldn't, since it's
gitignored and this is a fresh worktree), then run:

Run: `node server.js`
Expected: prints `Missing config.local.json — copy config.example.json and add your NewsAPI key.` to the terminal and exits immediately (no "Parallax running" message, process does not hang)

- [ ] **Step 3: Verify startup and static file serving with a placeholder config**

Create a `config.local.json` (gitignored, this file is never committed) with:

```json
{
  "newsApiKey": "placeholder-key-for-manual-testing"
}
```

Run: `node server.js`
Expected: prints `Parallax running at http://localhost:3000` and keeps running

With the server running, open `http://localhost:3000` in a browser. Confirm
the page loads (same UI as Feature 1, now with 20 sources and "(20
available)" in the label). Confirm no 404s in the browser console for
`src/styles.css`, `src/sources.js`, `src/validation.js`, `src/pipeline.js`,
`src/app.js`.

- [ ] **Step 4: Verify the `/api/articles` error path with the placeholder key**

With the server still running, navigate to:
`http://localhost:3000/api/articles?topic=test&sources=bbc-news`

Expected: since `placeholder-key-for-manual-testing` is not a real NewsAPI
key, NewsAPI itself will reject it. Confirm the response is JSON shaped like
`{"error":"NewsAPI key is missing or invalid. Check the server's config file and restart."}`
with a `401` status (visible in the Network tab) — this confirms the whole
request → NewsAPI → error-code-mapping → response chain works end to end,
without needing a real key.

Stop the server with `Ctrl+C` when done.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: add local server for static files and NewsAPI proxying"
```

---

### Task 6: Windows launcher (`start.bat`)

**Files:**
- Create: `start.bat`

- [ ] **Step 1: Write `start.bat`**

```bat
@echo off
start http://localhost:3000
node server.js
pause
```

- [ ] **Step 2: Verify it launches the app**

With a valid or placeholder `config.local.json` present (from Task 5's Step
3), double-click `start.bat` in a file explorer (or run it from a terminal:
`start.bat`). Confirm: a browser window/tab opens to `http://localhost:3000`,
and a console window stays open showing the server's log output. Press
`Ctrl+C` in the console window, then confirm the `pause` prompt appears
("Press any key to continue . . .") before the window would close.

- [ ] **Step 3: Commit**

```bash
git add start.bat
git commit -m "feat: add Windows double-click launcher"
```

---

### Task 7: Real pipeline (TDD)

**Files:**
- Modify: `src/pipeline.js`
- Modify: `tests/pipeline.test.js`

Replaces the Feature 1 stub entirely. One real stage (fetch), no fake second
stage. Tests mock `fetch` using Node's built-in `t.mock.method` — no new
dependency.

- [ ] **Step 1: Replace `tests/pipeline.test.js` with the new tests (will fail against the current stub)**

```js
// tests/pipeline.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { runPipeline, FETCH_STAGE_LABEL } = require('../src/pipeline.js');

function mockFetchOnce(t, { ok, jsonBody }) {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok,
    json: async () => jsonBody,
  }));
}

test('calls onStageChange once with the fetch stage label', async (t) => {
  mockFetchOnce(t, { ok: true, jsonBody: [] });

  const seenStages = [];
  await runPipeline('AI regulation', ['bbc-news'], (stage) => {
    seenStages.push(stage);
  });

  assert.deepEqual(seenStages, [FETCH_STAGE_LABEL]);
});

test('resolves with topic, sources, and normalized articles on success', async (t) => {
  const articles = [{ title: 'Example', description: 'x', content: 'y', url: 'https://example.com', publishedAt: '2026-08-15T09:00:00Z', sourceName: 'BBC News', author: 'Jane Doe' }];
  mockFetchOnce(t, { ok: true, jsonBody: articles });

  const result = await runPipeline('AI regulation', ['bbc-news', 'reuters'], () => {});

  assert.deepEqual(result, { topic: 'AI regulation', sources: ['bbc-news', 'reuters'], articles });
});

test('resolves with an empty articles array when no results are found', async (t) => {
  mockFetchOnce(t, { ok: true, jsonBody: [] });

  const result = await runPipeline('very obscure topic', ['bbc-news'], () => {});

  assert.deepEqual(result.articles, []);
});

test('rejects with the server-provided error message on failure', async (t) => {
  mockFetchOnce(t, { ok: false, jsonBody: { error: 'Daily NewsAPI request limit reached. Try again tomorrow.' } });

  await assert.rejects(
    runPipeline('AI regulation', ['bbc-news'], () => {}),
    (err) => {
      assert.equal(err.message, 'Daily NewsAPI request limit reached. Try again tomorrow.');
      return true;
    }
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pipeline.test.js`
Expected: FAIL — the old `runPipeline` doesn't export `FETCH_STAGE_LABEL` and doesn't call `fetch`, so assertions on stage labels and resolved shape fail

- [ ] **Step 3: Replace `src/pipeline.js`**

```js
const FETCH_STAGE_LABEL = 'Fetching articles from selected sources…';

function runPipeline(topic, selectedSourceIds, onStageChange) {
  onStageChange(FETCH_STAGE_LABEL);

  const params = new URLSearchParams({ topic, sources: selectedSourceIds.join(',') });

  return fetch('/api/articles?' + params.toString())
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong fetching articles.');
      }
      return { topic, sources: selectedSourceIds, articles: data };
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPipeline, FETCH_STAGE_LABEL };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/pipeline.test.js`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/pipeline.js tests/pipeline.test.js
git commit -m "feat: replace stubbed pipeline with real NewsAPI fetch"
```

---

### Task 8: Update `app.js`'s submit handler messages

**Files:**
- Modify: `src/app.js`

`runPipeline` now resolves with an `articles` array instead of nothing extra,
and rejects with a specific, already-user-facing message (from Task 2's error
mapping) instead of a generic one. The completion message also branches on
whether any articles came back at all. Update the block accordingly —
everything else in the submit handler (disabling the form, logging to
console, `setFormDisabled(false)` on error) stays the same.

- [ ] **Step 1: Update the `.then()`/`.catch()` block**

Find this block in `src/app.js` (inside the `submitBtn` click handler):

```js
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
```

Replace it with:

```js
    runPipeline(topic, selectedSourceIds, (stage) => {
      progressEl.textContent = stage;
    }).then((result) => {
      if (result.articles.length === 0) {
        progressEl.textContent = 'No articles found for this topic in the selected sources over the last 7 days. Try different sources or a broader topic.';
      } else {
        progressEl.textContent = 'Fetched ' + result.articles.length + ' articles. See console for data (Claude analysis not yet implemented).';
      }
      console.log('Pipeline result:', result);
    }).catch((err) => {
      progressEl.textContent = err.message;
      setFormDisabled(false);
      console.error(err);
    });
```

- [ ] **Step 2: Verify manually in the browser**

With the server running (`node server.js`, placeholder config from Task 5 is
fine) and `http://localhost:3000` open: enter a topic, keep at least one
source checked, click Submit. Confirm the progress line shows "Fetching
articles from selected sources…" and then (since the placeholder key gets
rejected by NewsAPI) the specific message "NewsAPI key is missing or invalid.
Check the server's config file and restart." — not the old generic "Something
went wrong" text. Confirm the form re-enables itself (topic input, checkboxes,
buttons all clickable again) after the error appears.

If a real NewsAPI key is available to test with instead, also confirm the two
success branches directly: a topic/source combination that returns articles
shows the "Fetched N articles…" message, and a deliberately obscure or
nonsense topic (likely to return zero results) shows the distinct "No
articles found…" message instead of "Fetched 0 articles…".

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: show fetched-article count and specific error messages"
```

---

### Task 9: README note on the 7-day search window

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a new section**

In `README.md`, after the "## What it does" section and before "## Status",
add:

```markdown
## Search window

Parallax searches the last 7 days of articles for each topic. This is a
deliberate default, not a NewsAPI limitation — the underlying API (free tier)
actually allows searching up to a month back. 7 days was chosen to keep
results focused on the current state of a story rather than older context.
Two other free-tier constraints shape this too: articles are searchable up to
1 month old at most, and there's a 24-hour delay before an article becomes
searchable.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: explain the fixed 7-day search window"
```

---

### Task 10: Full verification pass

**Files:** none created, except `docs/roadmap.md` gets one status edit.

- [ ] **Step 1: Run the full automated test suite**

Run: `node --test`
Expected: PASS — all tests across `sources.test.js`, `validation.test.js`,
`pipeline.test.js`, `newsapi.test.js`, and `static-files.test.js` passing, 0
failures (27 tests: 4 sources + 5 validation + 4 pipeline + 9 newsapi + 5
static-files — recount against actual output and treat any mismatch as a bug
to investigate, not a number to force-match)

- [ ] **Step 2: Re-verify the full manual flow end to end**

With a placeholder (or real, if available — see Step 3) `config.local.json`
in place, double-click `start.bat`. Confirm the browser opens to
`http://localhost:3000` and the server console shows "Parallax running at
http://localhost:3000". Walk through: select sources, enter a topic, submit,
confirm the "Fetching articles from selected sources…" progress message
appears, then either a fetched-count completion message (if using a real key
that successfully returns results) or the specific NewsAPI-key-invalid error
message (if using the placeholder key) — either outcome is correct, driven by
whichever config is in place.

- [ ] **Step 3: Source ID re-verification (best effort — requires a real NewsAPI key)**

This step needs a real, working NewsAPI key in `config.local.json` — not the
placeholder from Task 5. If one is available to you in this environment,
call:

```
GET https://newsapi.org/v2/top-headlines/sources?apiKey=<the real key>
```

and cross-check every one of the 20 ids in `src/sources.js`'s `NEWS_SOURCES`
against the `id` values in that response. If any id doesn't match a source in
the live response, correct it in `src/sources.js` (update both the `id` and,
if needed, re-confirm the `name` reads naturally) and re-run
`node --test tests/sources.test.js` to confirm the 4 tests still pass, then
amend the commit from Task 1 or make a small follow-up commit — whichever is
cleaner given what else has happened since.

**If no real key is available in this environment**, do not guess or skip
silently. Report this step as incomplete in your final report (status
`DONE_WITH_CONCERNS`, not `DONE`), stating plainly that source ID
verification against a live NewsAPI response could not be performed and
remains a manual follow-up before this feature is relied on with a real key.

- [ ] **Step 4: Update roadmap status**

In `docs/roadmap.md`, change Feature 2's ("News API integration") Status from
`Next` to `In progress` in the table.

- [ ] **Step 5: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark news API integration in progress"
```
