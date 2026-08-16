const test = require('node:test');
const assert = require('node:assert/strict');
const { NEWS_SOURCES } = require('../src/sources.js');

test('has exactly 20 sources', () => {
  assert.equal(NEWS_SOURCES.length, 20);
});

test('every source has a non-empty id and name', () => {
  for (const source of NEWS_SOURCES) {
    assert.equal(typeof source.id, 'string');
    assert.ok(source.id.length > 0);
    assert.equal(typeof source.name, 'string');
    assert.ok(source.name.length > 0);
  }
});

test('source ids are unique', () => {
  const ids = NEWS_SOURCES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});
