import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- controls ------------------------------------------------------------------------

/** A length in metres with a sensible unit: 4 km, 80 µm, 1.7 fm. */
export function length(m: number) {
	const units: [number, string][] = [
		[1e3, 'km'],
		[1, 'm'],
		[1e-3, 'mm'],
		[1e-6, 'µm'],
		[1e-9, 'nm'],
		[1e-12, 'pm'],
		[1e-15, 'fm'],
		[1e-18, 'am']
	];
	const [u, name] = units.find(([u]) => m >= u * 0.999) ?? units[units.length - 1];
	const v = m / u;
	return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v.toPrecision(2)} ${name}`;
}

const vOrb: Control = {
	type: 'range',
	id: 'vOrb',
	label: 'Orbital speed',
	min: 0.15,
	max: 0.45,
	step: 0.01,
	default: 0.3,
	format: (v) => `${v.toFixed(2)} × the speed of light`,
	help: 'How fast the two black holes move relative to each other.'
};

const pol: Control = {
	type: 'select',
	id: 'pol',
	label: 'Polarisation',
	default: 'plus',
	options: [
		{ value: 'plus', label: 'plus (+)' },
		{ value: 'cross', label: 'cross (×)' }
	]
};
const arms: Control = {
	type: 'toggle',
	id: 'arms',
	label: 'Show two perpendicular arms',
	default: false
};

const source: Control = {
	type: 'select',
	id: 'source',
	label: 'Source',
	default: 'earth',
	options: [
		{ value: 'earth', label: 'The Earth round the Sun' },
		{ value: 'pulsar', label: 'The Hulse–Taylor binary pulsar' },
		{ value: 'bbh', label: 'Two black holes (GW150914) near the end' }
	]
};

const mass = (id: string, label: string, v: number): Control => ({
	type: 'range',
	id,
	label,
	min: 10,
	max: 80,
	step: 1,
	default: v,
	format: (x) => `${x} suns`
});
const m1 = mass('m1', 'Mass of the first black hole', 36);
const m2 = mass('m2', 'Mass of the second black hole', 29);
const hear: Control = {
	type: 'action',
	id: 'hear',
	label: 'Sound',
	action: '▶ Hear the chirp',
	help: 'The last seconds before the innermost stable orbit, at the real pitch.'
};
const pitch: Control = {
	type: 'toggle',
	id: 'pitch',
	label: 'Two octaves higher (for small speakers)',
	default: false
};
const sameMc: Control = {
	type: 'toggle',
	id: 'sameMc',
	label: 'Compare with an equal-mass pair of the same chirp mass',
	default: false
};
const dist: Control = {
	type: 'range',
	id: 'dist',
	label: 'Distance',
	min: 40,
	max: 4000,
	step: 10,
	default: 410,
	format: (v) => `${v} Mpc (${((v * 3.2616) / 1000).toFixed(2)} billion light years)`
};

const wave: Control = {
	type: 'toggle',
	id: 'wave',
	label: 'A gravitational wave passes',
	default: true
};

const zoom: Control = {
	type: 'range',
	id: 'zoom',
	label: 'Zoom',
	min: 0,
	max: 22,
	step: 0.1,
	default: 22,
	format: (v) => `view ${length(10 ** (4 - v))} across`,
	help: 'Each step of 1 zooms in ten times.'
};
const dive: Control = {
	type: 'action',
	id: 'dive',
	label: 'Zoom',
	action: '▶ Dive in from 4 km'
};

const align: Control = {
	type: 'toggle',
	id: 'align',
	label: 'Shift Hanford 6.9 ms earlier and flip it',
	default: false
};
const nr: Control = {
	type: 'toggle',
	id: 'nr',
	label: 'Show the prediction of general relativity',
	default: false
};
const hearData: Control = {
	type: 'action',
	id: 'hearData',
	label: 'Sound',
	action: '▶ Hear the data',
	help: 'Livingston’s 0.2 s, at the real pitch, played three times.'
};

const fitMc: Control = {
	type: 'range',
	id: 'fitMc',
	label: 'Chirp mass of the curve',
	min: 10,
	max: 60,
	step: 0.5,
	default: 15,
	format: (v) => `${v.toFixed(1)} suns`
};

export const spec: ExplainerSpec = {
	slug: 'gravitational-waves',
	title: 'Gravitational waves',
	summary:
		'Set the masses of two black holes and let them spiral together: ripples spread out, the signal climbs into a chirp you can hear, and a laser interferometer’s arms stretch and squeeze by far less than a proton. Then read the masses off the real signal of GW150914.',
	chapters: [
		{ id: 'ripples', title: 'Ripples in spacetime' },
		{ id: 'chirp', title: 'The chirp' },
		{ id: 'detect', title: 'Catching one' }
	],
	steps: [
		// ------------------------------------------------------------------ ripples
		{
			id: 'ripples',
			chapter: 'ripples',
			title: 'Accelerating masses make waves',
			scene: 'binary',
			hints: { phase: 'ripples' },
			duration: 22,
			controls: [vOrb],
			body: `
