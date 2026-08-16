# Claude API Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Feature 2's fetched articles useful — scrape each article's full text, send it to Claude for synthesis into structured facts and neutral opposing perspectives (each backed by verbatim quotes and source links), verify those quotes really appear in the source text server-side, and hand the verified result forward.

**Architecture:** A new `POST /api/analyze` endpoint on the existing `server.js` takes `{topic, articles}` from the client, caps and scrapes the article batch (`@extractus/article-extractor`, falling back to NewsAPI's snippet per-article on failure), calls Claude Sonnet 5 with a forced tool-call for reliable structured JSON (`src/claude.js`), and verifies every returned quote against the actual text sent (`src/citations.js`) before responding. Article text preparation (capping, truncation, fallback selection) lives in `src/articleText.js`. All three are pure-logic-first, network boundaries injected for testing, following this project's existing pattern from `src/newsapi.js`. `src/pipeline.js` gains a second real stage; the "Claude analysis not yet implemented" stub in `src/app.js` is replaced with real result counts.

**Tech Stack:** Vanilla HTML/CSS/JavaScript (browser) + plain Node.js (server) + one new dependency, `@extractus/article-extractor` (full-article-text extraction only — this is the project's first npm dependency, see Task 1). Tests via Node's built-in `node:test`, mocking `fetch` and the extraction function the same way `pipeline.test.js` already mocks `fetch` — no new test dependency.

---

## Before Task 1: Branch

- [ ] **Create the feature branch**

```bash
git checkout -b feature/3-claude-api-analysis
```

## File Structure

```
package.json                 # NEW — declares @extractus/article-extractor
package-lock.json            # NEW — committed, reproducible installs
node_modules/                # NEW, gitignored
src/
  articleText.js               # NEW — pure: article capping/truncation/fallback + scrape wrapper
  claude.js                    # NEW — pure: Claude request building, response parsing, error mapping + call wrapper
  citations.js                 # NEW — pure: quote/url verification against source text
  pipeline.js                  # MODIFIED — real second stage (POST /api/analyze)
  app.js                       # MODIFIED — result-count completion messages
server.js                    # MODIFIED — claudeApiKey config validation, /api/analyze endpoint
config.example.json          # MODIFIED — add claudeApiKey field
tests/
  articleText.test.js          # NEW
  claude.test.js                # NEW
  citations.test.js             # NEW
  pipeline.test.js              # MODIFIED — rewritten for the two-stage pipeline
CLAUDE.md                    # MODIFIED — Stack line records the one dependency exception
README.md                    # MODIFIED — new Setup section (npm install step)
start.bat                    # MODIFIED — runs npm install before starting the server
.gitignore                   # MODIFIED — add node_modules/
```

---

### Task 1: Add the article-extraction dependency

**Files:**
- Create: `package.json`
- Modify: `.gitignore`
- Modify: `CLAUDE.md`

This is the project's first npm dependency — a deliberate, documented exception to
the "zero npm dependencies" stack rule (see the design spec's "Stack change"
section), because reliable full-article-text extraction across arbitrarily
different news sites isn't realistic to hand-roll with built-in modules alone.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "parallax",
  "private": true,
  "version": "0.1.0",
  "description": "Gather news on any topic from multiple trusted sources and synthesize them into structured facts and opposing interpretations.",
  "dependencies": {
    "@extractus/article-extractor": "^9.0.0"
  }
}
```

- [ ] **Step 2: Add `node_modules/` to `.gitignore`**

Open `.gitignore` (currently contains `.worktrees/`, `.superpowers/`, and
`config.local.json`) and add a new line:

```
node_modules/
```

- [ ] **Step 3: Install the dependency**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json`; terminal reports
the package installed with no errors (npm's own advisory warnings, if any,
are fine — only actual install errors are a problem).

- [ ] **Step 4: Verify it's importable**

Run: `node -e "const { extract } = require('@extractus/article-extractor'); console.log(typeof extract);"`
Expected: prints `function`

- [ ] **Step 5: Update `CLAUDE.md`'s Stack line**

Find:

```markdown
**Stack:** Vanilla HTML/CSS/JavaScript on the front end; a plain Node.js server (built-in modules only, zero npm dependencies) handles API-key proxying server-side.
```

Replace with:

```markdown
**Stack:** Vanilla HTML/CSS/JavaScript on the front end; a plain Node.js server (built-in modules only, with one dependency — `@extractus/article-extractor`, used solely to extract full article text from a fetched page's HTML for Claude analysis — handles API-key proxying server-side).
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore CLAUDE.md
git commit -m "feat: add article-extractor dependency for full-text scraping"
```

---

### Task 2: Article text preparation logic (TDD)

**Files:**
- Create: `src/articleText.js`
- Test: `tests/articleText.test.js`

Pure functions for capping the article batch, resolving which text to use
per article (extracted vs. NewsAPI-snippet fallback), and truncating to a
cost-bounding length — plus one function that does the actual network
extraction, with the extraction function itself injected so tests never hit
the network.

- [ ] **Step 1: Write the failing tests**

```js
// tests/articleText.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectArticlesForAnalysis,
  truncateText,
  stripHtmlTags,
  resolveArticleText,
  prepareArticleForAnalysis,
  extractArticleText,
} = require('../src/articleText.js');

test('selects at most the given number of articles, preserving order', () => {
  const articles = [{ url: 'a' }, { url: 'b' }, { url: 'c' }];
  assert.deepEqual(selectArticlesForAnalysis(articles, 2), [{ url: 'a' }, { url: 'b' }]);
});

test('returns all articles when fewer than the cap', () => {
  const articles = [{ url: 'a' }];
  assert.deepEqual(selectArticlesForAnalysis(articles, 25), [{ url: 'a' }]);
});

test('truncates text longer than the cap', () => {
  assert.equal(truncateText('abcdefghij', 5), 'abcde');
});

test('leaves text at or under the cap unchanged', () => {
  assert.equal(truncateText('abc', 5), 'abc');
});

test('strips tags, script/style blocks, and decodes common entities', () => {
  const html = '<p>Hello &amp; welcome</p><script>evil()</script><style>.x{}</style><p>Second &quot;part&quot;</p>';
  assert.equal(stripHtmlTags(html), 'Hello & welcome Second "part"');
});

test('resolveArticleText uses extracted text when it meets the threshold', () => {
  const article = { description: 'short desc', content: 'short content [+50 chars]' };
  const result = resolveArticleText(article, 'a'.repeat(600), 500);
  assert.equal(result.text, 'a'.repeat(600));
  assert.equal(result.usedFallback, false);
});

test('resolveArticleText falls back to description+content when extraction is thin', () => {
  const article = { description: 'A short description.', content: 'A short snippet [+50 chars]' };
  const result = resolveArticleText(article, 'too short', 500);
  assert.equal(result.text, 'A short description. A short snippet [+50 chars]');
  assert.equal(result.usedFallback, true);
});

test('resolveArticleText falls back cleanly when extraction is empty', () => {
  const article = { description: 'Desc only.', content: null };
  const result = resolveArticleText(article, '', 500);
  assert.equal(result.text, 'Desc only.');
  assert.equal(result.usedFallback, true);
});

test('prepareArticleForAnalysis combines resolution and truncation with source metadata', () => {
  const article = { url: 'https://example.com/a', sourceName: 'Example News', title: 'A title', description: 'Desc.', content: 'Snippet [+10 chars]' };
  const result = prepareArticleForAnalysis(article, 'a'.repeat(20), { fallbackThreshold: 10, maxCharsPerArticle: 15 });
  assert.equal(result.url, 'https://example.com/a');
  assert.equal(result.sourceName, 'Example News');
  assert.equal(result.title, 'A title');
  assert.equal(result.text, 'a'.repeat(15));
  assert.equal(result.usedFallback, false);
});

test('extractArticleText returns stripped text when the extractor succeeds', async () => {
  const fakeExtract = async () => ({ content: '<p>Real article text.</p>' });
  const result = await extractArticleText('https://example.com/a', fakeExtract, 8000);
  assert.equal(result, 'Real article text.');
});

test('extractArticleText returns an empty string when the extractor finds nothing', async () => {
  const fakeExtract = async () => null;
  const result = await extractArticleText('https://example.com/a', fakeExtract, 8000);
  assert.equal(result, '');
});

test('extractArticleText returns an empty string when the extractor throws', async () => {
  const fakeExtract = async () => { throw new Error('network error'); };
  const result = await extractArticleText('https://example.com/a', fakeExtract, 8000);
  assert.equal(result, '');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/articleText.test.js`
Expected: FAIL — `Cannot find module '../src/articleText.js'`

- [ ] **Step 3: Write `src/articleText.js`**

```js
function selectArticlesForAnalysis(articles, maxArticles) {
  return articles.slice(0, maxArticles);
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars);
}

const ENTITY_REPLACEMENTS = [
  [/&nbsp;/g, ' '],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&amp;/g, '&'],
];

// Strips tags from HTML that @extractus/article-extractor has already
// isolated to a single article's body — a much narrower, lower-risk problem
// than parsing an arbitrary full page, so a straightforward regex pass is
// appropriate here (see the design spec for why full-page parsing itself
// uses the dependency instead of being hand-rolled).
function stripHtmlTags(html) {
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  for (const [pattern, replacement] of ENTITY_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s+/g, ' ').trim();
}

function resolveArticleText(article, extractedText, fallbackThreshold) {
  if (extractedText && extractedText.length >= fallbackThreshold) {
    return { text: extractedText, usedFallback: false };
  }
  const fallbackText = [article.description, article.content].filter(Boolean).join(' ').trim();
  return { text: fallbackText, usedFallback: true };
}

function prepareArticleForAnalysis(article, extractedText, { fallbackThreshold, maxCharsPerArticle }) {
  const { text, usedFallback } = resolveArticleText(article, extractedText, fallbackThreshold);
  return {
    url: article.url,
    sourceName: article.sourceName,
    title: article.title,
    text: truncateText(text, maxCharsPerArticle),
    usedFallback,
  };
}

// extractFn is injected (production: @extractus/article-extractor's `extract`)
// so this stays testable without real network calls. Never throws — any
// failure (timeout, network error, no content found) resolves to an empty
// string, which resolveArticleText treats as "fall back to the NewsAPI
// snippet" rather than failing the whole article.
async function extractArticleText(url, extractFn, timeoutMs) {
  try {
    const timeoutFetcher = (fetchUrl) => fetch(fetchUrl, { signal: AbortSignal.timeout(timeoutMs) });
    const article = await extractFn(url, {}, timeoutFetcher);
    if (!article || !article.content) {
      return '';
    }
    return stripHtmlTags(article.content);
  } catch {
    return '';
  }
}

module.exports = {
  selectArticlesForAnalysis,
  truncateText,
  stripHtmlTags,
  resolveArticleText,
  prepareArticleForAnalysis,
  extractArticleText,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/articleText.test.js`
Expected: PASS — 12 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/articleText.js tests/articleText.test.js
git commit -m "feat: add article text preparation (capping, truncation, scrape fallback)"
```

---

### Task 3: Claude request/response/error logic (TDD)

**Files:**
- Create: `src/claude.js`
- Test: `tests/claude.test.js`

Pure functions for building the Anthropic Messages API request (forced
tool-call for reliable structured output), parsing and schema-validating the
response, and mapping error statuses — plus one function that does the
actual API call, with `fetch` injected for testing.

- [ ] **Step 1: Write the failing tests**

```js
// tests/claude.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ANALYSIS_TOOL_NAME,
  buildAnalysisRequest,
  parseAnalysisResponse,
  mapClaudeError,
  callClaudeAnalysis,
} = require('../src/claude.js');

