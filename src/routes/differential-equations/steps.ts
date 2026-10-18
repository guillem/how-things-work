import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Growth rate of the colony, per hour; 0 is left out (nothing would change). */
const RATES = Array.from(
	{ length: 27 },
	(_, i) => Math.round((-0.5 + i * 0.05) * 100) / 100
).filter((v) => v !== 0);
const r: Control = {
	type: 'range',
	id: 'r',
	label: 'Growth rate r',
	min: -0.5,
	max: 0.8,
	step: 0.05,
	default: 0.3,
	values: () => RATES,
	format: (v) => `${v.toFixed(2).replace('-', '−')} per hour`,
	help: 'Negative: the colony dies off instead.'
};

const room: Control = {
	type: 'range',
	id: 'room',
	label: 'Room temperature',
	min: 0,
	max: 40,
	step: 1,
	default: 20,
	unit: '°C'
};

const exact: Control = {
	type: 'toggle',
	id: 'exact',
	label: 'Overlay the exact formula',
	default: true
};

const add: Control = {
	type: 'action',
	id: 'add',
	label: 'Add a curve',
	action: 'Add a curve',
	help: 'Or click anywhere on the plot. Drag the newest start, or move it with the arrow keys.'
};

const clear: Control = {
	type: 'action',
	id: 'clear',
	label: 'Start again',
	action: 'Back to the first curves'
};

const harvest = (id: string, value: number): Control => ({
	type: 'range',
	id,
	label: 'Harvest H',
	min: 0,
	max: 20,
	step: 0.5,
	default: value,
	format: (v) => `${v.toFixed(1)} % of K a year`,
	help: 'The catch taken every year, whatever the stock.'
});

const signRule: Control = {
	type: 'select',
	id: 'signRule',
	label: 'Rule',
	default: 'logistic',
	options: [
		{ value: 'growth', label: 'growth' },
		{ value: 'cooling', label: 'cooling' },
		{ value: 'logistic', label: 'logistic' }
	]
};

