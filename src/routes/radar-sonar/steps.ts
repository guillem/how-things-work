import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const km = (v: number) => `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} km`;
const rangeA: Control = {
	type: 'range',
	id: 'rA',
	label: 'Target A’s range',
	min: 500,
	max: 14500,
	step: 100,
	default: 4000,
	format: km
};
const rangeB: Control = { ...rangeA, id: 'rB', label: 'Target B’s range', default: 9000 };
const shape: Control = {
	type: 'select',
	id: 'shape',
	label: 'Target B: a 1 m × 1 m metal plate',
	default: 'face',
	options: [
		{ value: 'face', label: 'square to the radar' },
		{ value: 'coat', label: 'square on, coated to absorb 90 %' },
		{ value: 'tilt', label: 'tilted 30°, bare' }
	]
};
const TAUS = [0.2, 0.5, 1, 2, 5, 10, 20];
const tau: Control = {
	type: 'range',
	id: 'tau',
	label: 'Pulse length',
	min: 0.2,
	max: 20,
	step: 0.1,
	default: 2,
	values: () => TAUS,
	format: (v) => `${v} µs`
};
const gap: Control = {
	type: 'range',
	id: 'gap',
	label: 'Distance between the two targets',
	min: 20,
	max: 1000,
	step: 10,
	default: 400,
	unit: ' m'
};
const wave: Control = {
	type: 'select',
	id: 'wave',
	label: 'Waveform',
	default: 'chirp',
	options: [
		{ value: 'chirp', label: 'chirp (frequency sweep)' },
		{ value: 'plain', label: 'plain pulse' }
	]
};
const bw: Control = {
	type: 'range',
	id: 'bw',
	label: 'Chirp’s sweep (bandwidth B)',
	min: 0.5,
	max: 5,
	step: 0.5,
	default: 5,
	unit: ' MHz'
};
const chirpLength: Control = {
	type: 'range',
	id: 'ctau',
	label: 'Chirp length',
	min: 2,
	max: 20,
	step: 1,
	default: 20,
	unit: ' µs'
};
const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Target’s speed',
	min: 0,
	max: 55,
	step: 1,
	default: 30,
	unit: ' m/s'
};
const heading: Control = {
	type: 'range',
	id: 'heading',
	label: 'Heading, off the line to the radar',
	min: 0,
	max: 180,
	step: 5,
	default: 0,
	unit: '°'
};
const clutter: Control = { type: 'toggle', id: 'clutter', label: 'Ground clutter', default: true };
const noise: Control = {
	type: 'range',
	id: 'noise',
	label: 'Extra noise (jamming, interference)',
	min: 0,
	max: 50,
	step: 1,
	default: 0,
	unit: ' dB'
};
const medium: Control = {
	type: 'select',
	id: 'medium',
	label: 'Medium',
	default: 'water',
	options: [
		{ value: 'air', label: 'air: radar, radio waves' },
		{ value: 'water', label: 'seawater: sonar, sound' }
	]
};
const FREQS = [100, 300, 1000, 3000, 10000, 30000, 100000];
const freq: Control = {
	type: 'range',
	id: 'freq',
	label: 'Sonar frequency',
	min: 100,
	max: 100000,
	step: 100,
	default: 3000,
	values: () => FREQS,
	format: (v) => (v >= 1000 ? `${v / 1000} kHz` : `${v} Hz`)
};
const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Water temperature',
	min: 2,
	max: 30,
	step: 1,
	default: 10,
	unit: ' °C'
};

/**
 * Scenes: `ping` (a pulse out to two targets and the echoes back on a range display; hint
 * `power` adds the echo strengths and the plate's shape), `pulse` (two close targets, the raw
 * echo and the matched filter's output; hint `mode` 'plain' | 'chirp', `rcs` the targets'
 * cross-section), `doppler` (a moving target, its radial speed, the echo's phase pulse by pulse
 * and its spectrum), `map` (one pulse and the range-Doppler map of three targets in clutter;
 * hint `detect` shows the threshold) and `sonar` (the same 10 km in air and in seawater, and
 * sound absorption against frequency).
 */
