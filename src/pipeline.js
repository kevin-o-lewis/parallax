const FETCH_STAGE_LABEL = 'Fetching articles from selected sources…';

function runPipeline(topic, selectedSourceIds, onStageChange) {
  onStageChange(FETCH_STAGE_LABEL);

  const params = new URLSearchParams({ topic, sources: selectedSourceIds.join(',') });

  return fetch('/api/articles?' + params.toString())
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong fetching articles.');
      }
      return { topic, sources: selectedSourceIds, articles: data };
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPipeline, FETCH_STAGE_LABEL };
}
