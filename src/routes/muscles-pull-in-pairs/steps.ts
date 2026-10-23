import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { BICEPS_GRIP, FULLY_BENT } from './model';

const elbow: Control = {
	type: 'range',
	id: 'elbow',
	label: 'How bent the elbow is',
	min: 20,
	max: FULLY_BENT,
	step: 1,
	default: 60,
	format: (v) => `${v}°`,
	help: 'Or drag the hand.'
};

const squeeze: Control = {
	type: 'select',
	id: 'squeeze',
	label: 'Which muscle squeezes',
	default: 'biceps',
	options: [
		{ value: 'biceps', label: 'The biceps' },
		{ value: 'triceps', label: 'The triceps' },
		{ value: 'none', label: 'Neither' }
	]
};

const press: Control = {
	type: 'range',
	id: 'press',
	label: 'How hard you press on the scale',
	min: 1,
	max: 20,
	step: 1,
	default: 10,
	format: (v) => `${v} kg`
};

const bag: Control = {
	type: 'range',
	id: 'bag',
	label: 'Shopping in the bag',
	min: 1,
	max: 10,
	step: 0.5,
	default: 5,
	format: (v) => `${v} kg`
};

const relax: Control = {
	type: 'toggle',
	id: 'relax',
	label: 'Relax the biceps',
	default: false
};

const bigger: Control = {
	type: 'toggle',
	id: 'bigger',
	label: 'Give the arm a much bigger biceps',
	default: false
};

const grip: Control = {
	type: 'range',
	id: 'grip',
	label: 'Where the biceps grips the forearm',
	min: 2,
	max: 12,
	step: 0.5,
	default: BICEPS_GRIP,
	format: (v) => `${v} cm from the elbow`
};

const biceps =
	'<dfn data-def="The muscle on the front of your upper arm. It runs from your shoulder to your forearm, just past the elbow, and bends the elbow when it pulls.">biceps</dfn>';
const triceps =
	'<dfn data-def="The muscle on the back of your upper arm. It runs from your shoulder to the point of your elbow, and straightens the elbow when it pulls.">triceps</dfn>';
const tendon =
	'<dfn data-def="A tough cord at the end of a muscle that ties it to a bone. You can feel the biceps’ tendon in the crook of your elbow when you bend your arm.">tendon</dfn>';
const pair =
	'<dfn data-def="Two muscles that work a joint in opposite directions: when one pulls, the other relaxes and is stretched. Biceps and triceps are such a pair.">antagonistic pair</dfn>';

