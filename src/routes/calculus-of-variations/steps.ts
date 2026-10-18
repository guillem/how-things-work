import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** How far across the end point is (m); the drop is always 2 m. Also the end point's handle. */
const span: Control = {
	type: 'range',
	id: 'span',
	label: 'Distance across L',
	min: 1,
	max: 8,
	step: 0.1,
	default: 4,
	unit: 'm',
	format: (v) => v.toFixed(1),
	help: 'The drop h stays 2 m. Or drag the end point B sideways.'
};

/** Where the optimiser starts. */
const from: Control = {
	type: 'select',
	id: 'from',
	label: 'Start from',
	default: 'yours',
	options: [
		{ value: 'yours', label: 'your curve' },
		{ value: 'line', label: 'the line' },
		{ value: 'arc', label: 'the arc' }
	]
};

const run: Control = { type: 'action', id: 'run', label: 'Optimiser', action: 'Run again' };

const chainLength: Control = {
	type: 'range',
	id: 'chain',
	label: 'Chain length',
	min: 4.4,
	max: 9,
	step: 0.1,
	default: 6,
	unit: 'm',
	format: (v) => v.toFixed(1),
	help: 'Between two hooks 4 m apart, at 1 kg per metre.'
};

const nudge: Control = {
	type: 'range',
	id: 'nudge',
	label: 'Nudge ε',
	min: -0.3,
	max: 0.3,
	step: 0.01,
	default: 0.2,
	format: (v) => v.toFixed(2).replace('-', '−'),
	help: 'Sways the links sideways; every link keeps its length.'
};

