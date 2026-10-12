import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const frequency: Control = {
	type: 'range',
	id: 'frequency',
	label: 'Shaking frequency',
	min: 0.5,
	max: 2,
	step: 0.05,
	default: 1,
	unit: ' Hz',
	help: 'How many times a second the hand moves the end of the rope up and down.'
};

const second: Control = {
	type: 'select',
	id: 'second',
	label: 'Pulse from the right',
	default: 'up',
	options: [
		{ value: 'up', label: 'Upright' },
		{ value: 'down', label: 'Upside down' }
	]
};

const lambda: Control = {
	type: 'range',
	id: 'lambda',
	label: 'Wavelength',
	min: 1,
	max: 4,
	step: 0.1,
	default: 2,
	unit: ' cm'
};

const spacing: Control = {
	type: 'range',
	id: 'spacing',
	label: 'Distance between the sources',
	min: 1,
	max: 12,
	step: 0.5,
	default: 6,
	unit: ' cm',
	help: 'You can also drag either source in the tank.'
};

const harmonic: Control = {
	type: 'range',
	id: 'harmonic',
	label: 'Harmonic',
	min: 1,
	max: 8,
	step: 1,
	default: 3,
	format: (n) => `n = ${n}`
};

const hear: Control = {
	type: 'action',
	id: 'hear',
	label: 'Sound',
	action: '▶ Hear this note',
	help: 'Plays the note for real, about a second and a half.'
};

const pluckAt: Control = {
	type: 'range',
	id: 'pluckAt',
	label: 'Pluck at',
	min: 5,
	max: 50,
	step: 1,
	default: 20,
	unit: '% of the length',
	help: 'Measured from the bridge (the right-hand end).'
};

const pluck: Control = {
	type: 'action',
	id: 'pluck',
	label: 'Pluck',
	action: '▶ Pluck and hear it'
};

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Speed of the source',
	min: 0,
	max: 240,
	step: 5,
	default: 30,
	unit: ' m/s',
	format: (v) => `${v} m/s (${Math.round(v * 3.6)} km/h)`
};

const passby: Control = {
	type: 'action',
	id: 'passby',
	label: 'Sound',
	action: '▶ Hear it go past',
	help: 'A 440 Hz tone driving past you at this speed, 10 m away.'
};

