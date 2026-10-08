import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { sup } from './gas';

const tLeft: Control = {
	type: 'range',
	id: 'tLeft',
	label: 'Left half: temperature',
	min: 0.5,
	max: 8,
	step: 0.1,
	default: 4,
	format: (v) => v.toFixed(1)
};

const tRight: Control = {
	...tLeft,
	id: 'tRight',
	label: 'Right half: temperature',
	default: 1
} as Control;

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Start again',
	action: 'Start again'
};

const particles: Control = {
	type: 'range',
	id: 'particles',
	label: 'Number of particles',
	min: 2,
	max: 100,
	step: 1,
	default: 40
};

const share: Control = {
	type: 'range',
	id: 'share',
	label: 'Share of the energy on the left',
	min: 0,
	max: 100,
	step: 1,
	default: 80,
	unit: '%'
};

const countLeft: Control = {
	type: 'range',
	id: 'countLeft',
	label: 'Particles on the left',
	min: 5,
	max: 100,
	step: 1,
	default: 40
};

const countRight: Control = {
	...countLeft,
	id: 'countRight',
	label: 'Particles on the right'
} as Control;

const reverse: Control = {
	type: 'action',
	id: 'reverse',
	label: 'Run it backward',
	action: 'Reverse every velocity now',
	help: 'The film also reverses by itself 8 seconds after the wall lifts.'
};

const nudge: Control = {
	type: 'range',
	id: 'nudge',
	label: 'At the reversal, move one particle by',
	min: -12,
	max: -3,
	step: 1,
	default: -9,
	format: (v) => `10${sup(v)} of the box`
};

