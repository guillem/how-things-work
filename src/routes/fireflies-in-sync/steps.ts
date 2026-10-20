import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const nudge: Control = {
	type: 'range',
	id: 'nudge',
	label: 'How much a flash hurries a neighbour’s clock',
	min: 0,
	max: 0.1,
	step: 0.005,
	default: 0.03,
	format: (v) => (v === 0 ? 'not at all' : `${Math.round(v * 100)}% of a full turn`)
};

const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Meadow',
	action: 'Start the meadow again',
	help: 'Every clock set to a random time, as at dusk.'
};

const shake: Control = {
	type: 'action',
	id: 'shake',
	label: 'Scramble',
	action: 'Scramble a patch',
	help: 'Or drag across the meadow to scramble the fireflies you pass.'
};

const other: Control = {
	type: 'action',
	id: 'other',
	label: 'Firefly',
	action: 'Follow another firefly'
};

export const spec: ExplainerSpec = {
	slug: 'fireflies-in-sync',
	title: 'Fireflies that flash together',
	summary:
		'A meadow of fireflies, each with its own little clock that flashes when it gets round to twelve. Let each flash hurry the neighbours’ clocks a bit, and watch the twinkling turn into patches, then waves, then the whole field flashing as one, with no leader at all.',
	chapters: [
		{ id: 'clocks', title: 'Little clocks' },
		{ id: 'together', title: 'Flashing together' }
	],
	steps: [
		// ------------------------------------------------------------------ clocks
		{
			id: 'meadow',
			chapter: 'clocks',
			title: 'A meadow at night',
			scene: 'meadow',
			hints: { phase: 'meadow', nudge: 0 },
			duration: 16,
			body: `
<p>It is a warm night and the meadow is full of fireflies. Each one flashes about once a second. But they flash whenever they like, so the meadow just twinkles: a flash here, a flash there, never all at once.</p>
<p>The bar at the bottom shows how much in step the fireflies are. Right now, hardly at all.</p>`
		},
		{
			id: 'clock',
			chapter: 'clocks',
			title: 'Each firefly has a little clock',
			scene: 'meadow',
			hints: { phase: 'clock', nudge: 0 },
			duration: 18,
			body: `
<p>Think of each firefly as carrying a little clock with one hand. The hand goes round once in about a second. When it reaches twelve, the firefly flashes, and the hand starts round again.</p>
<p>The ringed firefly’s clock is shown on the right. Every firefly’s clock runs at almost the same speed, but they all started at different times, so their flashes stay scattered.</p>`
		},
		// ------------------------------------------------------------------ together
		{
			id: 'nudge',
			chapter: 'together',
			title: 'A flash hurries the neighbours',
			scene: 'meadow',
			hints: { phase: 'nudge' },
			duration: 24,
			controls: [nudge],
			body: `
<p>Now add one rule. When a firefly sees a neighbour flash, its own clock jumps forward a little, as if hurrying to catch up. If that takes its hand past twelve, it flashes straight away.</p>
<p>Turn the hurrying up a little. Small patches of fireflies start flashing together, then the patches grow and flashes sweep across the meadow in waves. Turn it up more and the whole meadow pulls together.</p>`
		},
		{
			id: 'together',
			chapter: 'together',
			title: 'The whole field as one',
			scene: 'meadow',
			hints: { phase: 'together', nudge: 0.06 },
			duration: 26,
			controls: [again],
			body: `
<p>With each flash hurrying the neighbours’ clocks by 6% of a turn, all 160 fireflies flash together in about twenty seconds. The bar fills up: they are in step.</p>
<p>Why does it work? A firefly whose clock is a little behind gets hurried by the flashes around it, and catches up. One that flashes early has nobody to hurry it, so the others catch up with it. Little by little, everybody ends up on the same beat. Start the meadow again: the same thing happens every time.</p>`
		},
		{
			id: 'scramble',
			chapter: 'together',
			title: 'Mix them up',
			scene: 'meadow',
			hints: { phase: 'scramble', nudge: 0.06 },
			duration: 22,
			controls: [shake],
			body: `
<p>Drag across the meadow, or press the button, to scramble the clocks of a patch of fireflies. For a moment that patch flashes out of time with the rest.</p>
<p>But not for long. Their neighbours’ flashes hurry them, a little each time, and within about fifteen seconds they are back in step with the whole field.</p>`
		},
		{
			id: 'noleader',
			chapter: 'together',
			title: 'No leader',
			scene: 'meadow',
			hints: { phase: 'noleader', nudge: 0.06 },
			duration: 20,
			controls: [other],
			body: `
<p>It is tempting to think one firefly must be in charge, flashing the beat for the others, or that something outside, like the moonlight, gives the signal. Neither is true here.</p>
<p>Follow any firefly you like: every one follows exactly the same rule, and none is special. The flashing together comes only from each one reacting to the flashes of its neighbours.</p>`
		},
		{
			id: 'real',
			chapter: 'together',
			title: 'Real fireflies',
			scene: 'meadow',
			hints: { phase: 'real', nudge: 0.06 },
			duration: 18,
			body: `
<p>This really happens, but only in some kinds of firefly. In the mangrove swamps of Southeast Asia, whole trees of fireflies flash together night after night. In the Great Smoky Mountains of the United States, one species flashes in bursts together for a couple of weeks each summer, and people come from far away to watch.</p>
<p>Real fireflies are more complicated than these little clocks, and each species has its own flash pattern. But the idea is the same: no conductor, just neighbours nudging each other into step.</p>`
		},
		{
			id: 'next',
			chapter: 'together',
			title: 'Read next',
			scene: 'meadow',
			hints: { phase: 'next', nudge: 0.06 },
			duration: 14,
			body: `
<p>Thousands of fireflies flash together with no conductor, because each one nudges its own clock a little towards every flash it sees.</p>
<p>A firefly’s clock is a kind of oscillator: something that repeats by itself. The page on <a href="../oscillations-resonance/">oscillations and resonance</a> looks at swings, springs and what happens when you push one in time with its own beat.</p>`
		}
	]
};
