<!-- batch msgbatch_01DfdyDAKXUp9YpkBnuBooBG, claude-opus-5-5, submitted 2026-10-14T12:43:27.198Z, ~$0.68 in tokens + 10 web searches -->
# Review: neural-networks

## Verdict
The page is ready once the fixes below are made. The model is a correct multilayer perceptron. Backpropagation is checked against finite differences, the cross-entropy is computed in a numerically stable way, and I re-ran the model in Node: every training number the narrative quotes is reproduced (64, 26–45, 40, 9, 457, 231, 45/387/never, 49, 2, 165). The most important fix concerns the catalogue: the prerequisite `gradient-descent` is not built. The body links to it five times and leans on its content ("exactly as the line was"), so as things stand those links are dead and the explanations they point to don't exist. Either build `gradient-descent` first, as the build order requires, or make these passages self-contained. After that, the main problems are a misnamed initialisation scheme, "folded" used for a tanh layer (the essay the page cites says tanh layers don't fold), a stuck-training claim the reader can't reproduce in that step, and a broken plane when a run diverges.

## Factual errors
- **medium**, steps.ts:256 (note) and network.ts:22: "Their spread is scaled to the number of inputs (Glorot and He initialisation)". The code (network.ts:107) uses sd = √(1/n_in) for tanh, linear and output layers. That is **LeCun** normal initialisation. Glorot/Xavier normal uses √(2/(n_in + n_out)), which depends on the outputs as well. Fix the text rather than the code, because every quoted epoch number depends on this initialisation:
  - Note: "Their spread is scaled to the number of inputs (LeCun initialisation, and He initialisation for ReLU layers), so that sums stay a sensible size."
  - network.ts:22: "Weights start random (LeCun scaling √(1/n_in), He scaling √(2/n_in) for ReLU hidden layers), biases at 0."
  - Sources: https://keras.io/api/layers/initializers/ (LecunNormal: stddev = sqrt(1 / fan_in); GlorotNormal: sqrt(2 / (fan_in + fan_out))) and https://proceedings.mlr.press/v9/glorot10a/glorot10a.pdf
- **medium**, steps.ts:165: "squash both coordinates with tanh: the plane is **bent**, folded into a square from −1 to 1." A tanh layer with an invertible W (the test at e2e:190 checks this) is a homeomorphism: it bends and squeezes the plane but does not fold it. That is the central point of the Olah essay cited in the note at :168. ReLU layers can fold, so "fold" at :194 in the depth step can stay.
  - Fix: "squash both coordinates with tanh: the plane is <strong>bent</strong>, squeezed into the square from −1 to 1 without being torn or folded."
  - Source: https://colah.github.io/posts/2014-03-NN-Manifolds-Topology/ (its theorem says N-to-N layers are homeomorphisms if W is non-singular; tanh and sigmoid qualify, ReLU does not).
- **medium**, steps.ts:255 and e2e:112–118: "training gets stuck in a local minimum". The stuck example (XOR, 2 hidden neurons, seed 2) is not shown to be at a minimum. When I re-ran it, the loss was still falling slowly (0.358 at epoch 100, 0.350 at 500, 0.348 at 5000) and the gradient norm at epoch 500 was 0.027, not 0. That looks like a flat stretch with saturated tanh units. For the classic 2-2-1 XOR network it has been proven that there are no true local minima: the apparent traps are saddle points or plateaus. This page uses 200 noisy points and cross-entropy, so that proof doesn't carry over exactly; I'm moderately confident it is a plateau here.
  - Fix: "…training gets stuck on a flat stretch of the loss, or in a <a …>local minimum</a>, and stops improving."
  - Rename the test to "an unlucky start can get stuck: …stays at 75%" and change its comment to "a flat region of the loss".
  - Sources: https://pubmed.ncbi.nlm.nih.gov/12662805/ (Hamey 1998, "XOR has no local minima") and https://pubmed.ncbi.nlm.nih.gov/8768396/