export const spec: ExplainerSpec = {
	slug: 'muscles-pull-in-pairs',
	title: 'Muscles pull in pairs',
	summary:
		'Bend a cutaway arm and watch the biceps shorten and bulge, then press on a scale and feel the triceps take over. A muscle can only pull, so every joint needs a pair. Hang a bag of shopping from the hand and find out why the biceps pulls about eight times the bag’s weight.',
	chapters: [
		{ id: 'pair', title: 'Two pullers' },
		{ id: 'lever', title: 'Holding a bag' },
		{ id: 'next', title: 'Read next' }
	],
	steps: [
		// ------------------------------------------------------------------ pair
		{
			id: 'arm',
			chapter: 'pair',
			title: 'Inside your arm',
			scene: 'arm',
			hints: { phase: 'arm' },
			duration: 18,
			controls: [elbow],
			body: `
<p>Bend your arm and feel the front of your upper arm with your other hand: it goes hard and fat. That lump is a muscle, the ${biceps}. Here is an arm with the skin made see-through, so you can watch it work.</p>
<p><strong>Drag the hand</strong> up and down. As the elbow bends, the biceps gets <strong>shorter and fatter</strong>, and its far end, tied to the forearm just past the elbow by a ${tendon}, drags the forearm up. On the back of the arm, the ${triceps} is stretched longer as the elbow bends.</p>
<p>All the while the biceps is quietly pulling, because something has to hold your forearm up against its own weight.</p>`
		},
		{
			id: 'squeeze',
			chapter: 'pair',
			title: 'A muscle can only pull',
			scene: 'arm',
			hints: { phase: 'squeeze' },
			duration: 18,
			controls: [squeeze],
			body: `
<p>A muscle does one thing: it <strong>squeezes shorter</strong>, pulling its two ends towards each other. It can’t push them apart. <strong>Choose which muscle squeezes.</strong></p>
<p>When the biceps squeezes, it pulls the forearm up and the elbow bends. When the triceps squeezes, it pulls on the point of the elbow and the arm goes straight. When neither squeezes, nothing holds the forearm up and it simply flops down under its own weight.</p>
<p>Notice what is <em>not</em> on the list: there is no way to make the biceps push the forearm back down. A relaxed muscle goes soft and lets itself be stretched. So each joint needs <strong>two muscles that pull in opposite directions</strong>, taking turns: an ${pair}.</p>`
		},
		{
			id: 'press',
			chapter: 'pair',
			title: 'Press down on a table',
			scene: 'arm',
			hints: { phase: 'press' },
			duration: 18,
			controls: [press],
			body: `
<p>Put a bathroom scale on a table and press down on it with your hand, elbow bent. Now the job is to <strong>straighten</strong> the elbow against the scale pushing back, and that is the triceps’ job. <strong>Press harder</strong> and watch it.</p>
<p>The triceps grips the point of the elbow, only about 2 centimetres behind the hinge, while your hand is 35 centimetres in front. So to press 10 kilograms on the scale, the triceps pulls as hard as a weight of about <strong>160 kilograms</strong>: some sixteen times harder. The biceps relaxes and lets itself be stretched.</p>
<p>Pushing yourself up out of a chair with your arms, or doing a push-up, works the same way: the triceps pulls to straighten your elbows.</p>`,
			notes: `<p>Your forearm’s own weight helps press, a little under one kilogram on the scale, so the triceps only has to pull for the rest. Real arms have a few more muscles at work than the two drawn here, but the biceps and triceps are the main pair.</p>`
		},
		// ------------------------------------------------------------------ lever
		{
			id: 'bag',
			chapter: 'lever',
			title: 'Hold a bag of shopping',
			scene: 'arm',
			hints: { phase: 'bag' },
			duration: 18,
			controls: [bag],
			body: `
<p>Hold a bag of shopping with your forearm level. The bag pulls the hand down, and the biceps pulls the forearm up. <strong>Change what is in the bag</strong> and compare the two.</p>
<p>The biceps grips the forearm only about 4½ centimetres from the elbow, but the bag hangs from your hand, about 35 centimetres away: almost eight times farther. A pull close to a hinge turns it much less than the same pull far away (try shutting a door by pushing right next to its hinges). So the biceps must pull about <strong>eight times the bag’s weight</strong>, and a little more to hold up the forearm itself. A 5 kilogram bag takes a pull of over 40 kilograms.</p>`,
			notes: `<p>The numbers come from the shape of an adult arm. Measured on real arms, the biceps’ line of pull passes about 4½ to 5 centimetres from the elbow’s hinge when the forearm is level (less when the arm is straight). The forearm and hand weigh about 1½ kilograms. In real life the biceps shares the work with two other muscles that bend the elbow, the brachialis under it and one in the forearm.</p>`
		},
		{
			id: 'lower',
			chapter: 'lever',
			title: 'Lowering the bag',
			scene: 'arm',
			hints: { phase: 'lower' },
			duration: 24,
			controls: [relax],
			body: `
<p>Now the arm lifts the bag and lowers it again, slowly. Watch the biceps on the way down. It does not let go, and the triceps does not push the bag down: the <strong>biceps keeps pulling</strong>, getting <strong>longer</strong> as it lets the bag down gently, like a brake. Gravity does the lowering; the biceps controls how fast.</p>
<p><strong>Relax the biceps</strong> and see what lowering would look like without that brake: the bag just drops.</p>`,
			notes: `<p>A muscle that pulls while it is being stretched longer is doing an <em>eccentric</em> contraction. It is how you walk downstairs, sit down slowly or put a heavy box on the floor, and it is the kind of work that leaves muscles sorest the next day.</p>`
		},
		{
			id: 'bigger',
			chapter: 'lever',
			title: 'A bigger muscle, the same lever',
			scene: 'arm',
			hints: { phase: 'bigger' },
			duration: 16,
			controls: [bigger],
			body: `
<p>Does a big, strong biceps get a better deal? <strong>Give the arm a much bigger biceps.</strong></p>
<p>The muscle swells, but its tendon still grips the forearm in the same place, close to the elbow. So it still has to pull about <strong>eight times</strong> the bag’s weight. A bigger muscle can pull harder, so it can hold a heavier bag before it tires; it does not make the lever any better.</p>`
		},
		{
			id: 'grip',
			chapter: 'lever',
			title: 'Why grip so close?',
			scene: 'arm',
			hints: { phase: 'grip' },
			duration: 20,
			controls: [grip],
			body: `
<p>If gripping close to the elbow makes the biceps work so hard, why not grip farther along? <strong>Move where the biceps grips</strong> and watch both numbers.</p>
<p>Farther out, the pull needed falls. But now the biceps has to <strong>shorten much farther</strong> to swing the hand the same distance: gripping at 9 centimetres it would have to shorten about twice as far, and it would swing the hand only half as fast. Gripping close to the elbow, a muscle that shortens just a few centimetres swings your hand a long way, quickly. Your arm trades strength for reach and speed.</p>
<p>The trade is fair: what the biceps saves in pull, it pays in shortening.</p>`
		},
		// ------------------------------------------------------------------ next
		{
			id: 'next',
			chapter: 'next',
			title: 'Read next',
			scene: 'arm',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>A muscle can only pull, so every joint needs a pair that take turns: the biceps bends your elbow, the triceps straightens it, and to lower something slowly the biceps keeps pulling while it gets longer. And because the biceps grips so close to the elbow, it pulls about eight times the weight in your hand.</p>
<p>The page on <a href="../newtons-laws/">Newton’s laws</a> shows how pushes and pulls balance or make things speed up. The page on <a href="../bridges-structures/">how bridges hold up</a> shows the same two kinds of force, pulling and pushing, inside beams and cables instead of arms.</p>`
		}
	]
};
