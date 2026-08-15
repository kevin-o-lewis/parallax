# Parallax — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-08-15  
**Product Manager:** [Your name]  
**Product Type:** Personal Tool  
**Status:** Draft

---

## Problem Statement

Understanding all sides of a news story requires piecing together multiple sources, which takes more time and effort than I'm usually willing to spend. My news consumption is squeezed into found moments (a podcast on solo drives, a YouTube segment at lunch, occasional news skims, Reddit for conflicting opinions), and deep dives are rare because the energy cost is high.

The trigger is someone asking my opinion on a major story and I can only offer a gut reaction with a disclaimer that I'm not well informed. Over the following days I try to piece the topic together across sources. The cost of being uninformed is high: in the worst case, I make voting decisions based on vibes instead of evidence. At minimum, I carry guilt of being uninformed and I lack confidence backing up my opinions.

---

## Target User

The PM (myself). Use case: daily, rapid assembly of multi-source summaries on topics I don't have time to research deeply. Success state is going from uninformed on a topic to a multi-source summary with a side-by-side comparison of major-party sentiment in under 15 minutes.

---

## Value Proposition

A tool that gathers recent articles on any news topic from multiple trusted sources and synthesizes them into structured facts and opposing interpretations, each with direct quotes and source links. The human keeps ownership of choosing the topics and validating the output; the tool handles the retrieval and summarization.

---

## MVP Feature Set

| Feature | Description | Why MVP |
|---|---|---|
| **Search & source selection interface** | A single screen with a text input for the news topic and checkboxes for selecting which news sources to include in the search. Sources are pre-populated from the full list available via NewsAPI.org (ABC News, AP, BBC, Bloomberg, CNN, Fox News, Reuters, WSJ, Washington Post, The Guardian, etc.). User can check/uncheck sources or use defaults. | The MVP must allow the user to specify what they want to learn about and which sources to trust. This is the entry point to the tool. |
| **News API integration** | Construct a query to NewsAPI.org using the user-provided topic and selected sources; fetch all recent articles matching those criteria; pass the full article text (or article summary + full URL for retrieval) to the next step. | Required to gather source material. Without this, there is nothing to analyze. |
| **Claude API analysis** | Send the fetched articles to Claude with instructions to: (1) identify key facts from the articles with direct quotes and source attribution for each fact; (2) identify opposing interpretations or opinions about those facts, grouped by perspective, with direct quotes and source attribution for each. Return structured output with facts, opposing interpretations, and full source citations. | The MVP tests whether Claude can reliably synthesize multiple sources into structured facts and opposing views with proper citations. This is the core of the product. |
| **Results display with traceability** | Display the Claude-generated summary to the user in a format that shows: facts with supporting quotes and source links; opposing interpretations grouped by perspective, with supporting quotes and source links for each. The user can review and validate the output before acting on it. | Traceability (direct quotes + source links) is the safety mechanism against hallucination and misattribution. Without it, the user cannot verify claims. |

---

## Post-MVP Features

These are valuable but not needed to validate the core idea:

| Feature | Description | Notes |
|---|---|---|
| **Validation feedback system** | UI to flag facts and interpretations as hallucinated, incorrectly attributed, or accurate; capture notes for pipeline improvement. | Deferred: MVP prioritizes one-day build. Feedback system builds on stable results display and is valuable for learning iteration. |
| **Daily briefing / topic scanning** | AI-powered daily scan of news sources to surface trending topics and generate brief summaries without user input. | Deferred: MVP tests single deep-dive workflow. Multi-topic daily briefing is a separate feature. |
| **Source-specific APIs** | Direct integration with New York Times, Wall Street Journal, Financial Times, etc., to access paywall-protected or exclusive content. | Deferred: NewsAPI.org aggregation is sufficient for MVP. Source-specific APIs add cost and complexity. |
| **Politician statement grounding** | Tie opposing interpretations to named politicians' public statements, with links to the statements. | Deferred: requires additional data source and integration. Post-MVP research task. |
| **Comparison timer** | Allow the user to queue multiple topics and compare how they are framed across the same sources. | Deferred: single-topic analysis is sufficient for MVP validation. |

---

## MVP Test Framework

