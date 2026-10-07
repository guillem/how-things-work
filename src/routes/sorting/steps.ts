import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Run by itself',
	default: true,
	help: 'Off: step through one operation at a time — drag the marker on the timeline, or focus it and use the arrow keys.'
};

const pace: Control = {
	type: 'range',
	id: 'pace',
	label: 'Speed',
	min: 1,
	max: 60,
	step: 1,
	default: 6,
	unit: ' operations/s'
};

const size: Control = {
	type: 'range',
	id: 'size',
	label: 'Number of bars',
	min: 6,
	max: 40,
	step: 1,
	default: 16
};

const order: Control = {
	type: 'select',
	id: 'order',
	label: 'Starting order',
	default: 'shuffled',
	options: [
		{ value: 'shuffled', label: 'Shuffled' },
		{ value: 'nearly', label: 'Nearly sorted' },
		{ value: 'sorted', label: 'Sorted' },
		{ value: 'reversed', label: 'Reversed' }
	]
};

const shuffle: Control = {
	type: 'action',
	id: 'shuffle',
	label: 'New shuffle',
	action: 'New shuffle',
	help: 'Same algorithm, a different random order.'
};

const speedup: Control = {
	type: 'select',
	id: 'speedup',
	label: 'The bubble-sort computer is faster by',
	default: '100',
	options: [
		{ value: '1', label: '×1' },
		{ value: '10', label: '×10' },
		{ value: '100', label: '×100' },
		{ value: '1000', label: '×1000' }
	]
};

const stepper = [play, pace, size, order, shuffle];

