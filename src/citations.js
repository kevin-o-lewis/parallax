// Citation verification: the product's sole defense against hallucinated
// quotes. For every citation Claude returns, this module independently
// verifies (a) the URL is one of the articles actually sent to Claude, and
// (b) the quote is a real, verbatim substring of that article's text (after
// normalizing curly quotes/dashes to their ASCII equivalents, so formatting
// differences don't cause false negatives). Any fact or perspective whose
// citations fail verification is dropped before results reach the client.
// This is enforced in code, not left to prompt-following trust.

function normalizeForMatch(text) {
  const singleQuotePattern = new RegExp('[\\u2018\\u2019]', 'g');
  const doubleQuotePattern = new RegExp('[\\u201C\\u201D]', 'g');
  const dashPattern = new RegExp('[\\u2013\\u2014]', 'g');

  return text
    .replace(singleQuotePattern, "'")
    .replace(doubleQuotePattern, '"')
    .replace(dashPattern, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function quoteAppearsIn(quote, sourceText) {
  if (!quote || !sourceText) {
    return false;
  }
  return normalizeForMatch(sourceText).includes(normalizeForMatch(quote));
}

function verifyCitation(citation, articleTextByUrl) {
  const sourceText = articleTextByUrl[citation.url];
  if (sourceText === undefined) {
    return false;
  }
  return quoteAppearsIn(citation.quote, sourceText);
}

function filterVerifiedItems(items, articleTextByUrl) {
  return items
    .map((item) => ({
      ...item,
      citations: item.citations.filter((citation) => verifyCitation(citation, articleTextByUrl)),
    }))
    .filter((item) => item.citations.length > 0);
}

function buildArticleTextByUrl(preparedArticles) {
  const map = Object.create(null);
  preparedArticles.forEach((article) => {
    map[article.url] = article.text;
  });
  return map;
}

function verifyAnalysis(analysis, preparedArticles) {
  const articleTextByUrl = buildArticleTextByUrl(preparedArticles);
  return {
    facts: filterVerifiedItems(analysis.facts, articleTextByUrl),
    perspectives: filterVerifiedItems(analysis.perspectives, articleTextByUrl),
  };
}

module.exports = {
  normalizeForMatch,
  quoteAppearsIn,
  verifyCitation,
  filterVerifiedItems,
  verifyAnalysis,
  buildArticleTextByUrl,
};
