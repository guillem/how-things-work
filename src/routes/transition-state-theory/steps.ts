import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/**
 * Two scenes. `map` (hints: `reaction`: `h-h2`, `f-h2` or `h-hf`; `view`: `surface` for the
 * bare landscape with its path of least energy, `shot` for a trajectory, `pass` for a trajectory
 * with the time it spends at the pass; `ctl`: the prefix of the step's energy controls, `h`,
 * `f` or `l`). `rate` (hints: `isotope`: show H and D side by side): the energy profile with its
 * zero-point levels and the Eyring rate against temperature.
 */

const eV = (v: number) => `${v.toFixed(2)} eV`;
const level = (v: number) => `v = ${Math.round(v)}`;

function energyControls(prefix: string, trans: number, max: number): Control[] {
	return [
		{
			type: 'range',
			id: `${prefix}Trans`,
			label: 'Translation (collision energy)',
			min: 0,
			max,
			step: 0.01,
			default: trans,
			format: eV
		},
		{
			type: 'range',
			id: `${prefix}V`,
			label: 'Vibration of the molecule',
			min: 0,
			max: 3,
			step: 1,
			default: 0,
			format: level,
			help: 'v = 0 is the zero-point vibration: a molecule never has less.'
		},
		{ type: 'action', id: 'fire', label: 'Trajectory', action: 'Fire again' }
	];
}

const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Temperature',
	min: 200,
	max: 2000,
	step: 10,
	default: 300,
	format: (v) => `${Math.round(v)} K`
};

const reaction: Control = {
	type: 'select',
	id: 'reaction',
	label: 'Reaction',
	default: 'h-h2',
	options: [
		{ value: 'h-h2', label: 'H + H₂ (central pass)' },
		{ value: 'f-h2', label: 'F + H₂ (early pass)' }
	]
};