export const spec: ExplainerSpec = {
	slug: 'entropy',
	title: 'Heat, entropy and the arrow of time',
	summary:
		'Let fast and slow particles meet, count the ways they can be arranged, and run the film backward to find out why heat only flows one way.',
	chapters: [
		{ id: 'heat', title: 'Hot meets cold' },
		{ id: 'count', title: 'Counting arrangements' },
		{ id: 'arrow', title: 'The arrow of time' }
	],
	steps: [
		{
			id: 'box',
			chapter: 'heat',
			title: 'Fast and slow particles',
			scene: 'box',
			hints: { phase: 'wall' },
			duration: 20,
			controls: [tLeft, tRight],
			body: `
<p>A gas is a crowd of particles flying about and bouncing off each other and the walls, each one obeying Newton's laws. This box holds 80 of them, split by a wall. On the left they move fast; on the right, slowly. The colour of each particle shows its kinetic energy.</p>
<p>What we feel as hot or cold is this motion. The <dfn data-def="A measure of how much the particles of a substance jiggle: proportional to their average kinetic energy.">temperature</dfn> of a gas is proportional to the <strong>average kinetic energy</strong> of its particles. So the left half is hot (4 on the scale here) and the right half is cold (1). Single particles keep speeding up and slowing down as they collide, but the averages stay put.</p>`,
			notes: `<p>The simulation is a simplified gas: it is flat (2D), it has 80 particles instead of the roughly 10²² in a litre of air, and the particles are very slightly squashy discs, so that a computer can step them forward in time. Temperatures are on an arbitrary scale: 1 unit is a fixed average kinetic energy per particle. In 2D the average kinetic energy is k<sub>B</sub>T, where k<sub>B</sub> is Boltzmann's constant.</p>`
		},
		{
			id: 'mix',
			chapter: 'heat',
			title: 'Remove the wall',
			scene: 'box',
			hints: { phase: 'mix' },
			duration: 24,
			controls: [tLeft, tRight, restart],
			body: `
<p>Now lift the wall. Fast particles stray into the right half and slow ones into the left, and every collision passes energy between them: a fast particle that hits a slow one usually comes away slower, and the slow one faster. Energy and momentum are conserved in each collision, exactly as Newton's laws say.</p>
<p>Within a few seconds both halves reach the <strong>same temperature</strong>, 2.5: the average of 4 and 1, because each half holds the same number of particles. Energy flowing from hot to cold like this is <dfn data-def="Energy that flows from a hotter object to a colder one because of their difference in temperature.">heat</dfn>. Run it as often as you like: it never flows the other way, and the hot side never gets hotter. But nothing in a single collision prefers one direction. So why?</p>`,
			notes: `<p>The two temperatures keep jiggling around 2.5 instead of settling exactly. With only 40 particles in each half, the average of their energies changes noticeably every time a few fast particles wander across. With 10²² particles these jiggles are far too small to measure.</p>`
		},
		{
			id: 'spread',
			chapter: 'count',
			title: 'Counting arrangements',
			scene: 'count',
			hints: { phase: 'positions' },
			duration: 26,
			controls: [particles, restart],
			body: `
<p>Start simpler: put every particle in the left half and let them go. They spread out, and soon about half are on each side. To see why, separate two kinds of description. A <dfn data-def="The complete detail of a system: exactly where every particle is and how it is moving.">microstate</dfn> says where every single particle is. A <dfn data-def="What we can actually measure about a system, such as its temperature, or how many particles are in each half; many microstates share the same macrostate.">macrostate</dfn> only says how many are in the left half.</p>
<p>Count the microstates behind each macrostate. All 40 on the left can happen in just <strong>one way</strong>. Twenty on each side can happen in 137,846,528,820 ways: that many different choices of which 20 particles are on the left. The particles wander at random among all these arrangements, so they almost always end up in the macrostates with the most of them. Try 4 particles: all of them on the left is one arrangement out of 16, and you'll see it happen.</p>`,
			notes: `<p>The number of ways to choose which k of N particles are on the left is the binomial coefficient C(N, k) = N! ÷ (k! (N − k)!), the same count as for the paths through a Galton board. Each particle is on one side or the other, so there are 2ᴺ arrangements in all: 2⁸⁰ ≈ 1.2 × 10²⁴ for 80 particles. For the roughly 2.5 × 10²² molecules in a litre of air at room temperature, the chance of finding them all in one half at a given moment is about 1 in 10 to the power 7.5 × 10²¹: a number with seven and a half thousand billion billion digits.</p>`
		},
		{
			id: 'share',
			chapter: 'count',
			title: 'Counting ways to share energy',
			scene: 'count',
			hints: { phase: 'energy' },
			duration: 26,
			controls: [share, countLeft, countRight],
			body: `
<p>Energy can be counted the same way. Imagine it comes in many tiny, equal packets. Three packets can be shared between two particles in 4 ways (3 + 0, 2 + 1, 1 + 2, 0 + 3); with more packets and more particles the number of ways grows enormously. For two halves together, multiply: every way of sharing the left's energy can go with every way of sharing the right's.</p>
<p>Drag the share of energy on the left. Where the gas started, with 80% of the energy among the left's 40 particles, is a rare macrostate. The peak is where the energy <strong>per particle</strong> is (very nearly) the same on both sides, that is, at equal temperatures, and it has <strong>more than ten million times as many</strong> microstates. Give the two sides different numbers of particles: the peak moves, but it still sits at equal temperatures.</p>`,
			notes: `<p>The number of ways to share q packets among n particles is C(q + n − 1, q). Here there are 50 packets per particle; the smaller the packets, the closer the count gets to that of real, smoothly varying energies. For particles moving in a plane this counting is exact in that limit: each way corresponds to an equal slice of the possible velocities.</p>`
		},
		{
			id: 'entropy',
			chapter: 'count',
			title: 'Entropy',
			scene: 'box',
			hints: { phase: 'entropy' },
			duration: 26,
			controls: [tLeft, tRight, restart],
			body: `
<p>These counts get so large that it is easier to work with their logarithm. The <dfn data-def="S = k_B ln Ω: Boltzmann's constant times the natural logarithm of the number of microstates Ω that share a system's macrostate.">entropy</dfn> of a macrostate is S = k<sub>B</sub> ln Ω, where Ω is the number of microstates consistent with it and k<sub>B</sub> is Boltzmann's constant. Entropy is a count, not a vague idea of "disorder".</p>
<p>The chart now follows the box's entropy (counting which particles are in which half and how each half's energy is shared) as the wall lifts. It climbs fast, then hovers just below its highest possible value, at about 10 million times as many arrangements as the start. That is the <dfn data-def="The entropy of an isolated system practically never decreases.">second law of thermodynamics</dfn>: not a force pushing the gas, but the overwhelming odds of drifting from fewer arrangements to more.</p>`,
			notes: `<p>Ludwig Boltzmann's formula S = k log W is carved on his tombstone in Vienna. Here Ω is counted with "which particles are in which half" and "how each half's energy is shared" as the macrostate; finer descriptions give different numbers but the same rise. The small dips are real: in a gas of 80 particles the entropy jiggles down a little all the time. In a litre of air, a noticeable dip is so improbable that it has never been seen.</p>`
		},
		{
			id: 'backward',
			chapter: 'arrow',
			title: 'Run the film backward',
			scene: 'box',
			hints: { phase: 'reverse' },
			duration: 26,
			controls: [reverse],
			body: `
<p>Film the particles and play it backward: every particle still moves in straight lines and bounces according to Newton's laws. Those laws work equally well in both directions of time. So the backward film is something that <em>could</em> happen.</p>
<p>The simulation can do it for real. Eight seconds after the wall lifts, every velocity is reversed at the same instant. The particles retrace their paths exactly, the energy flows from the cold side back to the hot one, the halves separate into hot and cold again, and the entropy falls back to where it started. Nothing forbids it.</p>`,
			notes: `<p>Computers normally round off every number they calculate, which would spoil the reversal. This simulation stores positions as whole numbers of tiny steps and uses an update rule that can be undone exactly (a method published by Levesque and Verlet in 1993), so the backward run retraces the forward one perfectly. The objection "if the laws are reversible, how can entropy only increase?" was raised by Josef Loschmidt in 1876.</p>`
		},
		{
			id: 'nudge',
			chapter: 'arrow',
			title: 'Why time has a direction',
			scene: 'box',
			hints: { phase: 'nudge' },
			duration: 30,
			controls: [nudge, reverse],
			body: `
<p>Now do the same, but at the moment of reversal move one particle by a billionth of the box. The un-mixing starts, then fails: after a few collisions the tiny error has grown and spread to every particle, and the gas mixes again. Make the nudge as small as you like; it only delays the failure.</p>
<p>The states that un-mix are possible, but they are needles in a haystack: among all the microstates of a mixed gas, only a vanishingly small fraction are arranged so precisely that they would sort themselves out. <strong>Heat flows and things mix because mixed states vastly outnumber ordered ones</strong>, so almost any change leads from a rarer macrostate to a more common one. That one-way drift is what gives time its direction: we remember the past and not the future because the past was more ordered.</p>`,
			notes: `<p>Why was the past ordered at all? The trail of ever-lower entropy leads back to the early universe, which began in a state of remarkably low entropy. Why it did is still an open question in physics.</p>`
		}
	]
};
