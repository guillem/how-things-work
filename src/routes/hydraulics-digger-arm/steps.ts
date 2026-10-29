import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { HAND } from './model';

const cm = (v: number) => `${v.toLocaleString('en-GB')} cm`;

const push: Control = {
	type: 'range',
	id: 'push',
	label: 'Push the small piston down',
	min: 0,
	max: HAND.stroke * 100,
	step: 1,
	default: 0,
	format: cm,
	help: 'Or drag the handle on the small piston.'
};

const big: Control = {
	type: 'range',
	id: 'big',
	label: 'How wide the big piston is',
	min: 2,
	max: 30,
	step: 0.5,
	default: 6.5,
	format: cm,
	help: 'The small piston is 2 cm wide.'
};

const air: Control = {
	type: 'range',
	id: 'air',
	label: 'Air in the pipe',
	min: 0,
	max: 6,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'none' : v === 1 ? '1 spoonful' : `${v} spoonfuls`),
	help: 'A tablespoon holds about 15 millilitres.'
};

const scoop: Control = {
	type: 'range',
	id: 'scoop',
	label: 'Work the digger',
	min: 0,
	max: 100,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'ready' : v === 100 ? 'dumped' : `${v} %`),
	help: 'Each part of the scoop is one cylinder at work.'
};

const piston =
	'<dfn data-def="A plug that slides inside a tube, fitting so snugly that nothing can leak past it. Push it in and it pushes on whatever is in the tube.">piston</dfn>';
const cylinder =
	'<dfn data-def="A strong metal tube with a piston inside and a shiny rod sticking out. Oil pumped into one end pushes the rod out; oil pumped into the other end pulls it back in.">cylinder</dfn>';
const hydraulics =
	'<dfn data-def="Using a trapped liquid, usually oil, to pass a push from one place to another, and to make it bigger on the way.">hydraulics</dfn>';

