const FETCH_STAGE_LABEL = 'Fetching articles from selected sources…';
const ANALYZE_STAGE_LABEL = 'Analyzing articles…';

function runPipeline(topic, selectedSourceIds, onStageChange) {
  onStageChange(FETCH_STAGE_LABEL);

  const params = new URLSearchParams({ topic, sources: selectedSourceIds.join(',') });

  return fetch('/api/articles?' + params.toString())
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong fetching articles.');
      }

      if (data.length === 0) {
        return { topic, sources: selectedSourceIds, articles: data, analysis: null };
      }

      onStageChange(ANALYZE_STAGE_LABEL);

      return fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, articles: data }),
      })
        .then((analyzeResponse) => analyzeResponse.json().then((analyzeData) => ({ analyzeResponse, analyzeData })))
        .then(({ analyzeResponse, analyzeData }) => {
          if (!analyzeResponse.ok) {
            throw new Error(analyzeData.error || 'Something went wrong analyzing articles.');
          }
          return { topic, sources: selectedSourceIds, articles: data, analysis: analyzeData };
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPipeline, FETCH_STAGE_LABEL, ANALYZE_STAGE_LABEL };
}
