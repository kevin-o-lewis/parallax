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
