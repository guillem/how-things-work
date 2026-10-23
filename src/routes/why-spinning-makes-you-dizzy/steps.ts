import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { turnsWords } from './model';

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'How fast the chair spins',
	min: 1,
	max: 10,
	step: 1,
	default: 5,
	format: turnsWords
};

const spinFor: Control = {
	type: 'range',
	id: 'spinFor',
	label: 'How long you spin before stopping',
	min: 2,
	max: 40,
	step: 1,
	default: 10,
	format: (v) => `${v} seconds`
};

const turn: Control = {
	type: 'select',
	id: 'turn',
	label: 'How you move your head',
	default: 'shake',
	options: [
		{ value: 'shake', label: 'Shake it “no”' },
		{ value: 'nod', label: 'Nod “yes”' },
		{ value: 'tilt', label: 'Tilt it to a shoulder' }
	]
};

const rings =
	'<dfn data-def="Three tiny curved tubes of fluid deep inside each ear, beside the cochlea. Each one senses turning in its own direction. Their proper name is the semicircular canals.">rings</dfn>';
const flap =
	'<dfn data-def="A soft, clear flap of jelly that closes the ring’s tube in a little bulge at one end, like a door. When the fluid pushes on it, it bends. Its proper name is the cupula.">flap</dfn>';
const hairCells =
	'<dfn data-def="Sensor cells at the foot of the flap, each with a tuft of tiny hairs poking up into the jelly. When the flap bends, the hairs bend, and the cell changes the signals it sends along its nerve to the brain.">hair cells</dfn>';

/**
 * Scenes: `spin` (a child on an office chair, the ear's flat ring seen from above with its fluid
 * and flap, and a chart of the chair's speed and the speed you feel, all from the model; focus
 * 'chair', 'start', 'steady', 'stop', 'long', 'honest' or 'next', each a different story of
 * spinning and stopping) and `ear` (a head with the inner ear's three rings drawn large; the
 * rings that a shake, a nod or a tilt stirs light up).
 */
