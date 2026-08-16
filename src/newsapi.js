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
