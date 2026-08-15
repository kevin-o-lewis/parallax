const NEWS_SOURCES = [
  { id: 'abc-news', name: 'ABC News' },
  { id: 'al-jazeera-english', name: 'Al Jazeera' },
  { id: 'associated-press', name: 'AP News' },
  { id: 'ars-technica', name: 'Ars Technica' },
  { id: 'bbc-news', name: 'BBC News' },
  { id: 'bloomberg', name: 'Bloomberg' },
  { id: 'business-insider', name: 'Business Insider' },
  { id: 'cnbc', name: 'CNBC' },
  { id: 'cnn', name: 'CNN' },
  { id: 'engadget', name: 'Engadget' },
  { id: 'fortune', name: 'Fortune' },
  { id: 'fox-news', name: 'Fox News' },
  { id: 'hacker-news', name: 'Hacker News' },
  { id: 'ign', name: 'IGN' },
  { id: 'mashable', name: 'Mashable' },
  { id: 'national-geographic', name: 'National Geographic' },
  { id: 'nbc-news', name: 'NBC News' },
  { id: 'new-scientist', name: 'New Scientist' },
  { id: 'newsweek', name: 'Newsweek' },
  { id: 'politico', name: 'Politico' },
  { id: 'reuters', name: 'Reuters' },
  { id: 'techcrunch', name: 'TechCrunch' },
  { id: 'techradar', name: 'TechRadar' },
  { id: 'the-guardian-uk', name: 'The Guardian' },
  { id: 'the-next-web', name: 'The Next Web' },
  { id: 'the-verge', name: 'The Verge' },
  { id: 'the-wall-street-journal', name: 'Wall Street Journal' },
  { id: 'the-washington-post', name: 'Washington Post' },
  { id: 'time', name: 'Time' },
  { id: 'usa-today', name: 'USA Today' },
  { id: 'wired', name: 'Wired' },
];

const DEFAULT_SELECTED_SOURCE_IDS = ['bbc-news', 'associated-press', 'reuters'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NEWS_SOURCES, DEFAULT_SELECTED_SOURCE_IDS };
}
