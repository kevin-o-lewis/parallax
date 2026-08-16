const test = require('node:test');
const assert = require('node:assert/strict');
const { buildArticlesUrl, normalizeArticles, mapNewsApiError, compileBalancedArticles } = require('../src/newsapi.js');

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

test('defaults to sorting by relevancy with a page size of 100', () => {
  const url = buildArticlesUrl('AI regulation', ['bbc-news'], 'test-key', new Date('2026-08-15T12:00:00Z'));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('sortBy'), 'relevancy');
  assert.equal(parsed.searchParams.get('pageSize'), '100');
});

test('accepts an explicit sortBy value', () => {
  const url = buildArticlesUrl('AI regulation', ['bbc-news'], 'test-key', new Date('2026-08-15T12:00:00Z'), 'publishedAt');
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('sortBy'), 'publishedAt');
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

test('compileBalancedArticles caps articles from the first call at firstCap per source', () => {
  const first = [
    { sourceName: 'A', url: 'a1' },
    { sourceName: 'A', url: 'a2' },
    { sourceName: 'A', url: 'a3' },
    { sourceName: 'A', url: 'a4' },
  ];
  const result = compileBalancedArticles(first, [], 3, 5);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((a) => a.url), ['a1', 'a2', 'a3']);
});

test('compileBalancedArticles tops up from the second call up to finalCap per source', () => {
  const first = [
    { sourceName: 'A', url: 'a1' },
    { sourceName: 'A', url: 'a2' },
    { sourceName: 'A', url: 'a3' },
  ];
  const second = [
    { sourceName: 'A', url: 'a4' },
    { sourceName: 'A', url: 'a5' },
    { sourceName: 'A', url: 'a6' },
  ];
  const result = compileBalancedArticles(first, second, 3, 5);
  assert.equal(result.length, 5);
  assert.deepEqual(result.map((a) => a.url), ['a1', 'a2', 'a3', 'a4', 'a5']);
});

test('compileBalancedArticles lets the second call fill a source the first call missed entirely, up to finalCap', () => {
  const second = [
    { sourceName: 'B', url: 'b1' },
    { sourceName: 'B', url: 'b2' },
    { sourceName: 'B', url: 'b3' },
    { sourceName: 'B', url: 'b4' },
    { sourceName: 'B', url: 'b5' },
    { sourceName: 'B', url: 'b6' },
  ];
  const result = compileBalancedArticles([], second, 3, 5);
  assert.equal(result.length, 5);
});

test('compileBalancedArticles deduplicates by url between the two calls', () => {
  const first = [{ sourceName: 'A', url: 'a1' }];
  const second = [
    { sourceName: 'A', url: 'a1' },
    { sourceName: 'A', url: 'a2' },
  ];
  const result = compileBalancedArticles(first, second, 3, 5);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((a) => a.url), ['a1', 'a2']);
});

test('compileBalancedArticles tracks caps independently per source', () => {
  const first = [
    { sourceName: 'A', url: 'a1' },
    { sourceName: 'B', url: 'b1' },
  ];
  const second = [
    { sourceName: 'A', url: 'a2' },
    { sourceName: 'B', url: 'b2' },
  ];
  const result = compileBalancedArticles(first, second, 1, 2);
  assert.equal(result.length, 4);
  const bySource = { A: 0, B: 0 };
  result.forEach((a) => { bySource[a.sourceName] += 1; });
  assert.deepEqual(bySource, { A: 2, B: 2 });
});