export const spec: ExplainerSpec = {
	slug: 'waves-interference',
	title: 'Waves, sound and interference',
	summary:
		'Send waves through each other, find the bands where two ripples cancel, pluck a string to hear the only notes it can play, and listen to the pitch drop as a sound races past.',
	chapters: [
		{ id: 'waves', title: 'What a wave is' },
		{ id: 'tank', title: 'Two sources' },
		{ id: 'string', title: 'Trapped waves' },
		{ id: 'moving', title: 'A moving source' }
	],
	steps: [
		// ------------------------------------------------------------------ waves
		{
			id: 'wave',
			chapter: 'waves',
			title: 'A wave moves a shape, not the rope',
			scene: 'rope',
			hints: { phase: 'wave' },
			duration: 18,
			controls: [frequency],
			body: `
<p>Shake one end of a long rope up and down and a <dfn data-def="A disturbance that travels through a material (or, for light, through empty space), carrying energy from place to place without carrying the material along.">wave</dfn> runs along it. Watch the red bead: it only goes up and down, like the mass on a spring, while the shape travels to the right. A wave carries energy along the rope, not the rope itself.</p>
<p>Every point repeats the motion of the hand a little later — the further away, the later. The distance from one crest to the next is the <dfn data-def="The distance between two neighbouring crests (or any two neighbouring points moving in step) of a wave. Symbol λ (lambda).">wavelength</dfn>, λ. In one swing of the hand the wave moves on by exactly one wavelength, so</p>
<p class="formula"><strong>speed = frequency × wavelength</strong> &nbsp; (v = f·λ)</p>
<p>On this rope waves always travel at 2 m/s. Shake faster and the crests come out closer together: double the frequency, half the wavelength. Sound is the same thing in air: a 343 Hz note travels at 343 m/s, so its waves are about a metre long.</p>`,
			notes: `<p>The bead's height follows a sine curve in time — the same curve that the point going round the unit circle traces — and a snapshot of the whole rope is a sine curve in space. The speed is set by the rope (tighter or lighter ropes carry waves faster), not by the hand. Sound in air at 20 °C travels at 343 m/s; the figure comes from the ideal-gas formula c = √(γRT/M) and grows by about 0.6 m/s for every degree warmer.</p>`
		},
		{
			id: 'superposition',
			chapter: 'waves',
			title: 'Waves pass through each other',
			scene: 'rope',
			hints: { phase: 'pulses' },
			duration: 15,
			controls: [second],
			body: `
<p>Now send one pulse from each end. Where they meet, the rope's height is simply the <strong>sum</strong> of the two heights: two upright pulses make one twice as tall for an instant. This adding up is called <dfn data-def="The rule that where two or more waves overlap, the total displacement is the sum of the displacements each wave would cause on its own.">superposition</dfn>.</p>
<p>Flip the second pulse upside down. As they cross, the up of one and the down of the other add to zero: for a moment the rope is flat, as if both pulses were gone.</p>
<p>They are not. Each pulse comes out of the meeting with exactly the shape it went in with and carries on. Waves don't bounce off each other or get used up; they <strong>pass through each other and add</strong>. Everything else in this explainer follows from that.</p>`,
			notes: `<p>The dashed curves show each pulse on its own, the solid line their sum. Superposition holds whenever the material responds in proportion to the push — true for small waves on ropes, water and in air, which is why you can hear two people talking at once. Very large waves (breaking surf, explosions) are no longer simply additive.</p>`
		},
		// ------------------------------------------------------------------ tank
		{
			id: 'ripple-tank',
			chapter: 'tank',
			title: 'Two sources in a ripple tank',
			scene: 'tank',
			hints: { phase: 'ripples' },
			duration: 20,
			controls: [lambda, spacing],
			body: `
<p>A <dfn data-def="A shallow glass-bottomed tray of water lit from above, so that the crests of ripples show as bright lines and the troughs as dark ones on a screen below.">ripple tank</dfn> is a shallow tray of water. Two dippers, side by side, bob up and down in step, and each sends out circular ripples: bright where the water is lifted into a crest, dark in a trough.</p>
<p>Where the two sets of ripples cross, they add. Look for the pattern fanning out from between the sources: lines where the water heaves twice as hard, and between them lines where it hardly moves at all — <strong>bands of reinforcement and cancellation</strong>.</p>
<p>Change the wavelength and the spacing and watch the bands swing round. The ripples in a tank all travel at the same speed, so a shorter wavelength also means the dippers bob faster.</p>`,
			notes: `<p>The picture is computed: each source sends circular waves whose height falls off as 1/√(distance) (a ring's energy spreads around a circumference that grows with its radius), and the two are added point by point. Reflections from the tank's walls and the slow loss of energy to friction are left out; real tanks have sloping, absorbing edges for the same reason. The motion is slowed down: at a wavelength of 2 cm the dippers bob once a second; real ripple tanks run ten or more times faster.</p>`
		},
		{
			id: 'path-difference',
			chapter: 'tank',
			title: 'Crest meets trough',
			scene: 'tank',
			hints: { phase: 'probe' },
			duration: 24,
			controls: [lambda, spacing],
			body: `
<p>Why still water in some places? Drag the yellow probe around the tank. The two ripples reaching it have travelled different distances, r₁ and r₂. Their <dfn data-def="The difference between the distances from the two sources to a point: r₁ − r₂. It decides whether the two waves arrive in step or out of step.">path difference</dfn>, measured in wavelengths, decides everything:</p>
<ul>
<li>a <strong>whole number</strong> of wavelengths (0, 1, 2…): crest arrives with crest, trough with trough, and the water moves twice as much — <dfn data-def="Two waves adding up in step to a bigger wave.">constructive interference</dfn>;</li>
<li>a <strong>half-integer</strong> number (½, 1½, 2½…): crest arrives with trough, and the two cancel — <dfn data-def="Two waves arriving out of step, one's crest on the other's trough, so that they cancel.">destructive interference</dfn>.</li>
</ul>
<p>The two traces under the readout are the two waves arriving at the probe, and their sum. The dashed lines join all the points of half-integer path difference: those are the calm bands. The water there is <em>almost</em> still rather than perfectly still, because the nearer source's ripple is a little stronger.</p>`,
			notes: `<p>Every curve of constant path difference is a <em>hyperbola</em> with the two sources as its foci, which is why the bands bend near the sources and straighten out further away. The same argument with light is Thomas Young's double-slit experiment (1801), the first strong evidence that light is a wave.</p>`
		},
		{
			id: 'bands',
			chapter: 'tank',
			title: 'Moving the bands',
			scene: 'tank',
			hints: { phase: 'bands' },
			duration: 22,
			controls: [lambda, spacing],
			body: `
<p>Average the motion over time and only the pattern is left: bright where the water heaves, dark where it stays calm. Path differences can't be larger than the distance between the sources, so the number of calm lines is fixed by how many half-wavelengths fit between them.</p>
<ul>
<li>Sources further apart, or a shorter wavelength: <strong>more lines, closer together</strong>.</li>
<li>Sources closer, or a longer wavelength: fewer lines, spread wider. Closer than half a wavelength, and there are no calm lines at all.</li>
</ul>
<p>The same happens with sound. Two loudspeakers playing one note make quiet spots in a room where the path difference is half a wavelength. <strong>Noise-cancelling headphones</strong> use the same trick deliberately: a microphone hears the noise and the speaker plays it back upside down, so crest meets trough at your ear.</p>`,
			notes: `<p>Far from the sources the calm lines point at angles θ where sin θ = (m + ½)·λ ÷ d, for d the spacing and m = 0, 1, 2… — the readout shows the first one. Measuring that angle is how the wavelength of light was first measured, with two slits a fraction of a millimetre apart instead of two dippers.</p>`
		},
		// ------------------------------------------------------------------ string
		{
			id: 'standing',
			chapter: 'string',
			title: 'A wave trapped on a string',
			scene: 'string',
			hints: { phase: 'standing' },
			duration: 20,
			controls: [harmonic],
			body: `
<p>On a guitar string, waves can't run away: they hit the ends, which are held fixed, bounce back upside down and run back the other way. So the string always carries two waves travelling in opposite directions (shown faintly), and its shape is their sum.</p>
<p>For the right wavelengths the sum is a <dfn data-def="A wave that stays in place: the pattern swings up and down without travelling, with fixed points of no motion (nodes) between points of largest motion (antinodes).">standing wave</dfn>. It doesn't travel at all: the string swings up and down in loops, with points that never move, <dfn data-def="Points of a standing wave that stay still, where the two travelling waves always cancel.">nodes</dfn>, between points that swing the most, <dfn data-def="Points of a standing wave that swing the most, where the two travelling waves always add in step.">antinodes</dfn>. Nodes are half a wavelength apart.</p>
<p>The ends are nodes, because they're held fixed. So a whole number of half-wavelengths must fit the length of the string exactly: one loop, two loops, three…</p>`
		},
		{
			id: 'harmonics',
			chapter: 'string',
			title: 'Only certain notes fit',
			scene: 'string',
			hints: { phase: 'harmonics' },
			duration: 22,
			controls: [harmonic, hear],
			body: `
<p>A guitar's fifth string is 65 cm long and tuned to A, 110 Hz. With one loop, half a wavelength fits the string: λ = 130 cm. Waves on this string travel at 110 × 1.3 = 143 m/s, so the frequency of n loops is</p>
<p class="formula"><strong>fₙ = n × v ÷ 2L = n × 110 Hz</strong></p>
<p>These are the string's <dfn data-def="The frequencies at which a confined wave can vibrate: whole-number multiples of the lowest one, the fundamental.">harmonics</dfn>: 110, 220, 330, 440 Hz… and nothing in between. A confined wave can only vibrate at certain frequencies; each one is a natural frequency of the string, like the single natural frequency of a mass on a spring. Press <em>Hear this note</em> to play each one.</p>
<p>The string on the stage is slowed down enormously: at 110 Hz it swings back and forth 110 times a second, far too fast to see.</p>`,
			notes: `<p>The wave speed on a string is √(tension ÷ mass per metre), so tightening a string (tuning up) raises every harmonic together, and heavier strings sound lower. Pressing the string at the 12th fret halves its length and doubles the frequency: an octave. The same rule fixes the notes of wind instruments, where the trapped wave is sound in a tube, and of the electron in an atom, where only certain wave patterns fit around the nucleus.</p>`
		},
		{
			id: 'pluck',
			chapter: 'string',
			title: 'A pluck plays many harmonics at once',
			scene: 'string',
			hints: { phase: 'pluck' },
			duration: 24,
			controls: [pluckAt, pluck],
			body: `
<p>A real pluck pulls the string into a triangle and lets go. That triangle isn't any one harmonic — but it <em>is</em> a sum of them, and once released each harmonic swings at its own frequency. The bars show how much of each is in the mix. The string's shape, the sum of them all, turns into a kink that races back and forth.</p>
<p>The mix depends on where you pluck. Pluck exactly in the middle and the even harmonics (2, 4, 6…) vanish: each has a node in the middle, and a pull at a point that must stay still can't start them. Pluck close to the bridge and the higher harmonics grow, and the note sounds brighter and more nasal — guitarists do this on purpose.</p>
<p>You still hear one note, 110 Hz, the <dfn data-def="The lowest frequency a confined wave can vibrate at; it sets the pitch you hear.">fundamental</dfn>. The mix of harmonics on top is what makes a guitar sound different from a piano or a voice playing the same note: its <dfn data-def="The 'colour' of a sound that lets you tell two instruments apart on the same note; it comes largely from the mix of harmonics.">timbre</dfn>.</p>`,
			notes: `<p>For an ideal string pulled to height h at a fraction p of its length, harmonic n has amplitude 2h·sin(nπp) ÷ (n²π²·p(1 − p)): it shrinks as 1/n², and is zero whenever harmonic n has a node at the pluck point. Real strings are slightly stiff and lose energy, the high harmonics fastest, so the sound you hear gets mellower as it fades; the drawn string is ideal and keeps swinging.</p>`
		},
		// ------------------------------------------------------------------ moving
		{
			id: 'doppler',
			chapter: 'moving',
			title: 'A moving source squeezes its waves',
			scene: 'doppler',
			hints: { phase: 'fronts' },
			duration: 22,
			controls: [speed, passby],
			body: `
<p>A source sends out a crest, moves on a little, sends the next one, moves on again. Each crest spreads out as a circle around the point it was sent from, so ahead of a moving source the crests are squeezed together and behind it they're stretched apart.</p>
<p>Sound travels at 343 m/s whatever the source does, so squeezed crests reach your ear more often: a higher pitch. This is the <dfn data-def="The change in the frequency of a wave heard by a listener when the source and the listener move towards or away from each other.">Doppler effect</dfn>. For a source moving at speed v,</p>
<p class="formula"><strong>f<sub>ahead</sub> = f × 343 ÷ (343 − v)</strong> &nbsp; <strong>f<sub>behind</sub> = f × 343 ÷ (343 + v)</strong></p>
<p>A 440 Hz horn on a car at 30 m/s (108 km/h) is heard at 482 Hz as it approaches and 405 Hz as it leaves. Raise the speed and watch the crests pile up in front.</p>`,
			notes: `<p>The drawing is slowed down so that you can follow the crests; the speed of the source compared with the speed of sound is the real one. At the speed of sound the crests pile up into a single shock wave, heard as a sonic boom; the slider stops at 240 m/s, 70% of the speed of sound. The listener's own motion also shifts the pitch, by a slightly different formula.</p>`
		},
		{
			id: 'pass-by',
			chapter: 'moving',
			title: 'Neeee-yowww: the pitch drops as it passes',
			scene: 'doppler',
			hints: { phase: 'passby' },
			duration: 22,
			controls: [speed, passby],
			body: `
<p>Stand 10 m from a road while the car sounds its 440 Hz horn. While it's far off and coming straight at you, you hear the full high pitch. As it passes, it moves across your line of sight rather than towards you, and the pitch slides down through 440 Hz; driving away, it settles at the low pitch. The plot is the pitch you hear, moment by moment.</p>
<p>Press <em>Hear it go past</em> to listen at the speed you've set — the familiar drop of a passing siren or a race car.</p>
<p>The Doppler effect measures speed from a distance: police radar guns and weather radars bounce waves off cars and raindrops, ultrasound scanners measure blood flow, and astronomers find planets around other stars from the tiny shifts in their starlight as each star is tugged towards and away from us.</p>
<p><strong>Waves pass through each other and add, so they can reinforce or cancel; and a wave trapped between two ends can only vibrate at certain frequencies.</strong></p>`,
			notes: `<p>The pitch you hear at each moment was sent a little earlier, when the car was somewhere else: the curve accounts for the sound's travel time. At the moment the car is closest it is moving neither towards nor away from you, so the sound sent from there arrives at the true 440 Hz, a fraction of a second later.</p>`
		}
	]
};
