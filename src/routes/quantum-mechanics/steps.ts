import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- the double slit ------------------------------------------------------------------
// Lengths on the slit steps are in units of the slit separation d (see quantum.ts).

const rate: Control = {
	type: 'range',
	id: 'rate',
	label: 'Electrons per second',
	min: 1,
	max: 400,
	step: 1,
	default: 4,
	help: 'At a few per second you can follow each one; turn it up to fill the screen.'
};
const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Screen',
	action: 'Clear the screen and start again'
};
const wavelength: Control = {
	type: 'range',
	id: 'wavelength',
	label: 'Electron wavelength',
	min: 0.6,
	max: 1.5,
	step: 0.05,
	default: 1,
	format: (v) => `fringes ${v.toFixed(2)} d apart`,
	help: 'Slower electrons have a longer wavelength. The fringe spacing is λL/d.'
};
const probe: Control = {
	type: 'range',
	id: 'probe',
	label: 'Point on the screen',
	min: -4,
	max: 4,
	step: 0.05,
	default: 0.5,
	format: (v) => `y = ${v.toFixed(2)} d`,
	help: 'Or drag the marker on the screen.'
};
const slit: Control = {
	type: 'select',
	id: 'slit',
	label: 'Open slits',
	default: 'both',
	options: [
		{ value: 'both', label: 'Both' },
		{ value: 'top', label: 'Top only' },
		{ value: 'bottom', label: 'Bottom only' }
	]
};
const detector: Control = {
	type: 'toggle',
	id: 'detector',
	label: 'Which-slit detector',
	default: false,
	help: 'A light beam behind the slits scatters a photon off each electron.'
};
const reading: Control = {
	type: 'toggle',
	id: 'reading',
	label: 'Someone reads the record',
	default: false,
	help: 'Colours each dot by the slit the detector recorded.'
};
const record: Control = {
	type: 'range',
	id: 'record',
	label: 'How well the record tells the slits apart',
	min: 0,
	max: 100,
	step: 5,
	default: 50,
	unit: '%',
	help: '0%: the detector learns nothing. 100%: it always knows the slit.'
};

// ---- the wave packet and the box ---------------------------------------------------------

const energy: Control = {
	type: 'range',
	id: 'energy',
	label: 'Electron energy',
	min: 0.2,
	max: 3,
	step: 0.1,
	default: 1,
	unit: ' eV'
};
const sigma: Control = {
	type: 'range',
	id: 'sigma',
	label: 'Starting width of the packet',
	min: 0.4,
	max: 3,
	step: 0.1,
	default: 1,
	unit: ' nm',
	help: 'The spread σ of the position, at the start.'
};
const level: Control = {
	type: 'select',
	id: 'level',
	label: 'State',
	default: '1',
	options: [
		{ value: '1', label: 'n = 1' },
		{ value: '2', label: 'n = 2' },
		{ value: '3', label: 'n = 3' },
		{ value: '1+2', label: 'n = 1 and 2 together' }
	]
};
const boxL: Control = {
	type: 'range',
	id: 'boxL',
	label: 'Width of the box',
	min: 0.5,
	max: 2,
	step: 0.1,
	default: 1,
	unit: ' nm'
};

// ---- tunnelling ----------------------------------------------------------------------------
// The electron's energy is fixed at 1 eV on these steps.

const height: Control = {
	type: 'range',
	id: 'height',
	label: 'Barrier height',
	min: 0,
	max: 3,
	step: 0.1,
	default: 2,
	unit: ' eV',
	help: 'The electron has 1 eV.'
};
const width: Control = {
	type: 'range',
	id: 'width',
	label: 'Barrier width',
	min: 0.05,
	max: 1,
	step: 0.05,
	default: 0.25,
	format: (v) => `${v.toFixed(2)} nm`
};
const fast: Control = {
	type: 'toggle',
	id: 'fast',
	label: 'Fast: 25 electrons a second',
	default: false,
	help: 'Only the counts are shown, not each wave.'
};
const gap: Control = {
	type: 'range',
	id: 'gap',
	label: 'Gap between tip and surface',
	min: 0.3,
	max: 1,
	step: 0.05,
	default: 0.5,
	format: (v) => `${v.toFixed(2)} nm`
};

