import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { sup } from './model';

/**
 * The doping scene keeps the reader's crystal per step in the param `dope:<step id>`
 * (a string of site codes); `hints.start` is the dopant placed at the start and
 * `hints.pick` the dopant the palette starts on.
 */

const field: Control = {
	type: 'toggle',
	id: 'field',
	label: 'Apply a voltage',
	default: true,
	help: 'A battery across the crystal: + on the right, − on the left.'
};

export const spec: ExplainerSpec = {
	slug: 'semiconductors',
	title: 'Crystals, semiconductors and the p–n junction',
	summary:
		'See why metals conduct and diamond does not, add a few phosphorus or boron atoms to silicon to make it conduct a million times better, then join two kinds of silicon into a diode that lets current through one way only.',
	chapters: [
		{ id: 'bands', title: 'Bands and gaps' },
		{ id: 'doping', title: 'Doping' },
		{ id: 'junction', title: 'The p–n junction' }
	],
	steps: [
		// ------------------------------------------------------------------ bands
		{
			id: 'levels',
			chapter: 'bands',
			title: 'From energy levels to energy bands',
			scene: 'crystal',
			hints: { phase: 'levels' },
			duration: 22,
			controls: [
				{
					type: 'range',
					id: 'atoms',
					label: 'Atoms in the crystal',
					min: 0,
					max: 6,
					step: 1,
					default: 3,
					format: (v) => String(2 ** v),
					help: 'Each atom adds one more level to every band.'
				}
			],
			body: `
<p>An electron in a single atom can only have certain energies, its <dfn data-def="The allowed energies of an electron bound to an atom. An electron can jump between levels but never sit between them.">energy levels</dfn>. Bring two atoms close enough to bond and each level splits in two: one lower than before (the bonding pair of <a href="../chemical-bonds/">a covalent bond</a>) and one higher.</p>
<p>A <dfn data-def="A solid whose atoms are stacked in a regular pattern that repeats in every direction, like salt, diamond, silicon or a metal.">crystal</dfn> has not two atoms but something like 10<sup>22</sup> in every cubic centimetre, all touching their neighbours. Each atomic level splits into as many levels as there are atoms, packed so tightly together that they form a continuous <dfn data-def="A range of energies, made of a huge number of closely spaced levels, that electrons in a crystal can have.">energy band</dfn>. Between the bands are <dfn data-def="A range of energies that no electron in the crystal can have.">gaps</dfn>: energies no electron in the crystal can have.</p>
<p>Add atoms with the slider: the number of levels grows, but the band stays the same width. Each level holds two electrons, so a band has room for exactly two electrons per atom.</p>`,
			notes: `<p>The levels drawn are those of a chain of identical atoms in the simplest quantum model (“tight binding”): with N atoms one level becomes N levels at E₀ − 2β cos(kπ/(N + 1)), k = 1…N, all inside a band of width 4β, where β measures how strongly neighbouring atoms overlap. Real crystals are three-dimensional and their bands overlap and mix, but the counting is the same: N atoms, N states per band, two electrons per state (one of each spin, by the <dfn data-def="No two electrons in the same system can be in exactly the same state; each level holds at most two, with opposite spins.">Pauli exclusion principle</dfn>).</p>`
		},
		{
			id: 'metal',
			chapter: 'bands',
			title: 'Metals: a band with room to move',
			scene: 'crystal',
			hints: { phase: 'material', material: 'metal' },
			duration: 20,
			controls: [field],
			body: `
<p>Whether a solid conducts depends on how full its highest bands are. Electrons can only speed up in a voltage, and so carry a current, if there are empty levels just above them to move into.</p>
<p>In a <strong>metal</strong> such as copper, the highest occupied band is only partly full. The electrons near the top of the filled part have empty levels right above them, so the smallest push from a voltage sets them drifting. Each copper atom contributes about one such free electron: the crystal is a lattice of positive ions in a “sea” of electrons, which is what moves in the <a href="../electric-circuits/">wires of a circuit</a>.</p>
<p>The dashed line is the <dfn data-def="The energy up to which the levels are filled with electrons (at absolute zero; at room temperature the edge is slightly blurred). Written E_F.">Fermi level</dfn>, where filled levels end and empty ones begin. Copper's resistivity is just 1.7 × 10<sup>−6</sup> Ω·cm.</p>`
		},
		{
			id: 'insulator',
			chapter: 'bands',
			title: 'Insulators: a full band and a wide gap',
			scene: 'crystal',
			hints: { phase: 'material', material: 'insulator' },
			duration: 20,
			controls: [field],
			body: `
<p>In <strong>diamond</strong>, each carbon atom shares its four outer electrons with four neighbours. Every electron is locked into a bond, and in the band picture the bonding levels form a band that is <em>completely full</em>: the <dfn data-def="The highest energy band that is full of electrons (in an insulator or semiconductor). Its electrons are the ones in the bonds.">valence band</dfn>. A full band carries no current: for every electron that could move one way there is another moving the other way, and there is no empty level to change into.</p>
<p>The next band up, the <dfn data-def="The band above the gap. It is empty in a perfect insulator; an electron that gets into it is free to move through the crystal.">conduction band</dfn>, is empty, and above a gap of <strong>5.5 eV</strong>. The heat of room temperature gives electrons only about <strong>0.026 eV</strong> each (kT), and the chance of collecting 200 times that is practically zero. Apply a voltage and nothing flows: diamond is an <dfn data-def="A material with a full valence band and a wide gap, so that practically no electrons can conduct.">insulator</dfn>.</p>`,
			notes: `<p>An <dfn data-def="The energy an electron gains when it moves through one volt: 1.6 × 10⁻¹⁹ joules.">electron-volt</dfn> (eV) is the energy an electron gains crossing one volt. The gaps are at room temperature, from Sze &amp; Ng, <i>Physics of Semiconductor Devices</i> (diamond 5.47 eV, silicon 1.12 eV, germanium 0.66 eV). Glass, plastics and ceramics insulate for the same reason: full bands and a wide gap.</p>`
		},
		{
			id: 'semiconductor',
			chapter: 'bands',
			title: 'Semiconductors: a gap that heat can cross',
			scene: 'crystal',
			hints: { phase: 'material', material: 'semiconductor' },
			duration: 24,
			controls: [field],
			body: `
<p><strong>Silicon</strong> sits right below carbon in the periodic table and builds the same crystal: four bonds per atom, a full valence band, an empty conduction band. The difference is the gap: only <strong>1.12 eV</strong>.</p>
<p>That is small enough that, now and then, the jiggling of the crystal shakes an electron out of a bond and up into the conduction band. It leaves behind a bond with one electron missing, a <dfn data-def="A place in the crystal's bonds where an electron is missing. It behaves like a positive charge that can move, because a neighbouring electron can hop into it, which moves the gap.">hole</dfn>. Both can carry current: the free electron drifts towards +, and the hole moves towards − as neighbouring electrons hop into it one after another.</p>
<p>At room temperature pure silicon has about <strong>10<sup>10</sup></strong> free electrons per cm³. That sounds like a lot, but it is one for every five trillion atoms (copper has one per atom), so pure silicon conducts about 10<sup>11</sup> times worse than copper. A <dfn data-def="A material whose gap is small enough that a few electrons cross it at room temperature, and whose conductivity can be changed enormously by impurities, light, heat or voltage.">semiconductor</dfn> is an insulator with a small gap.</p>`,
			notes: `<p>Intrinsic carrier density of silicon at 300 K: 9.65 × 10⁹ cm⁻³ (Sze &amp; Ng 2007; Altermatt et al. 2003). Germanium, with its 0.66 eV gap, has 2.0 × 10¹³ cm⁻³, about two thousand times more; the first transistors (1947) were germanium. The number of carriers grows steeply with temperature, so unlike a metal, a semiconductor conducts <em>better</em> when hot. The drawing shows one thermal pair at a time to make the idea visible: in a real patch of a few dozen atoms you would wait a very long time to see one.</p>`
		},
		// ------------------------------------------------------------------ doping
		{
			id: 'donor',
			chapter: 'doping',
			title: 'Phosphorus: one electron too many',
			scene: 'dope',
			hints: { start: 'P', pick: 'P' },
			duration: 26,
			controls: [field],
			body: `
<p>Waiting for heat to free electrons gives very few. Instead, replace a few silicon atoms with something else: <dfn data-def="Adding a tiny, controlled amount of another element to a semiconductor's crystal to change how it conducts.">doping</dfn>.</p>
<p><strong>Phosphorus</strong> (and arsenic) is in group 15: five outer electrons, one more than silicon. Four of them make the four bonds; the fifth has no bond to join. It is held only weakly, by just 0.045 eV, and at room temperature it breaks free and wanders the crystal as a conduction electron, leaving a fixed P<sup>+</sup> ion behind. Phosphorus is a <dfn data-def="An impurity atom that gives an extra electron to the crystal (phosphorus, arsenic in silicon).">donor</dfn>; in the band picture its level sits just below the conduction band.</p>
<p><strong>Click a silicon atom</strong> to swap it for the dopant chosen at the top (click a dopant to put silicon back). Every phosphorus adds one free electron. Silicon doped this way is <dfn data-def="A semiconductor doped with donors, so that most of its moving charges are negative electrons.">n-type</dfn>, for negative carriers.</p>`,
			notes: `<p>The crystal stays electrically neutral: each free electron is balanced by the positive ion it left. Ionisation energies in silicon: phosphorus 45 meV, arsenic 54 meV, boron 45 meV (Sze &amp; Ng 2007). They are small because the extra electron orbits the ion far out, through a crystal that weakens the attraction about twelve times. The close-up is not to scale: real doping is one atom in thousands to billions, not one in a few dozen.</p>`
		},
		{
			id: 'acceptor',
			chapter: 'doping',
			title: 'Boron: one electron short, a hole',
			scene: 'dope',
			hints: { start: 'B', pick: 'B' },
			duration: 26,
			controls: [field],
			body: `
<p><strong>Boron</strong> is in group 13: three outer electrons, one fewer than silicon. One of its four bonds is left with a single electron, a hole. A neighbouring bond's electron easily hops in (that costs only 0.045 eV), making boron a fixed B<sup>−</sup> ion and moving the hole one bond further on. Boron is an <dfn data-def="An impurity atom that takes an electron from the crystal's bonds, creating a hole (boron in silicon).">acceptor</dfn>; its level sits just above the valence band.</p>
<p>Hop after hop, the hole wanders through the crystal like a bubble in water. Apply a voltage and the electrons hop towards +, so the hole moves towards −, just like a positive charge. Silicon doped with acceptors is <dfn data-def="A semiconductor doped with acceptors, so that most of its moving charges are positive holes.">p-type</dfn>, for positive carriers.</p>
<p>Try putting phosphorus and boron in the same crystal: the phosphorus's spare electron drops straight into the boron's hole, and both are gone. Only the difference between donors and acceptors counts.</p>`,
			notes: `<p>That cancelling is called <em>compensation</em>, and chipmakers use it: they can turn a region that is already p-type into n-type by adding more donors than it has acceptors. Holes move more slowly than free electrons (in pure silicon about a third as fast), because each step needs a bound electron to hop.</p>`
		},
		{
			id: 'amount',
			chapter: 'doping',
			title: 'A pinch of impurity changes everything',
			scene: 'chart',
			duration: 26,
			controls: [
				{
					type: 'range',
					id: 'conc',
					label: 'Dopant atoms per cm³',
					min: 12,
					max: 19,
					step: 0.1,
					default: 16.7,
					format: (v) => {
						const e = Math.floor(v + 1e-9);
						const m = 10 ** (v - e);
						return `${m.toFixed(1)} × 10${sup(e)}`;
					},
					help: 'Silicon itself has 5 × 10²² atoms per cm³.'
				},
				{
					type: 'select',
					id: 'kind',
					label: 'Dopant',
					default: 'n',
					options: [
						{ value: 'n', label: 'Phosphorus (n-type)' },
						{ value: 'p', label: 'Boron (p-type)' }
					]
				}
			],
			body: `
<p>How much doping does it take? Silicon has 5 × 10<sup>22</sup> atoms per cm³. Replace just <strong>one in a million</strong> of them with phosphorus and it has 5 × 10<sup>16</sup> free electrons per cm³: some five million times more than pure silicon, which makes it about <strong>two million times</strong> more conductive (the electrons move a little more slowly through the impurities).</p>
<p>The chart shows <dfn data-def="How strongly a material opposes current, independent of its shape: the resistance of a 1 cm cube, in ohm-centimetres (Ω·cm).">resistivity</dfn> on a scale where each line is ten times the one below. Slide the doping: by choosing how much phosphorus or boron goes in, engineers can set silicon's resistivity anywhere across more than six orders of magnitude, from thousands of Ω·cm down to a few thousandths, within a few thousand times of copper.</p>
<p>Notice the minority carriers. In n-type silicon the holes become <em>fewer</em>, not more: free electrons fill them. Electrons times holes stays fixed, n × p = n<sub>i</sub><sup>2</sup> ≈ 10<sup>20</sup> per cm<sup>6</sup>.</p>`,
			notes: `<p>The curves use the measured mobility of electrons and holes in phosphorus- and boron-doped silicon (Masetti, Severi &amp; Solmi, 1983) and assume every dopant atom is ionised, which holds at room temperature up to about 10¹⁸ cm⁻³; they agree with the classic measured resistivity curves (Irvin, 1962) to within a few percent. Boron-doped silicon is about three times more resistive than phosphorus-doped silicon with the same doping because holes move more slowly. Real silicon for chips starts out extremely pure, with fewer than one stray atom in a billion, so that doping alone decides how it conducts.</p>`
		},
		// ------------------------------------------------------------------ junction
		{
			id: 'pn',
			chapter: 'junction',
			title: 'Joining n-type and p-type',
			scene: 'junction',
			hints: { phase: 'join' },
			duration: 24,
			controls: [
				{
					type: 'toggle',
					id: 'joined',
					label: 'Join the two pieces',
					default: false,
					help: 'In a real device both are regions of one crystal, doped differently.'
				}
			],
			body: `
<p>Now put p-type and n-type silicon side by side in one crystal, here doped with 10<sup>17</sup> atoms per cm³ each. <strong>Join them</strong> with the switch below the picture.</p>
<p>The n side is crowded with free electrons and the p side with holes, so near the boundary they spread across, as any crowd spreads into empty space. Electrons that cross fall into holes, and both disappear. What they leave behind is a thin layer with no free carriers at all, the <dfn data-def="The thin layer either side of a p–n junction that has lost its free electrons and holes, leaving only fixed ions.">depletion zone</dfn>, holding only the fixed ions: P<sup>+</sup> on the n side, B<sup>−</sup> on the p side.</p>
<p>Those ions make an electric field across the junction, pointing from the n side to the p side, that pushes the electrons back into n and the holes back into p. The spreading stops when the field balances it. In the band picture, the bands bend: electrons on the n side face a hill of about <strong>0.84 eV</strong> to climb into the p side.</p>`,
			notes: `<p>The barrier's height is the <dfn data-def="The voltage across a p–n junction's depletion zone in equilibrium, set by the doping: V_bi = (kT/q) ln(N_A N_D / n_i²).">built-in voltage</dfn>, V<sub>bi</sub> = (kT/q) ln(N<sub>A</sub>N<sub>D</sub>/n<sub>i</sub><sup>2</sup>) ≈ 0.84 V for this doping. A voltmeter can't read it from outside: the contacts where the metal wires meet the silicon have voltages of their own that cancel it exactly. The depletion zone here is about 0.15 µm (thousandths of a millimetre) wide, computed in the standard “depletion approximation”. The dashed line is the Fermi level: in equilibrium it is flat across the whole junction.</p>`
		},
		{
			id: 'forward',
			chapter: 'junction',
			title: 'Forward: lower the hill, current flows',
			scene: 'junction',
			hints: { phase: 'bias' },
			duration: 24,
			controls: [
				{
					type: 'range',
					id: 'vf',
					label: 'Forward voltage (+ on the p side)',
					min: 0,
					max: 0.8,
					step: 0.01,
					default: 0.7,
					unit: ' V'
				}
			],
			body: `
<p>Connect a battery with its <strong>+ to the p side</strong> and − to the n side. The battery pushes electrons into the n side and pulls them out of the p side, which refills the depletion zone from both ends: it narrows, and the hill in the bands drops by the battery's voltage.</p>
<p>Now electrons stream from n into p, and holes from p into n, where they meet and recombine. The battery keeps supplying both, so a steady current flows around the circuit. A lower hill lets exponentially more carriers over it: every extra <strong>60 mV</strong> multiplies the current by ten. Below about 0.5 V the current is tiny; by 0.7 V it is around half a milliampere, and it keeps soaring.</p>
<p>Slide the voltage down to zero and watch the current fade away.</p>`,
			notes: `<p>The dashed lines are the two <em>quasi-Fermi levels</em>: under a voltage V, the electrons on the n side sit higher in energy than the holes' level on the p side by exactly qV. The currents use the ideal diode (Shockley) equation with a saturation current of 10⁻¹⁵ A, typical of a small silicon diode (Sedra &amp; Smith); a real diode also has some resistance in series, which flattens the curve at large currents.</p>`
		},
		{
			id: 'reverse',
			chapter: 'junction',
			title: 'Reverse: raise the hill, current stops',
			scene: 'junction',
			hints: { phase: 'bias' },
			duration: 22,
			controls: [
				{
					type: 'range',
					id: 'vr',
					label: 'Reverse voltage (+ on the n side)',
					min: -2,
					max: 0,
					step: 0.05,
					default: -2,
					unit: ' V'
				}
			],
			body: `
<p>Turn the battery round: <strong>+ on the n side</strong>. Now it pulls the free electrons away from the junction towards the n contact, and the holes towards the p contact. The depletion zone <em>widens</em>, and the hill grows by the battery's voltage.</p>
<p>No majority carriers can climb it. The only current left comes from the very rare minority carriers (holes that wander into the n side, electrons in the p side), which the field sweeps across. It is about 10<sup>−15</sup> A, and it does not grow with more voltage: it <dfn data-def="Reaches a fixed limit and stays there.">saturates</dfn>.</p>
<p>The same piece of silicon conducts one way and blocks the other: a <dfn data-def="A component that lets current through in one direction only. A p–n diode conducts when its p side is positive.">diode</dfn>. Diodes turn the alternating current of the mains into direct current in every phone charger.</p>`,
			notes: `<p>Push the reverse voltage far enough (from a few volts to hundreds, depending on the doping) and the field becomes strong enough to tear electrons out of bonds or accelerate them into an avalanche: the junction breaks down. Zener diodes are built to do this at a precise voltage. Real diodes also leak a little more in reverse than the ideal equation says, from pairs generated by heat inside the depletion zone.</p>`
		},
		{
			id: 'curve',
			chapter: 'junction',
			title: 'A material you can switch',
			scene: 'junction',
			hints: { phase: 'curve' },
			duration: 30,
			controls: [
				{
					type: 'range',
					id: 'v',
					label: 'Voltage across the diode',
					min: -2,
					max: 0.8,
					step: 0.01,
					default: 0.7,
					unit: ' V'
				},
				{
					type: 'toggle',
					id: 'logScale',
					label: 'Logarithmic current scale',
					default: false,
					help: 'Each gridline is ten times the one below.'
				}
			],
			body: `
<p>Here is the whole story in one curve: the current through the junction against the voltage across it. <strong>Drag the dot</strong> along the voltage axis (or use the slider).</p>
<p>In reverse, the current is stuck at about 10<sup>−15</sup> A. Forward, it stays negligible until around half a volt and then shoots up: between reverse and 0.7 V forward the current changes by a factor of more than a hundred billion. Switch to the logarithmic scale and the forward side becomes a straight line, rising ten times every 60 mV:</p>
<p class="formula">I = I<sub>s</sub> (e<sup>V / (kT/q)</sup> − 1), &nbsp; kT/q ≈ 0.026 V</p>
<p>Put together, a semiconductor's conductivity is <strong>set by its impurities</strong> and <strong>changed by a voltage</strong>. That makes it a material that can be switched. Add a third doped region whose voltage controls the junctions and you have a <dfn data-def="A semiconductor switch: a voltage on one terminal controls the current between the other two.">transistor</dfn>, billions of which make every computer chip.</p>`,
			notes: `<p>The equation is Shockley's ideal diode law (1949). The exponential comes from the Boltzmann factor: the fraction of carriers with enough energy to climb a hill of height q(V<sub>bi</sub> − V) grows by a factor e for every kT/q ≈ 25.9 mV that the hill drops, which is ten times per 59.5 mV at room temperature. The saturation current I<sub>s</sub> = 10⁻¹⁵ A is a typical value for a small diode, not computed from the doping drawn. Real silicon diodes follow the line over many decades, with an “ideality factor” between 1 and 2 in the exponent.</p>`
		}
	]
};
