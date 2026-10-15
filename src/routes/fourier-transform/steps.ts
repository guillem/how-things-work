import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- controls ------------------------------------------------------------------------
// Controls that several steps share are one object, so they keep their value
// (and their range) across those steps. Built state that is not a control
// lives in params too, written by the scenes with setParam:
//   ft:wave  — the reader's drawn waveform (samples)
//   ft:bars  — the edited bar heights on the "edit" step
//   ft:curve — the reader's drawn closed curve (points)

/** How many of the three sine waves of the first step are added. */
const parts: Control = {
	type: 'range',
	id: 'parts',
	label: 'Sine waves added',
	min: 1,
	max: 3,
	step: 1,
	default: 3,
	help: '1 Hz, then 3 Hz, then 5 Hz.'
};

/** The highest frequency used to rebuild a waveform. */
const terms: Control = {
	type: 'range',
	id: 'terms',
	label: 'Frequencies added',
	min: 1,
	max: 50,
	step: 1,
	default: 5,
	format: (v) => (v === 1 ? '1 Hz only' : `1 to ${v} Hz`),
	help: 'Add one frequency at a time (arrow keys step by 1).'
};

const shapeOptions = [
	{ value: 'square', label: 'Square' },
	{ value: 'sawtooth', label: 'Sawtooth' },
	{ value: 'triangle', label: 'Triangle' },
	{ value: 'pulse', label: 'Pulse' },
	{ value: 'drawn', label: 'Your drawing' }
];

/** The waveform to take apart. */
const shape: Control = {
	type: 'select',
	id: 'shape',
	label: 'Waveform',
	default: 'square',
	options: shapeOptions
};

/** The same, with a reminder that the graph can be drawn on. */
const shapeDraw: Control = {
	...shape,
	help: 'Or drag across the top graph to draw your own (it becomes “Your drawing”).'
};

/** How fast the signal is wound round the circle. */
const windK: Control = {
	type: 'range',
	id: 'windK',
	label: 'Winding frequency',
	min: 0,
	max: 8,
	step: 0.05,
	default: 1,
	format: (v) => `${v.toFixed(2)} turns per second`,
	help: 'Try whole numbers, and the values in between.'
};

const resetBars: Control = {
	type: 'action',
	id: 'resetBars',
	label: 'Start again',
	action: 'Reset the bars',
	help: 'Back to the bars of the chosen waveform. Or drag a bar (or focus it and use the arrow keys).'
};

/** The closed curve to draw with circles. */
const curve: Control = {
	type: 'select',
	id: 'curve',
	label: 'Curve',
	default: 'heart',
	options: [
		{ value: 'heart', label: 'Heart' },
		{ value: 'star', label: 'Star' },
		{ value: 'square', label: 'Square' },
		{ value: 'drawn', label: 'Your drawing' }
	]
};

const curveDraw: Control = {
	...curve,
	help: 'Or draw a loop on the stage with the mouse or a finger: it closes when you let go.'
};

/** How many rotating circles draw the curve. */
const circles: Control = {
	type: 'range',
	id: 'circles',
	label: 'Circles',
	min: 1,
	max: 100,
	step: 1,
	default: 12,
	help: 'Biggest circles first. Arrow keys add or remove one.'
};

// ---- the narrative --------------------------------------------------------------------

