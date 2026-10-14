import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { TARGETS } from './colour';

// Every number quoted in the text comes from the two models and is checked in
// e2e/vision-color-model.e2e.ts: eye.ts (the Gullstrand–Emsley schematic eye, traced
// paraxially) and colour.ts (the Stockman & Sharpe 2° cone fundamentals from CVRL).

/** The colour name of a wavelength, as in the light-optics explainer. */
export function colourName(nm: number): string {
	if (nm < 450) return 'violet';
	if (nm < 490) return 'blue';
	if (nm < 520) return 'cyan';
	if (nm < 565) return 'green';
	if (nm < 590) return 'yellow';
	if (nm < 625) return 'orange';
	return 'red';
}

const distanceText = (v: number) => (v <= 0 ? 'far away' : `${Math.round(100 / v)} cm`);

const near: Control = {
	type: 'range',
	id: 'near',
	label: 'How close the object is',
	min: 0,
	max: 10,
	step: 0.25,
	default: 0,
	format: distanceText,
	help: 'Or drag the object. The slider moves in equal steps of dioptres (1 ÷ distance in metres).'
};

const shape: Control = {
	type: 'range',
	id: 'shape',
	label: 'Shape of the lens',
	min: 0,
	max: 1,
	step: 0.01,
	default: 0,
	format: (v) =>
		v <= 0 ? 'relaxed (flattest)' : v >= 1 ? 'fully rounded' : `${Math.round(v * 100)}% rounded`,
	help: 'Or drag the handle on top of the lens.'
};

const water: Control = {
	type: 'toggle',
	id: 'water',
	label: 'Open the eye under water',
	default: false
};

const glassesText = (v: number) =>
	v === 0 ? 'none' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} D`;
const glasses = (id: string): Control => ({
	type: 'range',
	id,
	label: 'Glasses',
	min: -6,
	max: 6,
	step: 0.25,
	default: 0,
	format: glassesText,
	help: 'Negative: a diverging lens (thinner in the middle). Positive: a converging one.'
});

const nm: Control = {
	type: 'range',
	id: 'nm',
	label: 'Wavelength of the light',
	min: 390,
	max: 700,
	step: 1,
	default: 580,
	format: (v) => `${v} nm, ${colourName(v)}`,
	help: 'Or drag the line across the chart.'
};

const cone: Control = {
	type: 'select',
	id: 'cone',
	label: 'The eye has',
	default: 'M',
	options: [
		{ value: 'L', label: 'only L cones' },
		{ value: 'M', label: 'only M cones' },
		{ value: 'S', label: 'only S cones' },
		{ value: 'all', label: 'all three kinds' }
	]
};

const nmB: Control = {
	type: 'range',
	id: 'nmB',
	label: 'Right lamp: wavelength',
	min: 400,
	max: 680,
	step: 1,
	default: 500,
	format: (v) => `${v} nm, ${colourName(v)}`
};

const powerB: Control = {
	type: 'range',
	id: 'powerB',
	label: 'Right lamp: brightness',
	min: 0,
	max: 3,
	step: 0.01,
	default: 1,
	format: (v) => `× ${v.toFixed(2)}`
};

const target: Control = {
	type: 'select',
	id: 'target',
	label: 'Light to match',
	default: 'sodium',
	options: TARGETS.map((t) => ({ value: t.id, label: t.label }))
};

const laser = (id: string, name: string, nmText: string): Control => ({
	type: 'range',
	id,
	label: `${name} laser (${nmText})`,
	min: 0,
	max: 1,
	step: 0.01,
	default: 0,
	format: (v) => v.toFixed(2)
});
const lasers = [
	laser('r', 'Red', '630 nm'),
	laser('g', 'Green', '532 nm'),
	laser('b', 'Blue', '467 nm')
];

const grey: Control = {
	type: 'toggle',
	id: 'grey',
	label: 'Switch to the grey screen now',
	default: false,
	help: 'Otherwise it switches by itself after 20 seconds.'
};

const illusion: Control = {
	type: 'select',
	id: 'illusion',
	label: 'Illusion',
	default: 'contrast',
	options: [
		{ value: 'contrast', label: 'Two greys on a gradient' },
		{ value: 'shadow', label: 'A shadow on a chessboard' },
		{ value: 'colour', label: 'One colour, two surroundings' }
	]
};

const reveal: Control = {
	type: 'toggle',
	id: 'reveal',
	label: 'Reveal the trick',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'vision-color',
	title: 'Vision and colour',
	summary:
		'Focus an eye on near and far things by changing the shape of its lens, fit glasses to a blurry eye, then mix red, green and blue light to match a colour while three kinds of cone report what they see.',
	chapters: [
		{ id: 'camera', title: 'The eye is a camera' },
		{ id: 'focus', title: 'Focusing, and glasses' },
		{ id: 'cones', title: 'Three kinds of sensor' },
		{ id: 'mixing', title: 'Mixing light' },
		{ id: 'brain', title: 'The brain builds colour' }
	],
	steps: [
		// ------------------------------------------------------------------ camera
		{
			id: 'eye',
			chapter: 'camera',
			title: 'The eye makes a picture, like a camera',
			scene: 'eye',
			hints: { phase: 'intro' },
			duration: 22,
			body: `
