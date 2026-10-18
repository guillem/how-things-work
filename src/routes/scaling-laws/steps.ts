import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { FITS } from './laws';
import { sci } from './scenes/shared';

const size: Control = {
	type: 'select',
	id: 'size',
	label: 'Training text (the picked line)',
	default: 'all',
	options: [
		{ value: '10000', label: '10,000 characters' },
		{ value: '30000', label: '30,000' },
		{ value: '100000', label: '100,000' },
		{ value: '300000', label: '300,000' },
		{ value: 'all', label: 'all 1,003,854' }
	]
};

const width: Control = {
	type: 'select',
	id: 'width',
	label: 'Width (the picked line)',
	default: '32',
	options: [8, 16, 24, 32, 48, 64, 96].map((w) => ({ value: String(w), label: String(w) }))
};

const train: Control = {
	type: 'action',
	id: 'train',
	label: 'Retrain the width-8 model on all the text, here',
	action: 'Train from scratch'
};

const stop: Control = {
	type: 'action',
	id: 'stop',
	label: 'Stop it where it is',
	action: 'Stop',
	disabled: (p) => p.liveRunning !== true
};

const budget: Control = {
	type: 'range',
	id: 'budget',
	label: 'Compute budget (operations)',
	min: 18,
	max: 26,
	step: 0.02,
	default: 23.76,
	format: (v) => sci(10 ** v),
	help: 'Gopher’s and Chinchilla’s budget was 5.76 × 10²³.'
};

const fit: Control = {
	type: 'select',
	id: 'fit',
	label: 'Fitted constants',
	default: 'hoffmann',
	options: FITS.map((f) => ({ value: f.id, label: f.name }))
};

const POWER = `<dfn data-def="A relation y = k·x^(−α): multiplying x by any factor multiplies y by that factor to the power −α, wherever you start. On axes where both scales are logarithmic it is a straight line of slope −α.">power law</dfn>`;
const LOGLOG = `<dfn data-def="Axes on which equal distances are equal factors (×10, ×10, …) rather than equal steps, on both axes.">log-log axes</dfn>`;
const HELD = `<dfn data-def="Text kept aside and used only to measure the model: the last tenth of Tiny Shakespeare.">held-out</dfn>`;
const EARLY = `<dfn data-def="Keeping the model as it was at its lowest held-out loss, before it started memorising its training text.">early stopping</dfn>`;
const NONEMB = `<dfn data-def="The weights of the transformer blocks: attention, MLPs and layer norms. Kaplan et al. left out the embedding and read-out matrices, which only translate between symbols and vectors; counted with them, small models fall off the trend.">weights in its blocks</dfn>`;
const ISOFLOP = `<dfn data-def="All the models a fixed budget of computation can train: a bigger model gets proportionally fewer tokens. Hoffmann et al. trained such families directly (their Approach 2).">IsoFLOP slice</dfn>`;
const TOKEN = `<dfn data-def="The unit a language model reads and predicts: for large models a piece of a word from a vocabulary of tens of thousands; on this page's toy, one character.">tokens</dfn>`;