test('builds a request with the given model, topic, and article text', () => {
  const articles = [
    { url: 'https://example.com/a', sourceName: 'Example News', text: 'Article A text.' },
    { url: 'https://example.com/b', sourceName: 'Other News', text: 'Article B text.' },
  ];
  const request = buildAnalysisRequest('AI regulation', articles, 'claude-sonnet-5');

  assert.equal(request.model, 'claude-sonnet-5');
  assert.equal(request.tool_choice.type, 'tool');
  assert.equal(request.tool_choice.name, ANALYSIS_TOOL_NAME);
  assert.equal(request.tools.length, 1);
  assert.equal(request.tools[0].name, ANALYSIS_TOOL_NAME);
  assert.match(request.messages[0].content, /AI regulation/);
  assert.match(request.messages[0].content, /Example News/);
  assert.match(request.messages[0].content, /https:\/\/example\.com\/a/);
  assert.match(request.messages[0].content, /Article A text\./);
  assert.match(request.messages[0].content, /Other News/);
});

test('parses a valid tool_use response into facts and perspectives', () => {
  const responseBody = {
    content: [
      { type: 'text', text: 'ignored' },
      {
        type: 'tool_use',
        name: ANALYSIS_TOOL_NAME,
        input: {
          facts: [{ statement: 'X happened', citations: [{ quote: 'X happened yesterday', sourceName: 'Example News', url: 'https://example.com/a' }] }],
          perspectives: [{ label: 'Concern about cost', summary: 'Some see it as costly.', citations: [{ quote: 'this will cost too much', sourceName: 'Other News', url: 'https://example.com/b' }] }],
        },
      },
    ],
  };

  const result = parseAnalysisResponse(responseBody);

  assert.equal(result.facts.length, 1);
  assert.equal(result.perspectives.length, 1);
  assert.equal(result.facts[0].statement, 'X happened');
});

