import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { GAAS_GAP, GAPS, cell, kelvin, photonEnergy } from './model';

/**
 * Scenes: `spectrum` (sunlight against photon energy; the band gap's handle splits it),
 * `cell` (a silicon p–n junction in the light, in the band picture), `iv` (the ideal silicon
 * cell's current–voltage curve) and `curve` (efficiency against band gap, with records).
 * `hints.phase` picks what each scene shows.
 */

const SI = GAPS.Si.gap;
const vocAt = (suns: number, celsius?: number) =>
	cell(SI, { suns, T: celsius === undefined ? undefined : kelvin(celsius) }).voc;

const nm: Control = {
	type: 'range',
	id: 'nm',
	label: 'Colour of the light (wavelength)',
	min: 300,
	max: 1300,
	step: 5,
	default: 550,
	format: (v) => `${v} nm · ${photonEnergy(v).toFixed(2)} eV per photon`,
	help: 'Violet is about 400 nm, red about 700 nm; beyond that is infrared, which we cannot see.'
};

const power: Control = {
	type: 'range',
	id: 'power',
	label: 'Power of the light on the cell',
	min: 0,
	max: 1000,
	step: 50,
	default: 600,
	unit: ' W/m²',
	help: 'Full sunlight is about 1000 W/m², spread over all colours.'
};

/** Voltage across the cell, up to its open-circuit voltage for the light and temperature of the step. */
const volts = (max: (p: Record<string, unknown>) => number): Control => ({
	type: 'range',
	id: 'v',
	label: 'Voltage across the cell (set by the load)',
	min: 0,
	max: 1.06,
	bounds: (p) => [0, Math.floor(max(p) * 1000) / 1000],
	step: 0.005,
	default: 0.5,
	format: (v) => `${v.toFixed(3)} V`
});

const suns: Control = {
	type: 'range',
	id: 'suns',
	label: 'Brightness of the sunlight',
	min: -2,
	max: 3,
	step: 0.5,
	default: 0,
	format: (v) => {
		const x = 10 ** v;
		return `${x >= 1 ? Math.round(x).toLocaleString('en-US') : Number(x.toPrecision(2))} × full sun`;
	},
	help: 'Each step is about three times brighter. Lenses and mirrors can concentrate sunlight hundreds of times.'
};

const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Temperature of the cell',
	min: -20,
	max: 90,
	step: 1,
	default: 27,
	unit: ' °C',
	help: 'Cells are rated at 25 °C; in strong sun a panel runs much hotter than the air.'
};

const materials: [number, string][] = [
	[GAPS.Ge.gap, 'germanium'],
	[SI, 'silicon'],
	[GAAS_GAP, 'gallium arsenide']
];
const gap: Control = {
	type: 'range',
	id: 'gap',
	label: 'Band gap of the material',
	min: 0.5,
	max: 3,
	step: 0.01,
	default: SI,
	format: (v) => {
		const m = materials.find(([g]) => Math.abs(g - v) < 0.005);
		return `${v.toFixed(2)} eV${m ? ` (${m[1]})` : ''}`;
	},
	help: 'Or drag the band gap’s handle on the picture. Germanium 0.66 eV, silicon 1.12 eV, gallium arsenide 1.42 eV.'
};

