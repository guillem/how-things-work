The user asked that, where the split has to be uneven, it lean towards AI, ideally with a
complete set of explainers for understanding large language models in detail. With the existing
pages (marked _existing_) the ladder reads, bottom to top:

| Stage                   | Page                                                                     | Level |
| ----------------------- | ------------------------------------------------------------------------ | ----- |
| Door                    | next-word-guessing-game: a chatbot writes by guessing one word at a time | 0     |
| Counting models         | ngram-text-models: why counting what came next cannot reach far back     | 1     |
| Learning                | learning-from-data, gradient-descent, neural-networks (_existing_)       | 1–2   |
| Tokens                  | tokenization: byte-pair encoding                                         | 3     |
| Meaning as position     | embeddings (_existing_)                                                  | 2     |
| The next token          | language-models (_existing_): probabilities, temperature, top-p          | 2     |
| Attention               | transformers (_existing_)                                                | 3     |
| Order                   | positional-encoding: sinusoids and RoPE                                  | 3     |
| Inside a block          | residual-stream-logit-lens: the residual stream and the logit lens       | 3     |
| Training                | training-a-tiny-language-model: a transformer trained live in the page   | 3     |
| Scale                   | scaling-laws: loss against model size, data and compute                  | 3     |
| From model to assistant | rlhf-alignment: a reward model and the KL leash                          | 3     |
| Reasoning               | chain-of-thought-scratchpad: why writing the steps out helps             | 3     |
| Serving                 | kv-cache-inference: why generation is memory-bound                       | 3     |
| Faster serving          | speculative-decoding: a small model guesses, the big one checks          | 3     |

The selection filled AI's nine level-3 slots with one page per stage first (the best-scored
candidate of each stage; `kv-cache-inference` was proposed under Computing and is filed under AI
with the rest of the ladder). The rungs left out are not rejected (several scored as well as the stage winners) and are listed as the ladder's second wave under "Candidates that did not make the
hundred" (mixture of experts, quantization, LoRA, instruction tuning, reasoning trained with
verifiable rewards, long context, induction heads, superposition, retrieval-augmented generation,
where facts live, distillation, adaptive optimizers). Promoting them needs more AI slots than
this hundred has; that is one of the open questions.
