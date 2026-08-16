# Decisions — Parallax

Architecture decision records, in chronological order. Reserved for genuine
architectural forks — choices worth challenging before they are reversed.
Routine implementation choices do not warrant a record.

| # | Topic | Date |
|---|---|---|
| 1 | NewsAPI query strategy: two-call source balancing | 2026-08-15 |

---

## 1. NewsAPI query strategy: two-call source balancing

**Date:** 2026-08-15
**Feature:** #2, News API integration

**Decision:** Fetch articles with two NewsAPI calls per search — one sorted
by `relevancy`, one sorted by `publishedAt` (newest first) — and combine them
with a per-source cap (3 from the relevancy call, topped up to 5 total from
the newest call), deduplicated by URL. This replaces a simpler single-call,
`sortBy=relevancy`-only design that shipped earlier in this feature's PR.

**Why this was revisited:** Once a real NewsAPI key became available (the
original design was built and reviewed entirely against a placeholder key —
see the feature's ledger), live testing showed the single-call design let one
prolific source dominate results. One real test: for a single query, 13 of 20
returned articles came from one source (Business Insider), and 14 of the 20
selected sources contributed nothing. For a tool whose entire purpose is
synthesizing multiple perspectives, that's a direct threat to the product's
core value, not a cosmetic issue.

**Alternatives tested, with real data, before landing here:**

- **Raise `pageSize` or the per-source cap alone (single call):** doesn't add
  source diversity — a single relevancy-ranked pool has a fixed set of
  sources represented in it regardless of how many articles you keep from
  that pool. Confirmed across cap 3 vs. cap 5: same sources represented,
  just more articles per already-covered source.
- **Second call sorted by `popularity`:** added almost nothing — 0-1 extra
  articles beyond the relevancy call's results, consistently, across every
  topic tested (order of the two calls didn't matter either — same final
  result either way). Relevancy and popularity reward largely overlapping
  content.
- **Second call sorted by `publishedAt` (newest):** added substantially
  more — 10-30 extra articles beyond relevancy, and meaningfully more source
  diversity, because recency and relevancy surface largely different
  articles for the same query. This is the mechanism the shipped design
  relies on.
- **One NewsAPI call per source (20 calls instead of 1-2):** tested directly
  — for one topic, this found only 1 more source and 3 more articles than
  the cheap two-call version, while costing 10x the request budget (20
  requests vs. 2). The marginal gain didn't justify dropping the daily
  search budget from ~50 to ~5. Also surfaced a useful fact: for that topic,
  6 of 20 sources genuinely had zero matching articles in the window — not a
  retrieval-limit artifact, an actual absence of coverage no query strategy
  can fix.
- **Extending the date window from 7 to 30 days:** tested directly, and
  counterintuitively did *not* reliably improve source diversity. NewsAPI's
  free tier caps retrieval at 100 results per query regardless of how many
  total matches exist (confirmed live: a query with 1,450 total matches in a
  30-day window still only returns the top 100). A wider window means more
  total competing content for that same fixed 100-slot ceiling, which can
  *squeeze out* infrequently-covered sources rather than surface them. In 2
  of 3 topics tested, the 7-day window produced *more* distinct sources than
  the 30-day window, not fewer. The original 7-day choice (made for
  recency, not diversity — see the feature's design spec) turned out to
  also be at least as good for diversity, so it was kept.

**Cost accepted:** 2 NewsAPI requests per search instead of 1, dropping the
usable daily search volume from roughly 100 to roughly 50 against the free
tier's 100-requests/day cap. Judged worth it for the diversity gain, given
this is a personal tool used a handful of times per day, not dozens.

**Full testing data:** see
`docs/superpowers/ledgers/2026-08-15-news-api-integration.md`.
