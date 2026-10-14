<!-- batch msgbatch_01XuwfDGdxyMhDDG3Le4gzHm, claude-opus-5-5, submitted 2026-10-14T13:43:56.836Z, ~$1.30 in tokens + 11 web searches -->
# Review: transformers

## Verdict
The page is ready once the fixes below are made. The model is sound: `attend` is the real causal scaled dot-product attention, the parameter count matches GPT-2 small exactly (124,439,808), the data comes from a pinned revision, and the tests check the page's own claims against the model's stored weights and outputs. Every head the page names matches the published interpretability work. The most important fix is a factual slip in the "mix" step: *animal* is seven tokens before *it*, not four. Two more need attention:
- The catalogue's "Type a sentence" interaction is not built. That should be raised and resolved openly with the user, not left as a quiet change.
- Two statistics the heads step quotes cannot be seen anywhere on the stage.

## Factual errors
- **High**, steps.ts:227. The text says *animal* is "four tokens away". In GPT-2's tokens *animal* is no. 2 and *it* is no. 9 (didn, 't, cross, the, street and because lie between them), so it is seven tokens back. Fix: "…information that came from *animal*, seven tokens back, in a single operation."
- **Medium**, steps.ts:166 (also the test at e2e:131). The text says position 0's vector "is twice as long as the others". The shipped norms are 9.88 for position 0 against 5.19 (position 1) down to 3.35 (position 63), so it is 1.9 to 2.9 times as long. Fix: "Position 0 is the odd one out: its vector is two to three times as long as the others (9.9, against 3.4–5.2)."
- **Medium**, steps.ts:291. The text says "Both papers count layers and heads from 0: our layer 6, head 6 is their head 5.5." Olsson et al. studied Anthropic's own models and do not label GPT-2 heads such as 5.5. The 0-based L.H labels come from Wang et al. and from TransformerLens-based work, where 5.1 and 5.5 are the GPT-2 small induction heads. I am fairly confident (about 80%). Fix: "Wang and colleagues, like most interpretability tools, count layers and heads from 0: our layer 10, head 10 is their name mover 9.9, and our layer 6, head 6 is the induction head usually called 5.5." Sources: https://arxiv.org/abs/2209.11895, https://arxiv.org/abs/2211.00593, https://arxiv.org/pdf/2406.17759
- **Low**, steps.ts:187. "Normalised first by a LayerNorm, which rescales it to mean 0 and spread 1" leaves out the learned per-feature scale and shift that GPT-2's LayerNorms apply. For level 3, fix: "…which rescales it to mean 0 and spread 1, then applies a learned scale and shift per number". Source: https://docs.pytorch.org/docs/2.9/generated/torch.nn.modules.normalization.LayerNorm.html
- **Low**, steps.ts:201. "The dot product of two vectors of 64 random numbers grows like √64" is loose. Vaswani et al. argue from variance: with independent unit-variance components, the variance of q·k is d. Fix: "If q and k have 64 independent components of mean 0 and variance 1, their dot product has variance 64, so its typical size is √64 = 8. Without the division … the softmax would be pushed into regions with tiny gradients and learning would stall." Source: https://arxiv.org/html/1706.03762v7 (§3.2.1, footnote 4)
- **Low**, steps.ts:243. "Because the whole table is one matrix product … why transformers replaced older networks" is true of training, where every position of a known text is processed at once. Generation is still one token at a time. Fix: append "…when training on a known text (writing new text still goes one token at a time)."
- **Low**, steps.ts:285. "With a weight near 1" overstates what the data guarantees: the test only checks > 0.6 on every sentence, and > 0.95 on *count*. Fix: "with a weight usually above 0.9 (never below 0.6 on these sentences)", or tighten the test to match the claim.

## Model issues
- **Low**, e2e/transformers-model.e2e.ts:108–123. The page's "about 60% of all attention goes to ⟨start⟩" (steps.ts:256) is checked only as > 0.55, and only on the animal sentence. Fix: average over all eight sentences, assert `toBeCloseTo(0.6, 1)`, and say on the page that it is an average over the eight sentences.
- **Low**, scenes/AttentionScene.svelte:61–63, 78, 143. The q, k, v and output bars are clamped silently by `bars(…, max)`, and the scores by `sx` to [−7, 3]:
  - keys: ±6.2 units, while dimension 45 of the keys is about −12 for every token but ⟨start⟩;
  - queries: ±2.9; values: ±1; output: ±1.1.
  
  The reader cannot tell a clipped bar from a real one. Fix: mark clipped bars, e.g. draw them in a separate path with a small cap or arrow, and add a legend line "bars cut off at the edge are larger than shown".
