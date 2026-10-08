import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const cannonSpeed: Control = {
	type: 'range',
	id: 'cannonSpeed',
	label: 'Firing speed',
	min: 2,
	max: 12,
	step: 0.1,
	default: 5,
	unit: ' km/s'
};

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Launch speed',
	min: 0.3,
	max: 1.7,
	step: 0.01,
	default: 1,
	format: (v) => `${(v * 29.8).toFixed(1)} km/s (${v.toFixed(2)} × circular)`,
	help: 'At 1 AU from the Sun, 29.8 km/s gives a circle.'
};

const direction: Control = {
	type: 'range',
	id: 'direction',
	label: 'Launch direction',
	min: -60,
	max: 60,
	step: 1,
	default: 0,
	unit: '°',
	help: '0° is straight across; positive tilts outwards, away from the Sun.'
};

const ellipseSpeed: Control = { ...speed, id: 'ellipseSpeed', default: 0.75 } as Control;

const launch: Control = {
	type: 'action',
	id: 'launch',
	label: 'Launch again',
	action: 'Launch again'
};

const neighbour: Control = {
	type: 'range',
	id: 'neighbour',
	label: 'Mass of the second planet',
	min: 0,
	max: 30,
	step: 1,
	default: 10,
	format: (v) => (v === 0 ? 'no second planet' : `${v} × Jupiter`)
};

