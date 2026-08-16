function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildArticlesUrl(topic, sourceIds, apiKey, now, sortBy) {
  const referenceDate = now || new Date();
  const to = new Date(referenceDate);
  const from = new Date(referenceDate);
  from.setDate(from.getDate() - 7);

  const params = new URLSearchParams({
    q: topic,
    sources: sourceIds.join(','),
    from: formatDate(from),
    to: formatDate(to),
    sortBy: sortBy || 'relevancy',
    pageSize: '100',
    apiKey,
  });

  return 'https://newsapi.org/v2/everything?' + params.toString();
}

// Combines two already-normalized article lists (see normalizeArticles) into
// one balanced list, so no single source can dominate purely because it
// ranks highly on one sort criterion. `firstCallArticles` is expected to be
// relevancy-sorted and `secondCallArticles` publishedAt-sorted (newest
// first), though this function itself is agnostic to sort order — it just
// applies caps in the order given.
//
// Behavior: articles from `firstCallArticles` are added up to `firstCap` per
// source. Articles from `secondCallArticles` are then added on top, per
// source, up to `finalCap` total (so a source already at `firstCap` can gain
// at most `finalCap - firstCap` more, and a source with zero from the first
// call can gain up to `finalCap`). Articles are deduplicated by `url` across
// both calls. Relative order within each call is preserved.
function compileBalancedArticles(firstCallArticles, secondCallArticles, firstCap, finalCap) {
  const perSourceCount = {};
  const seenUrls = new Set();
  const compilation = [];

  function tryAdd(article, cap) {
    const count = perSourceCount[article.sourceName] || 0;
    if (seenUrls.has(article.url) || count >= cap) {
      return;
    }
    perSourceCount[article.sourceName] = count + 1;
    seenUrls.add(article.url);
    compilation.push(article);
  }

  firstCallArticles.forEach((article) => tryAdd(article, firstCap));
  secondCallArticles.forEach((article) => tryAdd(article, finalCap));

  return compilation;
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

module.exports = { buildArticlesUrl, normalizeArticles, mapNewsApiError, compileBalancedArticles };
