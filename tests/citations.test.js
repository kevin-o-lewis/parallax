const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeForMatch,
  quoteAppearsIn,
  verifyCitation,
  filterVerifiedItems,
  verifyAnalysis,
} = require('../src/citations.js');

test('normalizeForMatch collapses whitespace and straightens curly quotes/dashes', () => {
  const input = '“Costs   will  rise,”\nofficials said — repeatedly.';
  assert.equal(normalizeForMatch(input), '"Costs will rise," officials said - repeatedly.');
});

test('quoteAppearsIn matches an exact substring', () => {
  assert.equal(quoteAppearsIn('costs will rise', 'Officials warned that costs will rise next year.'), true);
});

test('quoteAppearsIn matches despite curly-quote and whitespace differences', () => {
  assert.equal(quoteAppearsIn('“costs will rise”', 'He said "costs will   rise" yesterday.'), true);
});

test('quoteAppearsIn returns false when the quote is not a real substring', () => {
  assert.equal(quoteAppearsIn('costs will fall', 'Officials warned that costs will rise next year.'), false);
});

test('verifyCitation fails when the url is not in the known article set', () => {
  const result = verifyCitation(
    { quote: 'anything', url: 'https://unknown.example.com/x' },
    { 'https://example.com/a': 'anything is here' }
  );
  assert.equal(result, false);
});

test('verifyCitation passes when the url is known and the quote matches', () => {
  const result = verifyCitation(
    { quote: 'anything', url: 'https://example.com/a' },
    { 'https://example.com/a': 'This says anything is here.' }
  );
  assert.equal(result, true);
});

test('filterVerifiedItems drops individual citations that fail verification', () => {
  const items = [{
    statement: 'X',
    citations: [
      { quote: 'real quote', url: 'https://example.com/a' },
      { quote: 'fake quote', url: 'https://example.com/a' },
    ],
  }];
  const result = filterVerifiedItems(items, { 'https://example.com/a': 'This has the real quote in it.' });
  assert.equal(result.length, 1);
  assert.equal(result[0].citations.length, 1);
  assert.equal(result[0].citations[0].quote, 'real quote');
});

test('filterVerifiedItems drops an item entirely when no citations survive', () => {
  const items = [{ statement: 'X', citations: [{ quote: 'fake quote', url: 'https://example.com/a' }] }];
  const result = filterVerifiedItems(items, { 'https://example.com/a': 'Nothing matches here.' });
  assert.equal(result.length, 0);
});

test('verifyAnalysis verifies facts and perspectives against prepared article text', () => {
  const analysis = {
    facts: [{ statement: 'X', citations: [{ quote: 'real quote', url: 'https://example.com/a' }] }],
    perspectives: [{ label: 'L', summary: 'S', citations: [{ quote: 'not present', url: 'https://example.com/a' }] }],
  };
  const preparedArticles = [{ url: 'https://example.com/a', text: 'This has the real quote in it.' }];

  const result = verifyAnalysis(analysis, preparedArticles);

  assert.equal(result.facts.length, 1);
  assert.equal(result.perspectives.length, 0);
});
