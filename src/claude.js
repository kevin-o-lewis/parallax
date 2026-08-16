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
