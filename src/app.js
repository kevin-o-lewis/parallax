document.addEventListener('DOMContentLoaded', () => {
  const topicInput = document.getElementById('topic-input');
  const topicError = document.getElementById('topic-error');
  const sourceList = document.getElementById('source-list');
  const sourcesError = document.getElementById('sources-error');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const submitBtn = document.getElementById('submit-btn');
  const progressEl = document.getElementById('progress');

  let hasAttemptedSubmit = false;

  NEWS_SOURCES.forEach((source) => {
    const label = document.createElement('label');
    label.className = 'source-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = source.id;
    checkbox.addEventListener('change', handleFieldChange);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + source.name));
    sourceList.appendChild(label);
  });

  function getCheckboxes() {
    return Array.from(sourceList.querySelectorAll('input[type="checkbox"]'));
  }

  function getSelectedSourceIds() {
    return getCheckboxes()
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  }

  function showErrors(errors) {
    topicError.textContent = errors.topic || '';
    topicInput.classList.toggle('invalid', Boolean(errors.topic));
    sourcesError.textContent = errors.sources || '';
  }

  function handleFieldChange() {
    const { valid, errors } = validateForm(topicInput.value, getSelectedSourceIds());
    submitBtn.disabled = !valid;
    if (hasAttemptedSubmit) {
      showErrors(errors);
    }
  }

  selectAllBtn.addEventListener('click', () => {
    getCheckboxes().forEach((cb) => { cb.checked = true; });
    handleFieldChange();
  });

  deselectAllBtn.addEventListener('click', () => {
    getCheckboxes().forEach((cb) => { cb.checked = false; });
    handleFieldChange();
  });

  topicInput.addEventListener('input', handleFieldChange);

  function setFormDisabled(disabled) {
    topicInput.disabled = disabled;
    getCheckboxes().forEach((cb) => { cb.disabled = disabled; });
    selectAllBtn.disabled = disabled;
    deselectAllBtn.disabled = disabled;
    submitBtn.disabled = disabled;
  }

  submitBtn.addEventListener('click', () => {
    hasAttemptedSubmit = true;
    const topic = topicInput.value.trim();
    const selectedSourceIds = getSelectedSourceIds();
    const { valid, errors } = validateForm(topic, selectedSourceIds);

    showErrors(errors);
    if (!valid) {
      return;
    }

    setFormDisabled(true);
    progressEl.textContent = '';

    runPipeline(topic, selectedSourceIds, (stage) => {
      progressEl.textContent = stage;
    }).then((result) => {
      if (result.articles.length === 0) {
        progressEl.textContent = 'No articles found for this topic in the selected sources over the last 7 days. Try different sources or a broader topic.';
      } else if (result.analysis.facts.length === 0 && result.analysis.perspectives.length === 0) {
        progressEl.textContent = "Claude couldn't produce verifiable results for this topic. See console for data.";
      } else {
        progressEl.textContent = 'Analyzed ' + result.analysis.articlesAnalyzed + ' articles — found ' +
          result.analysis.facts.length + ' facts and ' + result.analysis.perspectives.length +
          ' perspectives. See console for full data (results display not yet implemented).';
      }
      console.log('Pipeline result:', result);
    }).catch((err) => {
      progressEl.textContent = err.message;
      setFormDisabled(false);
      console.error(err);
    });
  });

  handleFieldChange();
});
