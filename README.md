# Parallax

A tool that brings clarity to complex news stories by gathering articles from multiple trusted sources and synthesizing them into structured facts and opposing perspectives, with direct quotes and source links for every claim.

## The problem

News consumption is fragmented and time-consuming. When a major story breaks, getting a balanced, multi-sided understanding requires manually gathering articles from different sources, then trying to reconcile their different framing and priorities. Most people don't have the time or energy for that process, which means opinions form on incomplete information.

## What it does

Parallax lets you search for any news topic and select which sources to trust. It fetches recent articles on that topic, sends them to Claude for synthesis, and returns a structured breakdown: key facts with supporting quotes and sources, plus the distinct perspectives different outlets are taking on those facts. Every claim is traceable back to the original article, so you can verify before forming an opinion.

## Setup

1. Copy `config.example.json` to `config.local.json` and fill in a NewsAPI key and a Claude API key.
2. Run `npm install` once, to install the one dependency used for full-article-text extraction (`@extractus/article-extractor`).
3. Double-click `start.bat` (or run `node server.js`) to launch the app at `http://localhost:3000`.

## Search & source balancing

Parallax searches the last 7 days of articles for each topic. This is a
deliberate default, not a NewsAPI limitation — the underlying API (free tier)
actually allows searching up to a month back. 7 days was chosen to keep
results focused on the current state of a story rather than older context,
and testing confirmed it doesn't cost source diversity: a wider window
doesn't reliably surface more distinct sources (see NewsAPI constraints
below for why).

Each search makes two calls to NewsAPI: one sorted by relevancy, one sorted
by publish date (newest first). A single relevancy-sorted call tends to let
one prolific source dominate the results — in testing, one source alone
provided 13 of 20 articles for a single query, while 14 of the 20 selected
sources contributed nothing. Combining both calls fixes this: articles from
the relevancy call are kept up to 3 per source, then articles from the
newest-first call top each source up to 5, with duplicates removed. This
consistently produced more articles and better source spread than either
call alone across every topic tested.

**Cost:** two calls per search instead of one means roughly 50 searches per
day are possible, down from roughly 100 — see NewsAPI constraints below.

## NewsAPI constraints

A few limits on the underlying API shaped the decisions above:

- **100 requests per day** (free "Developer" plan). Every search costs 2
  requests under the current balancing strategy, so this caps Parallax at
  roughly 50 searches/day.
- **100 results maximum per query**, regardless of how many total articles
  actually match. NewsAPI reports the true total match count, but only the
  first 100 are ever retrievable, no matter the page size or search window
  used. This is why widening the search window doesn't reliably help
  diversity — a longer window increases the *total* matching content
  without raising that 100-result ceiling, so more articles compete for the
  same fixed number of retrievable slots, which can crowd out sources with
  only occasional coverage rather than surface them.
- **Articles searchable up to 1 month old** at most, with a **24-hour delay**
  before a newly published article becomes searchable.

See `docs/decisions.md` for the full reasoning behind the two-call balancing
strategy, including the alternatives tested (wider search windows, a
popularity-sorted second call, per-source individual queries) and why each
was rejected.

## Status

Pre-MVP

See `docs/roadmap.md` for build progress and `docs/prd-parallax.md` for full requirements.
