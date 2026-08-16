const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectArticlesForAnalysis,
  truncateText,
  stripHtmlTags,
  resolveArticleText,
  prepareArticleForAnalysis,
  extractArticleText,
} = require('../src/articleText.js');

test('selects at most the given number of articles, preserving order', () => {
  const articles = [{ url: 'a' }, { url: 'b' }, { url: 'c' }];
  assert.deepEqual(selectArticlesForAnalysis(articles, 2), [{ url: 'a' }, { url: 'b' }]);
});

test('returns all articles when fewer than the cap', () => {
  const articles = [{ url: 'a' }];
  assert.deepEqual(selectArticlesForAnalysis(articles, 25), [{ url: 'a' }]);
});

test('truncates text longer than the cap', () => {
  assert.equal(truncateText('abcdefghij', 5), 'abcde');
});

test('leaves text at or under the cap unchanged', () => {
  assert.equal(truncateText('abc', 5), 'abc');
});

test('strips tags, script/style blocks, and decodes common entities', () => {
  const html = '<p>Hello &amp; welcome</p><script>evil()</script><style>.x{}</style><p>Second &quot;part&quot;</p>';
  assert.equal(stripHtmlTags(html), 'Hello & welcome Second "part"');
});

test('resolveArticleText uses extracted text when it meets the threshold', () => {
  const article = { description: 'short desc', content: 'short content [+50 chars]' };
  const result = resolveArticleText(article, 'a'.repeat(600), 500);
  assert.equal(result.text, 'a'.repeat(600));
  assert.equal(result.usedFallback, false);
});

test('resolveArticleText falls back to description+content when extraction is thin', () => {
  const article = { description: 'A short description.', content: 'A short snippet [+50 chars]' };
  const result = resolveArticleText(article, 'too short', 500);
  assert.equal(result.text, 'A short description. A short snippet [+50 chars]');
  assert.equal(result.usedFallback, true);
});

test('resolveArticleText falls back cleanly when extraction is empty', () => {
  const article = { description: 'Desc only.', content: null };
  const result = resolveArticleText(article, '', 500);
  assert.equal(result.text, 'Desc only.');
  assert.equal(result.usedFallback, true);
});

test('prepareArticleForAnalysis combines resolution and truncation with source metadata', () => {
  const article = { url: 'https://example.com/a', sourceName: 'Example News', title: 'A title', description: 'Desc.', content: 'Snippet [+10 chars]' };
  const result = prepareArticleForAnalysis(article, 'a'.repeat(20), { fallbackThreshold: 10, maxCharsPerArticle: 15 });
  assert.equal(result.url, 'https://example.com/a');
  assert.equal(result.sourceName, 'Example News');
  assert.equal(result.title, 'A title');
  assert.equal(result.text, 'a'.repeat(15));
  assert.equal(result.usedFallback, false);
});

test('extractArticleText returns stripped text when the extractor succeeds', async () => {
  const fakeExtract = async () => ({ content: '<p>Real article text.</p>' });
  const result = await extractArticleText('https://example.com/a', fakeExtract, 8000);
  assert.equal(result, 'Real article text.');
});

test('extractArticleText returns an empty string when the extractor finds nothing', async () => {
  const fakeExtract = async () => null;
  const result = await extractArticleText('https://example.com/a', fakeExtract, 8000);
  assert.equal(result, '');
});

test('extractArticleText returns an empty string when the extractor throws', async () => {
  const fakeExtract = async () => { throw new Error('network error'); };
  const result = await extractArticleText('https://example.com/a', fakeExtract, 8000);
  assert.equal(result, '');
});
