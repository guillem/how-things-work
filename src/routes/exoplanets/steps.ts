import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';
import { JUPITER_MASSES, JUPITER_RADII } from './exoplanets';
import { MYSTERIES, distOf, fmtAU, fmtTilt, massOf, measureBounds, tiltOf } from './systems';

// ---- controls ------------------------------------------------------------------------
// The planet's four settings share their ids across steps, so a planet set up on one
// step is the same planet on the next.

const fmt = (v: number, d = 1) =>
	v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(v < 1 ? 2 : d);

const star: Control = {
	type: 'select',
	id: 'star',
	label: 'Star',
	default: 'sun',
	options: [
		{ value: 'sun', label: 'The Sun (yellow, G2)' },
		{ value: 'hd189733', label: 'HD 189733 (orange, K2, 0.75 Suns across)' },
		{ value: 'proxima', label: 'Proxima Centauri (red dwarf, 0.14 Suns across)' }
	]
};

const size: Control = {
	type: 'range',
	id: 'size',
	label: 'Planet size',
	min: 0.5,
	max: 22,
	step: 0.1,
	default: 11,
	format: (v) => `${v.toFixed(1)} × Earth (${(v / JUPITER_RADII).toFixed(2)} × Jupiter)`
};

const mass: Control = {
	type: 'range',
	id: 'mass',
	label: 'Planet mass',
	min: -1,
	max: 3.6,
	step: 0.01,
	default: Math.log10(JUPITER_MASSES),
	format: (v) => {
		const m = massOf(v);
		return `${fmt(m)} × Earth (${(m / JUPITER_MASSES).toFixed(m < 30 ? 3 : 2)} × Jupiter)`;
	},
	help: 'A logarithmic slider: each step to the right multiplies the mass.'
};

const dist: Control = {
	type: 'range',
	id: 'dist',
	label: 'Orbit size',
	min: -2,
	max: Math.log10(5.2),
	step: 0.01,
	default: Math.log10(0.05),
	format: (v) => `${fmtAU(distOf(v))} AU from the star`,
	help: '1 AU is the Earth’s distance from the Sun; Mercury is at 0.39 AU, Jupiter at 5.2.'
};

const tilt: Control = {
	type: 'range',
	id: 'tilt',
	label: 'Tilt of the orbit',
	min: 0,
	max: 100,
	step: 1,
	default: 0,
	format: (v) => {
		const d = tiltOf(v);
		return d === 0 ? 'edge-on (0°)' : d === 90 ? 'face-on (90°)' : `${fmtTilt(d)}° from edge-on`;
	},
	help: '0° means we see the orbit exactly edge-on; 90° means we look straight down on it. Finer near edge-on.'
};

const mystery: Control = {
	type: 'select',
	id: 'mystery',
	label: 'Mystery planet',
	default: MYSTERIES[0].id,
	options: MYSTERIES.map((m, i) => ({ value: m.id, label: `Mystery planet ${i + 1}` }))
};

