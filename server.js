const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildArticlesUrl, normalizeArticles, mapNewsApiError } = require('./src/newsapi.js');
const { resolveFilePath, resolveContentType } = require('./src/static-files.js');

const ROOT_DIR = __dirname;
const PORT = 3000;

function loadConfig() {
  const configPath = path.join(ROOT_DIR, 'config.local.json');
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.newsApiKey || typeof parsed.newsApiKey !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const config = loadConfig();
if (!config) {
  console.error('Missing config.local.json — copy config.example.json and add your NewsAPI key.');
  process.exit(1);
}

function serveStaticFile(pathname, res) {
  const filePath = resolveFilePath(pathname, ROOT_DIR);
  if (!filePath) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code !== 'ENOENT') {
        console.error('Error reading static file:', filePath, err);
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': resolveContentType(filePath) });
    res.end(data);
  });
}

async function handleArticlesRequest(url, res) {
  const topic = url.searchParams.get('topic');
  const sourcesParam = url.searchParams.get('sources');

  if (!topic || !sourcesParam) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to NewsAPI. Check the server logs." }));
    return;
  }

  const sourceIds = sourcesParam.split(',').filter(Boolean);
  const newsApiUrl = buildArticlesUrl(topic, sourceIds, config.newsApiKey, new Date());

  let newsApiResponse;
  try {
    newsApiResponse = await fetch(newsApiUrl);
  } catch (err) {
    console.error('Failed to reach NewsAPI:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Couldn't reach NewsAPI. Check your internet connection and try again." }));
    return;
  }

  const data = await newsApiResponse.json();

  if (data.status === 'error') {
    const mapped = mapNewsApiError(data.code);
    console.error('NewsAPI error:', data.code, data.message);
    res.writeHead(mapped.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: mapped.message }));
    return;
  }

  const articles = normalizeArticles(data.articles || []);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(articles));
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://localhost:${PORT}`);
  } catch (err) {
    console.error('Failed to parse request URL:', err);
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (url.pathname === '/api/articles') {
    handleArticlesRequest(url, res).catch((err) => {
      console.error('Unexpected error handling /api/articles:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to NewsAPI. Check the server logs." }));
    });
    return;
  }

  serveStaticFile(url.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Parallax running at http://localhost:${PORT}`);
});
