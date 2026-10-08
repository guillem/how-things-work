import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const rows: Control = {
	type: 'range',
	id: 'rows',
	label: 'Rows of pins',
	min: 2,
	max: 16,
	step: 1,
	default: 12
};

const pace: Control = {
	type: 'range',
	id: 'pace',
	label: 'Balls per second',
	min: 2,
	max: 200,
	step: 1,
	default: 12
};

const shape: Control = {
	type: 'select',
	id: 'shape',
	label: 'Starting distribution',
	default: 'twoHumps',
	options: [
		{ value: 'flat', label: 'Flat (every value equally likely)' },
		{ value: 'skewed', label: 'Lopsided' },
		{ value: 'twoHumps', label: 'Two humps' },
		{ value: 'dice', label: 'Spiky' },
		{ value: 'drawn', label: 'Draw your own' }
	],
	help: 'With “Draw your own”, drag over the top chart to shape it.'
};

const sampleSize: Control = {
	type: 'range',
	id: 'sampleSize',
	label: 'Values averaged in each sample (n)',
	min: 1,
	max: 50,
	step: 1,
	default: 1
};

const samplePace: Control = {
	...pace,
	id: 'samplePace',
	label: 'Samples per second',
	default: 8
} as Control;

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Start again',
	action: 'Start again'
};

export const spec: ExplainerSpec = {
	slug: 'central-limit-theorem',
	title: 'Why the bell curve is everywhere',
	summary:
		'Drop balls through a Galton board, then average samples from any distribution you like and watch the averages pile up into the same bell curve.',
	chapters: [
		{ id: 'galton', title: 'The Galton board' },
		{ id: 'clt', title: 'The central limit theorem' }
	],
	steps: [
		{
			id: 'board',
			chapter: 'galton',
			title: 'Balls through pins',
			scene: 'galton',
			hints: { phase: 'board' },
			duration: 26,
			controls: [rows, pace, restart],
			body: `
<p>Drop a ball onto a board of pins. At each pin it bounces left or right, at random, with equal chances. Where it ends up depends on how many of its bounces went right.</p>
<p>One ball's path is unpredictable. But drop hundreds and a shape appears: most land near the middle, fewer towards the edges, very few at the far ends — a <dfn data-def="The symmetric, bell-shaped curve of the normal distribution; also called the Gaussian.">bell curve</dfn>. Francis Galton built this board in the 1870s to show it.</p>`,
			notes: `<p>To land in the far-right bin a ball must bounce right every time — one path out of 4,096 with 12 rows. To land in the middle it can take any of 924 different paths. The bins follow the binomial distribution, which for many rows is very close to the normal curve drawn over it.</p>`
		},
		{
			id: 'why',
			chapter: 'galton',
			title: 'Many small random pushes',
			scene: 'galton',
			hints: { phase: 'why' },
			duration: 22,
			controls: [rows, pace, restart],
			body: `
<p>Each ball's final position is the <strong>sum of many small, independent random pushes</strong>. Extreme results need almost every push to go the same way, which is rare; middling results can happen in a huge number of ways, so they are common.</p>
<p>Add more rows and the bell gets wider, but its shape stays the same. Lots of things in nature are sums of many small random effects — heights of people, errors in measurements — which is why bell curves turn up everywhere.</p>`
		},
		{
			id: 'samples',
			chapter: 'clt',
			title: 'Averages of any distribution',
			scene: 'means',
			hints: { phase: 'samples' },
			duration: 30,
			controls: [shape, sampleSize, samplePace, restart],
			body: `
<p>Now start from a distribution that looks nothing like a bell — two humps, a lopsided slope, or one you draw yourself (top chart). Take a <strong>sample</strong>: pick <i>n</i> values from it at random and work out their average. Do it again and again, and stack the averages in the bottom chart.</p>
<p>With <i>n</i> = 1 the averages just copy the starting distribution. Slide <i>n</i> up to 2, 5, 30 and watch the bottom chart: the averages pile up in a <strong>bell curve</strong>, whatever you started from.</p>`
		},
		{
			id: 'clt',
			chapter: 'clt',
			title: 'The central limit theorem',
			scene: 'means',
			hints: { phase: 'clt' },
			duration: 30,
			controls: [shape, sampleSize, samplePace, restart],
			body: `
<p>This is the <dfn data-def="Averages of many independent random values with the same distribution (of finite spread) are approximately normally distributed, whatever that distribution is; the approximation improves as more values are averaged.">central limit theorem</dfn>: averages of many independent random values pile up in a bell curve, <strong>almost regardless of the distribution they came from</strong>. The bell is centred on the starting distribution's mean, and it gets narrower as <i>n</i> grows — its width shrinks like 1 ÷ √<i>n</i>: four times the sample, half the spread.</p>
<p>That is why polls of a thousand people can estimate a whole country's opinion to within a few percent, and why scientists average repeated measurements: the average is far more predictable than any single value.</p>`,
			notes: `<p>"Almost regardless": the values must be independent, and their distribution must not have extremely heavy tails (its spread must be finite). How large <i>n</i> must be depends on the shape: for very lopsided starting distributions the bell takes longer to appear. The theorem was found in special cases by de Moivre (1733) and Laplace (1810), and proved in general in the early 20th century.</p>`
		}
	]
};
