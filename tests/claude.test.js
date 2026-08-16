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
