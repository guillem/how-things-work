import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Speed',
	min: 0.5,
	max: 10,
	step: 0.1,
	default: 5,
	unit: 'm/s',
	format: (v) => `${v.toFixed(1)} m/s (${Math.round(v * 3.6)} km/h)`
};

const push: Control = {
	type: 'action',
	id: 'push',
	label: 'Push',
	action: 'Push it again',
	help: 'A sideways shove: the bicycle starts leaning at 0.5 rad/s (about 29° per second).'
};

const trail: Control = {
	type: 'range',
	id: 'trail',
	label: 'Trail',
	min: -0.04,
	max: 0.16,
	step: 0.01,
	default: 0.08,
	format: (v) => `${Math.round(v * 1000)} mm`,
	help: 'How far the front tyre’s contact point trails behind where the steering axis meets the ground.'
};

const tilt: Control = {
	type: 'range',
	id: 'tilt',
	label: 'Steering axis tilt',
	min: 0,
	max: 30,
	step: 1,
	default: 18,
	format: (v) => `${v}° from vertical`,
	help: 'The head angle seen from the side (the benchmark’s 18° is a head angle of 72°).'
};

const frontMass: Control = {
	type: 'range',
	id: 'mf',
	label: 'Front wheel mass',
	min: 2.5,
	max: 10,
	step: 0.5,
	default: 3,
	unit: 'kg',
	format: (v) => `${v} kg`,
	help: 'Mass added or taken away at the hub, with the wheel’s size and rotational inertia held fixed.'
};

const gyro: Control = {
	type: 'toggle',
	id: 'gyro',
	label: 'Gyroscopic effect of the wheels',
	default: true,
	help: 'Off: the wheels keep their mass but their spin has no angular momentum (as if counter-rotating discs cancelled it).'
};

const noTrail: Control = {
	type: 'toggle',
	id: 'notrail',
	label: 'Zero trail',
	default: false
};

const bike: Control = {
	type: 'select',
	id: 'bike',
	label: 'Bicycle',
	default: 'tms',
	options: [
		{ value: 'benchmark', label: 'Benchmark bicycle' },
		{ value: 'tms', label: 'Two-mass-skate' }
	]
};

const torque: Control = {
	type: 'range',
	id: 'torque',
	label: 'Steering torque',
	min: -2,
	max: 2,
	step: 0.1,
	default: -0.3,
	format: (v) =>
		v === 0 ? 'none' : `${Math.abs(v).toFixed(1)} N m to the ${v < 0 ? 'left' : 'right'}`,
	help: 'A steady twist of the handlebars, applied from the start.'
};

