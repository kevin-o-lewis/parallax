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
