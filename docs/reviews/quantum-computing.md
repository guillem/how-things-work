<!-- batch msgbatch_01DfdyDAKXUp9YpkBnuBooBG, claude-opus-5-5, submitted 2026-10-14T12:43:27.198Z, ~$0.70 in tokens + 12 web searches -->
# Review: quantum-computing

## Verdict
The page is ready after the fixes below. The simulator is correct: I checked every gate, the Bloch-vector formula, the partial trace, CNOT, CHSH, the diffusion step and the best Grover iteration count by hand. Nearly every number in the narrative checks out (0.18 / 0.88 / 78%, 94.5%, 804, 17 GB, 18 PB, S = 2√2). The most important fix is the Bell step. It says the cos²(angle/2) curve, measured with A always along z and only B's axis turning, cannot come from answers agreed in advance. That is false: with one setting on one side, a local model can always reproduce the curve. The other blocking problem is the prerequisite `quantum-mechanics`. It is not built, and the narrative links to its anchors five times and leans on "the double-slit page".

## Factual errors
- **high**: steps.ts:300–301 ("Let A be measured along z and turn the axis along which B is measured… John Bell (1964) showed that answers fixed in advance, for every axis, cannot reproduce this curve.") If A only ever measures along z, a local model reproduces cos²(angle/2) exactly. For example, a hidden variable λ fixes A's bit and a uniform number u, and B answers "agree" if u < cos²(b/2). A Bell inequality needs at least two settings on each side (Fine 1982; Brunner et al. review). The violation shows up only in the CHSH panel, where A also switches between 0° and 90°. I am highly confident of this. Fix: replace the sentence with: "John Bell (1964) showed that once **both** sides choose between axes, answers fixed in advance cannot reproduce these correlations. (With A's axis fixed, as on the plot, they could: the test needs A to switch too.) In the form of Clauser, Horne, Shimony and Holt, A chooses between two axes and B between two…" Better still, also add a toggle for A's axis (0°/90°) on this step; see Catalogue requirements. Sources: https://qutech.nl/wp-content/uploads/2017/03/Bell-nonlocality.pdf, http://courses.washington.edu/philo482/Bell.pdf
- **medium**: steps.ts:205, 238, 253, 270, 343; GroverScene.svelte:434 ("even mixtures", "an even mixture", "A in an even mixture", "an even mixture of the rest", "(even mix of N − 1)"). In quantum information, "mixture" means a *mixed state*, a statistical ensemble inside the Bloch ball. That is exactly what the page later shows as the shrunken arrow of an entangled qubit. Calling |+⟩ a mixture blurs the distinction the entanglement step depends on, and at level 3 it is plainly wrong usage. Fix: use "equal superposition(s)" everywhere. Introduce the word once at steps.ts:205: "…and round the equator the equal **superpositions**, which differ only in their relative phase φ". Change the scene label to "(equal superposition of N − 1)". Source: https://edu.itp.phys.ethz.ch/hs12/qsit/qsitqit12-ex01_sol.pdf
- **low**: steps.ts:360 ("Grover only halves the effective key length, which is why 256-bit keys are recommended"). This is too strong. Grover's search parallelises badly, and NIST's post-quantum security category 1 is defined by AES-128 key search, so AES-128 is not considered broken by Grover. Fix: "…Grover at best halves the effective key length, and because it parallelises poorly, even that overstates the threat; some guidance still asks for 256-bit keys as a margin." Source: https://words.filippo.io/128-bits/

## Model issues
- **low**: PairScene.svelte:166–176. `elapsed` assigns to plain `let` variables (`lastB`, `t0`) inside `$derived`. Whether the run restarts after an angle change then depends on when the derived happens to re-evaluate (for example, after a remount it keeps the old `t0`). Fix: track the start time in an `$effect` on `bDeg` that sets a `$state` `t0 = t`.
- **low**: e2e test 'Bell's test…' (lines 157–166) checks the classical bound only for one product state. That does not test the bound the page claims. Fix: add a test that every deterministic local strategy (the 16 assignments of ±1 to a, a′, b, b′) gives |S| ≤ 2.

