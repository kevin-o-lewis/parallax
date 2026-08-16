// Pure rendering: turns Feature 3's verified {facts, perspectives,
// articlesAnalyzed, articlesUsingFallbackText} shape into an HTML string for
// the results view. app.js is the only caller, and only ever does
// resultsContent.innerHTML = renderResultsHTML(...).
//
// Every fact statement, quote, source name, and perspective label/summary
// originates from Claude's synthesis of scraped third-party article text —
// content this app does not control. This is the one place in the app that
// turns that external text into HTML, so every such field is escaped before
// interpolation.

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSourceLinks(citations) {
  return citations
    .map((citation) =>
      '<a href="' + escapeHtml(citation.url) + '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(citation.sourceName) + '</a>'
    )
    .join(' ');
}

function renderQuotes(citations) {
  return citations
    .map((citation) => '<blockquote>"' + escapeHtml(citation.quote) + '" — ' + escapeHtml(citation.sourceName) + '</blockquote>')
    .join('');
}

// The toggle button and its quotes block are rendered as direct siblings
// (button immediately followed by the .quotes div) so app.js's delegated
// click handler can find the right quotes block via toggle.nextElementSibling
// without needing per-card ids.
function renderCard(headingHtml, extraHtml, citations) {
  return '<div class="result-card">' +
    headingHtml +
    extraHtml +
    '<p class="card-sources">' + renderSourceLinks(citations) + '</p>' +
    '<button type="button" class="quote-toggle" aria-expanded="false">show quotes</button>' +
    '<div class="quotes" hidden>' + renderQuotes(citations) + '</div>' +
    '</div>';
}

function renderFactCard(fact) {
  return renderCard(
    '<p class="card-statement">' + escapeHtml(fact.statement) + '</p>',
    '',
    fact.citations
  );
}

function renderPerspectiveCard(perspective) {
  return renderCard(
    '<p class="card-statement">' + escapeHtml(perspective.label) + '</p>',
    '<p class="card-summary">' + escapeHtml(perspective.summary) + '</p>',
    perspective.citations
  );
}

function renderSection(title, items, emptyNoteText, cardRenderer) {
  const body = items.length === 0
    ? '<p class="section-empty-note">' + escapeHtml(emptyNoteText) + '</p>'
    : items.map(cardRenderer).join('');
  return '<section><h3>' + escapeHtml(title) + '</h3>' + body + '</section>';
}

function renderDiagnostics(articlesAnalyzed, articlesUsingFallbackText) {
  let text = articlesAnalyzed + ' articles analyzed';
  if (articlesUsingFallbackText > 0) {
    text += ' (' + articlesUsingFallbackText + ' used snippet fallback instead of full text)';
  }
  return '<p class="diagnostics">' + text + '</p>';
}

function renderResultsHTML(topic, analysis) {
  const factsSection = renderSection(
    'Facts', analysis.facts, 'No verifiable facts found for this topic.', renderFactCard
  );
  const perspectivesSection = renderSection(
    'Perspectives', analysis.perspectives, 'No verifiable perspectives found for this topic.', renderPerspectiveCard
  );
  const diagnostics = renderDiagnostics(analysis.articlesAnalyzed, analysis.articlesUsingFallbackText);

  return '<h2 tabindex="-1">Results for "' + escapeHtml(topic) + '"</h2>' +
    factsSection + perspectivesSection + diagnostics;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderResultsHTML, escapeHtml };
}