const heavy: Control = {
	type: 'toggle',
	id: 'heavy',
	label: 'Swap H for D (deuterium)',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'transition-state-theory',
	title: 'Reaction trajectories & the transition state',
	summary:
		'Fire three atoms at each other across a computed energy landscape and watch them cross a mountain pass or turn back; see why translation carries molecules over an early pass and vibration over a late one, then sweep the temperature through Eyring’s rate and swap hydrogen for deuterium.',
	chapters: [
		{ id: 'landscape', title: 'An energy landscape' },
		{ id: 'passes', title: 'Early and late passes' },
		{ id: 'rates', title: 'From trajectories to a rate' }
	],
	steps: [
		// ------------------------------------------------------------------ landscape
		{
			id: 'surface',
			chapter: 'landscape',
			title: 'Three atoms, two distances',
			scene: 'map',
			hints: { reaction: 'h-h2', view: 'surface' },
			duration: 18,
			body: `
<p>The energy profile of <a href="../reaction-rates-equilibrium/">Reaction rates</a> is a slice through something bigger. Take the simplest reaction there is, a hydrogen atom swapping partners: H<sub>a</sub> + H<sub>b</sub>H<sub>c</sub> → H<sub>a</sub>H<sub>b</sub> + H<sub>c</sub>, with the three atoms on a line. Their energy depends on two distances: r₁ from H<sub>a</sub> to H<sub>b</sub>, and r₂ from H<sub>b</sub> to H<sub>c</sub>. Plot it over both and you get a landscape, drawn here as a contour map: a <dfn data-def="The energy of a group of atoms as a function of where the nuclei are, with the electrons always settled into their lowest state for that arrangement.">potential-energy surface</dfn>.</p>
<p>Along the bottom runs a valley: H₂ at its usual bond length, 0.74 Å, with the third atom far away. Up the left side runs the same valley the other way round: the products. Where they meet the ground rises to a <strong>pass</strong>, a <dfn data-def="A point that is a maximum along one direction and a minimum along the other: the top of a mountain pass.">saddle point</dfn> 0.42 eV (41 kJ/mol) above the valley floor, with both bonds stretched to 0.93 Å. Follow the dashed path of least energy from one valley to the other and you get the familiar one-dimensional profile, drawn on the right.</p>`,
			notes: `<p>The surface is a <dfn data-def="London–Eyring–Polanyi–Sato: an approximate formula for the energy of three atoms, built from the bonding and anti-bonding energy curves of each pair (here Morse curves) and one adjustable overlap parameter.">LEPS</dfn> surface, the formula Eyring and Polanyi used in 1931 to draw the first one, with Sato's 1955 overlap parameter. Each pair of atoms is a Morse oscillator with the measured well depth, frequency and bond length of H₂; Sato's parameter (0.134 here) is the one free number, and it is set so that the pass has the height of the accurate quantum-chemical surface, 9.8 kcal/mol (Liu, Siegbahn, Truhlar and Horowitz, 1973–78). Its position, 0.93 Å, then comes out where the accurate calculation puts it. The atoms are kept on a line to make the surface two-dimensional. For H + H₂ the line holds the lowest pass; F + H₂ has a slightly lower, bent route that this model leaves out, and real collisions come in at every angle.</p>`
		},
		{
			id: 'fire',
			chapter: 'landscape',
			title: 'Fire a trajectory',
			scene: 'map',
			hints: { reaction: 'h-h2', view: 'shot', ctl: 'h' },
			duration: 20,
			controls: energyControls('h', 0.45, 1.2),
			body: `
<p>Now let the atoms move. H<sub>a</sub> flies at the molecule with some <strong>translational energy</strong>, and the molecule vibrates. Newton's laws, with forces from the slope of the surface, move all three atoms: the point (r₁, r₂) wanders over the map like a ball rolling on the landscape, and the strip above shows the atoms themselves.</p>
<p>A molecule can't sit still: quantum mechanics leaves it at least its <dfn data-def="The lowest vibrational energy a bond can have, ½hν for a harmonic bond: 0.27 eV for H₂. Even at absolute zero a molecule keeps it.">zero-point energy</dfn>, 0.27 eV for H₂, so its trajectory starts with the bond swinging with exactly that energy (or with a higher quantum level, v = 1, 2, 3). This is a <dfn data-def="A classical trajectory whose starting vibration is given the energy of a quantised level.">quasiclassical trajectory</dfn>. With 0.2 eV of translation, the ball rolls up towards the pass and back down: no reaction. Somewhere between 0.27 and 0.30 eV more and more shots cross (the zero-point-corrected height of the pass is 0.29 eV), and above that most of them leave along the products' valley, the new H₂ vibrating as it goes.</p>
<p>Whether one shot makes it also depends on where the bond is in its swing when the atom arrives. <strong>Fire again</strong> tries another moment; the faint fan shows 24 of them, and the count is the reaction probability.</p>`,
			notes: `<p>The trajectories integrate Newton's equations for three masses on a line (velocity Verlet, 0.02 fs steps; the total energy stays constant to better than a thousandth of an eV). The atom starts 4.2 Å from the molecule, where the surface is flat to within a thousandth of an eV. Quasiclassical trajectories respect the zero-point energy at the start but not along the way: a classical bond can hand its zero-point energy to the motion, which a real molecule cannot. That is one of the method's known weaknesses.</p>`
		},
		{
			id: 'pass',
			chapter: 'landscape',
			title: 'The transition state is a pass, not a stop',
			scene: 'map',
			hints: { reaction: 'h-h2', view: 'pass', ctl: 'h' },
			duration: 20,
			controls: energyControls('h', 0.45, 1.2),
			body: `
<p>The top of the pass is the <dfn data-def="The arrangement of atoms at the top of the pass between reactants and products: a maximum of energy along the reaction path, a minimum across it.">transition state</dfn>, written ‡. The circle marks the ground within 0.2 Å of it, and the clock counts how long a trajectory spends inside: <strong>a few femtoseconds</strong>, usually less than one vibration of H₂ (7.6 fs); a slow shot that only just makes it can linger for two or three. The atoms don't stop there.</p>
<p>So the transition state is not an <dfn data-def="A species formed during a reaction that sits in a dip of the energy landscape and lives long enough to be detected or even isolated.">intermediate</dfn>: there is no hollow at the top of the pass to hold it, nothing to bottle or isolate. Crossing usually takes about one vibration or less, and a system that crosses rarely comes back (it can: trajectories sometimes recross, which transition-state theory neglects). Femtosecond lasers can catch reactions as they cross (Ahmed Zewail's Nobel Prize, 1999), but only in passing.</p>`,
			notes: `<p>The clock is not a lifetime: it depends on how wide a region one calls "the top", and on how fast the trajectory moves. What matters is that the time is about one vibrational period: the pass is crossed, not visited. The barrier's curvature along the path gives its own time scale: here the motion across the top has an imaginary frequency of about 2000 cm⁻¹, as fast as a bond vibration.</p>`
		},
		// ------------------------------------------------------------------ passes
		{
			id: 'early',
			chapter: 'passes',
			title: 'An early pass: F + H₂',
			scene: 'map',
			hints: { reaction: 'f-h2', view: 'shot', ctl: 'f' },
			duration: 22,
			controls: energyControls('f', 0.1, 0.6),
			body: `
<p>Fluorine tears hydrogen apart: F + H₂ → HF + H gives out 1.39 eV (134 kJ/mol), because the H–F bond is much stronger than H–H. The map is lopsided: the products' valley up the left is far deeper than the reactants' valley along the bottom. And the pass, only 0.046 eV high, sits <strong>early</strong>: in the entrance valley, with H–H barely stretched (0.76 Å instead of 0.74) and F still 1.54 Å away.</p>
<p>To cross an early pass a molecule needs <strong>translation</strong>: the motion along the entrance valley is what climbs it. A tenth of an eV of translation, with the molecule at its zero-point vibration, crosses at most phases. Extra vibration barely helps: at that translation, v = 1, 2 or 3 cross <em>less</em> often than v = 0, and only right at the threshold, with a few hundredths of an eV of translation, does vibration let some through. (With no translation at all the molecule just vibrates where it is: the fluorine never arrives.)</p>
<p>Then watch the product: the trajectory falls into the deep HF valley and swings across it. The energy released goes mostly into <strong>vibration</strong> of the new HF bond, which is why this reaction drives the hydrogen fluoride chemical laser.</p>`,
			notes: `<p>The surface is Muckerman's surface V (1971–81), a LEPS surface with two Sato parameters fitted to the measured rate of F + H₂: its pass is 1.06 kcal/mol high on the line. The H–F Morse curve has the measured bond (well depth 6.12 eV, 4138 cm⁻¹, 0.917 Å). The reaction energy, 1.39 eV between the lowest levels of H₂ and HF, is the difference of their measured bond energies. Accurate calculations put the real barrier a little higher and bent, not on the line.</p>`
		},
		{
			id: 'late',
			chapter: 'passes',
			title: 'A late pass: H + HF',
			scene: 'map',
			hints: { reaction: 'h-hf', view: 'shot', ctl: 'l' },
			duration: 22,
			controls: energyControls('l', 1.6, 2.4),
			body: `
<p>Run the same reaction backwards: H + HF → H₂ + F, on the same map, coming in down the deep HF valley on the left. Now the reaction climbs 1.39 eV, and the pass is 1.42 eV above the HF valley floor. Seen from this side it is <strong>late</strong>: the H–F bond is already stretched by 0.6 Å when the system reaches it, and the new H–H bond is almost made.</p>
<p>Give it 1.6 eV of translation, more than the pass: the trajectory runs down the valley, hits the wall at its end and bounces back. Translation points the wrong way, straight up the valley, while the pass is round the corner. Now put the energy into <strong>vibration</strong>: v = 3 (1.66 eV) and a fifth of an eV of translation. The stretching H–F bond swings the trajectory round the corner and over the pass.</p>
<p>These are <dfn data-def="Rules found by John Polanyi from trajectories on such surfaces: translation is more effective over an early barrier, vibration over a late one; and an early barrier puts the energy released into the products' vibration.">Polanyi's rules</dfn>: translational energy carries molecules over an early pass, vibrational energy over a late one. The pass's <strong>position</strong> decides which kind of energy works.</p>`,
			notes: `<p>John Polanyi shared the 1986 Nobel Prize in Chemistry for this work, with Dudley Herschbach and Yuan Lee, whose crossed molecular beams measured it. The rules are about efficiency, not absolutes: in three dimensions and with real quantum effects a little translation helps at a late barrier, and the fan of 24 phases shows that even the right kind of energy does not always succeed.</p>`
		},
		// ------------------------------------------------------------------ rates
		{
			id: 'eyring',
			chapter: 'rates',
			title: 'From one trajectory to a rate',
			scene: 'rate',
			hints: { isotope: false },
			duration: 22,
			controls: [reaction, temp],
			body: `
<p>A gas holds molecules with every energy, spread out by the <dfn data-def="At temperature T, the fraction of states with energy E falls off as e^(−E/k_BT): each k_BT of energy makes a state e ≈ 2.7 times rarer.">Boltzmann distribution</dfn>, so a rate counts how many reach the pass. <dfn data-def="The theory of Henry Eyring, Meredith Evans and Michael Polanyi (1935): the rate is the number of systems at the transition state, assumed to be in equilibrium with the reactants, times how fast they cross it.">Transition-state theory</dfn> says: assume the systems at the pass are in equilibrium with the reactants, and count how fast they cross it. Eyring's equation, k = (k<sub>B</sub>T/h)·e<sup>−ΔG‡/RT</sup>, gives the rate constant k from Boltzmann's constant k<sub>B</sub>, Planck's constant h, the gas constant R and ΔG‡, the molar Gibbs energy of activation. <strong>k<sub>B</sub>T/h</strong> is a universal frequency, 6.2 × 10¹² per second at room temperature: how fast a system at the top moves on. The exponential is the share that gets there.</p>
<p>The energy to climb is not the bare pass but the <strong>effective barrier</strong> E₀: the pass plus the zero-point energy still held at the top, minus the molecule's own. For H + H₂ that is 0.29 eV. The chart uses it per reacting system, as the <strong>energy-only factor</strong> (k<sub>B</sub>T/h)·e<sup>−E₀/k<sub>B</sub>T</sup>: not the reaction's real rate constant, which for two molecules meeting in a gas also needs their partition functions (below), but the part that makes it climb. Sweep the temperature: the factor climbs steeply, hundreds of times from 300 to 600 K, and on the right ln k against 1/T is almost a straight line: the <a href="../reaction-rates-equilibrium/">Arrhenius law</a>, with an activation energy E₀ + k<sub>B</sub>T. A <strong>catalyst</strong> works by offering a lower pass, a different path over the landscape; it does not push molecules over this one.</p>`,
			notes: `<p>The page draws (k<sub>B</sub>T/h)·e<sup>−E₀/k<sub>B</sub>T</sup>: the energy part of Eyring's equation. The full rate of a reaction between two gas molecules multiplies it by a ratio of <dfn data-def="Sums over a molecule's states, counting how many ways it can move, turn and vibrate at a temperature.">partition functions</dfn> (how many ways the system can move, turn and bend at the pass, against the reactants) and corrects it for tunnelling through the top and for trajectories that cross and come back. These omitted factors change the size of the rate, and also its temperature dependence and its isotope dependence, most of all where tunnelling matters, as it does for hydrogen. For F + H₂ the slope gives an activation energy of about 1.0 kcal/mol, close to the measured 0.9 (Stevens, Brune and Anderson, 1989, 240–373 K).</p>`
		},
		{
			id: 'isotope',
			chapter: 'rates',
			title: 'Swap hydrogen for deuterium',
			scene: 'rate',
			hints: { isotope: true },
			duration: 22,
			controls: [reaction, temp, heavy],
			body: `
<p>Deuterium has twice hydrogen's mass and the same electrons, so the landscape is <strong>exactly the same</strong>. What changes is how the atoms move on it: a heavier bond vibrates more slowly, √2 times for D₂, and its zero-point energy is lower, 0.19 eV instead of 0.27 eV.</p>
<p>At the pass of H + H₂ the old bond is half broken, and the vibration left at the top keeps only about half of the zero-point energy. The lighter molecule starts higher and so has less to climb: its effective barrier is 0.29 eV, against 0.33 eV for D + D₂. At room temperature that small difference makes H's energy-only factor about 4.6 times larger: a <dfn data-def="The change of a reaction's rate when an atom is replaced by a heavier isotope; for H against D it is often several times.">kinetic isotope effect</dfn>. It fades as the temperature climbs.</p>
<p>At the early pass of F + H₂ the H–H bond is hardly touched, so its zero-point energy mostly survives to the top and the effect is smaller: the model gives 1.4 at room temperature. Measured, F + H₂ is 1.9 times faster than F + D₂ (Persky, 1973); the difference can come from what this page leaves out (the masses in the partition functions, the bending vibrations and tunnelling) and from the approximate surface itself.</p>`,
			notes: `<p>The zero-point energy at the pass is ½ħω of its one bound vibration on the line, the symmetric stretch (wavenumbers 2120 cm⁻¹ for H₃ and 3850 cm⁻¹ for F–H–H), found from the curvature of the surface at the pass. A real three-dimensional transition state also bends, and its bending vibrations add zero-point energy of their own. Isotope effects are a chemist's tool: a large H/D effect says that a bond to hydrogen is being broken at the transition state.</p>`
		}
	]
};
