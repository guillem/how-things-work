<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.43 in tokens + 6 web searches -->
# Review: central-limit-theorem

## Verdict
Ready after the fixes below. All the dates, numbers and formulas check out. The binomial and normal overlays on the Galton board are scaled correctly, and the bell on the means chart is centred on μ with width σ/√n. The most important fix is the bottom histogram's binning (MeansScene.svelte:137–149). With the "Spiky" shape at most sample sizes, including the clt step's default n = 30, the histogram shows jagged stripes. For prime n (29, 31, 37…) it falls back to 20 coarse bars. Either way the reader is shown a picture that is not a bell, on the very step whose point is that it should be one. Two smaller fixes: σ and μ are used but never defined, and degenerate drawn shapes break the chart.

## Factual errors
No errors found. Galton's board (1873), 4,096 paths and 924 paths for 12 rows, de Moivre 1733, Laplace 1810, a general proof in the early 20th century, and polls of 1,000 being accurate to about ±3 points all check out (see Sources).

## Model issues
- **High**, MeansScene.svelte:137–149 (and the comment at 29–31): **the binning creates false stripes.** The rule "B = 20·d with d dividing n" only lines bins up with the lattice of possible averages when every bar of the starting shape is non-empty. With "Spiky", only bars 1, 4, 7, 10, 13 and 16 are non-empty, so averages fall on a lattice of spacing 3/(20n). Most bin widths then hold alternately 1 and 2, or 2 and 3, lattice points. I simulated the scene's rule with 200,000 samples. The counts near the mean were:
  - n = 30 (B = 60): 7227, 11442, 22740, 21905, 24550, 33174, 22138, 17882 — clearly not a bell.
  - n = 10 (B = 40): 7986, 21032, 26256, 14301, 28893, 26087, …
  - Separately, for prime n the rule forces B = 20. For n = 29 the whole bell is about four bars wide, even with the flat or two-humps shapes.
  
  **Fix:** bin on the exact lattice. Any half-open interval c·g lattice steps wide holds exactly c lattice points, so the stripes disappear:
  ```ts
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
  /** Non-empty bars; sums of n bar indices lie on n·i0 + g·j. */
  const lattice = $derived.by(() => {
  	const idx = heights.flatMap((h, i) => (h > 0 ? [i] : []));
  	const i0 = idx[0] ?? 0;
  	const g = Math.max(1, idx.reduce((q, i) => gcd(q, i - i0), 0));
  	return { i0, g };
  });
  /** Lattice points per bar: about four bars per σ/√n, at most ~100 bars over [0, 1]. */
  const c = $derived(Math.max(1, Math.ceil(Math.max(sdN / 4, 0.01) * BINS * n / lattice.g)));
  const barWidth = $derived((c * lattice.g) / (BINS * n)); // in value units
  const barOf = (m: number) =>
  	Math.floor(Math.round((m * BINS * n - n / 2 - n * lattice.i0) / lattice.g) / c);
  const barLeft = (b: number) => (n * lattice.i0 + n / 2 + lattice.g * (b * c - 0.5)) / (BINS * n);
  ```
  Then draw bar b from `sx(barLeft(b))` to `sx(barLeft(b) + barWidth)`, and replace `taken / B` with `taken * barWidth` in the bell scaling (lines 150, 158, 165). Move this binning into clt.ts so it can be tested.

- **Medium**, MeansScene.svelte:150–152: **a degenerate drawn shape hides the histogram.** If the reader draws a single bar (σ = 0), `sdN` is clamped to 1e‑6 and `bellPeak` comes out around 10⁷. Then `unit` is about 2·10⁻⁵ and the bars vanish, in both steps, although every average sits in one bar. Any shape with σ/√n smaller than a bin width also gets an overshooting bell. **Fix:** compute the bell's expected count per bar from the normal CDF, so it can never exceed `taken`:
  ```ts
  const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2)); // add erf to clt.ts
  const bellPeak = $derived(sdN < 1e-9 ? taken : taken * (Phi(barWidth / (2 * sdN)) - Phi(-barWidth / (2 * sdN))));
  ```
  Also skip the bell and the σ/√n span when σ = 0, and show "every value the same: no spread".

