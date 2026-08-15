function validateForm(topic, selectedSourceIds) {
  const errors = { topic: null, sources: null };

  if (!topic || topic.trim().length === 0) {
    errors.topic = 'Please enter a topic.';
  }

  if (!Array.isArray(selectedSourceIds) || selectedSourceIds.length === 0) {
    errors.sources = 'Please select at least one source.';
  }

  const valid = errors.topic === null && errors.sources === null;
  return { valid, errors };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateForm };
}
