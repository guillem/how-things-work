import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const mass: Control = {
	type: 'range',
	id: 'mass',
	label: 'Mass',
	min: 0.25,
	max: 4,
	step: 0.05,
	default: 1,
	unit: ' kg'
};

const stiffness: Control = {
	type: 'range',
	id: 'stiffness',
	label: 'Spring stiffness',
	min: 10,
	max: 160,
	step: 1,
	default: 39,
	unit: ' N/m'
};

const damping: Control = {
	type: 'range',
	id: 'damping',
	label: 'Friction (damping)',
	min: 0,
	max: 3,
	step: 0.05,
	default: 0.3,
	unit: ' N·s/m'
};

const length: Control = {
	type: 'range',
	id: 'length',
	label: 'Pendulum length',
	min: 0.25,
	max: 4,
	step: 0.05,
	default: 1,
	unit: ' m'
};

const swing: Control = {
	type: 'range',
	id: 'swing',
	label: 'Released from',
	min: 5,
	max: 90,
	step: 1,
	default: 10,
	unit: '°'
};

const pushFreq: Control = {
	type: 'range',
	id: 'pushFreq',
	label: 'Push frequency',
	min: 0.2,
	max: 2.5,
	step: 0.01,
	default: 0.6,
	unit: ' Hz'
};

const release: Control = {
	type: 'action',
	id: 'release',
	label: 'Release again',
	action: 'Release again'
};

export const spec: ExplainerSpec = {
	slug: 'oscillations-resonance',
	title: 'Why things wobble, and how to make them wobble more',
	summary:
		'Bounce a mass on a spring, swing a pendulum, then push them in time and watch a small push build a huge swing — resonance.',
	chapters: [
		{ id: 'free', title: 'Left to itself' },
		{ id: 'pushed', title: 'Pushed in time' }
	],
	steps: [
		{
			id: 'spring',
			chapter: 'free',
			title: 'A mass on a spring',
			scene: 'spring',
			hints: { phase: 'spring' },
			duration: 22,
			controls: [mass, stiffness, release],
			body: `
<p>Pull a mass on a spring down and let go. The spring pulls it back up — but by the time it reaches the middle it is moving fast, so it overshoots, the spring pulls the other way, and so on. Any object pulled back towards a resting position by a force that grows with the distance <strong>oscillates</strong>.</p>
<p>The trace on the right records its position over time: a smooth wave. Each oscillator has its own rhythm, its <dfn data-def="The frequency at which an oscillator swings when disturbed and left alone, in swings per second (hertz, Hz).">natural frequency</dfn>. A heavier mass swings more slowly; a stiffer spring, faster. Four times the mass halves the frequency.</p>`,
			notes: `<p>For a mass <i>m</i> on a spring of stiffness <i>k</i> the natural frequency is (1/2π)·√(k/m), however far you pull it: a bigger pull gives a bigger swing, but not a slower one.</p>`
		},
		{
			id: 'damping',
			chapter: 'free',
			title: 'Friction dies it away',
			scene: 'spring',
			hints: { phase: 'damping' },
			duration: 22,
			controls: [damping, release],
			body: `
<p>Real oscillators lose energy — to air, to friction, to heat in the spring — so each swing is a little smaller than the last. This is <dfn data-def="Anything that takes energy out of an oscillation, such as friction or air resistance, making it die away.">damping</dfn>.</p>
<p>With a little damping the mass rings on for many swings. With more, it settles quickly. With a lot — like a car's shock absorbers, or a door closer — it doesn't swing at all; it just creeps back to rest.</p>`
		},
		{
			id: 'pendulum',
			chapter: 'free',
			title: 'A pendulum',
			scene: 'pendulum',
			hints: { phase: 'pendulum' },
			duration: 22,
			controls: [length, swing, release],
			body: `
<p>A pendulum is pulled back by gravity instead of a spring. Its natural frequency depends only on its <strong>length</strong>: a 1-metre pendulum takes about 2 seconds for a full swing, and making it four times longer doubles that. The mass of the bob doesn't matter at all.</p>
<p>Nor, for small swings, does how far you pull it — which is why pendulums kept the world's time for three centuries. Release it from far out, though, and the swing slows: at 90° it takes about 18% longer.</p>`,
			notes: `<p>For small swings the period is 2π√(L/g). Galileo noticed the regularity of swinging lamps around 1602; Christiaan Huygens built the first pendulum clock in 1656.</p>`
		},
		{
			id: 'push',
			chapter: 'pushed',
			title: 'Pushing in time',
			scene: 'driven',
			hints: { phase: 'push' },
			duration: 30,
			controls: [pushFreq, damping],
			body: `
<p>Now give the spring a small, regular push, like pushing a child on a swing. Push slowly (well below its natural frequency) and the mass just follows your hand. Push very fast and it barely moves: it can't keep up.</p>
<p>Push at its <strong>natural frequency</strong> and each push arrives just as the mass is moving with it, adding a little more energy every time. The swing grows and grows until friction takes away as much energy per swing as the pushes put in. This is <dfn data-def="The build-up of a large oscillation when something is pushed at its natural frequency.">resonance</dfn>.</p>`
		},
		{
			id: 'curve',
			chapter: 'pushed',
			title: 'The resonance curve',
			scene: 'driven',
			hints: { phase: 'curve' },
			duration: 30,
			controls: [pushFreq, damping],
			body: `
<p>Plot how big the swing finally gets against the push frequency and you get a sharp peak at the natural frequency. Less friction makes the peak taller and narrower; more friction flattens it.</p>
<p><strong>Every oscillator has a natural frequency, and pushing it at that frequency makes the motion build up.</strong> That is how a singer can shatter a wine glass, how a radio picks one station out of many, why soldiers break step on bridges — and why engineers add damping to tall buildings, so wind and earthquakes can't push them into resonance.</p>`,
			notes: `<p>The steady swing for a push F₀ at frequency f is F₀ ÷ √((k − m ω²)² + (c ω)²), with ω = 2πf; at the natural frequency the first term vanishes and only friction limits it. London's Millennium Bridge swayed on its opening day in 2000 because walkers fell into step with its sideways wobble; dampers were fitted.</p>`
		}
	]
};
