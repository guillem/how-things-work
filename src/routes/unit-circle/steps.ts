import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { radText } from './trig';

/** The angle of the point, in degrees; the scenes' handles write to it too. */
const angle: Control = {
	type: 'range',
	id: 'angle',
	label: 'Angle θ',
	min: 0,
	max: 360,
	step: 1,
	default: 30,
	format: (v) => `${v}° = ${radText(v)} rad`,
	help: 'Or drag the point on the circle (or focus it and use the arrow keys).'
};

/** The same angle with room to go round more than once, and backwards. */
const angleWide: Control = {
	...angle,
	min: -360,
	max: 720,
	help: 'Past 360° the point goes round again; below 0° it goes clockwise.'
};

const spin: Control = {
	type: 'toggle',
	id: 'spin',
	label: 'Spin the point',
	default: true,
	help: 'The point turns steadily; grab it to stop and steer it yourself.'
};

const snap: Control = {
	type: 'toggle',
	id: 'snap',
	label: 'Snap to special angles',
	default: false,
	help: 'Stick to multiples of 30° and 45°, where sine and cosine have exact values.'
};

const amplitude: Control = {
	type: 'range',
	id: 'amplitude',
	label: 'Radius (amplitude)',
	min: 0.25,
	max: 1.5,
	step: 0.05,
	default: 1,
	format: (v) => v.toFixed(2)
};

const frequency: Control = {
	type: 'range',
	id: 'frequency',
	label: 'Turns per second (frequency)',
	min: 0.1,
	max: 1.5,
	step: 0.05,
	default: 0.25,
	format: (v) => `${v.toFixed(2)} Hz`
};

