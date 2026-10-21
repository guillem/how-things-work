import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { MATERIALS } from './model';

const flip: Control = {
	type: 'toggle',
	id: 'flip',
	label: 'Turn the right magnet round',
	default: false
};

const gap: Control = {
	type: 'range',
	id: 'gap',
	label: 'Gap between the magnets',
	min: 0.5,
	max: 10,
	step: 0.5,
	default: 1,
	format: (v) => `${v} cm`
};

const filings: Control = {
	type: 'select',
	id: 'filings',
	label: 'Under the paper',
	default: 'one',
	options: [
		{ value: 'one', label: 'One magnet' },
		{ value: 'pull', label: 'Two magnets pulling' },
		{ value: 'push', label: 'Two magnets pushing' }
	]
};

const lower: Control = {
	type: 'range',
	id: 'height',
	label: 'Height of the magnet above the clips',
	min: 0,
	max: 8,
	step: 0.5,
	default: 6,
	format: (v) => (v === 0 ? 'touching' : `${v} cm`),
	help: 'Or drag the magnet up and down.'
};

const material: Control = {
	type: 'select',
	id: 'material',
	label: 'What is under the magnet',
	default: 'nail',
	options: Object.entries(MATERIALS).map(([value, m]) => ({ value, label: m.name }))
};

const pieces: Control = {
	type: 'range',
	id: 'pieces',
	label: 'Cut the magnet into',
	min: 1,
	max: 8,
	step: 1,
	default: 1,
	values: () => [1, 2, 4, 8],
	format: (v) => (v === 1 ? 'one whole magnet' : `${v} pieces`)
};

const pole =
	'<dfn data-def="One of the two ends of a magnet, where its pull is strongest. Every magnet has a north pole and a south pole.">poles</dfn>';

