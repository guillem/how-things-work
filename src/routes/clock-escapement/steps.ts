import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { DEFAULT_WEIGHT } from './model';

const anchor: Control = {
	type: 'toggle',
	id: 'anchor',
	label: 'Fit the anchor and the pendulum',
	default: false
};

const slow: Control = {
	type: 'toggle',
	id: 'slow',
	label: 'Slow motion (ten times slower)',
	default: false
};

const unhook: Control = {
	type: 'toggle',
	id: 'unhook',
	label: 'Take the weight off',
	default: false
};

const length: Control = {
	type: 'range',
	id: 'length',
	label: 'Length of the pendulum',
	min: 25,
	max: 100,
	step: 0.1,
	default: 99.4,
	format: (v) => `${v.toFixed(1)} cm`
};

const weight: Control = {
	type: 'range',
	id: 'weight',
	label: 'Weight on the cord',
	min: 1,
	max: 12,
	step: 1,
	default: DEFAULT_WEIGHT,
	format: (v) => `${v} kg`
};

const escapeWheel =
	'<dfn data-def="The last wheel of the clock’s gears, with pointed teeth. The weight tries to spin it; the anchor lets it move on only a little at a time.">escape wheel</dfn>';
const anchorDfn =
	'<dfn data-def="A rocking piece shaped like a ship’s anchor, fixed to the pendulum so that it rocks with it. Its two hooked ends, the pallets, take turns blocking the escape wheel’s teeth.">anchor</dfn>';
const pallet =
	'<dfn data-def="One of the two hooked ends of the anchor. A pallet blocks a tooth of the escape wheel, then lets it slide off its slanted end.">pallet</dfn>';
const escapement =
	'<dfn data-def="The escape wheel and the anchor together: the part of a clock that lets the wheels move on one small step at a time, in time with the pendulum, and gives the pendulum a little push each step.">escapement</dfn>';