- **Medium**, clt.ts:58–61 together with MeansScene.svelte:250–253: **an all-zero drawn shape is sampled as flat.** If the reader drags every bar to 0, the top chart is empty, but `normalise` silently samples a flat distribution, and the readouts show mean 0.50 and σ = 0.29. **Fix:** in `setHeights`, refuse an all-zero shape: `if (next.every((v) => v <= 0)) next[sel] = 0.05;`.

- **Low**, clt.ts:12–14 and steps.ts:128: **the discrete simplification is not stated on the page.** The starting distribution only takes the 20 bar-centre values; the code says so, the page does not. **Fix:** append to the clt notes: "In this model each value drawn is the centre of one of the 20 bars, so the starting distribution is discrete; the theorem works the same way for continuous ones."

- **Low**, e2e/clt-model.e2e.ts: **the tests miss the bug above.** They check the mean, σ/√n and one ±2σ fraction, which are good real-world properties, but nothing about the histogram's shape. **Fix:** once the binning is in clt.ts, add a test: for every preset and every n from 2 to 50, the expected bar counts from the exact convolution rise and then fall around the mean, with no alternating ups and downs.

## Narrative and scene mismatches
- **Low**, MeansScene.svelte:30: the comment says "d ≤ 4", but the target of 100 bins allows d = 5 (e.g. n = 30 or 50). This goes away with the fix above; otherwise change it to "d ≤ 5".

Otherwise the text matches the graphic. The 4,096 and 924 figures appear in the "why" panel, the normal curve appears after 50 balls, and with n = 1 the averages copy the shape.

## Catalogue requirements
- **Medium**, steps.ts:56–61 and MeansScene.svelte:83: **"one sample at a time" can't really be followed.** The entry asks the reader to "build up the histogram of sample means one sample at a time". But the slowest pace is 2 samples per second (the scene clamps at 1), and the strip only replays the newest sample every 2.6 s. Even at the slowest setting, only about one sample in five is shown being drawn and averaged. **Fix:** let the pace go below 1/PERIOD. In steps.ts, use `samplePace = { ...pace, id: 'samplePace', label: 'Samples per second', min: 0.25, step: 0.25, default: 8 }`. In the scene, use `clamp(Number(params.samplePace ?? 8), 0.25, 200)`. At 0.25 per second every sample is replayed in the strip.

Everything else is met: the Galton board, drawing any distribution, the sample-size slider, and a takeaway that shows in the clt phase from the bell overlay alone.

## Clarity
- **Medium**, steps.ts:126 and MeansScene.svelte:497, 517, 526: **σ and μ are never defined.** The panel shows "spread σ = …" and "σ/√n" from the samples step on, and the legend says "centre μ". The text never explains either symbol, and this topic has no prerequisites. **Fix:** in the clt body, after "…it gets narrower as *n* grows", insert: "Width here means the <dfn data-def="The standard deviation: roughly the typical distance of a value from the mean.">standard deviation</dfn> σ of the starting distribution (the ±σ bar on the top chart); the bell's width is σ/√<i>n</i>." In MeansScene.svelte:526, change the legend to `'bell curve: centre = mean, width σ/√n'`.

## Sources consulted
- Galton board, 1870s: The quincunx was invented by Sir Francis Galton in 1873 to demonstrate binomial distributions. https://link.springer.com/article/10.1007/s003620100048
- Galton board and the binomial-to-normal limit: a device invented by Francis Galton to demonstrate the central limit theorem, in particular that with sufficient sample size the binomial distribution approximates a normal distribution https://en.wikipedia.org/wiki/Galton_board
- de Moivre 1733 and Laplace 1810: The central limit theorem was first established within the framework of binomial distribution by Moivre, Abraham de (1733). Laplace, Pierre Simon de (1810) formulated the proof of the theorem. https://link.springer.com/rwe/10.1007/978-0-387-32833-1_50
- General proof in the early 20th century: a rigorous proof only appeared much later in a work of Russian mathematician Alexander Michailowitsch Ljapunov (1901), with Lindeberg's method following in 1922. https://arxiv.org/pdf/1911.07733
- Polls of about 1,000 people: we would expect the result to be within 3 percentage points of the true population value 95 of those times https://www.pewresearch.org/short-reads/2016/09/08/understanding-the-margin-of-error-in-election-polls/
- My own checks: C(12,6) = 924 and 2¹² = 4,096; the Galton normal overlay uses σ = √rows/2 with bins of width 1, which is correct; and I re-ran the scene's binning rule in a Python simulation, which produced the stripe counts quoted above.
