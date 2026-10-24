import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const turns = (v: number) => `${Math.round(v)} turns a second`;

const throttle: Control = {
	type: 'range',
	id: 'throttle',
	label: 'Throttle: all four rotors together',
	min: 0,
	max: 320,
	step: 1,
	default: 0,
	format: turns
};

const sameWay: Control = {
	type: 'toggle',
	id: 'sameWay',
	label: 'Make all four rotors spin clockwise',
	default: false
};

/** A stick from −1 to 1, shown as how far it is pushed and which way. */
const stick = (neg: string, pos: string) => (v: number) => {
	const pct = Math.round(Math.abs(v) * 100);
	if (pct === 0) return 'centre';
	return `${pct === 100 ? 'all the way' : `${pct}%`} ${v < 0 ? neg : pos}`;
};

const forward: Control = {
	type: 'range',
	id: 'forward',
	label: 'Forward stick',
	min: -1,
	max: 1,
	step: 0.05,
	default: 0,
	format: stick('back', 'forward')
};

const right: Control = {
	type: 'range',
	id: 'right',
	label: 'Sideways stick',
	min: -1,
	max: 1,
	step: 0.05,
	default: 0,
	format: stick('left', 'right')
};

const turn: Control = {
	type: 'range',
	id: 'turn',
	label: 'Turn stick',
	min: -1,
	max: 1,
	step: 0.05,
	default: 0,
	format: stick('left', 'right')
};

const rotor = (id: string, label: string): Control => ({
	type: 'range',
	id,
	label,
	min: 0,
	max: 420,
	step: 1,
	default: 278,
	format: turns
});

const rotorDfn =
	'<dfn data-def="A propeller turned by its own little electric motor. A drone with four of them is also called a quadcopter.">rotor</dfn>';
const throttleDfn =
	'<dfn data-def="The control that sets how fast the rotors spin all together, like the pedal that makes a car go faster.">throttle</dfn>';
const flightComputer =
	'<dfn data-def="A tiny computer on board with sensors that feel how the drone is tipped and turning. Hundreds of times a second it works out the four rotor speeds that do what the sticks ask.">flight computer</dfn>';