<p>In <a href="../black-holes/#straight">general relativity</a>, mass curves spacetime. Move the mass and the curvature has to change too, but the news cannot travel faster than light. So when masses accelerate, changes in curvature spread outwards at the speed of light: <dfn data-def="Ripples in the curvature of spacetime, made by accelerating masses and travelling at the speed of light. Predicted by Einstein in 1916, first detected directly in 2015.">gravitational waves</dfn>. Einstein predicted them in 1916, as an accelerating electric charge sends out light.</p>
<p>Two black holes in orbit are the loudest source there is. Seen from above, their waves form a two-armed spiral, like water from a spinning sprinkler: each crest left the pair a little earlier, when the pair was turned a little less far.</p>
<p>After half a turn the pair looks exactly as before, so the pattern repeats twice per orbit: the waves have <strong>twice the orbital frequency</strong>. Their strength falls as 1/distance, like the <a href="../waves-interference/#ripple-tank">ripples in a tank</a> spreading out.</p>`,
			notes: `<p>The drawing keeps the true ratio of wavelength to orbit: λ = π·a·c/v for a separation a and a relative speed v. Even at a third of the speed of light the waves are ten times longer than the orbit is wide, which is why the spiral looks so open. The motion is slowed down enormously: two black holes of 30 suns each at this speed go round about 15 times a second. The crests drawn are those of the "plus" polarisation, which you'll meet next.</p>`
		},
		{
			id: 'stretch',
			chapter: 'ripples',
			title: 'Stretch one way, squeeze the other',
			scene: 'ring',
			hints: { phase: 'ring' },
			duration: 20,
			controls: [pol, arms],
			body: `
<p>What does a gravitational wave do? Picture a ring of small masses floating freely in space, and let a wave pass straight through the page. The ring is stretched one way and squeezed the other, then the other way round, once per cycle. Nothing pushes the masses: the distances between them, the geometry itself, change.</p>
<p>The fraction by which a distance changes is the <dfn data-def="The fractional change in length a gravitational wave causes, h = ΔL/L. A dimensionless number; the waves that reach Earth have h ≈ 10⁻²¹.">strain</dfn>, h = ΔL/L. The wave is <strong>transverse</strong>: masses along its direction of travel (side view) don't move. And it comes in two <dfn data-def="The two independent ways a gravitational wave can distort space: 'plus', which stretches and squeezes along two perpendicular axes, and 'cross', the same pattern turned by 45°.">polarisations</dfn>, plus and cross, the same pattern turned by 45°.</p>
<p>Turn on the arms: when one is stretched the other is squeezed. Comparing the lengths of two perpendicular arms is how a wave is caught.</p>`,
			notes: `<p>The ring here swings by ±25% of its size. A real wave from a black-hole merger, arriving on Earth, has h ≈ 10⁻²¹: the drawing is exaggerated some 10²⁰ times. Formally, the wave is a small change in the metric, and the distance between two free masses on the x axis grows by h₊/2 when the one on the y axis shrinks by h₊/2. Light waves have two polarisations 90° apart, because the electric field is a vector; gravitational waves have two 45° apart, because curvature is a tensor (spin 2).</p>`
		},
		{
			id: 'power',
			chapter: 'ripples',
			title: 'How much power: the quadrupole formula',
			scene: 'binary',
			hints: { phase: 'power' },
			duration: 26,
			controls: [source],
			body: `
<p>A ball that swells and shrinks, or spins smoothly, makes no gravitational waves. The total mass cannot change, and the centre of mass cannot wobble (momentum is conserved), so the first thing that can radiate is the mass distribution's <dfn data-def="A measure of how a mass distribution is stretched out (its second moment, ∫ρ xᵢxⱼ dV). A changing quadrupole moment is the lowest-order source of gravitational waves.">quadrupole moment</dfn>, its elongation. For two masses in a circular orbit of separation a, Einstein's <strong>quadrupole formula</strong> gives the power</p>
<p class="formula"><strong>P = (32/5) · (G⁴/c⁵) · (m₁m₂)² (m₁+m₂) / a⁵</strong></p>
<p>The factor G⁴/c⁵ makes it tiny for everyday things. The Earth going round the Sun radiates about 200 W, one bright light bulb. The steep 1/a⁵ means only very massive, very tight orbits matter. Choose the sources.</p>
<p>The first evidence came from the <strong>Hulse–Taylor pulsar</strong>, a neutron star orbiting another every 7.75 hours, found in 1974. Its orbit loses energy to gravitational waves, so its period shrinks. Measured over decades, the shrinking matches the formula to within 0.2%. Hulse and Taylor won the 1993 Nobel Prize.</p>`,
			notes: `<p>For an orbit of eccentricity e the power is multiplied by (1 + 73e²/24 + 37e⁴/96)/(1 − e²)^(7/2) (Peters & Mathews, 1963): 11.9 for the Hulse–Taylor pulsar, whose e = 0.617. The predicted rate, −2.40 × 10⁻¹² seconds per second, is 76 µs a year. J. M. Weisberg and Y. Huang (ApJ 829, 55, 2016) measure 0.9983 ± 0.0016 times the prediction, after correcting for the pulsar's acceleration in the Galaxy. The natural unit of the formula, c⁵/G = 3.6 × 10⁵² W, sets its scale: GW150914 at its peak reached a thousandth of it.</p>`
		},
		// ------------------------------------------------------------------ chirp
		{
			id: 'inspiral',
			chapter: 'chirp',
			title: 'Spiralling together',
			scene: 'chirp',
			hints: { phase: 'inspiral' },
			duration: 26,
			controls: [m1, m2, hear, pitch],
			body: `
<p>Energy carried off by the waves comes out of the orbit, so the two black holes draw closer. Closer means faster (Kepler), and faster means stronger waves: P grows as 1/a⁵. The loss feeds on itself and runs away. Over millions of years the orbit shrinks slowly; in the last second they whirl round tens of times a second, the lightest pairs over a hundred.</p>
<p>The wave follows the orbit: its frequency, twice the orbital one, and its amplitude both climb, faster and faster. This rising sweep is a <dfn data-def="A signal whose frequency rises with time, like a bird's chirp. The inspiral of a binary makes one.">chirp</dfn>. Below, the strain is drawn as it would arrive from 410 megaparsecs away, against time to the end of the inspiral.</p>
<p>Set the two masses and press <em>Hear the chirp</em>: the frequencies are in the range of hearing, so the wave can be played straight through a speaker, at its real pitch and speed.</p>`,
			notes: `<p>The model is the leading-order (Newtonian, quadrupole) inspiral: circular orbits shrinking through Keplerian circles, with each orbit's energy −Gm₁m₂/2a lost at the quadrupole rate. It stops at the innermost stable circular orbit; the next steps explain why. Corrections from general relativity (post-Newtonian terms, in powers of v/c) change the phase noticeably near the end, and real detections are matched against waveforms that include them. The orbit is drawn to scale, with the horizons, slowed down 30 times.</p>`
		},
		{
			id: 'chirp-mass',
			chapter: 'chirp',
			title: 'One number sets the sweep',
			scene: 'chirp',
			hints: { phase: 'track' },
			duration: 24,
			controls: [m1, m2, sameMc],
			body: `
<p>Solve the energy balance and the frequency f of the wave rises at the rate</p>
<p class="formula"><strong>df/dt = (96/5) π<sup>8/3</sup> (G𝓜/c³)<sup>5/3</sup> f<sup>11/3</sup></strong></p>
<p>The masses enter only through one combination, the <dfn data-def="𝓜 = (m₁m₂)^(3/5)/(m₁+m₂)^(1/5): the combination of the two masses that sets how fast the inspiral sweeps up in frequency. For equal masses it is 0.87 times each mass.">chirp mass</dfn> 𝓜 = (m₁m₂)<sup>3/5</sup>/(m₁+m₂)<sup>1/5</sup>. Measure a frequency and how fast it climbs and you have 𝓜, without knowing anything else about the source.</p>
<p>The plot shows the frequency against time. Heavier pairs sweep through the detectors' band (above ~30 Hz) in a fraction of a second and end at lower frequencies; lighter ones spend longer, over more cycles, and end higher. Turn on the comparison: a pair of different masses with the same chirp mass follows exactly the same track, until the end of the inspiral, which depends on the total mass.</p>`,
			notes: `<p>Integrating gives f(τ) = (1/π)(5/256τ)<sup>3/8</sup>(G𝓜/c³)<sup>−5/8</sup> for a time τ before the two would meet at leading order, and the number of cycles between two frequencies follows. Two neutron stars (𝓜 ≈ 1.2 suns) take about 100 s and thousands of cycles to sweep up from 24 Hz, as GW170817 did in 2017. The higher post-Newtonian terms bring in the mass ratio and the spins, which is how detections measure them too, less precisely.</p>`
		},
		{
			id: 'merger',
			chapter: 'chirp',
			title: 'The plunge, the merger and the ringdown',
			scene: 'chirp',
			hints: { phase: 'merger' },
			duration: 26,
			controls: [m1, m2],
			body: `
<p>The slow spiral cannot go on to the end. Inside the <a href="../black-holes/#isco">innermost stable circular orbit</a>, at 6GM/c² for the total mass M, no circular orbit survives, and the two black holes plunge towards each other. The wave there has a frequency of about <strong>4400 Hz ÷ (M in suns)</strong>, 68 Hz for 65 suns. That is where the model's chirp stops.</p>
<p>What follows, the merger, cannot be worked out on paper. It took until 2005 for computer simulations of Einstein's equations, <dfn data-def="Solving Einstein's equations on supercomputers, step by step in time, for situations like merging black holes where no approximation works.">numerical relativity</dfn>, to follow two black holes all the way through it. The horizons join into one, which rings like a struck bell and settles within milliseconds: the <dfn data-def="The last part of a merger signal: the newly formed black hole vibrates at its natural frequencies, which die away exponentially within a few cycles.">ringdown</dfn>.</p>
<p>Fits to those simulations give the result for any pair of masses. A few percent of the mass is radiated away as gravitational waves, and for similar masses the remnant spins at about two thirds of the maximum possible.</p>`,
			notes: `<p>Remnant mass from E. Barausse, V. Morozova and L. Rezzolla (ApJ 758, 63, 2012), spin from L. Rezzolla et al. (ApJ 674, L29, 2008), both for black holes that do not spin before merging; the ringing frequency and damping of the strongest (l = m = 2) mode from E. Berti, V. Cardoso and C. Will (Phys. Rev. D 73, 064030, 2006). The real signal goes on rising past the ISCO to a peak, and only then rings down; the plot leaves that stretch blank rather than draw a guess. A black hole that rings at the frequencies the theory predicts for its mass and spin is one of the tests of general relativity done with these signals.</p>`
		},
		{
			id: 'arrival',
			chapter: 'chirp',
			title: 'By the time it reaches us',
			scene: 'chirp',
			hints: { phase: 'arrival' },
			duration: 24,
			controls: [m1, m2, dist, hear, pitch],
			body: `
<p>The waves spread out as they travel, and their strain falls as 1/distance:</p>
<p class="formula"><strong>h = (4/d) · (G𝓜/c²)<sup>5/3</sup> · (πf/c)<sup>2/3</sup></strong></p>
<p>for a source seen face-on, straight above the detector. For black holes of 36 and 29 suns at 410 megaparsecs (1.3 billion light years) this gives a strain of about 10⁻²¹ near the end of the inspiral. Move the distance: ten times farther, ten times weaker.</p>
<p>A strain of 10⁻²¹, from an event that turned three suns' worth of mass into wave energy in a fifth of a second. Spacetime is extraordinarily stiff, and even the most violent events in the universe barely ruffle it by the time the waves reach us.</p>`,
			notes: `<p>A source that is tilted, or not overhead, gives a smaller strain: the detector feels a combination of the two polarisations weighted by its orientation. GW150914 peaked at 1.0 × 10⁻²¹, during the merger. The expansion of the universe also stretches the waves on the way: from 410 Mpc (redshift 0.09) they arrive 9% lower in frequency, as if the source were 9% heavier. The frequencies on this page are as emitted.</p>`
		},
		// ------------------------------------------------------------------ detect
		{
			id: 'interferometer',
			chapter: 'detect',
			title: 'A ruler made of light',
			scene: 'ifo',
			hints: { phase: 'michelson' },
			duration: 24,
			controls: [wave, pol],
			body: `
<p>LIGO compares two perpendicular arms, each 4 km long, with laser light. This is a <dfn data-def="An instrument that splits a beam of light in two, sends the halves along different paths and recombines them, so that a change in either path shows as a change in brightness.">Michelson interferometer</dfn>. A beam splitter sends half the light down each arm, mirrors at the far ends send it back, and the two halves recombine at a light sensor.</p>
<p>The arms are set so that the returning waves arrive half a wavelength out of step: crest meets trough and they cancel, the <a href="../waves-interference/#path-difference">destructive interference</a> you met in the ripple tank. The sensor stays dark. When a gravitational wave passes, one arm stretches while the other squeezes, the two paths differ, the cancellation is no longer perfect and light leaks out to the sensor, flickering in time with the wave.</p>
<p>The mirrors hang as pendulums, so they are free to move along the arms like the floating masses of the ring.</p>`,
			notes: `<p>The drawing is exaggerated beyond all measure: the arms' change is drawn about a tenth of a wavelength of light, where the real change is 10⁻¹² of one. Real detectors add tricks to make that measurable: each arm is a resonant cavity in which the light bounces back and forth about 300 times, and the light leaving the detector is recycled back in, so that around 100 kW circulates in each arm from a 20 W laser. A cross-polarised wave lined up with the arms stretches along the diagonals and leaves both arms' lengths unchanged: the detector feels nothing, which is why its response depends on the source's direction and orientation.</p>`
		},
		{
			id: 'to-scale',
			chapter: 'detect',
			title: 'Smaller than a proton',
			scene: 'scale',
			hints: { phase: 'scale' },
			duration: 28,
			controls: [zoom, dive],
			body: `
<p>How small is a strain of 10⁻²¹ on a 4 km arm? The difference between the two arms is ΔL = h·L = 4 × 10⁻¹⁸ m. Dive in from the arm, ten times closer at every step: past a human hair, a cell, an atom, an atomic nucleus, down to a single proton, 1.7 × 10⁻¹⁵ m across.</p>
<p>Still the change is out of sight. It is <strong>about 1/400 of the width of a proton</strong>. That is what LIGO measured in September 2015, with mirrors 34 cm across that are shaken by passing trucks, ocean waves on distant coasts and the jiggling of their own atoms.</p>
<p>To make that possible the arms are kept in one of the largest high vacuums on Earth, the mirrors hang from four-stage pendulums on actively isolated platforms, and the laser light is so steady that its quantum graininess is the limit at high frequencies.</p>`,
			notes: `<p>Everything is drawn to scale at each zoom; the labels give the true sizes. The width of a proton is twice its charge radius, 0.84 fm (CODATA). The light measures the mirrors' average surface, so the arms' length can be compared far more precisely than any atom on the mirror is placed: the light averages over some 10¹⁷ atoms.</p>`
		},
		{
			id: 'two-detectors',
			chapter: 'detect',
			title: 'GW150914: two detectors, one wave',
			scene: 'data',
			hints: { phase: 'data' },
			duration: 26,
			controls: [align, nr, hearData],
			body: `
<p>On 14 September 2015 at 09:50:45 UTC, the two LIGO detectors in Hanford, Washington, and Livingston, Louisiana, 3000 km apart, recorded this. Livingston caught it first; 6.9 milliseconds later, Hanford saw the same pattern. A wave at the speed of light takes up to 10 ms between the sites, so the delay also tells which part of the sky it came from.</p>
<p>The two detectors' arms point different ways, so Hanford sees the wave upside down. Shift Hanford 6.9 ms earlier and flip it: the two match, cycle for cycle, a chirp from 35 to 150 Hz over about 0.2 s. Then show the prediction of general relativity for two merging black holes: it matches the data.</p>
<p>Two detectors far apart are the main defence against noise: a truck or an earthquake shakes one site, not both within 10 ms. No noise in the detectors had ever looked this much like the signal: by chance, something like it would happen less than once in 203 000 years.</p>`,
			notes: `<p>Data: the strain behind Fig. 1 of B. P. Abbott et al., "Observation of Gravitational Waves from a Binary Black Hole Merger", Phys. Rev. Lett. 116, 061102 (2016), from the Gravitational Wave Open Science Center (gwosc.org, CC BY 4.0). As in the paper, it is band-passed to 35–350 Hz, where the detectors were most sensitive, with notches at the instruments' own spectral lines. The prediction is the numerical-relativity waveform SXS:BBH:0305 (SXS Collaboration) for the best-fitting masses, filtered the same way. Its signal-to-noise ratio was 24.</p>`
		},
		{
			id: 'measure',
			chapter: 'detect',
			title: 'Reading the masses off the signal',
			scene: 'data',
			hints: { phase: 'fit' },
			duration: 30,
			controls: [fitMc],
			body: `
<p>You can weigh the source yourself. Each dot is a frequency read from the average of the two detectors: one over twice the time between neighbouring zero crossings. The line is the leading-order chirp f(t) for the chirp mass on the slider, placed at the best moment. Slide until it runs through the dots.</p>
<p>The best fit is about 36 suns. This simple formula runs high: the full analysis, with general relativity's corrections, gives 30 as measured at Earth (28 at the source, before the expansion of the universe stretched the signal). The total mass is at least 2.3 times the chirp mass: about 70 suns. And near 150 Hz the orbit turned 75 times a second, so the two bodies were then only about 350 km apart.</p>
<p>Nothing that heavy and that compact can be anything but black holes: two neutron stars would be far too light, and a black hole paired with a neutron star would need a huge black hole to give this chirp mass, and would have merged at a much lower frequency. The waveform's amplitude then gave the distance, 410 Mpc. This was the first sighting of two black holes merging.</p>`,
			notes: `<p>Points from 0.355 to 0.42 s below 160 Hz are used; earlier ones are lost in the noise, later ones belong to the merger. The masses quoted by the discovery paper: 36 (+5 −4) and 29 ± 4 suns merging into 62 ± 4, with 3.0 ± 0.5 suns radiated at a peak power of 3.6 × 10⁴⁹ W, at 410 (+160 −180) Mpc. The paper makes the same argument from the frequency and its rate of change, with a chirp mass of about 30 suns. Weighing a source from its waves and getting its distance from their strength makes mergers "standard sirens", a new way to measure the expansion of the universe.</p>`
		},
		{
			id: 'takeaway',
			chapter: 'detect',
			title: 'A new way to see the universe',
			scene: 'binary',
			hints: { phase: 'summary' },
			duration: 24,
			body: `
<p>Since 2015 the detectors have heard hundreds of mergers. By the end of their third observing run in 2020, LIGO and Virgo had catalogued about 90, nearly all pairs of black holes. On 17 August 2017 they heard two neutron stars spiral together for 100 seconds; 1.7 s after the merger a gamma-ray burst arrived, and telescopes found the glow of the explosion in a galaxy 40 Mpc away. Light and gravity had raced 130 million years and arrived together: gravitational waves travel at the speed of light, to within one part in 10¹⁵.</p>
<p>Rainer Weiss, Barry Barish and Kip Thorne received the 2017 Nobel Prize for LIGO. The space mission LISA, with arms 2.5 million km long, is planned for the 2030s to catch the slower waves of giant black holes merging in the centres of galaxies.</p>
<p><strong>Accelerating masses send out ripples in spacetime, and detecting them means measuring a change in length far smaller than a proton.</strong></p>`,
			notes: `<p>GWTC-3 (LIGO, Virgo and KAGRA, 2021) lists 90 candidates with a probability above 50% of being astrophysical. GW170817: Abbott et al., PRL 119, 161101 (2017), and the joint gravitational-wave and gamma-ray paper, ApJL 848, L13 (2017), which bounds the difference between the speeds of gravity and light to between −3 × 10⁻¹⁵ and +7 × 10⁻¹⁶ of the speed of light.</p>`
		}
	]
};
