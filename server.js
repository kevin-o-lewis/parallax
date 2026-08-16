const http = require('http');
const fs = require('fs');
const path = require('path');
const { extract } = require('@extractus/article-extractor');
const { buildArticlesUrl, normalizeArticles, mapNewsApiError, compileBalancedArticles } = require('./src/newsapi.js');
const { resolveFilePath, resolveContentType } = require('./src/static-files.js');
const { selectArticlesForAnalysis, prepareArticleForAnalysis, extractArticleText } = require('./src/articleText.js');
const { callClaudeAnalysis } = require('./src/claude.js');
const { verifyAnalysis } = require('./src/citations.js');

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
    if (!parsed.claudeApiKey || typeof parsed.claudeApiKey !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const config = loadConfig();
if (!config) {
  console.error('Missing config.local.json — copy config.example.json and add your NewsAPI key and Claude API key.');
  process.exit(1);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
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

// Bounds for the /api/analyze pipeline. Tuned for cost/latency control: real
// searches rarely return anywhere near the theoretical max article count
// (see the caps above), so this rarely binds, but every search scrapes N
// URLs and sends their text to a paid API, so an explicit ceiling matters.
const MAX_ARTICLES_TO_ANALYZE = 25;
const ARTICLE_TEXT_CHAR_CAP = 8000;
const FALLBACK_TEXT_THRESHOLD = 500;
const SCRAPE_TIMEOUT_MS = 8000;
const CLAUDE_MODEL = 'claude-sonnet-5';

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

async function handleAnalyzeRequest(req, res) {
  let body;
  try {
    const raw = await readRequestBody(req);
    body = JSON.parse(raw);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to analyze. Check the server logs." }));
    return;
  }

  const { topic, articles } = body;
  if (!topic || !Array.isArray(articles)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Something's wrong with the request Parallax sent to analyze. Check the server logs." }));
    return;
  }

  const selectedArticles = selectArticlesForAnalysis(articles, MAX_ARTICLES_TO_ANALYZE);

  const extractedTexts = await Promise.all(
    selectedArticles.map((article) => extractArticleText(article.url, extract, SCRAPE_TIMEOUT_MS))
  );

  const preparedArticles = selectedArticles.map((article, index) =>
    prepareArticleForAnalysis(article, extractedTexts[index], {
      fallbackThreshold: FALLBACK_TEXT_THRESHOLD,
      maxCharsPerArticle: ARTICLE_TEXT_CHAR_CAP,
    })
  );

  let claudeResult;
  try {
    claudeResult = await callClaudeAnalysis(topic, preparedArticles, config.claudeApiKey, CLAUDE_MODEL);
  } catch (err) {
    console.error('Failed to reach the Claude API:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: "Couldn't reach the Claude API. Check your internet connection and try again." }));
    return;
  }

  if (claudeResult.error) {
    console.error('Claude analysis failed:', claudeResult.error.status, claudeResult.error.message);
    res.writeHead(claudeResult.error.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: claudeResult.error.message }));
    return;
  }

  const verified = verifyAnalysis(claudeResult.result, preparedArticles);
  const droppedFacts = claudeResult.result.facts.length - verified.facts.length;
  const droppedPerspectives = claudeResult.result.perspectives.length - verified.perspectives.length;
  if (droppedFacts > 0 || droppedPerspectives > 0) {
    console.error(`Citation verification dropped ${droppedFacts} fact(s) and ${droppedPerspectives} perspective(s) that failed verification.`);
  }

  const articlesUsingFallbackText = preparedArticles.filter((article) => article.usedFallback).length;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    topic,
    facts: verified.facts,
    perspectives: verified.perspectives,
    articlesAnalyzed: preparedArticles.length,
    articlesUsingFallbackText,
  }));
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

  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    handleAnalyzeRequest(req, res).catch((err) => {
      console.error('Unexpected error handling /api/analyze:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Something went wrong analyzing the articles. Check the server logs.' }));
    });
    return;
  }

  serveStaticFile(url.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Parallax running at http://localhost:${PORT}`);
});
