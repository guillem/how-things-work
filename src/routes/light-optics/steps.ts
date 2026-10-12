import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { colourName } from './optics';

// Every number quoted in the text is computed by optics.ts from the sourced
// refractive indices there (SCHOTT N-BK7 and N-SF11, Daimon & Masumura 2007 for
// water, Malitson 1965 for fused silica, Peter 1923 for diamond), and checked
// in e2e/light-optics-model.e2e.ts. The critical angles in the TIR step are for
// the rounded indices on the slider (1.33, 1.52, 2.42), as the scene shows them.

/** Named materials on the index slider (n at 589 nm, from optics.ts). */
const MARKS: [number, string][] = [
	[1, 'air'],
	[1.33, 'water'],
	[1.46, 'silica'],
	[1.52, 'crown glass'],
	[1.78, 'flint glass'],
	[2.42, 'diamond']
];
const indexText = (v: number) => {
	const m = MARKS.find(([n]) => Math.abs(n - v) < 0.005);
	return m ? `${v.toFixed(2)} (${m[1]})` : v.toFixed(2);
};

const n: Control = {
	type: 'range',
	id: 'n',
	label: 'Refractive index of the material',
	min: 1,
	max: 2.42,
	step: 0.01,
	default: 1.52,
	format: indexText,
	help: 'Water 1.33, crown glass 1.52, flint glass 1.78, diamond 2.42.'
};

const angle: Control = {
	type: 'range',
	id: 'angle',
	label: 'Angle of the light (from the normal)',
	min: 0,
	max: 85,
	step: 1,
	default: 40,
	unit: '°',
	help: 'You can also drag the lamp.'
};

const inside: Control = {
	type: 'range',
	id: 'inside',
	label: 'Angle inside the material',
	min: 0,
	max: 85,
	step: 0.5,
	default: 30,
	unit: '°',
	help: 'You can also drag the lamp.'
};

const mirrorTurn: Control = {
	type: 'range',
	id: 'mirror',
	label: 'Turn the mirror',
	min: -40,
	max: 40,
	step: 1,
	default: 0,
	unit: '°',
	help: 'Or drag the round handle at its end. Drag the lamp to move it.'
};

const bend: Control = {
	type: 'range',
	id: 'bend',
	label: 'Bend radius',
	min: 5,
	max: 220,
	step: 1,
	default: 160,
	format: (v) => `${(v / 40).toFixed(1)} × the fibre's width`,
	help: 'The radius of the inside of the bend.'
};

const entry: Control = {
	type: 'range',
	id: 'entry',
	label: 'Angle of the light entering the end',
	min: 0,
	max: 60,
	step: 1,
	default: 25,
	unit: '°',
	help: 'You can also drag the lamp.'
};

const radius: Control = {
	type: 'range',
	id: 'radius',
	label: 'Curvature of the faces (radius)',
	min: 150,
	max: 500,
	step: 5,
	default: 300,
	format: (v) => `${v / 2} mm`,
	help: 'A smaller radius means more strongly curved faces.'
};

const lensType: Control = {
	type: 'select',
	id: 'lens',
	label: 'Lens',
	default: 'convex',
	options: [
		{ value: 'convex', label: 'Converging' },
		{ value: 'concave', label: 'Diverging' }
	]
};

const distance: Control = {
	type: 'range',
	id: 'u',
	label: 'Distance from the object to the lens',
	min: 90,
	max: 440,
	step: 1,
	default: 400,
	format: (v) => `${v / 2} mm`,
	help: 'You can also drag the object.'
};

const material: Control = {
	type: 'select',
	id: 'material',
	label: 'Material',
	default: 'flint',
	options: [
		{ value: 'water', label: 'Water' },
		{ value: 'crown', label: 'Crown glass' },
		{ value: 'flint', label: 'Flint glass' },
		{ value: 'diamond', label: 'Diamond' }
	]
};

const white: Control = {
	type: 'toggle',
	id: 'white',
	label: 'White light (all colours)',
	default: true
};

const wavelength: Control = {
	type: 'range',
	id: 'nm',
	label: 'Colour (when not white)',
	min: 400,
	max: 700,
	step: 5,
	default: 650,
	format: (v) => `${v} nm, ${colourName(v)}`
};

const reset: Control = {
	type: 'action',
	id: 'reset',
	label: 'Bench',
	action: '↺ Put everything back'
};

