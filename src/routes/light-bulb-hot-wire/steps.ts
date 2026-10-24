import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import {
	DRAPER,
	FULL,
	LED_EFFICACY,
	WIRE_DIAMETER,
	WIRE_LENGTH,
	bulb,
	celsius,
	glowName,
	infraredShare,
	led
} from './model';

/** The dimmer for the reader: "off", "35%", "full". */
export const percent = (d: number) =>
	d <= 0 ? 'off' : d >= 1 ? 'full' : `${Math.round(d * 100)}%`;

const dimmer = (id: string, def: number, help = 'Or drag the knob under the bulb.'): Control => ({
	type: 'range',
	id,
	label: 'Dimmer',
	min: 0,
	max: 1,
	step: 0.01,
	default: def,
	format: percent,
	help
});

const round = Math.round;
/** "a seventh", "an eighth", "a fourteenth": one part in `k`. */
const part = (k: number) => {
	const words: Record<number, string> = {
		7: 'a seventh',
		8: 'an eighth',
		9: 'a ninth',
		10: 'a tenth',
		12: 'a twelfth',
		13: 'a thirteenth',
		14: 'a fourteenth',
		15: 'a fifteenth'
	};
	return words[k] ?? `one part in ${k}`;
};
/** A number the way it is said aloud: 2450 → "2,450". */
const n = (v: number) => v.toLocaleString('en-US');
const half = bulb(0.5);
const ledFull = led(FULL.lumens);
const hot = n(celsius(FULL.kelvin));
const heatTimes = round(FULL.heat / FULL.light);
const ir = round(infraredShare(FULL.kelvin) * 10);
const ledWatts = (round(ledFull.watts * 10) / 10).toFixed(1);
/** Per cent of the electricity that leaves as glow between violet and deep red, counted as plain energy. */
const visiblePercent = round((1 - infraredShare(FULL.kelvin)) * 100);
const ledShare = round(FULL.watts / ledFull.watts);
const ledHeatShare = round(FULL.heat / ledFull.heat);

const filament =
	'<dfn data-def="The thin coil of wire inside an old-style bulb that glows when electricity runs through it. It is made of tungsten.">filament</dfn>';
const tungsten =
	'<dfn data-def="A grey metal that melts at 3,422 °C, higher than any other metal, which is why it is used for the hot wire in light bulbs.">tungsten</dfn>';
const infrared =
	'<dfn data-def="Light just past the red end of the rainbow, too red for your eyes to see. You feel it as warmth on your skin, like the heat from a fire or a hot pan.">infrared</dfn>';
const ledWord =
	'<dfn data-def="Light-emitting diode: a tiny chip that turns electricity straight into light, without heating a wire until it glows. A white LED bulb has many of them.">LED</dfn>';