Otherwise the model checks out: the gate matrices, `rotation`, `GATE_TURNS` phases, the Bloch vector r = (2Re ρ₀₁, −2Im ρ₀₁, ρ₀₀−ρ₁₁), `cnot`, `diffuse` = 2|s⟩⟨s| − 1, `bestIterations` (1, 2, 3, 25, 804) and E = cos(a−b) are all correct.

## Narrative and scene mismatches
- **medium**: steps.ts:297 vs PairScene.svelte:82. The Bell step offers the button "Prepare and measure 100 pairs" (`pairRuns`), but the scene ignores every press on this step (`if (isBell) return;`), so the button does nothing. Fix: `controls: [bobAxis]`. Alternatively, make the button restart the stream of pairs.
- **medium**: steps.ts:217, 221. The measure step says "every point on a circle of latitude gives the same odds", and the scene draws that circle. But the step's controls are `[theta, measureOnce, measureMany]`, and the drag handle only exists in the 'state' phase, so the reader cannot move round the latitude to see it. Fix: `controls: [theta, phi, measureOnce, measureMany]`.
- **low**: steps.ts:206 ("the way the double-slit page drew amplitudes"), :219, :254, :256, :360. These refer to a page that does not exist yet (see below). Until it does, drop the back-references, e.g. "The dials beside the sphere show α and β as arrows in the complex plane".

## Catalogue requirements
- **high**: steps.ts:203, 219, 254, 256, 360. The prerequisite `quantum-mechanics` is unticked in the checklist. Under the build-order rule, this topic is not ready to build, and the hard-coded inline links (`../quantum-mechanics/#amplitudes`, `#measure`, `#detector`) are dead. The shell will not show it as "Read first" either. Fix: build `quantum-mechanics` first. Otherwise, make these links plain text for now and add a one-line recap of amplitudes and Born's rule to step 1 (Definition of done #3, #4).
- **medium**: Interaction ("Entangle two qubits and compare their results"). This is built, but the "compare" on the Bell step lets only B's axis move. That is what produces the factual error above. Fix: add a control `aliceAxis` (select 0° / 90°) and plot the agreement for the chosen pair, so the reader can produce the four CHSH correlations themselves.
- **low**: Pitfall, steps.ts:316 ("In a sense it has checked all eight at once."). The next paragraph corrects it, but the sentence itself states the misconception the pitfall forbids. Fix: "One call of the oracle has acted on all eight amplitudes, but that is not the same as having checked them:"

The rest of the interaction is built as written: gates on the Bloch sphere, repeated measurement statistics, and a step-by-step Grover run with the right answer's amplitude growing. The takeaway is visible on the speedup panel and in the rotation plot.

## Clarity
- **low**: steps.ts:345 ("the number of rounds needed grows only by √2"). This reads as an additive +1.41. Fix: "grows only by a factor of √2 ≈ 1.41."
- **low**: steps.ts:300 / PairScene. "Correlation" and E (the mean of the product of the ±1 results) are defined only in the notes, but the body uses "four correlations". Fix: add "(the average of the product of the two results, counted as +1 and −1)" after "four correlations" in the body.

## Sources consulted
- Brunner et al., "Bell nonlocality" (Rev. Mod. Phys. 2014): https://qutech.nl/wp-content/uploads/2017/03/Bell-nonlocality.pdf
- A. Fine, "The Bell theorem" (Fine 1982 on joint distributions): http://courses.washington.edu/philo482/Bell.pdf
- Hensen et al. 2015, loophole-free Bell test (Delft): https://www.nature.com/articles/nature15759
- 2022 Nobel Prize in Physics: https://www.optica.org/about/newsroom/news_releases/2022/october/aspect_clauser_zeilinger_awarded_2022_nobel_prize/
- Bennett, Bernstein, Brassard, Vazirani 1997, SIAM J. Comput.: https://dl.acm.org/doi/10.1137/S0097539796300933
- Zalka 1999, "Grover's quantum searching algorithm is optimal": https://arxiv.org/pdf/quant-ph/9711070
- Høyer, Neerbek, Shi 2001, quantum sorting lower bound: https://arxiv.org/pdf/quant-ph/0102078
- ETH QSIT exercise on mixed states vs superpositions: https://edu.itp.phys.ethz.ch/hs12/qsit/qsitqit12-ex01_sol.pdf
- Valsorda, Grover and 128-bit keys (quotes NIST security categories): https://words.filippo.io/128-bits/