- **low**, steps.ts:182: "Any curve that is not a straight line will do in principle." That is true for "layers stop collapsing", but the universal-approximation result the next step cites needs a **non-polynomial** activation; z² is not a straight line and still isn't enough.
  - Fix: "Almost any curve that is not a straight line will do in principle (for the theorem in the next step, any that is not a polynomial)."
  - Source: https://www.semanticscholar.org/paper/990504fc9e5a1f3619ace4fa7f5bf667069018b1 (Leshno, Lin, Pinkus & Schocken 1993)
- **low**, steps.ts:152: "tanh, the sigmoid stretched to run from −1 to 1". In fact tanh(z) = 2σ(2z) − 1: the curve is stretched vertically and also squeezed horizontally. Fix: "tanh, a rescaled sigmoid (tanh z = 2σ(2z) − 1) that runs from −1 to 1". This is a mathematical identity, so no external source is needed.
- Other checks passed:
  - Rumelhart, Hinton & Williams, Nature 323, 533–536 (1986), and "popularised" is the right word.
  - Minsky & Papert, *Perceptrons* (1969); Cybenko 1989; Hornik 1991; Olah 2014.
  - ln 2 ≈ 0.693; δ = p − y for a sigmoid output with cross-entropy.
  - A single sigmoid neuron is logistic regression; ReLU's slope is 1 for positive sums.

## Model issues
- **medium**, network.ts:382–387 and shared.ts:93–96: a diverging run breaks the plane. The playground invites "Can you find a learning rate that is too big?". With Activation = None and η = 3, the weights become non-finite on every dataset I tried (moons 4-4 and 8-8-8; spiral, circle and XOR 8-8-8). Then:
  - `outputGrid` returns NaN, `bandOf` gives NaN, and `shade` emits `color-mix(… NaN%, …)`, which is an invalid fill, so SVG falls back to black.
  - `accuracy` counts every NaN prediction as class 0 and reports "100 of 200 (50%)".
  - Fix: in `shade`, add `if (!Number.isFinite(u)) return 'var(--nn-mid)';`. In `Run.record`, store a `diverged` flag when any weight is non-finite, and in NetworkScene's `verdict` return `'diverged: the steps were too big and the weights blew up'` when it is set.
- **low**, e2e:105–107: the test checks two hidden neurons on the circle only up to 300 epochs, but the scene runs to `MAX_EPOCHS` = 500 and the text says "always wrong". I checked: the best accuracy by epoch 500 is still 0.885, so the claim holds. Change both `300`s to `500` so the test covers what the reader sees.
- **low**, shared.ts:59: the comment says MAX_EPOCHS is reached "after about 18 s". Solving the formula gives τ ≈ 19.5 s. Change it to "about 20 s".
- **low**, BendScene.svelte:4: the docstring says the network is "trained on the four corners", but `BEND_SPEC` uses the moons. Change it to "trained on the two moons".
- Everything else checks out:
  - Forward pass, backward pass, sigmoid, tanh′ and ReLU′ are correct, and the cross-entropy formula is stable.
  - Mini-batch SGD matches the text, and the finite-difference test covers every activation and depth.
  - The collapsed linear network is checked against a single neuron.

## Narrative and scene mismatches
- **medium**, steps.ts:255: "Press Train again… Sometimes a start is unlucky and training gets stuck." This step uses the circle with 4 tanh neurons and η = 0.3. I tried seeds 1–15, which covers the first 14 presses: every one solves the circle (in 17–61 epochs), so the reader can't see a stuck start here. The only stuck case that is tested is XOR with 2 hidden neurons. Fix (playground seed = 1 + presses, so one press gives seed 2):
  - "…and its hidden neurons may share out the work differently. Some starts are unlucky: in the last step, pick <strong>Four corners</strong> with one hidden layer of 2 neurons and press <em>Train again</em> once, and training stalls at 75%."
  - Also change "ends at the same answer" to "ends at a similar boundary": the boundaries do differ between seeds.
