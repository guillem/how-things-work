import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { fnFor } from './taylor';

/** The degree of the Taylor polynomial: one more term at a time. Shared by every step. */
const n: Control = {
	type: 'range',
	id: 'n',
	label: 'Degree n',
	min: 0,
	max: 30,
	step: 1,
	default: 6,
	help: 'The polynomial keeps the terms up to (x − a)ⁿ.'
};

/** Steps that compare the two functions without singularities. */
const fnEntire: Control = {
	type: 'select',
	id: 'fnEntire',
	label: 'Function',
	default: 'sin',
	options: [
		{ value: 'sin', label: 'sin x' },
		{ value: 'exp', label: 'eˣ' }
	]
};

/** The complex-plane steps: all four functions. */
const fn: Control = {
	type: 'select',
	id: 'fn',
	label: 'Function',
	default: 'runge',
	options: [
		{ value: 'runge', label: '1/(1 + x²)' },
		{ value: 'log', label: 'log(1 + x)' },
		{ value: 'exp', label: 'eˣ' },
		{ value: 'sin', label: 'sin x' }
	]
};

/** Where the error is measured on the step about sin and eˣ (far out, where it is interesting). */
const probe: Control = {
	type: 'range',
	id: 'probe',
	label: 'Error measured at x',
	min: -4,
	max: 4,
	step: 0.05,
	default: 4,
	format: (v) => v.toFixed(2).replace('-', '−'),
	help: 'Or drag the marker on the x axis of the curve.'
};

/** The same for the two functions with a finite radius (just outside it, by default). */
const probeOut: Control = { ...probe, id: 'probeOut', default: 1.5 };

/** The centre of the series; log(1 + x) only has a series about points right of −1. */
const a: Control = {
	type: 'range',
	id: 'a',
	label: 'Centre a',
	min: -3,
	max: 3,
	bounds: (p) => fnFor(p.fn).centre,
	step: 0.05,
	default: 0,
	format: (v) => v.toFixed(2).replace('-', '−'),
	help: 'Or drag the centre along the real axis of the complex plane.'
};

const cheb: Control = {
	type: 'toggle',
	id: 'cheb',
	label: 'Show the Chebyshev interpolant',
	default: true
};