test('returns null when there is no matching tool_use block', () => {
  const result = parseAnalysisResponse({ content: [{ type: 'text', text: 'no tool call' }] });
  assert.equal(result, null);
});

test('returns null when a fact is missing citations', () => {
  const responseBody = {
    content: [{ type: 'tool_use', name: ANALYSIS_TOOL_NAME, input: { facts: [{ statement: 'X', citations: [] }], perspectives: [] } }],
  };
  assert.equal(parseAnalysisResponse(responseBody), null);
});

test('returns null when a citation is missing a required field', () => {
  const responseBody = {
    content: [{ type: 'tool_use', name: ANALYSIS_TOOL_NAME, input: { facts: [{ statement: 'X', citations: [{ quote: 'q', sourceName: 'S' }] }], perspectives: [] } }],
  };
  assert.equal(parseAnalysisResponse(responseBody), null);
});

test('maps a 401 status to a key-problem message', () => {
  const result = mapClaudeError(401, { error: { type: 'authentication_error' } });
  assert.equal(result.status, 401);
  assert.match(result.message, /key is missing or invalid/);
});

test('maps a 429 status to a rate-limit message', () => {
  const result = mapClaudeError(429, { error: { type: 'rate_limit_error' } });
  assert.equal(result.status, 429);
  assert.match(result.message, /rate limit reached/);
});

test('maps other statuses to a generic connection message', () => {
  const result = mapClaudeError(500, { error: { type: 'api_error' } });
  assert.equal(result.status, 502);
  assert.match(result.message, /Couldn't reach the Claude API/);
});

test('callClaudeAnalysis returns a parsed result on success', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{
        type: 'tool_use',
        name: ANALYSIS_TOOL_NAME,
        input: { facts: [], perspectives: [] },
      }],
    }),
  });

  const result = await callClaudeAnalysis('AI regulation', [], 'test-key', 'claude-sonnet-5', fakeFetch);
  assert.deepEqual(result, { result: { facts: [], perspectives: [] } });
});

test('callClaudeAnalysis returns a mapped error on a non-ok response', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { type: 'authentication_error' } }),
  });

  const result = await callClaudeAnalysis('AI regulation', [], 'bad-key', 'claude-sonnet-5', fakeFetch);
  assert.equal(result.error.status, 401);
});

test('callClaudeAnalysis returns a 500 error when the tool response fails schema validation', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text: 'no tool call' }] }),
  });

  const result = await callClaudeAnalysis('AI regulation', [], 'test-key', 'claude-sonnet-5', fakeFetch);
  assert.equal(result.error.status, 500);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/claude.test.js`
Expected: FAIL — `Cannot find module '../src/claude.js'`

- [ ] **Step 3: Write `src/claude.js`**

```js
const ANALYSIS_TOOL_NAME = 'return_analysis';

const CITATION_SCHEMA = {
  type: 'object',
  properties: {
    quote: { type: 'string' },
    sourceName: { type: 'string' },
    url: { type: 'string' },
  },
  required: ['quote', 'sourceName', 'url'],
};

const ANALYSIS_TOOL_SCHEMA = {
  name: ANALYSIS_TOOL_NAME,
  description: 'Return the structured facts and opposing perspectives found in the given articles.',
  input_schema: {
    type: 'object',
    properties: {
      facts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            statement: { type: 'string' },
            citations: { type: 'array', minItems: 1, items: CITATION_SCHEMA },
          },
          required: ['statement', 'citations'],
        },
      },
      perspectives: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            summary: { type: 'string' },
            citations: { type: 'array', minItems: 1, items: CITATION_SCHEMA },
          },
          required: ['label', 'summary', 'citations'],
        },
      },
    },
    required: ['facts', 'perspectives'],
  },
};

