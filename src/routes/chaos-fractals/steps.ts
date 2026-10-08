import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const angle: Control = {
	type: 'range',
	id: 'angle',
	label: 'Starting angle',
	min: 5,
	max: 170,
	step: 1,
	default: 120,
	unit: '°',
	help: 'Both rods start at this angle from straight down, at rest.'
};

const nudge: Control = {
	type: 'select',
	id: 'nudge',
	label: 'Difference between the twins',
	default: '0.001',
	options: [
		{ value: '1', label: '1°' },
		{ value: '0.01', label: '0.01°' },
		{ value: '0.001', label: '0.001°' },
		{ value: '0.000001', label: '0.000001°' }
	]
};

const release: Control = {
	type: 'action',
	id: 'release',
	label: 'Release again',
	action: 'Release again'
};

const rate: Control = {
	type: 'range',
	id: 'rate',
	label: 'Growth rate r',
	min: 2.5,
	max: 4,
	step: 0.001,
	default: 2.8,
	format: (v) => v.toFixed(3)
};

const rateCascade: Control = { ...rate, id: 'rateCascade', default: 3.5 } as Control;

const place: Control = {
	type: 'select',
	id: 'place',
	label: 'Go to',
	default: 'whole',
	options: [
		{ value: 'whole', label: 'The whole set' },
		{ value: 'seahorse', label: 'Seahorse valley' },
		{ value: 'spiral', label: 'A spiral' },
		{ value: 'minibrot', label: 'A tiny copy of the set' }
	],
	help: 'Or drag to move, and use the + and − buttons (or the mouse wheel) to zoom.'
};