export const spec: ExplainerSpec = {
	slug: 'taylor-series',
	title: 'Taylor series & where they stop working',
	summary:
		'Add terms to a Taylor polynomial and watch it hug eˣ and sin x ever further out, but give up at |x| = 1 on the harmless-looking 1/(1 + x²); then find the reason off the real line, in a disk of convergence that stops at the nearest complex singularity.',
	chapters: [
		{ id: 'build', title: 'Polynomials that copy a function' },
		{ id: 'wall', title: 'Where they stop' },
		{ id: 'plane', title: 'The reason is in the complex plane' },
		{ id: 'fit', title: 'Fitting the whole interval anyway' }
	],
	steps: [
		// ------------------------------------------------------------------ build
		{
			id: 'copy',
			chapter: 'build',
			title: 'Matching more and more derivatives',
			scene: 'series',
			hints: { phase: 'copy', fn: 'exp' },
			controls: [n],
			body: `
<p>The <a href="../calculus/#tangent">tangent line</a> copies a function at one point: the same value and the same slope. Ask for more: a polynomial with the same second derivative there as well, the same third, and so on up to the <i>n</i>-th. There is exactly one of degree at most <i>n</i>, the <dfn data-def="The polynomial of degree at most n whose value and first n derivatives at the centre a equal those of f.">Taylor polynomial</dfn> about the centre <i>a</i>:</p>
<p class="formula"><strong>P<sub>n</sub>(x) = f(a) + f′(a)(x − a) + f″(a)/2! · (x − a)² + … + f<sup>(n)</sup>(a)/n! · (x − a)<sup>n</sup></strong></p>
<p>The <i>k</i>! undoes the <i>k</i>! that differentiating (<i>x</i> − <i>a</i>)<sup><i>k</i></sup> <i>k</i> times produces, so each term fixes one derivative without disturbing the others. Letting <i>n</i> → ∞ gives the <dfn data-def="The infinite sum Σ f⁽ᵏ⁾(a)/k! · (x − a)ᵏ. Whether it adds up to f(x), and for which x, is the question of this page.">Taylor series</dfn>.</p>
<p>For e<sup><i>x</i></sup> about 0 every derivative is 1, so P<sub><i>n</i></sub> = 1 + <i>x</i> + <i>x</i>²/2 + <i>x</i>³/6 + … + <i>x</i><sup><i>n</i></sup>/<i>n</i>!. Raise the degree: degree 1 is the tangent, and each new term holds the polynomial to the curve a little further from 0. Degree 10 already gives e² within 0.0001.</p>`
		},
		{
			id: 'bound',
			chapter: 'build',
			title: "How far off? Taylor's theorem",
			scene: 'series',
			hints: { phase: 'bound' },
			controls: [n, probe, fnEntire],
			body: `
<p>Taylor's theorem says how far off the polynomial is: the error at <i>x</i> looks like the next term, with the (<i>n</i> + 1)-th derivative taken at some point ξ between <i>a</i> and <i>x</i>:</p>
<p class="formula"><strong>f(x) − P<sub>n</sub>(x) = f<sup>(n+1)</sup>(ξ) / (n + 1)! · (x − a)<sup>n+1</sup></strong></p>
<p>So if |<i>f</i><sup>(<i>n</i>+1)</sup>| ≤ <i>M</i> between <i>a</i> and <i>x</i>, the error is at most <i>M</i> |<i>x</i> − <i>a</i>|<sup><i>n</i>+1</sup> / (<i>n</i> + 1)!. Every derivative of sin is ±sin or ±cos, so <i>M</i> = 1, and the factorial beats any power: however far out <i>x</i> is, the bound goes to 0, and the series adds up to sin <i>x</i> everywhere.</p>
<p>The chart plots the error at one point (drag it along the <i>x</i> axis) against the degree, on a logarithmic scale, with the bound dashed above it. At <i>x</i> = 4, degree 7 is still off by more than 0.5 and degree 11 by 0.01. (sin has only odd powers, so an even degree adds nothing and the error moves in steps.) Switch to e<sup><i>x</i></sup>: there <i>M</i> = e<sup>max(<i>a</i>, <i>x</i>)</sup>, and the factorial still wins.</p>`
		},
		// ------------------------------------------------------------------ wall
		{
			id: 'wall',
			chapter: 'wall',
			title: '1/(1 + x²): a wall at |x| = 1',
			scene: 'series',
			hints: { phase: 'wall', fn: 'runge' },
			controls: [n, probeOut],
			body: `
<p>Now a gentle bump, <i>f</i>(<i>x</i>) = 1/(1 + <i>x</i>²): never infinite, smooth on the whole real line, with derivatives of every order. About 0 it is a geometric series in −<i>x</i>²: 1 − <i>x</i>² + <i>x</i>⁴ − <i>x</i>⁶ + …</p>
<p>Inside the shaded band, |<i>x</i>| &lt; 1, more terms close in: at <i>x</i> = 0.5, degree 10 gives 0.7998 for the true 0.8. Outside it, with this centre, <strong>every new nonzero term makes things worse</strong>: at <i>x</i> = 2 the degree-10 polynomial is −819, for a true value of 0.2, and degree 30 is about −8.6 × 10⁸. Drag the point past 1 and watch the error chart turn upwards. More terms do not always mean a better fit.</p>
<p>Not even the edge is safe. At <i>x</i> = ±1 the series is 1 − 1 + 1 − 1 + …: its partial sums jump between 1 and 0 and never settle on the true 0.5. And nothing visible on the real line explains the wall: the curve is perfectly calm at <i>x</i> = 1 and beyond.</p>`,
			notes: `<p>Taylor's bound can't see past the wall either. For real <i>t</i>, partial fractions give |<i>f</i><sup>(<i>m</i>)</sup>(<i>t</i>)| ≤ <i>m</i>!/(1 + <i>t</i>²)<sup>(<i>m</i>+1)/2</sup> ≤ <i>m</i>!, so <i>M</i> = (<i>n</i> + 1)! is a valid choice, and the bound becomes |<i>f</i>(<i>x</i>) − P<sub><i>n</i></sub>(<i>x</i>)| ≤ |<i>x</i>|<sup><i>n</i>+1</sup>. That proves convergence for |<i>x</i>| &lt; 1 and says nothing outside it.</p>
<p>Outside the radius the partial sums never converge, but a single added term can still happen to help: about <i>a</i> = 1, at <i>x</i> = −1 (outside <i>R</i> = √2), the error is 2 at degree 2 but exactly 0 at degree 4, and again at every fourth degree after it, while the degrees in between swing ever wider. The series still diverges there: what fails is the whole sequence of partial sums, not every single step.</p>`
		},
		{
			id: 'log',
			chapter: 'wall',
			title: 'log(1 + x): trouble on one side, a wall on both',
			scene: 'series',
			hints: { phase: 'wall', fn: 'log' },
			controls: [n, probeOut],
			body: `
<p>About 0, log(1 + <i>x</i>) = <i>x</i> − <i>x</i>²/2 + <i>x</i>³/3 − … Here the left wall has an obvious cause: log(1 + <i>x</i>) plunges to −∞ at <i>x</i> = −1, and no polynomial can follow it there.</p>
<p>But the series fails just as much on the right, beyond <i>x</i> = 1, where the function rises calmly: at <i>x</i> = 1.5, degree 8 gives −0.91 and degree 16 gives −23, for the true 0.92. A power series converges on an interval <strong>symmetric about its centre</strong>: trouble at distance 1 on one side stops it at distance 1 on the other side too.</p>
<p>The ends themselves have to be checked one by one: at <i>x</i> = 1 this series does converge, slowly, to log 2; at −1 it does not.</p>`,
			notes: `<p>Why symmetric (Abel's lemma): if Σ <i>c<sub>k</sub></i> <i>h</i><sup><i>k</i></sup> converges at some <i>h</i>₀, its terms are bounded, |<i>c<sub>k</sub></i> <i>h</i>₀<sup><i>k</i></sup>| ≤ <i>B</i>. For any |<i>h</i>| &lt; |<i>h</i>₀| the terms are then below <i>B</i> (|<i>h</i>|/|<i>h</i>₀|)<sup><i>k</i></sup>, a convergent geometric series. Only the size |<i>h</i>| = |<i>x</i> − <i>a</i>| matters, not its sign — nor, as the next step uses, whether <i>h</i> is a real number at all.</p>`
		},
		// ------------------------------------------------------------------ plane
		{
			id: 'disk',
			chapter: 'plane',
			title: 'The disk of convergence',
			scene: 'series',
			hints: { phase: 'disk' },
			controls: [n, fn],
			body: `
<p>A polynomial can be fed <a href="../complex-numbers/">complex numbers</a> as easily as real ones, and the argument of the last step works for them unchanged: a power series about <i>a</i> converges inside a <strong>disk</strong> |<i>z</i> − <i>a</i>| &lt; <i>R</i> of the complex plane and diverges outside it. The interval on the real line is just where that disk crosses the real axis (dashed lines link the two).</p>
<p>In the complex plane, 1/(1 + <i>z</i>²) is not harmless at all: 1 + <i>z</i>² = 0 at <i>z</i> = ±<i>i</i>, where it blows up. The series cannot converge there, so <i>R</i> ≤ 1. And it converges right up to there: a function that is complex-differentiable everywhere inside a disk about <i>a</i> has a Taylor series that converges to it on the whole disk (Cauchy). So <strong>the disk grows until it touches the nearest singularity</strong>, and <i>R</i> = 1, the distance from 0 to ±<i>i</i>. The wall at <i>x</i> = ±1 is the shadow of two points that are not on the real line at all.</p>
<p>The coefficients know it too: 1/<i>R</i> = lim sup |<i>c<sub>k</sub></i>|<sup>1/<i>k</i></sup> (the root test), estimated on the right from <i>c</i>₁₀₀ to <i>c</i>₂₀₀ and plotted for the first 60. Here lim sup is the level the largest of the |<i>c<sub>k</sub></i>|<sup>1/<i>k</i></sup> settle towards as <i>k</i> grows, ignoring the ones that dip below: for this bump about 0 the odd coefficients are 0 and the even ones are ±1, so it is 1. Switch function: log(1 + <i>z</i>) has its singularity at −1, so <i>R</i> = 1 again; e<sup><i>z</i></sup> and sin <i>z</i> have none anywhere, and their disk is the whole plane.</p>`,
			notes: `<p>All of this assumes the function is <dfn data-def="Equal to its Taylor series near every point: for functions of a complex variable, the same as being complex-differentiable there.">analytic</dfn> at the centre. Being infinitely differentiable on the real line is not enough: <i>f</i>(<i>x</i>) = e<sup>−1/<i>x</i>²</sup> (with <i>f</i>(0) = 0) has every derivative 0 at <i>x</i> = 0, so its Taylor series about 0 is 0 + 0 + 0 + … It converges everywhere, to the wrong function. In the complex plane, e<sup>−1/<i>z</i>²</sup> behaves wildly near 0, which is exactly where the trouble hides.</p>
<p>The root test is the Cauchy–Hadamard formula. On a screen the lim sup has to be estimated from finitely many coefficients; for log(1 + <i>x</i>), whose coefficients carry an extra 1/<i>k</i>, the estimate from <i>c</i>₁₀₀ to <i>c</i>₂₀₀ is still about 3 per cent high.</p>`
		},
		{
			id: 'recentre',
			chapter: 'plane',
			title: 'Move the centre, and the disk follows',
			scene: 'series',
			hints: { phase: 'recentre' },
			controls: [a, n, fn],
			body: `
<p>Drag the centre <i>a</i> along the real axis. For 1/(1 + <i>x</i>²) the disk keeps touching ±<i>i</i>, so its radius is <strong><i>R</i> = √(1 + <i>a</i>²)</strong>, and the stretch of the real line where the series converges grows to match.</p>
<p>About <i>a</i> = 2, <i>R</i> = √5 ≈ 2.24: the series now converges from −0.24 to 4.24, out to the right edge of the plot, though only a little to the left of 0. Nothing about the curve near <i>x</i> = 2 is better behaved than near 0; the centre is simply further from ±<i>i</i>.</p>
<p>For log(1 + <i>x</i>) the radius is 1 + <i>a</i>, the distance to −1. For e<sup><i>x</i></sup> and sin <i>x</i>, any centre gives a series that converges everywhere.</p>`
		},
		// ------------------------------------------------------------------ fit
		{
			id: 'chebyshev',
			chapter: 'fit',
			title: 'Chebyshev interpolation fits the whole interval',
			scene: 'series',
			hints: { phase: 'chebyshev', fn: 'runge' },
			controls: [n, cheb],
			body: `
<p>A Taylor polynomial spends all its effort on one point. To fit a whole interval, <dfn data-def="Choosing the polynomial that passes through the function's values at a set of points.">interpolate</dfn> instead: take the polynomial of degree at most <i>n</i> through the curve at <i>n</i> + 1 points of [−4, 4]. Equally spaced points would go badly wrong near the ends (Runge's phenomenon; this bump, rescaled, is Runge's own example). The <dfn data-def="The points cos(jπ/n), j = 0 … n, scaled to the interval: the shadows on the axis of equally spaced points on a semicircle. They crowd towards the ends.">Chebyshev points</dfn> crowd towards the ends instead, and the interpolant converges on the whole interval.</p>
<p>Degree 20 is within 0.007 of 1/(1 + <i>x</i>²) everywhere on [−4, 4], where the Taylor polynomial of the same degree is off by about 10¹² at <i>x</i> = ±4. The worst error shrinks geometrically, by a factor of about 1.28 per degree on average (about 12 every ten degrees), though not at every single step: this bump is even, and going from an even degree to the next odd one can make it worse.</p>
<p>That 1.28 comes from ±<i>i</i> as well. So the takeaway holds both ways: <strong>a Taylor series converges exactly out to the function's nearest singularity in the complex plane</strong>, even when nothing goes wrong on the real line, and those same singularities set how fast any polynomial can close in.</p>`,
			notes: `<p>The rate: map [−4, 4] to [−1, 1] and draw the ellipses with foci at the ends. The interpolant's error shrinks like ρ<sup>−<i>n</i></sup>, where ρ (the sum of the semi-axes) belongs to the largest ellipse with no singularity inside (Bernstein). The one through ±<i>i</i> has semi-axes √17/4 and 1/4, so ρ = (1 + √17)/4 ≈ 1.28. The disk of the Taylor series has become an ellipse.</p>
<p>A Chebyshev polynomial is a cosine in disguise: <i>T<sub>k</sub></i>(cos θ) = cos <i>k</i>θ. Writing <i>x</i> = cos θ turns a Chebyshev expansion into a Fourier cosine series, which is why the <a href="../fourier-transform/">fast Fourier transform</a> computes these interpolants in practice.</p>`
		}
	]
};