export const spec: ExplainerSpec = {
	slug: 'hydraulics-digger-arm',
	title: 'Diggers and hydraulics: a small push becomes a huge one',
	summary:
		'Push a small piston and oil shoves a bigger one: ten times the area gets ten times the push, but moves only a tenth as far. Make the big piston wider and lift a car, then a boulder; let air into the pipe and it goes spongy. Then work a digger’s three cylinders to scoop and dump.',
	chapters: [
		{ id: 'push', title: 'Pushing through oil' },
		{ id: 'lift', title: 'Lifting heavy things' },
		{ id: 'digger', title: 'The digger' }
	],
	steps: [
		// ------------------------------------------------------------------ push
		{
			id: 'digger',
			chapter: 'push',
			title: 'What moves a digger’s arm?',
			scene: 'digger',
			hints: { phase: 'intro' },
			duration: 14,
			body: `
<p>A digger lifts a boulder heavier than a car as if it were a pebble. Look at its arm: there is no motor in the elbow. What moves it are the shiny rods sliding out of fat tubes, and the black hoses running to them.</p>
<p>Each of those tubes is a ${cylinder}, and the hoses carry <strong>oil</strong>. How can a little oil in a hose push hard enough to lift a boulder? Start with something much smaller.</p>`
		},
		{
			id: 'squeeze',
			chapter: 'push',
			title: 'Oil passes the push along',
			scene: 'press',
			hints: { phase: 'same' },
			duration: 18,
			controls: [push],
			body: `
<p>Here is a pipe full of oil with a ${piston} at each end: a snug plug that slides but lets nothing past. Both pistons are the same size.</p>
<p><strong>Push the left piston down.</strong> The right one rises, exactly as far. Oil can’t be squashed into less room, so every drop you push in at one end has to come out at the other, and it pushes the other piston up.</p>
<p>You can try this with two syringes joined by a tube of water: push one, and the other one’s plunger pops out.</p>`,
			notes: `<p>Oil does squash a tiny bit. Even pressed as hard as in a digger, it gets only about 2 parts in 100 smaller. A bubble of air held that hard, once it has cooled back to the temperature of the room, would be about a 340th of its size (squashed in a hurry it heats up and shrinks only to about a 60th, still far more than the oil). That difference is the whole secret of hydraulics, as you will see with an air bubble later.</p>`
		},
		{
			id: 'bigger',
			chapter: 'push',
			title: 'A bigger piston gets a bigger push',
			scene: 'press',
			hints: { phase: 'ten' },
			duration: 22,
			controls: [push],
			body: `
<p>Now the right piston is a bit more than three times as wide, so its face is <strong>ten times as big</strong>. On it sits a crate of 100 kg.</p>
<p>Your hand pushes only as hard as lifting 10 kg. The trapped oil passes that push on, and it passes it on to <strong>every square centimetre</strong> it touches, the same on each. Look at the little squares on the two piston faces: each one gets the same push. The big piston has ten times as many squares, so it gets <strong>ten times the push</strong>: enough for the crate.</p>
<p><strong>Push the small piston down</strong> and watch the price: push it 10 cm, and the crate rises only <strong>1 cm</strong>. The oil you push in spreads out under a piston ten times as big, so it lifts it only a tenth as far.</p>`,
			notes: `<p>The oil does not pass on the same total push: it passes on the same push <em>on each bit of surface</em>, which scientists call the same <dfn data-def="How hard something pushes on each square centimetre (or each square metre) of a surface.">pressure</dfn>. That is why the bigger piston, with more surface, gets more.</p>`
		},
		{
			id: 'trade',
			chapter: 'push',
			title: 'More push, less distance: a fair swap',
			scene: 'press',
			hints: { phase: 'trade' },
			duration: 22,
			controls: [big],
			body: `
<p><strong>Change how wide the big piston is.</strong> The counters show what you get and what you pay.</p>
<p>Make it three times as wide and its face is nine times as big: nine times the push, a ninth of the distance. Wider still, the two numbers keep trading places <strong>exactly</strong>: as many times stronger as it is shorter.</p>
<p>Twice as wide would give four times the push, but your hand gives only 20 kg and four times that is 80 kg: not enough for the 100 kg crate, which stays put until the piston is about 4.5 cm across.</p>
<p>So hydraulics don’t make anything for free. Your hand gives a small push over a long way; the big piston gives a huge push over a short way. A lever, a ramp and a bicycle’s low gear make the same swap.</p>`,
			notes: `<p>Scientists call push times distance the <dfn data-def="What it takes to move something against a push: the push times how far it moves. It comes from your muscles, or an engine, and can't be made from nothing.">work</dfn> done. The work your hand puts in equals the work done lifting, minus a sliver lost to friction in real machines. Hydraulics, like levers, move work around; they never make more.</p>`
		},
		// ------------------------------------------------------------------ lift
		{
			id: 'car',
			chapter: 'lift',
			title: 'Lift a car with one hand',
			scene: 'press',
			hints: { phase: 'car' },
			duration: 22,
			controls: [big],
			body: `
<p>Now a car of 1,200 kg sits on the big piston, and your hand still pushes only as hard as lifting 20 kg. <strong>Make the big piston wider</strong> until the car rises.</p>
<p>It needs a face 60 times as big as the small piston’s: about <strong>15.5 cm</strong> across, almost eight times as wide. Any narrower, and the push of the oil can’t hold the car up.</p>
<p>And the price: one whole push of 30 cm lifts the car only about <strong>half a centimetre</strong>. To raise it 10 cm, you would push twenty times. That is just what a hydraulic bottle jack does: you pump its handle up and down, and each time the handle comes back up a little valve lets fresh oil in under the small piston.</p>`
		},
		{
			id: 'boulder',
			chapter: 'lift',
			title: 'Then a boulder',
			scene: 'press',
			hints: { phase: 'boulder' },
			duration: 22,
			controls: [big],
			body: `
<p>A boulder of 3,000 kg, as heavy as two and a half cars. <strong>Make the big piston wide enough</strong> to lift it with the same 20 kg push: about <strong>24.5 cm</strong> across, 150 times the face of the small piston.</p>
<p>Now one push of 30 cm lifts it just <strong>2 mm</strong>. Lifting it a metre would take 500 pushes. No person wants to do that, so a digger has an engine that drives a <strong>pump</strong>: a set of small pistons pushing oil many times every second, and pushing it about 340 times harder than the air around us presses. (Pressing that hard on 2 cm, the size of our small piston, is like lifting more than a tonne.)</p>`,
			notes: `<p>The pump makes the digger fast, not strong in a new way: it still pays for each big push with lots of small ones. The engine does the pushing, and its fuel pays for the work.</p>`
		},
		{
			id: 'air',
			chapter: 'lift',
			title: 'A bubble of air makes it spongy',
			scene: 'press',
			hints: { phase: 'air' },
			duration: 24,
			controls: [air],
			body: `
<p>The car is back on a 16 cm piston, and the hand pushes all the way down, again and again. <strong>Let some air into the pipe.</strong></p>
<p>Unlike oil, air squashes easily. Now the first part of every push only squeezes the bubble smaller, and the car doesn’t move until the bubble is squeezed hard enough to hold it up. With 3 spoonfuls of air, the first 12 cm of the push go into the bubble, and the car rises little more than half as far. When you let go, the bubble springs back, like a sponge.</p>
<p>That spongy feel is the sign of air in a brake pipe: the pedal sinks too far before the brakes grip. Mechanics “bleed” the brakes to let the air out.</p>`
		},
		// ------------------------------------------------------------------ digger
		{
			id: 'scoop',
			chapter: 'digger',
			title: 'Three cylinders: scoop and dump',
			scene: 'digger',
			hints: { phase: 'scoop' },
			duration: 30,
			controls: [scoop],
			body: `
<p>Back to the digger. Its arm has three joints, and each one is moved by its own cylinder: the <strong>boom</strong> (the big first part), the <strong>arm</strong> and the <strong>bucket</strong>. <strong>Work the digger</strong> and watch which cylinder moves.</p>
<p>The driver’s joysticks open valves that send oil from the pump into one end of a cylinder, which pushes its rod out, or into the other end, which pulls it in. Each boom cylinder is 12 cm wide inside and, with oil pushed 340 times harder than the air around us, pushes like lifting about <strong>40 tonnes</strong>. There are two of them: together four times the weight of the whole 20-tonne digger.</p>
<p>And the same swap again: the boom cylinder stretches less than a metre while the bucket swings through several metres. A huge push over a short way becomes a smaller push over a long way, which is the swap of a lever.</p>`
		},
		{
			id: 'next',
			chapter: 'digger',
			title: 'Read next',
			scene: 'digger',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>Trapped oil passes on the same push to every bit of surface it touches. A piston with ten times the face gets ten times the push and pays by moving a tenth as far. That is ${hydraulics}: in diggers, car jacks, lifts, a plane’s flaps and a car’s brakes.</p>
<p>Pushes, weights and why things move or stay still are the subject of <a href="../newtons-laws/">Newton’s laws</a>. How a bridge or a digger’s arm carries huge pushes and pulls through its parts is in <a href="../bridges-structures/">bridges and structures</a>. And why water pushes a boat up from below is in <a href="../floating-sinking-and-boats/">floating and sinking</a>.</p>`
		}
	]
};