export const spec: ExplainerSpec = {
	slug: 'light-bulb-hot-wire',
	title: 'Why a light bulb glows (and gets hot)',
	summary:
		'Turn a dimmer up and watch the thin wire inside an old-style bulb glow dull red, orange, then white as it heats, and see where its electricity goes: a sliver of light and dozens of times as much heat, mostly invisible infrared. Then swap in an LED bulb: the same light from an eighth of the electricity.',
	chapters: [
		{ id: 'glow', title: 'A wire that glows' },
		{ id: 'heat', title: 'Where the electricity goes' },
		{ id: 'led', title: 'The LED' }
	],
	steps: [
		// ------------------------------------------------------------------ glow
		{
			id: 'bulb',
			chapter: 'glow',
			title: 'A wire that glows',
			scene: 'bulb',
			hints: { phase: 'bulb' },
			duration: 12,
			body: `
<p>Before LED bulbs, every lamp at home had an old-style light bulb: a glass ball with a tiny coil of wire inside. Flick the switch and the wire shines so brightly you can’t look at it. Touch the bulb after a minute and it is hot enough to burn your fingers.</p>
<p>Why does a wire make light at all? And why does it get so hot? This page follows the electricity into that wire, and out again.</p>`
		},
		{
			id: 'dimmer',
			chapter: 'glow',
			title: 'Turn it up: dark, red, orange, white',
			scene: 'bulb',
			hints: { phase: 'dimmer', control: 'up' },
			duration: 20,
			controls: [dimmer('up', 0)],
			body: `
<p>This bulb is on a <strong>dimmer</strong>, a knob that lets more or less electricity through. <strong>Turn it up slowly</strong> and watch the wire.</p>
<p>At first nothing seems to happen: the wire warms up but stays dark. At about <strong>${round((DRAPER - 273.15) / 25) * 25} °C</strong> it starts to glow a <strong>dull red</strong>, the way an electric hob or the embers of a fire glow. Hotter, it turns <strong>orange</strong>, then <strong>yellow</strong>, and at full it glows <strong>white</strong>, at about <strong>${hot} °C</strong>.</p>
<p>That is all a light bulb is: a wire heated until it glows. Anything hot enough glows the same way, and the colour tells you how hot it is.</p>`,
			notes: `<p>The colours on the screen are worked out from the glow itself: the light a glowing body gives at each temperature, seen through the CIE’s standard description of how eyes see colour (the CIE 1931 colour-matching functions, CC BY-SA 4.0, from cie.co.at). They are balanced so that the bulb at full looks white, as it does to eyes that have got used to its light; next to daylight it looks yellowish. A real wire starts to glow a little later than on the page, because it also loses some heat into its supports and the gas in the bulb.</p>`
		},
		{
			id: 'wire',
			chapter: 'glow',
			title: 'Why the wire gets so hot',
			scene: 'bulb',
			hints: { phase: 'wire' },
			duration: 20,
			body: `
<p>Look closer. The ${filament} is a coil of ${tungsten} wire, <strong>thinner than half a hair</strong>: about ${(WIRE_DIAMETER * 1000).toFixed(2)} mm across. Uncoiled, it would stretch about <strong>${round((WIRE_LENGTH * 100) / 10) * 10} cm</strong>. It is wound into a coil, and the coil into a coil again, to fit inside the bulb.</p>
<p>The electricity has to squeeze through all that thin wire. As it pushes through, it keeps bumping into the metal’s atoms and shakes them harder and harder. Shaking atoms are what “hot” means. The wire heats up until it gives the heat away as fast as the electricity puts it in, and at that temperature it stays.</p>
<p>The thick copper wires in the lamp’s cable carry the same electricity, but they let it through easily and hardly warm at all.</p>`,
			notes: `<p>The page’s bulb is a 60 W bulb for a 230 V socket. Its wire is worked out from measured properties of tungsten: how strongly it resists electricity and how well it glows at each temperature. Hot, the wire resists electricity about 14 times as strongly as it does cold, so a bulb takes a big gulp of electricity in the instant it is switched on.</p>`
		},
		{
			id: 'steep',
			chapter: 'glow',
			title: 'A little more, a lot brighter',
			scene: 'chart',
			hints: { phase: 'chart', control: 'half' },
			duration: 22,
			controls: [dimmer('half', 0.5, 'Or drag the marker along the dimmer.')],
			body: `
<p>You might expect the dimmer at half to give half the light. It doesn’t. <strong>Move the dimmer</strong> and compare the two lines: the electricity the bulb takes, and the light it gives, each against what it does at full.</p>
<p>At half, the bulb takes about <strong>a third of the electricity</strong>, but its wire is only at about ${n(celsius(half.kelvin))} °C, glowing ${glowName(half.kelvin)}, and gives just <strong>${part(round(FULL.lumens / half.lumens))} of the light</strong>.</p>
<p>The light shoots up near the top: a little more electricity makes the wire a little hotter, and a slightly hotter wire glows much more brightly, and whiter. The last tenth of the dimmer adds nearly a third of the bulb’s light.</p>`
		},
		// ------------------------------------------------------------------ heat
		{
			id: 'split',
			chapter: 'heat',
			title: 'Where the electricity goes',
			scene: 'bulb',
			hints: { phase: 'split', control: 'level' },
			duration: 20,
			controls: [dimmer('level', 1)],
			body: `
<p>Everything that goes into the bulb comes out again. The bar splits the electricity into the two things it turns into: <strong>light</strong> and <strong>heat</strong>.</p>
<p>At full, the bulb takes 60 watts. Counted the way your eyes judge brightness, only <strong>${FULL.light.toFixed(1)} watts</strong> of that is light. The other <strong>${round(FULL.heat)} watts</strong> come out as heat: the heat is <strong>${heatTimes} times</strong> the light.</p>
<p><strong>Turn the dimmer down</strong>: the light bar shrinks even faster than the heat. An old bulb is really a heater that gives off a little light.</p>`,
			notes: `<p>The light bar counts light the way your eye does: by how bright it looks. Each watt of it is a watt of the yellow-green light the eye sees best (683 lumens); the bulb at full gives about ${round(FULL.lumens / 10) * 10} lumens, like a real 60 W bulb. Counted as plain energy instead, several times more of the glow is light you can see, about ${visiblePercent} per cent of the electricity, but much of it is deep red that the eye sees only dimly. Either way, the heat is many times the light.</p>`
		},
		{
			id: 'infrared',
			chapter: 'heat',
			title: 'Heat you can feel but cannot see',
			scene: 'spectrum',
			hints: { phase: 'spectrum', control: 'glow' },
			duration: 22,
			controls: [dimmer('glow', 1, 'Or drag the knob.')],
			body: `
<p>Hold your hand near a bright old bulb and you feel warmth on your skin, even through the glass. Most of the bulb’s heat leaves as ${infrared}: a kind of light just past the red end of the rainbow, too red for your eyes to see.</p>
<p>The curve shows everything the glowing wire sends out, colour by colour. Only a small part of it falls in the rainbow of colours you can see; the rest, about <strong>${ir} tenths</strong> of all the electricity, goes out as invisible infrared.</p>
<p><strong>Turn the dimmer down</strong>: the cooler the wire, the further its glow slides into the infrared, and the less of it you can see.</p>`,
			notes: `<p>In a real bulb filled with gas, a little of the heat (roughly a tenth) is also carried away by the gas, which warms the glass. The page’s wire loses heat only by glowing.</p>`
		},
		{
			id: 'burn',
			chapter: 'heat',
			title: 'Why the wire doesn’t burn up',
			scene: 'bulb',
			hints: { phase: 'burn' },
			duration: 16,
			controls: [
				{
					type: 'toggle',
					id: 'air',
					label: 'Crack the glass and let air in',
					default: false,
					help: 'Switch it on and off: a new bulb each time.'
				}
			],
			body: `
<p>A wire at ${hot} °C, in air, would burn like a sparkler: the oxygen in the air would eat it away in a moment. So the bulb holds <strong>no air</strong>. Either it is empty inside, or it is filled with a gas such as argon that nothing can burn in.</p>
<p><strong>Crack the glass</strong> and see what air does to the hot wire: it burns to a puff of yellow smoke, snaps, and the light goes out.</p>
<p>Sealed away from air, the wire doesn’t burn, but it slowly boils away, a few atoms at a time. After about a <strong>thousand hours</strong> of light it has thinned somewhere until it snaps, often with a flash just as you switch it on.</p>`,
			notes: `<p>The smoke is tungsten trioxide, the yellow powder tungsten turns into when it burns. The atoms that boil off the wire settle on the inside of the glass, which is why old bulbs go grey.</p>`
		},
		// ------------------------------------------------------------------ led
		{
			id: 'led',
			chapter: 'led',
			title: 'Swap in an LED bulb',
			scene: 'bulb',
			hints: { phase: 'led' },
			duration: 22,
			controls: [
				{
					type: 'select',
					id: 'kind',
					label: 'Bulb',
					default: 'old',
					options: [
						{ value: 'old', label: 'Old-style bulb' },
						{ value: 'led', label: 'LED bulb' }
					]
				}
			],
			body: `
<p>An ${ledWord} bulb makes light a different way: tiny chips turn electricity straight into light, with no wire heated until it glows. <strong>Swap the bulbs</strong> and compare.</p>
<p>For the same light, the LED bulb takes about <strong>${ledWatts} watts</strong> instead of 60: about <strong>${part(ledShare)}</strong> of the electricity. Its heat bar shrinks to about <strong>${part(ledHeatShare)}</strong>.</p>
<p>But an LED is not cold. It still turns more of its electricity into heat than into light. That heat doesn’t shine out as infrared: it warms the chips and the bulb’s base, which has fins or a metal body to let it escape. Feel an LED bulb that has been on a while: the glass is cool, the base is warm.</p>`,
			notes: `<p>The LED bulb is a typical one today, giving ${LED_EFFICACY} lumens for each watt of electricity (an 806-lumen bulb on 8 W). Counted as plain energy rather than by how bright it looks, about a third of a good white LED bulb’s electricity leaves as light and two thirds as heat.</p>`
		},
		{
			id: 'next',
			chapter: 'led',
			title: 'Read next',
			scene: 'bulb',
			hints: { phase: 'next' },
			duration: 12,
			body: `
<p>An old bulb makes light by heating a wire until it glows white, and wastes nearly all its electricity as heat. An LED makes the same light from about an eighth of the electricity, so far less heat.</p>
<p>The page on <a href="../electric-circuits/">electric circuits</a> follows the electricity round the wires to the bulb and back, with batteries, switches and meters. The page on <a href="../light-optics/">light and optics</a> shows what light is and how it bends, splits into colours and makes pictures.</p>`
		}
	]
};