export const spec: ExplainerSpec = {
	slug: 'magnets-and-poles',
	title: 'Magnets & poles',
	summary:
		'Push two bar magnets about: unlike ends pull together, like ends push apart, and the pull fades fast as they part. Watch a compass and iron filings line up around them, turn a paper clip into a magnet, find out which metals a magnet ignores, and cut a magnet in half to find two ends on each half.',
	chapters: [
		{ id: 'ends', title: 'Two ends' },
		{ id: 'around', title: 'Around a magnet' },
		{ id: 'what', title: 'What magnets pull' }
	],
	steps: [
		// ------------------------------------------------------------------ ends
		{
			id: 'pull',
			chapter: 'ends',
			title: 'Two magnets pull',
			scene: 'board',
			hints: { phase: 'pull' },
			duration: 18,
			body: `
<p>Here are two bar magnets lying on a table, seen from above. Each one has two ends, painted <strong class="mg-n">red</strong> and <strong class="mg-s">blue</strong>. The ends are called the magnet’s ${pole}: the red one is its <strong>north</strong> end and the blue one its <strong>south</strong> end (the compass, later on, shows why).</p>
<p>The red end of the left magnet faces the blue end of the right one, and the arrows show them <strong>pulling together</strong>, without even touching. <strong>Drag the right magnet</strong> about the table and watch the arrows: they show which way each magnet is tugged, and how hard.</p>
<p>Lay it alongside the other magnet, red beside red, and something changes: the arrows turn round and push the magnets apart.</p>`
		},
		{
			id: 'push',
			chapter: 'ends',
			title: 'Turn one round',
			scene: 'board',
			hints: { phase: 'push' },
			duration: 18,
			controls: [flip],
			body: `
<p>Now <strong>turn the right magnet round</strong>, so that red faces red. The pull becomes a <strong>push</strong>: the magnets shove each other apart. Turn it back and they pull again.</p>
<p>That is the rule for every magnet: <strong>unlike ends pull together, like ends push apart</strong>. Red pulls blue; red pushes red; blue pushes blue.</p>
<p>A push is the surest test that something is a magnet. Any magnet pulls on a plain lump of iron, but only another magnet can push it away.</p>`
		},
		{
			id: 'fade',
			chapter: 'ends',
			title: 'The pull fades fast',
			scene: 'board',
			hints: { phase: 'fade' },
			duration: 18,
			controls: [gap],
			body: `
<p>Close together, these two magnets pull as hard as a 21-gram weight hanging on a string: about four sugar cubes. <strong>Widen the gap</strong> and watch the number.</p>
<p>At 2 centimetres apart the pull is already less than half as strong; at 10 centimetres it is about eighty times weaker, too weak to slide a magnet across a table. Far apart, every doubling of the distance makes the pull <strong>sixteen times</strong> weaker. A magnet’s pull is strong up close and fades very quickly.</p>`,
			notes: `<p>The numbers come from treating each end as a small point where the magnet’s pull is concentrated, using the strength of ordinary grey ferrite school magnets 6 cm long. Real magnets differ in strength, but the way the pull fades is the same.</p>`
		},
		// ------------------------------------------------------------------ around
		{
			id: 'compass',
			chapter: 'around',
			title: 'A compass is a magnet too',
			scene: 'board',
			hints: { phase: 'compass' },
			duration: 20,
			body: `
<p>A compass needle is a tiny magnet on a pin, free to turn. Its red end is its north end. <strong>Drag the compass</strong> around the magnet: the needle’s red end turns away from the magnet’s red end and towards its blue end, following the push and pull.</p>
<p>Drag it far away and the needle swings round to point <strong>north</strong>. The whole Earth acts like a huge, weak magnet, and far from the bar magnet the Earth’s pull is the stronger one. That is where the names come from: a magnet’s north end is the end that turns to point north.</p>`,
			notes: `<p>Since a needle’s north end is pulled towards the north, the Earth’s magnet has its <em>south</em> end up near the North Pole (unlike ends pull). The Earth’s magnetic poles are also a long way from the geographic ones, and they wander a few kilometres every year.</p>`
		},
		{
			id: 'filings',
			chapter: 'around',
			title: 'Iron filings draw the pattern',
			scene: 'board',
			hints: { phase: 'filings' },
			duration: 20,
			controls: [filings],
			body: `
<p>Lay a sheet of paper over a magnet and sprinkle tiny bits of iron on it. Each bit turns like a little compass needle, so together they draw the pattern of the push and pull all around the magnet. The pattern is called the magnet’s <dfn data-def="The space around a magnet where its push and pull can be felt. Iron filings and compass needles line up along it.">magnetic field</dfn>.</p>
<p>The lines crowd together at the two ends, where the pull is strongest, and loop round from one end to the other. <strong>Change what is under the paper.</strong> With two magnets pulling, the lines run straight across the gap from one to the other. With two pushing, the lines from the two facing ends never join: they bend away sideways, and right in the middle is a spot where the two pushes cancel and the filings lie any which way.</p>`
		},
		// ------------------------------------------------------------------ what
		{
			id: 'clips',
			chapter: 'what',
			title: 'A paper clip becomes a magnet',
			scene: 'clips',
			hints: { phase: 'clips' },
			duration: 22,
			controls: [lower],
			body: `
<p>A steel paper clip is not a magnet: two paper clips don’t pull on each other. <strong>Lower the magnet</strong> towards a heap of them. Once it is close enough, a clip jumps up and sticks to its end.</p>
<p>Touching the magnet, the clip <strong>becomes a magnet itself</strong>: it gets a blue end next to the magnet’s red end, and a red end at the bottom. That new magnet can pick up a second clip, which becomes a magnet too and holds a third: a chain.</p>
<p>Lift the magnet and the chain comes with it. Pull the top clip off the magnet, though, and the chain falls apart: a steel clip is a magnet mostly while it touches one, and loses most of its magnetism when it is taken away.</p>`
		},
		{
			id: 'metals',
			chapter: 'what',
			title: 'Not every metal',
			scene: 'clips',
			hints: { phase: 'metals' },
			duration: 22,
			controls: [material],
			body: `
<p>A magnet does not pull every metal. <strong>Put different things under it.</strong> It picks up an iron nail, a steel paper clip and a strip of nickel. It ignores aluminium foil, copper wire and a gold ring.</p>
<p>Only a few metals are pulled: <strong>iron, nickel and cobalt</strong>, and most kinds of steel, which is mostly iron. Even steel can fool you: most stainless-steel spoons and kitchen sinks are made of a kind of steel that a magnet hardly pulls at all.</p>`,
			notes: `<p>Stainless steel comes in several kinds. The common one for cutlery and sinks (“18/8”, with chromium and nickel mixed in) is not magnetic, though bending it can make it slightly so. Other kinds, used for some knives and fridge doors, are magnetic. Coins are no guide either: many “nickel” coins are mostly copper and ignore a magnet.</p>`
		},
		{
			id: 'cut',
			chapter: 'what',
			title: 'Cut a magnet in half',
			scene: 'board',
			hints: { phase: 'cut' },
			duration: 20,
			controls: [pieces],
			body: `
<p>What if you cut a magnet in half, to get a red half and a blue half? <strong>Cut it</strong> and look: each half is a whole magnet, with a red end <strong>and</strong> a blue end, and the halves pull on each other across the cut.</p>
<p>Cut the halves again, and again: every piece still has two ends. A magnet is made of tiny magnetic regions, all lined up the same way, so wherever you cut it, a new pair of ends appears. You can never get a magnet with only one end.</p>`
		},
		{
			id: 'next',
			chapter: 'what',
			title: 'Read next',
			scene: 'board',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>A magnet always has two ends; like ends push apart and unlike ends pull together, and the pull fades quickly with distance.</p>
<p>Magnets have a close cousin: electricity. A wire carrying a current is a magnet while the current flows, and a magnet moving past a coil of wire makes a current. The page on <a href="../electromagnetism/">electromagnetism</a> shows how electric and magnetic pulls are two sides of one thing.</p>`
		}
	]
};
