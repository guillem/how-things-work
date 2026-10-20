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

const flip: Control = {
	type: 'toggle',
	id: 'flip',
	label: 'Upside down',
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
		'Sweep a scanner’s red line across a barcode and see what it sees: dark, light, dark, light. Find the number hidden in the widths of the stripes, see why speed and angle don’t matter, how the scanner knows which way up the code is, and how the last digit catches a misprint.',
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
<p>Slide the red line across. Below the barcode is what the scanner records: how long it saw dark and how long it saw light, one after another. That pattern of long and short is all it gets.</p>`
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
			title: 'Fast, slow or slanted',
			scene: 'barcode',
			hints: { phase: 'speed' },
			duration: 22,
			controls: [speed],
			body: `
<p>The scanner can’t know how fast you moved the item, or whether the red line crossed at a slant. Either way, every stripe looks longer or shorter, but they all stretch together.</p>
<p>So the scanner doesn’t measure widths; it compares them. The whole code is always 95 thin columns wide, so it divides what it saw into 95 equal parts and counts how many each stripe takes. Change the speed: the recording stretches, the digits come out the same. That is also why a barcode works printed big or small.</p>`
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
			id: 'check',
			chapter: 'tricks',
			title: 'The last digit checks the others',
			scene: 'barcode',
			hints: { phase: 'check' },
			duration: 22,
			controls: [misprinted],
			body: `
<p>The twelfth digit isn’t part of the product’s number. It is a <strong>check digit</strong>, worked out from the first eleven: add up the digits in the odd places and multiply by three, add the digits in the even places, and the check digit is whatever brings the total up to the next multiple of ten. Here that gives 2.</p>
<p>Now print one bar of the fourth digit one column out of place. That group no longer reads as a 0 but as a perfectly good 1, so the scanner reads a wrong number. But the sum no longer works out, and the light turns red instead of green: scan it again. Getting any one digit wrong always breaks the sum, so a single wrong digit can never slip through.</p>
<p>Smudges are caught even earlier. The digit patterns are chosen so that moving any single edge of a stripe never turns one digit into another: a smudged group simply matches no digit at all.</p>`
		},
		{
			id: 'price',
			chapter: 'tricks',
			title: 'Where is the price?',
			scene: 'barcode',
			hints: { phase: 'price' },
			duration: 18,
			controls: [sale],
			body: `
<p>Nowhere in the stripes is the price, or even the product’s name. The barcode is only a number. The till looks that number up in the shop’s list, which says what the product is and what it costs today.</p>
<p>Turn on the sale: the price on the till changes, but the barcode doesn’t change at all. That is how a shop can change prices without reprinting a single label.</p>`
		},
		{
			id: 'next',
			chapter: 'tricks',
			title: 'Read next',
			scene: 'barcode',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>A barcode is a number written as stripe widths, read as proportions so that speed and angle don’t matter, with a last digit that catches a misread. The price is looked up afterwards.</p>
<p>Barcodes write digits with widths; computers write everything with just two signs. The page on <a href="../binary/">binary</a> shows how ones and zeros can stand for any number, letter or picture.</p>`
		}
	]
};