const boundsOf = (p: Params) => measureBounds(String(p.mystery ?? MYSTERIES[0].id));
const measDepth: Control = {
	type: 'range',
	id: 'measDepth',
	label: 'Your reading of the dip',
	min: 0,
	max: 4,
	step: 0.01,
	default: 0,
	bounds: (p) => [0, boundsOf(p)[0]],
	format: (v) => `${v.toFixed(2)}% dimmer`,
	help: 'Or drag the handle on the light curve to the bottom of the dip.'
};
const measK: Control = {
	type: 'range',
	id: 'measK',
	label: 'Your reading of the wobble',
	min: 0,
	max: 400,
	step: 1,
	default: 0,
	bounds: (p) => [0, boundsOf(p)[1]],
	format: (v) => `${v.toFixed(0)} m/s`,
	help: 'Or drag the handle on the velocity curve to its highest point.'
};
const reveal: Control = {
	type: 'toggle',
	id: 'reveal',
	label: 'Reveal the planet',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'exoplanets',
	title: 'How we find planets round other stars',
	summary:
		'Set a planet’s size, mass, orbit and tilt and watch its star dim as it passes in front and wobble as it is tugged, then read the planet back from the two curves and see whether it lies in the habitable zone.',
	chapters: [
		{ id: 'faint', title: 'Too faint to see' },
		{ id: 'dip', title: 'The dip' },
		{ id: 'wobble', title: 'The wobble' },
		{ id: 'read', title: 'Reading the planet' },
		{ id: 'census', title: 'Six thousand worlds' }
	],
	steps: [
		// ------------------------------------------------------------------ faint
		{
			id: 'glare',
			chapter: 'faint',
			title: 'A firefly beside a lighthouse',
			scene: 'glare',
			duration: 20,
			body: `
<p>An <dfn data-def="A planet that orbits a star other than the Sun. The first round a Sun-like star was found in 1995.">exoplanet</dfn> is a planet round another star. There are billions of them in our galaxy, and since the 1990s astronomers have found more than six thousand. Yet almost none of them has ever been seen.</p>
<p>The trouble is the glare. A planet makes no light of its own: it only reflects some of its star's. The Earth catches less than <strong>half a billionth</strong> of the Sun's light (its disc is a tiny target at that distance), and reflects only part of that. Seen from another star, the Earth would be a firefly next to a lighthouse, and so close to it in the sky that the two would blur into one.</p>
<p>So instead of looking for the planet, astronomers watch its star, very carefully, for the two small marks a planet leaves on its light.</p>`,
			notes: `<p>The fraction of a star's light a planet intercepts is the area of its disc, πR², divided by the area of a sphere as big as its orbit, 4πa²: (R / 2a)². For the Earth that is 4.5 × 10⁻¹⁰, for Jupiter 2.0 × 10⁻⁹. A planet reflects only part of what it catches. The few planets that have been photographed directly are huge, young and still glowing with the heat of their formation, and far from their stars.</p>`
		},
		// ------------------------------------------------------------------ dip
		{
			id: 'transit',
			chapter: 'dip',
			title: 'A shadow crosses the star',
			scene: 'transit',
			hints: { phase: 'transit' },
			duration: 24,
			controls: [size, star],
			body: `
<p>If we happen to see a planet's orbit edge-on, once every orbit the planet passes in front of its star: a <dfn data-def="The passage of a planet across the face of its star, as seen by us. It blocks a little of the star's light.">transit</dfn>. The planet is far too small to see against the star, but it blocks a little of the star's light, and a telescope that measures the star's brightness records a small <strong>dip</strong>: the <dfn data-def="A graph of a star's brightness against time.">light curve</dfn> below.</p>
<p>How much light goes missing is the area of the planet's disc over the area of the star's: <strong>(planet's radius / star's radius)²</strong>. A Jupiter crossing the Sun dims it by about 1%; an Earth by only <strong>0.0084%</strong>, 84 parts in a million. Make the planet bigger and the dip deepens. Put it round a smaller star and the same planet makes a much deeper dip, which is why small red stars are good places to look for small planets.</p>`,
			notes: `<p>The dip has sloping sides because the planet takes a while to move fully onto the star's disc (and off it again). The drawing treats the star's disc as equally bright all over. A real star is dimmer near its edge (it is called <em>limb darkening</em>), which rounds off the bottom of a real dip; the depth in the middle still gives the size. The planet drawn is the planet as it would look against the star, to scale; its orbit is far bigger than the picture, and the crossing is slowed right down.</p>`
		},
		{
			id: 'period',
			chapter: 'dip',
			title: 'The dips repeat: a year you can time',
			scene: 'transit',
			hints: { phase: 'period' },
			duration: 26,
			controls: [dist, star],
			body: `
<p>The dip comes back every time the planet comes round, so the gap between two dips is the planet's year, its <dfn data-def="The time a planet takes to go once round its star.">period</dfn>. A planet close to its star has a short year and fast, frequent dips; one further out has a long year, and you have to wait for it.</p>
<p>The period tells us how far the planet is from its star. You met the rule in <a href="../orbits-kepler/#third">Kepler's third law</a>: the square of the period goes with the cube of the orbit's size, and Newton showed that the star's mass sets the proportion. Astronomers can tell a star's mass from its colour and brightness, so timing the dips gives the orbit's size.</p>
<p>The first planets found round Sun-like stars were <strong>hot Jupiters</strong>: giants at 0.05 AU, with years of only 3 to 5 days. An Earth-like year of 365 days gives one 13-hour dip a year, so it takes years of watching to see it repeat.</p>`,
			notes: `<p>Kepler's third law with the star's mass M★ and the planet's mass Mp: a³ = G(M★ + Mp)P² / 4π². The planet's own mass hardly matters unless it is very heavy. The time axis below covers three orbits whatever the period, so a short and a long year look the same width: read the days on the axis.</p>`
		},
		{
			id: 'tilt',
			chapter: 'dip',
			title: 'Most orbits miss',
			scene: 'transit',
			hints: { phase: 'tilt' },
			duration: 26,
			controls: [tilt, dist],
			body: `
<p>A transit only happens if the orbit is lined up with us almost exactly. The picture on the right is the whole orbit as we see it from Earth: edge-on it is a line through the star. Tilt it and it opens into an oval, and the planet passes above or below the star instead of in front of it. A tilt of just over a quarter of a degree is enough for an Earth to miss the Sun.</p>
<p>Orbits are tilted at random, so the chance that we see a transit is about <strong>the star's radius divided by the orbit's radius</strong>: about one in ten for a hot Jupiter, but one in two hundred for an Earth at 1 AU. For every Earth that transits a Sun-like star, about two hundred more like it don't.</p>
<p>That is why the <dfn data-def="NASA's planet-hunting space telescope (2009–2018). It watched about 150 000 stars in one patch of sky for four years, measuring each one's brightness every half hour.">Kepler</dfn> space telescope watched about 150 000 stars at once: to catch the few that are lined up.</p>`,
			notes: `<p>Here a tilt of 0° means edge-on; astronomers usually quote the <em>inclination</em>, which is 90° minus this tilt (90° is edge-on). A planet that only clips the edge of its star makes a short, shallow, V-shaped dip: a grazing transit.</p>`
		},
		// ------------------------------------------------------------------ wobble
		{
			id: 'wobble',
			chapter: 'wobble',
			title: 'The planet tugs its star',
			scene: 'wobble',
			hints: { phase: 'wobble' },
			duration: 24,
			controls: [mass, dist, star],
			body: `
<p>A planet doesn't orbit the centre of its star. As you saw in <a href="../orbits-kepler/#two">Orbits and Kepler's laws</a>, the star moves too: star and planet both circle their common <dfn data-def="The balance point of two bodies: the heavier one is closer to it. Both orbit round it in the same time.">centre of mass</dfn>, the star on a small circle, the planet on a big one, always on opposite sides.</p>
<p>Jupiter is 1/1000 of the Sun's mass, so the Sun's circle is 1/1000 the size of Jupiter's orbit: it takes the Sun just outside its own surface, at <strong>12.5 metres per second</strong>, about the speed of a fast cyclist. The Earth moves the Sun by only <strong>9 centimetres per second</strong>, a slow crawl.</p>
<p>A heavier planet, or one closer in, tugs harder and swings its star faster. Set the mass and the orbit and read the star's speed.</p>`,
			notes: `<p>The star's speed is K = (2πG / P)^⅓ × Mp / (M★ + Mp)^⅔ for a circular orbit seen edge-on. A planet close in moves fast and so does its star: a hot Jupiter at 0.05 AU swings a Sun-like star at about 130 m/s. The sizes and distances in the drawing are not to scale; the star's circle is drawn far bigger than it is.</p>`
		},
		{
			id: 'doppler',
			chapter: 'wobble',
			title: 'The lines in the starlight shift',
			scene: 'wobble',
			hints: { phase: 'doppler' },
			duration: 26,
			controls: [mass, dist],
			body: `
<p>We can't see the star move: it is far too far away. But we can measure its speed towards or away from us. Spread a star's light into a <a href="../light-optics/#prism">rainbow</a> and it is crossed by thin dark <dfn data-def="Dark lines in a star's spectrum where atoms in its outer layers absorb particular colours. Each element absorbs its own set of wavelengths.">absorption lines</dfn>, made by atoms in the star's outer layers, each at a wavelength known from the laboratory.</p>
<p>When the star moves towards us, its light waves are squeezed and every line moves a little to the blue; when it moves away, they stretch and move to the red. This is the <a href="../waves-interference/#doppler">Doppler effect</a> you met with sound. The shift is the speed divided by the speed of light: for 12.5 m/s, 4 parts in 100 million. The best spectrographs can measure that.</p>
<p>The speed traced over time is the <dfn data-def="A graph of a star's speed towards or away from us against time. A planet on a circular orbit makes it a smooth wave.">velocity curve</dfn>: a smooth wave, one cycle per orbit. Its height gives the strength of the tug.</p>`,
			notes: `<p>The shift drawn is magnified by the factor shown, otherwise it would be far thinner than a pixel. The wavelengths are those of real lines in the Sun's spectrum (from the NIST Atomic Spectra Database): calcium H and K, hydrogen's Hα to Hδ, magnesium, iron and sodium. Real spectrographs follow thousands of lines at once and average them. Notice the timing: as the planet passes in front of the star (the moment of a transit) the star moves across our line of sight, and its speed towards us is zero.</p>`
		},
		{
			id: 'tilt-wobble',
			chapter: 'wobble',
			title: 'Only the part towards us counts',
			scene: 'wobble',
			hints: { phase: 'tilt' },
			duration: 24,
			controls: [tilt, mass],
			body: `
<p>The Doppler effect only measures motion along our line of sight. Tilt the orbit and less of the star's motion is towards and away from us: the curve flattens. Seen face-on, from above, the star still circles but never comes closer or moves away, and the lines don't shift at all.</p>
<p>So a velocity curve on its own can't tell a heavy planet on a tilted orbit from a lighter one seen edge-on. It gives the planet's <dfn data-def="The mass a planet would have if we saw its orbit edge-on: mass × sin(inclination). The true mass is at least this much.">minimum mass</dfn>, the mass it must at least have. Most planets found this way are known only by their minimum mass.</p>`,
			notes: `<p>What is measured is K ∝ Mp × sin i, where i is the inclination (90° minus the tilt here). For orbits tilted at random, the true mass is usually close to the minimum: in nine cases out of ten it is less than 2.3 times it. A transit settles the question: if the planet transits, the orbit is edge-on to within a few degrees, and the minimum mass is the mass.</p>`
		},
		// ------------------------------------------------------------------ read
		{
			id: 'both',
			chapter: 'read',
			title: 'Two curves, one planet',
			scene: 'read',
			hints: { phase: 'both' },
			duration: 30,
			controls: [size, mass, dist, tilt],
			body: `
<p>Now put the two together. Set the planet's size, mass, orbit and tilt, and watch both of the star's curves at once: the dip in its brightness and the wave in its speed.</p>
<p>Work backwards, as astronomers do. The gap between dips gives the <strong>period</strong>, and with the star's mass, the orbit. The depth of the dip gives the <strong>size</strong>. The height of the wave gives the <strong>mass</strong> (and because the planet transits, its true mass). Size and mass together give the planet's <dfn data-def="Mass divided by volume. Water is 1 gram per cubic centimetre; rock about 3; iron about 8.">density</dfn>, and that says what it is made of: the Earth is rock and iron at 5.5 grams per cubic centimetre, Jupiter mostly hydrogen and helium at 1.3, a quarter of the Earth's.</p>
<p>Tilt the orbit by a few degrees and watch what you lose: the dip vanishes, and with it the size and the true mass.</p>`,
			notes: `<p>Each readout on the right is worked out from the curves alone, by the same formulas an astronomer uses; it lands on the values you set because the model is the same in both directions. A dense planet of a few Earth masses is rocky; a puffy one of the same mass has a thick envelope of gas. Hot Jupiters are often even less dense than Jupiter: their star's heat inflates them.</p>`
		},
		{
			id: 'mystery',
			chapter: 'read',
			title: 'Read a real planet back',
			scene: 'read',
			hints: { phase: 'mystery' },
			duration: 34,
			controls: [mystery, measDepth, measK, reveal],
			body: `
<p>Your turn. These are the curves of three real planets, drawn from their measured orbits round their measured stars. Drag the handle on the light curve to the bottom of the dip, and the handle on the velocity curve to the top of the wave. The readouts turn your readings into a size, a mass and a density.</p>
<p>Then reveal the planet and compare your reading with the published one. One of the three never passes in front of its star: you can find its minimum mass, but not its size.</p>`,
			notes: `<p>Planet and star values are from the NASA Exoplanet Archive (Planetary Systems Composite Parameters, fetched October 2026); each value's source paper is given when you reveal the planet. The curves are drawn from the archive's size, mass, period and tilt with the model of this page (circular orbits, a uniformly bright star). The planets' radii are known only from their transits, and their masses only from the wobble.</p>`
		},
		{
			id: 'zone',
			chapter: 'read',
			title: 'The habitable zone',
			scene: 'zone',
			hints: { phase: 'zone' },
			duration: 30,
			controls: [star, dist],
			body: `
<p>Is the planet the right distance from its star for liquid water? Close in, the starlight is so strong that a planet's oceans would boil away; far out, they would freeze. In between lies the <dfn data-def="The range of distances from a star where a planet like the Earth, with enough air, could keep liquid water on its surface.">habitable zone</dfn>. Drag the planet in the top view, or change the star.</p>
<p>A dimmer star has its zone closer in: round a red dwarf like Proxima Centauri it lies at only 0.04 to 0.08 AU, closer than Mercury is to the Sun, where a year lasts one to three weeks. The chart on the right puts real planets on the map: the starlight each receives, and how hot its star is.</p>
<p>In the zone does not mean habitable, let alone inhabited. Mars is inside the Sun's zone, yet its thin air can't keep water liquid. The zone only says where water <em>could</em> be liquid, on a planet with the right size and the right air.</p>`,
			notes: `<p>The limits are from Kopparapu et al. (2014, <i>Astrophysical Journal Letters</i> 787, L29), for a planet of the Earth's mass: the inner edge is where a runaway greenhouse would boil the oceans, the outer edge where even a thick carbon dioxide atmosphere can't keep a planet warm. The paler bands are the more optimistic limits, from the fact that Venus seems to have lost its water only recently and early Mars had rivers. The fits cover stars of 2 600 to 7 200 K; TRAPPIST-1 (2 566 K) is just cooler, so its planet is drawn beside the zone's lower end. A planet's own clouds and air can move its limits either way.</p>`
		},
		// ------------------------------------------------------------------ census
		{
			id: 'census',
			chapter: 'census',
			title: 'How the planets were found',
			scene: 'census',
			duration: 26,
			body: `
<p>The chart shows every known exoplanet by the year it was found and how. Transits (three planets in four) and the wobble (about one in five) account for almost all of them. The tall bars of 2014 and 2016 are the Kepler telescope's harvest, published by the hundred.</p>
<p>Fewer than 2 in 100 have been photographed. The rest were found the way you have just practised: <strong>without being seen, through the tiny dips and wobbles they make in the light of their stars</strong>.</p>`,
			notes: `<p>Counts from the NASA Exoplanet Archive (fetched October 2026; the last year is incomplete). Other methods: <em>microlensing</em>, where a planet's gravity briefly brightens a more distant star behind it, and timing methods, which find a planet from the shifts it causes in a regular signal such as a pulsar's ticks or another planet's transits. The first exoplanets of all, found in 1992, orbit a pulsar, the dead core of an exploded star.</p>`
		}
	]
};