export const spec: ExplainerSpec = {
	slug: 'fourier-transform',
	title: 'The Fourier transform',
	summary:
		'Build a square wave out of sine waves, see the bar chart of frequencies that makes up any signal, reshape a signal by editing its bars, and draw a curve with a chain of spinning circles.',
	chapters: [
		{ id: 'build', title: 'Building waves from sine waves' },
		{ id: 'transform', title: 'The transform: how much of each frequency' },
		{ id: 'curves', title: 'Drawing with circles' }
	],
	steps: [
		// ------------------------------------------------------------------ build
		{
			id: 'sines',
			chapter: 'build',
			title: 'Adding up sine waves',
			scene: 'sum',
			hints: { phase: 'sines' },
			duration: 18,
			controls: [parts],
			body: `
<p>A <dfn data-def="Anything that changes over time and can be measured: the air pressure of a sound, the voltage in a wire, the brightness of a pixel along a row.">signal</dfn> is a quantity that changes with time. The simplest one is a <strong>sine wave</strong>: the height of a point going steadily round a circle. Its <dfn data-def="How many complete cycles happen per second, measured in hertz (Hz).">frequency</dfn> says how many times per second it repeats, and its <dfn data-def="How far a wave rises above its middle line.">amplitude</dfn> how high it rises.</p>
<p>Here are three sine waves: <strong>1 Hz</strong> with amplitude 1, <strong>3 Hz</strong> with amplitude ⅓ and <strong>5 Hz</strong> with amplitude ⅕. To add signals, add their heights at every moment. The sliding line shows it: the coloured heights stack up to the height of the <strong class="tag sum">sum</strong>.</p>
<p>Add them one at a time. A single smooth hill-and-valley becomes something flatter on top with steeper sides: it is starting to look like a <strong>square wave</strong>, a signal that jumps between two values.</p>`,
			notes: `<p>Every signal on this page repeats once per second, so its ingredients are whole numbers of hertz: 1 Hz, 2 Hz, 3 Hz… These are its <dfn data-def="Frequencies that are whole-number multiples of a signal's repeat frequency.">harmonics</dfn>. A signal that never repeats needs every frequency in between as well; the idea is the same.</p>`
		},
		{
			id: 'square',
			chapter: 'build',
			title: 'A square wave, one frequency at a time',
			scene: 'sum',
			hints: { phase: 'square' },
			controls: [terms],
			body: `
<p>Keep going with the same rule: the next ingredient is 7 Hz with amplitude 1/7, then 9 Hz with 1/9, and so on. Scaled up by 4/π ≈ 1.27, this sum is the <strong class="tag target">square wave</strong> that jumps between +1 and −1:</p>
<p class="formula"><strong>square = (4/π) · [ sin(1 Hz) + ⅓ sin(3 Hz) + ⅕ sin(5 Hz) + … ]</strong></p>
<p>Move the slider to add one frequency at a time. Whenever an <em>even</em> frequency joins (2 Hz, 4 Hz…), nothing changes: the square wave contains none of them. Its amount of every even frequency is exactly zero.</p>
<p>With each odd frequency the <strong class="tag sum">sum</strong> hugs the square more closely, and the average gap between them (shown on the stage) shrinks. The higher frequencies are what make the corners sharp.</p>`,
			notes: `<p>Why only odd frequencies? The second half of each cycle of the square wave is the first half upside down. An odd-numbered sine wave has the same property (half a period later it is upside down); an even one is back where it was, so it cannot help, and its amount comes out as zero.</p>`
		},
		{
			id: 'gibbs',
			chapter: 'build',
			title: 'The overshoot that never goes away',
			scene: 'sum',
			hints: { phase: 'gibbs' },
			controls: [terms],
			body: `
<p>Look closely at the jump (magnified on the stage). Just before it the sum overshoots the square wave, rising above 1, and wiggles as it settles.</p>
<p>Add more frequencies. The wiggles get narrower and squeeze up against the jump, but the first peak does <em>not</em> shrink away: from 5 Hz on it stays about <strong>9% of the jump</strong> too high (the jump is from +1 to −1, a drop of 2, so the peak sits near 1.18), slowly settling towards 8.95%. This is the <dfn data-def="The overshoot of about 9% of the jump that a sum of sine waves always makes next to a sudden jump, however many terms are added.">Gibbs phenomenon</dfn>.</p>
<p>So a finite number of smooth sine waves can never draw a perfect jump. What does go to zero is the average gap: the overshoot takes up less and less time.</p>`,
			notes: `<p>The limit is (1/π)∫₀^π (sin x / x) dx − ½ ≈ 0.0895 of the jump. Henry Wilbraham noticed it in 1848; it became famous in 1898–99, when Albert Michelson, whose mechanical harmonic analyser added up to 80 sine waves, questioned in <i>Nature</i> how a Fourier series behaves at a jump; Josiah Willard Gibbs replied, and in a correction of 1899 described the overshoot. It shows up in practice as “ringing” next to sharp edges in compressed images and filtered sound.</p>`
		},
		{
			id: 'circles',
			chapter: 'build',
			title: 'Sine waves are turning circles',
			scene: 'phasors',
			duration: 20,
			controls: [terms, shape],
			body: `
<p>A sine wave is the height of a point going round a circle (see <em>Sine, cosine and the unit circle</em>). So each ingredient can be drawn as a circle: its <strong>radius</strong> is the amplitude, and it turns as many times per second as its frequency.</p>
<p>Now stack the circles: put the centre of each on the turning point of the one before. The heights add up, so the height of the <strong>last point</strong> is the sum of all the sine waves. Its trail, drawn to the right as time passes, is the rebuilt <strong class="tag sum">signal</strong>.</p>
<p>For the square wave the 1 Hz circle is the biggest and turns slowest; the higher frequencies are small and fast. Add circles with the slider, or pick another waveform: every one of them is just circles of the right sizes, turning at the right speeds, from the right starting angles (plus a fixed offset, the 0 Hz average, where the chain starts).</p>`,
			notes: `<p>The starting angle of each circle is its <dfn data-def="Where in its cycle a wave is at time zero, as an angle.">phase</dfn>. For the square wave every circle starts at angle 0; for the sawtooth every one starts at 180° (upside down); the triangle's alternate between 0° and 180°, and the pulse and your drawings need all sorts of angles. Amplitude and phase together are all you need to know about each ingredient.</p>`
		},
		// ------------------------------------------------------------------ transform
		{
			id: 'spectrum',
			chapter: 'transform',
			title: 'The spectrum: a bar for each frequency',
			scene: 'spectrum',
			hints: { phase: 'view' },
			controls: [shapeDraw],
			body: `
<p>Write down the amplitude of every ingredient and you have the signal's <dfn data-def="A signal described by how much of each frequency it contains, usually drawn as a bar chart of amplitude against frequency.">spectrum</dfn>. Turning a signal into its spectrum is the <strong>Fourier transform</strong>. The bar chart shows it: bar <i>n</i> is how much of <i>n</i> Hz the signal contains.</p>
<ul>
<li><strong>Square:</strong> only odd bars, falling as 1/<i>n</i>.</li>
<li><strong>Sawtooth:</strong> every bar, also falling as 1/<i>n</i>.</li>
<li><strong>Triangle:</strong> only odd bars, falling as 1/<i>n</i>²: it has corners but no jumps, so it needs much less of the high frequencies.</li>
<li><strong>Pulse</strong> (high for a fifth of each second): every bar except the 5th, 10th, 15th…, plus a bar at 0 Hz for its average, which is below zero.</li>
</ul>
<p>The rule of thumb: <strong>sharp features need high frequencies</strong>, smooth ones don't. Draw your own waveform on the top graph and see its bars.</p>`,
			notes: `<p>The bars show amplitudes only. The full transform also records each ingredient's phase (its starting angle): as a complex number, amplitude and angle together. Two signals with the same bars but different phases can look completely different. A steady tone often sounds much the same when only its phases change, but not always: the ear can hear some phase changes, especially in the timing of sharp attacks and pulses, and the signal can't be rebuilt without them.</p><p>This page samples each waveform 400 times a second and uses the <dfn data-def="The Fourier transform of a list of equally spaced samples: N numbers in, N complex numbers out.">discrete Fourier transform</dfn>, the version computers use.</p>`
		},
		{
			id: 'wind',
			chapter: 'transform',
			title: 'How the transform finds each amount',
			scene: 'wind',
			duration: 24,
			controls: [windK, shape],
			body: `
<p>How do you measure how much of, say, 3 Hz is hidden in a signal? Take a stretch of it (here eight seconds) and <strong>wind it round a circle</strong>, 3 turns per second. At each moment, put a point at the angle the winding has reached and at a distance equal to the signal's value (a negative value lands on the opposite side). That is multiplying the signal by e<sup>−iθ</sup> from <em>Complex numbers and Euler's formula</em>: a turn, clockwise.</p>
<p>Then find the <strong>centre of mass</strong> of the wound curve, the average of all its points. If the signal has a 3 Hz ingredient, its highs keep landing on the same side of the circle and the centre is pulled off the middle: <strong>twice its distance from the middle is the amplitude</strong>. Any other frequency goes round at the wrong speed, so it lands on every side equally and cancels out.</p>
<p>Change the winding speed. The graph at the bottom plots the strength found at every speed: it peaks at the signal's own frequencies, and at those whole numbers it equals the bars of the spectrum (at 0 Hz, the size of the average).</p>`,
			notes: `<p>In symbols, the amount of frequency <i>k</i> is the average of <i>x</i>(<i>t</i>) · e<sup>−2πi<i>kt</i></sup> over one second: the centre of mass of the wound curve, a complex number whose length is half the amplitude (for <i>k</i> ≥ 1; at 0 Hz it is the average itself) and whose angle is the phase minus a quarter turn (because this page measures phase on sine waves). Between whole frequencies the strength is small but not zero, with ripples beside each peak, because eight seconds is a finite stretch: a longer recording makes the peaks narrower, a shorter one wider (with a single second they would blur into each other).</p>`
		},
		{
			id: 'edit',
			chapter: 'transform',
			title: 'Edit the bars, reshape the signal',
			scene: 'spectrum',
			hints: { phase: 'edit' },
			controls: [shape, resetBars],
			body: `
<p>The transform also runs backwards. Given the bars (and the phases), add up the sine waves and the signal comes back: the <dfn data-def="Turning a spectrum back into a signal by adding up its sine waves.">inverse Fourier transform</dfn>.</p>
<p>Drag any bar up or down (or focus it with Tab and use the arrow keys). The <strong class="tag sum">signal</strong> above is rebuilt from all the bars on the chart (0 to 16 Hz) at once, over the faint original. Try it:</p>
<ul>
<li>pull every bar except the 1 Hz one down to zero, and a pure sine wave is left;</li>
<li>remove the 3 Hz bar from the square wave, and its flat top bulges in the middle;</li>
<li>lower the high bars and the corners soften. That is what a <dfn data-def="A filter that lets low frequencies through and removes high ones, smoothing a signal.">low-pass filter</dfn>, or the treble knob on a stereo, does.</li>
</ul>`,
			notes: `<p>Editing in the frequency domain is how many real tools work: an audio equaliser boosts or cuts bands of frequencies, and noise reduction removes the frequencies where the noise lives. Image and sound compression (JPEG, MP3) use close cousins of this transform and keep the strong bars while throwing away the weak ones the eye or ear barely notices.</p>`
		},
		{
			id: 'draw-wave',
			chapter: 'transform',
			title: 'Draw any waveform and rebuild it',
			scene: 'spectrum',
			hints: { phase: 'draw' },
			controls: [terms, shapeDraw],
			body: `
<p>Now draw your own: <strong>drag across the top graph</strong>, from left to right, any shape you like (on a touch screen, tap <strong>Draw</strong> first, so that the page still scrolls). A gap is filled with a straight line, and the end of the second joins the start of the next, because the signal repeats.</p>
<p>The page samples your drawing and takes its transform. The bars below are its spectrum, and the <strong class="tag sum">signal</strong> is rebuilt from the frequencies the slider lets in (the bars that take part are highlighted). Start from 1 Hz and add one frequency at a time: a rough outline first, then the details.</p>
<p>Whatever you draw, it works: <strong>any</strong> repeating signal is a sum of sine waves. Smooth curves settle after a few frequencies; scribbles and jumps keep needing more.</p>`
		},
		// ------------------------------------------------------------------ curves
		{
			id: 'epicycles',
			chapter: 'curves',
			title: 'A closed curve from spinning circles',
			scene: 'epicycles',
			hints: { phase: 'preset' },
			duration: 24,
			controls: [circles, curve],
			body: `
<p>The same idea draws pictures. Trace a closed curve once a second and read each position as a <strong>complex number</strong> <i>x</i> + <i>iy</i>: the curve becomes a single signal with complex values.</p>
<p>Its transform is a set of circles, each <strong>c<sub>k</sub> · e<sup>2πi<i>kt</i></sup></strong>: a point turning <i>k</i> times per second round a circle of radius |c<sub>k</sub>|, from the angle of c<sub>k</sub>. Because the values are complex, frequencies come in two directions: positive <i>k</i> turns anticlockwise, negative <i>k</i> clockwise.</p>
<p>Chain the circles, biggest first, and the last point draws the curve. The bar chart shows the size of every circle by frequency. A few big circles give the rough shape; the many small fast ones add the corners.</p>`,
			notes: `<p>The 0 Hz term does not turn: it is the curve's centre, where the chain starts. This drawing machine is very old in spirit: the epicycles of Ptolemy's astronomy (about 150 AD) built planetary paths from circles riding on circles.</p>`
		},
		{
			id: 'draw-curve',
			chapter: 'curves',
			title: 'Draw your own, and the big idea',
			scene: 'epicycles',
			hints: { phase: 'draw' },
			duration: 24,
			controls: [circles, curveDraw],
			body: `
<p><strong>Draw a loop on the stage</strong> (on a touch screen, tap <strong>Draw</strong> first); when you let go it closes with a straight line back to the start. Your drawing is sampled 200 times, transformed, and redrawn by a chain of circles. Turn the circles down to a handful and up again.</p>
<p>That is the takeaway of this page: <strong>any signal can be written as a sum of sine waves, and the Fourier transform says how much of each frequency it contains</strong>. A wave on a graph, a drawing, a sound, an image: they are all a recipe of frequencies.</p>
<p>That recipe is often easier to work with than the signal itself: it shows the notes in a chord, the hum in a recording or the vibration in a bridge, and it is what equalisers, compression and many medical scanners work on.</p>`,
			notes: `<p>Computers compute the transform with the <dfn data-def="A fast algorithm for the discrete Fourier transform, popularised by Cooley and Tukey in 1965.">fast Fourier transform</dfn> (FFT), which needs about <i>N</i> log <i>N</i> steps instead of <i>N</i>²: a million samples take some twenty million operations rather than a trillion. MRI scanners measure the transform of the image directly and turn it into a picture with an inverse transform.</p>`
		}
	]
};