<p>Your eye is a ball about 24 mm across, filled with clear jelly. Light gets in through a clear window at the front, the <dfn data-def="The clear, curved front of the eye. It bends light more than any other part.">cornea</dfn>, then through a hole, the <dfn data-def="The opening in the coloured iris. It narrows in bright light and widens in the dark.">pupil</dfn>, then through the <dfn data-def="A clear, flexible lens just behind the pupil. Muscles change its shape to focus.">lens</dfn>. At the back it lands on the <dfn data-def="The thin layer of light-sensitive cells lining the back of the eye.">retina</dfn>, a layer of light-sensitive cells.</p>
<p>The cornea and the lens work together as one converging lens. As you saw in <a href="../light-optics/#image">light and optics</a>, such a lens gathers the light spreading out from each point of an object and brings it back together at one point, so the whole object makes an <strong>image</strong>. In the eye that image falls on the retina. The cells there turn it into nerve signals and the <dfn data-def="The bundle of about a million nerve fibres that carries signals from the retina to the brain.">optic nerve</dfn> carries them to the brain.</p>
<p>Follow the rays from the top of the arrow: they cross and land <strong>below</strong> the axis. The picture on your retina is upside down, exactly as in a camera. The brain learns to read it the right way up.</p>`,
			notes: `<p>The eye drawn here is the Gullstrand–Emsley schematic eye, a standard model in optometry: a cornea of radius 7.8 mm, a lens of refractive index 1.416, clear fluids of index 4/3 and a length of 23.9 mm. The rays are traced through its three curved surfaces with the small-angle form of Snell's law. Real corneas and lenses are not perfect spheres, and the lens's index varies from its core to its edge.</p>`
		},
		{
			id: 'cornea',
			chapter: 'camera',
			title: 'The cornea does most of the bending',
			scene: 'eye',
			hints: { phase: 'cornea' },
			duration: 22,
			controls: [water],
			body: `