export const spec: ExplainerSpec = {
	slug: 'light-optics',
	title: 'Light and optics',
	summary:
		'Bounce light off mirrors, bend it into glass, trap it inside a fibre, focus it with a lens and split it into a rainbow, all on an optical bench you can rearrange.',
	chapters: [
		{ id: 'rays', title: 'Rays and mirrors' },
		{ id: 'bending', title: 'Bending at a boundary' },
		{ id: 'lenses', title: 'Lenses' },
		{ id: 'colour', title: 'Colour' },
		{ id: 'bench', title: 'Your own optical bench' }
	],
	steps: [
		// ------------------------------------------------------------------ rays
		{
			id: 'mirror',
			chapter: 'rays',
			title: 'Light travels in straight lines, and bounces evenly',
			scene: 'bench',
			hints: { phase: 'mirror' },
			duration: 18,
			controls: [mirrorTurn],
			body: `
<p>Light is a wave, an electromagnetic one, but its wavelength is tiny: about half a thousandth of a millimetre. On the scale of lamps and mirrors it simply goes in straight lines, and we can follow it as a <dfn data-def="A line showing the direction in which light travels. It is at right angles to the wave's crests.">ray</dfn>.</p>
<p>When a ray hits a mirror it bounces. Draw the <dfn data-def="A line at right angles to a surface, at the point where a ray meets it. Angles in optics are measured from it, not from the surface.">normal</dfn>, the dashed line at right angles to the mirror, and measure angles from it: the ray leaves at <strong>exactly the angle it arrived at</strong>, on the other side of the normal.</p>
<p class="formula"><strong>angle of reflection = angle of incidence</strong></p>
<p>Drag the lamp and turn the mirror: the two angles stay equal. The dots running along the ray are pulses of light, so you can see which way it goes and how fast; keep an eye on their speed.</p>`,
			notes: `<p>The pulses are slowed down enormously: light goes to the Moon and back, 770,000 km, in about 2.6 seconds. A page of a book reflects light too, but its rough surface has normals pointing every which way, so the light scatters in all directions. That's why you can see the page from anywhere but only see yourself in a smooth mirror.</p>`
		},
		// ------------------------------------------------------------------ bending
		{
			id: 'slower',
			chapter: 'bending',
			title: 'Light is slower in glass, and that turns it',
			scene: 'wavefront',
			duration: 22,
			controls: [n, angle],
			body: `
<p>In empty space light travels at 299,792 km/s, a speed called <em>c</em>. In a material it goes slower: in water at about 225,000 km/s, in ordinary glass at about 197,000. The ratio is the material's <dfn data-def="How many times slower light travels in a material than in empty space: n = c ÷ v. Water 1.33, glass about 1.5, diamond 2.42.">refractive index</dfn>:</p>
<p class="formula"><strong>n = c ÷ (speed in the material)</strong></p>
<p>The lines are the crests of the light wave, as in the ripple tank. The wave keeps its frequency when it crosses into the glass (the crests arrive at the boundary as often as they leave it), so by <em>v = f·λ</em> slower crests come closer together: the wavelength shrinks to λ ÷ n.</p>
<p>Now watch a crest arriving at an angle. One end reaches the glass first and slows down first, while the other end is still racing through the air, so the crest <strong>swivels</strong>, like a line of marchers stepping from a road into mud. The ray, at right angles to the crests, turns towards the normal. Light changes direction <em>because</em> its speed changes.</p>`,
			notes: `<p>Light slows down in matter because its electric field shakes the electrons in the material, and each shaken electron sends out a little wave of its own; the sum of the original wave and all these is a wave that moves slower than c. The colour of light is fixed by its frequency, which doesn't change, so the light inside the glass is the same colour as outside. Air has n = 1.0003, close enough to 1 for this explainer. Straight at the boundary (0°) the whole crest arrives at once: the light slows down but does not turn.</p>`
		},
		{
			id: 'snell',
			chapter: 'bending',
			title: "Snell's law: how much the light turns",
			scene: 'interface',
			hints: { phase: 'snell' },
			duration: 22,
			controls: [n, angle],
			body: `
<p>Drag the lamp around and measure both angles from the normal. They are not proportional, but their <em>sines</em> are, and the ratio is the ratio of the speeds:</p>
<p class="formula"><strong>n₁ · sin θ₁ = n₂ · sin θ₂</strong></p>
<p>This is <dfn data-def="The law of refraction: n₁ sin θ₁ = n₂ sin θ₂, with angles measured from the normal. Found by Ibn Sahl in Baghdad around 984 and again by Willebrord Snell in 1621.">Snell's law</dfn>. Going from air (n₁ = 1) into crown glass (n₂ = 1.52) at 40°, sin θ₂ = sin 40° ÷ 1.52, so the light continues at 25° in the glass. Raise the index and the light bends more; set it to 1.00 and the "glass" is just more air, and nothing bends.</p>
<p>Not all the light goes in. A little bounces off, following the mirror rule: about 4% for glass straight on, much more when the light only grazes the surface. That's the reflection you see in a shop window.</p>`,
			notes: `<p>Snell's law follows from the crests of the last step: along the boundary the crests above and below must match up, so λ₁ ÷ sin θ₁ = λ₂ ÷ sin θ₂, and λ is proportional to 1/n. The share reflected comes from the Fresnel equations (for unpolarised light); the faint ray's brightness follows them. It makes no difference which way the light goes: run any ray backwards and it retraces its path.</p>`
		},
		{
			id: 'tir',
			chapter: 'bending',
			title: 'Total internal reflection',
			scene: 'interface',
			hints: { phase: 'tir' },
			duration: 22,
			controls: [n, inside],
			body: `
<p>Now the lamp is inside the glass, shining up into air. Leaving the glass, light speeds up and bends <em>away</em> from the normal, so the angle outside is bigger than the angle inside. Drag the lamp further from the normal and the ray outside swings down towards the surface…</p>
<p>…until it lies flat along it, at 90°. Beyond that, sin θ₂ would have to be more than 1: there is no way out, and <strong>all</strong> the light is reflected back into the glass. This is <dfn data-def="The complete reflection of light trying to leave a material for one where it travels faster, when it meets the boundary beyond the critical angle.">total internal reflection</dfn>. It starts at the <dfn data-def="The angle of incidence beyond which light cannot leave a material: sin θc = n₂ ÷ n₁.">critical angle</dfn>, where sin θc = 1 ÷ n:</p>
<ul>
<li>water (1.33): 48.8°</li>
<li>crown glass (1.52): 41.1°</li>
<li>diamond (2.42): 24.4°</li>
</ul>
<p>Watch the reflected ray as you approach the critical angle: it brightens smoothly from a few per cent to all of it. A diamond's tiny critical angle traps light that enters it, bouncing it around inside until it comes out of the top. That's the sparkle.</p>`,
			notes: `<p>"Total" is meant literally: a glass prism used this way reflects better than any silvered mirror, which is why binoculars and periscopes use prisms. Look up at the surface from under water and you'll see it: beyond about 49° from straight up, the surface becomes a mirror.</p>`
		},
		{
			id: 'fibre',
			chapter: 'bending',
			title: 'Optical fibre: light in a pipe',
			scene: 'fibre',
			duration: 24,
			controls: [entry, bend],
			body: `
<p>An <dfn data-def="A thin strand of very pure glass that guides light along its length by total internal reflection.">optical fibre</dfn> is a strand of very pure glass. Light that enters one end meets the side wall at a slanting angle, well beyond the critical angle (between 54° and 90° here, against 43° for fused silica), so it is totally reflected, crosses to the other wall, is reflected again, and zig-zags along. The fibre can curve and the light follows.</p>
<p>Bend it too tightly, though, and the light meets the outside of the bend more nearly head-on, at an angle from the normal smaller than the critical one. Some of it gets out at each bounce, and the fibre leaks. The readout shows how much of the light reaches the far end.</p>
<p>Fibres carry the internet. A pulse of infrared light sent down a fibre still has half its power after more than 15 km, and the cables under the oceans carry most of the data between continents.</p>`,
			notes: `<p>This fibre is drawn as a bare glass rod in air, and many times too thick. A real telecom fibre is a glass core about 8 µm across inside a cladding of slightly lower index, 125 µm across; the reflection happens at the clean, protected boundary between the two glasses. With so small a difference in index the critical angle is close to 90°, so a real fibre only accepts light within about 8° of its axis (a numerical aperture of 0.14, in Corning's SMF-28 data sheet), and its loss is about 0.2 dB per km at 1550 nm. Each end of the drawn rod reflects about 3.5% of the light back.</p>`
		},
		// ------------------------------------------------------------------ lenses
		{
			id: 'lens',
			chapter: 'lenses',
			title: 'A lens bends every ray towards one point',
			scene: 'lens',
			hints: { phase: 'focus' },
			duration: 22,
			controls: [lensType, n, radius],
			body: `
<p>A lens is a piece of glass with curved faces. Each ray meets the surface at a different angle, so each one is bent by a different amount: hardly at all through the middle, more and more towards the edge. Shaped right, a <dfn data-def="A lens thicker in the middle than at the edge. It bends parallel rays together to a focus.">converging lens</dfn> bends a beam of parallel rays so that they all cross at one point, the <dfn data-def="The point where rays that arrive parallel to a lens's axis cross after passing through it. Its distance from the lens is the focal length, f.">focus</dfn>.</p>
<p>The <dfn data-def="The distance from a lens to its focus. A short focal length means a strongly bending lens.">focal length</dfn> depends on how curved the faces are and on how strongly the glass bends light (the lensmaker's equation):</p>
<p class="formula"><strong>1 ÷ f = (n − 1) × (2 ÷ R)</strong> &nbsp; for two faces of radius R</p>
<p>Curve the faces more, or use glass of higher index, and the focus comes closer. Drag the lens along the bench and the focus moves with it. Switch to a <dfn data-def="A lens thinner in the middle than at the edge. It spreads parallel rays apart as if they came from a point in front of it.">diverging lens</dfn> and the rays spread out instead, as if they came from a point in front of it.</p>`,
			notes: `<p>The rays here are traced through the real curved surfaces with Snell's law. Look closely at the converging lens: the rays near its edge cross a little before the ones near the middle. Spherical faces don't focus perfectly; this is <em>spherical aberration</em>, and camera lenses combine several elements to cancel it. The formula is for a thin lens. This lens is thick, so rays near the axis cross further out than f: a few per cent for gently curved faces, but up to half as far again for the most curved faces in diamond-like glass, where the outermost rays are even totally reflected inside the lens before they get out.</p>`
		},
		{
			id: 'image',
			chapter: 'lenses',
			title: 'Lenses make images',
			scene: 'lens',
			hints: { phase: 'image' },
			duration: 24,
			controls: [distance],
			body: `
<p>Every point of a lit object sends out light in all directions. A converging lens collects a cone of that light and bends it back together to a single point on the other side. Every point of the object gets its own image point, and together they make an <dfn data-def="A copy of an object made by light: where the rays from each point of the object meet again (a real image) or seem to come from (a virtual image).">image</dfn>, upside down.</p>
<p>Drag the object, the orange arrow. Far away, its image forms between f and 2f, smaller than the object; the further away the object, the closer the image gets to the focus. Bring it closer and the image moves away and grows; at twice the focal length the image is the same size. The distances obey the thin-lens equation:</p>
<p class="formula"><strong>1 ÷ f = 1 ÷ u + 1 ÷ v</strong> &nbsp; (object at u, image at v)</p>
<p>This is how your eye, a camera and a projector work: a lens forms a real image on the retina, the sensor or the screen. Bring the object inside the focal length and the rays no longer meet. They spread out as if from a bigger, upright object behind it: a <em>virtual</em> image, the one you see through a magnifying glass.</p>`,
			notes: `<p>The lens here is crown glass with faces of radius 85 mm, so f = 82 mm. The rays are traced through the real lens; the image arrow is drawn where the thin-lens equation puts it. Real spherical lenses don't focus perfectly, especially for points off the axis and wide cones of light, so the traced rays cross in a small blur near the drawn image; cameras close down the aperture to sharpen it. The lens is also 7.5 mm thick, so its true focus is about 84 mm from its centre rather than 82: with the object close to the focus, where the image runs far away, the rays meet a little away from the drawn arrow. Your eye focuses on near and far things by changing the shape of its lens, which changes f.</p>`
		},
		// ------------------------------------------------------------------ colour
		{
			id: 'prism',
			chapter: 'colour',
			title: 'A prism splits white light into colours',
			scene: 'prism',
			duration: 24,
			controls: [material, white, wavelength],
			body: `
<p>The refractive index of a material isn't quite one number: it depends a little on the colour of the light. In glass, violet light is slowed slightly more than red, so it bends slightly more. This is <dfn data-def="The spreading of light into its colours because the refractive index depends on the wavelength.">dispersion</dfn>. In flint glass:</p>
<ul>
<li>red light (656 nm): n = 1.776</li>
<li>violet light (405 nm): n = 1.842</li>
</ul>
<p>White light is a mix of all the colours. A <dfn data-def="A block of glass with flat faces at an angle to each other, usually a triangle.">prism</dfn> bends it twice, going in and coming out, in the same direction, so the small differences add up and the colours fan out into a spectrum: red, orange, yellow, green, blue, violet. Isaac Newton did this in 1666 and showed that a second prism could not split any one colour further.</p>
<p>Drag the lamp to change the angle at which the light meets the prism. Turn white light off and pick one colour: it goes through on its own path. Try crown glass (less dispersion, a narrower fan), and diamond, whose light can't get out through the far face at all: it always meets it beyond diamond's small critical angle and bounces back inside.</p>`,
			notes: `<p>The indices come from the glass makers' published Sellmeier fits (SCHOTT N-SF11 and N-BK7), from Daimon and Masumura's measurements for water and Peter's for diamond. Light of a single wavelength can't be split further because its frequency is fixed: dispersion sorts colours, it doesn't create them. Dispersion also blurs simple lenses (each colour focuses at a slightly different distance), and achromatic lenses pair crown and flint glass to cancel it.</p>`
		},
		{
			id: 'rainbow',
			chapter: 'colour',
			title: 'Rainbows: a prism in every raindrop',
			scene: 'rainbow',
			duration: 26,
			controls: [white, wavelength],
			body: `
<p>A raindrop is a tiny ball of water. Sunlight enters it and bends, reflects off the back of the drop, and bends again on the way out, heading back towards the sun's side. Follow the rays entering at different heights: they come out at different angles, but no ray is turned back by less than about 138°, and close to that limit the rays crowd together. That bunch of light comes out at about <strong>42°</strong> from the direction exactly opposite the sun.</p>
<p>Water bends violet slightly more than red, so violet's bunch comes out at 40.6° and red's at 42.3°. Stand with the sun at your back: every drop 42° from the shadow of your head sends you red, every drop 40.6° from it violet. The drops at the same angle make a circle, and that is the rainbow, red on the outside.</p>
<p>The reflection at the back of the drop is <em>not</em> total: only a few per cent of the light reflects there; most goes straight out through the back. The bright rays drawn here carry only a few per cent of the sunlight.</p>`,
			notes: `<p>René Descartes worked out the 42° in 1637: using the law of refraction, he calculated the paths of rays entering a drop at a series of heights and found where they bunch together. The rainbow's angle is set by the refractive index alone, not by the size of the drops; with two reflections inside the drop light comes out at about 51°, making the fainter secondary bow with its colours reversed. The sky between the two bows is darker (Alexander's band) because no once- or twice-reflected light comes from there.</p>`
		},
		// ------------------------------------------------------------------ bench
		{
			id: 'bench',
			chapter: 'bench',
			title: 'Your own optical bench',
			scene: 'bench',
			hints: { phase: 'bench' },
			duration: 40,
			controls: [material, white, wavelength, reset],
			body: `
<p>Everything on this bench can be moved: drag the lamp, the mirror, the lens and the prism by their centres, and turn the lamp, the mirror and the prism by their round handles. With the keyboard, Tab to a part and use the arrow keys.</p>
<p>Some things to try: aim the lamp through the lens and put the prism at its focus. Bounce the beam off the mirror into the prism. Turn the prism until the light can't get out of it. Change the material and the colour.</p>
<p>Every bend you see is the same rule at work, n₁ sin θ₁ = n₂ sin θ₂, applied at each surface the light meets.</p>
<p><strong>Light changes direction when its speed changes between materials. That one rule makes lenses focus, prisms and raindrops spread white light into rainbows, and optical fibres trap light by total internal reflection.</strong></p>`,
			notes: `<p>The bench traces each ray through the real geometry, the way optical-design software does (in two dimensions here), with Snell's law at every surface, the Fresnel share reflected (shown only when it is at least a tenth of the light), and total internal reflection. Ray tracing in computer graphics works the same way, for rendering glass and water in films and games.</p>`
		}
	]
};
