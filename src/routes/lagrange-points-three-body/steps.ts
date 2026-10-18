import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { LOGMU_MAX, LOGMU_MIN, gatesOf } from './scenes/shared';

const system: Control = {
	type: 'select',
	id: 'system',
	label: 'The two large bodies',
	default: 'earth-moon',
	options: [
		{ value: 'earth-moon', label: 'Earth–Moon (μ = 0.0122)' },
		{ value: 'sun-earth', label: 'Sun–Earth (μ = 3.0 × 10⁻⁶)' },
		{ value: 'sun-jupiter', label: 'Sun–Jupiter (μ = 0.00095)' },
		{ value: 'pluto-charon', label: 'Pluto–Charon (μ = 0.109)' },
		{ value: 'custom', label: 'Set the mass ratio' }
	],
	help: 'μ is the small body’s share of the two masses: m₂ / (m₁ + m₂).'
};

const logmu: Control = {
	type: 'range',
	id: 'logmu',
	label: 'Mass ratio μ',
	min: LOGMU_MIN,
	max: Number(LOGMU_MAX.toFixed(2)),
	step: 0.01,
	default: -1.92,
	format: (v) => {
		const mu = 10 ** v;
		return mu >= 0.01 ? mu.toFixed(3) : mu.toExponential(1);
	},
	disabled: (p) => p.system !== 'custom',
	help: 'On a logarithmic scale, from a millionth to equal masses. Pick “Set the mass ratio” above to move it.'
};

const rotating: Control = {
	type: 'toggle',
	id: 'rotating',
	label: 'Turn with the two bodies',
	default: true,
	help: 'Off: the view from the stars, where the two bodies circle their centre of mass.'
};

const energy: Control = {
	type: 'range',
	id: 'energy',
	label: 'Probe’s energy',
	min: 0,
	max: 4.5,
	step: 0.01,
	default: 0.5,
	format: gatesOf,
	help: 'Higher energy is a lower Jacobi constant C. At the marks 1, 2, 3 and 4, C equals its value at L1, L2, L3 and L4/L5.'
};

const drop: Control = {
	type: 'select',
	id: 'drop',
	label: 'Drop the probe at',
	default: 'L1',
	options: [
		{ value: 'L1', label: 'L1, between the two' },
		{ value: 'L2', label: 'L2, beyond the small body' }
	]
};

const lead: Control = {
	type: 'range',
	id: 'lead',
	label: 'Drop it this far ahead of the small body',
	min: 61,
	max: 175,
	step: 1,
	default: 75,
	format: (v) => `${v.toFixed(0)}°`,
	help: 'Along the small body’s orbit, at rest in the turning frame. L4 is at 60°.'
};

const routhMu: Control = {
	type: 'range',
	id: 'routhMu',
	label: 'Mass ratio μ',
	min: 0.005,
	max: 0.06,
	step: 0.0005,
	default: 0.03,
	format: (v) => `${v.toFixed(4)} (1 in ${Math.round(1 / v)})`,
	help: 'Routh’s limit is μ = 0.0385, about 1 in 26.'
};

const nudge: Control = {
	type: 'range',
	id: 'nudge',
	label: 'Second probe starts this far away',
	min: -3,
	max: 3,
	step: 1,
	default: 0,
	format: (v) => (v < 0 ? `${Math.round(10 ** (v + 3))} m` : `${Math.round(10 ** v)} km`),
	help: 'Each mark is ten times the last, from 1 metre to 1,000 km.'
};

/**
 * Scenes: `map` (the turning frame of the chosen pair with an inset round the small body; hint
 * `focus`: 'frame' (the frame turning or not), 'points' (the five points and the effective
 * potential), 'zvc' (the forbidden region of the energy slider and a probe inside it), 'gates'
 * (the same with the critical values marked)), `balance` (Sun–Earth L1 and L2: the pulls and
 * what a one-year circle needs), `drift` (a probe dropped 1,000 km off L1 or L2), `trojan` (a
 * probe dropped near L4; hint `mode`: 'tadpole' | 'routh'), `split` (two Earth–Moon probes a
 * nudge apart).
 */
