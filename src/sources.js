// Verified 2026-08-15 against a live call to NewsAPI's
// /v2/top-headlines/sources endpoint. This list was hand-curated by the PM
// (not carried over from Feature 1's unverified guesswork — see git history
// for that prior list, which included 3 sources, CNBC/Reuters/The Guardian,
// that NewsAPI had actually removed from its catalog entirely) for factual
// reliability and a deliberate mix of political perspective, filtered to
// English-language sources across the business, technology, science, and
// general categories (sports and health excluded).
const NEWS_SOURCES = [
  { id: 'al-jazeera-english', name: 'Al Jazeera English' },
  { id: 'associated-press', name: 'Associated Press' },
  { id: 'axios', name: 'Axios' },
  { id: 'bbc-news', name: 'BBC News' },
  { id: 'bloomberg', name: 'Bloomberg' },
  { id: 'business-insider', name: 'Business Insider' },
  { id: 'cnn', name: 'CNN' },
  { id: 'fortune', name: 'Fortune' },
  { id: 'fox-news', name: 'Fox News' },
  { id: 'google-news', name: 'Google News' },
  { id: 'national-review', name: 'National Review' },
  { id: 'politico', name: 'Politico' },
  { id: 'techcrunch', name: 'TechCrunch' },
  { id: 'the-verge', name: 'The Verge' },
  { id: 'the-wall-street-journal', name: 'The Wall Street Journal' },
  { id: 'the-washington-post', name: 'The Washington Post' },
  { id: 'the-washington-times', name: 'The Washington Times' },
  { id: 'time', name: 'Time' },
  { id: 'usa-today', name: 'USA Today' },
  { id: 'wired', name: 'Wired' },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NEWS_SOURCES };
}
