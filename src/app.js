document.addEventListener('DOMContentLoaded', () => {
  const topicInput = document.getElementById('topic-input');
  const topicError = document.getElementById('topic-error');
  const sourceList = document.getElementById('source-list');
  const sourcesError = document.getElementById('sources-error');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const submitBtn = document.getElementById('submit-btn');
  const progressEl = document.getElementById('progress');
  const searchView = document.getElementById('search-view');
  const resultsView = document.getElementById('results-view');
  const resultsContent = document.getElementById('results-content');
  const backToSearchBtn = document.getElementById('back-to-search-btn');

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

  function showResultsView(topic, analysis) {
    resultsContent.innerHTML = renderResultsHTML(topic, analysis);
    searchView.hidden = true;
    resultsView.hidden = false;
    const heading = resultsContent.querySelector('h2');
    if (heading) {
      heading.focus();
    }
  }

  function showSearchView() {
    resultsView.hidden = true;
    searchView.hidden = false;
    topicInput.focus();
  }

  // One delegated listener handles every citation toggle button: results
  // content is replaced wholesale via innerHTML on every search, so
  // individual toggle buttons never exist at page load to bind directly.
  // Each toggle's quotes block is rendered as its next DOM sibling (see
  // src/results.js), so no per-card ids are needed to find it.
  resultsContent.addEventListener('click', (event) => {
    const toggle = event.target.closest('.quote-toggle');
    if (!toggle) {
      return;
    }
    const quotesEl = toggle.nextElementSibling;
    if (!quotesEl) {
      return;
    }
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    quotesEl.hidden = expanded;
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.textContent = expanded ? 'show quotes' : 'hide quotes';
  });

  backToSearchBtn.addEventListener('click', () => {
    showSearchView();
  });

  submitBtn.addEventListener('click', () => {
    hasAttemptedSubmit = true;
    const topic = topicInput.value.trim();
    const selectedSourceIds = getSelectedSourceIds();
    const { valid, errors } = validateForm(topic, selectedSourceIds);

    showErrors(errors);
    if (!valid) {
      return;
    }

    resultsView.hidden = true;
    searchView.hidden = false;
    setFormDisabled(true);
    progressEl.textContent = '';

    runPipeline(topic, selectedSourceIds, (stage) => {
      progressEl.textContent = stage;
    }).then((result) => {
      if (result.articles.length === 0) {
        progressEl.textContent = 'No articles found for this topic in the selected sources over the last 7 days. Try different sources or a broader topic.';
        setFormDisabled(false);
      } else if (result.analysis.facts.length === 0 && result.analysis.perspectives.length === 0) {
        progressEl.textContent = "Claude couldn't produce verifiable results for this topic. See console for data.";
        setFormDisabled(false);
      } else {
        progressEl.textContent = '';
        setFormDisabled(false);
        showResultsView(result.topic, result.analysis);
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
