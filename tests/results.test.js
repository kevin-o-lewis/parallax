const test = require('node:test');
const assert = require('node:assert/strict');
const { renderResultsHTML, escapeHtml } = require('../src/results.js');

const SAMPLE_ANALYSIS = {
  facts: [
    {
      statement: 'Retail prices rose 2.1% in July.',
      citations: [
        { quote: 'prices climbed 2.1% in July', sourceName: 'Reuters', url: 'https://reuters.example.com/a' },
      ],
    },
  ],
  perspectives: [
    {
      label: 'Concern about consumer cost',
      summary: 'Some economists argue costs are being passed to consumers.',
      citations: [
        { quote: 'consumers will bear the brunt', sourceName: 'WSJ', url: 'https://wsj.example.com/b' },
      ],
    },
  ],
  articlesAnalyzed: 25,
  articlesUsingFallbackText: 4,
};

test('escapeHtml escapes HTML-significant characters', () => {
  assert.equal(escapeHtml('<script>&"\''), '&lt;script&gt;&amp;&quot;&#39;');
});

test('renders the topic as an escaped heading', () => {
  const html = renderResultsHTML('AI & <regulation>', SAMPLE_ANALYSIS);
  assert.match(html, /<h2 tabindex="-1">Results for "AI &amp; &lt;regulation&gt;"<\/h2>/);
});

test('renders a fact card with statement, source link, and a hidden quotes block', () => {
  const html = renderResultsHTML('topic', SAMPLE_ANALYSIS);
  assert.match(html, /Retail prices rose 2\.1% in July\./);
  assert.match(html, /<a href="https:\/\/reuters\.example\.com\/a" target="_blank" rel="noopener noreferrer">Reuters<\/a>/);
  assert.match(html, /<div class="quotes" hidden><blockquote>"prices climbed 2\.1% in July" — Reuters<\/blockquote><\/div>/);
});

test('renders a perspective card with label, summary, source link, and a hidden quotes block', () => {
  const html = renderResultsHTML('topic', SAMPLE_ANALYSIS);
  assert.match(html, /Concern about consumer cost/);
  assert.match(html, /Some economists argue costs are being passed to consumers\./);
  assert.match(html, /<a href="https:\/\/wsj\.example\.com\/b" target="_blank" rel="noopener noreferrer">WSJ<\/a>/);
});

test('shows a facts-empty note when facts is empty but perspectives is not', () => {
  const analysis = { ...SAMPLE_ANALYSIS, facts: [] };
  const html = renderResultsHTML('topic', analysis);
  assert.match(html, /No verifiable facts found for this topic\./);
  assert.match(html, /Concern about consumer cost/);
});

test('shows a perspectives-empty note when perspectives is empty but facts is not', () => {
  const analysis = { ...SAMPLE_ANALYSIS, perspectives: [] };
  const html = renderResultsHTML('topic', analysis);
  assert.match(html, /No verifiable perspectives found for this topic\./);
  assert.match(html, /Retail prices rose 2\.1% in July\./);
});

test('diagnostics line omits the fallback clause when articlesUsingFallbackText is 0', () => {
  const analysis = { ...SAMPLE_ANALYSIS, articlesUsingFallbackText: 0 };
  const html = renderResultsHTML('topic', analysis);
  assert.match(html, /<p class="diagnostics">25 articles analyzed<\/p>/);
});

test('diagnostics line includes the fallback count when greater than 0', () => {
  const html = renderResultsHTML('topic', SAMPLE_ANALYSIS);
  assert.match(html, /<p class="diagnostics">25 articles analyzed \(4 used snippet fallback instead of full text\)<\/p>/);
});

test('escapes HTML-significant characters inside a quote and source name', () => {
  const analysis = {
    facts: [
      {
        statement: 'Statement',
        citations: [
          { quote: 'costs <will> "rise" & fall', sourceName: 'A & B News', url: 'https://example.com/x' },
        ],
      },
    ],
    perspectives: [],
    articlesAnalyzed: 1,
    articlesUsingFallbackText: 0,
  };
  const html = renderResultsHTML('topic', analysis);
  assert.match(html, /costs &lt;will&gt; &quot;rise&quot; &amp; fall/);
  assert.match(html, /A &amp; B News/);
  assert.ok(!html.includes('<will>'));
});
