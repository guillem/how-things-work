import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const rule: Control = {
	type: 'range',
	id: 'rule',
	label: 'Rule',
	min: 0,
	max: 255,
	step: 1,
	default: 90,
	format: (v) => `rule ${v} = ${v.toString(2).padStart(8, '0')}`,
	help: 'Or click the eight boxes of the table to flip one bit at a time.'
};

const start: Control = {
	type: 'select',
	id: 'start',
	label: 'Starting row',
	default: 'single',
	options: [
		{ value: 'single', label: 'One live cell' },
		{ value: 'random', label: 'Random' }
	]
};

const reseed: Control = {
	type: 'action',
	id: 'reseed',
	label: 'Random row',
	action: 'New random row',
	help: 'Another random starting row (only used when the start is random).'
};

const density: Control = {
	type: 'range',
	id: 'density',
	label: 'Cars on the road',
	min: 0.05,
	max: 0.95,
	step: 0.01,
	default: 0.35,
	format: (v) => `${Math.round(v * 100)}% of the cells`
};

export const spec: ExplainerSpec = {
	slug: 'cellular-automata',
	title: 'Cellular automata',
	summary:
		'Write a rule as an eight-bit table, apply it to a row of cells all at once, and stack the generations: a Sierpinski triangle, a pattern that looks random but isn’t, and structures that collide. Then survey all 256 rules, and watch one of them run a traffic jam.',
	chapters: [
		{ id: 'rule', title: 'One rule, one row' },
		{ id: 'space', title: 'All 256 rules' },
		{ id: 'uses', title: 'Traffic' }
	],
	steps: [
		// ------------------------------------------------------------------ rule
		{
			id: 'table',
			chapter: 'rule',
			title: 'A rule in eight bits',
			scene: 'rule',
			hints: { phase: 'table' },
			duration: 22,
			controls: [rule, start],
			body: `
<p>Take a row of cells, each either alive (black) or dead (white). To make the next generation, every cell looks at itself and its two neighbours: three cells, so eight possible patterns, from 111 down to 000. A <strong>rule</strong> says, for each of the eight, whether the cell is alive in the next row. Every cell updates at the same moment, from the old row.</p>
<p>Write the eight answers as bits, from the 111 pattern down to 000, and you have an 8-bit number from 0 to 255: the rule’s name, in Stephen Wolfram’s numbering. Rule 90 is 01011010. Each new generation is drawn as a line below the last, so time runs down the page. The row wraps round, so the right edge’s neighbour is the left edge.</p>
<p>Click the boxes of the table to flip bits and watch the picture change.</p>`,
			notes: `<p>These are called elementary cellular automata: one dimension, two states, neighbours one cell away. The page on Conway’s Game of Life runs the same idea on a two-dimensional grid with a rule that counts eight neighbours.</p>`
		},
		{
			id: 'rule90',
			chapter: 'rule',
			title: 'Rule 90 draws a triangle',
			scene: 'rule',
			hints: { phase: 'fixed', rule: 90, start: 'single' },
			duration: 18,
			body: `
<p>Start rule 90 from a single live cell. Its rule is simple: a cell is alive next if exactly one of its two neighbours is alive now (an exclusive or). Out comes a triangle made of triangles, each half the size of the one before: the <dfn data-def="A fractal made by repeatedly removing the middle quarter of a triangle, leaving three half-size copies.">Sierpinski triangle</dfn>.</p>
<p>It is Pascal’s triangle in disguise. Each cell is the sum of the two above it, keeping only whether the sum is odd: a live cell is an odd number in Pascal’s triangle. Every 2<sup>n</sup> rows the pattern doubles in size and starts again.</p>`
		},
		{
			id: 'rule30',
			chapter: 'rule',
			title: 'Rule 30 looks random',
			scene: 'rule',
			hints: { phase: 'fixed', rule: 30 },
			duration: 20,
			controls: [start, reseed],
			body: `
<p>Rule 30 grows from the same single cell into a pattern with some order on its left edge and apparent chaos everywhere else. On an endless row started from one live cell, the middle column appears never to repeat, though nobody has managed to prove it; long computed stretches of it pass the usual statistical tests for randomness. For years Wolfram’s Mathematica software used it to make random numbers.</p>
<p>Yet nothing about it is random. Run it again and every cell comes out the same: the pattern is completely determined by the rule and the starting row. Rule 30 shows how a simple, fully deterministic process can produce something that looks like noise.</p>`
		},
		{
			id: 'rule110',
			chapter: 'rule',
			title: 'Rule 110 builds structures',
			scene: 'rule',
			hints: { phase: 'fixed', rule: 110, start: 'random' },
			duration: 20,
			controls: [reseed],
			body: `
<p>From a random row, rule 110 settles into a regular background crossed by structures that travel at different speeds, like particles, and collide: some pass through each other, some merge, some destroy each other.</p>
<p>Those collisions can be arranged to compute. In 2004 Matthew Cook published a proof that rule 110 is <dfn data-def="Able to carry out any computation a computer can, given enough space and time, if the starting row is set up correctly.">universal</dfn>: with the right starting row, its structures can carry out any calculation a computer can. A rule you can write in eight bits is, in principle, as powerful as any computer.</p>`
		},
		// ------------------------------------------------------------------ space
		{
			id: 'families',
			chapter: 'space',
			title: '256 rules, 88 kinds',
			scene: 'rule',
			hints: { phase: 'families' },
			duration: 20,
			controls: [rule],
			body: `
<p>Many rules are the same rule in disguise. Reflect a rule left to right (so it looks at its right neighbour where it looked at its left) and you get its mirror image, which draws the mirrored picture. Swap alive and dead throughout and you get its complement, which draws the negative. Rule 110’s family is 110, 124, 137 and 193.</p>
<p>Grouping the mirror images and complements together leaves 88 genuinely different rules out of 256. The readout lists the family of the rule you pick.</p>`
		},
		{
			id: 'survey',
			chapter: 'space',
			title: 'Most rules are dull',
			scene: 'survey',
			hints: { phase: 'survey' },
			duration: 24,
			controls: [rule],
			body: `
<p>Here are all 256, each run from the same random ring of 61 cells for up to 1,000 generations and grouped by what happens (in order of rule number within each group). 28 die out, ending all dead or all alive. 200 fall into a repeating cycle: a frozen pattern, a blinking one, or one that just slides along. Only 28, from 10 of the 88 families, are still changing after 1,000 generations.</p>
<p>Wolfram sorted the rules into four classes by eye: class 1 dies out, class 2 repeats, class 3 looks random (rule 30, rule 90) and class 4 builds lasting structures (rule 110). A measurement like this one can tell the first two from the last two, but not class 3 from class 4. And flipping a single bit of a rule can jump between them: click a tile, then flip bits in the table on the first step.</p>`,
			notes: `<p>The sort is a measurement on a small ring, not Wolfram’s classification. On only 61 cells a few rules he counts as random, such as rules 18 and 126, run into a cycle or a uniform row within 1,000 generations; on a longer row they keep going. Every ring of finite size must repeat eventually, since it has only finitely many states.</p>`
		},
		// ------------------------------------------------------------------ uses
		{
			id: 'traffic',
			chapter: 'uses',
			title: 'Rule 184 is a traffic jam',
			scene: 'traffic',
			hints: { phase: 'traffic' },
			duration: 24,
			controls: [density],
			body: `
<p>Read rule 184’s live cells as cars on a one-lane ring road, all driving right. Its table says: a car moves one cell forward if the cell ahead is empty, and waits if it isn’t. Cars are never made or destroyed, so the number on the road stays the same forever.</p>
<p>With fewer cars than half the cells, every jam soon dissolves and all cars move every step. Above half full, jams can’t clear: they drift backwards through the traffic, as real stop-and-go waves do, and once the traffic has settled, the share of cars moving drops to (1 − d) / d for a road a fraction d full. Drag the number of cars across one half and watch the free flow turn into permanent jams.</p>`,
			notes: `<p>Rule 184 is the simplest member of a family of traffic models; the Nagel–Schreckenberg model of 1992 adds speeds and random braking, and reproduces jams that appear out of nowhere on real motorways.</p>`
		}
	]
};
