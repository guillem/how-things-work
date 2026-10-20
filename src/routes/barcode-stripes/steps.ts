import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const scanAt: Control = {
	type: 'range',
	id: 'scan',
	label: 'How far the red line has gone',
	min: 0,
	max: 1,
	step: 0.01,
	default: 1,
	format: (v) => `${Math.round(v * 100)}% of the way across`
};

const group: Control = {
	type: 'range',
	id: 'group',
	label: 'Which digit',
	min: 1,
	max: 12,
	step: 1,
	default: 2,
	format: (v) => `digit ${v} of 12`
};

const digit: Control = {
	type: 'range',
	id: 'digit',
	label: 'Digit',
	min: 0,
	max: 9,
	step: 1,
	default: 0,
	format: (v) => String(v)
};

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'How fast the barcode passes the scanner',
	min: 0.4,
	max: 2.5,
	step: 0.1,
	default: 1,
	format: (v) =>
		v < 1 ? `slowly (${v.toFixed(1)}×)` : v > 1 ? `fast (${v.toFixed(1)}×)` : 'normal speed'
};

const slant: Control = {
	type: 'range',
	id: 'slant',
	label: 'Slant of the red line',
	min: 0,
	max: 20,
	step: 1,
	default: 0,
	unit: '°',
	format: (v) => (v === 0 ? 'straight across' : `${v}° slanted`)
};

const flip: Control = {
	type: 'toggle',
	id: 'flip',
	label: 'Upside down',
	default: false
};

const smudged: Control = {
	type: 'toggle',
	id: 'smudge',
	label: 'Smudge one stripe',
	default: false
};

const misprinted: Control = {
	type: 'toggle',
	id: 'misprint',
	label: 'Print one bar a column out of place',
	default: false
};