export const spec: ExplainerSpec = {
	slug: 'quantum-mechanics',
	title: 'Quantum mechanics',
	summary:
		'Fire electrons one at a time at two slits and watch single dots build up an interference pattern, then record which slit each one took and watch the pattern vanish. Solve the Schrödinger equation for a wave packet and send it at a barrier it cannot climb: part of it tunnels through.',
	chapters: [
		{ id: 'slits', title: 'One electron at a time' },
		{ id: 'which', title: 'Which slit?' },
		{ id: 'equation', title: 'The Schrödinger equation' },
		{ id: 'tunnel', title: 'Tunnelling' }
	],
	steps: [
		// ------------------------------------------------------------------ slits
		{
			id: 'dots',
			chapter: 'slits',
			title: 'Dots that make waves',
			scene: 'slits',
			hints: { phase: 'dots' },
			duration: 24,
			controls: [rate, restart],
			body: `
<p>Fire electrons, one at a time, at a wall with two narrow slits, and let them land on a screen that flashes where each one arrives. Each electron makes <strong>one dot</strong>, at one place, like a tiny bullet. Where it lands looks random.</p>
<p>Keep going. Turn the rate up and the dots pile up into <strong>stripes</strong>: bands where electrons land often, and between them bands where almost none ever land. These are <dfn data-def="Bright and dark bands made where two waves arriving by different paths reinforce or cancel each other.">interference fringes</dfn> — the pattern two sets of ripples make in a ripple tank, where crest meets crest or crest meets trough.</p>
<p>But only one electron is in the apparatus at a time. There is nothing for it to interfere <em>with</em> except itself. Whatever goes through the slits is a wave, which passes through both and interferes on the far side; what arrives at the screen is a particle, at one spot.</p>`,
			notes: `<p>This experiment has been done with electrons, one at a time: Claus Jönsson made the first electron double slit in 1961; in 1974 Pier Giorgio Merli, Gian Franco Missiroli and Giulio Pozzi recorded single electrons building up the fringes, and in 1989 Akira Tonomura's team at Hitachi filmed the pattern growing dot by dot (both with an electron biprism, which splits the wave in two like a pair of slits). It works with neutrons, atoms and molecules of up to about 2,000 atoms too.</p>
<p>The drawing is not to scale. Real electron slits are a fraction of a micrometre apart and the fringes form on a screen about a metre away, a fraction of a millimetre apart; on the page lengths are in units of the slit separation <i>d</i>, and the sideways direction is stretched. Each dot's position is drawn at random from the probability the next steps compute.</p>`
		},
		{
			id: 'amplitudes',
			chapter: 'slits',
			title: 'Add amplitudes, then square',
			scene: 'slits',
			hints: { phase: 'amplitudes' },
			duration: 24,
			controls: [probe, wavelength],
			body: `
<p>Quantum mechanics describes the electron by a <dfn data-def="ψ (psi): a complex number at every point of space (and time). Its squared length |ψ|² is the probability density of finding the particle there.">wave function</dfn> ψ, a <strong>complex number</strong> at every point, called the <dfn data-def="A complex number attached to each possible outcome; the probability of the outcome is its squared length.">probability amplitude</dfn>. Each slit sends its own wave to every point of the screen: two amplitudes, the two arrows in the panel. Their lengths say how strongly each wave arrives; their angles are their phases, set by the distance travelled.</p>
<p>The rule is the one for ripples, written with complex numbers:</p>
<p class="formula"><strong>ψ = ψ<sub>top</sub> + ψ<sub>bottom</sub></strong> &nbsp; and &nbsp; <strong>probability ∝ |ψ|²</strong></p>
<p>Move the point along the screen. Where the two arrows point the same way they add to a long arrow: a bright fringe. Where they point opposite ways they cancel, |ψ|² = 0, and no electron ever lands there. This is <dfn data-def="Max Born's rule (1926): the probability of finding a particle at a place is proportional to the squared length |ψ|² of its wave function there.">Born's rule</dfn>: the wave sets the odds, and each electron lands at one random place with those odds.</p>
<p>The electron's wavelength is <dfn data-def="Louis de Broglie's relation (1924): a particle of momentum p has a wavelength λ = h/p, with h Planck's constant.">de Broglie's</dfn> λ = <i>h</i>/<i>p</i>: about 50 picometres for an electron accelerated through 600 volts. A longer wavelength spreads the fringes out.</p>`,
			notes: `<p>Adding arrows is complex addition, and the angle between the arrows is the phase difference 2π × (path difference)/λ — the same path difference that set the calm lines in the ripple tank. What is new is that the wave is a wave of <em>amplitude</em>, not of anything you could measure directly: the squared length gives a probability, and the overall angle of ψ (turning both arrows together) changes nothing you can observe.</p>
<p>The pattern on the stage is computed, not drawn from a formula: past the slits, the sideways part of ψ obeys the Schrödinger equation of the third chapter with the distance travelled in place of time (the paraxial approximation), solved with the same split-step method. Far from the slits it becomes the textbook cos²(π<i>dy</i>/λ<i>L</i>) × sinc²(π<i>wy</i>/λ<i>L</i>) for slits of width <i>w</i>; the tests check that.</p>`
		},
		{
			id: 'one-slit',
			chapter: 'slits',
			title: 'Two slits are not one slit plus another',
			scene: 'slits',
			hints: { phase: 'one-slit' },
			duration: 24,
			controls: [slit, rate],
			body: `
<p>Close one slit. The fringes are gone: through one slit the wave just spreads out into a single broad hump. Close the other instead and you get the same hump, shifted a little.</p>
<p>If each electron really went through one slit or the other, the two-slit pattern would be those two humps added — the dashed curve. It is not. With both slits open, some places on the screen get <strong>fewer</strong> electrons than with one slit open: opening a second way through has made it <em>less</em> likely to land there.</p>
<p>No particle that takes one path or the other can do that. Amplitudes can: they add, and a sum of complex numbers can be shorter than either. Probabilities, which are never negative, can only add up.</p>`,
			notes: `<p>In formulas: |ψ<sub>top</sub> + ψ<sub>bottom</sub>|² = |ψ<sub>top</sub>|² + |ψ<sub>bottom</sub>|² + 2 Re(ψ<sub>top</sub>* ψ<sub>bottom</sub>). The last term, the <em>interference term</em>, is the difference between the solid and dashed curves. It is positive at the bright fringes, negative at the dark ones, and averages to zero across the screen: the electrons are not lost, only moved.</p>`
		},
		// ------------------------------------------------------------------ which
		{
			id: 'detector',
			chapter: 'which',
			title: 'Record the slit and the fringes vanish',
			scene: 'slits',
			hints: { phase: 'detector' },
			duration: 26,
			controls: [detector, reading, rate],
			body: `
<p>Now try to catch the electron in the act. Switch on the detector: light shone across the back of the slits, so that each electron scatters a photon whose direction records which slit it came through. The fringes <strong>disappear</strong>. What is left is the dashed curve: the two single-slit humps, added.</p>
<p>The cause is the record, not anyone looking at it. The electron and the photon are now <dfn data-def="Two systems whose joint state cannot be described as one state for each: what you would find for one depends on what you find for the other.">entangled</dfn>: “electron through the top slit, photon scattered one way” and “electron through the bottom, photon the other way”. These two possibilities no longer end in the same place, because the photons differ, so their amplitudes cannot cancel: their <em>probabilities</em> add instead.</p>
<p>Switch <em>Someone reads the record</em> on and off. Reading it only colours each dot by its slit; the pattern is exactly the same either way. The fringes went the moment the record was made — by a photon flying off into the room, read by no one.</p>`,
			notes: `<p>This is the textbook meaning of a <dfn data-def="In quantum mechanics: any interaction that leaves a lasting record of a quantity, whether or not anyone looks at it.">measurement</dfn>: an interaction that leaves a lasting trace somewhere. Anything will do — a photon, an air molecule bumping into the electron, a change in a nearby current. That is why everyday objects never show fringes: they are recorded by their surroundings all the time (<em>decoherence</em>).</p>
<p>With the detector on, the page sends each electron through one slit, at random, and draws its landing place from that slit's wave alone. Quantum mechanics says that gives exactly the same pattern as adding the probabilities, and the tests check it.</p>`
		},
		{
			id: 'partial',
			chapter: 'which',
			title: 'Half a record, half the fringes',
			scene: 'slits',
			hints: { phase: 'partial' },
			duration: 24,
			controls: [record, rate],
			body: `
<p>A detector can be sloppy. Use light whose wavelength is longer than the slit separation and you can no longer always tell from the scattered photon which slit the electron used. The photon is left in one of two states that partly overlap.</p>
<p>Turn the slider. As the record gets better the fringes fade smoothly; with a useless record they are perfect, with a perfect record they are gone. Their <dfn data-def="(Pmax − Pmin)/(Pmax + Pmin) for the bright and dark fringes: 1 when the dark fringes are perfectly dark, 0 when there are no fringes.">visibility</dfn> follows the overlap γ of the detector's two states (it equals γ wherever the two waves arrive equally strong; the readout differs slightly because the single-slit hump fades towards the dark fringes):</p>
<p class="formula"><strong>P = |ψ<sub>top</sub>|² + |ψ<sub>bottom</sub>|² + 2γ Re(ψ<sub>top</sub>* ψ<sub>bottom</sub>)</strong></p>
<p>How sharp the fringes are and how well you could know the path trade off against each other: you can have some of each, never all of both.</p>`,
			notes: `<p>The slider sets the <em>distinguishability</em> D of the two photon states, and the overlap is γ = √(1 − D²), so V² + D² = 1. Englert's duality relation (1996) says V² + D² ≤ 1 for any detector, with equality for pure detector states like the ones modelled here; it has been tested in experiments with atoms and photons. The slider is a model of the detector, not of a particular apparatus.</p>`
		},
		// ------------------------------------------------------------------ equation
		{
			id: 'packet',
			chapter: 'equation',
			title: 'The Schrödinger equation',
			scene: 'packet',
			hints: { phase: 'packet' },
			duration: 22,
			controls: [energy, sigma],
			body: `
<p>How does ψ change in time? Erwin Schrödinger's equation (1926) says, for a particle of mass <i>m</i> in one dimension with potential energy <i>V</i>(<i>x</i>):</p>
<p class="formula"><strong>iħ ∂ψ/∂t = −(ħ²/2m) ∂²ψ/∂x² + V(x) ψ</strong></p>
<p>Here is a free electron (V = 0) as a <dfn data-def="A wave function confined to a region: a band of waves with nearby wavelengths that add up in one place and cancel elsewhere.">wave packet</dfn>. The blue and orange curves are the real and imaginary parts of ψ; the filled shape is |ψ|², where the electron would be found. The complex number ψ turns as it travels, so its two parts swap back and forth like the cosine and sine of e<sup>iθ</sup>.</p>
<p>The packet moves at the classical speed <i>p</i>/<i>m</i> — about 590 km/s at 1 eV — and it <strong>spreads</strong>: a packet made narrow in position contains a wide range of momenta (Δ<i>x</i> · Δ<i>p</i> ≥ ħ/2, <dfn data-def="Werner Heisenberg's uncertainty principle: the spreads of position and momentum of any quantum state satisfy Δx·Δp ≥ ħ/2.">Heisenberg's uncertainty principle</dfn>), and the faster parts run ahead. Make it narrower and watch it spread faster. The total probability under the curve stays exactly 1.</p>`,
			notes: `<p>ħ = <i>h</i>/2π = 6.58 × 10⁻¹⁶ eV·s. The page solves the equation on a grid of 1024 to 8192 points with the <dfn data-def="A way of solving the Schrödinger equation: alternate small steps of the potential energy, applied point by point, and of the kinetic energy, applied exactly to each wavelength after a fast Fourier transform.">split-step Fourier method</dfn>: in each small time step the potential turns the phase of ψ point by point, and the kinetic energy turns the phase of each wavelength component, after a fast Fourier transform. Each step only turns complex numbers (point by point, or wavelength by wavelength), so the total probability is kept exactly. For a free particle the kinetic step alone is the exact solution. The tests check the speed, the spreading σ(t) = σ₀√(1 + (ħt/2mσ₀²)²) and the conservation of probability.</p>`
		},
		{
			id: 'box',
			chapter: 'equation',
			title: 'Trapped waves have fixed energies',
			scene: 'packet',
			hints: { phase: 'box' },
			duration: 22,
			controls: [level, boxL],
			body: `
<p>Trap the electron in a box with walls it cannot pass. Like the waves on a guitar string, only waves that fit — a whole number of half-wavelengths across the box — survive. Each one is a <dfn data-def="A solution of the Schrödinger equation whose probability |ψ|² does not change in time; it has a definite energy E, and ψ just turns at the rate E/ħ.">stationary state</dfn> with its own energy:</p>
<p class="formula"><strong>Eₙ = n² h² / 8mL²</strong> &nbsp; (n = 1, 2, 3…)</p>
<p>For a box 1 nm wide, E₁ = 0.38 eV, E₂ = 4E₁, E₃ = 9E₁. In a stationary state ψ just turns, at the rate E/ħ, everywhere at once; |ψ|² stays still. Nothing you could measure about where the electron is changes.</p>
<p>Now choose n = 1 and 2 together. The two turn at different rates, so where they add and where they cancel keeps changing, and |ψ|² sloshes from side to side. Motion in quantum mechanics is interference between states of different energy. Electrons in atoms are trapped waves too, which is why atoms have energy levels.</p>`,
			notes: `<p>The sloshing repeats every <i>h</i>/(E₂ − E₁): for the 1 nm box about 3.7 femtoseconds. An atom's electron sits in a three-dimensional trap made by the nucleus's attraction, not a box with hard walls, so its energies follow a different rule (−13.6 eV/n² for hydrogen), but the reason they are fixed is the same.</p>`
		},
		// ------------------------------------------------------------------ tunnel
		{
			id: 'barrier',
			chapter: 'tunnel',
			title: 'Through a wall it cannot climb',
			scene: 'barrier',
			hints: { phase: 'barrier' },
			duration: 22,
			controls: [height, width],
			body: `
<p>Send an electron with 1 eV of energy at a barrier 2 eV high. A ball rolled at a hill it cannot climb comes straight back, every time. The wave does something else: most of it reflects, but a part comes out on the other side and carries on. This is <dfn data-def="A quantum particle passing through a region where its energy is lower than the potential energy, which would be forbidden to a classical particle.">tunnelling</dfn>.</p>
<p>Inside the barrier ψ doesn't oscillate: it <strong>dies away exponentially</strong>, as e<sup>−κx</sup> with κ = √(2m(V − E))/ħ. If the barrier is thin enough, some of ψ is still left at the far side, and it leaks out. With the barrier 0.25 nm wide, about <strong>27%</strong> of the probability gets through; at 0.5 nm, about 2.5%.</p>
<p>Lower the barrier below 1 eV and the wave sails over — but not all of it: even a barrier lower than the electron's energy reflects a little of the wave, which a ball rolling over it would never do.</p>`,
			notes: `<p>The panel compares the simulated fraction with the textbook result for a plane wave of exactly 1 eV, T = 1/[1 + V₀² sinh²(κa) / (4E(V₀ − E))]. A packet contains a spread of energies, about ±0.13 eV here, and its faster parts tunnel more easily, so the two differ a little; averaged over the packet's energies the textbook formula matches the simulation to about 1%. The barrier width moves in steps of the grid spacing, 0.05 nm.</p>`
		},
		{
			id: 'exponential',
			chapter: 'tunnel',
			title: 'Thicker walls, exponentially less',
			scene: 'barrier',
			hints: { phase: 'exponential' },
			duration: 22,
			controls: [width, height],
			body: `
<p>The plot shows the chance of getting through against the width of the barrier, on a <strong>logarithmic</strong> scale: each grid line down is ten times less. Away from the thinnest barriers, and as long as the barrier is higher than the electron's energy, the curve is a straight line,</p>
<p class="formula"><strong>T ≈ (prefactor) × e<sup>−2κa</sup></strong></p>
<p>— each extra 0.1 nm of a 2 eV barrier divides the chance by about 2.8. Raise the barrier and the line gets steeper. A ball would need the energy to go over; for the wave the barrier's <em>height and width</em> together set the odds, and only a thick or high enough barrier makes them practically zero.</p>`,
			notes: `<p>The squared amplitude decays twice as fast as the amplitude, hence 2κ. For V − E = 1 eV, κ = 5.1 per nanometre. This exponential sensitivity is why tunnelling matters only for light particles over short distances: for a proton κ is 43 times larger (√(mₚ/mₑ)), and for a ball it is astronomically large.</p>`
		},
		{
			id: 'measure',
			chapter: 'tunnel',
			title: 'One electron, one answer',
			scene: 'barrier',
			hints: { phase: 'measure' },
			duration: 30,
			controls: [fast, height, width],
			body: `
<p>After the wave has split, part on each side, put a detector on each side. Each run, <strong>exactly one</strong> of them clicks. The electron is never found 27% on the right: it is found whole, on one side, at random. As soon as one detector clicks, the wave on the other side is gone: the electron is now known to be here.</p>
<p>Keep sending electrons and count. The fraction found on the right settles on the share of |ψ|² that got through. The wave never tells you where one electron will be; it tells you, exactly, how often.</p>`,
			notes: `<p>The jump from a spread-out wave to “found here” is the <dfn data-def="The update of the wave function when a measurement gives a definite result: afterwards, only the part of ψ consistent with the result remains.">collapse</dfn> of the wave function on measurement. The Schrödinger equation alone never makes it happen; what it means physically — a real jump, a branching of the world, or an update of knowledge — is still argued over by physicists, but the standard interpretations all give the same predictions (proposed modifications that make collapse a physical process are being tested): Born's rule, which is what the counts test.</p>`
		},
		{
			id: 'stm',
			chapter: 'tunnel',
			title: 'Seeing atoms by tunnelling',
			scene: 'barrier',
			hints: { phase: 'stm' },
			duration: 26,
			controls: [gap],
			body: `
<p>Tunnelling is everywhere. A <dfn data-def="A microscope that scans a sharp metal tip a fraction of a nanometre above a surface and measures the tunnelling current between them; invented by Gerd Binnig and Heinrich Rohrer at IBM Zürich in 1981.">scanning tunnelling microscope</dfn> holds a sharp metal tip less than a nanometre above a surface. Electrons cannot jump the gap — the vacuum is a barrier a few eV high, the metal's <dfn data-def="The energy needed to pull an electron out of a metal into the vacuum; about 4–5 eV for most metals.">work function</dfn> — but they tunnel through it, and a tiny current flows.</p>
<p>Because the chance falls exponentially with the gap, the current is exquisitely sensitive to it: here, with a 4.5 eV work function, each extra <strong>0.1 nm cuts the current about ninefold</strong>. Scan the tip across the surface, keeping the current fixed, and it rises and falls over every atom.</p>
<p>The same tunnelling lets alpha particles escape from nuclei (radioactive decay), lets protons in the Sun fuse at temperatures too low to climb their mutual repulsion, and stores the charge in flash memory.</p>
<p><strong>A quantum object is described by a wave of complex amplitudes that interferes with itself, as it did at the slits and the barrier; a measurement gives one random outcome, with odds set by |ψ|².</strong></p>`,
			notes: `<p>The 4.5 eV work function is a typical value (tungsten, a common tip metal, has about 4.5 eV); the gaps are those of a real STM. Each 0.1 nm of gap multiplies the transmission by e<sup>−2κ × 0.1 nm</sup> with κ = 10.9 per nanometre, a factor of about 9. An atom sticking up from the surface brings it a fraction of a nanometre closer to the tip, so the current jumps as the tip passes over it. The page uses a one-dimensional rectangular barrier; a real tip's barrier is rounded by the image charge and the applied voltage.</p>`
		}
	]
};