**Core assumption being tested:**  
Can Claude reliably synthesize multiple news articles into structured facts and opposing interpretations, each with direct quotes and source attributions, in a way that allows me to quickly form a confident, multi-sided understanding of a news topic?

**Test method:**  
Personal daily use over 2 weeks. For each topic, I will:
1. Run the tool with 4–6 trusted sources
2. Review the generated summary
3. Spot-check 3–5 facts against the original articles
4. Note whether the summaries are accurate, whether quotes are real, and whether attributions are correct
5. Track whether I feel more informed after using the tool vs. my baseline news consumption

**Success metrics:**  
- All 20 queries (2 weeks, ~10 topics) produce accurate facts and attributions. Target: 0 hallucinations or false citations. Minimum acceptable: ≤2 hallucinations across all 20 queries.
- After using the tool on a topic, I can articulate 2+ perspectives on it with confidence.
- I complete the full workflow (search → select sources → review summary) in under 15 minutes per topic.

**Timeline / decision point:**  
2-week personal use. If success metrics are met, the MVP validates the core assumption. If I find systematic hallucinations or misattributions, the tool needs redesign before being useful.

---

## Technical Constraints

- **Deployment:** Local only. No production infrastructure, no multi-user architecture, no database. Single-user demo running on my machine.
- **Deliverable:** Must be video-recordable. The interface must be visible and interactive during a screen recording.
- **API access:** Requires News API key (free tier available) and Anthropic Claude API key (paid, but standard rate).
- **Traceability is non-negotiable:** Every fact and every opposing interpretation must include direct quotes and source links. Hallucinated citations are a product failure.
- **Safety mechanism:** Traceability (direct quotes + source links) is the sole defense against hallucination. No secondary review screen or approval gate in MVP; user responsibility to spot-check sources.

---

## Out of Scope

- Multi-user architecture or authentication
- Production deployment, scaling, or uptime guarantees
- Integration with paywall-protected news APIs (NYT, WSJ, FT)
- Social media scraping or politician statement grounding
- **Political party labels:** The app will not assign party alignment (Conservative, Liberal, Democratic, Republican, etc.) to any stances or opinions. Perspectives are presented neutrally with supporting evidence; the user determines alignment themselves.
- Daily briefing or automated topic discovery
- Caching, search history, or saved topics
- Mobile app (desktop/web only for MVP)

---

## Open Questions

| Question | Owner | Due |
|---|---|---|
| **Opinion count and structure:** Should Claude detect as many distinct perspectives as exist in the sources (variable, typically 2–4), or should the prompt enforce a fixed structure? Variable detection reflects reality but requires careful prompting to avoid hallucinated opinions; fixed structure is more predictable to validate. Recommendation: variable, with explicit instructions for Claude to cite all supporting sources for each opinion. | You / Design session | Design session |
| **Claude output format:** What format should Claude use for structured output (JSON, Markdown, HTML, custom)? This affects both the prompt design and the results display rendering. | Design session | Design session |
| **Article filtering:** Should the tool filter articles by date range (e.g., last 7 days, last 30 days)? Should this be user-configurable or a default? | You / Design session | Design session |
| **Summary length / detail:** Should the Claude prompt optimize for brevity or exhaustiveness? Any length targets? | You / Design session | Design session |
| **Interface layout:** How should facts and opposing interpretations be visually separated? Expandable sections, tabs, side-by-side columns? | Design session | Design session |

---

## Appendix

**IMPACT Document Reference:** Sections 1 (Intent), 4 (Accuracy & Safety), and 5 (Cost & Constraints) informed this PRD. Section 3 (Plumbing) and the n8n workflow reference the API structure and source mapping needed for the News API integration.

**News API Sources:** 31 sources available (ABC News, Al Jazeera, AP, Ars Technica, BBC, Bloomberg, Business Insider, CNBC, CNN, Engadget, Fortune, Fox News, Hacker News, IGN, Mashable, National Geographic, NBC News, New Scientist, Newsweek, Politico, Reuters, TechCrunch, TechRadar, The Guardian, The Next Web, The Verge, WSJ, Washington Post, Time, USA Today, Wired).

**Failure Mode Mitigation:** Per IMPACT A2, traceability addresses all five failure modes by ensuring the user can verify facts against source material and see the chain of reasoning for each interpretation.

---