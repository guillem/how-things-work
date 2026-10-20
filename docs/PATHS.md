# Paths

Ordered readings of topics that already exist. A topic stays in its category. The reading order
of a path is its chapters, concatenated. Add a `##` block for each path, with single-line Title
and Promise fields and named chapters of comma-separated catalogue slugs. Stops must be unique
within a path and follow any prerequisites that are also stops; off-path prerequisites remain
on the explainer's “Read first” list. The build validates these rules against `docs/TOPICS.md`.

## language-models

- **Title:** How a language model works
- **Promise:** From a model that only counts the next word to one that is trained, aligned and served.
- **Chapters:**
  - Counting: learning-from-data, ngram-text-models
  - The network: gradient-descent, neural-networks, embeddings
  - The model: language-models, transformers, tokenization, positional-encoding, residual-stream-logit-lens
  - Training and serving: training-a-tiny-language-model, scaling-laws, rlhf-alignment, chain-of-thought-scratchpad, kv-cache-inference, speculative-decoding
