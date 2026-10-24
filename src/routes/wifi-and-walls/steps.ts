import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { LINE_SPEEDS } from './model';

const spot: Control = {
	type: 'range',
	id: 'spot',
	label: 'Walk the laptop away from the router',
	min: 0,
	max: 100,
	step: 1,
	default: 0,
	format: (v) => (v === 0 ? 'on the sofa' : v === 100 ? 'far corner' : `${v}% of the way`)
};

const obstacle: Control = {
	type: 'select',
	id: 'obstacle',
	label: 'Put something in the way',
	default: 'none',
	options: [
		{ value: 'none', label: 'Nothing' },
		{ value: 'glass', label: 'A glass door' },
		{ value: 'brick', label: 'A brick wall' },
		{ value: 'concrete', label: 'A concrete wall' },
		{ value: 'tank', label: 'A fish tank' },
		{ value: 'fridge', label: 'A fridge' }
	]
};

const fast: Control = {
	type: 'toggle',
	id: 'fast',
	label: 'Switch the router to the 5 GHz band',
	default: false
};

const neighbour: Control = {
	type: 'select',
	id: 'neighbour',
	label: 'Next door’s router',
	default: 'off',
	options: [
		{ value: 'off', label: 'Switched off' },
		{ value: 'same', label: 'On the same channel as ours' },
		{ value: 'other', label: 'On a different channel' }
	]
};

const line: Control = {
	type: 'range',
	id: 'line',
	label: 'Speed of the line into the house',
	min: 0,
	max: LINE_SPEEDS.length - 1,
	step: 1,
	default: 1,
	format: (v) => `${LINE_SPEEDS[v]} Mbit/s`
};

const router =
	'<dfn data-def="The box that makes the Wi-Fi. It sends and hears radio waves, and passes what it hears on to the line that leaves the house.">router</dfn>';
const mbit =
	'<dfn data-def="Megabits a second: a million bits, the 0s and 1s every message is made of, every second. A video call needs about 2, a film in high definition about 5.">Mbit/s</dfn>';
const mcs =
	'<dfn data-def="One way of turning bits into the wiggles of the radio wave. The fast ways pack many bits into each wiggle, so they need a strong, clear signal; the slow ways send fewer bits with more checking, and can be read even when the signal is faint. Engineers call them MCS, modulation and coding schemes.">way of sending</dfn>';
const band =
	'<dfn data-def="A range of radio frequencies set aside for Wi-Fi. There are two main ones: 2.4 gigahertz, where the waves swing 2.4 billion times a second, and 5 gigahertz, more than twice as fast. Newer routers also use a third, at 6 gigahertz.">band</dfn>';
const channel =
	'<dfn data-def="A narrow slice of a band. At 2.4 GHz there is room for only three channels that don’t overlap (usually 1, 6 and 11), so neighbours often end up sharing one.">channel</dfn>';

