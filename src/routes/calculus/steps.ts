import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Which curve the reader works with; dragging a round knot switches to "your own". */
const curve: Control = {
	type: 'select',
	id: 'curve',
	label: 'Curve',
	default: 'parabola',
	options: [
		{ value: 'parabola', label: 'Parabola: y = x²' },
		{ value: 'cubic', label: 'Cubic: a hill and a valley' },
		{ value: 'wave', label: 'Sine wave' },
		{ value: 'ball', label: 'Height of a ball thrown upwards' },
		{ value: 'custom', label: 'Your own (drag the round knots)' }
	],
	help: 'Pick “your own”, or drag one of the hollow knots, to shape the curve yourself.'
};

/** The point on the curve (or the right edge of the area); the scenes' handles write to it. */
const x: Control = {
	type: 'range',
	id: 'x',
	label: 'Point at x',
	min: 0,
	max: 3,
	step: 0.01,
	default: 1,
	format: (v) => v.toFixed(2),
	help: 'Or drag the point along the curve (or focus it and use the arrow keys).'
};

const h: Control = {
	type: 'range',
	id: 'h',
	label: 'Run h',
	min: 0.01,
	max: 1.5,
	step: 0.01,
	default: 1,
	format: (v) => v.toFixed(2),
	help: 'The horizontal gap between the two points of the chord.'
};

const n: Control = {
	type: 'range',
	id: 'n',
	label: 'Number of rectangles n',
	min: 1,
	max: 100,
	step: 1,
	default: 4
};

const rule: Control = {
	type: 'select',
	id: 'rule',
	label: 'Height of each rectangle',
	default: 'left',
	options: [
		{ value: 'left', label: 'Left edge' },
		{ value: 'mid', label: 'Midpoint' },
		{ value: 'right', label: 'Right edge' }
	],
	help: 'Where along its width each rectangle meets the curve.'
};

