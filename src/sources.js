// NOTE: these ids were written from memory during Feature 1 and trimmed to
// 20 during Feature 2, but were never verified against a live call to
// NewsAPI's /v2/top-headlines/sources endpoint (no real API key was
// available during implementation). A wrong id fails silently — it just
// returns zero articles for that source, no error. Verify against a live
// response before trusting search results, then remove this note.
const NEWS_SOURCES = [
  { id: 'abc-news', name: 'ABC News' },
  { id: 'al-jazeera-english', name: 'Al Jazeera' },
  { id: 'associated-press', name: 'AP News' },
  { id: 'bbc-news', name: 'BBC News' },
  { id: 'bloomberg', name: 'Bloomberg' },
  { id: 'business-insider', name: 'Business Insider' },
  { id: 'cnbc', name: 'CNBC' },
  { id: 'cnn', name: 'CNN' },
  { id: 'fortune', name: 'Fortune' },
  { id: 'fox-news', name: 'Fox News' },
  { id: 'national-geographic', name: 'National Geographic' },
  { id: 'nbc-news', name: 'NBC News' },
  { id: 'newsweek', name: 'Newsweek' },
  { id: 'politico', name: 'Politico' },
  { id: 'reuters', name: 'Reuters' },
  { id: 'the-guardian-uk', name: 'The Guardian' },
  { id: 'the-wall-street-journal', name: 'Wall Street Journal' },
  { id: 'the-washington-post', name: 'Washington Post' },
  { id: 'time', name: 'Time' },
  { id: 'usa-today', name: 'USA Today' },
];

const DEFAULT_SELECTED_SOURCE_IDS = ['bbc-news', 'associated-press', 'reuters'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NEWS_SOURCES, DEFAULT_SELECTED_SOURCE_IDS };
}
