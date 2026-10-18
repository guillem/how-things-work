import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const sig = (v: number) =>
	v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toPrecision(2);

/** Pump strength per atom, as W·τ (excitations per atom per upper-level lifetime), on a log scale. */
const rate: Control = {
	type: 'range',
	id: 'rate',
	label: 'Pump strength W·τ',
	min: -4,
	max: 3,
	step: 0.05,
	default: -2,
	format: (v) => sig(10 ** v),
	help: 'How often the pump would lift a ground-state atom, per upper-level lifetime (log scale).'
};

const pump: Control = {
	type: 'range',
	id: 'pump',
	label: 'Pump power absorbed',
	min: 0,
	max: 10,
	step: 0.05,
	default: 0.8,
	format: (v) => `${v.toFixed(2)} W`
};

const mirror: Control = {
	type: 'range',
	id: 'R',
	label: 'Output mirror reflectivity',
	min: 0.7,
	max: 0.999,
	step: 0.001,
	default: 0.95,
	format: (v) => `${(v * 100).toFixed(1)}%`
};

const mirrorPump: Control = { ...pump, id: 'mirrorPump', default: 5 };

const spikePump: Control = {
	type: 'range',
	id: 'spikePump',
	label: 'Pump power, switched on at 0',
	min: 1.5,
	max: 10,
	step: 0.1,
	default: 3,
	format: (v) => `${v.toFixed(1)} W`
};

const qPump: Control = { ...spikePump, id: 'qPump', label: 'Pump power', default: 5 };

const hold: Control = {
	type: 'range',
	id: 'hold',
	label: 'Shutter closed for',
	min: 0,
	max: 800,
	step: 10,
	default: 400,
	format: (v) => (v === 0 ? 'never closed' : `${v.toFixed(0)} µs`),
	help: 'The pump is on from 0; the shutter opens after this long and stays open.'
};

