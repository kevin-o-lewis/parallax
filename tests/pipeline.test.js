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