export const spec: ExplainerSpec = {
	slug: 'orbits-kepler',
	title: "Orbits and Kepler's laws",
	summary:
		'Fire a cannonball fast enough to miss the ground, launch planets round a star, and watch one law of gravity produce circles, ellipses, escapes and all three of Kepler’s laws.',
	chapters: [
		{ id: 'fall', title: 'Falling round' },
		{ id: 'kepler', title: "Kepler's three laws" },
		{ id: 'many', title: 'More than one planet' }
	],
	steps: [
		// ------------------------------------------------------------------ fall
		{
			id: 'cannon',
			chapter: 'fall',
			title: "Newton's cannon",
			scene: 'cannon',
			hints: { phase: 'cannon' },
			duration: 24,
			controls: [cannonSpeed],
			body: `
<p>Isaac Newton imagined a cannon on a mountain so tall that it pokes above the air. Fire a ball sideways and it falls to the ground. Fire it faster and it lands further away — and because the Earth is round, the ground curves away beneath it as it falls.</p>
<p>At about <strong>8 kilometres per second</strong> the ground curves away exactly as fast as the ball falls. It never lands: it falls all the way round the planet and comes back to the mountain. That is an <dfn data-def="The path of a body falling freely around another, held by gravity: it falls all the time, but moves sideways fast enough to keep missing.">orbit</dfn>. An astronaut on the space station isn't beyond gravity — gravity there is still about 90% of what it is on the ground — they are falling round the Earth all the time, which is why they float.</p>
<p>Fire it faster still and the path stretches into a long loop; above about 11 km/s it escapes and never comes back.</p>`,
			notes: `<p>The drawing ignores the air (which would slow a real cannonball long before) and Earth's spin. The speeds are measured relative to the centre of the Earth.</p>`
		},
		{
			id: 'launch',
			chapter: 'fall',
			title: 'Circle, ellipse or escape',
			scene: 'orbit',
			hints: { phase: 'launch' },
			duration: 26,
			controls: [speed, direction, launch],
			body: `
<p>Now launch a small planet around a star like the Sun, from the Earth's distance (1 <dfn data-def="Astronomical unit: the average distance from the Earth to the Sun, about 150 million km.">AU</dfn>). The only force on it is the Sun's gravity, which gets weaker with the square of the distance.</p>
<p>At 29.8 km/s, straight across, the orbit is a <strong>circle</strong>: the Earth's orbit, one year round. Launch slower and the planet falls inwards, speeds up, swings round the Sun and comes back: an <strong>ellipse</strong>. Launch faster and it swings outwards on a bigger ellipse. Tilt the launch and the ellipse tilts with it. At √2 times the circular speed (42 km/s) it escapes for ever.</p>`,
			notes: `<p>What decides the shape is the energy: below the escape speed the planet is bound and its path is an ellipse (a circle is the special case); at exactly the escape speed a parabola, and above it a hyperbola. The planet is computed step by step from Newton's law of gravity — the ellipses are not drawn in, they come out.</p>`
		},
		// ------------------------------------------------------------------ kepler
		{
			id: 'first',
			chapter: 'kepler',
			title: 'First law: ellipses, the Sun at a focus',
			scene: 'orbit',
			hints: { phase: 'first' },
			duration: 24,
			controls: [ellipseSpeed, launch],
			body: `
<p>In 1609 Johannes Kepler, working from Tycho Brahe's careful measurements of Mars, found that planets don't move in circles but in <dfn data-def="An oval with two special points, the foci: for every point on the ellipse, the distances to the two foci add up to the same total.">ellipses</dfn>, with the Sun not at the centre but at one of two special points, a <strong>focus</strong>.</p>
<p>The dashed lines join the planet to both foci: wherever the planet is, their lengths add up to the same total — the definition of an ellipse. The closest point to the Sun is the <em>perihelion</em>, the farthest the <em>aphelion</em>.</p>`,
			notes: `<p>Real planetary orbits are only slightly elliptical: the Earth's is 1.7% off-centre (eccentricity 0.017), which is why it looks like a circle in drawings. Comets have long, thin ellipses.</p>`
		},
		{
			id: 'second',
			chapter: 'kepler',
			title: 'Second law: equal areas in equal times',
			scene: 'orbit',
			hints: { phase: 'second' },
			duration: 26,
			controls: [ellipseSpeed, launch],
			body: `
<p>Kepler's second law: a line from the Sun to the planet sweeps out <strong>equal areas in equal times</strong>. The coloured wedges each cover the same stretch of time. Near the Sun they are short and fat; far away, long and thin — but their areas are the same.</p>
<p>So a planet moves fastest at perihelion and slowest at aphelion. Gravity pulls straight towards the Sun, so it can speed the planet up or slow it down but never give it a twist about the Sun: this law is the conservation of <dfn data-def="For an orbit: distance from the Sun × the part of the speed across the line to the Sun. It stays constant when the only force points at the Sun.">angular momentum</dfn>.</p>`
		},
		{
			id: 'third',
			chapter: 'kepler',
			title: 'Third law: bigger orbits, longer years',
			scene: 'period',
			hints: { phase: 'third' },
			duration: 26,
			controls: [ellipseSpeed],
			body: `
<p>Kepler's third law (1619): the square of a planet's year is proportional to the cube of its orbit's size — measured in years and AU, <strong>T² = a³</strong>, where <i>a</i> is half the longest width of the ellipse.</p>
<p>The planets of the Solar System fall exactly on that line, from Mercury's 88-day year to Neptune's 165 years. So does your orbit from the previous steps. Newton later showed that all three of Kepler's laws follow from one law of gravity — and that the 1 in T² = a³ comes from the Sun's mass.</p>`,
			notes: `<p>The scales on the chart go up by factors of ten, so that Mercury and Neptune fit on the same picture; on such a chart, T² = a³ is a straight line with a slope of 3/2.</p>`
		},
		// ------------------------------------------------------------------ many
		{
			id: 'two',
			chapter: 'many',
			title: 'A second planet',
			scene: 'orbit',
			hints: { phase: 'two' },
			duration: 30,
			controls: [neighbour, launch],
			body: `
<p>Kepler's laws are exact only for one planet alone with its star. Add a second planet a little further out and the two pull on each other too. With a planet as light as the Earth the effect is tiny; make the neighbour a few Jupiters heavy and the inner orbit visibly wobbles — its ellipse stretches, shrinks and turns.</p>
<p>In 1846 such disturbances in the orbit of Uranus led astronomers to predict where an unseen planet must be. Neptune was found within a degree of the predicted spot.</p>
<p>An orbit is continuous free fall, and <strong>a single law of gravity produces all of it</strong>: circles, ellipses, escapes, Kepler's three laws and the small disturbances between planets.</p>`
		}
	]
};
