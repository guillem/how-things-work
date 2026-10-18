import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const fmt = (v: number, d = 1) => {
	const s = Math.abs(v).toFixed(d);
	return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
};

/** One entry of the matrix A = [[a, b], [c, d]]. */
const entry = (id: string, label: string, value: number): Control => ({
	type: 'range',
	id,
	label,
	min: -3,
	max: 3,
	step: 0.1,
	default: value,
	format: (v) => fmt(v)
});
/** The damped spring x′ = y, y′ = −x − 0.5y. */
const spring = [entry('a', 'a', 0), entry('b', 'b', 1), entry('c', 'c', -1), entry('d', 'd', -0.5)];
/** A saddle with eigenvalues 1 and −1.5. */
const saddle = [
	entry('a2', 'a', 0.5),
	entry('b2', 'b', 1),
	entry('c2', 'c', 1),
	entry('d2', 'd', -1)
];

const lambda = (id: string, label: string, value: number, help?: string): Control => ({
	type: 'range',
	id,
	label,
	min: -2,
	max: 2,
	step: 0.05,
	default: value,
	format: (v) => fmt(v, 2),
	help,
	disabled: id === 'l2' ? (p) => Number(p.w) > 0 : undefined
});
const omega: Control = {
	type: 'range',
	id: 'w',
	label: 'Imaginary part ω',
	min: 0,
	max: 1.4,
	step: 0.05,
	default: 0,
	format: (v) => fmt(v, 2),
	help: 'Above 0 the eigenvalues are the pair λ₁ ± iω. Make λ₂ equal to λ₁ first: a complex pair leaves the real axis from a double root.',
	disabled: (p) => Number(p.w) === 0 && Math.abs(Number(p.l1) - Number(p.l2)) > 1e-9
};

const gamma: Control = {
	type: 'range',
	id: 'gamma',
	label: 'Friction γ',
	min: 0,
	max: 1,
	step: 0.05,
	default: 0.3,
	format: (v) => fmt(v, 2)
};

const at = (id: string, value: string, options: { value: string; label: string }[]): Control => ({
	type: 'select',
	id,
	label: 'Linearise at',
	default: value,
	options,
	help: 'Or point at a fixed point on the plane, or click it.'
});
const pendulumPoints = [
	{ value: 'bottom', label: 'hanging (0, 0)' },
	{ value: 'top', label: 'upside down (π, 0)' }
];

const zoom: Control = {
	type: 'range',
	id: 'zoom',
	label: 'Size of the circle',
	min: 0.1,
	max: 2.5,
	step: 0.05,
	default: 2,
	format: (v) => `radius ${v.toFixed(2)}`,
	help: 'Shrink it: the real orbits (solid) and the linear ones (dashed) close up.'
};

const twin: Control = {
	type: 'select',
	id: 'twin',
	label: 'Beside it',
	default: 'damped',
	options: [
		{ value: 'damped', label: 'damped pendulum' },
		{ value: 'inward', label: 'r′ = −r³' },
		{ value: 'outward', label: 'r′ = +r³' }
	]
};

const muH: Control = {
	type: 'range',
	id: 'muH',
	label: 'μ',
	min: -0.5,
	max: 1,
	step: 0.01,
	default: 0.25,
	format: (v) => fmt(v, 2),
	help: 'Drag it through 0.'
};

const muV: Control = {
	type: 'range',
	id: 'muV',
	label: 'μ',
	min: 0,
	max: 3,
	step: 0.1,
	default: 1,
	format: (v) => fmt(v, 1)
};