export const spec: ExplainerSpec = {
	slug: 'bicycle-stability',
	title: 'Why a bicycle balances itself',
	summary:
		'Push a riderless bicycle and watch it fall, recover or slowly topple depending on its speed. Then find the self-stable band in the eigenvalues of its equations of motion, and see which parts of the design make it: trail, head angle, the wheels’ spin, and a bicycle with none of the usual ones.',
	chapters: [
		{ id: 'push', title: 'A riderless bicycle' },
		{ id: 'eigen', title: 'The eigenvalues' },
		{ id: 'parts', title: 'What makes it stable' }
	],
	steps: [
		// ------------------------------------------------------------------ push
		{
			id: 'push',
			chapter: 'push',
			title: 'Push it and let go',
			scene: 'ride',
			hints: { phase: 'push' },
			duration: 18,
			controls: [speed, push],
			body: `
<p>Send a bicycle off with nobody on it, at a brisk jog (5 m/s, 18 km/h), and give it a shove sideways. It doesn’t fall. It wobbles, steers left and right a little, and within a few seconds rolls on upright again.</p>
<p>The bicycle here is the <strong>benchmark bicycle</strong> of Meijaard, Papadopoulos, Ruina and Schwab (2007): an ordinary bicycle with a rigid rider attached, fully described by 25 numbers (masses, sizes, inertias), whose equations the authors cross-checked against independent derivations and computer programs. The view from behind shows the lean, the view from above the path and the steering.</p>`
		},
		{
			id: 'speeds',
			chapter: 'push',
			title: 'Too slow, just right, too fast',
			scene: 'ride',
			hints: { phase: 'speeds' },
			duration: 22,
			controls: [speed, push],
			body: `
<p>Now change the speed. At 2 m/s the wobble grows instead of dying away, and within a couple of seconds the bicycle is falling (the page stops at 20° of lean or steer, where the small-angle equations stop being trustworthy). At 8 m/s a brief wobble dies away, leaving a very slow, growing lean and steer into a tightening spiral that would take many seconds to bring it down.</p>
<p>Between roughly 4.3 and 6 m/s (15 to 22 km/h) it recovers on its own every time. This is called <dfn data-def="A riderless bicycle that returns to upright, straight-ahead rolling by itself after a small disturbance.">self-stability</dfn>, and it holds only in a band of speeds.</p>`
		},
		// ------------------------------------------------------------------ eigen
		{
			id: 'equations',
			chapter: 'eigen',
			title: 'Two equations, four eigenvalues',
			scene: 'roots',
			hints: { phase: 'equations' },
			duration: 22,
			controls: [speed],
			body: `
<p>For small lean φ and steer δ the motion obeys two coupled linear equations, one for each:</p>
<p class="formula">M q̈ + v C₁ q̇ + (g K₀ + v² K₂) q = 0, &nbsp; q = (φ, δ)</p>
<p>M holds the masses and inertias, C₁ the effects that grow with speed and rates (including the wheels’ gyroscopic effect), K₀ gravity, K₂ the effects that grow with the square of the speed (the turning of the path). Try solutions of the form e^{st}: they exist only when det(M s² + v C₁ s + g K₀ + v² K₂) = 0, a quartic in s with four roots, the <dfn data-def="The growth rates s of the motions e^{st} the equations allow. A positive real part means that motion grows; an imaginary part means it oscillates.">eigenvalues</dfn>.</p>
<p>Dark dots show the real parts against speed; purple dots show the positive imaginary part of each oscillating pair. A real part above zero is a motion that grows. Self-stability needs all four below zero.</p>`,
			notes: `<p>The matrices are computed from the 25 parameters by the formulas of the paper’s appendix, and agree with its published values to ten digits. The model assumes knife-edge wheels that roll without slipping, a rigid rider and no friction in the steering. It is linear, so it describes small leans only.</p>`
		},
		{
			id: 'band',
			chapter: 'eigen',
			title: 'Weave, capsize and the band between',
			scene: 'roots',
			hints: { phase: 'band' },
			duration: 22,
			controls: [speed],
			body: `
<p>Read the plot from left to right. Below about 0.68 m/s all four eigenvalues are real, two of them positive: the bicycle simply falls, like an inverted pendulum. Above that speed those two merge into a complex pair with a positive real part: the <strong>weave</strong> mode, an oscillation of lean and steer that grows. Its real part crosses zero at the weave speed, 4.29 m/s.</p>
<p>A third, real eigenvalue belongs to the <strong>capsize</strong> mode, a slow lean with no oscillation. It sits below zero until the capsize speed, 6.02 m/s, and then just above it, so slightly that the fall takes many seconds. A rider corrects it without noticing. The fourth, the <strong>castering</strong> mode, is strongly negative: the front wheel lines up behind its steering axis like a supermarket trolley’s castor.</p>
<p>Between 4.29 and 6.02 m/s all four are negative: the self-stable band.</p>`
		},
		{
			id: 'mechanism',
			chapter: 'eigen',
			title: 'It steers into the fall',
			scene: 'ride',
			hints: { phase: 'mechanism' },
			duration: 20,
			controls: [speed, push],
			body: `
<p>How does a bicycle with nobody on it catch itself? Watch the traces of lean and steer after the push. When it leans to one side, the front assembly turns the handlebars to that same side. Steering into the lean drives the wheels back under the centre of mass, the way you would catch a broomstick balanced on your hand by moving your hand under it.</p>
<p>Too slow, and the steering doesn’t bring the wheels back fast enough: each catch overshoots more, which is the growing weave. Too fast, and the turning response is so strong that a tiny steer holds the lean instead of undoing it: the slow capsize.</p>`
		},
		// ------------------------------------------------------------------ parts
		{
			id: 'geometry',
			chapter: 'parts',
			title: 'Trail, head angle, front mass',
			scene: 'roots',
			hints: { phase: 'geometry' },
			duration: 24,
			controls: [trail, tilt, frontMass],
			body: `
<p>Why does a lean steer the front wheel? Several things in the front assembly do it. With <dfn data-def="The distance the front tyre's ground contact trails behind the point where the steering axis meets the ground; 80 mm on the benchmark bicycle.">trail</dfn>, the ground pushes on the tyre behind the steering axis and swings it into the lean. The front assembly’s centre of mass sits ahead of the axis and falls to the side, turning the handlebars with it. And the spinning front wheel, tipped sideways, turns like a gyroscope.</p>
<p>Change the design and watch the band move. More trail widens it and shifts it to higher speeds; with no trail it shrinks to a sliver near 3 m/s, and with negative trail it is gone. A steering axis closer to vertical than about 10° destroys it too. A heavier front wheel moves the capsize speed up.</p>`
		},
		{
			id: 'gyro',
			chapter: 'parts',
			title: 'Is it the gyroscope?',
			scene: 'roots',
			hints: { phase: 'gyro' },
			duration: 22,
			controls: [gyro, noTrail],
			body: `
<p>A common explanation says the spinning wheels act as gyroscopes that hold the bicycle up. Another says the gyroscopic effect is too small to matter, and trail does it all. On this bicycle both are wrong.</p>
<p>Switch off the wheels’ gyroscopic effect and the benchmark bicycle has no self-stable band at any speed up to 15 m/s: the weave never settles. Put the gyroscope back and set the trail to zero: only a sliver near 3 m/s remains. On an ordinary bicycle the gyroscopic effect and trail both matter, together with the mass of the front assembly.</p>`
		},
		{
			id: 'skate',
			chapter: 'parts',
			title: 'A bicycle with neither',
			scene: 'roots',
			hints: { phase: 'skate' },
			duration: 22,
			controls: [bike],
			body: `
<p>So are the gyroscopic effect and trail necessary? In 2011 Kooijman, Meijaard, Papadopoulos, Ruina and Schwab showed that they are not. Their theoretical <strong>two-mass-skate</strong> bicycle has no spin at all (its wheels are replaced by skates), zero trail, and only two point masses: 10 kg for the frame, high up and ahead of the front contact, and 1 kg for the front assembly, ahead of its steering axis.</p>
<p>It is self-stable from about 2.8 m/s upwards (the page checks up to 30 m/s). Here the front mass falling to the side steers the front into the lean on its own. They built one with counter-rotating wheels and a slightly negative trail, and it balanced itself above 2.3 m/s. (These equations test only the sideways balance: the two masses alone would tip the machine forward, so the real one carries extra ballast at the rear contact, which leaves the sideways equations unchanged.)</p>
<p>Self-stability comes from the geometry and masses of the whole bicycle working together. No single effect explains it.</p>`,
			notes: `<p>The two-mass-skate parameters are those of the paper’s supplement, table 7.1: wheelbase 1 m, steering axis 5° from vertical, the frame’s mass at 1.2 m ahead of the rear contact and 0.4 m up, the front’s at 1.02 m ahead and 0.2 m up. The built machine had extra masses and measured inertias, which is why its band starts a little lower.</p>`
		},
		{
			id: 'countersteer',
			chapter: 'parts',
			title: 'To turn right, steer left',
			scene: 'ride',
			hints: { phase: 'counter' },
			duration: 22,
			controls: [torque],
			body: `
<p>Self-stability also explains how a rider turns. Twist the handlebars to the left with a steady 0.3 N m. The front wheel steers left at first, the wheels run out to the left from under the bicycle, and so it leans <strong>right</strong>. Steering into that lean, it then turns right, the opposite way to the first twist.</p>
<p>This is <dfn data-def="Briefly steering the opposite way to start a turn: the bicycle leans into the turn, and then steers into it.">countersteering</dfn>. Every cyclist does it without knowing, with a tiny flick the other way before each turn. Motorcycle riders are taught it on purpose: to turn right, push the right handlebar forward.</p>`
		}
	]
};