- **low**, steps.ts:240: "it takes this network 165 steps to get every corner right". The test checks all 200 points, not 4 corners. Change it to "to get every point right".
- Everything else matches the model and the scenes:
  - The neuron step's line and labels.
  - The shapes the hidden layer and depth steps describe (band, single line, pieces with corners).
  - The 8×2 / 8×8 / 1×8 collapse.
  - The backprop readouts (δ, a × δ, the 0.001 nudge, the loss before and after).

## Catalogue requirements
- **high**, steps.ts:134, 135, 239, 253, 255: the prerequisite `gradient-descent` is unticked in the checklist, so `neural-networks` isn't ready to build under the definition of done or the build order. The links `../gradient-descent/#settings`, `#descend` (twice), `#train` and `#valleys` are hand-written in the body, so the shell's filter doesn't remove them, and they 404. ":135 …exactly as the line was" refers to content that doesn't exist; the catalogue's gradient-descent entry doesn't fit a line at all.
  - Fix: build `gradient-descent` first. Until then, remove the anchors and make each passage self-contained, for example at :135: "…trained by gradient descent: work out which way each parameter should move to lower the loss, take a small step that way, and repeat." Also check that the anchors `#matrix` and `#compose` exist on `linear-transformations`.
- **medium**, entry Interaction, "Pause to step through one example": the step-through uses a fixed 2-2-1 tanh network on XOR (network.ts:480–509), not the network the reader built and trained. A fixed small network is the better teaching choice, so I propose changing the catalogue entry to: "Then step through one example on a small 2-2-1 network: values flow forward, then error signals flow backward and adjust each weight."
- **low**, Interaction, "build a network by adding layers and neurons": every hidden layer has the same width. This is acceptable, but "solve the spirals with the fewest neurons" (:274) can only mean whole-layer widths. Either say "the narrowest network" or allow a width per layer.
- The Takeaway is visible without the text (bent boundaries, per-neuron squares, the bent-plane morph), and the Pitfall field is empty.

## Clarity
- **medium**, steps.ts:151, 165, 209: tanh appears in the body at the bend and forward steps, but it is only explained in the "Go deeper" note of the hidden step (:152). Move that sentence into the hidden step's body: "In the hidden layers the squash is tanh, a rescaled sigmoid that runs from −1 to 1."
- **medium**, steps.ts:136, 151: "epoch" appears in the readout from the train-neuron step onward and in the text at :151 ("at epoch 64"), but it is first defined at :253. Define it at :136: "…within a couple of <dfn …>epochs</dfn> (passes through all the data) every point is on the right side."
- **low**, steps.ts:239: η is used in the formula without being defined in the body; until :253 it only appears in a control's help text. Add: "…here with a learning rate (step size) η = 0.5."

## Sources consulted
- https://www.nature.com/articles/323533a0 (Rumelhart, Hinton & Williams 1986)
- https://keras.io/api/layers/initializers/ (LeCun, Glorot and He initialiser definitions)
- https://proceedings.mlr.press/v9/glorot10a/glorot10a.pdf (Glorot & Bengio 2010)
- https://colah.github.io/posts/2014-03-NN-Manifolds-Topology/ (tanh layers are homeomorphisms; ReLU layers are not)
- https://www.semanticscholar.org/paper/990504fc9e5a1f3619ace4fa7f5bf667069018b1 (Leshno et al. 1993, non-polynomial activations)
- https://dl.acm.org/doi/10.1016/0893-6080(91)90009-T (Hornik 1991)
- https://pubmed.ncbi.nlm.nih.gov/12662805/ (Hamey 1998, XOR has no local minima)
- https://pubmed.ncbi.nlm.nih.gov/8768396/ (Sprinkhuizen-Kuyper & Boers 1996)
- I re-ran network.ts in Node 22 with the shared `rng`. That gave the quoted epoch numbers, the stuck XOR run's loss and gradient, the lr = 3 divergence, the seed 1–15 sweep for "Train again", and the dataset bounds.
