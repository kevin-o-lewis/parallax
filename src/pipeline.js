const PIPELINE_STAGES = [
  'Fetching articles from selected sources…',
  'Analyzing with Claude…',
];

function runPipeline(topic, selectedSourceIds, onStageChange, delayMs) {
  const delay = typeof delayMs === 'number' ? delayMs : 600;

  return new Promise((resolve) => {
    let stageIndex = 0;
    onStageChange(PIPELINE_STAGES[stageIndex]);

    const advance = () => {
      stageIndex += 1;
      if (stageIndex < PIPELINE_STAGES.length) {
        onStageChange(PIPELINE_STAGES[stageIndex]);
        setTimeout(advance, delay);
      } else {
        resolve({ topic, sources: selectedSourceIds });
      }
    };

    setTimeout(advance, delay);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPipeline, PIPELINE_STAGES };
}