const SYSTEM_PROMPT = `You are analyzing news articles about a topic to help a reader quickly understand multiple perspectives on it.

Given a topic and a numbered list of articles (each with a source name, URL, and text), do two things:

1. Identify the key facts reported across the articles. For each fact, write a short statement in your own words, and back it with one or more citations.
2. Identify the distinct interpretations or opinions expressed about the topic, grouped into however many genuinely distinct perspectives exist in the given articles (do not force a fixed number, and do not invent a perspective with no support in the text). For each perspective, write a short neutral label describing the substantive position (never a political party or ideological label such as Republican, Democrat, Conservative, or Liberal), a brief summary, and one or more citations.

Rules for citations, followed exactly:
- Every "quote" must be copied verbatim, character-for-character, from the article text you were given for that source. Never paraphrase, combine, or extend a quote beyond what appears in the text.
- Every "url" must be copied exactly from the article list you were given. Never invent or alter a URL.
- Every fact and every perspective must have at least one citation.

Call the return_analysis tool with your findings. Do not respond in any other format.`;

function buildAnalysisRequest(topic, preparedArticles, model) {
  const articlesBlock = preparedArticles
    .map((article, index) => `Article ${index + 1}\nSource: ${article.sourceName}\nURL: ${article.url}\nText: ${article.text}`)
    .join('\n\n');

  return {
    model,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: `Topic: ${topic}\n\n${articlesBlock}` },
    ],
    tools: [ANALYSIS_TOOL_SCHEMA],
    tool_choice: { type: 'tool', name: ANALYSIS_TOOL_NAME },
  };
}

function isValidCitation(citation) {
  return Boolean(citation)
    && typeof citation.quote === 'string'
    && typeof citation.sourceName === 'string'
    && typeof citation.url === 'string';
}

function isValidFact(fact) {
  return Boolean(fact)
    && typeof fact.statement === 'string'
    && Array.isArray(fact.citations)
    && fact.citations.length > 0
    && fact.citations.every(isValidCitation);
}

function isValidPerspective(perspective) {
  return Boolean(perspective)
    && typeof perspective.label === 'string'
    && typeof perspective.summary === 'string'
    && Array.isArray(perspective.citations)
    && perspective.citations.length > 0
    && perspective.citations.every(isValidCitation);
}

function parseAnalysisResponse(responseBody) {
  const toolUseBlock = (responseBody.content || []).find(
    (block) => block.type === 'tool_use' && block.name === ANALYSIS_TOOL_NAME
  );
  if (!toolUseBlock || !toolUseBlock.input) {
    return null;
  }

  const { facts, perspectives } = toolUseBlock.input;
  if (!Array.isArray(facts) || !Array.isArray(perspectives)) {
    return null;
  }
  if (!facts.every(isValidFact) || !perspectives.every(isValidPerspective)) {
    return null;
  }

  return { facts, perspectives };
}

function mapClaudeError(status, body) {
  const type = body && body.error && body.error.type;
  if (status === 401 || type === 'authentication_error') {
    return { status: 401, message: "Claude API key is missing or invalid. Check the server's config file and restart." };
  }
  if (status === 429 || type === 'rate_limit_error') {
    return { status: 429, message: 'Claude API rate limit reached. Try again in a moment.' };
  }
  return { status: 502, message: "Couldn't reach the Claude API. Check your internet connection and try again." };
}

async function callClaudeAnalysis(topic, preparedArticles, apiKey, model, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const requestBody = buildAnalysisRequest(topic, preparedArticles, model);

  const response = await doFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok) {
    return { error: mapClaudeError(response.status, data) };
  }

  const parsed = parseAnalysisResponse(data);
  if (!parsed) {
    return { error: { status: 500, message: 'Something went wrong analyzing the articles. Check the server logs.' } };
  }

  return { result: parsed };
}