export const spec: ExplainerSpec = {
	slug: 'chaos-fractals',
	title: 'Chaos and fractals',
	summary:
		'Release two pendulums a thousandth of a degree apart and watch them part ways, push a population model into chaos, and zoom forever into the Mandelbrot set.',
	chapters: [
		{ id: 'butterfly', title: 'The butterfly effect' },
		{ id: 'logistic', title: 'From order to chaos' },
		{ id: 'fractals', title: 'Endless detail' }
	],
	steps: [
		// ------------------------------------------------------------------ butterfly
		{
			id: 'pendulum',
			chapter: 'butterfly',
			title: 'A double pendulum',
			scene: 'pendulum',
			hints: { phase: 'one' },
			duration: 22,
			controls: [angle, release],
			body: `
<p>Hang a second pendulum from the end of the first and let go. The rules are simple and exact: Newton's laws, gravity, two rods and two weights — no randomness anywhere. Given the starting position, the motion is completely <dfn data-def="Fully fixed by the rules and the starting point: running it again from exactly the same start gives exactly the same result.">deterministic</dfn>.</p>
<p>Yet released from high up, the double pendulum swings, flips and tumbles in a way that never repeats and looks random. Start it low (try 10°) and it rocks gently and regularly; start it high and the motion goes wild.</p>`,
			notes: `<p>The motion is computed from the equations of motion of two equal weights on two equal, weightless rods with no friction, stepping forward a thousandth of a second at a time. The total energy stays constant to better than a thousandth, a check that the computation is accurate.</p>`
		},
		{
			id: 'twins',
			chapter: 'butterfly',
			title: 'Twins that drift apart',
			scene: 'pendulum',
			hints: { phase: 'twins' },
			duration: 30,
			controls: [nudge, release],
			body: `
<p>Now release two pendulums side by side, identical except that one starts a thousandth of a degree further round — far less than anyone could measure. For a few seconds they move as one. Then they visibly separate, and soon they are doing completely different things.</p>
<p>The graph shows the distance between the two lower weights on a scale where each line is ten times the one below. It climbs in a roughly straight line: the tiny difference is being <em>multiplied</em> by about the same factor every second. Make the starting difference a thousand times smaller (0.000001°) and the twins stay together only about four seconds longer: better measurements buy surprisingly little time.</p>
<p>This is <dfn data-def="Behaviour that follows exact rules but is so sensitive to the starting point that tiny differences grow exponentially, making long-term prediction impossible.">chaos</dfn>: sensitive dependence on the starting point, nicknamed the <strong>butterfly effect</strong>. It is why weather forecasts lose their skill after a week or two — the atmosphere follows exact physics, but we can never measure today's weather perfectly.</p>`,
			notes: `<p>Edward Lorenz found the effect in 1961 when he restarted a weather simulation from numbers rounded to three decimal places and got a completely different forecast. His 1972 talk asked: "Does the flap of a butterfly's wings in Brazil set off a tornado in Texas?"</p>`
		},
		// ------------------------------------------------------------------ logistic
		{
			id: 'logistic',
			chapter: 'logistic',
			title: 'A population model',
			scene: 'logistic',
			hints: { phase: 'cobweb' },
			duration: 26,
			controls: [rate],
			body: `
<p>Chaos doesn't need pendulums; one line of arithmetic will do. Take a population of animals as a fraction <i>x</i> of the most the land can hold. Each year it grows by a <strong>growth rate</strong> <i>r</i>, but crowding holds it back:</p>
<p class="formula">next year's <i>x</i> = <i>r</i> × <i>x</i> × (1 − <i>x</i>)</p>
<p>This is the <dfn data-def="The rule x → r·x·(1 − x), a simple model of a population limited by crowding, made famous by Robert May in 1976.">logistic map</dfn>. The zig-zag "cobweb" plot follows it year by year: up to the curve to get next year's value, across to the diagonal to use it as the new start. With <i>r</i> = 2.8 the population settles to a steady level. Slide <i>r</i> up past 3: it settles into alternating between two values — boom, bust, boom, bust.</p>`
		},
		{
			id: 'cascade',
			chapter: 'logistic',
			title: 'Period doubling, then chaos',
			scene: 'logistic',
			hints: { phase: 'bifurcation' },
			duration: 30,
			controls: [rateCascade],
			body: `
<p>Plot where the population ends up for every growth rate and a famous picture appears. One steady value splits into 2 at <i>r</i> = 3, into 4 at about 3.449, into 8 at 3.544, then 16, 32… — the splits come faster and faster and pile up at about 3.5699. Beyond that the population never settles or repeats: it is chaotic, and two populations starting a hair apart soon differ completely.</p>
<p>Look closely inside the chaos: there are narrow windows of order, such as a cycle of 3 near <i>r</i> = 3.83, which then splits again in the same way. Each part of the picture contains smaller copies of the whole cascade.</p>`,
			notes: `<p>The gaps between successive splits shrink by a factor that approaches 4.669… — Feigenbaum's constant (1975). Astonishingly, the same number turns up in the period doubling of very different systems, from dripping taps to electronic circuits and fluids heated from below.</p>`
		},
		// ------------------------------------------------------------------ fractals
		{
			id: 'mandelbrot',
			chapter: 'fractals',
			title: 'The Mandelbrot set',
			scene: 'mandelbrot',
			hints: { phase: 'set' },
			duration: 26,
			body: `
<p>Another one-line rule, now with <dfn data-def="Numbers with two parts, written a + bi, where i × i = −1. They can be pictured as points on a flat plane.">complex numbers</dfn>, which can be drawn as points on a plane. Pick a point <i>c</i>. Start with <i>z</i> = 0 and repeat: <i>z</i> → <i>z</i>² + <i>c</i>. Either <i>z</i> stays close by for ever, or it shoots off towards infinity.</p>
<p>Colour <i>c</i> black if it stays, and by how quickly it escapes if it doesn't. The black points form the <dfn data-def="The set of complex numbers c for which z → z² + c, starting from z = 0, stays bounded. Its boundary has endless detail.">Mandelbrot set</dfn>, named after Benoît Mandelbrot, who made it famous around 1980. Its edge is where the interesting things happen: points just outside take longer and longer to escape.</p>`
		},
		{
			id: 'zoom',
			chapter: 'fractals',
			title: 'Zoom in for ever',
			scene: 'mandelbrot',
			hints: { phase: 'zoom' },
			duration: 30,
			controls: [place],
			body: `
<p>Zoom into the edge. However far you go, there is more detail: spirals, seahorse tails, lightning branches — and tiny copies of the whole set, each with its own edge just as detailed. A shape with structure at every scale like this is a <dfn data-def="A shape with detail at every scale, often containing smaller copies of itself.">fractal</dfn>.</p>
<p>All of it comes from <i>z</i> → <i>z</i>² + <i>c</i>. That is the lesson of this page: <strong>simple, exact rules can produce behaviour that is unpredictable in the long run, and structure that repeats at every scale</strong>. Coastlines, clouds, ferns and blood vessels show the same kind of repeating detail.</p>`,
			notes: `<p>Deeper zooms need more repetitions of the rule before a point can be declared "in" — this page uses up to a few thousand — and eventually more precision than a computer's ordinary numbers offer (around a ten-trillionth of the full width).</p>`
		}
	]
};