export const spec: ExplainerSpec = {
	slug: 'calculus',
	title: 'Calculus: slopes, areas and how they undo each other',
	summary:
		'Slide a point along a curve you shape yourself to see its slope, pile up rectangles to measure the area beneath it, and watch the two ideas turn out to be each other in reverse.',
	chapters: [
		{ id: 'slope', title: 'The slope at a point' },
		{ id: 'area', title: 'The area under a curve' },
		{ id: 'ftc', title: 'Each undoes the other' }
	],
	steps: [
		// ------------------------------------------------------------------ slope
		{
			id: 'steepness',
			chapter: 'slope',
			title: 'How steep is a curve?',
			scene: 'slope',
			hints: { phase: 'chord' },
			controls: [x, curve],
			body: `
<p>Calculus is the mathematics of change. Its first question sounds simple: <strong>how steep is a curve at a point?</strong></p>
<p>For a straight line the answer is its <dfn data-def="How much a line rises for each step to the right: rise ÷ run. Negative when the line goes down.">slope</dfn>: go some distance to the right (the <em>run</em>), see how far the line goes up (the <em>rise</em>), and divide, <strong>slope = rise ÷ run</strong>. A slope of 3 means 3 up for every 1 across; a negative slope means the line goes down. On a straight line it is the same wherever you measure.</p>
<p>A curve is different. On the parabola <i>y</i> = <i>x</i>², join the point at <i>x</i> = 1 to the point one step to the right with a straight <dfn data-def="A straight line segment joining two points of a curve.">chord</dfn>: it rises from 1 to 4, a slope of 3. Drag the point along the curve: further right the chord gets steeper, at the bottom of the curve it is almost flat. The steepness changes from place to place.</p>`,
			notes: `<p>Every graph in this explainer uses different scales on its two axes, so that the whole curve fits. A slope of 1 then does not look like 45°: trust the numbers, not the angle on the screen.</p>`
		},
		{
			id: 'chord',
			chapter: 'slope',
			title: 'Shrinking the run',
			scene: 'slope',
			hints: { phase: 'secant' },
			controls: [h, x, curve],
			body: `
<p>A chord measures the curve's <em>average</em> steepness between two points. To get the steepness <em>at</em> one point, bring the second point closer: make the run <i>h</i> smaller.</p>
<p class="formula"><strong>slope of the chord = (f(x + h) − f(x)) ÷ h</strong></p>
<p>Here <i>f</i>(<i>x</i>) means “the height of the curve at <i>x</i>”. On <i>y</i> = <i>x</i>² from <i>x</i> = 1, a run of 1 gives a slope of 3, a run of 0.5 gives 2.5, a run of 0.1 gives 2.1, and a run of 0.01 gives 2.01. Slide <i>h</i> down and watch: the chords settle on one line, and their slopes close in on one number, 2.</p>
<p>You cannot simply set <i>h</i> = 0 — that would be 0 ÷ 0 — but you can ask what the slopes approach as <i>h</i> shrinks. That value is a <dfn data-def="The value a quantity gets as close as you like to, as something else (here h) gets closer and closer to a target (here 0), without ever having to reach it.">limit</dfn>, the idea that the whole of calculus rests on.</p>`
		},
		{
			id: 'tangent',
			chapter: 'slope',
			title: 'The tangent and the derivative',
			scene: 'slope',
			hints: { phase: 'tangent' },
			controls: [x, curve],
			body: `
<p>The line the chords settle on is the <dfn data-def="The straight line that just touches a curve at a point and runs in the same direction as the curve there.">tangent</dfn>: the straight line that touches the curve at the point and runs the same way the curve does there. Zoom in far enough on any smooth curve and it looks like its tangent.</p>
<p>The slope of the tangent is the <strong><dfn data-def="The slope of a curve at a point: the limit of the chord slopes (f(x + h) − f(x)) ÷ h as h shrinks to 0. Written f′(x) or dy/dx.">derivative</dfn></strong> of the curve at that point, written <strong>f′(x)</strong> (“f prime of x”) or <strong>dy/dx</strong> — a tiny rise over a tiny run.</p>
<p>Slide the point along the curve. Where the curve climbs, the tangent tilts up and the derivative is positive; where it falls, the derivative is negative; at the very bottom of the parabola the tangent is flat and the derivative is 0.</p>`,
			notes: `<p>For <i>y</i> = <i>x</i>² the limit can be worked out exactly: ((<i>x</i> + <i>h</i>)² − <i>x</i>²) ÷ <i>h</i> = (2<i>xh</i> + <i>h</i>²) ÷ <i>h</i> = 2<i>x</i> + <i>h</i>, which tends to 2<i>x</i> as <i>h</i> shrinks. At <i>x</i> = 1 that is the 2 the chords were closing in on.</p>`
		},
		{
			id: 'slope-curve',
			chapter: 'slope',
			title: 'Plotting the slope: a second curve',
			scene: 'slope',
			hints: { phase: 'graph' },
			controls: [x, curve],
			body: `
<p>Every point of the curve has its own slope. Plot that slope, point by point, on a second graph underneath, with the same <i>x</i> axis: you get a new curve, the <strong>derivative f′</strong>.</p>
<p>For the parabola <i>y</i> = <i>x</i>² the slope at <i>x</i> is always 2<i>x</i>: 0 at the bottom, 2 at <i>x</i> = 1, 6 at <i>x</i> = 3. So the derivative of <i>x</i>² is the straight line <strong>2<i>x</i></strong>. Drag the point and check the two readings against each other.</p>
<p>Switch the curve to the cubic or the sine wave. Wherever the top curve has a hilltop or a valley floor, the slope curve crosses zero; where the top curve is steepest, the slope curve peaks. The derivative of a sine wave is another wave, shifted a quarter of a period: a cosine.</p>`,
			notes: `<p>A few derivatives worth knowing: a constant has slope 0; <i>x</i> has slope 1; <i>x</i>² has 2<i>x</i>; <i>x</i>³ has 3<i>x</i>²; in general <i>x</i><sup><i>n</i></sup> has <i>n</i><i>x</i><sup><i>n</i>−1</sup>. And sin <i>x</i> has slope cos <i>x</i> when <i>x</i> is in radians (<a href="../unit-circle/#radians">why radians</a>). With these and a few rules for combining them, the derivative of almost any formula can be worked out by hand.</p>`
		},
		{
			id: 'your-curve',
			chapter: 'slope',
			title: 'Shape your own curve',
			scene: 'slope',
			hints: { phase: 'edit' },
			controls: [curve, x],
			body: `
<p>Now drag the hollow round <em>knots</em> up and down to shape a curve of your own (a smooth curve is drawn through them), or focus one and use the arrow keys. The slope curve follows every change.</p>
<p>Try to predict it before you look. A curve that climbs steadily has a slope curve that stays above zero. Make a hill: the slope is positive on its way up, zero on top, negative on its way down. Make a stretch nearly straight: the slope curve goes flat there, because a straight line has the same slope everywhere.</p>
<p>That is all a derivative is: <strong>the slope of a curve at each point</strong>, which is a rate of change — how fast the height changes as you move along. Position changing over time has a speed; a population changing over time has a growth rate. Both are derivatives.</p>`
		},
		// ------------------------------------------------------------------ area
		{
			id: 'rectangles',
			chapter: 'area',
			title: 'Area under a curve, in rectangles',
			scene: 'area',
			hints: { phase: 'rects' },
			controls: [n, curve],
			body: `
<p>The second question of calculus: <strong>how much area lies between a curve and the <i>x</i> axis?</strong> For a rectangle or a triangle there is a formula; a curved edge has none.</p>
<p>So approximate. Cut the stretch from <i>x</i> = 0 to 3 into <i>n</i> strips of equal width and replace each strip by a rectangle as tall as the curve at the strip's left edge. Rectangles are easy: width × height. Add them up.</p>
<p>Under the parabola <i>y</i> = <i>x</i>², four rectangles give about 5.9. That is too little: each rectangle stops below the rising curve and leaves a sliver uncovered. Add more rectangles with the slider and watch the slivers shrink.</p>`,
			notes: `<p>A sum of rectangles like this is called a <dfn data-def="An approximation of the area under a curve by a sum of thin rectangles, named after the mathematician Bernhard Riemann (1826–1866).">Riemann sum</dfn>.</p>`
		},
		{
			id: 'converge',
			chapter: 'area',
			title: 'More, thinner rectangles',
			scene: 'area',
			hints: { phase: 'converge' },
			controls: [n, rule, curve],
			body: `
<p>The graph underneath plots the total of the rectangles against their number <i>n</i> (on a scale where each step is a doubling). With more and thinner rectangles the total creeps up on one value and stays there: under <i>y</i> = <i>x</i>², 100 rectangles give about 8.87, and the totals close in on <strong>exactly 9</strong>.</p>
<p>The gap shrinks in a regular way: <strong>double the rectangles and the error halves</strong>. The leftover slivers each get half as wide and about half as tall, and there are twice as many of them.</p>
<p>Change how each rectangle meets the curve. Right edges overshoot the rising parabola instead of falling short, and close in from above. Midpoints are far better: their small overshoot and undershoot within each strip nearly cancel, and doubling <i>n</i> cuts their error to a quarter.</p>`
		},
		{
			id: 'integral',
			chapter: 'area',
			title: 'The integral',
			scene: 'area',
			hints: { phase: 'integral' },
			controls: [curve],
			body: `
<p>The value the rectangle sums close in on is the <strong><dfn data-def="The exact area between a curve and the x axis over a stretch: the limit of the rectangle sums as they get thinner and more numerous. Area below the axis counts as negative.">integral</dfn></strong> of the curve:</p>
<p class="formula"><strong>∫₀³ x² dx = 9</strong></p>
<p>The tall S, ∫, is an old long <i>s</i> for “sum”: the integral is a sum of infinitely many infinitely thin rectangles, each <i>f</i>(<i>x</i>) tall and <i>dx</i> wide. The 0 and the 3 say where the area starts and ends.</p>
<p>Pick the sine wave. Where the curve dips below the axis, its rectangles have negative heights, so that area counts as <strong>negative</strong>. Over its full wave the area above (about 2.86) and the area below (about −2.86) cancel: the integral is 0. An integral is a <em>signed</em> area — the total of what was added and taken away.</p>`
		},
		// ------------------------------------------------------------------ ftc
		{
			id: 'running',
			chapter: 'ftc',
			title: 'The running area',
			scene: 'ftc',
			hints: { phase: 'running' },
			controls: [x, curve],
			body: `
<p>Now let the right-hand edge of the area move. Start at 0 and sweep the edge to the right, adding up area as you go. The total so far is the <strong>running area</strong>, <i>A</i>(<i>x</i>): the area under the curve from 0 up to <i>x</i>.</p>
<p>Plot it underneath and it is a new curve. Under <i>y</i> = <i>x</i>² it starts flat, then climbs ever faster, and reaches 9 at <i>x</i> = 3, the integral of the previous step.</p>
<p>Pick the sine wave: the running area climbs while the curve is above the axis, and falls again while the curve is below it, back to 0 at the end.</p>`
		},
		{
			id: 'area-slope',
			chapter: 'ftc',
			title: 'The slope of the area is the curve',
			scene: 'ftc',
			hints: { phase: 'strip' },
			controls: [x, curve],
			body: `
<p>How fast does the running area grow? Move the edge a tiny step <i>dx</i> to the right. The area gains one thin strip, about <i>f</i>(<i>x</i>) tall and <i>dx</i> wide, so it grows by <i>f</i>(<i>x</i>) × <i>dx</i>. Divide by the run <i>dx</i>:</p>
<p class="formula"><strong>slope of A at x = f(x)</strong></p>
<p>The slope of the running area is the height of the original curve. Where the curve is tall the area grows fast; where the curve is at zero the area stops growing; where the curve is below the axis the area shrinks. Drag the point and compare the two numbers: they agree everywhere, on every curve.</p>
<p>This is the <strong><dfn data-def="The two halves of one result: the slope of the running area under f is f itself, and adding up the slopes f′ from a to b gives back the change f(b) − f(a).">fundamental theorem of calculus</dfn></strong>: taking the slope undoes adding up the area.</p>`,
			notes: `<p>Under <i>y</i> = <i>x</i>² the running area is <i>A</i>(<i>x</i>) = <i>x</i>³ ÷ 3, and the slope of <i>x</i>³ ÷ 3 is 3<i>x</i>² ÷ 3 = <i>x</i>², the curve itself. That is how integrals are worked out exactly: find a function whose derivative is the curve. That is how ∫₀³ <i>x</i>² d<i>x</i> = 3³ ÷ 3 = 9.</p>`
		},
		{
			id: 'undo',
			chapter: 'ftc',
			title: 'Adding up slopes rebuilds the curve',
			scene: 'ftc',
			hints: { phase: 'undo' },
			controls: [x, curve],
			body: `
<p>It works the other way round too. Start from the slope curve <i>f</i>′ and add up the area under it from 0 to <i>x</i>. Each thin strip is a slope times a small run, that is, a small rise. All the small rises add up to the whole rise:</p>
<p class="formula"><strong>area under f′ from 0 to x = f(x) − f(0)</strong></p>
<p>Drag the point: the shaded area under the slope curve always equals how far the top curve has risen since <i>x</i> = 0 (negative where it ended lower). Shape your own curve and it still holds.</p>
<p>So <strong>a derivative is a slope at a point, an integral is an accumulated area, and each undoes the other.</strong></p>`
		},
		{
			id: 'motion',
			chapter: 'ftc',
			title: 'Speed and distance',
			scene: 'ftc',
			hints: { phase: 'motion', curve: 'ball' },
			controls: [x],
			body: `
<p>Calculus was invented, by Isaac Newton and Gottfried Leibniz in the late 17th century, largely to describe motion. Throw a ball straight up at 14.7 m/s. Gravity takes away 9.8 m/s of its speed every second, so its height after <i>t</i> seconds is <strong>h = 14.7 t − 4.9 t²</strong>.</p>
<p>The slope of the height curve is the <dfn data-def="How fast the position changes, with a direction: here positive going up, negative coming down. Measured in metres per second.">velocity</dfn>: 14.7 m/s at the throw, 0 at the top after 1.5 s, −14.7 m/s when the ball lands at 3 s. Underneath, the area under the velocity curve is the height gained: by 1.5 s it adds up to about 11.0 m, the top of the throw.</p>
<p>Position → slope → velocity; velocity → area → position. The same pair links velocity and acceleration, and it is how <a href="../newtons-laws/">Newton's laws</a> turn forces into motion.</p>`
		}
	]
};