module.exports = {
  ANALYSIS_TOOL_NAME,
  buildAnalysisRequest,
  parseAnalysisResponse,
  mapClaudeError,
  callClaudeAnalysis,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/claude.test.js`
Expected: PASS — 11 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/claude.js tests/claude.test.js
git commit -m "feat: add Claude analysis request building, response parsing, and error mapping"
```

---

### Task 4: Citation verification (TDD)

**Files:**
- Create: `src/citations.js`
- Test: `tests/citations.test.js`

The hallucination backstop: for every citation Claude returns, confirm its
`url` was actually one of the articles sent, and its `quote` is a real,
verbatim substring of that article's text. This is enforced in code, not
left to the prompt.

- [ ] **Step 1: Write the failing tests**

```js
// tests/citations.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeForMatch,
  quoteAppearsIn,
  verifyCitation,
  filterVerifiedItems,
  verifyAnalysis,
} = require('../src/citations.js');

test('normalizeForMatch collapses whitespace and straightens curly quotes/dashes', () => {
  const input = '“Costs   will  rise,”\nofficials said — repeatedly.';
  assert.equal(normalizeForMatch(input), '"Costs will rise," officials said - repeatedly.');
});

test('quoteAppearsIn matches an exact substring', () => {
  assert.equal(quoteAppearsIn('costs will rise', 'Officials warned that costs will rise next year.'), true);
});

test('quoteAppearsIn matches despite curly-quote and whitespace differences', () => {
  assert.equal(quoteAppearsIn('“costs will rise”', 'He said "costs will   rise" yesterday.'), true);
});

test('quoteAppearsIn returns false when the quote is not a real substring', () => {
  assert.equal(quoteAppearsIn('costs will fall', 'Officials warned that costs will rise next year.'), false);
});

test('verifyCitation fails when the url is not in the known article set', () => {
  const result = verifyCitation(
    { quote: 'anything', url: 'https://unknown.example.com/x' },
    { 'https://example.com/a': 'anything is here' }
  );
  assert.equal(result, false);
});

test('verifyCitation passes when the url is known and the quote matches', () => {
  const result = verifyCitation(
    { quote: 'anything', url: 'https://example.com/a' },
    { 'https://example.com/a': 'This says anything is here.' }
  );
  assert.equal(result, true);
});

test('filterVerifiedItems drops individual citations that fail verification', () => {
  const items = [{
    statement: 'X',
    citations: [
      { quote: 'real quote', url: 'https://example.com/a' },
      { quote: 'fake quote', url: 'https://example.com/a' },
    ],
  }];
  const result = filterVerifiedItems(items, { 'https://example.com/a': 'This has the real quote in it.' });
  assert.equal(result.length, 1);
  assert.equal(result[0].citations.length, 1);
  assert.equal(result[0].citations[0].quote, 'real quote');
});

test('filterVerifiedItems drops an item entirely when no citations survive', () => {
  const items = [{ statement: 'X', citations: [{ quote: 'fake quote', url: 'https://example.com/a' }] }];
  const result = filterVerifiedItems(items, { 'https://example.com/a': 'Nothing matches here.' });
  assert.equal(result.length, 0);
});

test('verifyAnalysis verifies facts and perspectives against prepared article text', () => {
  const analysis = {
    facts: [{ statement: 'X', citations: [{ quote: 'real quote', url: 'https://example.com/a' }] }],
    perspectives: [{ label: 'L', summary: 'S', citations: [{ quote: 'not present', url: 'https://example.com/a' }] }],
  };
  const preparedArticles = [{ url: 'https://example.com/a', text: 'This has the real quote in it.' }];

  const result = verifyAnalysis(analysis, preparedArticles);

  assert.equal(result.facts.length, 1);
  assert.equal(result.perspectives.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/citations.test.js`
Expected: FAIL — `Cannot find module '../src/citations.js'`

- [ ] **Step 3: Write `src/citations.js`**

```js
function normalizeForMatch(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function quoteAppearsIn(quote, sourceText) {
  if (!quote || !sourceText) {
    return false;
  }
  return normalizeForMatch(sourceText).includes(normalizeForMatch(quote));
}

function verifyCitation(citation, articleTextByUrl) {
  const sourceText = articleTextByUrl[citation.url];
  if (sourceText === undefined) {
    return false;
  }
  return quoteAppearsIn(citation.quote, sourceText);
}

function filterVerifiedItems(items, articleTextByUrl) {
  return items
    .map((item) => ({
      ...item,
      citations: item.citations.filter((citation) => verifyCitation(citation, articleTextByUrl)),
    }))
    .filter((item) => item.citations.length > 0);
}

function buildArticleTextByUrl(preparedArticles) {
  const map = {};
  preparedArticles.forEach((article) => {
    map[article.url] = article.text;
  });
  return map;
}

function verifyAnalysis(analysis, preparedArticles) {
  const articleTextByUrl = buildArticleTextByUrl(preparedArticles);
  return {
    facts: filterVerifiedItems(analysis.facts, articleTextByUrl),
    perspectives: filterVerifiedItems(analysis.perspectives, articleTextByUrl),
  };
}

module.exports = {
  normalizeForMatch,
  quoteAppearsIn,
  verifyCitation,
  filterVerifiedItems,
  verifyAnalysis,
  buildArticleTextByUrl,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/citations.test.js`
Expected: PASS — 9 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/citations.js tests/citations.test.js
git commit -m "feat: add citation verification against source article text"
```

---

### Task 5: Add `claudeApiKey` to config

**Files:**
- Modify: `config.example.json`
- Modify: `server.js` (`loadConfig` and the startup fail-fast message only)

- [ ] **Step 1: Update `config.example.json`**

```json
{
  "newsApiKey": "YOUR_NEWS_API_KEY_HERE",
  "claudeApiKey": "YOUR_CLAUDE_API_KEY_HERE"
}
```

- [ ] **Step 2: Update `loadConfig` in `server.js`**

Find:

```js
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
```

Replace with:

```js
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.newsApiKey || typeof parsed.newsApiKey !== 'string') {
      return null;
    }
    if (!parsed.claudeApiKey || typeof parsed.claudeApiKey !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Update the fail-fast startup message**

Find:

```js
const config = loadConfig();
if (!config) {
  console.error('Missing config.local.json — copy config.example.json and add your NewsAPI key.');
  process.exit(1);
}
```

Replace with:

```js
const config = loadConfig();
if (!config) {
  console.error('Missing config.local.json — copy config.example.json and add your NewsAPI key and Claude API key.');
  process.exit(1);
}
```

- [ ] **Step 4: Update the local `config.local.json` used for manual testing**

`config.local.json` is gitignored and never committed. If one already exists
in this worktree from earlier manual testing, add a `claudeApiKey` field to
it — a placeholder value is fine (e.g. `"placeholder-key-for-manual-testing"`)
unless a real Anthropic key is available in this environment. If the file
doesn't exist yet, create it with both fields:

```json
{
  "newsApiKey": "placeholder-key-for-manual-testing",
  "claudeApiKey": "placeholder-key-for-manual-testing"
}
```

- [ ] **Step 5: Verify fail-fast behavior**

Temporarily remove the `claudeApiKey` line from `config.local.json`, then run:

Run: `node server.js`
Expected: prints the updated missing-config message and exits immediately

Restore the `claudeApiKey` line afterward before continuing.

- [ ] **Step 6: Commit**

```bash
git add config.example.json server.js
git commit -m "feat: require a Claude API key in server config"
```

---

### Task 6: The `/api/analyze` endpoint

**Files:**
- Modify: `server.js`

Wires together article capping, scraping, the Claude call, and citation
verification into one endpoint. This is glue code verified manually — the
logic it calls into is already covered by Tasks 2–4's tests.

- [ ] **Step 1: Add the new requires**

Find:

```js
const { buildArticlesUrl, normalizeArticles, mapNewsApiError, compileBalancedArticles } = require('./src/newsapi.js');
const { resolveFilePath, resolveContentType } = require('./src/static-files.js');
```

Replace with:

```js
const { extract } = require('@extractus/article-extractor');
const { buildArticlesUrl, normalizeArticles, mapNewsApiError, compileBalancedArticles } = require('./src/newsapi.js');
const { resolveFilePath, resolveContentType } = require('./src/static-files.js');
const { selectArticlesForAnalysis, prepareArticleForAnalysis, extractArticleText } = require('./src/articleText.js');
const { callClaudeAnalysis } = require('./src/claude.js');
const { verifyAnalysis } = require('./src/citations.js');
```

- [ ] **Step 2: Add the analyze pipeline's constants**

Find:

```js
const RELEVANCY_CAP_PER_SOURCE = 3;
const FINAL_CAP_PER_SOURCE = 5;
```

Replace with:

```js
const RELEVANCY_CAP_PER_SOURCE = 3;
const FINAL_CAP_PER_SOURCE = 5;

// Bounds for the /api/analyze pipeline. Tuned for cost/latency control: real
// searches rarely return anywhere near the theoretical max article count
// (see the caps above), so this rarely binds, but every search scrapes N
// URLs and sends their text to a paid API, so an explicit ceiling matters.
const MAX_ARTICLES_TO_ANALYZE = 25;
const ARTICLE_TEXT_CHAR_CAP = 8000;
const FALLBACK_TEXT_THRESHOLD = 500;
const SCRAPE_TIMEOUT_MS = 8000;
const CLAUDE_MODEL = 'claude-sonnet-5';
```

- [ ] **Step 3: Add a request-body reader**

Existing endpoints are GET-only, so there's no request-body parsing yet.
Find:

```js
function serveStaticFile(pathname, res) {
```

Insert immediately before it:

```js
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveStaticFile(pathname, res) {
```

- [ ] **Step 4: Add `handleAnalyzeRequest`**

Find:

```js
const server = http.createServer((req, res) => {
```

Insert immediately before it:

```js
async function handleAnalyzeRequest(req, res) {
  let body;
  try {
    const raw = await readRequestBody(req);
    body = JSON.parse(raw);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to analyze. Check the server logs." }));
    return;
  }

  const { topic, articles } = body;
  if (!topic || !Array.isArray(articles)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to analyze. Check the server logs." }));
    return;
  }

  const selectedArticles = selectArticlesForAnalysis(articles, MAX_ARTICLES_TO_ANALYZE);

  const extractedTexts = await Promise.all(
    selectedArticles.map((article) => extractArticleText(article.url, extract, SCRAPE_TIMEOUT_MS))
  );

  const preparedArticles = selectedArticles.map((article, index) =>
    prepareArticleForAnalysis(article, extractedTexts[index], {
      fallbackThreshold: FALLBACK_TEXT_THRESHOLD,
      maxCharsPerArticle: ARTICLE_TEXT_CHAR_CAP,
    })
  );

  let claudeResult;
  try {
    claudeResult = await callClaudeAnalysis(topic, preparedArticles, config.claudeApiKey, CLAUDE_MODEL);
  } catch (err) {
    console.error('Failed to reach the Claude API:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Couldn't reach the Claude API. Check your internet connection and try again." }));
    return;
  }

  if (claudeResult.error) {
    res.writeHead(claudeResult.error.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: claudeResult.error.message }));
    return;
  }

  const verified = verifyAnalysis(claudeResult.result, preparedArticles);
  const droppedFacts = claudeResult.result.facts.length - verified.facts.length;
  const droppedPerspectives = claudeResult.result.perspectives.length - verified.perspectives.length;
  if (droppedFacts > 0 || droppedPerspectives > 0) {
    console.error(`Citation verification dropped ${droppedFacts} fact(s) and ${droppedPerspectives} perspective(s) that failed verification.`);
  }

  const articlesUsingFallbackText = preparedArticles.filter((article) => article.usedFallback).length;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    topic,
    facts: verified.facts,
    perspectives: verified.perspectives,
    articlesAnalyzed: preparedArticles.length,
    articlesUsingFallbackText,
  }));
}

const server = http.createServer((req, res) => {
```

- [ ] **Step 5: Wire the route**

Find:

```js
  if (url.pathname === '/api/articles') {
    handleArticlesRequest(url, res).catch((err) => {
      console.error('Unexpected error handling /api/articles:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to NewsAPI. Check the server logs." }));
    });
    return;
  }

  serveStaticFile(url.pathname, res);
```

Replace with:

```js
  if (url.pathname === '/api/articles') {
    handleArticlesRequest(url, res).catch((err) => {
      console.error('Unexpected error handling /api/articles:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to NewsAPI. Check the server logs." }));
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    handleAnalyzeRequest(req, res).catch((err) => {
      console.error('Unexpected error handling /api/analyze:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Something went wrong analyzing the articles. Check the server logs.' }));
    });
    return;
  }

  serveStaticFile(url.pathname, res);
```

- [ ] **Step 6: Verify the error path end-to-end without a real key**

With the placeholder `config.local.json` from Task 5 in place, run:
`node server.js`

In a second terminal, run:

```bash
curl -s -i -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"topic\":\"test\",\"articles\":[{\"url\":\"https://example.com/\",\"sourceName\":\"Example\",\"title\":\"T\",\"description\":\"D\",\"content\":\"C [+5 chars]\"}]}"
```

Expected: the request scrapes `https://example.com/` (a minimal, real test
page — extraction will likely be thin, falling back to the given
description/content, which is fine and expected here), then calls the Claude
API with the placeholder key and gets rejected. Response is JSON shaped like
`{"error":"Claude API key is missing or invalid. Check the server's config file and restart."}`
with a `401` status — confirming the whole request → scrape → Claude →
error-mapping → response chain works end to end without needing a real key.

Stop the server with `Ctrl+C` when done.

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "feat: add /api/analyze endpoint wiring scrape, Claude, and verification together"
```

---

### Task 7: Real pipeline (TDD)

**Files:**
- Modify: `src/pipeline.js`
- Modify: `tests/pipeline.test.js`

Adds the second real stage. When the first stage returns zero articles, the
analyze call is skipped entirely — there's nothing to analyze.

- [ ] **Step 1: Replace `tests/pipeline.test.js` with the new tests (will fail against the current single-stage pipeline)**

```js
// tests/pipeline.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { runPipeline, FETCH_STAGE_LABEL, ANALYZE_STAGE_LABEL } = require('../src/pipeline.js');

function mockFetchSequence(t, responses) {
  let call = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    const response = responses[call];
    call += 1;
    return { ok: response.ok, json: async () => response.jsonBody };
  });
}