- Otherwise the model checks out: softmax with max-shift, masking by slicing, √d with d = 64, 8-bit row decoding, parameter formula with tied output embedding. The tests compare the recomputed weights and outputs against the model's stored ones and check the published head roles.

## Narrative and scene mismatches
- **Medium**, steps.ts:256–257. The heads scene shows one layer's 12 patterns. It shows neither "about 60% of all attention goes to that one token" (across 144 heads) nor "first five layers … 2 to 3 tokens back, the last three about 4" (averaged over all sentences). "Move through the layers" promises a change the reader cannot see. Fix: add two readouts to HeadsScene: "this layer: X% of attention on ⟨start⟩" and "average distance back (⟨start⟩ left out): Y tokens", computed with the same formula as the `reach` test. Then reword: "…in the first five layers, lands on average 2 to 3 tokens back (see the readout), in the last three about 4."
- **Low**, scenes/AttentionScene.svelte:404. The caption "the whole table is one product, Q Kᵀ" is not what is shown: the table is softmax(Q Kᵀ/8 + M). Fix: "the scores are one product, Q Kᵀ," / "then a softmax, row by row".
- **Low**, scenes/TokenScene.svelte:70. "“it” starts as the same 768 numbers as in any other text" is not quite right, because the input also adds a position vector. That contradicts the other caption on line 71 and the stage's own "= the token's input vector". Fix: "“it” has the same token embedding as in any other text: nothing in those 768 numbers says “animal”."
- **Low**, scenes/StackScene.svelte:33 and 149–151. The arc's argmax includes the last token itself (k runs to n−1). When self wins, no arc is drawn, even though the label promises "the earlier token … listens to most". Fix: loop `for (let k = 1; k < s.n - 1; k++)`, or say "(itself and ⟨start⟩ left out)".
- **Low**, steps.ts:324. "Each head of each layer finds its own earlier tokens to listen to" clashes with the page's own finding that most heads rest on ⟨start⟩. Fix: "…the few heads that light up away from ⟨start⟩ each find their own earlier tokens to listen to."

## Catalogue requirements
- **Medium**, catalogue Interaction vs steps.ts:271. The Interaction says "Type a sentence". The page offers eight fixed sentences and explains why on the page, but the entry was not questioned, as the preamble requires ("say so and propose a change"). The entry is also internally inconsistent: its Needs allows "precomputed" weights, which cannot cover arbitrary typed text. Fix, either:
  - (a) propose to the user changing the Interaction to "Pick one of several sentences run through a real small transformer…"; or
  - (b) run a quantized GPT-2 in the browser (ONNX via Transformers.js, far smaller than the 548 MB safetensors at https://huggingface.co/openai-community/gpt2/tree/607a30d7) for a "your own sentence" mode.
  
  Also, steps.ts:271 attributes the limit to "downloading its 550 MB of weights" as if that were unavoidable; with (b) not chosen, reword to "…running GPT-2 in your browser, a download of hundreds of megabytes".
- The rest of the entry is met: hover over a token in any layer and head (explore), the stepped q·k → softmax → mix operation, real precomputed weights (Needs met with a pinned, licensed source), and a Takeaway visible in the explore grid and the stack scene.

## Clarity
- **Low**, scenes/AttentionScene.svelte:222. The header "score (0 here)" is ambiguous. Fix: "score (line = 0)".
- **Low**, steps.ts:215. "*The* and *street* mostly at ⟨start⟩" is backed only by an argmax test. Fix: "look hardest at ⟨start⟩", or give the weights.
- Otherwise the pitch suits level 3, and every term is defined before use.

## Sources consulted
- Vaswani et al., Attention Is All You Need: https://arxiv.org/html/1706.03762v7
- Wang et al., Interpretability in the Wild (26-head IOI circuit, 0-based head labels): https://arxiv.org/abs/2211.00593
- Olsson et al., In-context Learning and Induction Heads: https://arxiv.org/abs/2209.11895
- GPT-2 small induction heads 5.1 / 5.5: https://arxiv.org/pdf/2406.17759
- Xiao et al., Efficient Streaming Language Models with Attention Sinks: https://arxiv.org/abs/2309.17453
- PyTorch LayerNorm documentation: https://docs.pytorch.org/docs/2.9/generated/torch.nn.modules.normalization.LayerNorm.html
- Hugging Face openai-community/gpt2 at revision 607a30d7: https://huggingface.co/openai-community/gpt2/tree/607a30d7
