import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { COUPLES } from './potentials';
import { ANODES, CATHODES } from './electrodes';

const closed: Control = {
	type: 'toggle',
	id: 'closed',
	label: 'Wire connected',
	default: true,
	help: 'Disconnect the wire and see what happens to both halves.'
};
/** The same switch on the lithium-ion steps (its own id, so each step starts connected). */
const closedCell: Control = { ...closed, id: 'closedCell' };
const closedEnd: Control = { ...closed, id: 'closedEnd' };

// Symbols only: eleven full names don't fit in one row of buttons.
const metalOptions = COUPLES.map((c) => ({ value: c.id, label: c.symbol }));
const metalHelp = COUPLES.map((c) => `${c.symbol} ${c.name}`).join(', ') + '.';
const metalA: Control = {
	type: 'select',
	id: 'metalA',
	label: 'Left electrode',
	default: 'zn',
	options: metalOptions,
	help: metalHelp
};
const metalB: Control = {
	type: 'select',
	id: 'metalB',
	label: 'Right electrode',
	default: 'cu',
	options: metalOptions
};

const concOptions = [
	{ value: '1', label: '1 mol/L' },
	{ value: '0.1', label: '0.1' },
	{ value: '0.01', label: '0.01' },
	{ value: '0.001', label: '0.001' }
];
const znConc: Control = {
	type: 'select',
	id: 'zn',
	label: 'Zinc ions, Zn²⁺',
	default: '1',
	options: concOptions
};
const cuConc: Control = {
	type: 'select',
	id: 'cu',
	label: 'Copper ions, Cu²⁺',
	default: '1',
	options: concOptions
};

/** Share of the copper ions used up, with extra stops near the end where the voltage dies. */
const usedStops = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 99.9, 99.99, 100];
const used: Control = {
	type: 'range',
	id: 'used',
	label: 'Copper ions used up',
	min: 0,
	max: 100,
	step: 0.01,
	default: 0,
	values: () => usedStops,
	format: (v) => `${Number(v.toPrecision(4))} %`,
	help: 'Each stop runs the cell further; the last few are 99, 99.9, 99.99 and 100 %.'
};

const mode: Control = {
	type: 'select',
	id: 'mode',
	label: 'Connected to',
	default: 'charge',
	options: [
		{ value: 'discharge', label: 'A lamp' },
		{ value: 'open', label: 'Nothing' },
		{ value: 'charge', label: 'A charger' }
	]
};

const soc: Control = {
	type: 'range',
	id: 'soc',
	label: 'State of charge',
	min: 0,
	max: 100,
	step: 1,
	default: 100,
	unit: '%',
	help: '100 % is full (4.2 V), 0 % is empty (2.5 V).'
};

const cathode: Control = {
	type: 'select',
	id: 'cathode',
	label: 'Positive electrode (cathode)',
	default: 'nmc',
	options: CATHODES.map((m) => ({ value: m.id, label: `${m.name} (${m.formula})` }))
};
const anode: Control = {
	type: 'select',
	id: 'anode',
	label: 'Negative electrode (anode)',
	default: 'graphite',
	options: ANODES.map((m) => ({ value: m.id, label: m.name }))
};

/**
 * Scenes: `beaker` (zinc in copper sulfate), `daniell` (the two-beaker cell; hints.focus
 * 'split' | 'nernst' | 'rundown'), `ladder` (the table of reduction potentials), `cell`
 * (the LG M50 lithium-ion cell in cross-section; hints.focus 'inside' | 'discharge' |
 * 'charge' | 'curve' | 'summary') and `materials` (electrode curves vs Li/Li⁺; hints.focus
 * 'voltage' | 'capacity').
 */
