<!-- batch msgbatch_01Vd3QBkoZjG75GmguRDxBiq, claude-opus-5-5, submitted 2026-10-15T04:42:12.752Z, ~$2.34 in tokens + 9 web searches -->
# Review: diffusion-models

## Verdict
The page is ready once the fixes below are made. I checked every number the narrative quotes against the model and found them right: the schedule values, the crossing at step 260, ᾱ₁₀₀₀ ≈ 4·10⁻⁵, the 86% two-sigma disc, the weight counts 5,394 and 1,723,504, and the min-SNR weights 0.6, 0.15 and 0.0005. The sampler is a faithful implementation of Ho et al.'s posterior (eqs. 6–7) with Nichol & Dhariwal's respacing, and the classifier-free guidance applied to x̂₀ is correctly shown to be equivalent to guiding ε. The most important fix is the claim that "the starting noise already decides" which moon a point ends on. The sampler adds fresh noise at every step, and the page itself says that noise is what lets points end at different places. A related display issue: with 1 or a few steps, the points glide smoothly between stored frames, which hides that the model made a single jump.

## Factual errors
- **medium** · steps.ts:237 · "Points are coloured by the moon they end up on: the starting noise already decides it." In ancestral DDPM sampling, the end point depends on x_T *and* on every fresh kick (`sd * rnd()` in ddpm.ts:398). The note at steps.ts:239 says exactly this ("each step's random kick is what lets different points end up at different places"). The colouring only shows where each point ended. Replace with: "Points are coloured by the moon they end up on, so you can watch where each was heading. Early on the colours are mixed: where a point lands depends on its starting noise and on every small kick along the way."
- **low** (moderate confidence) · steps.ts:180 · "around step 300 it is barely there; by step 600 a person sees only static". The scene's own readout at t = 300 shows signal 0.630 against noise 0.777 per pixel. A coherent stroke with contrast ≈1.26 against σ ≈ 0.78 stays clearly legible, and at t = 600 (signal 0.161) a faint shape can still be seen. Suggested fix: "At step 100 the digit is grainy but plain; at step 300 it is drowned in grain but still legible; by step 500 it is barely there, by step 700 a person sees only static, and at step 1,000 …"
- **low** · steps.ts:154 · "the paper that made the method work on images" is true, but the reader may conclude that Ho et al. invented diffusion models. Suggested fix: add "The idea goes back to Jascha Sohl-Dickstein and colleagues (2015); Ho, Jain and Abbeel's 'Denoising Diffusion Probabilistic Models' (2020) made it work on images."
- **low** · ddpm.ts:32–34 (code comment) · "trained with the noise-prediction loss weighted by min(SNR_t, 5)" is wrong. ‖ε − ε̂‖² = SNR·‖x₀ − x̂₀‖², so the min-SNR loss min(SNR, 5)·‖x₀ − x̂₀‖² equals **min(1, 5/SNR_t)·‖ε − ε̂‖²**, which is what steps.ts:197 correctly says. Fix: "It is trained with the noise-prediction loss weighted by min(1, 5/SNR_t) …".
- **low** · shared.ts:41 (comment) · "from −7 to 4 (t ≈ 760 to 40)". The computed log-SNR is −7 at t ≈ 832 and 4 at t ≈ 39. Fix: "(t ≈ 830 to 40)".