test('calls onStageChange with fetch then analyze stage labels when articles are found', async (t) => {
  mockFetchSequence(t, [
    { ok: true, jsonBody: [{ title: 'A', url: 'https://example.com/a', sourceName: 'Example', description: 'd', content: 'c', publishedAt: '2026-08-15T00:00:00Z', author: null }] },
    { ok: true, jsonBody: { topic: 'AI regulation', facts: [], perspectives: [], articlesAnalyzed: 1, articlesUsingFallbackText: 0 } },
  ]);

  const seenStages = [];
  await runPipeline('AI regulation', ['bbc-news'], (stage) => {
    seenStages.push(stage);
  });

  assert.deepEqual(seenStages, [FETCH_STAGE_LABEL, ANALYZE_STAGE_LABEL]);
});

test('skips the analyze stage entirely when no articles are found', async (t) => {
  mockFetchSequence(t, [{ ok: true, jsonBody: [] }]);

  const seenStages = [];
  const result = await runPipeline('very obscure topic', ['bbc-news'], (stage) => {
    seenStages.push(stage);
  });

  assert.deepEqual(seenStages, [FETCH_STAGE_LABEL]);
  assert.deepEqual(result.articles, []);
  assert.equal(result.analysis, null);
});

test('resolves with topic, sources, articles, and analysis on success', async (t) => {
  const articles = [{ title: 'A', url: 'https://example.com/a', sourceName: 'Example', description: 'd', content: 'c', publishedAt: '2026-08-15T00:00:00Z', author: null }];
  const analysis = { topic: 'AI regulation', facts: [{ statement: 'X', citations: [] }], perspectives: [], articlesAnalyzed: 1, articlesUsingFallbackText: 0 };
  mockFetchSequence(t, [
    { ok: true, jsonBody: articles },
    { ok: true, jsonBody: analysis },
  ]);

  const result = await runPipeline('AI regulation', ['bbc-news'], () => {});

  assert.deepEqual(result, { topic: 'AI regulation', sources: ['bbc-news'], articles, analysis });
});