export const spec: ExplainerSpec = {
	slug: 'phase-portraits',
	title: 'Phase portraits & stability',
	summary:
		'Two quantities that drive each other move as a point in a plane. Drag the entries or the eigenvalues of a 2×2 system and watch its portrait turn node, saddle, spiral or centre on the trace–determinant chart; then linearise a pendulum, predators and prey and van der Pol’s oscillator at their fixed points, see where linearisation can’t decide, and push a parameter through a Hopf bifurcation to grow a limit cycle.',
	chapters: [
		{ id: 'linear', title: 'Linear systems' },
		{ id: 'nonlinear', title: 'Linearising a nonlinear flow' },
		{ id: 'borderline', title: 'Where linearisation can’t decide' },
		{ id: 'hopf', title: 'The birth of a limit cycle' }
	],
	steps: [
		// ------------------------------------------------------------------ linear
		{
			id: 'plane',
			chapter: 'linear',
			title: 'A state that moves: the phase plane',
			scene: 'linear',
			hints: { phase: 'plane', m: '' },
			controls: spring,
			body: `
<p>On the <a href="../differential-equations/#sign">differential equations</a> page one quantity followed a rule <i>y</i>′ = <i>f</i>(<i>y</i>). Now take two that drive each other, like the position <i>x</i> and the velocity <i>y</i> of a weight on a spring. Their state is a point (<i>x</i>, <i>y</i>) of a plane, and the rule gives its velocity there:</p>
<p class="formula"><strong>x′ = a·x + b·y,&nbsp; y′ = c·x + d·y</strong>, or <strong>v′ = A·v</strong></p>
<p>Each small arrow is that velocity (direction only). Starting from any point, the state follows the arrows along an <dfn data-def="The path traced in the phase plane by the state of a system as time goes on, from one starting state.">orbit</dfn>, traced here in small <dfn data-def="The classical fourth-order Runge–Kutta method: each step samples the velocity four times and moves by a weighted average of them.">RK4</dfn> steps forwards and backwards from a set of seeded starts; the dots ride along them. The whole picture is the <dfn data-def="The phase plane filled with representative orbits: one glance shows where every starting state goes.">phase portrait</dfn>.</p>
<p>With a = 0, b = 1, c = −1, d = −0.5 this is a spring with friction (<i>x</i>″ = −<i>x</i> − 0.5<i>x</i>′, as on the <a href="../oscillations-resonance/#damping">oscillations</a> page): every orbit spirals into the origin, the spring at rest. The origin is a <dfn data-def="A state where the velocity is zero: a system that starts there stays there.">fixed point</dfn> of every linear system. Drag the entries and watch the portrait change kind; as in one dimension, orbits never cross.</p>`
		},
		{
			id: 'eigen',
			chapter: 'linear',
			title: 'Straight-line orbits are eigenvectors',
			scene: 'linear',
			hints: { phase: 'eigen', m: '2' },
			controls: saddle,
			body: `
<p>Some orbits are straight lines through the origin. On such a line the velocity A·v points along v itself: A·v = λv, so v is an <a href="../linear-transformations/#eigenvectors">eigenvector</a> of A and λ its <dfn data-def="The number λ by which A stretches its eigenvector: A·v = λv. They are the roots of λ² − τλ + Δ = 0, with τ the trace and Δ the determinant of A.">eigenvalue</dfn>. Along it the state just grows or shrinks: v(<i>t</i>) = e<sup>λ<i>t</i></sup>·v(0).</p>
<p>Because the system is linear, every orbit is a sum of the two straight-line ones:</p>
<p class="formula"><strong>v(t) = c₁ e<sup>λ₁t</sup> v₁ + c₂ e<sup>λ₂t</sup> v₂</strong></p>
<p>Here A = [[0.5, 1], [1, −1]] has λ₁ = 1 along (2, 1) and λ₂ = −1.5 along (1, −2). States on the second line fall into the origin; all others are carried in along it and thrown out along the first, as e<sup>−1.5<i>t</i></sup> dies and e<sup><i>t</i></sup> grows: a <dfn data-def="A fixed point with one positive and one negative real eigenvalue: orbits come in along one eigenvector and leave along the other.">saddle</dfn>. Change the entries until both eigenvalues have the same sign and the saddle becomes a node; when they turn complex the straight lines vanish.</p>`
		},
		{
			id: 'kinds',
			chapter: 'linear',
			title: 'Node, saddle, spiral, centre',
			scene: 'linear',
			hints: { phase: 'kinds' },
			controls: [
				lambda('l1', 'Eigenvalue λ₁ (real part)', -0.5),
				lambda('l2', 'Eigenvalue λ₂', -2),
				omega
			],
			body: `
<p>The eigenvalues decide the portrait, so move them directly: drag the dots on the complex plane (right). The page builds a matrix with those eigenvalues (the panel shows it) and redraws.</p>
<ul>
<li><strong>Both real and negative:</strong> a stable <dfn data-def="A fixed point with two real eigenvalues of the same sign: orbits enter (or leave) it without turning around it.">node</dfn>. Orbits fall in, and arrive along the slower eigenvector, the one whose λ is nearer 0. Both positive: an unstable node.</li>
<li><strong>Real, opposite signs:</strong> a saddle.</li>
<li><strong>A complex pair λ ± iω:</strong> e<sup>(λ ± iω)<i>t</i></sup> = e<sup>λ<i>t</i></sup>(cos ω<i>t</i> ± i sin ω<i>t</i>), so orbits turn at the rate ω while shrinking (λ &lt; 0) or growing (λ &gt; 0) by e<sup>λ<i>t</i></sup>: a stable or unstable <dfn data-def="A fixed point with complex eigenvalues λ ± iω, λ ≠ 0: orbits wind around it, in or out.">spiral</dfn>.</li>
<li><strong>Pure imaginary, ±iω:</strong> a <dfn data-def="A fixed point surrounded by closed orbits.">centre</dfn>. Orbits are closed ellipses, each taking 2π/ω to go round.</li>
</ul>
<p>Real eigenvalues can't turn complex one at a time: they come off the real axis as a conjugate pair, from a double root. Drag one onto the other first (a <dfn data-def="Two equal real eigenvalues: the in-between case of a node and a spiral.">degenerate node</dfn>), then lift the pair off the axis: the node turns into a spiral.</p>`,
			notes: `<p>With real eigenvalues the page builds A = P·diag(λ₁, λ₂)·P⁻¹ with fixed eigenvectors (1, 0.25) and (−0.4, 1); with a complex pair, the rotation-and-stretch [[λ, −ω], [ω, λ]]. Both give λ·I when the pair meets the real axis, so the portrait changes continuously. Any other matrix with the same eigenvalues (and not equal to λ·I) is the same picture seen through a change of coordinates: a skewed, stretched copy.</p>`
		},
		{
			id: 'chart',
			chapter: 'linear',
			title: 'The trace–determinant chart',
			scene: 'linear',
			hints: { phase: 'chart', m: '' },
			controls: spring,
			body: `
<p>The eigenvalues are the roots of λ² − τλ + Δ = 0, where τ = a + d is the <dfn data-def="The sum of the diagonal entries of A, a + d. It equals λ₁ + λ₂.">trace</dfn> and Δ = ad − bc the <a href="../linear-transformations/#determinant">determinant</a>. So two numbers place every 2×2 system on one chart:</p>
<ul>
<li>Δ &lt; 0: a saddle (λ₁λ₂ = Δ, so the eigenvalues have opposite signs).</li>
<li>Δ &gt; 0 below the parabola τ² = 4Δ: a node; above it, complex eigenvalues: a spiral.</li>
<li>τ &lt; 0 stable, τ &gt; 0 unstable; on the half-line τ = 0, Δ &gt; 0: a centre.</li>
</ul>
<p>Drag the entries (back on the damped spring) and the marker moves. Notice what the borderlines are: the centres, the degenerate nodes and Δ = 0 (a whole line of fixed points) are lines on the chart, not regions. The slightest change of an entry moves a system off them. Everywhere else no eigenvalue has a zero real part, the fixed point is called <dfn data-def="No eigenvalue of the linearisation has real part zero.">hyperbolic</dfn>, and a small change of the entries can neither change its stability nor turn a saddle into anything else. That is about to matter.</p>`
		},
		// ------------------------------------------------------------------ nonlinear
		{
			id: 'pendulum',
			chapter: 'nonlinear',
			title: 'A pendulum: fixed points and their Jacobians',
			scene: 'nonlinear',
			hints: { sys: 'pendulum', at: 'at', phase: 'pendulum' },
			controls: [gamma, at('at', 'none', [{ value: 'none', label: 'nowhere' }, ...pendulumPoints])],
			body: `
<p>A real pendulum is not linear. With the angle θ and the angular velocity ω, and time in units of √(<i>L</i>/<i>g</i>):</p>
<p class="formula"><strong>θ′ = ω,&nbsp; ω′ = −sin θ − γω</strong></p>
<p>Its fixed points are where both rates vanish: ω = 0 and sin θ = 0. The page finds them without that algebra, by <dfn data-def="Repeatedly replace a guess p by p − J⁻¹·F(p), where F is the velocity and J its matrix of derivatives; near a root the error squares at every step.">Newton's method</dfn> started from a grid of guesses: hanging down at θ = 0 (and 2π, the same position), upside down at ±π.</p>
<p>Near a fixed point p, write the state as p + u. To first order (a <a href="../calculus/#tangent">tangent</a> in two dimensions) u′ = J·u, where the <dfn data-def="The matrix of the partial derivatives of the velocity (f, g) with respect to x and y, here [[0, 1], [−cos θ, −γ]].">Jacobian</dfn> J = [[0, 1], [−cos θ, −γ]] plays the part of A. Point at a fixed point, or pick one: hanging down, J has τ = −γ and Δ = 1, a stable spiral; upside down, Δ = −1, a saddle. The orbits through the saddles (orange) are the <dfn data-def="The orbits that enter or leave a saddle. They divide the plane into regions of different behaviour.">separatrices</dfn>: they divide swings that stay in one well from swings that go over the top first.</p>`,
			notes: `<p>θ and θ + 2π are the same position, so the plane really wraps round into a cylinder; the page draws two turns of it. With friction above γ = 2 the hanging fixed point turns from a spiral into a node: the pendulum creeps back without overshooting (the slider stops at 1).</p>`
		},
		{
			id: 'linearise',
			chapter: 'nonlinear',
			title: 'Close up, the flow is its linearisation',
			scene: 'nonlinear',
			hints: { sys: 'pendulum', at: 'atL', phase: 'linearise' },
			controls: [gamma, at('atL', 'top', pendulumPoints), zoom],
			body: `
<p>The circle on the right is a magnifier on the circle drawn around the chosen fixed point. Solid: the real orbits through eight starts. Dashed: the orbits of the linear system u′ = J·u through the same starts.</p>
<p>At the saddle they disagree near the edge of a big circle. Shrink it: the nonlinear terms (sin θ differs from θ by about θ³/6) fade faster than the linear ones, and the dashed and solid orbits close up. The panel measures the largest gap between them, as a share of the radius.</p>
<p>This is the <dfn data-def="Near a hyperbolic fixed point, a continuous change of coordinates carries the orbits of the nonlinear flow onto those of its linearisation.">Hartman–Grobman theorem</dfn>: near a <strong>hyperbolic</strong> fixed point the flow looks like its linearisation (the same stability, the same number of directions in and out). So a few fixed points and their eigenvalues sketch the whole portrait: two kinds of fixed point, joined by the separatrices, make the pendulum's.</p>`,
			notes: `<p>"Looks like" means topologically: the theorem promises a continuous deformation of the neighbourhood that maps orbits to orbits, not that they coincide. For a smooth system like this one the gap shrinks with the radius (here like its square), which is what the magnifier shows. The theorem says nothing at all about a fixed point with an eigenvalue on the imaginary axis.</p>`
		},
		{
			id: 'predator',
			chapter: 'nonlinear',
			title: 'Predators and prey: a centre that holds',
			scene: 'nonlinear',
			hints: { sys: 'predator', at: 'atP', phase: 'predator' },
			controls: [
				at('atP', 'coexist', [
					{ value: 'origin', label: 'none of either (0, 0)' },
					{ value: 'coexist', label: 'both (3, 2)' }
				])
			],
			body: `
<p>The <a href="../ecosystems/#cycles">ecosystems</a> page drew rabbits and foxes as two curves in time. As a portrait, with prey <i>x</i> and predators <i>y</i> (Lotka–Volterra):</p>
<p class="formula"><strong>x′ = x(1 − 0.5y),&nbsp; y′ = y(0.25x − 0.75)</strong></p>
<p>Two fixed points. At (0, 0) a saddle: prey alone grow, predators alone die. At (3, 2) the Jacobian is [[0, −1.5], [0.5, 0]]: τ = 0, Δ = 0.75, eigenvalues ±0.87i. <strong>A centre</strong>, on the borderline line of the chart, so Hartman–Grobman is silent.</p>
<p>Here the orbits really are closed loops, and the reason is not the linearisation: the quantity 0.25<i>x</i> − 0.75 ln <i>x</i> + 0.5<i>y</i> − ln <i>y</i> stays constant along every orbit, so each orbit is a closed level curve of it. Small loops take 2π/0.87 ≈ 7.3 time units, as the linearisation predicts; the big ones take longer and grow lopsided, but averaged over a loop the populations are exactly (3, 2).</p>`,
			notes: `<p>Most extra terms, such as crowding among the prey, destroy the invariant, and the centre becomes a spiral (in, for crowding): the populations settle. Real predator–prey cycles are kept going by other mechanisms, which is one reason the textbook model is a sketch.</p>`
		},
		// ------------------------------------------------------------------ borderline
		{
			id: 'pitfall',
			chapter: 'borderline',
			title: 'A centre in the linearisation decides nothing',
			scene: 'twin',
			hints: {},
			controls: [twin],
			body: `
<p>On the left, the pendulum without friction. At the bottom its Jacobian is [[0, 1], [−1, 0]]: eigenvalues ±i, a centre. And it is one: the energy ω²/2 − cos θ is conserved (the panel follows it along the orbit), so every swing below the top is a closed loop.</p>
<p>But the linearisation did not tell us that. Compare with the right:</p>
<ul>
<li><strong>damped pendulum:</strong> γ = 0.3 moves the eigenvalues off the imaginary axis to −0.15 ± 0.99i, a hyperbolic stable spiral; here the linearisation does decide.</li>
<li><strong>r′ = −r³:</strong> x′ = y − x(x² + y²), y′ = −x − y(x² + y²). Its Jacobian at the origin is exactly the frictionless pendulum's, [[0, 1], [−1, 0]]. Yet every orbit spirals in, slowly: <i>r</i> = 1/√(1/<i>r</i>₀² + 2<i>t</i>).</li>
<li><strong>r′ = +r³:</strong> the same linearisation again, and every orbit spirals <em>out</em>.</li>
</ul>
<p>Three systems, one linearisation, three fates. At a centre the linear terms balance exactly, and the nonlinear terms, which linearising throws away, decide. To prove a centre takes something more, such as a conserved energy.</p>`
		},
		// ------------------------------------------------------------------ hopf
		{
			id: 'hopf',
			chapter: 'hopf',
			title: 'A Hopf bifurcation',
			scene: 'nonlinear',
			hints: { sys: 'hopf', phase: 'hopf' },
			controls: [muH],
			body: `
<p>Put a dial on that borderline. The <dfn data-def="The simplest system with a Hopf bifurcation, to which every generic one reduces near the bifurcation point.">normal form</dfn></p>
<p class="formula"><strong>x′ = μx + y − x(x² + y²),&nbsp; y′ = −x + μy − y(x² + y²)</strong></p>
<p>is, in polar coordinates, <i>r</i>′ = μ<i>r</i> − <i>r</i>³ with a steady clockwise turn, φ′ = −1. At the origin the eigenvalues are μ ± i: drag μ and watch them on the complex plane.</p>
<p>For μ &lt; 0 a stable spiral. At μ = 0 the pair sits on the imaginary axis: the r′ = −r³ case of the last step, still pulling in, slowly. For μ &gt; 0 the origin is an unstable spiral, and the linearisation would have every orbit grow for ever. It doesn't: the −<i>r</i>³ term stops the growth where μ<i>r</i> = <i>r</i>³, at <strong><i>r</i> = √μ</strong>. Orbits from inside and outside wind onto that circle, a stable <dfn data-def="An isolated closed orbit that nearby orbits approach (stable) or leave (unstable): a self-sustained oscillation.">limit cycle</dfn>. The panel measures where the orbits settle and compares it with √μ.</p>
<p>This is a <dfn data-def="As a parameter changes, a pair of complex eigenvalues crosses the imaginary axis and a limit cycle is born (supercritical) or dies (subcritical) at the fixed point.">Hopf bifurcation</dfn>: the eigenvalues cross the imaginary axis, and a small cycle is born whose size grows like √μ. No fixed point predicts it: it exists only because of the nonlinear terms.</p>`,
			notes: `<p>This one is supercritical: the cubic term pulls in. With +<i>r</i>³ instead (the right-hand panel's third system) the bifurcation is subcritical: an <em>unstable</em> cycle of radius √(−μ) surrounds the stable origin for μ &lt; 0 and shrinks onto it as μ → 0, after which the state jumps away. Electrical oscillators, flutter of a wing and the onset of oscillations in <a href="../feedback-control/">feedback loops</a> with too much gain are Hopf bifurcations.</p>`
		},
		{
			id: 'vanderpol',
			chapter: 'hopf',
			title: 'Van der Pol’s oscillator',
			scene: 'nonlinear',
			hints: { sys: 'vanderpol', phase: 'vanderpol' },
			controls: [muV],
			body: `
<p>Balthasar van der Pol modelled a valve oscillator in 1926 with friction that pushes when the swing is small and brakes when it is large:</p>
<p class="formula"><strong>x′ = y,&nbsp; y′ = μ(1 − x²)y − x</strong></p>
<p>At the origin J = [[0, 1], [−1, μ]]: τ = μ, Δ = 1. For μ &gt; 0 an unstable spiral (a node beyond μ = 2), so small swings grow; large ones are braked. Every orbit except the fixed point itself winds onto one limit cycle, whose amplitude the panel measures: about 2 for every μ, 2.01 at μ = 1, with a period of 6.66 time units.</p>
<p>Raise μ: the cycle turns into a <dfn data-def="An oscillation that alternates slow build-ups with sudden jumps.">relaxation oscillation</dfn>, slow creeps along two branches and sudden jumps between them (the trace of <i>x</i> against time, under the panel). Lower μ to 0 and the friction vanishes: a centre, all circles.</p>
<p>Notice how this cycle is born. Unlike the normal form, it doesn't grow from nothing like √μ: at any μ &gt; 0, however small, it has amplitude about 2. Van der Pol's nonlinear term is itself proportional to μ, which makes μ = 0 a degenerate case. The general lesson stands: the eigenvalues say the origin repels, and only the nonlinear terms say where the orbits go instead.</p>`,
			notes: `<p>Liénard's theorem (1928) proves that van der Pol's system has exactly one limit cycle for every μ &gt; 0, and that it attracts every orbit but the fixed point. For small μ, averaging gives <i>r</i>′ ≈ (μ/2)<i>r</i>(1 − <i>r</i>²/4): the cycle sits at <i>r</i> = 2, and orbits approach it at a rate proportional to μ, so slowly when μ is small. For large μ the period approaches (3 − 2 ln 2)·μ. The <a href="../chaos-fractals/#pendulum">chaos</a> page shows what a plane forbids: an autonomous flow in two dimensions can settle only on fixed points, cycles or loops of saddle connections (Poincaré–Bendixson), so chaos needs a third dimension or a periodic push.</p>`
		}
	]
};
