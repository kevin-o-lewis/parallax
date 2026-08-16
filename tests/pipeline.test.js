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