export const spec: ExplainerSpec = {
	slug: 'redox-batteries',
	title: 'Redox and batteries',
	summary:
		'Watch zinc hand electrons to copper, then split that reaction into two halves so the electrons must take a wire. Read cell voltages off the table of potentials, run a lithium-ion cell down and charge it up again, and swap its electrodes to change its voltage and capacity.',
	chapters: [
		{ id: 'redox', title: 'Electrons changing hands' },
		{ id: 'potential', title: 'Voltage and how long it lasts' },
		{ id: 'liion', title: 'Inside a lithium-ion cell' },
		{ id: 'materials', title: 'Choosing the electrodes' }
	],
	steps: [
		// ------------------------------------------------------------------ redox
		{
			id: 'redox',
			chapter: 'redox',
			title: 'Zinc hands its electrons to copper',
			scene: 'beaker',
			duration: 22,
			body: `
<p>Dip a strip of zinc into a blue solution of copper sulfate. Within minutes the zinc is coated with reddish copper, the blue fades and the solution warms up. Zinc atoms are going into the solution as ions, and copper ions are coming out of it as metal:</p>
<p class="formula"><strong>Zn + Cu²⁺ → Zn²⁺ + Cu</strong></p>
<p>What actually moves is <strong>electrons</strong>. Each zinc atom gives two to a copper ion that bumps into the strip. Losing electrons is called <dfn data-def="Losing electrons. The substance that loses them is oxidised.">oxidation</dfn>; gaining them is <dfn data-def="Gaining electrons. The substance that gains them is reduced.">reduction</dfn>. They always happen together, since every electron given away is taken by something, so a reaction like this is a <dfn data-def="A reaction in which electrons pass from one substance to another: a reduction and an oxidation together.">redox</dfn> reaction.</p>
<p class="formula">Zn → Zn²⁺ + 2e⁻ &nbsp; (oxidation)<br>Cu²⁺ + 2e⁻ → Cu &nbsp; (reduction)</p>
<p>It is the same handing-over of electrons you saw in the <a href="../chemical-bonds/#ionic">ionic bond</a>, only here the electrons jump straight from zinc to copper at the metal's surface. The energy released just warms the beaker.</p>`,
			notes: `<p>A way to remember the names: <strong>OIL RIG</strong>, oxidation is loss, reduction is gain (of electrons). The sulfate ions, SO₄²⁻, take no part: they only keep the solution electrically neutral. Copper sulfate is blue because of its Cu²⁺ ions; zinc sulfate is colourless.</p>`
		},
		{
			id: 'split',
			chapter: 'redox',
			title: 'Split it in two, and the electrons must take the wire',
			scene: 'daniell',
			hints: { focus: 'split' },
			duration: 26,
			controls: [closed],
			body: `
<p>Now put the zinc in a beaker of zinc sulfate and a copper strip in a beaker of copper sulfate, a few centimetres apart. Zinc and copper ions never meet, so the reaction cannot happen by itself. Join the two metals with a wire through a lamp, and connect the solutions with a <dfn data-def="A tube of salt solution (or gel) joining two beakers. Its ions can move, so it lets charge through, but it keeps the two solutions from mixing.">salt bridge</dfn>, and it runs again, in two halves:</p>
<p>At the zinc, atoms become ions and leave two electrons behind in the metal. The electrons travel through the wire and the lamp to the copper, where copper ions pick them up. The salt bridge lets ions drift between the beakers, so that neither solution builds up a charge.</p>
<p>This is a <dfn data-def="Two half-reactions in separate places, joined by a wire for electrons and an electrolyte for ions, so the reaction drives a current.">cell</dfn>, the Daniell cell of 1836. The electrode where oxidation happens is the <dfn data-def="The electrode where oxidation happens. In a battery that is being used, it is the negative terminal.">anode</dfn>, here zinc, the − terminal; the one where reduction happens is the <dfn data-def="The electrode where reduction happens. In a battery that is being used, it is the positive terminal.">cathode</dfn>, here copper, the + terminal.</p>
<p><strong>Disconnect the wire.</strong> Everything stops, in both beakers at once. The two halves can only run together, and only if the electrons can get from one to the other through the circuit. That is the whole idea of a battery.</p>`,
			notes: `<p>Inside the wire, electrons flow from − to +; the <a href="../electric-circuits/#drift">conventional current</a> of circuit diagrams points the other way. In the salt bridge (potassium nitrate here) no electrons move at all: negative nitrate ions drift towards the zinc beaker, which is gaining Zn²⁺, and positive potassium ions towards the copper beaker, which is losing Cu²⁺. The current is the same all the way round the loop, carried by electrons in the metal and by ions in the solutions.</p>`
		},
		// ------------------------------------------------------------------ potential
		{
			id: 'ladder',
			chapter: 'potential',
			title: 'A ladder of metals: where the voltage comes from',
			scene: 'ladder',
			duration: 26,
			controls: [metalA, metalB],
			body: `
<p>Why does copper take the electrons and not zinc? Every half-reaction has a <dfn data-def="E°: how strongly a half-reaction pulls electrons in when written as a reduction, in volts, measured against the hydrogen electrode with every concentration at 1 mol/L and 25 °C.">standard reduction potential</dfn>, E°: how hard its ions pull electrons in, measured in volts against a reference, the hydrogen electrode (0 V). Lined up, they make a ladder. Copper ions sit high, at +0.34 V; zinc ions sit lower, at −0.76 V.</p>
<p>Electrons run <strong>uphill on this ladder</strong>: the metal lower down is oxidised, the ions higher up are reduced, and the cell's voltage is the height of the step between them:</p>
<p class="formula">E°cell = E°(cathode) − E°(anode)<br>= 0.34 − (−0.76) = <strong>1.10 V</strong></p>
<p>Choose two electrodes. The farther apart they are, the higher the voltage. Lithium sits at the very bottom, at −3.04 V: no metal gives its electrons away more readily.</p>`,
			notes: `<p>Values at 25 °C from the LibreTexts table <i>Standard Reduction Potentials by Element</i>, compiled from Bard, Parsons and Jordan, <i>Standard Potentials in Aqueous Solution</i> (1985), and Milazzo, Caroli and Sharma (1978). A volt is a joule per coulomb (see <a href="../electric-circuits/#voltage">voltage</a>), so the step is energy per charge: the Daniell reaction releases nFE° = 2 × 96 485 C/mol × 1.10 V = 213 kJ of free energy per mole of zinc, which the wire can deliver as electrical work. The shaded band is where water itself is stable (0 to 1.23 V at pH 0): beyond it water is split into hydrogen or oxygen, so lithium can't be used in water at all; it reacts with it.</p>`
		},
		{
			id: 'nernst',
			chapter: 'potential',
			title: 'Concentrations nudge the voltage',
			scene: 'daniell',
			hints: { focus: 'nernst' },
			duration: 24,
			controls: [znConc, cuConc],
			body: `
<p>The 1.10 V holds when both solutions are at 1 mol/L. Change them and the voltmeter moves. More copper ions push the reaction forward and raise the voltage; more zinc ions, the product, hold it back. The <dfn data-def="E = E° − (RT/nF)·ln Q: how a cell's voltage depends on the concentrations, through the reaction quotient Q.">Nernst equation</dfn> says by how much:</p>
<p class="formula">E = E° − (0.0592 V ÷ n) × log₁₀ Q<br>Q = [Zn²⁺] ÷ [Cu²⁺]</p>
<p>Q is the same <a href="../reaction-rates-equilibrium/#equilibrium">reaction quotient</a> that decides which way a reaction goes, and n = 2 is the number of electrons each zinc atom passes on. Every tenfold change in Q shifts the voltage by 0.0592 ÷ 2 = <strong>0.030 V</strong>. Try copper ions at 0.001 mol/L: a thousand times fewer, and the voltage only falls to 1.015 V. As with <a href="../acids-bases/#ph">pH</a>, concentrations count in powers of ten.</p>`,
			notes: `<p>The 0.0592 V is (RT/F)·ln 10 at 25 °C, from the gas constant R, the temperature T in kelvin and Faraday's constant F; it grows with temperature. Strictly the equation uses activities, effective concentrations; this page uses plain concentrations, as for an ideal dilute solution.</p>`
		},
		{
			id: 'rundown',
			chapter: 'potential',
			title: 'Running down: Faraday counts the electrons',
			scene: 'daniell',
			hints: { focus: 'rundown' },
			duration: 30,
			controls: [used],
			body: `
<p>Let the cell run. Each copper ion that turns into copper takes 2 electrons through the wire, and each zinc atom that dissolves gives 2. So the charge the cell delivers is fixed by how many ions there are: that is <dfn data-def="The charge that passes in an electrode reaction is proportional to the amount of substance changed: one mole of electrons carries 96 485 coulombs (Faraday's constant, F).">Faraday's law</dfn>. A mole of electrons carries <strong>96 485 coulombs</strong>, 26.8 amp-hours. With 100 mL of 1 mol/L copper sulfate, 0.1 mol of Cu²⁺, the cell can deliver 0.2 mol of electrons: <strong>5.36 Ah</strong>.</p>
<p>Run it down and watch the voltage. It barely moves for most of the way: Q only grows from 1 to 3 when half the copper is gone. Then, as the last copper ions run out, Q rockets and the voltage falls off a cliff.</p>
<p>A flat battery is a reaction that has reached <a href="../reaction-rates-equilibrium/#equilibrium">equilibrium</a>: E = 0, no push left. For this cell that happens when Q equals the equilibrium constant, K = 10³⁷: by then practically every copper ion is gone.</p>`,
			notes: `<p>K comes from E° directly: log₁₀ K = nE° ÷ 0.0592 V = 2 × 1.1037 ÷ 0.0592 = 37.3. A large E° means a large K, a reaction that runs practically to completion. The capacity in amp-hours depends only on the amount of reactant; the voltage depends on which reaction it is. Energy is the two multiplied: about 5.4 Ah × 1.1 V ≈ 6 Wh here.</p>`
		},
		// ------------------------------------------------------------------ liion
		{
			id: 'inside',
			chapter: 'liion',
			title: 'Inside a lithium-ion cell',
			scene: 'cell',
			hints: { focus: 'inside' },
			duration: 26,
			body: `
<p>A lithium-ion cell does the same trick with better materials. This is a slice through the LG M50, a cylindrical cell the size of a thumb (21 mm across, 70 mm long) of the kind used in electric cars, drawn to its real thicknesses. The whole stack is a fifth of a millimetre, rolled up tightly inside the can.</p>
<ul>
<li>The <strong>negative electrode</strong> is graphite, stacked sheets of carbon on a copper foil.</li>
<li>The <strong>positive electrode</strong> is a layered metal oxide, NMC 811 (LiNi₀.₈Mn₀.₁Co₀.₁O₂), on an aluminium foil.</li>
<li>Between them is the <dfn data-def="A thin porous plastic film between the electrodes. It lets ions through, but it doesn't conduct electrons, and it keeps the electrodes from touching.">separator</dfn>, and everything is soaked in the <dfn data-def="A liquid that conducts electricity by moving ions, not electrons. In a lithium-ion cell, a lithium salt dissolved in organic solvents.">electrolyte</dfn>, a lithium salt in an organic solvent.</li>
</ul>
<p>Why lithium? It is the lightest metal, 6.94 g per mole, and it sits at the bottom of the ladder: lots of volts and lots of charge per gram. Its ions are small enough to slip between the layers of both electrodes, like books into a bookcase, and out again, without the electrodes dissolving. That is called <dfn data-def="Slipping ions in between the layers of a solid host, and out again, without rebuilding the host.">intercalation</dfn>.</p>`,
			notes: `<p>Dimensions from Chen et al., <i>Journal of the Electrochemical Society</i> 167, 080534 (2020), who took an LG M50 apart: copper foil 12 µm, negative coating 85.2 µm, separator 12 µm, positive coating 75.6 µm, aluminium foil 16 µm. The real negative electrode is graphite with a little silicon oxide; this page treats it as graphite. The electrolyte cannot be water: a 4 V cell is far outside the 1.23 V window in which water is stable.</p>`
		},
		{
			id: 'discharge',
			chapter: 'liion',
			title: 'Discharging: ions through the cell, electrons round the circuit',
			scene: 'cell',
			hints: { focus: 'discharge', mode: 'discharge', closedParam: 'closedCell' },
			duration: 26,
			controls: [closedCell],
			body: `
<p>Connect a lamp. In the graphite, the carbon gives up an electron and a lithium ion leaves it. The <strong>ion</strong> crosses the electrolyte and the separator to the oxide; the <strong>electron</strong> can't go that way, since the separator doesn't conduct electrons, so it goes round through the copper foil, the wire, the lamp and the aluminium foil, and reaches the oxide from the other side. There the two meet again.</p>
<p class="formula">− side: LiC₆ → C₆ + Li⁺ + e⁻<br>+ side: Li⁺ + e⁻ + MO₂ → LiMO₂</p>
<p>The lithium is an ion throughout, in the graphite and in the oxide alike. What is oxidised and reduced is the <em>host</em>: the graphite gives up electrons, and nickel ions in the oxide take them (Ni⁴⁺ back towards Ni²⁺).</p>
<p>Count them: every second, as many electrons cross the lamp as lithium ions cross the separator. That is the <a href="../electric-circuits/#current">same current all the way round the loop</a>. Disconnect the wire, and the ions stop too.</p>`,
			notes: `<p>The number of lithium ions in the electrolyte stays the same: for every ion that leaves the graphite, one enters the oxide. A battery isn't a tank of electrons that empties: its total charge doesn't change. What runs down is the chemical energy of lithium sitting in graphite rather than in the oxide. M stands for the metals of the oxide: 80 % nickel, 10 % manganese, 10 % cobalt; nickel does most of the redox, and the cobalt and manganese keep the layers stable.</p>`
		},
		{
			id: 'charge',
			chapter: 'liion',
			title: 'Charging pushes them back uphill',
			scene: 'cell',
			hints: { focus: 'charge', modeParam: 'mode' },
			duration: 26,
			controls: [mode],
			body: `
<p>Swap the lamp for a charger. A charger is a supply with a higher voltage than the cell, up to 4.2 V, so it can push electrons the "wrong" way round: out of the oxide, through the charger and into the graphite. Lithium ions follow inside the cell, leaving the oxide and slipping back between the carbon sheets.</p>
<p>Both half-reactions now run backwards. It takes energy to do this, the energy the cell will give back when it is next discharged. Lithium ions simply rock back and forth between the two electrodes, which is why these cells were once called "rocking-chair" batteries.</p>
<p>Switch between a lamp, nothing, and the charger and watch the arrows. The names stick to the discharge: the graphite is still called the anode while charging, although it is then where reduction happens.</p>`,
			notes: `<p>A zinc–copper cell can be recharged too, but its metals plate back unevenly and the solutions mix through the bridge. Lithium-ion electrodes take lithium in and out without changing shape much, so they survive thousands of cycles. Each charge still loses a little lithium: on first charge some of the electrolyte breaks down on the graphite into a thin protective film, which keeps growing slowly as the cell ages.</p>`
		},
		{
			id: 'curve',
			chapter: 'liion',
			title: 'Voltage and charge: full to empty',
			scene: 'cell',
			hints: { focus: 'curve', mode: 'discharge' },
			duration: 28,
			controls: [soc],
			body: `
<p>Drag the state of charge from full to empty. The lithium moves from the graphite into the oxide, and the voltage falls: <strong>4.2 V</strong> when full, around <strong>3.7 V</strong> for most of the way, then down to <strong>2.5 V</strong>, where the cell is called empty. The voltage is the difference between the two electrodes' potentials, and both change as they fill and empty.</p>
<p>How much lithium moves? Faraday's law again. The cell is rated at 5 Ah: 5 × 3 600 = 18 000 coulombs, or 18 000 ÷ 96 485 = <strong>0.19 mol</strong> of electrons, so 0.19 mol of lithium ions: just <strong>1.3 g</strong> of lithium shuttling across, in a cell weighing 68 g.</p>
<p>Charge times average voltage gives the energy: about 5 Ah × 3.7 V ≈ <strong>18.5 Wh</strong>, around 270 Wh per kilogram of cell.</p>`,
			notes: `<p>These are open-circuit voltages, for a cell discharged very slowly. With a real current flowing, some voltage is lost inside the cell, so it reads lower while discharging and higher while charging. The curve is computed from the two electrodes' measured potentials, fitted by Chen et al. (2020) and used in the open-source battery modelling library PyBaMM. The cell's usable range runs from 2.8 % to 90 % lithium in the graphite, and from 91 % to 27 % in the oxide.</p>`
		},
		// ------------------------------------------------------------------ materials
		{
			id: 'voltage',
			chapter: 'materials',
			title: 'Swap the electrodes: the voltage is the gap',
			scene: 'materials',
			hints: { focus: 'voltage' },
			duration: 30,
			controls: [cathode, anode],
			body: `
<p>Battery makers choose from a ladder of their own, with potentials measured against lithium metal (0 V on this scale, which is about −3.04 V on the hydrogen one). The positive electrode should sit as high as possible and the negative as low as possible. The cell's voltage is the gap between their curves.</p>
<ul>
<li><strong>Lithium iron phosphate</strong> (LiFePO₄) sits at a flat 3.4 V: cells of about 3.2 V, lower than NMC's 3.7 V, but cheap, long-lived, and free of nickel and cobalt.</li>
<li><strong>Lithium cobalt oxide</strong> (LiCoO₂), the first commercial cathode (Sony, 1991), is still in phones.</li>
<li>On the negative side, <strong>lithium metal</strong> is the bottom of the scale, and <strong>silicon</strong> sits a little higher than graphite, which costs some voltage.</li>
</ul>
<p>Try every pairing and watch the gap, and the voltage it gives.</p>`,
			notes: `<p>Curves: graphite and NMC 811 from Chen et al. (2020); LiCoO₂ from Ramadass et al., <i>J. Electrochem. Soc.</i> 151, A196 (2004); LiFePO₄ from Afshar, Morris and Khajepour (2017); silicon from Verbrugge, Baker and Xiao, <i>J. Electrochem. Soc.</i> 163, A262 (2016), averaging its charge and discharge curves, which differ. Each is used only over the range of filling a real cell uses. The two scales are tied only approximately: the lithium electrode in an organic electrolyte is not the same as in water.</p>`
		},
		{
			id: 'capacity',
			chapter: 'materials',
			title: 'Capacity: counting lithium per gram',
			scene: 'materials',
			hints: { focus: 'capacity' },
			duration: 30,
			controls: [cathode, anode],
			body: `
<p>Voltage is half the story; the other half is how much charge each gram can hold. Faraday's law gives it from the formula: one lithium (one electron) per formula unit of molar mass M stores 96 485 ÷ M coulombs per gram. Graphite takes one lithium per six carbons, LiC₆: 72 g of carbon per mole of lithium, <strong>372 mAh/g</strong>. LiCoO₂ weighs 98 g per mole: <strong>274 mAh/g</strong> if all its lithium could come out, but only about half can before the oxide falls apart.</p>
<p>The bars show how many grams of each electrode it takes to hold <strong>one amp-hour</strong>. The oxide is the heavy part. Silicon (Li₁₅Si₄, 3.75 lithium per silicon atom) holds ten times more than graphite per gram, but swapping it in only lightens the anode, so the whole pair gains much less than tenfold.</p>
<p>Energy per kilogram is charge per kilogram times voltage. Look for the pairing with the most.</p>`,
			notes: `<p>These figures count only the active materials. A finished cell also carries foils, electrolyte, separator and can: the LG M50's 270 Wh/kg is about two-thirds of what its NMC and graphite alone would give. The record holders on paper have real problems: silicon swells by roughly 280 % as it fills (Obrovac and Chevrier, <i>Chemical Reviews</i> 114, 11444 (2014)) and cracks; lithium metal grows needle-like dendrites that can pierce the separator. A real cell also carries some spare negative electrode, so the two are not exactly matched as they are here.</p>`
		},
		{
			id: 'summary',
			chapter: 'materials',
			title: 'The whole idea: a reaction split in two',
			scene: 'cell',
			hints: { focus: 'summary', mode: 'discharge', closedParam: 'closedEnd' },
			duration: 24,
			controls: [closedEnd],
			body: `
<p>Every battery, from a zinc–copper cell to the one in your phone, is a redox reaction split into two halves, kept apart by something that lets ions through but not electrons. The reaction can only go forward if the electrons travel round the outside, through whatever you want to power.</p>
<ul>
<li>Which two materials face each other sets the <strong>voltage</strong>: the gap between their potentials.</li>
<li>How much of them there is sets the <strong>capacity</strong>: Faraday's law, 96 485 coulombs per mole of electrons.</li>
<li>Charging pushes the reaction back the other way, uphill.</li>
</ul>
<p>Disconnect the wire one last time: both halves stop together.</p>`
		}
	]
};
