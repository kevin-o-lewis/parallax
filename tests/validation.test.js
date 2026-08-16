const test = require('node:test');
const assert = require('node:assert/strict');
const { validateForm } = require('../src/validation.js');

test('rejects empty topic', () => {
  const result = validateForm('', ['bbc-news']);
  assert.equal(result.valid, false);
  assert.equal(result.errors.topic, 'Please enter a topic.');
});

test('rejects whitespace-only topic', () => {
  const result = validateForm('   ', ['bbc-news']);
  assert.equal(result.valid, false);
  assert.equal(result.errors.topic, 'Please enter a topic.');
});

test('rejects zero selected sources', () => {
  const result = validateForm('AI regulation', []);
  assert.equal(result.valid, false);
  assert.equal(result.errors.sources, 'Please select at least one source.');
});

test('accepts a valid topic and at least one source', () => {
  const result = validateForm('AI regulation', ['bbc-news']);
  assert.equal(result.valid, true);
  assert.equal(result.errors.topic, null);
  assert.equal(result.errors.sources, null);
});

test('reports both errors when topic and sources are both invalid', () => {
  const result = validateForm('', []);
  assert.equal(result.valid, false);
  assert.equal(result.errors.topic, 'Please enter a topic.');
  assert.equal(result.errors.sources, 'Please select at least one source.');
});
