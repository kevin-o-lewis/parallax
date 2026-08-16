const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildArticlesUrl, normalizeArticles, mapNewsApiError, compileBalancedArticles } = require('./src/newsapi.js');
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

// Per-source article caps for compileBalancedArticles. Tuned against real
// searches during design: relevancy alone lets a single prolific source
// dominate; topping up from a publishedAt (newest-first) call after capping
// relevancy meaningfully increases both article count and source diversity,
// because relevancy-ranking and recency surface largely different articles.
const RELEVANCY_CAP_PER_SOURCE = 3;
const FINAL_CAP_PER_SOURCE = 5;

// Fetches one NewsAPI URL and returns either { articles } (normalized) or
// { error } (mapped via mapNewsApiError). Does not catch network-level
// failures — those are the caller's responsibility, since the two call
// sites in handleArticlesRequest treat that failure mode differently.
async function fetchAndNormalize(newsApiUrl) {
  const response = await fetch(newsApiUrl);
  const data = await response.json();
  if (data.status === 'error') {
    console.error('NewsAPI error:', data.code, data.message);
    return { error: mapNewsApiError(data.code) };
  }
  return { articles: normalizeArticles(data.articles || []) };
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
  const relevancyUrl = buildArticlesUrl(topic, sourceIds, config.newsApiKey, new Date(), 'relevancy');
  const newestUrl = buildArticlesUrl(topic, sourceIds, config.newsApiKey, new Date(), 'publishedAt');

  let relevancyResult;
  try {
    relevancyResult = await fetchAndNormalize(relevancyUrl);
  } catch (err) {
    console.error('Failed to reach NewsAPI (relevancy call):', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Couldn't reach NewsAPI. Check your internet connection and try again." }));
    return;
  }

  if (relevancyResult.error) {
    res.writeHead(relevancyResult.error.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: relevancyResult.error.message }));
    return;
  }

  // The second call is best-effort: if it fails (network error, rate limit,
  // etc.) we still have a complete, valid result from the first call, so we
  // log and continue with relevancy-only results rather than failing the
  // whole request over a call whose only job was topping up diversity.
  let newestArticles = [];
  try {
    const newestResult = await fetchAndNormalize(newestUrl);
    if (newestResult.error) {
      console.error('Second (newest) call failed, continuing with relevancy-only results:', newestResult.error.message);
    } else {
      newestArticles = newestResult.articles;
    }
  } catch (err) {
    console.error('Failed to reach NewsAPI (newest call), continuing with relevancy-only results:', err);
  }

  const articles = compileBalancedArticles(
    relevancyResult.articles,
    newestArticles,
    RELEVANCY_CAP_PER_SOURCE,
    FINAL_CAP_PER_SOURCE
  );
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
