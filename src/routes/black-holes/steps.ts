import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- controls ------------------------------------------------------------------------
// Distances are given in Schwarzschild radii (r_s), the radius of the horizon.

const rs = (v: number, d = 2) => `${v.toFixed(d)} r_s`;

/** How far from the hole a ray passes, on the weak-bending step. */
const bendB: Control = {
	type: 'range',
	id: 'bendB',
	label: 'How far from the hole the light passes',
	min: 4,
	max: 40,
	step: 0.5,
	default: 8,
	format: (v) => rs(v, 1),
	help: 'The distance at which the ray would pass if it went straight (its impact parameter).'
};

/** Aim of the light ray fired at the hole. */
const aim: Control = {
	type: 'range',
	id: 'aim',
	label: 'Aim: distance from the hole',
	min: 0.25,
	max: 6,
	step: 0.05,
	default: 3.5,
	format: (v) => rs(v),
	help: 'Where the ray would pass if it went straight.'
};
const fire: Control = { type: 'action', id: 'fire', label: 'Fire', action: 'Fire a light ray' };

/** Fine aim close to the critical value √27 GM/c² = 2.598 r_s. */
const aimFine: Control = {
	type: 'range',
	id: 'aimFine',
	label: 'Aim, finely',
	min: 2.58,
	max: 2.68,
	step: 0.0001,
	default: 2.5985,
	format: (v) => rs(v, 4),
	help: 'The critical aim is 2.5981 r_s.'
};

/** Height of the lamp that flashes in every direction. */
const lampR: Control = {
	type: 'range',
	id: 'lampR',
	label: 'Height of the lamp',
	min: 1.02,
	max: 4,
	step: 0.01,
	default: 1.4,
	format: (v) => `${v.toFixed(2)} r_s from the centre`
};

const squeeze: Control = {
	type: 'toggle',
	id: 'squeeze',
	label: 'Squeeze the Sun into a black hole',
	default: false
};

/** Launch distance and speed of the probe. */
const probeR: Control = {
	type: 'range',
	id: 'probeR',
	label: 'Launch distance',
	min: 4,
	max: 40,
	step: 0.5,
	default: 12,
	format: (v) => rs(v, 1)
};
const probeK: Control = {
	type: 'range',
	id: 'probeK',
	label: 'Launch speed',
	min: 0.6,
	max: 1.5,
	step: 0.01,
	default: 0.9,
	format: (v) => `${v.toFixed(2)} × Newton’s circular speed`,
	help: 'Sideways. 1 would be a circle under Newton’s gravity; above 1.41 Newton says it escapes.'
};
const launch: Control = { type: 'action', id: 'launch', label: 'Launch', action: 'Launch again' };

/** Radius of a circular orbit, tested with a tiny nudge. */
const iscoR: Control = {
	type: 'range',
	id: 'iscoR',
	label: 'Radius of the circular orbit',
	min: 1.6,
	max: 6,
	step: 0.05,
	default: 3.5,
	format: (v) => rs(v),
	help: 'The probe is launched 0.3% slower than a perfect circle needs.'
};

/** Height of the lowered clock. */
const clockR: Control = {
	type: 'range',
	id: 'clockR',
	label: 'Height of the lowered clock',
	min: 1.01,
	max: 6,
	step: 0.01,
	default: 2,
	format: (v) => `${v.toFixed(2)} r_s from the centre`
};
const edgeR: Control = { ...clockR, id: 'edgeR', default: 1.05 };

