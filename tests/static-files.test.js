const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveFilePath, resolveContentType } = require('../src/static-files.js');

const ROOT = path.resolve(__dirname, '..');

test('maps the root path to index.html', () => {
  assert.equal(resolveFilePath('/', ROOT), path.join(ROOT, 'index.html'));
});

test('maps a nested path to the matching file under the root', () => {
  assert.equal(resolveFilePath('/src/app.js', ROOT), path.join(ROOT, 'src', 'app.js'));
});

test('rejects path traversal attempts, raw and URL-encoded', () => {
  assert.equal(resolveFilePath('/../../../etc/passwd', ROOT), null);
  assert.equal(resolveFilePath('/..%2f..%2f..%2fetc%2fpasswd', ROOT), null);
});

test('resolves content type by file extension', () => {
  assert.equal(resolveContentType('/a/b/index.html'), 'text/html');
  assert.equal(resolveContentType('/a/b/styles.css'), 'text/css');
  assert.equal(resolveContentType('/a/b/app.js'), 'text/javascript');
  assert.equal(resolveContentType('/a/b/config.json'), 'application/json');
});

test('falls back to a generic binary content type for unknown extensions', () => {
  assert.equal(resolveContentType('/a/b/file.xyz'), 'application/octet-stream');
});

test('rejects malformed percent-encoding instead of throwing', () => {
  assert.equal(resolveFilePath('/%', ROOT), null);
  assert.equal(resolveFilePath('/%zz', ROOT), null);
});

test('rejects paths containing null bytes', () => {
  assert.equal(resolveFilePath('/index.html%00.txt', ROOT), null);
});

test('rejects a resolved path that only shares a string prefix with a sibling directory', () => {
  const fakeRoot = path.join(ROOT, 'project');
  const result = resolveFilePath('/../project-evil/secret.txt', fakeRoot);
  assert.equal(result, null);
});