test('rejects with the server-provided error message when the articles fetch fails', async (t) => {
  mockFetchSequence(t, [{ ok: false, jsonBody: { error: 'Daily NewsAPI request limit reached. Try again tomorrow.' } }]);

  await assert.rejects(
    runPipeline('AI regulation', ['bbc-news'], () => {}),
    (err) => {
      assert.equal(err.message, 'Daily NewsAPI request limit reached. Try again tomorrow.');
      return true;
    }
  );
});

test('rejects with the server-provided error message when the analyze call fails', async (t) => {
  mockFetchSequence(t, [
    { ok: true, jsonBody: [{ title: 'A', url: 'https://example.com/a', sourceName: 'Example', description: 'd', content: 'c', publishedAt: '2026-08-15T00:00:00Z', author: null }] },
    { ok: false, jsonBody: { error: 'Claude API rate limit reached. Try again in a moment.' } },
  ]);

  await assert.rejects(
    runPipeline('AI regulation', ['bbc-news'], () => {}),
    (err) => {
      assert.equal(err.message, 'Claude API rate limit reached. Try again in a moment.');
      return true;
    }
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/pipeline.test.js`
Expected: FAIL — the current `runPipeline` doesn't export `ANALYZE_STAGE_LABEL`
and never calls `/api/analyze`, so the stage-sequence and result-shape
assertions fail

- [ ] **Step 3: Replace `src/pipeline.js`**

```js
const FETCH_STAGE_LABEL = 'Fetching articles from selected sources…';
const ANALYZE_STAGE_LABEL = 'Analyzing articles…';

function runPipeline(topic, selectedSourceIds, onStageChange) {
  onStageChange(FETCH_STAGE_LABEL);

  const params = new URLSearchParams({ topic, sources: selectedSourceIds.join(',') });

  return fetch('/api/articles?' + params.toString())
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong fetching articles.');
      }

      if (data.length === 0) {
        return { topic, sources: selectedSourceIds, articles: data, analysis: null };
      }

      onStageChange(ANALYZE_STAGE_LABEL);

      return fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, articles: data }),
      })
        .then((analyzeResponse) => analyzeResponse.json().then((analyzeData) => ({ analyzeResponse, analyzeData })))
        .then(({ analyzeResponse, analyzeData }) => {
          if (!analyzeResponse.ok) {
            throw new Error(analyzeData.error || 'Something went wrong analyzing articles.');
          }
          return { topic, sources: selectedSourceIds, articles: data, analysis: analyzeData };
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPipeline, FETCH_STAGE_LABEL, ANALYZE_STAGE_LABEL };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/pipeline.test.js`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/pipeline.js tests/pipeline.test.js
git commit -m "feat: add real Claude analysis stage to the pipeline"
```

---

### Task 8: Update `app.js`'s submit handler messages

**Files:**
- Modify: `src/app.js`

`runPipeline` now resolves with an `analysis` field (or `null` when there
were no articles to analyze). The completion message branches on three
outcomes instead of two.

- [ ] **Step 1: Update the `.then()` block**

Find this block in `src/app.js` (inside the `submitBtn` click handler):

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

Replace it with:

```js
    runPipeline(topic, selectedSourceIds, (stage) => {
      progressEl.textContent = stage;
    }).then((result) => {
      if (result.articles.length === 0) {
        progressEl.textContent = 'No articles found for this topic in the selected sources over the last 7 days. Try different sources or a broader topic.';
      } else if (result.analysis.facts.length === 0 && result.analysis.perspectives.length === 0) {
        progressEl.textContent = "Claude couldn't produce verifiable results for this topic. See console for data.";
      } else {
        progressEl.textContent = 'Analyzed ' + result.analysis.articlesAnalyzed + ' articles — found ' +
          result.analysis.facts.length + ' facts and ' + result.analysis.perspectives.length +
          ' perspectives. See console for full data (results display not yet implemented).';
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
articles from selected sources…", then (assuming articles come back)
"Analyzing articles…", then — since the placeholder Claude key gets
rejected — the specific message "Claude API key is missing or invalid.
Check the server's config file and restart." Confirm the form re-enables
itself (topic input, checkboxes, buttons all clickable again) after the
error appears.

If a real NewsAPI key and a real Claude key are both available to test with
instead, also confirm the two success branches directly: a topic/source
combination that produces verifiable facts/perspectives shows the "Analyzed
N articles…" message, and (if reproducible) a case where verification
strips everything shows the distinct "couldn't produce verifiable results"
message instead.

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "feat: show analysis result counts and specific error messages"
```

---

### Task 9: Update `start.bat` and `README.md`

**Files:**
- Modify: `start.bat`
- Modify: `README.md`

- [ ] **Step 1: Update `start.bat` to install dependencies before starting**

Find:

```bat
@echo off
start http://localhost:3000
node server.js
pause
```

Replace with:

```bat
@echo off
call npm install
start http://localhost:3000
node server.js
pause
```

- [ ] **Step 2: Add a Setup section to `README.md`**

Find:

```markdown
## What it does

Parallax lets you search for any news topic and select which sources to trust. It fetches recent articles on that topic, sends them to Claude for synthesis, and returns a structured breakdown: key facts with supporting quotes and sources, plus the distinct perspectives different outlets are taking on those facts. Every claim is traceable back to the original article, so you can verify before forming an opinion.

## Search & source balancing
```

Replace with:

```markdown
## What it does

Parallax lets you search for any news topic and select which sources to trust. It fetches recent articles on that topic, sends them to Claude for synthesis, and returns a structured breakdown: key facts with supporting quotes and sources, plus the distinct perspectives different outlets are taking on those facts. Every claim is traceable back to the original article, so you can verify before forming an opinion.

## Setup

1. Copy `config.example.json` to `config.local.json` and fill in a NewsAPI key and a Claude API key.
2. Run `npm install` once, to install the one dependency used for full-article-text extraction (`@extractus/article-extractor`).
3. Double-click `start.bat` (or run `node server.js`) to launch the app at `http://localhost:3000`.

## Search & source balancing
```

- [ ] **Step 3: Verify the launcher end to end**

With `config.local.json` in place (placeholder or real), double-click
`start.bat`. Confirm `npm install` runs first (fast/no-op if already
installed from Task 1), then the browser opens to `http://localhost:3000`
and the server console shows "Parallax running at http://localhost:3000".

- [ ] **Step 4: Commit**

```bash
git add start.bat README.md
git commit -m "docs: document npm install setup step"
```

---

### Task 10: Full verification pass

**Files:** none created, except `docs/roadmap.md` gets one status edit.

- [ ] **Step 1: Run the full automated test suite**

Run: `node --test`
Expected: PASS — 68 tests passing, 0 failures (35 tests that existed before
this feature, minus the 4 old `pipeline.test.js` tests, plus 5 new
`pipeline.test.js` tests, plus 12 `articleText.test.js` + 11 `claude.test.js`
+ 9 `citations.test.js` = 35 − 4 + 5 + 12 + 11 + 9 = 68). Recount against the
actual output and treat any mismatch as a bug to investigate, not a number
to force-match.

- [ ] **Step 2: Re-verify the full manual flow end to end**

With a placeholder (or real, if available — see Step 3) `config.local.json`
in place, double-click `start.bat`. Confirm the browser opens and the server
starts. Walk through: select sources, enter a topic, submit, confirm
"Fetching articles from selected sources…" then "Analyzing articles…"
appear in sequence, then either a result-count completion message (if using
real keys that successfully return verifiable results) or the specific
Claude-key-invalid error message (if using the placeholder Claude key) —
either outcome is correct, driven by whichever config is in place.

- [ ] **Step 3: Real-key verification (best effort — requires real NewsAPI and Claude keys)**

This step needs real, working keys in `config.local.json` — not the
placeholders used above. If both are available in this environment:

Run a real search end to end (e.g. topic "inflation" with 4–6 sources
selected) and inspect the console-logged pipeline result directly. Confirm:
- `articlesAnalyzed` is a sensible number (>0, ≤25)
- At least some facts and/or perspectives came back
- For at least 2–3 spot-checked citations, manually open the cited `url` and
  confirm the `quote` text genuinely appears in that article (or is at least
  plausible given the source's paywall/JS-rendering behavior, if that
  citation came from the fallback snippet — check `articlesUsingFallbackText`
  to see whether fallback was used for that source)
- No fact or perspective in the output has zero citations (verification
  should make this structurally impossible, but confirm directly)

**If no real keys are available in this environment**, do not guess or skip
silently. Report this step as incomplete in your final report (status
`DONE_WITH_CONCERNS`, not `DONE`), stating plainly that real-key end-to-end
verification could not be performed and remains a manual follow-up before
this feature is relied on for actual use.

- [ ] **Step 4: Update roadmap status**

In `docs/roadmap.md`, change Feature 3's ("Claude API analysis") Status from
`Next` to `In progress` in the table.

- [ ] **Step 5: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark Claude API analysis in progress"
```
