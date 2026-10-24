import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { READY } from './doodles';

/** A select of ready drawings for the pad, with "your drawing" for what the reader draws. */
function drawings(id: string, label: string, keys: string[], fallback: string): Control {
	return {
		type: 'select',
		id,
		label,
		default: fallback,
		options: [
			...keys.map((k) => ({ value: k, label: READY[k].name })),
			{ value: 'mine', label: 'Your drawing' }
		],
		help: 'Or draw on the pad with a mouse or a finger.'
	};
}

const doodle = drawings('doodle', 'Drawing', ['cat', 'sitting', 'house', 'chimney'], 'cat');

const squaresDef =
	'<dfn data-def="The machine’s way of seeing a drawing: a grid of 10 by 10 squares laid over the pad, each square inked if a line passes through it.">squares</dfn>';
const neighbourDef =
	'<dfn data-def="One of the stored drawings with the fewest squares different from the new drawing: the ones most like it, square by square.">nearest neighbours</dfn>';

export const spec: ExplainerSpec = {
	slug: 'teach-a-machine',
	title: 'Teach a machine to tell things apart',
	summary:
		'Show a machine a pile of drawn cats and houses, each with its label, then draw a new one: it shrinks every drawing to 100 squares, finds the stored drawings most like yours square by square, and lets them vote. Watch it fail with too few examples, teach it your own, and trick it with a pile where every cat sits at the top.',
	chapters: [
		{ id: 'squares', title: 'Drawings as squares' },
		{ id: 'vote', title: 'The neighbours vote' },
		{ id: 'traps', title: 'Traps' }
	],
	steps: [
		// ------------------------------------------------------------------ squares
		{
			id: 'pile',
			chapter: 'squares',
			title: 'A pile of examples',
			scene: 'machine',
			hints: { phase: 'pile' },
			duration: 14,
			body: `
<p>How could a computer tell a drawing of a cat from a drawing of a house? Nobody can write down a rule for “cat” that works for every drawing. So we don’t give it a rule. We give it <strong>examples</strong>.</p>
<p>Here are 16 quick drawings, 8 cats and 8 houses, and each one has a label that says what it is. The machine will learn from this pile, and from nothing else.</p>`,
			notes: `<p>We drew these for the page, each from wobbly circles and lines like a quick pen doodle, in different sizes and styles. Real piles are much bigger: Google’s game <em>Quick, Draw!</em> collected 50 million doodles of 345 kinds of thing, each drawn in 20 seconds by a player and labelled with what they were asked to draw.</p>`
		},
		{
			id: 'squares',
			chapter: 'squares',
			title: 'Shrink it to squares',
			scene: 'machine',
			hints: { phase: 'squares' },
			duration: 16,
			controls: [doodle],
			body: `
<p>The machine can’t see a drawing the way you do. First it lays a grid over the pad, 10 squares across and 10 down: 100 ${squaresDef}. Every square a line passes through is inked; the others stay empty.</p>
<p>That is all it keeps: which of the 100 squares are inked. This cat inks 33 of them. Draw on the pad with a mouse or a finger, or pick a ready drawing, and watch its squares.</p>`
		},
		{
			id: 'compare',
			chapter: 'squares',
			title: 'Square by square',
			scene: 'machine',
			hints: { phase: 'compare' },
			duration: 18,
			controls: [
				{
					type: 'select',
					id: 'against',
					label: 'Compare with',
					default: 'cat',
					options: [
						{ value: 'cat', label: 'A stored cat' },
						{ value: 'sitting', label: 'The sitting cat' },
						{ value: 'long', label: 'The long, low house' },
						{ value: 'house', label: 'A stored house' }
					]
				}
			],
			body: `
<p>To compare two drawings, the machine lays one grid on top of the other and counts the squares where one is inked and the other is empty. The fewer squares differ, the more alike it thinks they are.</p>
<p>The cat and a stored cat differ in only 7 squares. Now pick the sitting cat: 33 squares differ, one more than for the long, low house. You can see that both are cats; the machine only sees squares that don’t match.</p>`
		},
		// ------------------------------------------------------------------ vote
		{
			id: 'vote',
			chapter: 'vote',
			title: 'The three nearest vote',
			scene: 'machine',
			hints: { phase: 'vote' },
			duration: 20,
			controls: [doodle],
			body: `
<p>Now the machine compares the new drawing with every drawing in the pile. The three with the fewest squares different are its ${neighbourDef}, and their labels vote: two or three votes for “cat”, and the answer is cat.</p>
<p>Select “A cat”: all three neighbours are cats. Draw a cat or a house of your own and see what it says. Try one small in a corner too: the drawings in the pile are mostly big, near the middle.</p>`,
			notes: `<p>This way of sorting is called <em>k-nearest neighbours</em>, where k is how many neighbours vote: here three, an odd number, so that two labels can never tie. It is one of the oldest ways for a computer to learn from examples, described by Evelyn Fix and Joseph Hodges in 1951. It is not a <a href="../neural-networks/">neural network</a>: it learns nothing in advance, it just keeps every example and compares. Real programs usually first move every drawing to the middle and make it the same size, and compare in a smarter way than counting squares.</p>`
		},
		{
			id: 'few',
			chapter: 'vote',
			title: 'Too few examples',
			scene: 'machine',
			hints: { phase: 'few' },
			duration: 20,
			controls: [
				{
					type: 'range',
					id: 'examples',
					label: 'Examples of each it is shown',
					min: 1,
					max: 8,
					step: 1,
					default: 1,
					format: (v) => (v === 1 ? '1 cat and 1 house' : `${v} cats and ${v} houses`)
				}
			],
			body: `
<p>What if the pile were tiny? Here the machine has been shown just one drawing of each: a sitting cat and a long, low house. With only two, the nearest one decides alone. Then it is tested on 8 new drawings it has never seen.</p>
<p>It gets 3 of the 8 wrong. The only cat it knows is a sitting one, so the other cats are called houses, and one house is closer to that sitting cat than to the only house. Slide to show it more. With three of each it gets all eight right, and with all eight of each, every vote is three to nothing: the votes firm up.</p>`
		},
		{
			id: 'teach',
			chapter: 'vote',
			title: 'Teach it yourself',
			scene: 'machine',
			hints: { phase: 'teach' },
			duration: 30,
			controls: [
				drawings(
					'ready',
					'Put on the pad',
					['cat', 'sitting', 'round', 'house', 'chimney', 'wide'],
					'mine'
				)
			],
			body: `
<p>Now its memory starts empty, and you are the teacher. Draw a cat and press “It’s a cat”; draw a house and press “It’s a house”. (No pen? Pick a ready drawing.)</p>
<p>Once it knows a cat and a house, it guesses every new drawing before you label it. The first guesses are often wrong. Keep teaching it cats and houses drawn in different ways, and watch it start to get them right.</p>`
		},
		// ------------------------------------------------------------------ traps
		{
			id: 'trap',
			chapter: 'traps',
			title: 'A lazy pattern',
			scene: 'machine',
			hints: { phase: 'trap' },
			duration: 20,
			controls: [drawings('trial', 'Drawing', ['catLow', 'houseHigh', 'catHigh'], 'catLow')],
			body: `
<p>Here is a sneaky pile. Every label is right, but every cat was drawn at the top and every house at the bottom.</p>
<p>Now show it a cat drawn at the bottom. Its three nearest neighbours are all houses: down there, its squares match houses’ squares better than any cat’s. A house at the top is called a cat. The machine never learned what a cat looks like. In this pile, where a drawing sits tells cats from houses just as well as its shape does, and the squares can’t tell the difference.</p>`,
			notes: `<p>Researchers have built traps like this on purpose. In 2016 Marco Ribeiro, Sameer Singh and Carlos Guestrin trained a program to tell wolves from husky dogs on photos they picked so that every wolf had snow behind it and no husky did. It learned to spot snow, and they used it to test whether people would notice that it could not be trusted, and whether their tool for explaining its answers would show them why.</p>`
		},
		{
			id: 'varied',
			chapter: 'traps',
			title: 'Mix it up',
			scene: 'machine',
			hints: { phase: 'varied' },
			duration: 18,
			controls: [
				{
					type: 'toggle',
					id: 'mixed',
					label: 'Add cats drawn low and houses drawn high',
					default: false
				}
			],
			body: `
<p>The fix is not a cleverer machine but better examples. Switch on 4 more cats drawn low down and 4 more houses drawn up high.</p>
<p>Now the cat at the bottom has cats among its nearest neighbours, and two cats outvote one house. More examples help, but only if they are varied: if every example shares a lazy pattern, the machine learns the pattern.</p>`
		},
		{
			id: 'fish',
			chapter: 'traps',
			title: 'Comparing, not understanding',
			scene: 'machine',
			hints: { phase: 'fish' },
			duration: 18,
			body: `
<p>Show it a fish. It has never seen one, and it can’t say “I don’t know”: the only labels it has are cat and house. Its nearest neighbours vote, and it says cat.</p>
<p>The machine never knew what a cat is. It compared squares and counted votes. Programs that recognise drawings and photos today are much cleverer, usually <a href="../neural-networks/">neural networks</a> taught with millions of examples, but they learn from examples too, and the same lessons hold: more and more varied examples make them better, and a lazy pattern in the examples teaches them the wrong thing.</p>
<p>Next: <a href="../learning-from-data/">learning from data</a> shows how a machine can learn a rule from examples and be tested on new ones. <a href="../spam-filter-word-counts/">How a spam filter decides</a> teaches a machine with words instead of squares.</p>`
		}
	]
};