/** How close the bright star passes behind the hole, in Einstein radii. */
const pass: Control = {
	type: 'range',
	id: 'pass',
	label: 'How close the star passes behind the hole',
	min: 0,
	max: 1.5,
	step: 0.01,
	default: 0.25,
	format: (v) => (v === 0 ? 'exactly behind' : `${v.toFixed(2)} ring radii`)
};
const unlensed: Control = {
	type: 'toggle',
	id: 'unlensed',
	label: 'Show the sky without the black hole',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'black-holes',
	title: 'Black holes and curved spacetime',
	summary:
		'Fire light rays and probes past a black hole and watch them bend, loop or fall in, lower a clock towards the horizon and see it slow down, and drag a black hole across the stars to watch it bend them into rings.',
	chapters: [
		{ id: 'curved', title: 'Gravity as geometry' },
		{ id: 'hole', title: 'A black hole' },
		{ id: 'orbits', title: 'Orbiting a black hole' },
		{ id: 'time', title: 'Time near a black hole' },
		{ id: 'seeing', title: 'Seeing a black hole' }
	],
	steps: [
		// ------------------------------------------------------------------ curved
		{
			id: 'straight',
			chapter: 'curved',
			title: 'Straight lines on a curved surface',
			scene: 'globe',
			duration: 20,
			body: `
<p>Two travellers set off from the equator, 2 200 km apart, both heading due north. Neither ever turns. Yet their paths draw closer and closer, and they meet at the North Pole. No force pulled them together: the <strong>surface they walk on is curved</strong>, and on a curved surface the straightest possible paths — <dfn data-def="The straightest possible path on a curved surface or in curved spacetime: one that never turns left or right. On a globe, the great circles.">geodesics</dfn> — converge.</p>
<p>In 1915 Albert Einstein proposed that gravity works the same way. Mass and energy <strong>curve spacetime</strong>, the four-dimensional combination of space and time you met in <a href="../special-relativity/#spacetime">special relativity</a>. A body that no force acts on keeps to the straightest path through that curved spacetime, and that path is what we see as falling or orbiting. This is <dfn data-def="Einstein's theory of gravity (1915): mass and energy curve spacetime, and freely falling bodies and light follow the straightest paths in it.">general relativity</dfn>.</p>
<p>It explains something Newton had to take as a coincidence: everything falls the same way, whatever its mass. A feather and a hammer dropped on the Moon land together, because they are following the same geometry.</p>`,
			notes: `<p>The curvature that matters for slow things like planets is mostly the warping of <em>time</em>: clocks run at different rates at different heights (you will see this in the chapter on time), and that difference alone gives Newton's gravity in the limit of weak fields and slow speeds. The globe is only an analogy: there the curvature is of space alone, and you can see it from outside, from the third dimension. Spacetime's curvature is measured from inside, by how rulers, clocks and straight paths behave.</p>`
		},
		{
			id: 'bending',
			chapter: 'curved',
			title: 'Light bends round a mass',
			scene: 'rays',
			hints: { phase: 'weak' },
			duration: 24,
			controls: [bendB],
			body: `
<p>If gravity is geometry, it must bend light too: light also follows the straightest path through spacetime. Here a ray of light passes a compact mass. Far from it the bend is tiny. General relativity predicts an angle of <strong>4GM/(c²b)</strong> for light passing at distance <i>b</i> from a mass <i>M</i> (G is Newton's constant, c the speed of light) — twice what you would get by treating light as a Newtonian bullet.</p>
<p>For starlight grazing the Sun that is <strong>1.75 arcseconds</strong>, the width of a one-euro coin seen from 2.7 km. During the solar eclipse of 1919, expeditions led by Frank Dyson and Arthur Eddington photographed the stars next to the darkened Sun and found them shifted by 1.98″ ± 0.12″ (Sobral, Brazil) and 1.61″ ± 0.30″ (Príncipe): Einstein's value, not Newton's half. It made him world-famous overnight.</p>
<p>Move the ray closer: the bend grows faster than 1/<i>b</i>, and it is no longer small.</p>`,
			notes: `<p>The distances here are in units of the <dfn data-def="r_s = 2GM/c²: the radius of the horizon of a black hole of mass M. About 3 km for the mass of the Sun.">Schwarzschild radius</dfn> r_s = 2GM/c² of the mass, which you will meet in the next step. The Sun's own radius is 236 000 r_s, so light grazing it is in the far, gentle regime. The path drawn is computed from Einstein's equations (the exact solution Karl Schwarzschild found in 1916 for a single round mass), not from the formula; the readout compares the two.</p>`
		},
		// ------------------------------------------------------------------ hole
		{
			id: 'horizon',
			chapter: 'hole',
			title: 'Fire light at a black hole',
			scene: 'rays',
			hints: { phase: 'light' },
			duration: 28,
			controls: [aim, fire],
			body: `
<p>Now squeeze the mass into a smaller and smaller ball. Schwarzschild's solution says that if a mass <i>M</i> fits inside a radius <strong>r<sub>s</sub> = 2GM/c²</strong>, nothing can hold it up and it collapses into a <dfn data-def="A region of spacetime that nothing, not even light, can leave: it is bounded by the event horizon.">black hole</dfn>. That radius is the <dfn data-def="The boundary of a black hole, at the Schwarzschild radius for a non-spinning one: a one-way surface that light and matter can cross inwards but never outwards.">event horizon</dfn>. For the mass of the Sun it is 3 km; for the Earth, 9 mm.</p>
<p>Fire light rays at it. Aimed wide, a ray bends and flies on. Aimed closer, it swings right round. Aimed inside <strong>2.6 r<sub>s</sub></strong>, it spirals in and crosses the horizon — and once inside, there is no path back out.</p>
<p>Notice that the line of capture is far wider than the horizon itself: the hole catches light it would never touch if it went straight.</p>`,
			notes: `<p>That capture distance is exactly √27 GM/c² ≈ 2.598 r_s. A black hole made by a collapsing star typically has 5 to a few tens of solar masses, so its horizon is tens to hundreds of kilometres across. This page uses a non-spinning hole; real ones usually spin, which drags spacetime round with them and makes the picture lopsided, but none of the ideas here change.</p>`
		},
		{
			id: 'photon-sphere',
			chapter: 'hole',
			title: 'Light in orbit',
			scene: 'rays',
			hints: { phase: 'sphere' },
			duration: 26,
			controls: [aimFine],
			body: `
<p>Between flying past and falling in lies a knife edge. Aim at exactly 2.598 r<sub>s</sub> and the light ends up circling the hole at <strong>1.5 r<sub>s</sub></strong>, on the <dfn data-def="The radius, 1.5 r_s for a non-spinning black hole, at which light can travel round the hole in a circle. The orbit is unstable.">photon sphere</dfn>. Gravity there is strong enough to bend light into a circle.</p>
<p>Adjust the aim by a ten-thousandth: the ray loops round once, twice or more before it leaves or falls in. The closer to the critical value, the more loops. The orbit is <strong>unstable</strong>, like a pencil balanced on its tip: any tiny difference grows, and the light peels away, outwards or inwards.</p>`
		},
		{
			id: 'no-way-out',
			chapter: 'hole',
			title: 'No way out',
			scene: 'rays',
			hints: { phase: 'flash' },
			duration: 26,
			controls: [lampR],
			body: `
<p>Hold a lamp still near the hole and let it flash in every direction. Far away, nearly all of its light gets out; only rays aimed at the hole fall in. Lower the lamp. The directions that lead out shrink into a narrowing cone pointing straight up: at the photon sphere (1.5 r<sub>s</sub>) it is exactly half the sky.</p>
<p>Closer still, even light fired sideways curls over and falls in. At the horizon the cone closes completely. Inside it, spacetime is so curved that <strong>every path, even light's, leads inwards</strong>: falling further in is as unavoidable as moving into the future.</p>
<p>That is a black hole: not a cosmic vacuum cleaner, but a region where the geometry of spacetime has turned every way out back in.</p>`,
			notes: `<p>The angles are measured by someone holding the lamp in place with a rocket, which takes a huge thrust near the horizon; the bending of light seen from a moving lamp would differ. Inside the horizon nothing can be held in place at all: staying at the same radius would mean going faster than light.</p>`
		},
		// ------------------------------------------------------------------ orbits
		{
			id: 'same-mass',
			chapter: 'orbits',
			title: 'A black hole does not suck',
			scene: 'swap',
			duration: 24,
			controls: [squeeze],
			body: `
<p>A common myth says that black holes suck everything in. They don't. Squeeze the Sun into a black hole of the same mass, 6 km across: the Earth goes on round the same orbit, at the same 29.8 km/s, in the same year.</p>
<p>Outside a round body, its gravity depends only on its mass, not on its size or what it is made of (in general relativity this is <dfn data-def="Birkhoff's theorem (1923): outside any round, non-spinning body, spacetime is exactly Schwarzschild's, set by the mass alone.">Birkhoff's theorem</dfn>). So from far away, a black hole is just another mass, and things orbit it as <a href="../orbits-kepler/#launch">Kepler and Newton</a> would predict.</p>
<p>The difference is how close you can get. The Sun's surface stops you at 696 000 km. A black hole lets you go all the way down, to where gravity becomes overwhelming.</p>`,
			notes: `<p>Even the Earth's orbit feels general relativity: its closest point to the Sun turns by an extra 3.8″ per century. Mercury, closer in, gains 43″ per century — the anomaly that had puzzled astronomers since Urbain Le Verrier measured it in 1859, and that Einstein explained in 1915. Both numbers would be exactly the same around a black hole of one solar mass.</p>`
		},
		{
			id: 'close-orbits',
			chapter: 'orbits',
			title: 'Close in, Newton fails',
			scene: 'rays',
			hints: { phase: 'probe' },
			duration: 30,
			controls: [probeR, probeK, launch],
			body: `
<p>Now launch a probe sideways near the hole and compare its real path (solid) with Newton's prediction for the same launch (dashed). Far out, at 40 r<sub>s</sub>, they nearly match. Closer in, the probe's orbit no longer closes: each time round, its closest point moves on, and the path draws a rosette. That is the same turning that shows up as Mercury's 43″ per century, here hugely magnified.</p>
<p>Closer still, the difference is not small at all. Launches that Newton says would give a safe ellipse dive into the horizon instead. Fast launches that fly past are flung round in a sharp hairpin.</p>`,
			notes: `<p>For a body moving round the hole, general relativity adds one term to Newton's gravity: an extra inward pull that grows as 1/r⁴ instead of 1/r². It is tiny far away and grows quickly close in. Time on the probe's own clock sets the pace of the animation.</p>`
		},
		{
			id: 'isco',
			chapter: 'orbits',
			title: 'The last stable orbit',
			scene: 'rays',
			hints: { phase: 'isco' },
			duration: 28,
			controls: [iscoR],
			body: `
<p>Around a star, a planet can circle at any distance, as long as it moves at the right speed, and a small nudge only makes its circle slightly oval. Near a black hole, that stops being true. Launch a probe on a circular orbit, but 0.3% too slowly.</p>
<p>Farther out than <strong>3 r<sub>s</sub></strong>, the probe wobbles a little and stays. Inside 3 r<sub>s</sub> — the <dfn data-def="Innermost stable circular orbit: for a non-spinning black hole, at 3 r_s (6GM/c²). Inside it, circular orbits exist but the slightest disturbance sends the body into the hole.">innermost stable circular orbit</dfn> — the same nudge sends it spiralling into the hole. And inside 1.5 r<sub>s</sub> no circular orbit exists at all: only light could go round there.</p>
<p>Gas swirling around a black hole feels this edge. It spirals slowly inwards, heating up to millions of degrees, until it reaches 3 r<sub>s</sub> and plunges. That hot, glowing disk is one of the main ways black holes are found.</p>`
		},
		// ------------------------------------------------------------------ time
		{
			id: 'clocks',
			chapter: 'time',
			title: 'Clocks lower down tick slower',
			scene: 'clock',
			hints: { phase: 'clock' },
			duration: 26,
			controls: [clockR],
			body: `
<p>Lower a clock on a long cable towards the hole and compare it with an identical clock far away. The lower clock ticks slower: by a factor <strong>√(1 − r<sub>s</sub>/r)</strong>. At 2 r<sub>s</sub> it ticks 71 times while the far one ticks 100; at 1.1 r<sub>s</sub>, only 30. This is <dfn data-def="Clocks deeper in a gravitational field run slower than clocks higher up, compared side by side afterwards or by light signals.">gravitational time dilation</dfn>.</p>
<p>Nobody at the lower clock feels anything odd: their heart, their watch and their thoughts all slow together. It shows when signals are compared. The lower clock sends a flash of green light with every tick. They arrive far away spread out, and redder: each wave is stretched by the same factor. This is the <strong>gravitational redshift</strong>.</p>
<p>It is measured on Earth too. The clocks on GPS satellites, 20 000 km up, gain about 45 microseconds a day on the ground from gravity alone (their speed takes off 7). Without correction, positions would drift by kilometres a day.</p>`,
			notes: `<p>Unlike the slowing of moving clocks in <a href="../special-relativity/#time-dilation">special relativity</a>, which each observer sees in the other, this effect is not mutual: the high clock sees the low clock slow, and the low clock sees the high clock fast. GPS figures: N. Ashby, <i>Relativity in the Global Positioning System</i>, Living Reviews in Relativity (2003).</p>`
		},
		{
			id: 'falling-in',
			chapter: 'time',
			title: 'Watching something fall in',
			scene: 'clock',
			hints: { phase: 'edge' },
			duration: 26,
			controls: [edgeR],
			body: `
<p>Lower the clock to just above the horizon. Its ticks reach the distant observer ever more slowly, ever redder, until the light shifts beyond visible red and fades. As the height approaches r<sub>s</sub>, the slowing has no limit.</p>
<p>So someone watching from far away never quite sees anything cross the horizon: a falling probe seems to slow, redden and fade out just above it. The probe itself notices nothing special at the horizon. On its own clock it crosses in a short, finite time, and keeps going inwards.</p>
<p>Both stories are true. They are two observers' descriptions of the same curved spacetime, linked by the light that passes between them — and from inside, no light gets out to tell the story.</p>`,
			notes: `<p>Nothing can be held at rest at or inside the horizon: the cable would need infinite strength. The slider stops just outside. For a black hole of a few solar masses the difference in pull between your head and your feet would tear you apart before you reached the horizon; for a giant one like Sgr A* you would cross it without feeling anything.</p>`
		},
		// ------------------------------------------------------------------ seeing
		{
			id: 'lensing',
			chapter: 'seeing',
			title: 'A lens made of gravity',
			scene: 'lens',
			hints: { phase: 'lens' },
			duration: 30,
			controls: [pass, unlensed],
			body: `
<p>Place a field of stars behind a black hole and look at it. Every ray reaching you bent on its way past, so the sky around the hole is distorted: stars are pushed outwards and stretched into arcs, and each star appears <strong>twice</strong>, once on each side of the hole. This is <dfn data-def="The bending of light from a distant source by the gravity of a mass in between, which shifts, stretches, brightens and multiplies its images.">gravitational lensing</dfn>.</p>
<p>Watch the bright star drift behind the hole. Its outer image skirts the dashed circle while the inner image, on the opposite side, rises from the shadow's edge. When the star is exactly behind, the two images merge into a complete circle of light: an <dfn data-def="The ring image of a source exactly behind a lensing mass, predicted by Orest Chwolson (1924) and Einstein (1936).">Einstein ring</dfn>. Drag the hole across the sky.</p>
<p>Astronomers see this every day: galaxies bent into arcs by clusters in front of them, and stars briefly brightening as an unseen mass passes in front.</p>`,
			notes: `<p>The picture is computed for a camera 30 r_s from the hole, using the exact bending angle for every ray traced from the camera, with the stars treated as infinitely far away. The size of the Einstein ring depends on the distances involved: the farther the camera, the bigger the ring compared with the shadow. Rays that loop round the hole once or more make further, thinner images hugging the shadow's edge; they are too thin to show at this resolution.</p>`
		},
		{
			id: 'shadow',
			chapter: 'seeing',
			title: 'The shadow',
			scene: 'lens',
			hints: { phase: 'shadow' },
			duration: 28,
			controls: [unlensed],
			body: `
<p>In the middle of the picture is a dark disc with no stars in it: the <strong>shadow</strong>. Every ray that would come from there passed inside the critical 2.6 r<sub>s</sub> and fell in. So the shadow is <strong>2.6 times wider than the horizon</strong>: the photon sphere, magnified by its own lensing.</p>
<p>In 2019 the <dfn data-def="A network of radio telescopes around the world combined into one Earth-sized telescope.">Event Horizon Telescope</dfn> imaged the shadow of M87*, a black hole of 6.5 billion suns, against its glowing gas: a ring 42 millionths of an arcsecond across. In 2022 it imaged Sagittarius A*, the 4-million-sun hole at the centre of our Galaxy: a ring of 52. Both match the shadow size Einstein's equations predict for their masses.</p>
<p>Gravity is the curvature of spacetime. Far away, a black hole is just a mass. Up close, its curvature turns every path, even light's, inwards — and leaves a hole in the sky.</p>`,
			notes: `<p>Sgr A*: 4.152 million solar masses at 27 000 light years (GRAVITY Collaboration, 2019), predicted shadow 52 µas, EHT ring 51.8 ± 2.3 µas (2022). M87*: 6.5 ± 0.7 billion solar masses at 55 million light years, predicted shadow 40 µas, ring 42 ± 3 µas (EHT 2019). The rings are glowing gas just outside the shadow, so they are slightly larger than it.</p>`
		}
	]
};