export const spec: ExplainerSpec = {
	slug: 'calculus-of-variations',
	title: 'The brachistochrone & calculus of variations',
	summary:
		'Race beads down a straight line, a circular arc and a ramp you shape yourself, then let gradient descent bend the ramp into the fastest one of all, a cycloid, while the Euler–Lagrange residual along it falls to zero; then hang a chain, where a Lagrange multiplier keeps its length, and turn it into an arch that is stationary but not the best.',
	chapters: [
		{ id: 'race', title: 'A race down a ramp' },
		{ id: 'best', title: 'Finding the fastest curve' },
		{ id: 'chain', title: 'A chain, a constraint, an arch' }
	],
	steps: [
		// ------------------------------------------------------------------ race
		{
			id: 'race',
			chapter: 'race',
			title: 'Which ramp is fastest?',
			scene: 'ramp',
			hints: { phase: 'race' },
			body: `
<p>A bead slides without friction from <b>A</b> to <b>B</b>, 4 m across and 2 m down, starting from rest. Which shape of wire gets it there first?</p>
<p>The straight line is the shortest path, and it loses: <strong>1.43 s</strong>. The circular arc that leaves A straight down is much longer, and takes only <strong>1.17 s</strong>. Galileo showed in 1638 that such an arc beats the straight chord, and suspected that the arc was the fastest of all.</p>
<p>Now shape your own ramp: drag the four round handles (or focus one and use the arrow keys). The race restarts each time. Can you beat the arc? A ramp that climbs back to the height of A stops the bead for good: it would need more energy than it has.</p>`,
			notes: `<p>In June 1696 Johann Bernoulli challenged the mathematicians of Europe to find this curve, the <dfn data-def="Greek for 'shortest time': the curve of fastest descent between two points.">brachistochrone</dfn>. Answers came from Newton, Leibniz, Jakob Bernoulli and Johann himself, among others. The beads here slide without friction and do not roll; a rolling ball keeps some of its energy in its spin and is slower on every track, but the fastest shape is the same.</p>`
		},
		{
			id: 'time',
			chapter: 'race',
			title: 'Adding up the time',
			scene: 'ramp',
			hints: { phase: 'time' },
			body: `
<p>Energy settles the speed: a bead that has dropped a depth <i>y</i> has turned <i>mgy</i> of potential energy into <i>½mv²</i> of kinetic energy, so <strong>v = √(2g·y)</strong>, whatever the shape of the track above it (the <a href="../newtons-laws/#track">roller-coaster track</a> works the same way). Every bead reaches B at the same speed, 6.3 m/s. What differs is how soon each one gets fast.</p>
<p>The time is then an <a href="../calculus/#integral">integral</a> along the curve, each short stretch <i>ds</i> taking <i>ds</i>/<i>v</i>:</p>
<p class="formula"><strong>T = ∫ ds / √(2g·y)</strong></p>
<p>The dots mark every tenth of a second. Where they crowd, the bead is slow. The steep start of the arc buys speed early: after half a second its bead has dropped 1.17 m and moves at 4.8 m/s, while the bead on the line has dropped only 0.25 m and moves at 2.2 m/s. A longer path at a higher speed can be quicker. The chart shows each bead's speed against time.</p>`,
			notes: `<p>At A the bead is at rest, so 1/<i>v</i> is infinite there. The integral is still finite: near A the integrand grows like 1/√<i>s</i>, and ∫ <i>ds</i>/√<i>s</i> = 2√<i>s</i> stays bounded. The page never evaluates the infinity. It cuts each curve into a few hundred short straight pieces; on a straight piece the acceleration is constant, so its time is exactly its length divided by the average of the speeds at its ends, 2ℓ/(<i>v</i>₀ + <i>v</i>₁), which is finite even for the first piece, where <i>v</i>₀ = 0. On the cycloid this agrees with the exact time to a millionth.</p>`
		},
		// ------------------------------------------------------------------ best
		{
			id: 'descend',
			chapter: 'best',
			title: 'Letting the curve find its way',
			scene: 'ramp',
			hints: { phase: 'descend' },
			controls: [from, run],
			body: `
<p>A curve has infinitely many numbers to tune, one depth for every point along it: T is a function of a whole function, a <dfn data-def="A function of a function: it takes a whole curve and returns a number, here the descent time.">functional</dfn>. The <i>calculus of variations</i> asks which curve makes it smallest.</p>
<p>A computer can ask it directly. Keep 48 points of the curve free to move up and down, work out how much the time changes when each one moves (the <a href="../gradient-descent/#descend">gradient</a>), and move them all a little downhill, then again. The optimiser starts from your curve and checks every step: each one makes the slide faster. In about 30 steps it is within a thousandth of a second of the best time, <strong>1.139 s</strong>.</p>
<p>The chart below shows the <dfn data-def="How much the time would change, per square metre of change, if the curve were pushed down a little at this point: δT/δy. Zero all along the curve at the optimum.">Euler–Lagrange residual</dfn> along the curve: how much the time would drop if the curve were pushed down a little at each place. It starts large and uneven, and shrinks towards zero everywhere. When it is zero at every point, no small change of shape helps.</p>`,
			notes: `<p>Plain gradient descent would crawl here: a jagged change of the curve moves the time much more than a smooth one, so the step that is safe for the jagged parts is far too small for the smooth ones (a <a href="../gradient-descent/#ravine">ravine</a>). The optimiser therefore measures the size of a change by its wiggliness as well as by its height, and its steepest-descent direction moves neighbouring points together. A backtracking line search halves any step that would not make the slide faster.</p>
<p>Written out for <i>F</i> = √(1 + <i>y</i>′²)/√(2<i>gy</i>), the residual is the left side of the <dfn data-def="∂F/∂y − d/dx ∂F/∂y′ = 0: the condition that a small change of the curve does not change ∫F dx to first order. Euler (1744) and Lagrange (1755).">Euler–Lagrange equation</dfn>, ∂<i>F</i>/∂<i>y</i> − d/d<i>x</i> ∂<i>F</i>/∂<i>y</i>′ = 0. On the screen it is the gradient of the time with respect to each point, divided by the stretch of <i>x</i> that point stands for.</p>`
		},
		{
			id: 'cycloid',
			chapter: 'best',
			title: 'The answer is a cycloid',
			scene: 'ramp',
			hints: { phase: 'cycloid' },
			body: `
<p>The optimum is a <dfn data-def="The curve traced by a point on the rim of a circle rolling along a straight line.">cycloid</dfn>: the path of a point on the rim of a wheel rolling along the underside of the line through A. Here the wheel has a radius of 1.03 m and turns through 201° to reach B, and the time has a closed form, <strong>T = θ·√(r/g) = 1.139 s</strong>.</p>
<p>There is something more: the bead stays on the rim of a wheel turning at a steady rate. Its rolling angle grows in proportion to the time, so the wheel in the drawing rolls at constant speed and the bead rides it to B.</p>
<p>The straight line loses by <strong>0.29 s</strong>: it takes a quarter longer. The arc, at 1.17 s, comes within 3 per cent, which is why Galileo could take it for the winner. Your curve can approach 1.139 s, but never beat it.</p>`,
			notes: `<p>The cycloid is also the <dfn data-def="Greek for 'same time': the curve on which a bead reaches the bottom in the same time wherever it starts.">tautochrone</dfn> (Huygens, 1673): release a bead anywhere on an upside-down arch and it reaches the bottom in π√(<i>r</i>/<i>g</i>), whatever its starting point. Huygens built pendulum clocks around it, so that their period would not depend on the swing.</p>`
		},
		{
			id: 'snell',
			chapter: 'best',
			title: 'Snell’s law for a bead',
			scene: 'ramp',
			hints: { phase: 'snell' },
			body: `
<p>Why a cycloid? The functional does not depend on <i>x</i> itself (shift the curve sideways and the time is the same), and then the Euler–Lagrange equation has a first integral, <dfn data-def="For an integrand F(y, y′) that does not depend on x: F − y′·∂F/∂y′ is constant along every solution of the Euler–Lagrange equation.">Beltrami's identity</dfn>. For this <i>F</i> it says:</p>
<p class="formula"><strong>sin φ / v = constant</strong></p>
<p>where φ is the angle of the curve from the vertical and <i>v</i> = √(2<i>gy</i>) the speed there. That is <a href="../light-optics/#snell">Snell's law</a>, with the bead's speed in place of light's: Johann Bernoulli solved the problem in 1696 by treating the bead as a ray of light passing through layers in which it travels faster and faster, bending at each one by the least-time rule.</p>
<p>The chart plots sin φ / <i>v</i> along each curve. On the cycloid it is flat, at 0.157 s/m: the curve leaves A vertically (φ = 0, where <i>v</i> = 0 too) and tilts exactly as fast as the bead gains speed. On the line it starts far too high (the bead is slow but the line is already tilted) and falls all the way; on the arc it starts too low (the arc stays steep for too long) and climbs.</p>`,
			notes: `<p>Beltrami gives <i>y</i>(1 + <i>y</i>′²) = 1/(2<i>gC</i>²), a constant; the cycloid with a rolling circle of radius <i>r</i> satisfies <i>y</i>(1 + <i>y</i>′²) = 2<i>r</i>, so <i>C</i> = 1/√(4<i>gr</i>). The same structure, a quantity conserved because the problem does not change along one direction, is how energy and angular momentum come out of the stationary action of a planet's path (<a href="../orbits-kepler/">Kepler orbits</a>).</p>`
		},
		{
			id: 'dip',
			chapter: 'best',
			title: 'Going below the finish',
			scene: 'ramp',
			hints: { phase: 'dip' },
			controls: [span],
			body: `
<p>Move B further across. Beyond a point, the fastest path <strong>dips below B</strong> and climbs back up to it: dropping deeper buys more speed than the climb costs.</p>
<p>It happens exactly when the distance across is more than π/2 times the drop, <strong>L &gt; 1.57·h</strong>. At that ratio B sits at the bottom of the arch, half a turn of the wheel, and the bead arrives travelling horizontally. At 4 m across the cycloid dips only 7 cm below B; at 6 m, 48 cm; at 8 m, a whole metre.</p>
<p>The flatter the trip, the worse the straight line does: 25 per cent slower than the cycloid at 4 m across, 40 per cent at 6 m and 54 per cent at 8 m. Bring B in to 1 m across and the line is only 10 per cent slower than the cycloid: nearly a free fall, where every path is nearly straight.</p>`
		},
		// ------------------------------------------------------------------ chain
		{
			id: 'chain',
			chapter: 'chain',
			title: 'A hanging chain: least energy, fixed length',
			scene: 'chain',
			hints: { phase: 'chain' },
			controls: [chainLength],
			body: `
<p>A chain hung from two hooks settles where its potential energy, ∫ ρ<i>g</i>·<i>y</i> <i>ds</i>, is least. But not over all curves: the chain cannot stretch, so only curves of its length count. That is a <dfn data-def="A condition the curves must satisfy, here a fixed length, rather than something to make small.">constraint</dfn>.</p>
<p>Lagrange's trick handles it: make the energy plus λ times the length stationary, with a number λ, the <dfn data-def="The extra number λ that turns a constrained problem into an unconstrained one: make E + λ·(length) stationary, then choose λ so that the length comes out right. It measures how fast the best E changes as the constraint is relaxed.">Lagrange multiplier</dfn>, chosen so the length comes out right. The answer is the <dfn data-def="Latin catena, chain: y = a·cosh(x/a), the shape of a hanging chain.">catenary</dfn>, <i>y</i> = <i>a</i>·cosh(<i>x</i>/<i>a</i>) + <i>c</i>, and λ turns out to be the <strong>tension at the hooks</strong>: what one more metre of chain would lower the energy by, per metre. For a 6 m chain of 1 kg/m on hooks 4 m apart it is 31.8 N, and the chain sags 2.01 m.</p>
<p>The dashed curve is the parabola of the same length. It looks close, and Galileo thought the chain's shape was nearly one, but its energy is higher: the chain's is the least.</p>`,
			notes: `<p>The drawn chain has 40 links, and each one is in balance: the horizontal pull is the same all along (12.1 N here), and the vertical pull grows by one link's weight from link to link, so the slopes of the links are evenly spaced. With more and more links that becomes the catenary, whose shape was found in 1691 by Leibniz, Huygens and Johann Bernoulli. The tension at a point is ρ<i>g</i> times its height above a line a distance <i>a</i> below the lowest point, so it is greatest at the hooks.</p>`
		},
		{
			id: 'arch',
			chapter: 'chain',
			title: 'Stationary is not the same as best',
			scene: 'chain',
			hints: { phase: 'arch' },
			controls: [chainLength, nudge],
			body: `
<p>Turn the chain upside down. The energy changes sign everywhere, so the arch satisfies the same Euler–Lagrange equation with the same multiplier: it is stationary too. Robert Hooke saw this in the 1670s: a hanging chain, inverted, gives the shape of an arch that stands in pure compression.</p>
<p>Now nudge both shapes the same way, keeping every link's length. The hanging chain's energy goes <strong>up</strong> whichever way you push it, and the arch's goes <strong>down</strong>: the chain is a minimum and the arch is a maximum, which is why a chain arch, unlike a stone one, collapses. In the chart both changes grow like ε², flat at ε = 0: neither shape changes to first order.</p>
<p>That is the whole of what the Euler–Lagrange equation promises. A curve that satisfies it is <strong>stationary</strong>: no small change helps or hurts to first order. Whether it is a minimum, a maximum or neither takes a further check. For the bead, the gradient descent of the last chapter, which only ever went downhill, and the races against every other curve settle it: the cycloid is the fastest.</p>`,
			notes: `<p>The further check is the second variation, the ε² term, and the conditions of Legendre and Jacobi on it. For the brachistochrone the cycloid passes them and is in fact the fastest of all curves from A to B. Light's least-time paths are not always least: a ray reflected from the inside of a curved mirror can take the longest time among nearby paths, and is still a ray. Physics only ever needs the stationary path.</p>`
		}
	]
};