export const spec: ExplainerSpec = {
	slug: 'lagrange-points-three-body',
	title: 'The three-body problem and the Lagrange points',
	summary:
		'Two large bodies on circular orbits and a probe too light to pull on them, seen from the frame that turns with the two: five points where the probe keeps pace, an energy that marks where it may never go, gates that open at L1 and L2, a knife edge at L1, tadpoles round L4 like Jupiter’s Trojans, Routh’s limit, and two probes a metre apart whose paths split.',
	chapters: [
		{ id: 'frame', title: 'Keeping pace' },
		{ id: 'energy', title: 'Where a probe can go' },
		{ id: 'stability', title: 'Knife edges and tadpoles' },
		{ id: 'chaos', title: 'Paths that split' }
	],
	steps: [
		// ------------------------------------------------------------------ frame
		{
			id: 'frame',
			chapter: 'frame',
			title: 'Ride along with the two bodies',
			scene: 'map',
			hints: { focus: 'frame' },
			duration: 24,
			controls: [rotating, system, logmu],
			body: `
<p>Two bodies on their own follow Kepler’s ellipses exactly. Add a third and the motion has no general formula: Bruns and Poincaré proved around 1890 that, beyond energy, momentum and angular momentum, it has no further conserved quantities of the kind that let the two-body problem be solved in closed form. What can be done is to simplify it to the <dfn data-def="Two bodies on circular orbits about their centre of mass, and a third too light to disturb them, moving in the same plane.">circular restricted three-body problem</dfn>: two large bodies of masses 1 − μ and μ circle their centre of mass, and a probe moves among them without pulling on either.</p>
<p>The trick is to watch from the frame that turns with the two bodies. Switch it on and off: from the stars, the Earth and the Moon circle each other every 27.3 days; in the turning frame they stand still on a line, and only the probe moves. The price is two fictitious forces on the probe, the <dfn data-def="In a rotating frame, the outward push mω²r felt by every body at distance r from the axis.">centrifugal</dfn> push away from the axis and the <dfn data-def="In a rotating frame, a sideways push −2m ω × v on every moving body, at right angles to its velocity.">Coriolis</dfn> force, sideways to the probe’s velocity.</p>`,
			notes: `<p>In units where the separation, the total mass, G and the angular speed are 1, the large body sits at (−μ, 0), the small one at (1 − μ, 0), and the probe obeys <span class="formula">ẍ − 2ẏ = ∂Ω/∂x, ÿ + 2ẋ = ∂Ω/∂y</span>, with the effective potential <span class="formula">Ω = ½(x² + y²) + (1 − μ)/r₁ + μ/r₂</span> (plus the constant ½μ(1 − μ), which makes the numbers below tidier). The terms −2ẏ and +2ẋ are the Coriolis force; ½(x² + y²) is the centrifugal potential. The page integrates these equations with a fourth-order Runge–Kutta method whose step shrinks near either body. “No formula” is a precise claim: in 1912 Sundman found a series that converges for all time, but it converges so slowly that it predicts nothing in practice, and the problem has no general closed-form solution.</p>`
		},
		{
			id: 'points',
			chapter: 'frame',
			title: 'Five places to keep pace',
			scene: 'map',
			hints: { focus: 'points' },
			duration: 26,
			controls: [system, logmu],
			body: `
<p>In the turning frame, a probe can sit still where gravity and the centrifugal push balance: where Ω is flat. There are exactly five such points. Euler found the three on the line through the two bodies in 1767: <strong>L1</strong> between them, <strong>L2</strong> beyond the small body and <strong>L3</strong> beyond the large one, on the far side of the orbit. Lagrange found the other two in 1772: <strong>L4</strong> and <strong>L5</strong>, each making an equilateral triangle with the two bodies, 60° ahead of the small body and 60° behind.</p>
<p>The faint lines are contours of the effective potential energy, −Ω per unit mass: the landscape the probe moves on. L1, L2 and L3 are its passes (saddles), L4 and L5 its two hilltops. Change the pair: L1 and L2 sit about (μ/3)<sup>⅓</sup> of the separation from the small body, 58,000 km and 64,500 km from the Moon, 1.50 and 1.51 million km from Earth, 52 and 54 million km from Jupiter. L3, L4 and L5 hardly move.</p>`,
			notes: `<p>On the axis the three collinear points are the roots of ∂Ω/∂x = 0, a quintic in each interval; the page finds them by bisection. Expanding for small μ gives the Hill radius r<sub>H</sub> = (μ/3)<sup>⅓</sup>, with L1 at r<sub>H</sub>(1 − r<sub>H</sub>/3 + …) and L2 at r<sub>H</sub>(1 + r<sub>H</sub>/3 + …) from the small body. That L4 and L5 lie on equilateral triangles for every μ follows from the forces: at equal distances from both bodies, the two pulls add up to a force that points at the centre of mass, with exactly the size that turning with the frame needs.</p>`
		},
		{
			id: 'balance',
			chapter: 'frame',
			title: 'Not where gravity cancels',
			scene: 'balance',
			duration: 28,
			body: `
<p>L1 is often called the place where the Sun’s and Earth’s gravity cancel. It is not: they cancel about 260,000 km from Earth, well inside the Moon’s orbit. L1 is almost six times farther out, at 1.50 million km, and a probe there is far from weightless: it is in orbit round the Sun.</p>
<p>A body circling the Sun at 0.99 of Earth’s distance would, by Kepler’s third law, go round in 0.985 years and pull ahead of Earth. At L1, Earth’s pull partly offsets the Sun’s, leaving a little less than the Sun’s alone, and with that weaker pull a circle of that size takes exactly one year: the probe keeps pace. At L2, 1.01 of Earth’s distance, Earth’s pull <em>adds</em> to the Sun’s, and the stronger pull again gives exactly one year. The bars show the accelerations, in millimetres per second squared.</p>
<p>That is why spacecraft use these points: SOHO has watched the Sun from L1 since 1996, and the James Webb Space Telescope looks away from the Sun, Earth and Moon at L2. Neither sits on the point itself; each circles it on a wide loop, a <dfn data-def="A periodic orbit around L1 or L2, out of the plane of the two bodies, that looks like a halo round the Sun or Earth.">halo orbit</dfn>, and fires its thrusters every few weeks.</p>`,
			notes: `<p>Seen from the stars at the moment shown, the probe at L1 needs a centripetal acceleration ω²r towards the centre of mass, with ω = 2π per year and r its distance from the centre of mass. The Sun supplies G M<sub>☉</sub>/r₁², Earth takes away G M<sub>⊕</sub>/r₂²; at L1 the difference equals ω²r exactly. The numbers on the stage come from the page’s model with the Sun’s and Earth’s (plus Moon’s) masses, so they include the small shift of the centre of mass. The thrusters are needed because L1 and L2 are unstable (next chapter): JWST plans a station-keeping burn about every three weeks.</p>`
		},
		// ------------------------------------------------------------------ energy
		{
			id: 'jacobi',
			chapter: 'energy',
			title: 'An energy that survives the turning frame',
			scene: 'map',
			hints: { focus: 'zvc' },
			duration: 26,
			controls: [energy, system, logmu],
			body: `
<p>The Coriolis force is always at right angles to the velocity, so it does no work. In the turning frame the probe therefore keeps a constant of its own, found by Jacobi in 1836:</p>
<p class="formula"><strong>C = 2Ω(x, y) − v²</strong></p>
<p>It is the only conserved quantity the problem has, an energy measured in the turning frame (higher energy, lower C). It cannot tell the probe’s path, but it tells where the path can never go: v² cannot be negative, so the probe is confined to where 2Ω ≥ C. The edge, where the probe would have to stop, is the <dfn data-def="The curve 2Ω(x, y) = C: where a probe with Jacobi constant C would have zero speed in the turning frame. It cannot cross it.">zero-velocity curve</dfn>; the shaded region beyond it is forbidden.</p>
<p>At this low energy the probe launched near the large body stays there for ever, its path filling a region it cannot leave. Raise the energy and the forbidden region shrinks.</p>`,
			notes: `<p>Multiply the equations of motion by ẋ and ẏ and add: the Coriolis terms cancel and d(½v²)/dt = dΩ/dt, so v² − 2Ω stays fixed. Hill (1878) used these curves to prove that the Moon can never leave Earth: its Jacobi constant in the Sun–Earth problem is above C1. The model’s integrator keeps C to better than one part in 10⁹ over a year of Earth–Moon time.</p>`
		},
		{
			id: 'gates',
			chapter: 'energy',
			title: 'Gates at L1, L2 and L3',
			scene: 'map',
			hints: { focus: 'gates' },
			duration: 28,
			controls: [energy, system, logmu],
			body: `
<p>Raise the energy past the mark 1 and the region round the large body and the region round the small one touch at L1: a gate opens, and the probe can cross from one to the other. Past 2 a second gate opens at L2, and the probe can leave the pair altogether. Past 3 the gate behind the large body opens at L3, and past 4 (C = 3, the value at L4 and L5) nothing in the plane is forbidden.</p>
<p>The gates open in this order because the Jacobi constant of a probe at rest is highest at L1 and lowest at L4 and L5: C1 &gt; C2 &gt; C3 &gt; C4 = C5 = 3. The inset follows the necks round the small body. Low-energy paths through these gates are how comets are briefly captured by Jupiter and how spacecraft travel between the Earth–Moon and Sun–Earth points on very little fuel.</p>`,
			notes: `<p>A probe just past a gate does not pass through it at once: the open neck is narrow and only paths aimed at it get through. The bundles of paths that do are organised by the unstable orbits round L1 and L2, a structure studied by Conley (1968) and later used to plan the Genesis mission’s trajectory.</p>`
		},
		// ------------------------------------------------------------------ stability
		{
			id: 'knife-edge',
			chapter: 'stability',
			title: 'L1 and L2: balanced on a knife edge',
			scene: 'drift',
			duration: 26,
			controls: [drop, system, logmu],
			body: `
<p>Drop a probe 1,000 km from L1 at rest, and watch it drift away. L1, L2 and L3 are passes (saddles) of the potential energy, and the Coriolis force cannot hold a probe on a pass: any small offset grows exponentially, by a factor e every 23 days near Sun–Earth L1 or L2, and every 1.5 days near the Moon’s. After four months a probe dropped 1,000 km from Sun–Earth L1 is 100,000 km away; near the Moon it is tens of thousands of kilometres off within a week.</p>
<p>That is the station-keeping JWST needs: it notes where it is drifting and fires its thrusters every few weeks, before the error has grown. It also explains why so little dust or debris collects at L1 and L2.</p>`,
			notes: `<p>Linearise the equations round a point: small offsets grow as e<sup>λt</sup>, with λ from λ⁴ + (4 − Ω<sub>xx</sub> − Ω<sub>yy</sub>)λ² + Ω<sub>xx</sub>Ω<sub>yy</sub> − Ω<sub>xy</sub>² = 0. At the collinear points the product Ω<sub>xx</sub>Ω<sub>yy</sub> is negative, so one root λ² is positive: a real, growing λ ≈ 2.5 per unit time (2π is one turn) for small μ, which is the 23 days at Sun–Earth. The same equation also has an oscillating pair of roots; halo and Lissajous orbits are built on them.</p>`
		},
		{
			id: 'tadpole',
			chapter: 'stability',
			title: 'L4 and L5: tadpoles, like Jupiter’s Trojans',
			scene: 'trojan',
			hints: { mode: 'tadpole' },
			duration: 30,
			controls: [lead, system, logmu],
			body: `
<p>Drop a probe a few degrees ahead of L4 instead, at rest in the turning frame (drag it along the orbit). It does not stay, but it does not leave either: it creeps along the orbit, turns back, and swings round L4 in a long loop shaped like a <dfn data-def="A loop round L4 or L5, elongated along the small body's orbit, traced by a body that librates about the point.">tadpole</dfn>, for as long as you wait. L4 is a hilltop of the potential energy, not a pass, and there the Coriolis force turns a probe that starts to slide off it sideways, into a loop round the point.</p>
<p>Jupiter’s <dfn data-def="Asteroids that share Jupiter's orbit, librating round its L4 or L5 point: the Greeks ahead of it, the Trojans behind.">Trojan asteroids</dfn>, more than 10,000 of them known, do exactly this round the Sun–Jupiter L4 and L5, each swing taking about 150 years, a dozen of Jupiter’s orbits. Drop the probe farther from L4 and the tadpole grows, until it almost reaches L3.</p>`,
			notes: `<p>Small swings about L4 have two periods: a fast one, close to the orbital period, and the slow libration, 2π/√(27μ/4) to first order in μ: 12.5 Jupiter years, 148 years, for Sun–Jupiter. NASA’s Lucy spacecraft, launched in 2021, is on its way to visit several Trojans. Earth has known Trojans too (2010 TK7 and 2020 XL5), on wide, eccentric loops. For the Earth–Moon pair the restricted problem leaves out the Sun, whose pull makes the Earth–Moon L4 and L5 far less stable than this model shows.</p>`
		},
		{
			id: 'routh',
			chapter: 'stability',
			title: 'Stable only for a light partner',
			scene: 'trojan',
			hints: { mode: 'routh' },
			duration: 28,
			controls: [routhMu],
			body: `
<p>The Coriolis force can hold a probe near the top of the hill at L4 only while the small body is light enough. Linearising round L4, small offsets only oscillate when</p>
<p class="formula"><strong>27 μ(1 − μ) &lt; 1, that is μ &lt; 0.0385</strong></p>
<p>a limit found by Routh in 1875: the small body must have less than about 1 in 26 of the total mass. Push the slider past it and the same probe, dropped 1° ahead of L4, spirals out of its tadpole: slowly just past the limit, within a few dozen orbits by μ = 0.045. Sun–Jupiter (1 in 1,048), Sun–Earth and Earth–Moon (1 in 82) are all well inside the limit; Pluto and Charon (1 in 9) are not, and can keep no Trojans.</p>`,
			notes: `<p>At L4 the characteristic equation becomes λ⁴ + λ² + (27/4)μ(1 − μ) = 0; its roots λ² are real and negative, and λ purely imaginary (pure oscillation), only while 1 − 27μ(1 − μ) ≥ 0. Just below the limit the probe needs a smaller offset to stay, since the stable region shrinks; and at two mass ratios inside it, where the two periods of the oscillation are in the ratio 2 : 1 (μ ≈ 0.0243) or 3 : 1 (μ ≈ 0.0135), the nonlinear terms can still make L4 unstable (Deprit and Deprit-Bartholomé, 1967). Try 0.0245: the probe escapes although the limit says it should not. The 3 : 1 case is too slow to see here.</p>`
		},
		// ------------------------------------------------------------------ chaos
		{
			id: 'split',
			chapter: 'chaos',
			title: 'Two probes, a hair apart',
			scene: 'split',
			duration: 32,
			controls: [nudge],
			body: `
<p>Away from the five points the restricted problem is chaotic. Two probes start between the Earth and the Moon, the second 1 km from the first, with the same velocity and enough energy to pass the L1 gate. For months they fly as one; then a close pass by the Moon sends them on different paths, and within weeks they are hundreds of thousands of kilometres apart.</p>
<p>Make the nudge smaller: 1 metre instead of 1 km buys only about four more months together. The gap grows exponentially between encounters, so each tenfold improvement in where the probe starts adds a roughly fixed span of time to the forecast. That, not the lack of a formula, is what makes the three-body problem unpredictable: a computer can follow any one path as closely as you like, but no measurement is good enough to say which path a real body is on, far ahead.</p>`,
			notes: `<p>The Jacobi constant still holds both probes inside the same region (the shading, with only the L1 gate open), so chaos here is confined: neither can leave the Earth and the Moon. Spacecraft on such paths are steered by small corrections, which is cheap precisely because the paths are so sensitive. The general three-body problem, with all three masses free, adds more chaos still: the solar system itself is chaotic over tens of millions of years (Laskar, 1989).</p>`
		}
	]
};