export const spec: ExplainerSpec = {
	slug: 'clock-escapement',
	title: 'Pendulum clocks & the escapement',
	summary:
		'Open up a grandfather clock: a falling weight turns the wheels, and a swinging pendulum lets them move on only one small step at a time, with a tick for each step. Take out the anchor and the wheels whirr away; lengthen the pendulum or hang a heavier weight and count the ticks to see which one changes the time.',
	chapters: [
		{ id: 'inside', title: 'Inside the clock' },
		{ id: 'rate', title: 'What sets the time' },
		{ id: 'next', title: 'Read next' }
	],
	steps: [
		// ---------------------------------------------------------------- inside
		{
			id: 'clock',
			chapter: 'inside',
			title: 'What makes a grandfather clock go?',
			scene: 'clock',
			hints: { phase: 'clock' },
			duration: 16,
			body: `
<p>A grandfather clock has no battery and no spring. Open its door and you find two things that move: a heavy <strong>weight</strong> hanging on a cord, and a long <strong>pendulum</strong> swinging from side to side, once each second. Each swing makes a <strong>tick</strong>.</p>
<p>They have two different jobs. The weight is the clock’s engine: as it sinks, it pulls the cord and turns the wheels that turn the hands. The pendulum is the clock’s timekeeper: it decides <em>how fast</em> the wheels may turn. Next to the clock is a stopwatch, so you can count the clock’s ticks against real seconds.</p>`
		},
		{
			id: 'runaway',
			chapter: 'inside',
			title: 'The weight on its own',
			scene: 'clock',
			hints: { phase: 'runaway' },
			duration: 18,
			controls: [anchor],
			body: `
<p>Here is the clock with the pendulum taken out. The weight pulls, the wheels turn, and nothing holds them back: the last wheel, the ${escapeWheel}, spins up in a blur and the hands race round the face, a whole hour every three seconds. The clock is running, but it isn’t telling the time.</p>
<p><strong>Fit the anchor and the pendulum.</strong> Now the escape wheel stops racing. It moves on one small step for each swing of the pendulum, with a tick each time, and the hands creep round at the right speed.</p>`,
			notes: `<p>How fast a clock runs away depends on friction in its wheels, and nobody measures it; the page takes a top speed of about twenty turns a second for the escape wheel. At that speed the weight would reach the bottom in about ten minutes. Ticking, it takes eight days.</p>`
		},
		{
			id: 'catch',
			chapter: 'inside',
			title: 'Catch and let go',
			scene: 'clock',
			hints: { phase: 'catch' },
			duration: 20,
			controls: [slow],
			body: `
<p>The close-up shows how. The ${anchorDfn} is linked to the top of the pendulum and rocks with it. Its two hooked ends, the ${pallet}s, dip in and out of the escape wheel’s teeth, one side and then the other. <strong>Turn on slow motion</strong> and follow one swing.</p>
<p>A tooth is <strong>caught</strong> by a pallet, and the wheel stands still. As the pendulum swings back through the bottom of its swing, that pallet lifts and the tooth <strong>slides off</strong> its slanted end. Straight away the other pallet dips in and <strong>catches</strong> the next tooth on the other side: <strong>tick</strong>. The anchor and the escape wheel together are called the ${escapement}: they let the wheels “escape” one step at a time.</p>
<p>Each swing lets the wheel on by half a tooth. It has 30 teeth, so it turns once a minute, and in a grandfather clock it carries the second hand.</p>`,
			notes: `<p>The escapement drawn here is the “dead-beat” kind, which holds the wheel perfectly still between ticks. Many grandfather clocks have the older recoil anchor, which pushes the wheel back a little after each tick; it works the same way. Both keep the pendulum’s swing small, a few degrees from side to side.</p>`
		},
		{
			id: 'push',
			chapter: 'inside',
			title: 'Who pushes whom?',
			scene: 'clock',
			hints: { phase: 'push' },
			duration: 20,
			controls: [unhook],
			body: `
<p>Watch the tooth as it slides off the pallet’s slanted end: it shoves the pallet aside, and that gives the pendulum a <strong>tiny push</strong>, just at the bottom of its swing. Without those pushes, the pendulum would slowly lose its swing to the air and to rubbing at its pivot.</p>
<p><strong>Take the weight off.</strong> The pendulum keeps swinging, but nothing ticks, the wheels stand still and the hands stop. The pendulum does not drive the clock; the weight does. On its own, the pendulum would swing only a third as wide after two hours, and in the end hang still.</p>`,
			notes: `<p>A good home clock’s pendulum loses only about one part in 6,000 of its swing each tick, so each push only has to be tiny: most of the weight’s pull is used up in turning the wheels and hands. The push is given at the bottom of the swing, where it hardly changes the timing of the swing.</p>`
		},
		// ---------------------------------------------------------------- rate
		{
			id: 'length',
			chapter: 'rate',
			title: 'A longer or shorter pendulum',
			scene: 'clock',
			hints: { phase: 'length' },
			duration: 22,
			controls: [length],
			body: `
<p>So what decides how fast the clock goes? <strong>Change the pendulum’s length</strong> and count the ticks against the stopwatch.</p>
<p>About a metre long, it ticks once a second: 60 ticks a minute, in step with the stopwatch. Shorter, it swings faster and the clock races ahead. A pendulum <strong>a quarter as long ticks twice as fast</strong>, 120 ticks a minute, and the clock’s second hand goes round twice for each turn of the stopwatch’s.</p>
<p>That is how a clockmaker sets a clock right: a nut under the round weight at the bottom of the pendulum, the bob, raises or lowers it a little. Lowering the bob by just one millimetre makes the clock lose about 43 seconds a day.</p>`,
			notes: `<p>A real pendulum takes an hour or so to settle into a new swing after it is changed; the page skips ahead to it. A pendulum’s length is measured from its pivot to the middle of the bob. The time of a swing does not depend on how heavy the bob is.</p>`
		},
		{
			id: 'weight',
			chapter: 'rate',
			title: 'A heavier weight',
			scene: 'clock',
			hints: { phase: 'weight' },
			duration: 22,
			controls: [weight],
			body: `
<p>The weight drives the clock, so surely a heavier weight makes it go faster? <strong>Hang a heavier weight</strong> and count the ticks again.</p>
<p>The ticks hardly change. A heavier weight gives the pendulum harder pushes, so it swings wider: four times the weight, twice as wide. But a wider swing does not tick faster. It has farther to go and goes faster to cover it, so each swing still takes about a second. The tiny difference goes the other way: the wider swing is a little <strong>slower</strong>, and the clock loses about half a minute a day.</p>
<p>The length sets the time; the weight only keeps it going.</p>`,
			notes: `<p>For small swings, how long a swing takes depends only on the length of the pendulum. Wider swings take slightly longer, and clockmakers call this the circular error. A swing of 3 degrees each side takes long enough to lose about 15 seconds a day against a tiny swing, so a good clock keeps its swing small and steady. On this page the energy the pendulum loses each swing grows with the square of the swing, so four times the weight settles at twice the swing. If the air’s drag on the bob grows faster than that, as it may, the swing grows more slowly and the clock loses a little less. As with the length, a real clock takes an hour or so to settle into its new swing; the page skips ahead.</p>`
		},
		// ---------------------------------------------------------------- next
		{
			id: 'next',
			chapter: 'next',
			title: 'Read next',
			scene: 'clock',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>A pendulum clock splits the work in two. The falling weight drives the wheels and gives the pendulum a tiny push each swing. The pendulum lets the wheels move on one small step per swing, and its length alone sets how long a swing takes. Christiaan Huygens invented the pendulum clock in December 1656, and the clockmaker Salomon Coster built the first ones in 1657. Clocks that had been out by about a quarter of an hour a day were soon right to about fifteen seconds a day.</p>
<p>The page on <a href="../oscillations-resonance/">oscillations and resonance</a> looks at swinging things more closely: how a pendulum’s length sets its swing, and what happens when you push a swing in time with it.</p>`
		}
	]
};