export const spec: ExplainerSpec = {
	slug: 'scaling-laws',
	title: 'Scaling laws',
	summary:
		'Scrub a sweep of 35 tiny transformers trained on Shakespeare and watch the loss fall along a straight line on log-log axes until the text or the model runs out; retrain one point in the page; then drag a compute budget through the Chinchilla law and see the best split between model size and training tokens, with the fit as printed, unrounded and refitted.',
	chapters: [
		{ id: 'toy', title: 'A sweep of tiny models' },
		{ id: 'laws', title: 'The published laws' },
		{ id: 'limits', title: 'What the fits do not say' }
	],
	steps: [
		// ------------------------------------------------------------------ toy
		{
			id: 'size',
			chapter: 'toy',
			title: 'Bigger models, lower loss, until the text runs out',
			scene: 'sweep',
			hints: { mode: 'N' },
			duration: 34,
			controls: [size],
			body: `
<p>The <a href="../training-a-tiny-language-model/">tiny transformer</a> that learns Shakespeare one character at a time was trained here 35 times: at seven widths, from 8 to 96 numbers per character (1,760 to 223,872 ${NONEMB}), on five amounts of text, from 10,000 characters to all 1,003,854, every run for the same 3,000 steps. Each dot is one run's lowest ${HELD} loss, in nats per character (${EARLY}).</p>
<p>Both axes are logarithmic. On ${LOGLOG} a ${POWER}, L = k·N<sup>−α</sup>, is a straight line, and the dashed line is one fitted to the four smallest models: with all the text, its slope is α ≈ 0.067, so each doubling of the model lowers the loss by about 4.5%. The two largest models end about 0.1 nats above the line: their training loss has pulled away from the held-out one (a million characters read three times start to be memorised), and 3,000 steps are not enough for them either.</p>
<p>Pick less text and the line tilts flat. On 10,000 characters every width ends between 2.73 and 2.83 nats, and the fitted slope is 0.009: a bigger model has nothing more to learn from, and the text, not the model, is the bottleneck.</p>`,
			notes: `<p>Here “data” is the amount of distinct text, read over and over: 3,000 steps of 1,024 characters is 3.1 million characters, three passes over all the text and 300 over 10,000 characters, and the score is taken at the best moment, before memorising sets in. That is how Kaplan et al. (2020) measured loss against data; Hoffmann et al. (2022) counted the tokens seen in one pass instead. The width is the only thing that changes: two blocks, 4 attention heads and a context of 32 characters throughout. Every run takes the same number of steps, so the wide ones get more computation and the narrow ones more than they need.</p>`
		},
		{
			id: 'data',
			chapter: 'toy',
			title: 'More text, lower loss, until the model runs out',
			scene: 'sweep',
			hints: { mode: 'D' },
			duration: 34,
			controls: [width],
			body: `
<p>The same 35 runs, now against the amount of text, one line per width. With 10,000 characters all seven widths score within 0.1 nats of each other; as the text grows they spread out. Width 96 falls from 2.76 to 1.76 nats over the hundredfold increase, a slope of 0.095; width 8 only from 2.83 to 2.31, a slope of 0.041. The narrow model has too few weights to use what the extra text shows: for it, the model is the bottleneck.</p>
<p>The two pictures are one fact seen from two sides. The loss falls as a power law in model size and as a power law in data, as long as the other one is not the bottleneck; when it is, the line bends flat. So for a fixed amount of computation, which pays for both, there is a best split between a bigger model and more text.</p>`,
			notes: `<p>The fitted exponents of a toy like this one move with every choice: which points are fitted, the number of steps, the learning rate, the context. They describe this sweep, not character models in general. Five or seven points cannot pin down a floor either, so the dashed lines here are plain power laws; the published fits in the next chapter add a floor.</p>`
		},
		{
			id: 'live',
			chapter: 'toy',
			title: 'Retrain one point',
			scene: 'sweep',
			hints: { mode: 'live' },
			duration: 40,
			controls: [train, stop],
			body: `
<p>One run of the sweep, the smallest model on all the text, can be trained again in this tab: the same code, off the main thread in a Web Worker, from the same random starting weights and the same order of windows. On the laptop the page was made on it takes about half a minute. The ring is its lowest held-out loss so far; it comes down onto the stored dot and, the run being deterministic, lands on it to four decimals: 2.3092 nats, at the last step.</p>
<p>It is only one point. The whole sweep took about six hours of processor time, most of it in the wide models, and the page does not retrain it per slider: real scaling studies are the same kind of grid, at a cost of thousands of processor-years.</p>`,
			notes: `<p>A browser whose JavaScript engine rounds some functions differently in the last digit can drift by a few ten-thousandths of a nat; the shape is the same.</p>`
		},
		// ------------------------------------------------------------------ laws
		{
			id: 'kaplan',
			chapter: 'laws',
			title: 'Kaplan et al. 2020: straight over seven orders of magnitude',
			scene: 'kaplan',
			duration: 34,
			body: `
<p>Kaplan and colleagues at OpenAI trained transformers from 768 to 1.5 billion weights outside the embeddings, on up to 23 billion ${TOKEN} of web text (WebText2), and found the held-out loss falling as power laws: in model size L(N) = (8.8 × 10¹³ / N)<sup>0.076</sup>, in data L(D) = (5.4 × 10¹³ / D)<sup>0.095</sup>, and in compute with an exponent of 0.050, each when the other two were not the bottleneck. Over their range the purple line goes from about 6.9 to 2.3 nats per token with no bend.</p>
<p>The toy sits at the small end, in other units (nats per character of Shakespeare, not per token of web text), so only the slopes compare: the toy's 0.067 against their 0.076, close by chance more than by design. The toy bends where theirs does not because its text runs out at a million characters; theirs had thousands of times more.</p>
<p>A power law like theirs is a fit over a range, not a law of nature. Followed to the right it falls without end, which no real text allows: text has some unpredictability that no model removes. Kaplan et al. concluded that the compute-efficient model size grows as C<sup>0.73</sup>: big models on modest amounts of text.</p>`,
			notes: `<p>Kaplan et al. measured compute as C ≈ 6NBS (B windows of S tokens per step), which is the same estimate as 6ND below, and counted N without embeddings; Hoffmann et al. count all parameters. Their combined law L(N, D) = [(N<sub>c</sub>/N)<sup>α<sub>N</sub>/α<sub>D</sub></sup> + D<sub>c</sub>/D]<sup>α<sub>D</sub></sup> describes the bend when data runs out. Part of the gap between their 0.73 and Chinchilla's 0.5 has since been traced to how they counted parameters and to a learning-rate schedule that was not shortened for short runs.</p>`
		},
		{
			id: 'chinchilla',
			chapter: 'laws',
			title: 'Chinchilla: a floor, and a budget to split',
			scene: 'chinchilla',
			hints: { view: 'isoflop' },
			duration: 36,
			controls: [budget, fit],
			body: `
<p>Hoffmann and colleagues at DeepMind trained over 400 models, from 70 million to 16 billion parameters on 5 to 500 billion tokens, and fitted one law in both: L(N, D) = E + A/N<sup>α</sup> + B/D<sup>β</sup>. As printed in the paper, E = 1.69, A = 406.4, B = 410.7, α = 0.34 and β = 0.28 (nats per token of their text). E is the floor: however big the model and however long the training, the fitted loss approaches 1.69 and never reaches zero.</p>
<p>Training costs about C ≈ 6ND operations: two per parameter per token on the way forward, four on the way back. For a fixed budget a bigger model reads fewer tokens, so each grey curve, an ${ISOFLOP}, dips and rises again: too small a model is limited by its size, too large a one by its data. Its lowest point is the best split, and the dashed line joins those points.</p>
<p>Drag the budget. At Gopher's budget, 5.76 × 10²³ operations, the printed constants give 32 billion parameters on 3.0 trillion tokens.</p>`,
			notes: `<p>The three terms follow a decomposition of the loss: E for the entropy of the text itself, A/N<sup>α</sup> for the best model of N parameters falling short of it, B/D<sup>β</sup> for training on a finite sample instead of to convergence. 6ND leaves out the attention's own arithmetic, which is small next to the weights' for long-enough models. The shaded band is the range of model sizes the fit was made on; outside it, the curves are extrapolation.</p>`
		},
		{
			id: 'frontier',
			chapter: 'laws',
			title: 'The compute-optimal frontier',
			scene: 'chinchilla',
			hints: { view: 'plane' },
			duration: 36,
			controls: [budget, fit],
			body: `
<p>The same law over model size and tokens. The grey curves are iso-loss contours; the straight dashed lines are budgets (C = 6ND is a straight line on these axes); the blue line is the budget picked. Along a budget line the loss is lowest where the line just touches the lowest contour, and the coloured frontier joins those points.</p>
<p>With the printed constants the frontier grows the model as about C<sup>0.45</sup> (the exponent is β/(α + β)) and the tokens as C<sup>0.55</sup>: model and data in roughly equal measure, not Kaplan's 0.73. That is why Chinchilla, 70 billion parameters on 1.4 trillion tokens, beat Gopher, 280 billion on 300 billion, at the same budget. GPT-3 and Gopher sit far to the right of the frontier: too big for the text they read.</p>`
		},
		{
			id: 'revised',
			chapter: 'laws',
			title: 'The constants were revised',
			scene: 'chinchilla',
			hints: { view: 'plane', focus: 'revised' },
			duration: 40,
			controls: [budget, fit],
			body: `
<p>In 2024 Besiroglu and colleagues at Epoch AI rebuilt the data points from the paper's figure and refitted the same form: E = 1.8172, A = 482.01, B = 2085.43, α = 0.3478, β = 0.3658. The printed fit, they showed, does not describe the data and disagrees with the paper's two other methods; the optimiser had stopped before converging, and the printed constants were rounded.</p>
<p>Switch between the fits and watch the frontier move. At Gopher's budget the printed constants give 32 billion parameters (93 tokens per parameter), the unrounded ones from the paper's source 40 billion (59), which is the figure the paper itself reports, and the refit 72 billion (18), close to the 70 billion parameters and 20 tokens per parameter Chinchilla was actually trained with. The often-quoted rule of 20 tokens per parameter comes from the paper's other methods and the refit, not from the printed formula.</p>`,
			notes: `<p>Rounding β from 0.2849 to 0.28 changes the optimum by a fifth: the exponents sit on top of numbers like 10²³, where a small change in a power is a large change in the result. Other groups (Anil et al. 2023; Bi et al. 2024) also find model and data growing at about equal rates, with a ratio that depends on the data's quality and the architecture. The constants are specific to one tokenizer, one dataset and one training recipe.</p>`
		},
		// ------------------------------------------------------------------ limits
		{
			id: 'overtrain',
			chapter: 'limits',
			title: 'Compute-optimal is not the goal',
			scene: 'chinchilla',
			hints: { view: 'plane', focus: 'overtrain' },
			duration: 40,
			controls: [fit],
			body: `
<p>The frontier minimises the loss for a given training budget, and nothing else. A model that will answer millions of requests costs computation every time it runs, in proportion to its size, so it pays to train a smaller model for much longer than the optimum. Meta trained Llama 3 8B on over 15 trillion tokens, about 1,900 per parameter: for the same training budget the fit prefers a model several times bigger, with a slightly lower loss, but the small one is far cheaper to use.</p>
<p>And loss is not capability. A lower loss usually goes with better scores on tasks, but the fits say nothing about which abilities appear when, and some tests improve abruptly or not at all. Beyond the shaded box, every number on this page is an extrapolation of a fit.</p>
<p>The takeaway: loss falls as a power law in model size and in data, each saturating when the other is the bottleneck, towards a floor it never crosses; so a compute budget has a best split between the two, and where exactly it lies depends on a fit that has already been revised once.</p>`,
			notes: `<p>Sardana and Frankle (2023) extend the Chinchilla law to count the computation of use as well as training, and find the optimal model smaller and trained longer the more it will be used. Llama 3 70B was trained on the same 15 trillion tokens, about 210 per parameter. The parameter counts here are rounded (8 and 70 billion).</p>`
		}
	]
};
