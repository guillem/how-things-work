import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const prod: Control = {
	type: 'range',
	id: 'prod',
	label: 'Production at the source',
	min: 0.25,
	max: 4,
	step: 0.25,
	default: 1,
	format: (v) => `×${v}`
};

const diff: Control = {
	type: 'range',
	id: 'D',
	label: 'Diffusion constant D',
	min: 0.3,
	max: 12,
	step: 0.1,
	default: 3.6,
	format: (v) => `${v.toFixed(1)} µm²/s`
};

const life: Control = {
	type: 'range',
	id: 'halfLife',
	label: 'Half-life',
	min: 5,
	max: 120,
	step: 1,
	default: 26,
	format: (v) => `${v} min`
};

const restart: Control = { type: 'action', id: 'restart', label: 'Tissue', action: 'Start again' };

const log: Control = { type: 'toggle', id: 'log', label: 'Logarithmic scale', default: false };

const t1: Control = {
	type: 'range',
	id: 't1',
	label: 'High threshold (blue above)',
	min: 2,
	max: 90,
	step: 1,
	default: 35,
	bounds: (p) => [Number(p.t2 ?? 10) + 1, 90],
	help: 'Or drag the lines on the chart.'
};

const t2: Control = {
	type: 'range',
	id: 't2',
	label: 'Low threshold (red below)',
	min: 1,
	max: 60,
	step: 1,
	default: 10,
	bounds: (p) => [1, Math.min(60, Number(p.t1 ?? 35) - 1)]
};

const measure: Control = {
	type: 'select',
	id: 'measure',
	label: 'Bicoid’s D and half-life from',
	default: 'fit',
	options: [
		{ value: 'fit', label: 'Protein-age fit' },
		{ value: 'frap', label: 'FRAP' },
		{ value: 'frap-slow', label: 'FRAP, long-lived' },
		{ value: 'fcs', label: 'FCS' }
	]
};

const stretch: Control = {
	type: 'range',
	id: 'stretch',
	label: 'Length of the second tissue',
	min: 1,
	max: 2.5,
	step: 0.25,
	default: 2,
	format: (v) => `×${v} (${Math.round(500 * v)} µm)`,
	help: 'Changing it starts both tissues again.'
};

const expander: Control = {
	type: 'toggle',
	id: 'expander',
	label: 'Expansion–repression circuit',
	default: true
};

const noise: Control = {
	type: 'range',
	id: 'noise',
	label: 'Reading error σ',
	min: 0,
	max: 8,
	step: 0.5,
	default: 3,
	format: (v) => `± ${v.toFixed(1)}`,
	help: 'In the chart’s units: the same size wherever the cell is.'
};

/**
 * Scenes: `row` (a row of cells with a source at the left end above the morphogen's profile;
 * focus 'build' (cells shaded by concentration, the profile rising), 'shape' (λ and an optional
 * log scale), 'flag' (two draggable thresholds paint the cells) or 'noise' (cells read the
 * concentration with an error; boundaries with their positional error)), `embryo` (a fly egg
 * with the Bicoid gradient forming for a chosen set of measured constants, against the measured
 * length constant) and `scale` (a 500 µm tissue above a longer one, drawn to scale; focus
 * 'plain' or 'expander').
 */
