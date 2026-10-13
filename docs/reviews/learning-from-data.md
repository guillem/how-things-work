<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.45 in tokens + 3 web searches -->
# Review: learning-from-data

## Verdict
The page is ready after the fixes below. The model is sound. Fits are real least squares in a Legendre basis, and the errors are real MSEs. I re-ran the model in Node: training error never rises, the test error on the default set is U-shaped (best at degree 6, about 22 at degree 12), and the sweet spot moves the way the text says when the number of examples or the noise changes. The most important fix is the closing claim of the "sweet spot" step. It says flexibility in "neural networks with billions of settings" is always chosen by the U-shaped held-out error. That is misleading, because very over-parameterised models often show double descent. The scene's own comment admits that degrees with more settings than examples are hidden because their test error "can even dip". Second in importance: the page asks readers to compare the test error with "the noise" when the two numbers are in different units, and it doesn't build the catalogue's "place points" part of the interaction.

## Factual errors
- The Gauss/Legendre date (steps.ts:106) is correct. In 1805 Legendre published "Nouvelles méthodes…", and Gauss wrote that he had been using the principle since 1795 (https://arxiv.org/pdf/1802.09966), so "around 1800" is fair. The other factual claims check out (a degree-d polynomial has at most d − 1 turning points; training error can't rise when the models are nested; validation versus test sets; cross-validation).

## Model issues
- **low**, fit.ts:40–42. The docstring says "Every third point (from `offset`)", but there is no `offset` parameter; test points are those with `i % testEvery === 1`. Fix: "Every `testEvery`-th point, starting at index 1, is marked as a test point."
- **low**, FitScene.svelte:64 and :104. `degree` and `fresh` from the params are not clamped or guarded, unlike in CurveScene. A deep link with `degree=50` fits degree 50. A non-numeric value gives NaN, and then `legendre` returns `[]` and the fit breaks. Fix: `Math.round(clamp(Number(params.degree ?? 3), 0, 12)) || 0`, and `1 + (Number(params.fresh ?? 0) || 0)`.
- **low**, e2e/fit-model.e2e.ts:70. `n - Math.ceil(n / 3) - 1` is not the number of training points minus one. For n = 40 it gives 14 test points, but the real count of `i % 3 === 1` is 13. It is harmless here because of the `min(12, …)`, but fragile. Fix: `const nTest = Math.floor((n + 1) / 3); const maxDegree = Math.min(12, n - nTest - 1);`. Better still, count `d.filter(p => !p.test).length`.
- **low**, CurveScene.svelte:9–12 and :87–88. The geometric mean of a test MSE is biased low: with k test points it is about exp(ψ(k/2) − ln(k/2)) × σ², roughly 0.86σ² for 7 points and 0.69σ² for 3. In my runs the averaged sweet-spot error always stayed above σ² (for example 0.0264 against 0.0225 at 21/0.15, and 0.174 against 0.16 at 80/0.4). So the "never below the noise" claim is not contradicted today. If a noise-floor line is added (see below), mention this bias or use the arithmetic mean for that comparison.
- The tests do check real properties: textbook slope and intercept, interpolation when the number of coefficients equals the number of points, monotone training error, a U-shaped test error, and the direction the sweet spot moves.

## Narrative and scene mismatches
- **medium**, steps.ts:172 together with CurveScene.svelte:560 and steps.ts:32–41. The text says the test error drops "never below the noise itself". The scene shows "noise 0.15" (a standard deviation) next to test errors of about 0.025 (squared units). A reader comparing the two sees the error far below "the noise". Fix: draw a dashed horizontal line at `lg(noise**2)` in the `data` phase, labelled `noise floor (noise² = ${(noise**2).toFixed(4)})`. Change the text to "…though never below the size of the noise itself (the noise squared, shown as a dashed line), which no model can predict." Optionally, add the noise control's help text: "Typical size of the random wobble of each example; its square is the smallest test error any model can expect."
- Apart from this, the text matches what the scenes compute. Squares have area = gap² (equal scales). The training error readout refers to the 21 points in the degree/overfit steps and the 14 solid dots in the test step. There are seven hollow test dots. Degree-12 fits do swing past the end dots: with 21 points, |f| reaches 22–73 just outside the data in my runs, and the scene's swing detector words the label to match. The sweet spot moves right with more data (6 → 7) and with less noise (5 → 6 → 7).

## Catalogue requirements
- **medium**, FitScene.svelte (interaction). The entry says "Place and drag points on a plane". Readers can drag the 21 generated dots but cannot add (or remove) one. Fix: clicking an empty spot in the plot adds an example (store it in `params.pts` with a new id ≥ 21), and Delete or a double-click removes a reader-added one. Alternatively, propose changing the entry to "Drag points…".
- **low**, FitScene.svelte:13 and :109. "Hold some points back as a test set" is done by the page (every third point), not by the reader. That is acceptable, but letting the reader click a dot to switch it between training and test in the test step would match the entry more closely.
- **low**, steps.ts:61. The display title is "How machines learn from examples", but the catalogue Title is "Learning from data". Use the catalogue title, or put it in the catalogue if the new one is preferred.
- The takeaway is visible in the graphic: the two curves diverge, with "too stiff / too flexible" brackets. There is no Pitfall field and no Needs field. The data are synthetic and the page says so.

## Clarity
- **low**, steps.ts:118 (polynomial definition). "a + b·x + c·x² + …" reuses *a* and *b* with different roles from the previous step, where *a* is the slope and *b* the height. Replace with: "A curve made of powers of x: c₀ + c₁·x + c₂·x² + …; its degree is the highest power, and a degree-d curve has d + 1 settings. It can turn up to d − 1 times."
- **low**, CurveScene.svelte:322–329 and :544. The shaded label "more settings than training examples (14)" assumes the reader knows that degree d has d + 1 settings, which the page never says. The definition fix above supplies it.
- **low**, CurveScene.svelte:568–569. "averaged … (on the log scale)" is opaque at level 1. Suggest: "errors averaged over 40 random sets of examples (a typical value, so one wild set does not dominate); the inset shows one".

## Sources consulted
- Belkin, Hsu, Ma, Mandal, "Reconciling modern machine-learning practice and the classical bias–variance trade-off", PNAS 116 (2019): https://www.pnas.org/doi/10.1073/pnas.1903070116
- Sheynin, *Theory of Probability: A Historical Essay* (Gauss's use since 1795, Legendre 1805): https://arxiv.org/pdf/1802.09966
- History of least squares (Legendre 1805): https://arxiv.org/pdf/math/0609789
- Gauss/Legendre publication dates: https://www.actuaries.asn.au/research-analysis/gauss-least-squares-and-the-missing-planet
- My own re-run of `fit.ts` in Node: averaged sweet spots and errors for several (count, noise) pairs, the size of the degree-12 swing on 21 points, and single-set test-error curves for seeds 1–8.