export const spec: ExplainerSpec = {
	slug: 'solar-cells',
	title: 'Solar cells',
	summary:
		'Shine light of any colour on a silicon junction and watch each photon free an electron that the junction’s field drives round a circuit. Then find the best voltage to run the cell at, and change the band gap to see how sunlight’s energy divides between what passes through, what turns into heat, what the voltage cannot keep, and the one-third that becomes electricity.',
	chapters: [
		{ id: 'light', title: 'Light into current' },
		{ id: 'power', title: 'Voltage and power' },
		{ id: 'gap', title: 'The band-gap trade-off' }
	],
	steps: [
		// ------------------------------------------------------------------ light
		{
			id: 'sunlight',
			chapter: 'light',
			title: 'Sunlight is a rain of photons',
			scene: 'spectrum',
			hints: { phase: 'sun' },
			duration: 22,
			body: `
<p>A prism spreads sunlight into its colours (<a href="../light-optics/#prism">light and optics</a>). Light also comes in packets, <dfn data-def="The smallest amount of light of a given colour. Its energy is fixed by the wavelength: E = hc/λ ≈ 1240 eV·nm ÷ λ.">photons</dfn>, and each photon's energy is set by its colour: <strong>1240 eV·nm divided by the wavelength</strong>. A red photon (700 nm) carries 1.8 <dfn data-def="Electron-volt: the energy an electron gains crossing one volt, 1.6 × 10⁻¹⁹ joules.">eV</dfn>, a violet one (400 nm) 3.1 eV. Infrared photons, which we can't see, carry less.</p>
<p>The chart is the sunlight that every solar cell in the world is rated in: a standard clear day with the sun 48° from overhead, on a panel tilted to face it. It delivers about <strong>1000 watts per square metre</strong>, as about <strong>4.3 × 10<sup>21</sup> photons</strong> per square metre every second. Their energies are spread from 0.3 to 4.4 eV; the average is 1.45 eV, and more than half the power is outside the colours we see.</p>
<p>A solar cell has to turn as much of this as it can into electricity.</p>`,
			notes: `<p>The spectrum is the standard <strong>AM1.5 global</strong> (ASTM G173-03, computed with Gueymard's SMARTS model and distributed by the National Laboratory of the Rockies, formerly NREL): sunlight after passing through 1.5 times the thickness of the atmosphere straight overhead, direct plus scattered sky light, on a surface tilted 37°. The dips are absorption by water vapour, oxygen and carbon dioxide in the air (<a href="../greenhouse-effect/">the greenhouse effect</a> is the same absorption at longer wavelengths). The chart plots power per 0.01 eV of photon energy, so the area under the curve between two energies is the power those photons bring.</p>`
		},
		{
			id: 'absorb',
			chapter: 'light',
			title: 'A photon frees an electron, if it has enough energy',
			scene: 'cell',
			hints: { phase: 'absorb' },
			duration: 24,
			controls: [nm],
			body: `
<p>Here is a slice of silicon in the band picture of <a href="../semiconductors/#semiconductor">semiconductors</a>: a full valence band below, an empty conduction band above, and a gap of <strong>1.12 eV</strong> between them. Each vertical arrow is a photon's energy, drawn to the same scale as the gap.</p>
<p>A photon with at least the gap's energy can lift an electron out of a bond and into the conduction band. The photon disappears, and leaves an <dfn data-def="A free electron in the conduction band together with the hole it left in the valence band. Light, or heat, creates them together.">electron–hole pair</dfn>: two charges that can move. A photon with less energy can't lift the electron part-way, because there are no levels in the gap. Silicon is transparent to it and it passes straight through.</p>
<p><strong>Change the colour.</strong> Everything from violet to deep infrared out to <strong>1107 nm</strong> (1.12 eV) is absorbed; beyond that, silicon is as clear as glass.</p>`,
			notes: `<p>Real silicon is a weak absorber near its gap: infrared light just above 1.12 eV needs a millimetre or more of silicon to be absorbed, because silicon's gap is "indirect" (the electron also needs a nudge from a vibration of the crystal). Cells are about 0.15 mm thick and trap light by texturing their surfaces so it bounces back and forth inside. The model behind the page assumes, as Shockley and Queisser did, that every photon above the gap is absorbed and every one below is not.</p>`
		},
		{
			id: 'heat',
			chapter: 'light',
			title: 'Extra energy is lost as heat',
			scene: 'cell',
			hints: { phase: 'heat' },
			duration: 24,
			controls: [nm],
			body: `
<p>A blue photon carries more than twice silicon's gap. It lifts the electron high into the conduction band, far above the band's lower edge. That doesn't last: within about a trillionth of a second it bumps into the vibrating atoms of the crystal, hands over its extra energy a little at a time and settles at the bottom of the band. The extra energy ends up as <dfn data-def="The random jiggling of atoms in a solid. Energy given to the crystal this way just warms it.">vibrations of the crystal</dfn>: heat.</p>
<p>So every absorbed photon, red or violet, leaves behind the same thing: one electron at the bottom of the conduction band and one hole at the top of the valence band, <strong>1.12 eV</strong> apart. <strong>Change the colour</strong> and watch the part of the arrow above the gap, the part that warms the cell.</p>
<p>Leaves do the same: chlorophyll absorbs blue light too, but its extra energy is shed as heat before the excitation reaches the reaction centre (<a href="../photosynthesis/#antenna">catching a photon</a>).</p>`,
			notes: `<p>This loss is called <dfn data-def="Excited electrons and holes giving their energy above the band edges to the crystal's vibrations, in well under a picosecond.">thermalisation</dfn>. It happens in well under a picosecond, far faster than anything else the electron can do, so in an ordinary cell it is unavoidable. "Hot-carrier" cells that would collect electrons before they cool remain a research idea.</p>`
		},
		{
			id: 'sweep',
			chapter: 'light',
			title: 'The junction sweeps the charges into a circuit',
			scene: 'cell',
			hints: { phase: 'sweep' },
			duration: 28,
			controls: [nm, power],
			body: `
<p>A free electron and hole left alone would soon find each other again and recombine. A solar cell is a <a href="../semiconductors/#pn">p–n junction</a>, and the junction's built-in field pulls them apart before they can: in the band picture, the electron rolls <em>down</em> the slope into the n side, and the hole floats <em>up</em> into the p side. The n side collects electrons and the p side holes, so a wire joining them carries a current through the lamp. Each absorbed photon pushes one electron round the circuit.</p>
<p>That makes the current simple to predict: it is the number of photons absorbed per second. <strong>Turn the power up</strong> and the current grows in proportion. <strong>Change the colour</strong> at the same power: 600 W/m² of red light holds more photons than 600 W/m² of blue (each red one carries less energy), so it drives more current. Beyond 1107 nm there is none at all.</p>`,
			notes: `<p>Current density J = (power ÷ photon energy) × q, one electron per absorbed photon; for power in W/m² and photon energy in eV, J in A/m² is simply the power divided by the energy. A measured cell's "quantum efficiency" is the fraction of photons of each colour that actually become collected electrons; pairs made away from the junction reach it by wandering (diffusion), and the few that recombine on the way are lost.</p>`
		},
		// ------------------------------------------------------------------ power
		{
			id: 'iv',
			chapter: 'power',
			title: 'A lit diode: current and voltage',
			scene: 'iv',
			hints: { phase: 'iv' },
			duration: 26,
			controls: [volts(() => vocAt(1))],
			body: `
<p>From now on, the cell is in full sunlight: an ideal silicon cell at 27 °C. The curve shows the current it delivers against the voltage across it, and the voltage is set by what you connect.</p>
<p>Join its two sides with a plain wire and there's no voltage: every collected electron goes round, the <dfn data-def="The current a solar cell gives when its terminals are joined directly, at zero voltage. Written I_sc (or J_sc per unit area).">short-circuit current</dfn>, <strong>43.8 mA per cm²</strong>. Leave it unconnected and charge piles up on the two sides until the voltage reaches <strong>0.88 V</strong>, the <dfn data-def="The voltage across a lit solar cell with nothing connected, when no current flows. Written V_oc.">open-circuit voltage</dfn>. <strong>Drag the dot</strong> between the two.</p>
<p>The shape is <a href="../semiconductors/#curve">the diode curve</a>, flipped: the voltage that builds up across the junction pushes the cell's own diode forward, and its diode current flows back against the photocurrent. Near 0.8 V it rises steeply and cancels it:</p>
<p class="formula">J = J<sub>sc</sub> − J<sub>0</sub> (e<sup>V / (kT/q)</sup> − 1)</p>`,
			notes: `<p>The voltage is the split of the electrons' and holes' quasi-Fermi levels (the dashed lines on the forward-bias step of the semiconductors page), which light pulls apart just as a battery does. The currents are per square centimetre of cell. Real cells add a little series resistance (contacts and fingers) that tilts the steep part of the curve, and some leakage that tilts the flat part.</p>`
		},
		{
			id: 'voc',
			chapter: 'power',
			title: 'Why the voltage stays below the gap',
			scene: 'iv',
			hints: { phase: 'voc' },
			duration: 28,
			controls: [suns, volts((p) => vocAt(10 ** Number(p.suns ?? 0)))],
			body: `
<p>Each pair carries 1.12 eV, so why only 0.88 V? Because a warm cell glows. Any object gives off light, as the Sun does and as a stove ring does: at room temperature it is a faint infrared glow. Electrons and holes that meet again can recombine by giving off a photon, the reverse of absorption. <dfn data-def="The principle that in equilibrium every process is balanced by its reverse at the same rate, here absorption of light by emission of light.">Detailed balance</dfn> says a cell that absorbs light above its gap must also emit it.</p>
<p>The voltage pushes more pairs together, and the glow grows by ten for every 60 mV. At the open-circuit voltage the cell gives back as many photons as it absorbs, and nothing is left to flow. Even an ideal cell must stop well short of its gap. <strong>Drag the dot</strong> and read how much light comes back out.</p>
<p><strong>Change the brightness:</strong> ten times more light raises the voltage by just 60 mV, and the current by ten times. Even under 1000 suns the voltage only reaches 1.06 V.</p>`,
			notes: `<p>Shockley and Queisser's insight (1961) was that this light, which no cell can avoid, sets the dark current J<sub>0</sub>: it is the black-body glow of a 300 K body above the band gap, from the cell's front surface, about 10<sup>−15</sup> of the sunlight it absorbs. Then V<sub>oc</sub> = (kT/q) ln(J<sub>sc</sub>/J<sub>0</sub> + 1). Real cells recombine in other ways too, at defects and surfaces, without giving off light; their J<sub>0</sub> is larger and their voltage lower. The record silicon cell reaches 0.75 V against this ideal 0.88 V; the record gallium arsenide cell comes within 3% of the ideal voltage for its gap.</p>`
		},
		{
			id: 'mpp',
			chapter: 'power',
			title: 'The best place on the curve',
			scene: 'iv',
			hints: { phase: 'mpp' },
			duration: 28,
			controls: [volts(() => vocAt(1))],
			body: `
<p>Electrical power is voltage times current: the area of the rectangle under the dot. At short circuit the current is large but the voltage zero; at open circuit it is the other way round. Both give no power at all.</p>
<p>In between there is a best point, the <dfn data-def="The voltage and current at which a solar cell delivers the most power. Inverters keep panels there as the light changes.">maximum power point</dfn>: for the ideal silicon cell, <strong>0.79 V</strong> and 42.4 mA/cm², or 33.4 mW per cm² from the 100 mW/cm² of sunlight: <strong>33.4% efficiency</strong>. <strong>Drag the dot</strong> to find it on the power curve.</p>
<p>The rectangle at that point fills 87% of the largest one you could draw under the curve (V<sub>oc</sub> × J<sub>sc</sub>): the <dfn data-def="Maximum power divided by open-circuit voltage times short-circuit current. A squarer I–V curve has a higher fill factor.">fill factor</dfn>. So running the cell at its best costs another eighth of the energy each pair has left. The electronics behind every panel (the inverter) keep hunting for that point as clouds pass.</p>`,
			notes: `<p>At the maximum power point d(VJ)/dV = 0, which for this curve gives e<sup>x</sup>(1 + x) = 1 + J<sub>sc</sub>/J<sub>0</sub> with x = qV<sub>mp</sub>/kT. Real silicon cells reach fill factors of 80–87%; the 2026 record cell (LONGi) has 87.4%. Panels connect dozens of cells in series to add up their voltages.</p>`
		},
		{
			id: 'temperature',
			chapter: 'power',
			title: 'Hot cells give less',
			scene: 'iv',
			hints: { phase: 'temp' },
			duration: 26,
			controls: [temp, volts((p) => vocAt(1, Number(p.temp ?? 27)))],
			body: `
<p>Solar panels like cold, sunny days. A hotter cell glows more (heat breaks more bonds, as in <a href="../semiconductors/#semiconductor">a semiconductor</a> warming up), so its dark current is larger and the voltage at which the glow cancels the photocurrent is lower. The current hardly changes.</p>
<p><strong>Warm the cell up.</strong> The ideal silicon cell loses about <strong>0.9 mV</strong> and <strong>0.15% of its power per °C</strong>: from 33.5% at 25 °C to 32.2% at 50 °C. The faint curve is the cell at 25 °C, where cells are tested.</p>
<p>Real cells suffer more: their voltage is further below the gap, and it falls about 2 mV per °C, so a silicon panel loses roughly 0.4–0.5% of its power for each degree. On a summer roof at 60 °C that is a sixth of its power.</p>`,
			notes: `<p>The band gap is held fixed here; in real silicon it shrinks slightly with temperature, which absorbs a few more photons but lowers the voltage a little more. The figures for real silicon (−2.2 mV/°C and 0.4–0.5% per °C) are from C. Honsberg and S. Bowden, <i>Photovoltaics Education</i> (pveducation.org), for a typical cell with V<sub>oc</sub> ≈ 0.6 V. The closer a cell's voltage is to its gap, the less it loses.</p>`
		},
		// ------------------------------------------------------------------ gap
		{
			id: 'gap',
			chapter: 'gap',
			title: 'Choosing the band gap',
			scene: 'spectrum',
			hints: { phase: 'gap' },
			duration: 30,
			controls: [gap],
			body: `
<p>Silicon is not the only choice: other semiconductors have other gaps. Back to the sunlight, now with a band gap. Photons left of the gap's line are too weak and pass through (<strong>grey</strong>). Those to the right are absorbed, and each keeps only the gap's worth of energy (<strong>green</strong>). Everything above that becomes heat (<strong>orange</strong>).</p>
<p><strong>Drag the gap</strong>. A small gap absorbs almost every photon but keeps little of each; a large gap keeps a lot of each but catches few. For silicon, 19% of the power passes through and 32% becomes heat, leaving 49%.</p>
<p>The kept part is largest, about <strong>49%</strong>, for gaps around 1.1 eV. But that is not yet the limit: it assumes every pair delivers its full 1.12 eV, and we've just seen that the voltage can't reach the gap.</p>`,
			notes: `<p>The kept fraction is E<sub>g</sub> × (photons above E<sub>g</sub>) ÷ (total power), the “ultimate efficiency” Shockley and Queisser first worked out for a cell that could deliver the full gap. It is the area of the green region under the curve. Because the area of each region is a power, the bar on the right is the same three areas, stacked.</p>`
		},
		{
			id: 'slices',
			chapter: 'gap',
			title: 'Where sunlight’s energy goes',
			scene: 'spectrum',
			hints: { phase: 'limit' },
			duration: 30,
			controls: [gap],
			body: `
<p>Now add what the previous chapter found. Of the gap's worth of energy each pair carries, the cell only delivers its voltage at the maximum power point, and gives up a little current there too. That loss is the <strong>violet</strong> slice, carved out of the green; what remains green is the electrical output.</p>
<p><strong>Drag the gap</strong> and watch the four slices trade off against each other. At silicon's 1.12 eV the output is <strong>33.4%</strong>. The voltage slice is smallest for wide gaps, but those let most of the light through.</p>
<p>The best balance is at <strong>1.34 eV</strong>: 30% passes through, 23% heats the cell, 13% is lost to the voltage, and <strong>33.7%</strong> becomes electricity.</p>`,
			notes: `<p>The voltage slice is (E<sub>g</sub> × J<sub>sc</sub>/q − V<sub>mp</sub> × J<sub>mp</sub>) ÷ power. It has two parts: the open-circuit voltage falling short of the gap (the light the cell must give off) and the fill factor (running at the best point). Both are computed from the cell's glow, not assumed. Leaving it out would suggest a ceiling near 49%, which no single-junction cell can approach.</p>`
		},
		{
			id: 'limit',
			chapter: 'gap',
			title: 'The one-third limit',
			scene: 'curve',
			hints: { phase: 'limit' },
			duration: 26,
			controls: [gap],
			body: `
<p>Here is the output for every band gap: the <dfn data-def="The highest efficiency a single-junction solar cell can reach in standard sunlight, about 33.7%, found by Shockley and Queisser in 1961 from detailed balance.">Shockley–Queisser limit</dfn>. Its peak is <strong>33.7% at 1.34 eV</strong>. The dashed curve above it is the ceiling the two spectrum losses alone would leave.</p>
<p>The top is flat: anywhere from 1.1 to 1.4 eV gives within one percentage point of the best, which is why silicon, at 1.12 eV, is such a good choice as well as being cheap and abundant. Below about 0.9 eV or above about 1.8 eV the limit drops fast. <strong>Drag the gap</strong> along the curve.</p>
<p>So the band gap forces a trade-off: absorb more photons, or keep more of each. With the voltage the cell's glow takes, no single junction can turn more than about a third of sunlight into electricity.</p>`,
			notes: `<p>The limit assumes perfect absorption above the gap, no reflection, no resistance and only radiative recombination, a cell at 300 K and standard AM1.5G sunlight; it reproduces S. Rühle's tabulation (<i>Solar Energy</i> 130, 139, 2016). The small bumps on the curve come from the dips in the sunlight, where water vapour and oxygen absorb it. Concentrating the light raises the limit (about 41% for silicon at 1000 suns in this model), because the voltage rises with brightness while the glow does not.</p>`
		},
		{
			id: 'records',
			chapter: 'gap',
			title: 'Real cells, and beating the limit',
			scene: 'curve',
			hints: { phase: 'records' },
			duration: 30,
			controls: [gap],
			body: `
<p>The dots are the best laboratory cells, measured independently and charted by the National Laboratory of the Rockies (formerly NREL). Silicon has reached <strong>28.1%</strong> (2026), 84% of its limit; gallium arsenide, at 1.42 eV, <strong>29.1%</strong>. Perovskite cells, made from cheap crystals deposited from a solution, are at 28.0%; the thin-film CIGS and cadmium telluride cells at 23.6% and 23.1%. For comparison, a crop field turns 1–2% of sunlight into biomass (<a href="../photosynthesis/">photosynthesis</a>).</p>
<p>The limit is for <em>one</em> junction. Stack junctions with different gaps and each colour can go to the one that wastes least of it: blue to a wide-gap top cell, red and infrared to the cells below. That beats the limit: a perovskite cell on silicon has reached <strong>35.2%</strong>, three junctions of III–V semiconductors <strong>39.5%</strong>, and four junctions under concentrated light <strong>47.6%</strong>.</p>`,
			notes: `<p>Records from the NLR Best Research-Cell Efficiency Chart (data table, August 2026): crystalline silicon 28.1% (LONGi, back-contact heterojunction), GaAs 29.1% (Alta Devices, 2018), perovskite 28.0% (Hainan University, 2026), CIGS 23.6% (Evolar/Uppsala, 2023), CdTe 23.1% (First Solar, 2024), perovskite/silicon 35.2% (LONGi, 2026), three-junction 39.5% (NREL, 2021), four-junction at 665 suns 47.6% (Fraunhofer ISE, 2022). “This plot is courtesy of the National Laboratory of the Rockies, Golden, CO.” Only silicon and gallium arsenide are placed on the band-gap axis (1.12 and 1.42 eV, Sze &amp; Ng): the other materials' gaps depend on their exact composition. A stack of infinitely many junctions could in principle reach about 68% in ordinary sunlight (A. De Vos, <i>J. Phys. D</i> 13, 839, 1980). Electricity from panels reaches <a href="../power-grid/">the power grid</a> through inverters.</p>`
		}
	]
};