export const spec: ExplainerSpec = {
	slug: 'morphogen-gradients',
	title: 'Morphogen gradients & positional information',
	summary:
		'A substance made at one end of a row of cells spreads and decays into an exponential gradient; set its diffusion and lifetime and watch the length scale √(D·τ), paint a French flag with two thresholds, compare the model with the fly’s Bicoid gradient, see the flag fail to stretch in a longer tissue until an expansion–repression circuit makes it scale, and see why boundaries are sharp where the gradient is steep.',
	chapters: [
		{ id: 'gradient', title: 'A gradient from a source' },
		{ id: 'reading', title: 'Reading the gradient' },
		{ id: 'scaling', title: 'Bigger tissues' },
		{ id: 'precision', title: 'How precise?' }
	],
	steps: [
		// ------------------------------------------------------------------ gradient
		{
			id: 'source',
			chapter: 'gradient',
			title: 'One substance, made at one end',
			scene: 'row',
			hints: { focus: 'build' },
			duration: 30,
			controls: [prod, diff, life, restart],
			body: `
<p>Every cell of an embryo carries the same <a href="../dna-to-protein/">DNA</a>, yet a cell near the head end must switch on head genes and a cell further back must not. How does a cell find out where it is? In 1969 Lewis Wolpert proposed that cells read their <dfn data-def="A cell's position in the tissue, as the cell itself can measure it: for example by how much of a signal reaches it.">positional information</dfn> from the concentration of a substance that varies along the tissue: a <dfn data-def="A substance that spreads through a tissue from a source and makes cells take on different fates at different concentrations.">morphogen</dfn>.</p>
<p>Here is a row of cells, 500 µm long, about the length of a fruit-fly egg. The cells at the left end make a morphogen. It spreads by <a href="../diffusion-osmosis/#drop">diffusion</a>, and everywhere it is broken down: each molecule has a <strong>half-life</strong>, after which half of them are gone.</p>
<p>Watch the concentration build up. Near the source it rises fast; far away, little arrives, because most molecules are broken down before they get there. After an hour or two the profile stops changing: in every cell, what diffuses in balances what diffuses out and what is destroyed. Try the sliders: they change the profile live, from where it is now.</p>`,
			notes: `<p>The row is modelled as a line of tissue on which the concentration c(x, t) obeys ∂c/∂t = D ∂²c/∂x² − kc, with a constant flow of new molecules into the tissue at x = 0 and none leaving at the far end. k = ln 2 / half-life is the rate of breakdown, and the mean lifetime is τ = 1/k (26 minutes of half-life is 37.5 minutes of mean lifetime). This is the <dfn data-def="The simplest model of a morphogen gradient: made at a source, spread by diffusion, removed by a first-order breakdown everywhere.">synthesis–diffusion–degradation</dfn> (SDD) model. It is solved here on a grid of 4 µm cells with an implicit time step of 10 s; the clock runs 6 minutes of embryo time per second. Concentrations are in relative units: 100 is the level at the source end with the default settings.</p>`
		},
		{
			id: 'shape',
			chapter: 'gradient',
			title: 'What sets the shape: λ = √(D·τ)',
			scene: 'row',
			hints: { focus: 'shape' },
			duration: 30,
			controls: [diff, life, prod, log],
			body: `
<p>The settled profile is what the SDD model predicts: when the tissue is several λ long, an <strong>exponential</strong>, except near the closed far end, where it flattens. Every time you move λ further from the source, the concentration falls by about the same factor e ≈ 2.7. Switch on the logarithmic scale and the curve becomes a straight line, flattening only at the far end.</p>
<p>The <dfn data-def="The distance over which the concentration falls by a factor e; also called the decay length or length constant.">length scale</dfn> λ is set by just two numbers: λ = √(D/k) = √(D·τ), how far a molecule typically diffuses during its lifetime. Four times the diffusion constant, or four times the lifetime, doubles λ. Raising the production only lifts the whole curve: the shape, and λ, stay the same.</p>
<p>The default numbers are those fitted to the fly's Bicoid protein (next step): D = 3.6 µm²/s and a half-life of 26 minutes give λ ≈ 90 µm. The gradient settles in a few lifetimes, here about two hours: a longer lifetime gives a longer gradient, but a slower one to form.</p>`,
			notes: `<p>At steady state D c'' = kc, whose solution with a source flux j at x = 0 and a closed far end is c(x) = (jλ/D)·cosh((L − x)/λ)/sinh(L/λ). When the tissue is several λ long this is the exponential (jλ/D)·e^(−x/λ); only the last λ or so flattens, because nothing leaks out of the far end. The exact level at the source is c(0) = (jλ/D)·coth(L/λ), close to jλ/D = j/√(Dk) when L ≫ λ; either way it is proportional to the production. When λ is not small against the tissue (try a long lifetime and fast diffusion), the profile falls by less than e per λ. On the logarithmic chart (base 10) the straight part falls by one decade every λ·ln 10 ≈ 2.3 λ. The page measures λ by fitting a straight line to the logarithm of the profile over the first 40 % of the row.</p>`
		},
		{
			id: 'bicoid',
			chapter: 'gradient',
			title: 'Where the model is tested: Bicoid in the fly egg',
			scene: 'embryo',
			duration: 40,
			controls: [measure, restart],
			body: `
<p>The best-studied morphogen is <strong>Bicoid</strong>, in the egg of the fruit fly <i>Drosophila</i>. The mother leaves <i>bicoid</i> mRNA at the head end of the egg; the protein is made there and spreads back through the egg, which is about 490 µm long. Measured in stained embryos, its concentration falls roughly exponentially with a length constant λ of about 100 µm, a fifth of the egg (Gregor and colleagues, 2007). The dashed curve on the chart is that measured exponential.</p>
<p>The exponential is what the SDD model <em>predicts</em>; whether Bicoid's gradient actually forms that way has been argued over for years. Photobleaching (FRAP) measured a diffusion constant of only 0.3 µm²/s: with Bicoid's lifetime that gives a gradient far too short, and with a lifetime long enough for λ = 100 µm it would still be forming hours after the pattern is read. Fluorescence correlation (FCS) measured about 7 µm²/s, fast enough. Pick each set and compare the curve with the dashed one.</p>
<p>A direct test came from tagging Bicoid with a fluorescent "timer" that shows each molecule's age: the protein is older further from the source, and of the models compared, SDD fitted best, with D = 3.6 µm²/s and a half-life of 26 minutes (Durrieu and colleagues, 2018). So the model holds up well for Bicoid, but other routes have been proposed, such as a gradient of the mRNA itself, and the debate is not fully closed.</p>`,
			notes: `<p>Sources: λ ~ 100 µm in an egg of L ≈ 490 µm and D = 0.30 ± 0.09 µm²/s by FRAP in the cortical cytoplasm (Gregor, Wieschaus, McGregor, Bialek and Tank, <i>Cell</i> 130:141, 2007; the authors estimated that D ≫ 2 µm²/s would be needed to form the gradient in time). D = 7.4 µm²/s by FCS (Abu-Arish and colleagues, <i>Biophysical Journal</i> 99:L33, 2010). The FRAP and FCS numbers may both be right, measuring different mixes of fast and slow molecules (Sigaut and colleagues, 2014). The protein-age study: Durrieu and colleagues, <i>Molecular Systems Biology</i> 14:e8355, 2018 (D = 3.6 ± 0.2 µm²/s, half-life 26 ± 3 min, decay length 89 ± 7 µm). The mRNA-gradient proposal: Spirov and colleagues, <i>Development</i> 136:605, 2009. The 6.4-hour half-life is the one that, with D = 0.3 µm²/s, would give λ = 100 µm. The model egg here is a line along its long axis; the real egg is a three-dimensional shell of cytoplasm full of dividing nuclei, which take Bicoid in and let it out again.</p>`
		},
		// ------------------------------------------------------------------ reading
		{
			id: 'flag',
			chapter: 'reading',
			title: 'Thresholds paint a French flag',
			scene: 'row',
			hints: { focus: 'flag' },
			duration: 30,
			controls: [t1, t2, prod],
			body: `
<p>A smooth gradient becomes sharp regions when cells respond to <strong>thresholds</strong>. Here every cell above the high threshold turns on a "blue" gene, every cell below the low one a "red" gene, and the cells in between neither: three bands, Wolpert's <dfn data-def="Wolpert's picture of positional information: a gradient read with two thresholds divides a row of cells into three regions, like the blue, white and red of the French flag.">French flag</dfn>. In the fly, Bicoid is a transcription factor: genes such as <i>hunchback</i> are switched on where it is above their threshold, and their own sharp domains mark out the head and thorax.</p>
<p>Drag the threshold lines. Each boundary sits where the curve crosses its threshold, at about x = λ·ln(c₀/T), with c₀ the level at the source. So in an exponential gradient a boundary moves by the same distance, λ·ln 2 ≈ 62 µm, every time the production doubles: try ×2 and ×4.</p>
<p>That is a prediction that can be tested by giving flies more or fewer copies of the <i>bicoid</i> gene: with more copies, the head–thorax pattern does move towards the tail (Driever and Nüsslein-Volhard, 1988).</p>`,
			notes: `<p>Real genes do not switch as abruptly as a threshold: a gene's response to a transcription factor is a steep but smooth curve, and the target genes also act on each other, which sharpens boundaries and makes them hold their place better than a simple threshold reading would. The page reads the settled gradient; in the fly, the pattern is read while the gradient is still being made, within the first two to three hours after the egg is laid.</p>`
		},
		// ------------------------------------------------------------------ scaling
		{
			id: 'scale-fail',
			chapter: 'scaling',
			title: 'A bigger tissue: the flag does not stretch',
			scene: 'scale',
			hints: { focus: 'plain' },
			duration: 25,
			controls: [stretch],
			body: `
<p>Embryos are not all the same size, and related species can differ several-fold; yet their body plans keep their proportions. Can a morphogen gradient do that?</p>
<p>Here are two tissues drawn to scale, each with the same source at its left end and the same thresholds: the top one 500 µm long, the bottom one longer. The SDD gradient's λ = √(D·τ) does not know how long the tissue is, so every boundary lands at the <strong>same distance in µm</strong> from the source. In a tissue twice as long, the blue and white bands crowd into the front fifth and red takes the rest: the flag does not stretch.</p>
<p>To keep proportions, something has to make λ grow with the tissue.</p>`,
			notes: `<p>The boundaries move only where the far end matters: within about a λ of it, the closed end lifts the profile a little (the cosh in the steady state). With λ ≈ 90 µm and tissues of 500 µm and more, that is invisible at the thresholds used here.</p>`
		},
		{
			id: 'expander',
			chapter: 'scaling',
			title: 'Expansion–repression: a gradient that fits its tissue',
			scene: 'scale',
			hints: { focus: 'expander' },
			duration: 50,
			controls: [expander, stretch],
			body: `
<p>Ben-Zvi and Barkai (2010) proposed a circuit that makes a gradient scale. A second substance, the <strong>expander</strong>, widens the morphogen's gradient: here it speeds the morphogen's spread and slows its breakdown. The morphogen <em>represses</em> the expander: it is made where the morphogen is low, and production falls steeply once the morphogen rises past a repression threshold, so at first it is made mostly at the far end; it spreads quickly and lasts a long time, so it fills the tissue (the dashed curve).</p>
<p>Watch the circuit work. While the far end is short of morphogen, the expander keeps piling up and the gradient keeps widening. As the morphogen at the far end rises past the repression threshold, expander production is shut down more and more, until what is still made just balances the little that is removed. The far end ends up held near that threshold, so a longer tissue ends up with a proportionally longer gradient, and the bands of both tissues settle at nearly the same shares of their length.</p>
<p>Over the lengths shown here (500 to 1250 µm), the boundaries settle at shares of the tissue that differ by a few percentage points: close, not exact. It also widens the short tissue's gradient: with the circuit on, its boundaries lie further back than in the plain model. Switch it off to compare.</p>`,
			notes: `<p>The model: ∂E/∂t = D_E ∂²E/∂x² − k_E E + β/(1 + (M/T_rep)^h), with the morphogen's diffusion multiplied and its breakdown divided by (1 + E). Ben-Zvi and Barkai showed that scaling needs the expander to be stable and to diffuse well; this page uses D_E = 60 µm²/s, a lifetime of about 12 days, T_rep = 2, h = 6 and β = 10⁻⁴ per second, and runs an hour of embryo time per second of the clock. They allow the expander to act on diffusion, on breakdown, or both; acting on both by the same factor keeps the source level the same, which makes the anterior boundaries scale better than acting on breakdown alone. The model is proposed for the Dpp gradient of the fly's wing disc, with the secreted protein Pentagone as the expander (Ben-Zvi and colleagues, 2011), though whether Pentagone spreads far enough to do this has been questioned (Zhu and colleagues, 2020).</p>`
		},
		// ------------------------------------------------------------------ precision
		{
			id: 'noise',
			chapter: 'precision',
			title: 'Steep is precise, flat is fuzzy',
			scene: 'row',
			hints: { focus: 'noise' },
			duration: 30,
			controls: [noise, t1, t2],
			body: `
<p>No cell measures a concentration exactly: only so many molecules are around, and they bind and unbind at random. Here each cell reads the morphogen with a random error of size σ, drawn afresh twice a second, and paints itself by what it reads.</p>
<p>Look at the boundaries. Where the gradient is steep, a small reading error moves the crossing only a little, and the boundary stays sharp. In the flat tail, the same error moves the crossing a long way, and cells flicker between colours over a wide band. For small reading errors the positional error is about σ_x ≈ σ / |slope|; in an exponential the slope is c/λ, so σ_x ≈ λσ/c, growing as the concentration falls. (When σ is not small against the threshold, this straight-line estimate is only rough.) Drag the low threshold down into the tail and watch the error bar grow.</p>
<p>In the fly, nuclei at the same position read Bicoid to within about 10 %, and the <i>hunchback</i> boundary is placed to within 1–2 % of the egg's length, about one nucleus (Gregor and colleagues, 2007).</p>`,
			notes: `<p>The error here is the same size σ everywhere, like a fixed background of noise. If instead the error were a fixed share of the concentration (10 % everywhere), σ_x = 0.1·λ would be the same at every boundary: whether the tail is fuzzier depends on how the noise grows with the concentration. For counting noise (σ ∝ √c) the error still grows into the tail, as λ/√c. The 10 % and 1–2 % figures are from Gregor, Tank, Wieschaus and Bialek, <i>Cell</i> 130:153, 2007, who argued that the precision is close to the limit set by counting Bicoid molecules. Cells can do better than one reading by averaging over time and over their neighbours.</p>`
		}
	]
};