Everything else checks out:
- The schedule, eqs. 6–7, x₀ clipping (Ho's official sampler does `clip_by_value(x_recon, −1, 1)`) and EMA.
- CFG with w = s − 1; Hang et al., ICCV 2023; Nichol & Dhariwal section 4; DDIM (Song, Meng, Ermon 2021).
- Latent Diffusion's 64×64×4 latent and CLIP ViT-L 768-dimensional tokens; default CFG scales of 5–8.

## Model issues
- **medium** · PlaneScene.svelte:131–144 · The reverse display interpolates linearly between stored frames ("the display slides from one to the next"). On the few-steps step (default 1 step), the points glide smoothly from noise to the smear. That looks like a gradual process, while the model made one jump, so the graphic undercuts the step's point. Fix: interpolate only when there are many steps, e.g. `if (w <= 0 || k1 === k0 || stepsN < 50) return a;`, so few-step runs visibly jump.
- **low** · NetworkScene.svelte:16 · The digit config `{ D: 784, H: 512, E: 32, blocks: 3, classes: 10 }` is hard-coded, so it can drift from the trained model. Export the config next to `TRAIN` in mnist-sequences.ts (it already records `params: 1723504`) and assert `paramCount(DIGITS) === TRAIN.params` in the test.
- **low** · e2e test:117 · The test checks "> 0.85" on 400 points with seeds 21/5. The page says "nine in ten" and the scene uses 120 points with data seed 2024 and noise seed 31, so the scene's actual readout is untested. Add a test that reproduces the scene's points (`moon` with mulberry32(2024)/gaussian(2025), first 120, EPS gaussian(31), t = 50) and checks `pct(onMoons(x0).any) >= 90`.
- **low** · e2e test:142–143 · For s = 7 the page quotes the share ending on the *upper* moon (the `asked` readout), but the test asserts `pct(s7.any) === 60`. With up to 1% on the lower moon, the readout could show 59%. Assert `pct(s7.upper)` instead.
- **low** · steps.ts:272 · "the 30 finished digits … are on average as far … from their nearest training digit as real test digits … none is a near-copy." Nothing in the generated data or the tests backs this. Record the distances in mnist-sequences.ts (as with `CHECK`) and test them, or drop the quantitative claim.

## Narrative and scene mismatches
- **low** · PlaneScene.svelte:239 vs moons.ts:61 · The "faint bands: where the data lie" are drawn with stroke-width 18 (±9 px). A point counts as "on a moon" within ON_DATA = 0.18 data units = ±20 px, so points visibly outside the band are still counted. Fix: `stroke-width={2 * ON_DATA * PLANE.s}` (≈ 40).
- **low** · steps.ts:305 · "This page uses 100 sampling steps for the guided runs" is true of this step, but the playground lets the reader guide with any number of steps. Fix: "The step above uses 100 sampling steps."

All other quoted numbers match what the scenes compute and the tests assert: 92/87/62%, all 400 on the upper moon at s = 1, 92% at s = 3, the digit readings 7/7/9/4, all step counts reading 2, and 9 snapshots per run.

## Catalogue requirements
- **medium** · catalogue Interaction ("the strength of the text guidance") · The page guides with class labels and only sketches text conditioning. It says so plainly (steps.ts:329, 350), and a text-conditioned model can't reasonably run here. Per "Question an entry", propose this catalogue wording: "…the random seed and the strength of the guidance toward a prompt (a class label here; how text prompts work is sketched)…".
- **low** · steps-digit / guidance-digit · On images, step count and guidance are fixed comparisons (1/5/20/100/1000 steps; s = 0/1/3/7), not adjustable controls. This is acceptable for precomputed data; the adjustable versions exist on the 2-D cloud as the entry intends.

The takeaway is visible in the graphic, the Needs are met with a real trained 2-D model and real precomputed MNIST sequences, and the prerequisites (neural-networks, embeddings) are linked.

## Clarity
- **low** · steps.ts:197 · "(by min(1, 5/SNR), where SNR is … ᾱ/(1 − ᾱ): about 0.6 at step 100, 0.15 at step 50, 0.0005 at step 1" reads as if those are SNR values; they are the weights. Fix: "…where SNR is the signal-to-noise ratio ᾱ/(1 − ᾱ); the weight is about 0.6 at step 100, 0.15 at step 50 and 0.0005 at step 1…".
- **low** · steps.ts:301 / mnist-sequences.ts header · "dropped 15% of the time" for the digit model is stated in the narrative but not recorded in the generated data header (it is recorded for the moons). Add it to the header so the claim is traceable.

## Sources consulted
- Ho, Jain & Abbeel, "Denoising Diffusion Probabilistic Models", official code (x₀ clipping in the sampler): https://github.com/hojonathanho/diffusion/blob/master/diffusion_tf/diffusion_utils.py ; https://github.com/hojonathanho/diffusion
- Ho & Salimans, "Classifier-Free Diffusion Guidance": https://arxiv.org/abs/2207.12598
- Hang et al., "Efficient Diffusion Training via Min-SNR Weighting Strategy" (ICCV 2023): https://www.semanticscholar.org/paper/Efficient-Diffusion-Training-via-Min-SNR-Weighting-Hang-Gu/d37ee0c440e36df133722093f6a824f4964e8ae0
- Sohl-Dickstein et al., "Deep Unsupervised Learning using Nonequilibrium Thermodynamics" (ICML 2015): https://dblp.org/rec/conf/icml/Sohl-DicksteinW15.html
- Numerical checks of the schedule, the crossing step, the min-SNR weights, the log-SNR pacing, the χ²₂ two-sigma probability (1 − e⁻² = 0.865) and the parameter counts were computed directly from the formulas in ddpm.ts.