export const spec: ExplainerSpec = {
	slug: 'drone-four-rotors',
	title: 'How a drone steers with four rotors',
	summary:
		'A drone has no wings, flaps or rudder: only four rotors. Speed them all up and it climbs; speed up the back pair and it tips and flies forward; speed up the two that spin clockwise and it turns on the spot. Fly a palm-sized drone one stick at a time, then try the four speeds yourself.',
	chapters: [
		{ id: 'up', title: 'Up in the air' },
		{ id: 'steer', title: 'Steering' },
		{ id: 'you', title: 'Your turn' },
		{ id: 'next', title: 'Read next' }
	],
	steps: [
		// ---------------------------------------------------------------- up
		{
			id: 'drone',
			chapter: 'up',
			title: 'How does a drone fly?',
			scene: 'drone',
			hints: { phase: 'drone' },
			duration: 14,
			body: `
<p>This little drone fits in the palm of your hand: it is about 9 cm across and weighs 27 grams, as much as five sheets of paper. It has no wings, no flaps and no rudder. All it has is four ${rotorDfn}s, one at the end of each arm.</p>
<p>Each rotor spins very fast, about <strong>280 turns every second</strong>, and pushes air down. The air pushes the rotor up: the green arrows. Together the four pushes hold up the drone’s weight, the grey arrow, and it hovers.</p>
<p>Look at the colours. Two rotors spin <strong>clockwise</strong> (blue) and two spin <strong>anticlockwise</strong> (orange), each one opposite to its neighbours. On the right, the same drone seen from above, with a bar for each rotor’s speed. Everything this drone does, it does by changing those four bars.</p>`,
			notes: `<p>The drone on this page has the size, weight and rotor numbers of a real one, the Crazyflie, a tiny open-source drone used in universities. Its rotors are drawn turning far slower than they really do: at 280 turns a second they would just be a blur.</p>`
		},
		{
			id: 'throttle',
			chapter: 'up',
			title: 'Faster rotors, more push',
			scene: 'drone',
			hints: { phase: 'throttle' },
			duration: 20,
			controls: [throttle],
			body: `
<p>The drone sits on its landing pad with its rotors stopped. <strong>Raise the ${throttleDfn}</strong>: all four rotors speed up together, and each pushes harder the faster it spins.</p>
<p>At first nothing happens: the four pushes are smaller than the drone’s weight. Just past <strong>278 turns a second</strong> they become bigger, and it lifts off. A little faster, at 290 turns a second, the pushes beat the weight by more, and it climbs faster and faster until the air holds it back at about <strong>3 metres a second</strong>. Lower the throttle under 278 and the weight wins: it sinks.</p>
<p>Holding it still in the air is hard: one turn a second too slow and it sinks, one too fast and it climbs. Real drones have a ${flightComputer} that does this for you, and from the next step on it holds the drone at one and a half metres.</p>`,
			notes: `<p>A rotor spinning twice as fast pushes about four times as hard. Flat out, at about 420 turns a second, these four rotors push about two and a quarter times the drone’s weight, so it can climb while carrying a little extra, or tilt a long way without sinking.</p>`
		},
		{
			id: 'twist',
			chapter: 'up',
			title: 'Why two spin each way',
			scene: 'drone',
			hints: { phase: 'twist' },
			duration: 18,
			controls: [sameWay],
			body: `
<p>A spinning rotor does something else as well. It shoves the air round as it turns, and the air shoves back: each rotor’s motor gets a <strong>twist</strong> the other way from its spin, and passes it on to the drone. The curved arrows show each twist.</p>
<p>A clockwise rotor twists the drone anticlockwise; an anticlockwise rotor twists it clockwise. With two of each, the twists <strong>cancel</strong>, and the drone hovers without turning.</p>
<p><strong>Make all four rotors spin clockwise.</strong> Now all four twists point the same way, and nothing cancels them. The drone’s body whirls round <strong>anticlockwise</strong>, the opposite way to its rotors, and within a second it is spinning about ten times a second, and still speeding up. The flight computer can’t stop it.</p>`,
			notes: `<p>So that every rotor still pushes air <em>down</em>, a clockwise rotor has propellers shaped as the mirror image of an anticlockwise one’s: drone propellers come in two kinds, marked so you fit each on the right motor. A helicopter has one big rotor, so it needs a little sideways rotor on its tail to stop the same twist. How fast the drone ends up whirling depends on how hard the air holds back its spinning arms; the page only estimates that.</p>`
		},
		// ---------------------------------------------------------------- steer
		{
			id: 'forward',
			chapter: 'steer',
			title: 'Tip forward, fly forward',
			scene: 'drone',
			hints: { phase: 'forward' },
			duration: 22,
			controls: [forward],
			body: `
<p>A drone has nothing that pushes it forward. So how does it fly forward? <strong>Push the forward stick</strong> and watch the speed bars the moment you push.</p>
<p>The flight computer speeds up the <strong>back pair</strong> of rotors and slows the front pair, until the back pair spins about 5 turns a second faster than the front, out of 280. The back lifts more than the front, and the drone <strong>tips</strong> nose down, 10 degrees with the stick all the way. A speed difference only starts the tip: as soon as the tilt is right, the four speeds match again.</p>
<p>Now the four pushes lean forward with the drone. Most of each push still holds the drone up, but part of it now pushes <strong>forward</strong>: the small arrow. It is the tilt that moves the drone. Flat out it builds up to about <strong>25 km/h</strong>. All four rotors spin a little faster while it leans, because only part of their push now holds it up.</p>
<p>Let go and the front pair speeds up for a moment to tip it back level. Then nothing pushes it any more, and it glides on until the air slows it down.</p>`,
			notes: `<p>The flight computer on this page tips the drone in about half a second, slowly enough to see. A real one does it several times faster, with bigger speed differences for a shorter time. Pull the stick back and the front pair speeds up instead: the drone tips nose up and flies backwards.</p>`
		},
		{
			id: 'sideways',
			chapter: 'steer',
			title: 'Tip sideways, slide sideways',
			scene: 'drone',
			hints: { phase: 'sideways' },
			duration: 20,
			controls: [right],
			body: `
<p>Sideways works the same way, seen from behind. <strong>Push the sideways stick to the right.</strong> The <strong>left pair</strong> of rotors speeds up for a moment and the right pair slows: the left side lifts, and the drone tips to the right.</p>
<p>Tipped, its pushes lean right, and it <strong>slides to the right</strong>. No rotor pushes sideways: every rotor only ever pushes straight out of the drone’s top. Tipping the whole drone is what turns part of that push sideways.</p>
<p>Push the stick left and it is the right pair that speeds up, tipping the drone left.</p>`
		},
		{
			id: 'turn',
			chapter: 'steer',
			title: 'Turning on the spot',
			scene: 'drone',
			hints: { phase: 'turn' },
			duration: 20,
			controls: [turn],
			body: `
<p>To turn and face another way, the drone uses the rotors’ twists. <strong>Push the turn stick to the left.</strong></p>
<p>The flight computer speeds up the two rotors that spin <strong>clockwise</strong> and slows the two that spin anticlockwise. The clockwise pair’s twists win, and the drone turns <strong>anticlockwise</strong>: to the left, a quarter turn every second with the stick all the way.</p>
<p>The lift stays the same: two rotors push a little harder and two a little less, so the drone neither climbs nor sinks, and it doesn’t tip either, because the faster rotors sit at opposite corners. Once it is turning the speeds even out again; let go and the anticlockwise pair speeds up for a moment to stop it. To turn right, the anticlockwise pair speeds up.</p>`
		},
		// ---------------------------------------------------------------- you
		{
			id: 'hands',
			chapter: 'you',
			title: 'Fly it yourself',
			scene: 'drone',
			hints: { phase: 'hands' },
			duration: 30,
			controls: [
				rotor('fl', 'Front left rotor (clockwise)'),
				rotor('fr', 'Front right rotor (anticlockwise)'),
				rotor('bl', 'Back left rotor (anticlockwise)'),
				rotor('br', 'Back right rotor (clockwise)')
			],
			body: `
<p>Now the flight computer is switched off, and the four rotor speeds are yours. They start at 278 turns a second, just short of hovering, so the drone sinks very slowly.</p>
<p>Try it. Speed up the two back rotors by just <strong>one turn a second</strong>: the drone tips forward, and keeps tipping further and further, until it turns over within two seconds and crashes. A speed difference doesn’t set a tilt; it starts a tip that keeps growing until another difference stops it. When it crashes it is put back on its feet.</p>
<p>That is why nobody flies a drone by its rotor speeds. The flight computer feels the tilt and changes the four speeds hundreds of times a second, so the sticks only have to say “forward”, “left” or “turn”.</p>`,
			notes: `<p>To make it climb straight up by hand, set all four rotors to the same speed, above 278: with even speeds it stays level. Any difference, front against back or left against right, tips it; the clockwise pair against the other pair turns it.</p>`
		},
		// ---------------------------------------------------------------- next
		{
			id: 'next',
			chapter: 'next',
			title: 'Read next',
			scene: 'drone',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>A drone steers with nothing but four rotor speeds. All four faster: it climbs. One pair faster than the other, front against back or left against right: it tips, and the tilted pushes carry it that way. The two clockwise rotors faster than the other two: their twist turns it on the spot. And because the pairs spin opposite ways, their twists cancel the rest of the time.</p>
<p>Every move here is a push and a push back: the rotor pushes air down and the air pushes it up; it shoves the air round and gets twisted the other way. The page on <a href="../newtons-laws/">Newton’s laws</a> is about exactly that. <a href="../flight/">How wings fly</a> shows the other way to hold something up in the air, and <a href="../feedback-control/">feedback control</a> shows how a flight computer holds a drone at one height.</p>`
		}
	]
};