export const spec: ExplainerSpec = {
	slug: 'wifi-and-walls',
	title: 'Wi-Fi around the house',
	summary:
		'Walk a laptop away from the router through a brick house and watch the map of its signal and the speed it gets. Walls, a fish tank and a fridge each cut a shadow; the link slows down a step at a time rather than cutting out; the faster band reaches less far; next door’s router on the same channel makes the two take turns; and the Wi-Fi is not the internet.',
	chapters: [
		{ id: 'radio', title: 'Radio in the house' },
		{ id: 'walls', title: 'What gets in the way' },
		{ id: 'sharing', title: 'Bands and neighbours' },
		{ id: 'next', title: 'Read next' }
	],
	steps: [
		// ---------------------------------------------------------------- radio
		{
			id: 'radio',
			chapter: 'radio',
			title: 'Where does the Wi-Fi come from?',
			scene: 'house',
			hints: { phase: 'radio', walls: false },
			duration: 16,
			controls: [spot],
			body: `
<p>Here is a house seen from above, before its inside walls are built. In the corner of the living room is the ${router}, the box with the little lights. Wi-Fi is <strong>radio</strong>: the router sends out waves, like the light from a lamp, but waves your eyes can’t see. They spread out in every direction and go through the air, and through quite a lot of other things.</p>
<p>The colour on the floor shows how strong the signal is: darkest next to the router, and paler further away, because the same waves are spread over more and more room. <strong>Walk the laptop away</strong> to the far corner. There the signal is about 60 times weaker than on the sofa.</p>
<p>Yet the laptop’s speed doesn’t change: 130 ${mbit} the whole way. With nothing in the way, the router’s signal stays strong enough for full speed for well over a hundred metres. So what makes Wi-Fi slow in a real house?</p>`
		},
		{
			id: 'walls',
			chapter: 'radio',
			title: 'Walls eat the signal',
			scene: 'house',
			hints: { phase: 'walls' },
			duration: 16,
			controls: [spot],
			body: `
<p>Now the inside walls are up, made of brick as in many European homes. Each time the signal goes through a brick wall, only about <strong>a tenth</strong> of it comes out the other side. Look at the floor: every wall leaves a paler patch behind it, a shadow, and the open doorways let bright beams through.</p>
<p><strong>Walk the laptop</strong> from the sofa, through the kitchen and the bedroom, to the back bedroom. Behind one wall it still gets full speed. In the back bedroom, behind three walls, the signal is a few hundred times weaker than in the kitchen, and the speed drops to 52, then 39 Mbit/s.</p>`,
			notes: `<p>The page counts the walls on the straight line from the router to each spot and takes off a fixed amount for each: brick 89 mm thick (one row of bricks), as measured at the US National Institute of Standards and Technology (NIST, 1997; 2.4 GHz lies between the two frequencies they measured, 2 and 3 GHz). In a real house the signal also bounces off walls, floors and furniture, and some of it reaches round the corners, so real shadows are softer than these. People and furniture take a little more off, too.</p>`
		},
		{
			id: 'ladder',
			chapter: 'radio',
			title: 'Slower, not cut off',
			scene: 'house',
			hints: { phase: 'ladder' },
			duration: 18,
			controls: [spot],
			body: `
<p>Why does the speed drop a step at a time, instead of the Wi-Fi just stopping? Because the router and the laptop have several <strong>ways of sending</strong>, shown on the right as a ladder. The fast ones pack lots of bits into each wiggle of the wave; they only work when the signal is strong and clear. The slow ones send fewer bits each time, with extra bits for checking, so they can still be read when the signal is faint, the way you speak slowly and clearly to someone far away.</p>
<p>Many times a second the two pick the fastest ${mcs} that still gets through. <strong>Walk the laptop</strong> and watch the lit rung. At 2.4 GHz there are eight rungs, from 130 Mbit/s down to 13. Only below the bottom one, when the signal is too faint for even the slowest way, does the link stop.</p>`,
			notes: `<p>The ladder is the one in the Wi-Fi standard (IEEE 802.11n, with two antennas sending at once on a 20 MHz channel). Next to each rung the standard says how weak a signal a Wi-Fi radio must still be able to read with it; real radios usually do a little better. The speeds are those of the radio link: what reaches you is less, because the two sides also have to wait their turn, check what arrived and send again what didn’t.</p>`
		},
		// ---------------------------------------------------------------- walls
		{
			id: 'things',
			chapter: 'walls',
			title: 'A fridge, a fish tank and a glass door',
			scene: 'house',
			hints: { phase: 'things', spot: 80 },
			duration: 18,
			controls: [obstacle],
			body: `
<p>The laptop is on the bed now. With nothing extra in the way it gets 130 Mbit/s. <strong>Put something in the living room</strong>, between it and the router, and watch the shadow it casts.</p>
<p>A <strong>glass door</strong> hardly matters: the speed slips to 117. A <strong>brick wall</strong> brings it down to 52, and a <strong>concrete</strong> one to just 13: concrete lets through only about a seventieth. A <strong>fish tank</strong> is worse than either. Water soaks up these radio waves, which is how a microwave oven heats food: through 30 centimetres of water, less than a millionth gets through. And a <strong>fridge</strong> is a metal box: metal bounces the waves back, and the laptop behind it loses the link altogether.</p>`,
			notes: `<p>Real shadows behind a fish tank or a fridge are not as dark as this: some of the signal bounces off the walls and ceiling and reaches round them, which this page leaves out. That is why moving a router a metre or two can make a big difference: it can move the laptop out of a shadow.</p>`
		},
		// ---------------------------------------------------------------- sharing
		{
			id: 'band',
			chapter: 'sharing',
			title: 'The fast band',
			scene: 'house',
			hints: { phase: 'band', spot: 45 },
			duration: 16,
			controls: [fast],
			body: `
<p>Most routers send on two ${band}s at once. So far we have used the 2.4 GHz band. <strong>Switch to the 5 GHz band.</strong> Its channels are four times wider, so its ladder goes much higher: in the kitchen the laptop now gets 351 Mbit/s instead of 130, and next to the router 780, six times as fast.</p>
<p>But look at the map. The 5 GHz waves arrive about four times weaker than 2.4 GHz ones at the same distance, and they lose more in each wall: a brick wall lets through only about a thirtieth of them. The fast rungs also need a stronger signal. So the coloured patch is much smaller.</p>`
		},
		{
			id: 'reach',
			chapter: 'sharing',
			title: 'Faster, but not as far',
			scene: 'house',
			hints: { phase: 'reach', fast: true },
			duration: 16,
			controls: [spot],
			body: `
<p>On the 5 GHz band, <strong>walk the laptop</strong> through the house again. Through the living room it races along at 780 Mbit/s. In the kitchen, behind one wall, it slows to 468, then 351. In the bedroom, behind two walls, the signal is too faint even for the bottom rung: no link.</p>
<p>That is why routers keep both bands. A laptop close by uses the fast band; one in a far room falls back to 2.4 GHz, slower but further-reaching. Many routers switch it over by themselves.</p>`
		},
		{
			id: 'neighbour',
			chapter: 'sharing',
			title: 'Next door’s Wi-Fi',
			scene: 'house',
			hints: { phase: 'neighbour', spot: 45 },
			duration: 18,
			controls: [neighbour],
			body: `
<p>Next door has a router too, just the other side of the wall. <strong>Switch it on, on the same ${channel} as ours.</strong> Two radios sending on the same channel at the same moment would garble each other, like two people talking at once. So each Wi-Fi radio first listens, and if it hears another one sending, it waits. The laptop in the kitchen can hear next door’s router, so the two networks have to <strong>take turns</strong>.</p>
<p>The link is just as fast as before, 130 Mbit/s, but when next door is busy too, our laptop only gets the air half the time: 65 Mbit/s. Put next door on <strong>a different channel</strong> and the two don’t hear each other at all; the laptop has the air to itself again.</p>`,
			notes: `<p>A Wi-Fi radio has to treat the channel as busy whenever it picks up another Wi-Fi signal stronger than a set level; the page uses the standard’s level, less than a hundred-millionth of a millionth of a watt. In a block of flats a laptop can hear a dozen networks, which is why Wi-Fi gets slow in the evening, when everybody is online.</p>`
		},
		{
			id: 'internet',
			chapter: 'sharing',
			title: 'Wi-Fi is not the internet',
			scene: 'house',
			hints: { phase: 'internet', spot: 45 },
			duration: 18,
			controls: [line],
			body: `
<p>The Wi-Fi only joins the laptop to the router. To reach the internet, the router passes everything on to a <strong>line out of the house</strong>: a fibre or a phone cable to the street. <strong>Change the speed of that line.</strong></p>
<p>Whatever reaches the laptop has to come through both, and the slower one sets the pace. On a 30 Mbit/s line, the laptop gets 30, even with a 130 Mbit/s Wi-Fi link and every bar full. A full Wi-Fi signal only says the radio part is fine; it says nothing about the line. Only when the line is faster than the Wi-Fi does the Wi-Fi hold you back.</p>`
		},
		// ---------------------------------------------------------------- next
		{
			id: 'next',
			chapter: 'next',
			title: 'Read next',
			scene: 'house',
			hints: { phase: 'next' },
			duration: 16,
			controls: [spot],
			body: `
<p>Wi-Fi is radio. It fades with distance, walls and water soak it up, and metal bounces it away. As the signal gets fainter, the router and the laptop step down to slower, sturdier ways of sending, so the link slows down rather than breaking. The faster band carries more but reaches less far, two networks on one channel must take turns, and the line out of the house sets a limit of its own.</p>
<p>The page on <a href="../internet/">the internet</a> follows the bits once they leave the house. And <a href="../waves-interference/">waves and interference</a> shows how waves spread, and what happens when two of them meet.</p>`
		}
	]
};