export const spec: ExplainerSpec = {
	slug: 'why-spinning-makes-you-dizzy',
	title: 'Why spinning makes you dizzy',
	summary:
		'Spin on a chair and watch the fluid in a tiny ring inside your ear lag behind and bend a little flap that tells your brain you are turning. Keep spinning and the feeling fades; stop, and the fluid keeps going, bends the flap the other way, and you feel yourself turning backwards while the room stands still.',
	chapters: [
		{ id: 'spin', title: 'Spinning and stopping' },
		{ id: 'ring', title: 'Inside a ring' },
		{ id: 'more', title: 'Longer, and why' }
	],
	steps: [
		// ------------------------------------------------------------------ spin
		{
			id: 'chair',
			chapter: 'spin',
			title: 'Spin on a chair, then stop',
			scene: 'spin',
			hints: { focus: 'chair' },
			duration: 24,
			controls: [speed],
			body: `
<p>Sit on a spinning chair, push off and keep turning. At first you feel the spin clearly. Keep going at the same speed and something odd happens: the feeling fades, as if you were slowing down, though the chair is turning as fast as ever.</p>
<p>Then the chair stops. The room is standing still, yet now you feel yourself spinning <strong>the other way</strong>, and the room seems to swirl. You are dizzy.</p>
<p><strong>Slide the speed</strong> and watch the chart under the chair: one line for how fast the chair really turns, one for how fast you feel you are turning. (The drawing runs twice as fast as real life.) Where does that backwards feeling come from? From a sensor inside each ear that is doing its job exactly right.</p>`
		},
		{
			id: 'rings',
			chapter: 'spin',
			title: 'Three rings of fluid in each ear',
			scene: 'ear',
			duration: 20,
			controls: [turn],
			body: `
<p>Deep inside each ear, right next to the snail-shaped cochlea you hear with, sit three tiny ${rings}, each about 6 millimetres across and filled with fluid. They stand at right angles to each other, like the floor and two walls in the corner of a room, so every way of turning your head stirs the fluid in at least one of them.</p>
<p><strong>Choose how you move your head.</strong> Shaking it “no” stirs the flat ring. Nodding “yes” or tilting your head to a shoulder stirs the two upright rings.</p>
<p>Spinning on a chair is a big “no”: it is the flat ring that feels it. The rest of the page looks inside that one.</p>`,
			notes: `<p>The two upright rings stand at a slant, about halfway between facing forwards and facing sideways, so a nod or a tilt stirs both of them, in different mixes. The brain compares the rings of both ears to work out which way the head turned. The flat ring is not quite flat either: it is tipped up at the front, by roughly 20 to 30 degrees.</p>`
		},
		// ------------------------------------------------------------------ ring
		{
			id: 'start',
			chapter: 'ring',
			title: 'Start spinning: the fluid falls behind',
			scene: 'spin',
			hints: { focus: 'start' },
			duration: 18,
			controls: [speed],
			body: `
<p>Here is the flat ring, drawn hugely enlarged and seen from above. It is part of your head, so it turns with you. In a bulge at one end, a soft ${flap} of jelly closes the tube like a door, and at its foot ${hairCells} send signals to the brain whenever the flap bends.</p>
<p>Push off and watch. The ring starts turning at once, but the fluid inside is slow to get going, like the tea in a cup when you turn the cup: it falls a little <strong>behind</strong>. Falling behind, it pushes on the flap and bends it, and the hair cells tell the brain “turning right!”.</p>
<p><strong>Slide the speed.</strong> A faster spin bends the flap further, and the brain feels a faster turn.</p>`,
			notes: `<p>In a real ear the fluid falls behind only for a moment, a hundredth of a second, and only by a tiny bit: the drawing makes the slip and the flap’s bend much bigger so you can see them. From then on the fluid turns along with the ring, still slipped behind by that tiny bit, and that keeps the flap bent.</p>`
		},
		{
			id: 'steady',
			chapter: 'ring',
			title: 'Keep spinning: the feeling fades',
			scene: 'spin',
			hints: { focus: 'steady' },
			duration: 26,
			controls: [speed],
			body: `
<p>Now keep turning at the same speed. The flap is springy: bent, it slowly pushes back on the fluid, and the fluid creeps round until it is back in its place in the ring. In about <strong>15 to 20 seconds</strong> the flap stands straight again.</p>
<p>A straight flap sends no “turning” signal, so the feeling fades, though the chair is spinning as fast as ever. Watch the chart: after 10 seconds you feel only about a quarter of the speed you are really turning, and after 20 seconds hardly any.</p>
<p>Your ear cannot feel a steady spin. What it feels is a <strong>change</strong> of spin: starting, speeding up, slowing down, stopping.</p>`,
			notes: `<p>The feeling fades a little more slowly than the flap straightens, because the brain holds on to the ear’s signal for a while, like a bucket that fills from it and slowly leaks. The page’s lines are a model fitted to what people report, in a dark room, after real spins on a turning chair: the flap’s springing back takes about 5 seconds to fall to a third, the brain’s bucket about 15.</p>`
		},
		{
			id: 'stop',
			chapter: 'ring',
			title: 'Stop: the fluid keeps going',
			scene: 'spin',
			hints: { focus: 'stop' },
			duration: 22,
			controls: [speed],
			body: `
<p>After half a minute of spinning, the chair stops. The ring stops with your head, but the fluid inside <strong>keeps going</strong>, like the tea that swirls on when you stop turning the cup. Running on, it pushes the flap the other way.</p>
<p>The hair cells report what a flap bent that way always means: “turning left”. So you feel yourself spinning to the left, nearly as fast as you spun to the right, while the room stands still. <strong>That is dizzy.</strong></p>
<p>Your eyes are fooled too: they drift sideways to follow the spin you feel and keep flicking back, so the room seems to swirl. Over about 20 seconds the flap springs straight once more, and the dizziness fades.</p>`
		},
		// ------------------------------------------------------------------ more
		{
			id: 'long',
			chapter: 'more',
			title: 'Spin longer, get dizzier',
			scene: 'spin',
			hints: { focus: 'long' },
			duration: 24,
			controls: [spinFor],
			body: `
<p><strong>Slide how long you spin</strong> before stopping.</p>
<p>Stop after only 2 seconds and the flap is still bent from the start. Stopping just bends it back to straight and a little past, so you feel only a little dizzy: about a quarter as fast as the spin. Spin for 5 seconds and the backwards feeling is about half as fast as the spin. Spin for half a minute and the flap has had time to stand straight, so stopping bends it all the way the other way: the strongest dizziness this speed can give.</p>
<p>Speed matters too: spin twice as fast and the flap bends twice as far, both ways.</p>`
		},
		{
			id: 'honest',
			chapter: 'more',
			title: 'Your ear is not wrong',
			scene: 'spin',
			hints: { focus: 'honest' },
			duration: 22,
			body: `
<p>Dizziness after spinning is not blood sloshing around your head, and it is not your brain being overwhelmed by the speed. The sensor is telling the truth: the fluid in the ring really is still moving, and the flap really is bent. The only trouble is that the fluid’s movement is no longer your head’s movement.</p>
<p>Your eyes can help: the moment you stop, look at something still and the dizziness wears off sooner. Ballet dancers whip their heads round to keep their eyes on one spot as they spin, and after years of training their brains pay less attention to the ear’s backwards signal.</p>`
		},
		{
			id: 'next',
			chapter: 'more',
			title: 'Read next',
			scene: 'spin',
			hints: { focus: 'next' },
			duration: 14,
			body: `
<p>Your ears sense turning with rings of fluid. When you start to spin, the fluid falls behind and bends a flap; when you keep spinning, the flap springs back and the feeling fades; when you stop, the fluid keeps going and bends the flap the other way, so you feel yourself turning backwards.</p>
<p>The fluid keeps going because things keep moving until something stops them: that is the first of <a href="../newtons-laws/">Newton’s laws</a>. The flap is a spring held back by a thick fluid, like a swing in honey, which is why it creeps back instead of wobbling: see <a href="../oscillations-resonance/">oscillations and resonance</a>. And for the cochlea next door, read <a href="../hearing-and-the-ear/">how your ear hears</a>.</p>`
		}
	]
};