export const spec: ExplainerSpec = {
	slug: 'sorting',
	title: 'How computers sort',
	summary:
		'Watch four sorting methods put the same bars in order, count every comparison they make, and see why the way the cost grows matters more than the speed of the computer.',
	chapters: [
		{ id: 'simple', title: 'Simple sorts' },
		{ id: 'divide', title: 'Divide and conquer' },
		{ id: 'growth', title: 'How the cost grows' }
	],
	steps: [
		// ------------------------------------------------------------------ simple
		{
			id: 'problem',
			chapter: 'simple',
			title: 'Putting things in order',
			scene: 'bars',
			hints: { algorithm: 'bubble', intro: true },
			duration: 20,
			controls: [play, shuffle],
			body: `
<p>Sorting — putting things in order — is one of the jobs computers do most: search results, contacts, prices, the files in a folder. Here the things are bars, and the goal is to arrange them from shortest to tallest.</p>
<p>A computer cannot see the whole row at a glance the way you can. It works with two simple moves:</p>
<ul>
<li><strong>compare</strong> two items to find which is bigger (highlighted);</li>
<li><strong>move</strong> items, for example by swapping two of them.</li>
</ul>
<p>A <dfn data-def="A precise, step-by-step method for solving a problem, which a computer can follow.">sorting algorithm</dfn> is a recipe for which items to compare and when to move them. To compare recipes, we count the <strong>comparisons</strong> they need: it is a fair measure of the work, whatever computer runs it.</p>`
		},
		{
			id: 'bubble',
			chapter: 'simple',
			title: 'Bubble sort',
			scene: 'bars',
			hints: { algorithm: 'bubble' },
			duration: 30,
			controls: stepper,
			body: `
<p>The simplest recipe: walk along the row comparing each pair of <strong>neighbours</strong>, and swap them if they are in the wrong order.</p>
<p>After one walk, the tallest bar has been carried all the way to the end, like a bubble rising — so it is in its final place (green). Walk again, and the second tallest settles next to it. Repeat until a walk makes no swaps.</p>
<p>The cost: with <i>n</i> bars, up to <i>n</i> − 1 walks of up to <i>n</i> − 1 comparisons each — roughly <i>n</i>²/2 comparisons. Sixteen bars can take 120 comparisons; a thousand would take about half a million.</p>`,
			notes: `<p>This version stops as soon as a walk makes no swaps, so on an already-sorted row it needs just one walk: <i>n</i> − 1 comparisons. Try the <em>Sorted</em> and <em>Reversed</em> starting orders.</p>`
		},
		{
			id: 'insertion',
			chapter: 'simple',
			title: 'Insertion sort',
			scene: 'bars',
			hints: { algorithm: 'insertion' },
			duration: 30,
			controls: stepper,
			body: `
<p>This is how most people sort a hand of cards. Keep a sorted part on the left (it starts with one bar). Take the next bar and slide it left, past every taller bar, until it fits.</p>
<p>Each new bar is compared with the bars to its left until it finds its place. On a shuffled row that is, on average, half of them — about <i>n</i>²/4 comparisons in total. Better than bubble sort, but still growing with <i>n</i>².</p>
<p>Insertion sort shines when the row is <em>nearly sorted</em>: each bar only moves a step or two, so the work is close to just one comparison per bar.</p>`
		},
		// ------------------------------------------------------------------ divide
		{
			id: 'merge',
			chapter: 'divide',
			title: 'Merge sort: split, sort, merge',
			scene: 'bars',
			hints: { algorithm: 'merge' },
			duration: 30,
			controls: stepper,
			body: `
<p>A different idea: <dfn data-def="Solving a problem by splitting it into smaller problems of the same kind, solving those, and combining the answers.">divide and conquer</dfn>. Split the row in half, sort each half, then <strong>merge</strong> the two sorted halves.</p>
<p>Merging is cheap: look at the first bar of each half, take the smaller, and repeat — one comparison per bar placed. And how do you sort each half? The same way: split it, sort the quarters, merge. Keep splitting until each piece is a single bar, which is already sorted.</p>
<p>Halving 16 bars takes 4 levels (16 → 8 → 4 → 2 → 1), and each level of merging costs at most about <i>n</i> comparisons. So the total is about <i>n</i> × log₂ <i>n</i> — for a thousand bars, under 10,000 comparisons instead of half a million.</p>`,
			notes: `<p>log₂ <i>n</i> (“log base 2 of <i>n</i>”) is the number of times you can halve <i>n</i> before reaching 1: log₂ 16 = 4, log₂ 1,024 = 10, log₂ of a million ≈ 20. It grows very slowly, which is the whole point.</p>`
		},
		{
			id: 'quick',
			chapter: 'divide',
			title: 'Quick sort: pick a pivot',
			scene: 'bars',
			hints: { algorithm: 'quick' },
			duration: 30,
			controls: stepper,
			body: `
<p>Another divide-and-conquer recipe. Pick one bar as the <dfn data-def="The bar that the others are compared with when splitting the row.">pivot</dfn> (here, the last bar of the section). Compare every other bar with it: shorter ones go to its left, taller ones to its right. The pivot is now in its final place.</p>
<p>Then do the same, separately, to the part on the left and the part on the right, and so on until every piece is a single bar.</p>
<p>When the pivots split the sections roughly in half, this costs about <i>n</i> log₂ <i>n</i> comparisons, like merge sort — and in practice it is often the fastest of all. But try a <em>Sorted</em> start: the last bar is always the tallest, every split is lopsided, and quick sort slows to <i>n</i>²/2.</p>`,
			notes: `<p>Real libraries avoid that trap by choosing the pivot more cleverly, for example at random or as the middle value of three bars. This page uses the simple textbook rule so the weakness is visible.</p>`
		},
		{
			id: 'race',
			chapter: 'divide',
			title: 'A race on the same bars',
			scene: 'race',
			duration: 30,
			controls: [pace, size, order, shuffle],
			body: `
<p>All four recipes, side by side, sorting the same row at the same speed: one operation each per tick. The counters show the comparisons each one has made so far.</p>
<p>With a few bars the difference is small. Raise the number of bars and watch merge sort and quick sort pull away. Then try the starting orders: insertion and bubble sort win on a sorted row, and quick sort with its last-bar pivot is suddenly the slowest.</p>`
		},
		// ------------------------------------------------------------------ growth
		{
			id: 'growth',
			chapter: 'growth',
			title: 'How the cost grows',
			scene: 'growth',
			hints: { phase: 'growth' },
			duration: 22,
			controls: [order],
			body: `
<p>Now forget the bars and just count. The chart runs each algorithm on rows of 10 up to 1,000 items and plots the comparisons it needed against the number of items.</p>
<p>Two families appear. Bubble and insertion sort curve upwards ever more steeply: their cost grows like <i>n</i>². Merge and quick sort stay almost straight: their cost grows like <i>n</i> log₂ <i>n</i>.</p>
<p>At 1,000 items the slow pair already needs 20 to 60 times as many comparisons as the fast pair, and the gap widens without limit as <i>n</i> grows.</p>`
		},
		{
			id: 'bigo',
			chapter: 'growth',
			title: 'Big-O: the shape of the growth',
			scene: 'growth',
			hints: { phase: 'bigo' },
			duration: 22,
			body: `
<p>Computer scientists describe that shape with <dfn data-def="A way of describing how an algorithm's cost grows with the size of its input, ignoring constant factors: O(n²), O(n log n)…">Big-O notation</dfn>. Bubble and insertion sort are <strong>O(<i>n</i>²)</strong>; merge sort is <strong>O(<i>n</i> log <i>n</i>)</strong>.</p>
<p>The quickest way to feel the difference: <strong>double the input</strong>. An O(<i>n</i>²) algorithm then does about four times the work. An O(<i>n</i> log <i>n</i>) one does only a bit more than twice the work. Double again and again, and the first falls further behind every time.</p>
<p>Big-O deliberately ignores constant factors — whether one comparison takes a nanosecond or a microsecond. Only the shape of the growth is kept, because for large inputs the shape wins.</p>`,
			notes: `<p>Strictly, Big-O gives an upper bound on the growth: “O(<i>n</i>²)” means “grows no faster than some constant times <i>n</i>²”. It is usually quoted for the worst case: quick sort is O(<i>n</i>²) in the worst case but O(<i>n</i> log <i>n</i>) on average, and no method that sorts only by comparing pairs can manage with much fewer than <i>n</i> log₂ <i>n</i> comparisons in the worst case.</p>`
		},
		{
			id: 'inputs',
			chapter: 'growth',
			title: 'Best and worst cases',
			scene: 'growth',
			hints: { phase: 'inputs' },
			duration: 22,
			body: `
<p>The same algorithm can behave very differently depending on its input. Here the counts are measured on three kinds of rows: already sorted, shuffled, and reversed.</p>
<ul>
<li>On a <strong>sorted</strong> row, bubble and insertion sort need just <i>n</i> − 1 comparisons — they only check that each neighbour is in order. Quick sort with the last-bar pivot hits its worst case.</li>
<li>On a <strong>reversed</strong> row, bubble and insertion sort compare every pair: <i>n</i>(<i>n</i> − 1)/2.</li>
<li>Merge sort barely cares: about <i>n</i> log₂ <i>n</i> every time.</li>
</ul>
<p>That is why programmers ask not just “how fast on average?” but “how slow can it get?”.</p>`
		},
		{
			id: 'machine',
			chapter: 'growth',
			title: 'A faster computer, or a better algorithm?',
			scene: 'growth',
			hints: { phase: 'machine' },
			duration: 24,
			controls: [speedup],
			body: `
<p>Give bubble sort a computer a hundred times faster than the one running merge sort. Who wins?</p>
<p>For small inputs, the fast computer does: its speed hides the extra work. But bubble sort's work grows like <i>n</i>², so past a certain size — the crossing point on the chart — merge sort on the slow computer finishes first, and from there on the gap only grows.</p>
<p>Make the computer a thousand times faster and the crossing point moves further out, but it never goes away. That is the lesson of this page: <strong>how the cost grows matters more than the speed of the machine</strong>.</p>`
		}
	]
};