const crossRule: Control = {
	type: 'select',
	id: 'crossRule',
	label: 'Rule',
	default: 'logistic',
	options: [
		{ value: 'growth', label: 'growth' },
		{ value: 'cooling', label: 'cooling' },
		{ value: 'logistic', label: 'logistic' },
		{ value: 'harvest', label: 'harvest' },
		{ value: 'riccati', label: 't − y²' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'differential-equations',
	title: 'Differential equations',
	summary:
		'Give a rule for how fast something changes, see it as a field of slope arrows, and drop starting points to trace the one curve through each: a growing colony, a cooling coffee, a population with a ceiling, and a fish stock whose level line vanishes when the catch grows too big.',
	chapters: [
		{ id: 'rule', title: 'A rule for the slope' },
		{ id: 'level', title: 'Level lines and where curves go' },
		{ id: 'harvest', title: 'Fishing until the level line vanishes' },
		{ id: 'formula', title: 'No formula needed' }
	],
	steps: [
		// ------------------------------------------------------------------ rule
		{
			id: 'rule',
			chapter: 'rule',
			title: 'A rule for the slope, not a curve',
			scene: 'field',
			hints: { rule: 'growth', phase: 'field' },
			controls: [r],
			body: `
<p><a href="../calculus/#tangent">Calculus</a> starts from a curve and finds its slope. A <dfn data-def="An equation that gives the rate of change of a quantity in terms of the quantity itself (and perhaps the time): dy/dt = f(t, y).">differential equation</dfn> goes the other way: it gives the slope and asks for the curve.</p>
<p>Take a colony of bacteria with plenty of food. Each cell divides now and then, so the more cells there are, the faster their number grows:</p>
<p class="formula"><strong>dy/dt = r · y</strong></p>
<p>with <i>y</i> in thousands of cells, <i>t</i> in hours and the growth rate <i>r</i> = 0.3 per hour. The rule doesn't say what <i>y</i> is at any time. It says how steep the curve must be at every point of the plane: at <i>y</i> = 50 the colony gains 15 thousand cells an hour, at <i>y</i> = 10 only 3 thousand.</p>
<p>Draw that slope as a short dash at a grid of points and the plane fills with a <dfn data-def="Short line segments drawn at a grid of points (t, y), each with the slope f(t, y) that the equation prescribes there.">slope field</dfn>. Change <i>r</i>: the dashes steepen, flatten or turn down (a negative <i>r</i> is a colony dying off). The rule is the whole field, and one curve is already threading through it.</p>`
		},
		{
			id: 'follow',
			chapter: 'rule',
			title: 'Drop a start and follow the arrows',
			scene: 'field',
			hints: { rule: 'growth', phase: 'follow' },
			controls: [r, exact, add, clear],
			body: `
<p>A starting value is all the rule needs. Click anywhere on the plot to drop a start: from there the curve is traced by following the slope field forwards (and backwards) in time, a tiny step at a time, each step in the direction the dashes point.</p>
<p>The computer takes 3000 steps across the plot, with a method (<dfn data-def="The classical fourth-order Runge–Kutta method: each step samples the slope four times (at the start, twice at the midpoint, at the end) and moves by a weighted average of them.">RK4</dfn>) that samples the slope four times per step to allow for its change along the way.</p>
<p>This rule happens to have a formula. The function whose slope is <i>r</i> times itself is the exponential, so the curve through <i>y</i>₀ at <i>t</i>₀ is</p>
<p class="formula"><strong>y = y₀ · e<sup>r(t − t₀)</sup></strong></p>
<p>Overlay it (dashed): it lies right on the traced curve. The panel gives the largest gap between the two: less than a billionth of a thousand cells. At <i>r</i> = 0.3 the colony doubles every ln 2 / 0.3 ≈ 2.3 hours, whatever its size.</p>`,
			notes: `<p>The simplest way to follow the arrows is <dfn data-def="Euler's method: from (t, y), move to (t + h, y + h·f(t, y)), using the slope at the start of each step.">Euler's method</dfn>: move along the slope at the start of each step, look again, repeat. It always cuts corners a little (here, the slope rises during a step, so Euler falls behind), and its error shrinks only in proportion to the step <i>h</i>: halve the step, halve the error. RK4's error shrinks like <i>h</i>⁴, so halving the step makes it about 16 times smaller, which is why 3000 steps are plenty here. Too large a step can do worse than be inaccurate: on some equations it makes the numbers blow up, a story of its own.</p>`
		},
		{
			id: 'cooling',
			chapter: 'rule',
			title: 'Coffee cooling towards the room',
			scene: 'field',
			hints: { rule: 'cooling', phase: 'follow' },
			controls: [room, exact, add, clear],
			body: `
<p>A mug of hot coffee loses heat faster the hotter it is compared with the room. <dfn data-def="The rate at which an object's temperature changes is proportional to the difference between its temperature and its surroundings'.">Newton's law of cooling</dfn>:</p>
<p class="formula"><strong>dT/dt = −k · (T − T<sub>room</sub>)</strong></p>
<p>with <i>T</i> in °C, <i>t</i> in minutes and <i>k</i> = 0.05 per minute (an illustrative value: it depends on the mug). Above room temperature the dashes point down, below it they point up, and on the line <i>T</i> = <i>T</i><sub>room</sub> they are flat.</p>
<p>So every curve heads for that line: coffee at 90 °C cools to about 62 °C in 10 minutes and 36 °C in 30, a cold drink warms towards the same line, and a drink already at room temperature stays there. The exact curve is <i>T</i> = <i>T</i><sub>room</sub> + (<i>T</i>₀ − <i>T</i><sub>room</sub>)·e<sup>−<i>k</i>(<i>t</i> − <i>t</i>₀)</sup>: the gap to the room halves every ln 2 / <i>k</i> ≈ 14 minutes. Move the room temperature and the whole field moves with it.</p>`,
			notes: `<p>Newton's law is a good description when heat leaves mainly by convection and the temperature difference is moderate. A real mug also loses heat by evaporation from the surface, which is strongest when the coffee is hottest, so its first minutes are a little faster than this curve.</p>`
		},
		// ------------------------------------------------------------------ level
		{
			id: 'logistic',
			chapter: 'level',
			title: 'Growth with a ceiling',
			scene: 'field',
			hints: { rule: 'logistic', phase: 'level' },
			controls: [exact, add, clear],
			body: `
<p>No colony grows exponentially for ever: food and room run out. The <dfn data-def="Growth in proportion to the population, slowed as it approaches the carrying capacity K: dN/dt = r·N·(1 − N/K). Pierre-François Verhulst, 1838.">logistic</dfn> rule slows the growth as the population <i>N</i> nears the <dfn data-def="The largest population the environment can sustain.">carrying capacity</dfn> <i>K</i>:</p>
<p class="formula"><strong>dN/dt = r · N · (1 − N/K)</strong></p>
<p>Here a stock of fish, measured in per cent of <i>K</i>, with <i>r</i> = 0.5 per year. Small stocks grow almost exponentially; the growth is fastest at <i>K</i>/2; above <i>K</i> the factor (1 − <i>N</i>/<i>K</i>) is negative and the stock shrinks back.</p>
<p>Two lines are level: <i>N</i> = 0 (no fish, no births) and <i>N</i> = <i>K</i>. These <dfn data-def="Values where dy/dt = 0: a curve that starts there stays there for ever.">equilibria</dfn> are the only constant solutions. Every curve that starts between them rises towards <i>K</i>: below <i>K</i>/2 it first steepens, then flattens after passing <i>K</i>/2 (an S), and from above <i>K</i>/2 it flattens from the start. Every curve above <i>K</i> falls to it. The exact formula is <i>N</i> = <i>K</i> <i>N</i>₀ / (<i>N</i>₀ + (<i>K</i> − <i>N</i>₀) e<sup>−<i>r</i>(<i>t</i> − <i>t</i>₀)</sup>), and the traced curves sit on it.</p>`,
			notes: `<p>The <a href="../ecosystems/#growth">ecosystems</a> page grows rabbits on the same rule and then adds foxes. With two populations that drive each other, the state is a point in a plane rather than a height on one axis, and the picture becomes a flow in that plane: a topic for a page of its own.</p>`
		},
		{
			id: 'sign',
			chapter: 'level',
			title: 'Stable or unstable: read the sign of f',
			scene: 'field',
			hints: { rule: 'signRule', phase: 'sign' },
			controls: [signRule, add, clear],
			body: `
<p>When the rule depends only on <i>y</i>, dy/dt = <i>f</i>(<i>y</i>), there is a shortcut to where every curve goes: plot <i>f</i> itself (on the right). Where <i>f</i> &gt; 0 the quantity rises, where <i>f</i> &lt; 0 it falls, and the zeros of <i>f</i> are the level lines.</p>
<p>The arrows on the strip beside the plot summarise it. An equilibrium is <dfn data-def="Curves that start near it move towards it.">stable</dfn> when <i>f</i> goes from positive below it to negative above it: both neighbours are pushed back towards it. It is <dfn data-def="Curves that start near it move away from it.">unstable</dfn> when the signs are the other way round.</p>
<p>For the logistic rule, <i>f</i>(<i>N</i>) = <i>rN</i>(1 − <i>N</i>/<i>K</i>) is an upside-down parabola: positive between 0 and <i>K</i>, negative outside. So <i>N</i> = 0 is unstable (a few fish multiply away from it) and <i>N</i> = <i>K</i> is stable. Switch rules: the colony's single equilibrium, 0, is unstable when <i>r</i> &gt; 0; the room temperature is stable. No formula was needed for any of this.</p>`
		},
		{
			id: 'cross',
			chapter: 'level',
			title: 'Curves never cross',
			scene: 'field',
			hints: { rule: 'crossRule', phase: 'cross' },
			controls: [crossRule, add, clear],
			body: `
<p>Drop as many starts as you like: the curves crowd together, but they never cross. For rules as smooth as these, a theorem guarantees that through every point of the plane there passes <strong>exactly one</strong> solution. So two different curves can never meet: at the meeting point there would be two solutions through one point. Knowing the slope everywhere is not quite enough on its own (see Go deeper); the smoothness of the rule is what rules out a second curve.</p>
<p>That is the sense in which the rule plus a start fixes the future: two different futures cannot start from the same state. The panel checks every pair of curves on the plot, sampled at 400 times, and counts crossings.</p>
<p>It also means that a curve can't cross a level line. A fish stock below <i>K</i> stays below <i>K</i> for ever; it only gets closer. Curves that run towards the same stable line come so close that they merge to the eye, but they never touch it or each other.</p>`,
			notes: `<p>"Exactly one" needs the rule to be smooth enough: if <i>f</i> and its rate of change in <i>y</i> are continuous, the Picard–Lindelöf theorem guarantees a single solution through each point, at least for a while. Without that it can fail. For dy/dt = √<i>y</i> (with <i>y</i> ≥ 0) both <i>y</i> = 0 and the curve that is 0 up to <i>t</i> = 0 and <i>t</i>²/4 after it pass through (0, 0), with the same slope there. The second curve could just as well start rising at any later moment: √<i>y</i> changes infinitely fast with <i>y</i> at <i>y</i> = 0, and uniqueness fails.</p>`
		},
		// ------------------------------------------------------------------ harvest
		{
			id: 'harvest',
			chapter: 'harvest',
			title: 'A steady catch',
			scene: 'field',
			hints: { rule: 'harvest', phase: 'harvest', H: 'H' },
			controls: [harvest('H', 8), add, clear],
			body: `
<p>Now fish the stock: take a fixed catch <i>H</i> every year, whatever the stock size (a quota).</p>
<p class="formula"><strong>dN/dt = r · N · (1 − N/K) − H</strong></p>
<p>On the right, the parabola <i>f</i> is lowered by <i>H</i>, and its two zeros move inwards. With <i>H</i> = 8 per cent of <i>K</i> a year, the level lines are at <i>N</i> = 20 and <i>N</i> = 80. The upper one is stable: the fished stock settles there. The lower one is unstable, and it is a threshold. A stock that starts above 20 recovers to 80; one that starts below it shrinks ever faster, because the same catch is a larger share of fewer fish, and it reaches zero: from 15, in about 4 years.</p>
<p>Raise the catch and both lines move towards the middle, <i>N</i> = <i>K</i>/2 = 50: the safety margin between the stock and the threshold shrinks.</p>`,
			notes: `<p>This is the logistic surplus-production model of fisheries science (Schaefer's), here with a constant catch; real stocks fluctuate, and real quotas are revised. The equation does have a formula (separate the variables and use partial fractions), but a long one in three cases; the page just follows the arrows.</p>`
		},
		{
			id: 'collapse',
			chapter: 'harvest',
			title: 'Past rK/4 the level line vanishes',
			scene: 'field',
			hints: { rule: 'harvest', phase: 'collapse', H: 'H2' },
			controls: [harvest('H2', 16), add, clear],
			body: `
<p>The stock can replace at most what it produces at its fastest, at <i>N</i> = <i>K</i>/2: <i>r</i>·(<i>K</i>/2)·(1/2) = <strong><i>rK</i>/4</strong>, here 12.5 per cent of <i>K</i> a year. At exactly that catch the two level lines meet at 50 and merge into one. Above it, the parabola lies entirely below zero: there is <strong>no level line at all</strong>, and every curve, from any starting stock, falls to zero. The change is abrupt: a slightly larger catch doesn't give a slightly smaller stock, it removes the equilibrium. (This merging and vanishing of two equilibria is called a <dfn data-def="A bifurcation in which a stable and an unstable equilibrium move together as a parameter changes, merge, and disappear.">saddle-node bifurcation</dfn>.)</p>
<p>With <i>H</i> = 16 a stock starting at 80 is gone in about 15 years. Lower the catch to 13, just past the edge: the decline is slow near <i>K</i>/2, where <i>f</i> is only just below zero, and a stock that starts at 80 is still at about 41 after 40 years. It looks almost steady, but no level line holds it.</p>`,
			notes: `<p>The slow passage is the "ghost" of the vanished equilibrium. Near <i>N</i> = 50, <i>f</i> ≈ −(<i>r</i>/<i>K</i>)(<i>N</i> − 50)² − (<i>H</i> − <i>rK</i>/4), and crossing that bottleneck takes about π / √((<i>r</i>/<i>K</i>)(<i>H</i> − <i>rK</i>/4)) years, which grows without limit as <i>H</i> comes down to <i>rK</i>/4. Cutting the catch back to just under <i>rK</i>/4 doesn't rescue a stock that has already fallen below the new threshold: it keeps collapsing.</p>`
		},
		// ------------------------------------------------------------------ formula
		{
			id: 'no-formula',
			chapter: 'formula',
			title: 'Most equations have no simple formula',
			scene: 'field',
			hints: { rule: 'riccati', phase: 'formula' },
			controls: [add, clear],
			body: `
<p>Growth, cooling and the logistic rule have short formulas, and that is the exception. Here is an innocent-looking rule in which the slope depends on the time as well, so the field changes from left to right:</p>
<p class="formula"><strong>dy/dt = t − y²</strong></p>
<p>Its solutions can be written with Airy functions, which are defined by an equation of this kind, but not with any formula built from powers, exponentials, logarithms, sines and their integrals (Liouville, 1841). That doesn't make the solutions any less definite: <strong>the slope field still fixes each curve</strong>, and following the arrows traces it as accurately as we like.</p>
<p>The dotted curve <i>y</i>² = <i>t</i> is where the dashes are flat. Starts above the dashed dividing curve all end up just under its upper half, <i>y</i> = √<i>t</i>; starts below the dividing curve plunge to −∞ (the plot loses them when they leave it). A start exactly on the divider follows it. The curves still never cross.</p>
<p>The same holds for most equations met in practice: <a href="../epidemics/">epidemics</a>, <a href="../ecosystems/">populations</a>, a <a href="../feedback-control/">controller</a> steering a car. Some couple several quantities, but the idea is the same: a rule for the rates of change, a starting state, and the one path the arrows lead along.</p>`,
			notes: `<p>With <i>y</i> = <i>u</i>′/<i>u</i>, the equation becomes the linear <i>u</i>″ = <i>t</i>·<i>u</i>, Airy's equation, whose solutions Ai and Bi are not elementary. The dividing curve is the solution <i>y</i> = Ai′(<i>t</i>)/Ai(<i>t</i>), drawn by following the arrows backwards from far along it, where it hugs −√<i>t</i>. The curve √<i>t</i> is not a solution itself (its slope is 1/(2√<i>t</i>), not 0), but the solutions above the divide stay close below it, ever closer as <i>t</i> grows.</p>`
		}
	]
};
