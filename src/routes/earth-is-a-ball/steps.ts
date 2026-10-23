import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const distance: Control = {
	type: 'range',
	id: 'distance',
	label: 'How far out the ship is',
	min: 2,
	max: 30,
	step: 0.5,
	default: 8,
	format: (v) => `${v} km`
};

const binoculars: Control = {
	type: 'toggle',
	id: 'binoculars',
	label: 'Look through binoculars',
	default: false
};

const cliff: Control = {
	type: 'range',
	id: 'cliff',
	label: 'Climb the cliff',
	min: 0,
	max: 60,
	step: 1,
	default: 0,
	format: (v) => `${v} m up`
};

const walk: Control = {
	type: 'range',
	id: 'walk',
	label: 'Walk round the world',
	min: 0,
	max: 360,
	step: 5,
	default: 40,
	format: (v) => `${v}°`
};

export const spec: ExplainerSpec = {
	slug: 'earth-is-a-ball',
	title: 'Earth is a ball',
	summary:
		'Drag a ship out to sea and watch it from the shore. On a flat world it would only shrink; on the real one its hull sinks behind a hill of water before its sails, and binoculars can’t bring it back but a cliff can. Then walk a little figure round the globe and drop a ball: down always means towards the middle.',
	chapters: [
		{ id: 'sea', title: 'A ship sails away' },
		{ id: 'down', title: 'Which way is down?' }
	],
	steps: [
		// ------------------------------------------------------------------ sea
		{
			id: 'flat',
			chapter: 'sea',
			title: 'If the sea were flat',
			scene: 'sea',
			hints: { world: 'flat', phase: 'sail' },
			duration: 18,
			controls: [distance],
			body: `
<p>How do we know the world is a ball? People who lived by the sea worked it out more than two thousand years ago, just by watching ships sail away.</p>
<p>The top picture shows you on the beach and a tall sailing ship, seen from the side. The bottom picture is what your eyes see. First, imagine the sea were perfectly flat, like a giant table.</p>
<p>Drag the ship out to sea. It gets smaller and smaller, but all of it stays in view: the dark hull at the bottom, the white sails, the tip of the mast. At 30 kilometres it is a tiny speck, but a whole one.</p>`
		},
		{
			id: 'flat-binoculars',
			chapter: 'sea',
			title: 'Binoculars bring it all back',
			scene: 'sea',
			hints: { world: 'flat', phase: 'binoculars', ship: 25 },
			duration: 16,
			controls: [binoculars],
			body: `
<p>On the flat sea a faraway ship only looks small because it is far. Binoculars make faraway things look bigger, as if they were closer.</p>
<p>Look through the binoculars at the ship, 25 kilometres out. These ones make things look seven times bigger. The whole ship comes back, hull and all, just as if it were only three or four kilometres away.</p>`
		},
		{
			id: 'round',
			chapter: 'sea',
			title: 'The real sea: hull first',
			scene: 'sea',
			hints: { world: 'round', phase: 'sail' },
			duration: 22,
			controls: [distance],
			body: `
<p>That is not what sailors see. On the real sea a ship sailing away doesn’t just shrink: it sinks. First the hull goes out of sight, then the bottom of the sails, and last of all the top of the mast.</p>
<p>That is because the sea is the curved skin of a huge ball. Between you and the ship the water bulges up like a very low hill, and the hill hides the bottom of the ship. The top picture draws the hill about seventy times taller than it really is, so you can see it; the distances are real.</p>
<p>Drag the ship out. Up to about 5 kilometres you see all of it: that is where your view skims the top of the hill, the <dfn data-def="The line where the sea seems to meet the sky. It is where your view just skims the curve of the sea; anything farther away starts to sink behind it.">horizon</dfn>. At about 14 kilometres the hull is gone, and at about 26 kilometres the whole ship has sunk out of sight.</p>`
		},
		{
			id: 'binoculars',
			chapter: 'sea',
			title: 'Binoculars can’t help',
			scene: 'sea',
			hints: { world: 'round', phase: 'binoculars', ship: 16 },
			duration: 16,
			controls: [binoculars],
			body: `
<p>Maybe the hull is just too small to see? Try the binoculars on the ship, 16 kilometres out.</p>
<p>The sails get big, but the hull doesn’t come back. The bottom of the ship isn’t too small: it is behind the water. Binoculars make things bigger, but they can’t see through a hill.</p>`
		},
		{
			id: 'cliff',
			chapter: 'sea',
			title: 'Climb to see over the hill',
			scene: 'sea',
			hints: { world: 'round', phase: 'cliff', ship: 20 },
			duration: 20,
			controls: [cliff],
			body: `
<p>What does bring the hull back is climbing. The higher your eyes, the farther your view reaches over the curve before it touches the sea.</p>
<p>The ship is 20 kilometres out, and from the beach its hull and the bottom half of its sails are hidden. Climb the cliff: at about 30 metres up, as high as a ten-storey building, the whole ship is back. That’s why ships have a lookout at the top of the mast.</p>
<p>Air bends light very slightly round the curve, so on most days you see a little farther than these drawings say: from the beach, the horizon is about 300 metres farther away. On some days it bends a lot more and faraway coasts pop into view, so the exact numbers change with the weather. The hull still always goes first.</p>`,
			notes: `<p>The numbers on this page are plain geometry on a ball of radius 6,371 km, for eyes 1.7 m above the water, without the bending of light by the air. Surveyors allow for the usual bending by pretending the Earth is about a seventh bigger: the horizon from a beach is then about 5.0 km instead of 4.7 km, and a little less of a faraway ship is hidden. Warm air over cold water can bend light much more, and then distant ships and islands can be seen that the geometry says are hidden. The ship here is a tall sailing ship 36 m from waterline to masthead, with a 7 m hull.</p>`
		},
		// ------------------------------------------------------------------ down
		{
			id: 'walk',
			chapter: 'down',
			title: 'Feet point to the middle',
			scene: 'globe',
			hints: { phase: 'walk' },
			duration: 18,
			controls: [walk],
			body: `
<p>If the world is a ball, what about the people on the other side? Why don’t they fall off?</p>
<p>Walk the little figure round the world. Wherever it stands, its feet are on the ground and its head points away from the world, out into the sky. Its feet always point towards the middle of the ball.</p>
<p>The ball here is drawn without any arrow saying which way is up, on purpose: space has no up or down of its own.</p>`
		},
		{
			id: 'drop',
			chapter: 'down',
			title: 'Down means towards the middle',
			scene: 'globe',
			hints: { phase: 'drop' },
			duration: 18,
			controls: [walk],
			body: `
<p>Now the figure drops a ball. The ball falls to the ground at its feet, straight towards the middle of the world, and takes about two thirds of a second to fall two metres.</p>
<p>Walk the figure anywhere, even to the bottom of the picture, and drop it again: the ball always falls towards the middle. That is what <em>down</em> means. The whole world is pulling everything towards its middle; this pull is called <dfn data-def="The pull that every bit of stuff has on every other bit. A whole planet pulls hard enough to hold you, the air and the sea onto it, all towards its middle.">gravity</dfn>.</p>`
		},
		{
			id: 'everyone',
			chapter: 'down',
			title: 'Nobody is upside down',
			scene: 'globe',
			hints: { phase: 'everyone' },
			duration: 18,
			body: `
<p>Here are people all round the world at once. Each of them feels the ground under their feet and the sky over their head. Nobody is upside down and nobody has to hold on: for each of them, down is towards the middle, and the middle is under their feet.</p>
<p>So the world is a ball: the sea itself hides the bottom of a faraway ship, and down means towards the middle wherever you stand.</p>
<p>To see how this ball goes round the Sun, and why the Moon changes shape, read <a href="../sun-earth-moon/">Sun, Earth & Moon</a>. To see how the same pull keeps the Moon and planets going round, read <a href="../orbits-kepler/">Orbits</a>.</p>`,
			notes: `<p>The pull on this page is worked out, not assumed: the model adds up the pulls of thousands of pieces of a ball of rock with Earth’s mass, and the total points at the middle within a fraction of a degree, with a strength of about 9.8 metres per second every second, wherever the person stands. The real Earth is very slightly squashed (about 21 km wider at the equator than pole to pole) and lumpy inside, so real “down” can lean from the exact middle by a tiny fraction of a degree.</p>`
		}
	]
};