export const spec: ExplainerSpec = {
	slug: 'lasers',
	title: 'Lasers',
	summary:
		'Pump a gain medium between two mirrors and follow its populations and the photons in the cavity under the rate equations: see why two levels can never be inverted, why four levels make it easy, how the inversion clamps at threshold while the output climbs in a straight line, and how a shutter turns the same laser into nanosecond pulses of kilowatts.',
	chapters: [
		{ id: 'gain', title: 'Light that copies itself' },
		{ id: 'threshold', title: 'Mirrors and threshold' },
		{ id: 'dynamics', title: 'Switching on, switching the cavity' }
	],
	steps: [
		// ------------------------------------------------------------------ gain
		{
			id: 'stimulated',
			chapter: 'gain',
			title: 'Absorption, spontaneous and stimulated emission',
			scene: 'medium',
			hints: { medium: 'two', phase: 'stimulated' },
			controls: [rate],
			body: `
<p>An atom has <a href="../quantum-mechanics/#box">discrete energy levels</a>. Take two of them, 1 and 2, with <i>N</i>₁ and <i>N</i>₂ atoms in them, and light whose photons carry exactly the energy difference <i>h</i>ν. Einstein (1917) showed that three things can happen:</p>
<ul>
<li><strong>Absorption:</strong> an atom in level 1 takes a photon and goes up.</li>
<li><strong>Spontaneous emission:</strong> an atom in level 2 drops on its own, after a lifetime τ on average, and emits a photon in a random direction.</li>
<li><strong>Stimulated emission:</strong> a photon passing an atom in level 2 makes it drop, and the new photon is a copy of the first: same direction, frequency, phase and polarisation.</li>
</ul>
<p>Absorption and stimulated emission have <em>the same</em> coefficient: a photon is as likely to be absorbed by an atom in level 1 as to be copied by one in level 2. So light passing through the medium grows only if <i>N</i>₂ &gt; <i>N</i>₁, a <dfn data-def="More atoms in the upper level of a transition than in the lower one, N₂ > N₁. Only then does stimulated emission outrun absorption.">population inversion</dfn>; its gain goes as <i>N</i>₂ − <i>N</i>₁. In a medium left alone almost every atom sits in the lower level, and a beam sent through (left to right) is absorbed.</p>`,
			notes: `<p>In thermal equilibrium <i>N</i>₂/<i>N</i>₁ = e<sup>−hν/kT</sup>; for a near-infrared transition at room temperature that is about e<sup>−45</sup>. Einstein's argument: with spontaneous emission alone, atoms could not stay in equilibrium with black-body radiation; it takes a stimulated process with the same coefficient as absorption to give Planck's law.</p>`
		},
		{
			id: 'two-level',
			chapter: 'gain',
			title: 'Two levels can never be inverted',
			scene: 'medium',
			hints: { medium: 'two', phase: 'two' },
			controls: [rate],
			body: `
<p>So pump it: shine light at the transition, harder and harder (the slider runs over seven powers of ten). The pump lifts atoms from 1 to 2 at a rate <i>W</i> per atom. But the pump's photons also have the energy <i>h</i>ν, so they stimulate atoms in level 2 back down at the same rate <i>W</i>:</p>
<p class="formula"><strong>dN₂/dt = W·(N₁ − N₂) − N₂/τ</strong></p>
<p>The pump moves atoms only while there are more below than above. At steady state <i>N</i>₂/<i>N</i> = <i>W</i>τ/(1 + 2<i>W</i>τ): it climbs towards <strong>one half</strong> and never gets there. The medium becomes transparent (as many photons copied as absorbed), never amplifying.</p>
<p>No steady pumping of two levels, at any power, inverts them. The curve on the right is the inversion (<i>N</i>₂ − <i>N</i>₁)/<i>N</i>: it rises towards the line of zero from below and stays under it.</p>`,
			notes: `<p>This holds for steady, incoherent pumping, which is what a lamp or a diode does. A short coherent pulse of exactly the right area can flip two-level atoms for a moment (a Rabi π pulse), and ammonia's beam maser (1954) used a different trick: it sorted the excited molecules out of the beam with an electric field rather than pumping them. Neither gives a medium that stays inverted.</p>`
		},
		{
			id: 'three-level',
			chapter: 'gain',
			title: 'Three levels: more than half the atoms',
			scene: 'medium',
			hints: { medium: 'three', phase: 'three' },
			controls: [rate],
			body: `
<p>The way out is a third level. The pump lifts atoms from the ground state into a broad <dfn data-def="A band of higher levels that absorbs the pump light well and empties within nanoseconds into the upper laser level, without emitting light.">pump band</dfn>, which empties within nanoseconds into the upper laser level 2. Level 2 lives long (τ is milliseconds in ruby), and nothing sends the atoms back up into the pump band. Now the pump doesn't stimulate the laser transition, and level 2 can fill up.</p>
<p>But in a three-level scheme like ruby's (the first laser, Maiman 1960) the lower laser level is the ground state itself. Every atom not in level 2 counts against the gain, so inversion starts only once <strong>more than half</strong> the atoms are up: at <i>W</i>τ = 1 on the slider, a pump that lifts each atom once per lifetime.</p>
<p>The page keeps the same atoms and cavity as the four-level laser to come, and changes only the scheme. The panel shows what that costs: about 2,900 W of absorbed pump to reach threshold. Ruby lasers were pumped by flash lamps for that reason.</p>`
		},
		{
			id: 'four-level',
			chapter: 'gain',
			title: 'Four levels: inversion at any pump',
			scene: 'medium',
			hints: { medium: 'four', phase: 'four' },
			controls: [rate],
			body: `
<p>Add a fourth level: the laser transition ends on a lower level 1 that sits above the ground state and empties into it within nanoseconds. Level 1 stays practically empty, so every atom in level 2 is inverted: <i>N</i>₂ − <i>N</i>₁ ≈ <i>N</i>₂, at any pump.</p>
<p>This is neodymium in YAG crystal (Nd:YAG), pumped by diode lasers at 808 nm and lasing at 1064 nm, with an upper-level lifetime τ = 230 µs. Drag the pump down to <i>W</i>τ = 10⁻⁴: one ion in ten thousand is excited, and a beam through 5 cm of rod already comes out 2% stronger. The panel's gain factor is per pass of the rod.</p>
<p>The chart compares the three schemes: the four-level curve is above zero everywhere, the three-level one crosses at <i>W</i>τ = 1, and the two-level one never does. Every laser and amplifier you meet in practice uses a four-level scheme or something close to it.</p>`,
			notes: `<p>The energy lost on the way (808 nm photons in, 1064 nm out, a "quantum defect" of 24%) heats the crystal. At high pump strength the gains on the panel become absurd: in a real rod, spontaneous photons amplified along its length (amplified spontaneous emission) would drain the upper level long before.</p>`
		},
		// ------------------------------------------------------------------ threshold
		{
			id: 'cavity',
			chapter: 'threshold',
			title: 'A cavity: gain against loss',
			scene: 'cavity',
			hints: { phase: 'cavity' },
			controls: [pump],
			body: `
<p>Put the rod between two mirrors: one reflects everything, the other (the output mirror) 95% at 1064 nm. Light in one <dfn data-def="One pattern of light that fits the cavity: a standing wave along the axis. A laser usually runs on one or a few of them.">mode</dfn> of the cavity bounces back and forth, gaining from the inverted atoms on each pass and losing through the output mirror and to scattering. The photons last τ<sub>c</sub> ≈ 9.4 ns on average before they leave. For <i>q</i> photons in the mode:</p>
<p class="formula"><strong>dq/dt = K·ΔN·(q + 1) − q/τ<sub>c</sub></strong>,&nbsp; <strong>dN₂/dt = pump − N₂/τ − K·ΔN·q</strong></p>
<p>The "+1" is spontaneous emission into this mode: an atom emits into a mode holding <i>q</i> photons at a rate proportional to <i>q</i> + 1. It seeds the mode with a photon now and then; the rest of the spontaneous light goes out sideways.</p>
<p>Below <dfn data-def="The inversion at which the gain per round trip equals the loss per round trip: K·ΔN·τ_c = 1.">threshold</dfn>, K·ΔN·τ<sub>c</sub> &lt; 1: each seeded photon makes fewer than one copy before it leaves, and the mode holds only a few photons. At 0.8 W of pump, about 3.</p>`
		},
		{
			id: 'threshold',
			chapter: 'threshold',
			title: 'Threshold: the inversion clamps',
			scene: 'cavity',
			hints: { phase: 'threshold' },
			controls: [pump],
			body: `
<p>Raise the pump. Near threshold (1.07 W here) each photon is copied almost once before it leaves; the photon number q ≈ <i>x</i>/(1 − <i>x</i>), with <i>x</i> = K·ΔN·τ<sub>c</sub>, shoots up. Above it the mode fills with about 10¹¹ photons (the left-hand chart is logarithmic: the jump spans ten powers of ten).</p>
<p>And the inversion stops growing (right-hand chart, dashed). It can't rise past the threshold value: if it did, gain would beat loss and the photons would multiply until stimulated emission brought it back down. Above threshold, ΔN sits at <i>N</i><sub>th</sub> = 1/(Kτ<sub>c</sub>), about 10¹⁵ ions, 0.02% of them, whatever the pump. This is <dfn data-def="Above threshold, the steady-state inversion stays at its threshold value whatever the pump; the extra pump goes into stimulated emission.">gain clamping</dfn>.</p>
<p>That is the laser's defining trick. Spontaneous emission from the clamped inversion stays fixed too, so every extra atom the pump raises can only leave level 2 by stimulated emission, into the same mode.</p>`
		},
		{
			id: 'output',
			chapter: 'threshold',
			title: 'Above threshold the output is a straight line',
			scene: 'cavity',
			hints: { phase: 'output' },
			controls: [pump],
			body: `
<p>With the inversion clamped, the arithmetic is simple. Pump atoms in at the rate P/<i>h</i>ν<sub>pump</sub>; <i>N</i><sub>th</sub>/τ of them per second still decay spontaneously; all the rest become photons in the mode. The output climbs on a straight line from the threshold pump:</p>
<p class="formula"><strong>P<sub>out</sub> = (ν<sub>laser</sub>/ν<sub>pump</sub>) · T/(T + L) · (P − P<sub>th</sub>)</strong></p>
<p>Nearly every extra pumped atom adds one photon to the mode, and the photons leave through the output mirror in the share T/(T + L): its transmission (−ln R = 0.051 per round trip) against the internal loss (L = 0.02). Here that is 72%, and 1064 nm photons carry 76% of an 808 nm pump photon's energy, so the slope is 55%: 5 W of pump gives 2.15 W of laser light.</p>
<p>Below threshold the mode's few photons give less than a nanowatt. The straight line and its sharp knee are what a measured laser's output looks like.</p>`,
			notes: `<p>The page assumes every absorbed pump photon puts one ion in the upper level; real Nd:YAG is close (about 0.9), and real lasers lose more to the mode's imperfect overlap with the pumped region, so their slopes are lower. A diode laser runs on the same equations: the pump is the current through a forward-biased <a href="../semiconductors/#forward">p-n junction</a>, the inversion is electrons and holes meeting in it, and below threshold it glows like an LED. Strictly, the inversion keeps creeping up by about one part in 10¹¹ above threshold; that tiny excess is the spontaneous emission into the mode (the +1).</p>`
		},
		{
			id: 'mirror',
			chapter: 'threshold',
			title: 'How much should the mirror let out?',
			scene: 'cavity',
			hints: { phase: 'mirror' },
			controls: [mirror, mirrorPump],
			body: `
<p>A leakier output mirror lets out a bigger share of the photons, but shortens their life in the cavity: τ<sub>c</sub> falls, <i>N</i><sub>th</sub> rises, and so does the threshold pump. At 80% reflectivity the threshold is 3.6 W; at 70%, 5.6 W.</p>
<p>A tighter mirror lowers the threshold but keeps the light in, where the internal loss eats it: at 99.9% the threshold falls to 0.3 W, and almost nothing gets out.</p>
<p>So the output at a given pump has a maximum (the right-hand chart, plotted against the reflectivity at the pump you set). For 5 W of pump it is near R = 94%. Designers choose the output mirror this way.</p>`
		},
		// ------------------------------------------------------------------ dynamics
		{
			id: 'spiking',
			chapter: 'dynamics',
			title: 'Switching on: spikes and relaxation oscillations',
			scene: 'dynamics',
			hints: { phase: 'spiking' },
			controls: [spikePump],
			body: `
<p>So far, steady states. Now switch the pump on at <i>t</i> = 0 and integrate the rate equations. The inversion builds up with nothing to stop it, passes threshold and overshoots, because the photons start from the odd spontaneous one and take time to multiply. When they catch up, they arrive as a spike and drain the inversion below threshold. The light dies, the inversion rebuilds, and again.</p>
<p>Each spike is smaller than the last: the laser settles into its steady output in <dfn data-def="Damped oscillations of the photon number and the inversion around their steady values, at a frequency set by the upper-level and photon lifetimes.">relaxation oscillations</dfn>, like a <a href="../oscillations-resonance/#damping">damped oscillator</a>. Linearise the rate equations around the steady state and they ring at</p>
<p class="formula"><strong>ω² ≈ (r − 1)/(τ·τ<sub>c</sub>)</strong>, decaying at <strong>r/2τ</strong>,</p>
<p>with <i>r</i> the pump over its threshold value. The two lifetimes, 230 µs and 9.4 ns, give spikes a few microseconds apart. The panel compares the period measured on the trace with this formula.</p>`,
			notes: `<p>The exact linearised result is ω² = (r − 1)/(ττ<sub>c</sub>) − (r/2τ)²; the second term is tiny here. The first spikes are far from small and come further apart than the formula says; the trace's late, small oscillations are the ones it describes. Semiconductor lasers have τ of nanoseconds and ring at gigahertz, which sets how fast they can be modulated to carry data.</p>`
		},
		{
			id: 'q-switch',
			chapter: 'dynamics',
			title: 'Q-switching: store the inversion, then let go',
			scene: 'dynamics',
			hints: { phase: 'qswitch' },
			controls: [hold, qPump],
			body: `
<p>Clamping caps the inversion only while the cavity works. Put a fast shutter in it (in practice a <dfn data-def="A crystal whose birefringence an applied voltage switches in nanoseconds; between polarisers it blocks or passes the light.">Pockels cell</dfn>) and keep it closed: no feedback, no lasing, and the pump piles atoms into level 2 for hundreds of microseconds, to several times the threshold inversion.</p>
<p>Open it: the gain is now far above the loss, the photon number grows from its few spontaneous photons by a large factor every round trip, and the stored energy leaves in one <strong>giant pulse</strong> of about 20 ns. The pulse peaks as the inversion falls through threshold and ends with the inversion left below it, at the value Wagner and Lengyel's relation gives (panel). At 5 W of pump it reaches about 22 kW, ten thousand times the continuous output, in a pulse of half a millijoule.</p>
<p>Set the shutter to never close and the same laser only spikes. Close it for longer and the pulse grows, until the stored inversion levels off after a few lifetimes. Pulsed lasers repeat this thousands of times a second; one pulse is followed here by the laser's ring-down to its steady output.</p>`,
			notes: `<p>Wagner and Lengyel (1963): a pulse that starts from an inversion <i>N</i>ᵢ ends at <i>N</i><sub>f</sub> with <i>N</i>ᵢ − <i>N</i><sub>f</sub> = <i>N</i><sub>th</sub> ln(<i>N</i>ᵢ/<i>N</i><sub>f</sub>), and the photon number peaks at <i>N</i>ᵢ − <i>N</i><sub>th</sub> − <i>N</i><sub>th</sub> ln(<i>N</i>ᵢ/<i>N</i><sub>th</sub>). The page's integration matches both. The pulse is a few tens of photon lifetimes long, which is why short cavities give short Q-switched pulses; to go to picoseconds and femtoseconds, lasers lock many modes in phase instead.</p>`
		}
	]
};