const sale: Control = {
	type: 'toggle',
	id: 'sale',
	label: 'Sale today',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'barcode-stripes',
	title: 'Barcodes at the checkout',
	summary:
		'Sweep a scanner’s red line across a barcode and see what it sees: dark, light, dark, light. Find the number hidden in the widths of the stripes, see why different scanning speeds and angles can give the same number, how the scanner knows which way up the code is, and how the last digit catches a misprint.',
	chapters: [
		{ id: 'stripes', title: 'Stripes into digits' },
		{ id: 'tricks', title: 'Clever tricks' }
	],
	steps: [
		// ------------------------------------------------------------------ stripes
		{
			id: 'scan',
			chapter: 'stripes',
			title: 'What the scanner sees',
			scene: 'barcode',
			hints: { phase: 'scan' },
			duration: 18,
			controls: [scanAt],
			body: `
<p>At the checkout, a red line of light sweeps across the barcode. Black stripes reflect almost no light and white gaps reflect a lot, so a light sensor in the scanner sees the brightness go dark, light, dark, light as the line passes.</p>
<p>Slide the red line across. Below the barcode is what the scanner records: how long it saw dark and how long it saw light, one after another. That pattern of long and short is all it gets. The blank margins on either side help it find where the barcode starts and ends.</p>`
		},
		{
			id: 'marks',
			chapter: 'stripes',
			title: 'Marks and groups',
			scene: 'barcode',
			hints: { phase: 'marks' },
			duration: 22,
			controls: [group],
			body: `
<p>This is a UPC-A barcode, the 12-digit kind printed on many products. It starts with a <strong>start mark</strong> of two thin bars, then six groups of stripes, a <strong>middle mark</strong>, six more groups and an <strong>end mark</strong>. The marks are the same on every barcode, so the scanner knows where the digits begin.</p>
<p>Each group is one digit, and each group is always two black bars and two white gaps. Step through the twelve groups and see each one’s digit.</p>`
		},
		{
			id: 'widths',
			chapter: 'stripes',
			title: 'A digit is four widths',
			scene: 'barcode',
			hints: { phase: 'widths' },
			duration: 22,
			controls: [digit],
			body: `
<p>Think of the barcode as made of very thin columns, each either black or white. Every digit takes exactly seven of them, shared between its two gaps and two bars. A stripe can be one, two, three or four columns wide.</p>
<p>So each digit is a pattern of four widths that add up to seven. On the left half, a zero is a gap three wide, a bar two wide, a gap one wide and a bar one wide: 3, 2, 1, 1. Pick a digit to see its pattern.</p>`
		},
		// ------------------------------------------------------------------ tricks
		{
			id: 'speed',
			chapter: 'tricks',
			title: 'Fast or slow',
			scene: 'barcode',
			hints: { phase: 'speed' },
			duration: 22,
			controls: [speed],
			body: `
<p>The scanner can’t know how fast you moved the item. Faster or slower, every stripe looks shorter or longer, but they all stretch together.</p>
<p>So our simple scanner doesn’t measure widths; it compares them. The barcode is always 95 thin columns wide, so it divides the recording between the start and end marks into 95 equal parts and counts how many each stripe takes. Change the speed: the recording stretches, the digits come out the same. (Real scanners measure within each digit’s group instead, to cope with imperfect printing. And they have limits: the barcode must be big and clear enough, and the scan steady.)</p>`
		},
		{
			id: 'slant',
			chapter: 'tricks',
			title: 'At a slant',
			scene: 'barcode',
			hints: { phase: 'slant' },
			duration: 20,
			controls: [slant],
			body: `
<p>The red line doesn’t have to cross straight. Slant it: it takes a longer path across every stripe, but every stripe gets longer by the same amount, so the proportions and the digits stay the same.</p>
<p>Slant it too far, though, and the line runs off the top or bottom of the bars before it reaches the other end. Then part of the code is missing and the scanner can’t read it. That is why barcodes have tall bars.</p>`
		},
		{
			id: 'upside',
			chapter: 'tricks',
			title: 'Which way up?',
			scene: 'barcode',
			hints: { phase: 'upside' },
			duration: 20,
			controls: [flip],
			body: `
<p>A barcode can pass the scanner either way round. Read backwards, the stripes would give a different number, unless the scanner can tell.</p>
<p>It can, because the left and right halves use different patterns. Every left-hand digit has an odd number of black columns, every right-hand one an even number. Turn the barcode upside down: the scanner sees the even groups first, knows it is reading backwards, flips the pattern round and gets the right number.</p>`
		},
		{
			id: 'smudge',
			chapter: 'tricks',
			title: 'A smudge',
			scene: 'barcode',
			hints: { phase: 'smudge' },
			duration: 18,
			controls: [smudged],
			body: `
<p>Smudge one stripe, so its edge creeps one column into the gap beside it. That group’s four widths now make a pattern that is no digit at all, and the scanner gives up: the light turns red, scan again.</p>
<p>That is no accident. The digit patterns were chosen so that moving one stripe edge by exactly one column never turns one digit into another. Bigger smudges can, which is what the last digit is for.</p>`
		},
		{
			id: 'check',
			chapter: 'tricks',
			title: 'The last digit checks the others',
			scene: 'barcode',
			hints: { phase: 'check' },
			duration: 22,
			controls: [misprinted],
			body: `
<p>The twelfth digit is part of the product’s number, but it is worked out from the other eleven using a fixed counting rule. Here it comes out as 2. The scanner does the same counting and checks that the last digit agrees.</p>
<p>Now print one bar of the fourth digit one column out of place. That group no longer reads as a 0 but as a perfectly good 1, so the scanner reads a wrong number. But the counting no longer agrees with the last digit, and the light turns red. Getting any one digit wrong always breaks it, so a single wrong digit can never slip through.</p>`,
			notes: `<p>The counting rule: number the first eleven digits from the left. Add up the digits in places 1, 3, 5, 7, 9 and 11 and multiply by three; add the digits in places 2, 4, 6, 8 and 10. The check digit is what you must add to reach the nearest multiple of ten that is equal or higher. For 0 3 6 0 0 0 2 9 1 4 5: (0 + 6 + 0 + 2 + 1 + 5) × 3 = 42, plus 3 + 0 + 0 + 9 + 4 = 16, makes 58, and 2 more makes 60.</p>`
		},
		{
			id: 'price',
			chapter: 'tricks',
			title: 'Where is the price?',
			scene: 'barcode',
			hints: { phase: 'price' },
			duration: 22,
			controls: [sale],
			body: `
<p>For ordinary packaged products like this one, the stripes hold only an identifying number, not the price or the product’s name. The till looks that number up in the shop’s list, which says what the product is and what it costs today. (Some special shop labels, such as those on weighed food, do carry a price.)</p>
<p>Turn on the sale: the price on the till changes, but the barcode doesn’t change at all. So a barcode is a number written as stripe widths, read as proportions, with a last digit that catches a misread. Barcodes write digits with widths; computers write everything with just two signs, as the page on <a href="../binary/">binary</a> shows.</p>`
		}
	]
};
