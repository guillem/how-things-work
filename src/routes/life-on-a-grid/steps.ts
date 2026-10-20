import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const stepButton: Control = {
	type: 'action',
	id: 'step',
	label: 'Next picture',
	action: 'Step',
	help: 'Every square follows the rules at the same moment.'
};

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Play',
	default: true
};

const oneByOne: Control = {
	type: 'toggle',
	id: 'onebyone',
	label: 'Change squares one at a time (the wrong way)',
	default: false
};

const birth: Control = {
	type: 'range',
	id: 'birth',
	label: 'Neighbours needed for a birth',
	min: 1,
	max: 6,
	step: 1,
	default: 3,
	format: (v) => `${v}`
};

const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Start again',
	action: 'Run it again',
	help: 'The same starting shape, played from the beginning.'
};

export const spec: ExplainerSpec = {
	slug: 'life-on-a-grid',
	title: 'Life on a grid',
	summary:
		'Paint a few squares, press step, and watch them live, die and be born by three simple rules about counting neighbours. Find shapes that sit still, shapes that blink and one that walks, all made by a rule nobody drew them with.',
	chapters: [
		{ id: 'rules', title: 'The rules' },
		{ id: 'shapes', title: 'Shapes that come alive' },
		{ id: 'more', title: 'Playing with the rule' }
	],
	steps: [
		// ------------------------------------------------------------------ rules
		{
			id: 'paint',
			chapter: 'rules',
			title: 'A grid of squares',
			scene: 'grid',
			hints: { phase: 'paint' },
			duration: 20,
			controls: [stepButton],
			body: `
<p>Here is a grid of squares. Each square is either <strong>alive</strong> (filled in) or <strong>empty</strong>. Click squares to paint them alive, or click again to empty them.</p>
<p>Every square has eight neighbours: the squares touching it, including the corners. The small number in a square is how many of its neighbours are alive right now. This board wraps round: a square on one edge has neighbours on the opposite edge, so shapes that walk off one side come back on the other.</p>
<p>Press <strong>Step</strong> and every square decides, all at the same moment, whether it is alive in the next picture. What decides it is that number, and whether the square is alive or empty now.</p>`
		},
		{
			id: 'rules',
			chapter: 'rules',
			title: 'Three rules',
			scene: 'grid',
			hints: { phase: 'rules' },
			duration: 22,
			controls: [stepButton],
			body: `
<p>The whole game is three rules, invented by the mathematician John Conway in 1970:</p>
<p><strong>Lonely dies:</strong> a live square with fewer than two live neighbours is empty next time. <strong>Crowded dies:</strong> a live square with more than three live neighbours is empty next time. <strong>Three makes one:</strong> an empty square with exactly three live neighbours comes alive.</p>
<p>A live square with two or three neighbours just stays alive. The squares marked red are about to die, the ones marked green are about to be born. Press Step and check.</p>`
		},
		{
			id: 'yours',
			chapter: 'rules',
			title: 'Press play',
			scene: 'grid',
			hints: { phase: 'yours' },
			duration: 22,
			controls: [play],
			body: `
<p>Now let your own painting run by itself: three pictures every second, every square following the rules each time. Pause it whenever you like and play on from the same picture.</p>
<p>Most random scribbles change wildly for a while, then calm down into a few shapes that sit still or blink. Some leave behind a little shape that walks away. The next steps look at those shapes one by one. (To change the painting, go back a step.)</p>`
		},
		// ------------------------------------------------------------------ shapes
		{
			id: 'still',
			chapter: 'shapes',
			title: 'Shapes that sit still, shapes that blink',
			scene: 'grid',
			hints: { phase: 'still' },
			duration: 20,
			controls: [play],
			body: `
<p>Some shapes never change. In the <strong>block</strong>, a square of four, every square has exactly three live neighbours, so all stay alive, and no empty square around it has three. The ring-shaped <strong>beehive</strong> sits still too.</p>
<p>Others repeat. The <strong>blinker</strong>, a line of three, turns into a line across and then back again, forever. The <strong>toad</strong> pulses every second picture as well.</p>`
		},
		{
			id: 'glider',
			chapter: 'shapes',
			title: 'A shape that walks',
			scene: 'grid',
			hints: { phase: 'glider' },
			duration: 22,
			controls: [play],
			body: `
<p>This little shape of five squares is called a <strong>glider</strong>. Watch it: it changes shape, changes again, and after four changes it is back to its first shape, but one square further across and one square further down. So it walks across the grid, diagonally, forever.</p>
<p>Nobody told it to walk. The rules only talk about single squares and their neighbours. The walking comes out of the rules by itself.</p>`
		},
		{
			id: 'together',
			chapter: 'shapes',
			title: 'Everyone changes at once',
			scene: 'grid',
			hints: { phase: 'together' },
			duration: 20,
			controls: [oneByOne],
			body: `
<p>There is one thing to get right: every square must look at the <em>old</em> picture before any square changes. It is like everybody in a room deciding at the same moment, from what they can all see now.</p>
<p>Switch on <strong>one at a time</strong>, and the squares change one after another, from the top-left, each one seeing the squares before it already changed. The blinker stops blinking and the glider falls apart. Same rules, wrong order, different result.</p>`
		},
		// ------------------------------------------------------------------ more
		{
			id: 'rule',
			chapter: 'more',
			title: 'Change one number',
			scene: 'grid',
			hints: { phase: 'rule' },
			duration: 24,
			controls: [birth],
			body: `
<p>Here is a little seed of five squares that, with Conway’s rules, grows into a busy, changing crowd before settling down. Now change one number: how many neighbours an empty square needs to come alive.</p>
<p>With one or two, this seed spreads quickly across the board, with squares appearing and disappearing all the time. With four, it turns at once into a shape that stays still. With five or six, it disappears. Changing just one number changes its whole future.</p>`
		},
		{
			id: 'same',
			chapter: 'more',
			title: 'Not random',
			scene: 'grid',
			hints: { phase: 'same' },
			duration: 20,
			controls: [again],
			body: `
<p>The crowd that grows from the seed looks messy, almost random. But it isn’t: press <strong>Run it again</strong> and you get exactly the same pictures in the same order, every time. Nothing in the rules is left to chance.</p>
<p>Everything you see, every blinker, block and glider thrown off, was already decided by the five squares you started with.</p>`
		},
		{
			id: 'next',
			chapter: 'more',
			title: 'Read next',
			scene: 'grid',
			hints: { phase: 'next' },
			duration: 16,
			body: `
<p>A rule about counting neighbours, applied to every square at once, makes things that sit still, blink, walk and grow, and nobody drew any of them.</p>
<p>The page on <a href="../cellular-automata/">cellular automata</a> shrinks the grid to a single row and looks at every possible rule of that kind, all 256 of them: one draws a pattern of triangles, one looks random, and one can work like a computer.</p>`
		}
	]
};