export const spec: ExplainerSpec = {
	slug: 'unit-circle',
	title: 'Sine, cosine and the unit circle',
	summary:
		'Drag a point around a circle and watch its height and its sideways position trace out the two most important waves in mathematics.',
	chapters: [
		{ id: 'angles', title: 'Angles and the circle' },
		{ id: 'trig', title: 'Sine and cosine' },
		{ id: 'waves', title: 'From circle to wave' }
	],
	steps: [
		// ------------------------------------------------------------------ angles
		{
			id: 'circle',
			chapter: 'angles',
			title: 'A point on a circle',
			scene: 'circle',
			hints: { phase: 'angle' },
			controls: [angle],
			body: `
<p>Draw a circle of radius 1 around the centre of a pair of axes. This is the <dfn data-def="A circle of radius 1 centred at the origin (0, 0) of a coordinate grid.">unit circle</dfn>, and almost all of trigonometry lives on it.</p>
<p>Put a point on the circle and draw the line from the centre to it. The <strong>angle θ</strong> (the Greek letter theta) is how far that line has turned from the positive <i>x</i>-axis, measured <em>anticlockwise</em>.</p>
<p>Drag the point around. At 90° it is straight up, at 180° it points left, at 270° straight down, and at 360° it is back where it started.</p>`,
			notes: `<p>Measuring anticlockwise from the positive <i>x</i>-axis is a convention, chosen centuries ago and used everywhere in mathematics and physics. Compass bearings are different: they start at north and go clockwise.</p>`
		},
		{
			id: 'radians',
			chapter: 'angles',
			title: 'Radians: measuring angles by distance',
			scene: 'radians',
			duration: 18,
			controls: [angle],
			body: `
<p>Degrees split a full turn into 360 parts — a number chosen by the Babylonians, not by nature. Mathematicians prefer a natural unit: walk along the circle and measure the <em>distance</em> travelled.</p>
<p>On a unit circle, an arc as long as the radius makes an angle of <strong>1 <dfn data-def="The angle at the centre of a circle made by an arc as long as the radius. 1 radian ≈ 57.3°.">radian</dfn></strong>, about 57.3°. The whole circumference is 2π ≈ 6.28 radii long, so a full turn is <strong>2π radians</strong>: a little more than six radii fit around it.</p>
<p>That makes the conversion easy to remember: 180° = π radians. So 90° is π/2, 45° is π/4 and 30° is π/6.</p>`,
			notes: `<p>On a circle of radius <i>r</i>, an angle of θ radians cuts off an arc of length <i>r</i>θ. That simple rule is why radians are used in calculus and physics: formulas such as the speed of a point on a spinning wheel, or the derivative of sin θ, take their simplest form when θ is in radians.</p>`
		},
		// ------------------------------------------------------------------ trig
		{
			id: 'coordinates',
			chapter: 'trig',
			title: 'Cosine and sine are coordinates',
			scene: 'circle',
			hints: { phase: 'coords' },
			controls: [angle],
			body: `
<p>Here is the key idea. Drop a line from the point straight down to the <i>x</i>-axis, and another across to the <i>y</i>-axis. The point's two coordinates get names:</p>
<ul>
<li>its horizontal position is the <strong class="tag cos">cosine</strong> of the angle, <strong>cos θ</strong>;</li>
<li>its height is the <strong class="tag sin">sine</strong> of the angle, <strong>sin θ</strong>.</li>
</ul>
<p>So the point at angle θ is (cos θ, sin θ). That is the whole definition. At 0° the point is at (1, 0), so cos 0° = 1 and sin 0° = 0. At 90° it is at (0, 1).</p>
<p>Drag the point and watch the two coloured segments grow and shrink. Neither can ever be bigger than 1 or smaller than −1: the point never leaves the circle.</p>`
		},
		{
			id: 'triangle',
			chapter: 'trig',
			title: 'The right triangle inside',
			scene: 'circle',
			hints: { phase: 'triangle' },
			controls: [angle],
			body: `
<p>The radius, the drop to the axis and the piece of axis between them form a <strong>right triangle</strong>. Its slanted side, the <dfn data-def="The longest side of a right triangle, opposite the right angle.">hypotenuse</dfn>, is the radius: length 1.</p>
<p>The side next to the angle is cos θ and the side opposite it is sin θ. In any right triangle, scaling it up multiplies all sides by the same amount, so for a hypotenuse of any length:</p>
<p class="formula"><strong>sin θ = opposite ÷ hypotenuse &nbsp;&nbsp; cos θ = adjacent ÷ hypotenuse</strong></p>
<p>That is the “SOH CAH” of school trigonometry, and it comes straight from the circle. Pythagoras' theorem on the same triangle gives the most used identity of all: <strong>cos²θ + sin²θ = 1</strong>, whatever the angle.</p>`,
			notes: `<p>The third ratio, the <strong>tangent</strong>, is opposite ÷ adjacent = sin θ ÷ cos θ. On the unit circle it is the slope of the radius line. It is undefined at 90° and 270°, where the line is vertical and cos θ = 0.</p>`
		},
		{
			id: 'quadrants',
			chapter: 'trig',
			title: 'Past 90°: signs and special angles',
			scene: 'circle',
			hints: { phase: 'quadrants' },
			controls: [angle, snap],
			body: `
<p>Triangles stop at 90°, but the circle keeps going, and that is how sine and cosine are defined for any angle. The axes split the circle into four <dfn data-def="One of the four regions into which the x- and y-axes divide the plane, numbered anticlockwise from the top right.">quadrants</dfn>. In each one the coordinates have their own signs:</p>
<ul>
<li>top right (0°–90°): both positive;</li>
<li>top left (90°–180°): cosine negative, sine positive;</li>
<li>bottom left (180°–270°): both negative;</li>
<li>bottom right (270°–360°): cosine positive, sine negative.</li>
</ul>
<p>Turn on <em>snap</em> to visit the special angles. At 30°, 45° and 60° the coordinates have exact values — ½, √2/2 and √3/2 in some order — and every other special angle is a mirror image of one of these.</p>`,
			notes: `<p>Where do the exact values come from? At 45° the triangle has two equal sides, so cos 45° = sin 45° and, by Pythagoras, each is √(1/2) = √2/2 ≈ 0.71. At 30° and 60° the triangle is half of an equilateral triangle with sides 1, so the short side is ½ and the other is √(1 − ¼) = √3/2 ≈ 0.87.</p>`
		},
		// ------------------------------------------------------------------ waves
		{
			id: 'sine',
			chapter: 'waves',
			title: 'Unrolling the height: the sine wave',
			scene: 'wave',
			hints: { phase: 'sine' },
			duration: 20,
			controls: [spin, angle],
			body: `
<p>Now let the point go round, and plot its height against the angle on a second graph, with the angle running along the horizontal axis.</p>
<p>The height starts at 0, rises to 1 at 90°, falls back to 0 at 180°, down to −1 at 270° and back to 0 at 360°. The curve it traces is the <strong class="tag sin">sine wave</strong>: sin θ for every θ at once.</p>
<p>Grab the point and move it by hand: the marker on the wave follows. Every point of the wave is just the height of the point on the circle at that angle.</p>`
		},
		{
			id: 'cosine',
			chapter: 'waves',
			title: 'The sideways position: the cosine wave',
			scene: 'wave',
			hints: { phase: 'cosine' },
			duration: 20,
			controls: [spin, angle],
			body: `
<p>Do the same with the point's horizontal position and you get the <strong class="tag cos">cosine wave</strong>. It has exactly the same shape as the sine wave — but it starts at its top, 1, because at 0° the point is all the way to the right.</p>
<p>The cosine wave is the sine wave slid 90° — a quarter turn — to the left: cos θ = sin(θ + 90°). Sine and cosine are one wave, watched from two directions: from the side you see the height going up and down; from below you see the sideways position going left and right.</p>`
		},
		{
			id: 'periodic',
			chapter: 'waves',
			title: 'Round and round: why they repeat',
			scene: 'wave',
			hints: { phase: 'periodic' },
			duration: 24,
			controls: [spin, angleWide],
			body: `
<p>Nothing stops the point after one turn. At 360° it is back at the start, so from there on the heights and positions repeat exactly: sin(θ + 360°) = sin θ, and the same for cosine. Turning the other way, clockwise, gives negative angles, and the waves continue to the left.</p>
<p>A function that repeats itself like this is <dfn data-def="Repeating at regular intervals. The length of one repeat is the period.">periodic</dfn>, and the length of one repeat, 360° or 2π, is its <strong>period</strong>.</p>
<p>That is the takeaway of this page: sine and cosine are the coordinates of a point going round a circle, and that is exactly why they repeat as waves.</p>`
		},
		{
			id: 'oscillation',
			chapter: 'waves',
			title: 'Spinning in time: waves everywhere',
			scene: 'wave',
			hints: { phase: 'time' },
			duration: 24,
			controls: [amplitude, frequency],
			body: `
<p>Let the point turn at a steady speed, <i>f</i> turns per second, on a circle of radius <i>A</i>. Its height at time <i>t</i> is</p>
<p class="formula"><strong>height = A · sin(2π f t)</strong></p>
<p>The radius sets the wave's <dfn data-def="The largest distance a wave reaches from its middle line.">amplitude</dfn>, its height; the turning speed sets its <dfn data-def="How many complete cycles happen per second, measured in hertz (Hz).">frequency</dfn>, in turns — cycles — per second, called hertz. One cycle lasts 1/<i>f</i> seconds.</p>
<p>Anything that goes round and round, or back and forth smoothly, traces this shape over time: a weight bobbing on a spring, a swinging pendulum (for small swings), the voltage of mains electricity, the air pressure of a pure musical note. That is why sine waves are the building blocks of sound, light and signals.</p>`,
			notes: `<p>Mains electricity alternates at 50 Hz in Europe and most of the world, and 60 Hz in North America. The note A above middle C, used to tune orchestras, is a sound wave of 440 Hz — far too fast to draw at this speed, but the same curve.</p>`
		}
	]
};