<p>Opticians measure how strongly a lens bends light by its <dfn data-def="How strongly a lens bends light: 1 ÷ its focal length in metres. A lens with a focal length of 50 cm has a power of 2 dioptres.">power</dfn>, in <dfn data-def="The unit of lens power: 1 ÷ focal length in metres.">dioptres</dfn> (D): 1 ÷ the focal length in metres. Glasses are usually between −6 and +6 D. The whole eye is about <strong>60.5 D</strong>, a focal length of under 2 cm.</p>
<p>Surprisingly, the lens isn't where most of that comes from. Light bends at a surface where its speed changes, and the biggest change is from air into the cornea: the <strong>cornea</strong> alone is <strong>42.7 D</strong>, about two-thirds of the eye's power. The lens sits between fluids that slow light almost as much as it does, so it bends light less; on its own it is about 21.8 D.</p>
<p>Open the eye under water. Water slows light just as much as the eye's fluids, so light crosses the cornea without bending. The eye loses most of its power, and everything is hopelessly blurred, focused far behind the retina. That's why swimming goggles help: they put air back in front of your cornea.</p>`,
			notes: `<p>The powers of the parts don't simply add up (42.7 + 21.8 is more than 60.5) because the lens sits 3.6 mm behind the cornea, where the light is already converging. Fish, which live in water, have nearly spherical lenses of high index that do all of their focusing. Diving birds and seals have their own tricks for seeing both in air and under water.</p>`
		},
		// ------------------------------------------------------------------ focus
		{
			id: 'focus',
			chapter: 'focus',
			title: 'Focusing: the lens changes shape',
			scene: 'eye',
			hints: { phase: 'focus' },
			duration: 30,
			controls: [near, shape],
			body: `
<p>A camera focuses by moving its lens. Your eye can't do that: it changes the <em>shape</em> of its lens instead.</p>
<p>Light from a distant object arrives in nearly parallel rays, and the relaxed eye focuses it right on the retina. Now bring the object closer. Its light arrives spreading out, and the relaxed eye brings it together <strong>behind</strong> the retina: on the retina each point is a blurry disc. The inset shows what the eye sees.</p>
<p>Make the lens rounder. A small ring of muscle around the lens tightens, the fibres that hold the lens slacken, and the lens, which is elastic, bulges. More curved surfaces bend light more (the lensmaker's equation from <a href="../light-optics/#lens">light and optics</a>), so the focus moves forward onto the retina. This is <dfn data-def="The eye's way of focusing on near objects: making its lens rounder and stronger.">accommodation</dfn>. Find the right shape for each distance.</p>
<p>Fully rounded, this lens adds 9.2 D, and the eye can focus as close as about <strong>12 cm</strong>. Anything nearer stays blurred.</p>`,
			notes: `<p>The lens can't stay rounded for free: the muscle has to keep working, which is why reading for hours tires the eyes. With age the lens stiffens and rounds less. A typical ten-year-old can add about 15 D, a forty-year-old about 6 D, and a sixty-year-old almost none (Hofstetter's average, 18.5 − 0.3 × age). In the mid-forties the near point passes arm's length, and people need reading glasses: this is <em>presbyopia</em>. The blur in the inset is drawn with the eye's real geometry (the blur disc is the pupil's width, 5 mm here, times the error in dioptres), smoothed into a soft blur.</p>`
		},
		{
			id: 'short',
			chapter: 'focus',
			title: 'Short sight: an eye that is too long',
			scene: 'eye',
			hints: { phase: 'short' },
			duration: 30,
			controls: [near, shape, glasses('glassesShort')],
			body: `
<p>This eye is 25.0 mm long, 1.1 mm longer than the last one. Light from a distant object comes to a focus <strong>in front of</strong> the retina, and has spread out again by the time it lands. Making the lens rounder only makes it worse, and the lens can't get any flatter than relaxed. Far things are blurred.</p>
<p>Bring the object closer: its spreading light focuses further back, and at about 35 cm it is sharp. Near things are fine. This is <dfn data-def="Blurred distance vision, usually because the eye is too long for its lens and cornea. Also called myopia.">short sight</dfn> (myopia).</p>
<p>Now try glasses. A <dfn data-def="A lens thinner in the middle than at the edge, with a negative power. It spreads light out.">diverging lens</dfn> (negative power) spreads the light a little before it reaches the eye, as if it came from a nearer object, so the focus moves back onto the retina. Find the power that makes a distant object sharp with the lens relaxed.</p>`,
			notes: `<p>This eye needs −3.00 D glasses, worn 12 mm in front of the cornea. Each extra millimetre of eye length adds roughly −2.7 D of short sight. Most short sight is of this kind: the eyeball grows a little too long during childhood. It has become far more common in the last fifty years; time spent outdoors in daylight seems to protect children's eyes. Contact lenses work the same way as glasses, sitting on the cornea itself, and laser surgery reshapes the cornea so that it bends light less.</p>`
		},
		{
			id: 'long',
			chapter: 'focus',
			title: 'Long sight: an eye that is too short',
			scene: 'eye',
			hints: { phase: 'long' },
			duration: 30,
			controls: [near, shape, glasses('glassesLong')],
			body: `
<p>This eye is 22.5 mm long, 1.4 mm too short. Relaxed, it focuses even distant light <strong>behind</strong> the retina. But a young lens can round up: try it, and distant things come sharp. The eye is using some of its focusing range just to see far away.</p>
<p>That leaves less for near things. Bring the object to 20 cm, the distance you hold a phone or a book, and round the lens fully: it isn't enough. The nearest this eye can focus is about 24 cm. This is <dfn data-def="Blurred near vision, usually because the eye is too short for its lens and cornea. Also called hyperopia.">long sight</dfn> (hyperopia).</p>
<p>A <dfn data-def="A lens thicker in the middle than at the edge, with a positive power. It brings light together.">converging lens</dfn> adds the missing power. Find the glasses that let the relaxed eye see far away sharply; then check how close it can focus now.</p>`,
			notes: `<p>This eye needs +4.00 D glasses, and with them it can focus as close as about 13 cm again. Many children are a little long-sighted and never notice, because their lenses make up for it; it shows up later, as the lens stiffens with age. Reading glasses for presbyopia are converging lenses too, but for a different reason: there the eye is the right length and the lens can no longer round up.</p>`
		},
		// ------------------------------------------------------------------ cones
		{
			id: 'cones',
			chapter: 'cones',
			title: 'Three kinds of cone',
			scene: 'cones',
			hints: { phase: 'curves' },
			duration: 30,
			controls: [nm],
			body: `
<p>The retina has two kinds of light-sensitive cell. About 92 million <dfn data-def="Very sensitive cells of the retina that work in dim light. There is only one kind, so they can't tell colours apart.">rods</dfn> work in dim light. About 4.6 million <dfn data-def="Cells of the retina that work in daylight. There are three kinds, each most sensitive to a different range of wavelengths.">cones</dfn>, packed most tightly at the centre of your gaze, work in daylight, and they come in <strong>three kinds</strong>.</p>
<p>Each kind contains a pigment that catches some wavelengths of light better than others. The chart shows their measured sensitivities. They are called by where they peak: <strong class="tag cone-l">L</strong> (long wavelengths, peak at 570 nm), <strong class="tag cone-m">M</strong> (medium, 543 nm) and <strong class="tag cone-s">S</strong> (short, 442 nm).</p>
<p>Drag the line across the spectrum. Light of any one wavelength makes each kind of cone respond by a different amount, and the bars show the three signals. Notice that L peaks in the yellow-green, not the red, and that L and M overlap almost everywhere. Red light isn't seen by "red cones": it is light that excites L clearly more than M.</p>`,
			notes: `<p>The curves are the Stockman and Sharpe (2000) cone fundamentals for a 2° field, adopted by the CIE in 2006, from the Colour &amp; Vision Research Laboratory at UCL. Each is normalised to a peak of 1 and given for equal energy at each wavelength; how strongly each kind of cone signals in absolute terms is set elsewhere in the eye, and cancels out of colour. People differ: the L:M ratio ranges from about 1:1 to over 10:1 between people with normal colour vision, and S cones are only about 5–10% of all cones. The cell counts are from Curcio and colleagues (1990).</p>`
		},
		{
			id: 'one-cone',
			chapter: 'cones',
			title: 'One kind of sensor is colour-blind',
			scene: 'cones',
			hints: { phase: 'one' },
			duration: 30,
			controls: [cone, nmB, powerB],
			body: `
<p>A cone does one thing: it catches light and signals how much it caught. Its signal says nothing about the wavelength. Bright light at a wavelength it is bad at gives the same signal as dim light at one it is good at.</p>
<p>Here an eye with only M cones looks at two lamps. The left one is fixed: 600 nm, orange. Change the right lamp's colour and brightness until its signal matches the left one's. To this eye the two lamps are now <strong>identical</strong>: it sees one shade of grey, a little brighter or darker, and nothing else. Almost any colour can be matched this way, just by adjusting the brightness.</p>
<p>That is what happens to you at night, when only the rods are working: there is one kind of rod, so moonlit scenes have no colour. Now switch to all three kinds of cone. The two lamps you matched look different again, because the other two kinds of cone respond to them differently.</p>`,
			notes: `<p>This is the <em>principle of univariance</em> (William Rushton, 1972): a photoreceptor's output depends only on how many photons it absorbs, not on their wavelength. About 8% of men and 0.5% of women of European descent have red–green colour deficiency: one of their L or M pigments is missing or shifted, so they have two working kinds of cone instead of three, and some pairs of colours that differ for everyone else look the same to them.</p>`
		},
		// ------------------------------------------------------------------ mixing
		{
			id: 'match',
			chapter: 'mixing',
			title: 'Mix three lights to match any colour',
			scene: 'match',
			hints: { phase: 'match' },
			duration: 40,
			controls: [target, ...lasers],
			body: `
<p>Three kinds of cone means the brain gets just <strong>three numbers</strong> for each point of the image. So any two lights that give the same three numbers must look the same, however different they are.</p>
<p>Test it. On the left is a sodium street lamp, whose light is a single wavelength, 589 nm. On the right, mix three lasers: red (630 nm), green (532 nm) and blue (467 nm). The bars compare the cone signals of the two sides. Get all three pairs of bars level and the two patches turn into the same colour, although the lamp's spectrum and the mix's have no wavelength in common.</p>
<p>Red and green light make yellow: not because yellow is "between" red and green in the light, but because the mix excites L and M in the same proportion as yellow light does. Try the other lights. Sunlight, which contains every wavelength, is matched by just three.</p>`,
			notes: `<p>Two lights that look identical but have different spectra are called <em>metamers</em>. The sodium match is within 0.3%: the green laser excites the S cones very slightly, and the lamp doesn't at all. Matching it exactly needs a negative amount of blue, which in a real experiment means shining a little blue light onto the lamp's side. That is how William Wright and John Guild measured colour matching in 1928–31 with volunteers, and their results became the CIE's 1931 standard for colour. The screen can only show the nearest colour it can make, so the two patches here are the right colours relative to each other, not exactly the colours of the real lights.</p>`
		},
		{
			id: 'screens',
			chapter: 'mixing',
			title: 'Your screen is three lights',
			scene: 'match',
			hints: { phase: 'screens' },
			duration: 30,
			controls: [target, ...lasers],
			body: `
<p>This is the trick every screen uses. Look closely at a phone or a monitor and each pixel is three tiny lights, red, green and blue. They never make yellow light, or orange, or white: they make light that stimulates your cones the way yellow, orange or white light would.</p>
<p>Three lights can't match everything, though. Pick the blue-green 490 nm laser and try. The green laser that the mix needs also excites the L cones more than the target does, and there is no way to take some red away. The best mix is always paler than the target. Every screen has colours it can't show, and the pure colours of the spectrum are the hardest.</p>
<p>A camera works like the eye too: its sensor has red, green and blue filters over its pixels, so it also turns each point of the picture into three numbers.</p>`,
			notes: `<p>The three lasers here are the primary colours of the ITU-R BT.2020 standard for ultra-high-definition television, chosen as pure wavelengths so that they can show more colours than any older standard. Ordinary screens use broader, less saturated primaries and show fewer still. Printing works differently: inks absorb light, so mixing cyan, magenta and yellow ink takes colours away from white paper, but the end result again only has to match the three cone signals.</p>`
		},
		// ------------------------------------------------------------------ brain
		{
			id: 'opponent',
			chapter: 'brain',
			title: 'The brain compares the cones',
			scene: 'pipeline',
			hints: { phase: 'opponent' },
			duration: 30,
			controls: [nm],
			body: `
<p>The three signals don't go to the brain as they are. Already in the retina, nerve cells start <strong>comparing</strong> them. One channel adds L and M: how bright. One weighs L against M: reddish or greenish. One weighs S against L and M together: bluish or yellowish.</p>
<p>Change the wavelength and watch the three channels. Red light pushes red–green one way, green light the other. Yellow light is near neutral on red–green and far over on the yellow side. These are <dfn data-def="Pairs of colours that are signalled as two ends of one channel: red against green, blue against yellow.">opponent colours</dfn>: a colour can be reddish-yellow (orange) or bluish-green (teal), but never reddish-green or yellowish-blue, because each pair shares one channel.</p>`,
			notes: `<p>Ewald Hering proposed opponent colours in 1878 from how colours look; the cells that do it were found in the 1950s and 60s. The channels here are built from the cone signals with weights that make white neutral (equal energy at every wavelength); the real circuits of the retina and brain are more complicated, but follow the same plan. These cone-comparing channels also don't line up exactly with the colours we name: the blue that looks neither reddish nor greenish to most people, near 475 nm, still reads a little green here.</p>`
		},
		{
			id: 'afterimage',
			chapter: 'brain',
			title: 'Tired cones: afterimages',
			scene: 'afterimage',
			duration: 36,
			controls: [grey],
			body: `
<p>Stare at the small cross in the middle of the picture, without moving your eyes, for 20 seconds. Then the picture switches to plain grey. Keep looking at the cross.</p>
<p>You should see the picture again, in the <strong>opposite</strong> colours: the cyan disc turns reddish, the yellow one bluish, the magenta one greenish. While you stared, the cones under each coloured part kept firing and slowly turned their sensitivity down. When the grey comes, those cones respond less than their neighbours, so the comparison tips the other way along each opponent channel.</p>
<p>The bottom row shows the colours a simple model of this tiring predicts for the grey after the stare.</p>`,
			notes: `<p>The model is von Kries adaptation (1902): each kind of cone turns its sensitivity down in proportion to how strongly it has been stimulated. The same adjustment, happening all the time across the whole retina, is what lets a white page look white both under yellowish lamp light and bluish daylight.</p>`
		},
		{
			id: 'illusions',
			chapter: 'brain',
			title: 'Colour depends on the surroundings',
			scene: 'illusion',
			duration: 40,
			controls: [illusion, reveal],
			body: `
<p>If colour were just the three cone signals at each point, two patches sending the same light would always look the same. They don't. Try these, then reveal the trick.</p>
<ul>
<li><strong>Two greys on a gradient.</strong> The two squares are exactly the same grey. The one on the dark side looks lighter: the brain judges each patch against its surroundings.</li>
<li><strong>A shadow on a chessboard.</strong> The squares marked A and B send exactly the same light to your eye. B looks light because the brain knows it is in shadow, and works out what colour the square must be.</li>
<li><strong>One colour, two surroundings.</strong> The two small squares are the same colour. Against blue it looks warmer, against yellow cooler.</li>
</ul>
<p>The brain isn't measuring light. It is working out what the world is like, and these pictures fool it.</p>`,
			notes: `<p>The chessboard illusion here is drawn after Edward Adelson's famous checker-shadow illusion (1995). This kind of judgement is called <em>colour constancy</em>: a banana looks yellow in morning light, at noon and under a lamp, although the light reaching your eye from it changes a great deal. The famous photo of "the dress" (2015), seen by some people as blue and black and by others as white and gold, is thought to come from people's brains making different guesses about the lighting.</p>`
		},
		{
			id: 'summary',
			chapter: 'brain',
			title: 'From light to colour',
			scene: 'pipeline',
			hints: { phase: 'summary' },
			duration: 30,
			controls: [nm],
			body: `
<p>Follow it all the way through. The cornea and lens form a picture on the retina, like a camera. At each point of the picture three kinds of cone each report one number. The brain compares the three, against each other and against the surroundings, and builds the colour you see.</p>
<p>Colour isn't in the light. Light only has wavelengths; a single wavelength isn't "yellow" until an eye with three kinds of cone and a brain make it so. Another animal, with different cones, would see the same light differently: bees see ultraviolet, many birds have four kinds of cone, and most mammals, like dogs, have two.</p>
<p><strong>The eye forms an image like a camera, but colour is constructed by the brain from the signals of just three kinds of sensor.</strong></p>`
		}
	]
};
