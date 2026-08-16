const path = require('path');

function resolveFilePath(pathname, rootDir) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes('\0')) {
    return null;
  }

  const urlPath = decoded === '/' ? '/index.html' : decoded;
  const normalizedRoot = path.resolve(rootDir);
  const candidate = path.resolve(normalizedRoot, '.' + urlPath);

  if (candidate !== normalizedRoot && !candidate.startsWith(normalizedRoot + path.sep)) {
    return null;
  }

  return candidate;
}

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
};

function resolveContentType(filePath) {
  const ext = path.extname(filePath);
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

module.exports = { resolveFilePath, resolveContentType };