export const spec: ExplainerSpec = {
	slug: 'radar-sonar',
	title: 'Radar & sonar',
	summary:
		'Fire a pulse at two targets and time the echoes; watch them fade as 1/R⁴, merge when the pulse is too long and drown when it is too short, until a chirp and a matched filter give both reach and sharpness. Then read a speed from the Doppler shift, pull a small boat out of the clutter on a range-Doppler map, and take the whole thing under water.',
	chapters: [
		{ id: 'echo', title: 'Timing an echo' },
		{ id: 'shape', title: 'The shape of the pulse' },
		{ id: 'speed', title: 'Speed from pitch' },
		{ id: 'water', title: 'Under water' }
	],
	steps: [
		{
			id: 'echo',
			chapter: 'echo',
			title: 'Distance is a round trip',
			scene: 'ping',
			duration: 28,
			controls: [rangeA, rangeB],
			body: `
<p>A radar sends out a short burst of radio waves, a <dfn data-def="A short burst of a radio (or sound) wave, here a few microseconds long, sent out and then listened for.">pulse</dfn>, and then listens. Anything in the way reflects a little of it back, and the echo arrives after the time the wave needs to go there and back. Radio travels at the speed of light, 300,000 km per second, so</p>
<p><strong>range = c × delay ÷ 2</strong>: every microsecond of delay is 150 m of range. An echo 26.7 µs after the pulse left comes from 4 km away.</p>
<p>The animation runs about 50,000 times slower than real life. The lower trace is the <dfn data-def="A radar's simplest display: echo strength against delay, which is drawn as range. Each echo is a spike at its target's distance.">range display</dfn>: as time passes it sweeps out to longer ranges, and each echo puts a spike at its target's distance. Drag the targets (or use the sliders) and the spikes follow.</p>
<p>One antenna and one clock are enough: range comes from <em>timing</em>, not from triangulating between two stations. Direction comes separately, from where the narrow beam is pointing when the echo comes back. Light needs only 100 µs for a 15 km round trip, so a radar can fire thousands of pulses a second.</p>`,
			notes: `<p>A pulse sent before the last echo is back makes a later echo ambiguous: is it the far target's echo of the previous pulse, or a near one's of this pulse? So the pulse rate sets the longest range a radar can measure unambiguously, c ÷ (2 × pulse rate): 18.75 km at the 8,000 pulses a second used later on this page.</p>`
		},
		{
			id: 'fade',
			chapter: 'echo',
			title: 'Echoes fade as 1/R⁴',
			scene: 'ping',
			hints: { power: true },
			duration: 30,
			controls: [rangeA, shape, rangeB],
			body: `
<p>The pulse spreads out as it goes, so the power falling on a target drops as 1/R². The target re-radiates it, and that echo spreads out again on its way back: another 1/R². Together, the <dfn data-def="Received echo power = Pt G² λ² σ ÷ ((4π)³ R⁴): transmitted power, antenna gain, wavelength, the target's radar cross-section σ and its range R.">radar equation</dfn>: the echo's power falls as <strong>1/R⁴</strong>. Twice as far is 16 times weaker, 12 dB. Target A is a boat with a <dfn data-def="Radar cross-section σ: the area of a perfect isotropic reflector that would send back as much power as the target does. It depends on the target's shape and size, the wavelength and the angle it is seen from.">radar cross-section</dfn> of 10 m²: drag it from 2 km to 4 km and its echo drops from 55 to 43 dB above the noise.</p>
<p>Target B is a flat metal plate, 1 m square. Square to the radar, it mirrors the pulse straight back: its cross-section is 4πA²/λ² ≈ 14,000 m², 41 dB brighter than a 1 m² target. Coat it in material that absorbs 90 % of the wave and it is still 1,400 m². Tilt the bare plate by 30° instead and it mirrors the pulse <em>away</em>, like a tilted mirror sends a torch beam: its echo falls to about 1 m², 41 dB less.</p>
<p>That is the main trick of stealth: flat facets angled so that echoes go anywhere but back to the radar. Absorbing coatings help, but they come second.</p>`,
			notes: `<p>The radar here is notional: 10 GHz (X band, λ = 3 cm), 1 kW of peak power, a 35 dBi antenna and a 3 dB noise figure. The plate's cross-section uses physical optics; off its main lobe the curve is drawn through its sidelobe peaks (1/x²), since the exact pattern has knife-edge nulls. A tilted plate only redirects the echo: a second receiver placed where the reflection goes would see it brightly, which is the idea behind bistatic radar.</p>`
		},
		// ------------------------------------------------------------------ shape
		{
			id: 'resolution',
			chapter: 'shape',
			title: 'Two targets, one blur',
			scene: 'pulse',
			hints: { mode: 'plain', rcs: 10 },
			duration: 28,
			controls: [tau, gap],
			body: `
<p>A pulse has a length. One 2 µs long is 600 m of radio wave in flight, and the echoes of two targets closer together than half of that, 300 m, overlap in time. The <dfn data-def="The smallest separation in range at which two targets show as two echoes rather than one: c × pulse length ÷ 2 for a plain pulse.">range resolution</dfn> of a plain pulse is <strong>c × τ ÷ 2</strong>.</p>
<p>Two targets of 10 m² sit 9 km away. The upper trace is the raw echo; the lower one has been through the receiver's <dfn data-def="A filter whose response is the transmitted pulse reversed in time: it correlates what comes back with what was sent, which maximises the signal-to-noise ratio at its peak.">matched filter</dfn>, which correlates what comes back with a copy of what was sent (more on that below). Bring the targets within 300 m of each other and the two echoes merge into one wide hump. Shorten the pulse to 0.2 µs and they come apart again, down to 30 m.</p>`
		},
		{
			id: 'energy',
			chapter: 'shape',
			title: 'Shorter pulses, weaker echoes',
			scene: 'pulse',
			hints: { mode: 'plain', rcs: 0.1 },
			duration: 30,
			controls: [tau, gap],
			body: `
<p>Now make the targets small, two drones of 0.1 m². A radar's transmitter has a fixed <em>peak</em> power, so a shorter pulse carries less energy, and energy is what lifts an echo out of the receiver's noise. At a fixed peak power, the matched filter's best signal-to-noise ratio is the echo's energy over the noise: <strong>SNR = P<sub>r</sub> τ ÷ (k T F)</strong>.</p>
<p>At 20 µs the drones stand 22 dB above the noise, but they are one blur. At 2 µs they are 12 dB up, already marginal. At 0.2 µs, sharp enough to tell apart, they are 2 dB up and gone in the noise. A radar usually needs about 13 dB to call something a target without raising false alarms on noise.</p>
<p>So with plain pulses you choose: long for reach, short for detail. Unless the pulse can be long <em>and</em> sharp.</p>`,
			notes: `<p>The SNR after a matched filter, E/N₀, depends only on the energy of the echo, not on its shape: that is the fact the next step exploits. A real radar's detection threshold depends on the false-alarm rate it can tolerate and how many looks it adds up; 13 dB is a typical single-look figure.</p>`
		},
		{
			id: 'chirp',
			chapter: 'shape',
			title: 'A chirp and its matched filter',
			scene: 'pulse',
			hints: { mode: 'chirp', rcs: 0.1 },
			duration: 34,
			controls: [wave, bw, chirpLength, gap],
			body: `
<p>Keep the pulse long, but sweep its frequency as it goes: a <dfn data-def="A pulse whose frequency rises (or falls) steadily over its length; in radar, a linear frequency-modulated pulse.">chirp</dfn>, 20 µs long, rising across a bandwidth B of 5 MHz. The raw echoes are as long and as overlapped as before. The matched filter slides a copy of the chirp along what came back: only where every part of the sweep lines up with its own echo do all the pieces add in step, and that happens at one instant, sharp to about <strong>1/B</strong>.</p>
<p>The long echo is <dfn data-def="Compressing a long, coded pulse into a short peak with its matched filter, so that a radar gets a long pulse's energy and a short pulse's range resolution.">compressed</dfn> into a peak 0.2 µs wide: the resolution is <strong>c ÷ (2B)</strong> = 30 m, and the peak keeps the long pulse's full energy, 22 dB above the noise. Reach and detail at once. Narrow the sweep to 0.5 MHz and the peaks widen to 300 m; shorten the chirp and they stay sharp but sink towards the noise; switch to a plain pulse of the same length to compare.</p>
<p>Resolution depends on the bandwidth, not on the length of the pulse. That is <a href="../fourier-transform/">Fourier</a>'s trade in another guise: a short pulse is wideband, and a chirp is a way to get the bandwidth without making the pulse short.</p>`,
			notes: `<p>The compressed peak is the chirp's autocorrelation, a sinc with sidelobes 13 dB below the peak (the small spikes either side); real radars taper the filter to push them lower, at a small cost in width and SNR. The compression ratio is the time-bandwidth product BT, 100 here. Bats and dolphins use chirps and clicks for the same reason.</p>`
		},
		// ------------------------------------------------------------------ speed
		{
			id: 'doppler',
			chapter: 'speed',
			title: 'Speed from the Doppler shift',
			scene: 'doppler',
			duration: 32,
			controls: [speed, heading],
			body: `
<p>An echo from a target closing in comes back at a slightly higher frequency, the <a href="../waves-interference/">Doppler shift</a>: <strong>f<sub>D</sub> = 2v ÷ λ</strong>, twice because the path shrinks both ways. At 10 GHz (λ = 3 cm), a car approaching at 30 m/s shifts the echo by 2.0 kHz, two parts in ten million of the carrier.</p>
<p>A shift that small is not measured within one pulse. Instead the radar fires a train of them, here 8,000 a second, and compares the echo's <em>phase</em> from pulse to pulse: each pulse finds the car 3.75 mm nearer, which shortens the round trip by a quarter of a wavelength, and the phase turns by a quarter turn. The upper row shows the phase on each of 32 pulses; the spectrum of that row peaks at the Doppler frequency.</p>
<p>Turn the heading. Only the <dfn data-def="The part of a target's velocity along the line from the radar to it: speed × cos(angle between its heading and that line).">radial speed</dfn>, v × cos θ, the part along the line of sight, changes the path length. At 60° the shift halves; a car crossing the beam at 90° shows no shift at all, however fast it goes.</p>`,
			notes: `<p>Sampling the phase 8,000 times a second, the shift is measured without ambiguity only up to ±4 kHz, ±60 m/s here (λ × pulse rate ÷ 4); a faster target wraps round and reads as the wrong speed, which is why the slider stops at 55 m/s. Raising the pulse rate fixes speed but shortens the unambiguous range: real radars switch between several rates. A police radar gun is the same physics with a continuous wave and no pulses.</p>`
		},
		{
			id: 'map',
			chapter: 'speed',
			title: 'A range-Doppler map',
			scene: 'map',
			duration: 32,
			controls: [clutter],
			body: `
<p>Put the two ideas together. For each of 32 pulses the radar compresses the echo into range cells, here 200 m each; then, for each range cell, it takes the spectrum of that cell across the 32 pulses. The result is a <dfn data-def="A grid of echo power with range along one axis and radial speed (Doppler) along the other, made by Fourier-transforming each range cell across a train of pulses.">range-Doppler map</dfn>: range across, speed up and down.</p>
<p>Three targets: a car at 3.5 km coming in at 25 m/s, a small boat (0.5 m²) at 7.1 km coming in at 12 m/s, and a helicopter at 11 km heading away at 45 m/s. The ground reflects too, at every range: <dfn data-def="Echoes from things the radar is not looking for: ground, sea waves, rain, buildings. Ground clutter is stationary, so it sits at zero Doppler.">clutter</dfn>. In one pulse (the upper trace) the boat is lost among the ground echoes. But the ground is not moving, so on the map all of it piles up in the zero-speed row, and the boat stands clear in its own.</p>
<p>Adding 32 pulses coherently also lifts every target about 13 dB further above the noise. Switch the clutter off to see what it was hiding.</p>`,
			notes: `<p>Clutter is not noise: it is real echo, often far stronger than the target, and averaging does not remove it; only a difference (here, in speed) separates them. Trees swaying in the wind and waves give clutter a little spread in speed, so the radar ignores a notch of slow speeds, ±5 m/s here: anything moving slower than that, a walker or a drifting boat, is lost with it. The speeds are processed with a Hann window, so the strong clutter does not leak into every other speed row.</p>`
		},
		{
			id: 'noise',
			chapter: 'speed',
			title: 'Into the noise',
			scene: 'map',
			hints: { detect: true },
			duration: 30,
			controls: [noise],
			body: `
<p>A detector marks every cell that stands at least 13 dB above the noise, outside the clutter notch. Now raise the noise, as a jammer or a nearby transmitter would. The targets don't fade together: each goes when its own echo, set by its size and by 1/R⁴, sinks below the threshold.</p>
<p>The far helicopter goes first, at about 17 dB of extra noise, then the small boat at about 21 dB; the near car holds out past 40 dB. Lowering the threshold would keep them longer, at the price of noise spikes marked as targets: every radar sets that trade between misses and false alarms.</p>`,
			notes: `<p>Real detectors estimate the noise around each cell (constant false-alarm rate, CFAR) rather than knowing it. Detections from look to look are then joined into tracks, often with a <a href="../kalman-filter/">Kalman filter</a> that predicts where each target should be on the next sweep.</p>`
		},
		// ------------------------------------------------------------------ water
		{
			id: 'sonar',
			chapter: 'water',
			title: 'Sonar: the same idea, slow and low',
			scene: 'sonar',
			duration: 36,
			controls: [medium, freq, temp],
			body: `
<p>Under the sea radar is useless: seawater conducts electricity, and radio dies within metres (its <dfn data-def="The depth over which a radio wave in a conductor falls to 1/e of its amplitude: 1 ÷ √(π f μ σ). In seawater, about 2.5 m at 10 kHz.">skin depth</dfn> is 2.5 m even at 10 kHz, and shrinks as the frequency rises). Sound travels well, so <dfn data-def="Sound navigation and ranging: ranging with pulses of sound, mostly under water.">sonar</dfn> does the same job with pings of sound, and the same rules: range = speed × delay ÷ 2, Doppler = 2v ÷ λ, resolution set by bandwidth.</p>
<p>But sound in seawater travels at about 1,500 m/s, 200,000 times slower than light (1,490 m/s at 10 °C, faster when warmer or deeper). An echo from 10 km takes 13 s instead of 67 µs, so a sonar pings a few times a minute where a radar fires thousands of pulses a second, and a target moves on between pings.</p>
<p>And water absorbs sound faster the higher its pitch: at 1 kHz, 0.07 dB per km; at 10 kHz, 1.2 dB; at 100 kHz, 34 dB. Over the 20 km of a 10 km round trip that is 1.4 dB against 680 dB. Long-range sonar uses low frequencies, at the price of long wavelengths (1.5 m at 1 kHz) and so big arrays; short-range sonars, for mapping a seabed or finding a fish, use high ones for detail.</p>`,
			notes: `<p>The sound speed is Mackenzie's (1981) nine-term formula, which reproduces his stated check value of 1550.744 m/s at 25 °C, 35 ‰ and 1000 m; absorption is Thorp's (1967) formula. In the real ocean the speed changes with depth, so sound paths bend, sometimes into a channel that carries low-frequency sound for thousands of kilometres. Underwater, the Doppler shift is relatively huge: 10 m/s at 10 kHz shifts the echo by 134 Hz, more than 1 %.</p>`
		}
	]
};
