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
