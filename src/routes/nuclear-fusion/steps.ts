import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { KELVIN_PER_KEV } from './model';

// ---- controls ------------------------------------------------------------------------

const fmtKelvin = (keV: number) => {
	const mk = (keV * KELVIN_PER_KEV) / 1e6;
	return mk >= 1000 ? `${(mk / 1000).toFixed(1)} billion K` : `${Math.round(mk)} million K`;
};
const tempValues = [
	1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90,
	100
] as const;

/** Plasma temperature, in keV (1 keV ≈ 11.6 million kelvin). */
const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Temperature',
	min: 1,
	max: 100,
	step: 0.5,
	default: 10,
	values: () => tempValues,
	format: (v) => `${v} keV · ${fmtKelvin(v)}`,
	help: '1 keV of temperature is 11.6 million kelvin.'
};

const sup = (n: number) =>
	String(n)
		.split('')
		.map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? (c === '-' ? '⁻' : c))
		.join('');
/** 10^x written as "2.5 × 10²⁰". */
export const fmtPow = (x: number) => {
	const e = Math.floor(x + 1e-9);
	const m = 10 ** (x - e);
	return m < 1.05 ? `10${sup(e)}` : `${m.toFixed(1)} × 10${sup(e)}`;
};
export const fmtSeconds = (s: number) =>
	s >= 1 ? `${s < 9.95 ? s.toFixed(1) : Math.round(s)} s` : `${Math.round(s * 1000)} ms`;

/** Fuel density, as log₁₀ of ions per cubic metre. */
const density: Control = {
	type: 'range',
	id: 'logN',
	label: 'Density',
	min: 19,
	max: 21,
	step: 0.1,
	default: 20,
	format: (v) => `${fmtPow(v)} ions/m³`,
	help: 'Fuel ions per cubic metre: 10²⁰ is a typical tokamak, a millionth of the density of air.'
};

/** Energy confinement time, as log₁₀ of seconds. */
const tau: Control = {
	type: 'range',
	id: 'logTau',
	label: 'Confinement time',
	min: -2,
	max: 1,
	step: 0.1,
	default: 0,
	format: (v) => fmtSeconds(10 ** v),
	help: 'How long the plasma would take to lose its heat if nothing replaced it.'
};

const run: Control = {
	type: 'action',
	id: 'run',
	label: 'Heating',
	action: 'Heat and let go again'
};

const reaction: Control = {
	type: 'select',
	id: 'fuel',
	label: 'Highlight',
	default: 'DT',
	options: [
		{ value: 'DT', label: 'Deuterium + tritium' },
		{ value: 'DD', label: 'Deuterium + deuterium' },
		{ value: 'DHe3', label: 'Deuterium + helium-3' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'nuclear-fusion',
	title: 'Nuclear fusion',
	summary:
		'Heat a plasma of hydrogen isotopes until its nuclei tunnel through their repulsion and fuse, then set its temperature, density and confinement time and see whether the fusion power can beat the heating.',
	chapters: [
		{ id: 'why', title: 'Energy from joining nuclei' },
		{ id: 'barrier', title: 'Getting close enough' },
		{ id: 'balance', title: 'More out than in' },
		{ id: 'confine', title: 'Holding it together' }
	],
	steps: [
		// ------------------------------------------------------------------ why
		{
			id: 'binding',
			chapter: 'why',
			title: 'The binding-energy curve',
			scene: 'binding',
			duration: 24,
			body: `
<p>A nucleus is held together by the <a href="../standard-model/#four-forces">strong force</a>, and pulling it apart takes energy: its <dfn data-def="The energy needed to pull a nucleus apart into separate protons and neutrons. Shared out, it is the binding energy per nucleon.">binding energy</dfn>. Divide it by the number of protons and neutrons (<dfn data-def="A proton or a neutron: the particles a nucleus is made of.">nucleons</dfn>) and you get how tightly each one is held. Here it is for every mass number, measured.</p>
<p>The curve climbs steeply through the lightest nuclei, peaks around iron and nickel, and slowly falls towards uranium. Any change that moves nuclei <strong>up</strong> the curve releases energy. There are two ways: split a heavy nucleus (<strong>fission</strong>, what nuclear power stations do) or join two light ones (<strong>fusion</strong>, what stars do).</p>
<p>The climb on the left is far steeper. Deuterium holds each nucleon with 1.1 MeV, helium-4 with 7.1 MeV; a uranium nucleus that splits only moves from 7.6 to about 8.5 MeV.</p>`,
			notes: `<p>Binding energies from the Atomic Mass Evaluation 2020 (Wang et al., Chinese Physics C 45, 030003, 2021): for each mass number, the most tightly bound measured nucleus. The very top is nickel-62 (8.795 MeV per nucleon), just ahead of iron-58 and iron-56; iron-56 is the commonest end point in stars because of how the reactions run, not because it is the most bound. An MeV (mega-electronvolt) is the energy an electron gains across a million volts: 1.6 × 10⁻¹³ joules. Helium-4 sits well above its neighbours: it is an unusually tight bundle of two protons and two neutrons — the <a href="../radioactivity/#alpha">alpha particle</a>.</p>`
		},
		{
			id: 'dt',
			chapter: 'why',
			title: 'Deuterium plus tritium',
			scene: 'reaction',
			duration: 26,
			body: `
<p>The easiest fusion to make happen on Earth joins two heavy kinds of hydrogen (<dfn data-def="Versions of an element with the same number of protons but different numbers of neutrons.">isotopes</dfn>): <strong>deuterium</strong> (one proton, one neutron), found in all water, and <strong>tritium</strong> (one proton, two neutrons). They make a helium-4 nucleus and a free neutron.</p>
<p>The products weigh 0.38% less than the fuel, and the missing mass is released as energy, E = mc²: <strong>17.6 MeV</strong> per reaction. Momentum is shared out like a gun's recoil, so the light neutron flies off with four-fifths of it, 14.05 MeV, and the helium nucleus (an <dfn data-def="A helium-4 nucleus: two protons and two neutrons.">alpha particle</dfn>) with 3.54 MeV (usually rounded to 14.1 and 3.5).</p>
<p>Per kilogram of fuel that is <strong>4 times</strong> what fission of uranium gives, and <strong>6 million times</strong> what burning natural gas gives. The bars are drawn on a scale where each grid line is a thousand times the one before.</p>`,
			notes: `<p>All energies here are computed from AME2020 atomic masses. For fission, a typical split of uranium-235 into barium-141, krypton-92 and three neutrons, followed by the beta decays of the fragments down to stable praseodymium-141 and zirconium-92, releases 199 MeV (the usual round figure is 200 MeV; about a twentieth leaves as neutrinos). Methane: 890.6 kJ per mole burnt (NIST), counting the fuel but not the oxygen. Tritium is radioactive (it <a href="../radioactivity/#beta">beta-decays</a> with a half-life of 12.3 years) and almost absent in nature, so a power station would have to make its own: the neutron from each fusion can split a lithium-6 nucleus in a blanket round the plasma, n + ⁶Li → T + ⁴He, giving 4.8 MeV more.</p>`
		},
		// ------------------------------------------------------------------ barrier
		{
			id: 'repel',
			chapter: 'barrier',
			title: 'A wall of repulsion',
			scene: 'barrier',
			duration: 26,
			controls: [temp],
			body: `
<p>Both nuclei carry a positive charge, so they repel, and the closer they get the harder they push (<a href="../electromagnetism/#force">like charges repel</a>). The strong force that would grab them only reaches about the width of a nucleus. To touch, at 3.2 femtometres (millionths of a billionth of a metre), they must climb a hill of electrical energy: the <dfn data-def="The energy hill two positive nuclei must climb to come within reach of the strong force.">Coulomb barrier</dfn>, <strong>0.44 MeV</strong> high for deuterium and tritium.</p>
<p>The only way to give nuclei that kind of energy in bulk is to heat them. In a hot gas the particles fly about at random speeds; the average energy of each is 3/2 kT, where T is the temperature and k Boltzmann's constant. At such temperatures electrons are torn off the atoms, and the gas becomes a <dfn data-def="Gas so hot that its atoms have lost electrons: a mix of free nuclei and electrons.">plasma</dfn>.</p>
<p>Turn up the temperature. Even at 100 million kelvin the average nucleus has only about 1/35 of the energy needed. Climbing the barrier on average would take <strong>3.4 billion kelvin</strong>. Yet fusion works at a few per cent of that.</p>`,
			notes: `<p>Plasma physicists give temperatures in energy units: 1 keV (a thousand electronvolts) of temperature is 11.6 million kelvin, so kT = 1 keV. The touching distance is the sum of the two nuclear radii, 1.2 fm × A^⅓ each. The barrier is drawn as a pure Coulomb hill outside that distance and a sketched well of the strong force inside it: the real potential has no sharp edge.</p>`
		},
		{
			id: 'tunnel',
			chapter: 'barrier',
			title: 'Tunnelling through',
			scene: 'gamow',
			duration: 28,
			controls: [temp],
			body: `
<p>Two things rescue fusion. First, a nucleus is also a quantum wave, so it has a small chance of appearing on the far side of the barrier without ever climbing it: <a href="../quantum-mechanics/#barrier">quantum tunnelling</a>. The chance (the <dfn data-def="The probability of tunnelling through the Coulomb barrier. It rises steeply with energy: e^(−√(E_G/E)).">Gamow factor</dfn>) grows steeply with energy: about 1 in 7,000 per collision for a pair with 15 keV, 1 in 330 at 35 keV.</p>
<p>Second, a hot plasma is not uniform. A few nuclei are much faster than average, in a tail that thins out quickly: at 10 keV, only about 1 pair in 14 has more than 35 keV. Multiply the two curves, many slow pairs with no chance against a few fast ones with a fair chance, and you get where the fusions come from: a narrow peak.</p>
<p>At 10 keV it sits at about <strong>35 keV</strong>, more than three times the temperature but still a tenth of the barrier. Change the temperature and watch the peak move, and the fusion rate change.</p>`,
			notes: `<p>The fusion curve is the real one: the share of pairs at each energy (Maxwell–Boltzmann) times their speed times the measured D–T cross section, the parametrisation of Bosch and Hale (1992). Textbooks put the peak at (E_G (kT)²/4)^⅓ = 31 keV at 10 keV, from the Gamow factor alone; the real cross section has a broad resonance near 65 keV that pulls it a little higher. In the Sun's core, at 1.4 keV, the same physics works with far fewer fusions per second per nucleus: the Sun makes up for it with its size, and with its gravity holding the fuel in for billions of years (see <a href="../stars/#fusion">how stars shine</a>).</p>`
		},
		{
			id: 'reactivity',
			chapter: 'barrier',
			title: 'Which fuel, how hot',
			scene: 'reactivity',
			duration: 26,
			controls: [temp, reaction],
			body: `
<p>Add up the peak and you get the plasma's <dfn data-def="⟨σv⟩: how readily a plasma fuses at a given temperature. Multiplied by the densities of the two fuels, it gives fusions per cubic metre per second.">reactivity</dfn>, ⟨σv⟩: how readily it fuses at each temperature. Here it is for three fuels, from the measured cross sections. Both axes go up in factors of ten.</p>
<p>Deuterium–tritium wins by far: at 10 keV it fuses about <strong>100 times</strong> as readily as deuterium alone, and it needs the lowest temperature. That is why almost every machine aiming at power uses it. D–T reactivity rises steeply up to about 65 keV and then levels off.</p>
<p>But hotter is not simply better: a hotter plasma also loses energy faster, as the next chapter shows. The sweet spot for D–T is around <strong>10–20 keV</strong>, 100–200 million kelvin — about ten times hotter than the centre of the Sun.</p>`,
			notes: `<p>Reactivities: Bosch and Hale, Nuclear Fusion 32, 611 (1992), valid from 0.2 to 100 keV (D–³He to 190 keV). D–D has two branches of about equal size, to helium-3 plus a neutron and to tritium plus a proton; they are added here. Deuterium–helium-3 makes almost no neutrons, but needs much hotter plasma, and helium-3 is very rare on Earth.</p>`
		},
		// ------------------------------------------------------------------ balance
		{
			id: 'balance',
			chapter: 'balance',
			title: 'Fusion power against losses',
			scene: 'plasma',
			hints: { phase: 'balance' },
			duration: 30,
			controls: [temp, density, tau],
			body: `
<p>Now a whole plasma: an equal mix of deuterium and tritium, all at one temperature. Each cubic metre fuses at a rate set by the density squared times the reactivity. Of each 17.6 MeV, the <strong>neutron</strong> (four-fifths) escapes at once: it carries the power out to a power plant's walls. The <strong>alpha</strong> (one-fifth) is charged and stays, heating the plasma.</p>
<p>The plasma also loses heat. It leaks out through its edges, a loss measured by the <dfn data-def="Energy confinement time τ_E: the stored heat divided by the rate at which it leaks out. How long the plasma would take to cool if nothing replaced the heat.">energy confinement time</dfn> τ_E. And its electrons, swerving past ions, radiate X-rays (<dfn data-def="Bremsstrahlung (braking radiation): X-rays given off by electrons deflected by ions.">bremsstrahlung</dfn>). Outside heaters must make up whatever the alphas do not.</p>
<p>The gain <strong>Q</strong> is fusion power over heating power. At 10 keV, 10²⁰ ions per cubic metre and τ_E = 1 s, Q is about 2.4. Raise the density or the confinement time and watch the heating needed shrink.</p>`,
			notes: `<p>This is a zero-dimensional model: one temperature, one density, ions and electrons equally hot, no impurities, a confinement time that stays fixed. Real plasmas are hottest and densest in the middle, and their confinement gets worse as more heating is applied. The stored heat is 3nkT per cubic metre (3/2 kT for each ion and each electron); bremsstrahlung is 5.3 × 10⁻³⁷ n² √T watts per cubic metre (NRL Plasma Formulary, T in keV). Fusion power is released as fast particles; only once they slow down in the plasma or the walls does it become heat.</p>`
		},
		{
			id: 'lawson',
			chapter: 'balance',
			title: 'The Lawson criterion',
			scene: 'lawson',
			duration: 30,
			controls: [temp, density, tau],
			body: `
<p>When the alphas alone make up all the losses, the heaters can be switched off: the plasma keeps itself hot. That is <dfn data-def="The state in which a fusion plasma's own alpha heating balances all its losses, so it burns without outside heating.">ignition</dfn>. In 1955 John Lawson worked out what it takes. Density and confinement time enter only as a product, and the temperature in a way that can be read off this curve.</p>
<p>The dot is your plasma. Above the line it ignites. The line is lowest at about 14 keV, where the <dfn data-def="Density × temperature × energy confinement time, n T τ_E. The main measure of how close a fusion plasma is to ignition.">triple product</dfn> n T τ_E must reach about <strong>3 × 10²¹ keV s m⁻³</strong>: for example 10²⁰ ions per cubic metre at 15 keV for 2 seconds.</p>
<p>Below about <strong>4.3 keV</strong> no plasma ignites, however well held: the bremsstrahlung alone outruns the alpha heating. The two fainter lines show gain Q = 1 and Q = 10 with heating still on.</p>`,
			notes: `<p>J. D. Lawson, "Some criteria for a power producing thermonuclear reactor", Proceedings of the Physical Society B 70, 6 (1957), first written in 1955. Lawson's own condition counted the power recovered from the hot exhaust at a given efficiency; today "Lawson criterion" usually means the ignition condition used here, n τ_E ≥ 12 kT / (⟨σv⟩E_α − 4C_B√T). With this simple model the minimum is 2.9 × 10²¹ keV s m⁻³ at 14 keV, close to the textbook figure of 3 × 10²¹ (Wesson, Tokamaks); real profiles of temperature and density shift it.</p>`
		},
		{
			id: 'ignite',
			chapter: 'balance',
			title: 'Switch the heating off',
			scene: 'plasma',
			hints: { phase: 'run' },
			duration: 36,
			controls: [temp, density, tau, run],
			body: `
<p>Here is the test. Heaters bring the plasma to your temperature; then they switch off. Fusion goes on as long as the plasma stays hot, so follow its temperature.</p>
<p>Below the Lawson line it cools within a few confinement times, and fusion fizzles out, a flame without enough fuel. Above it, the alphas heat the plasma faster than it loses heat; it grows hotter until the losses catch up, and settles into a steady <strong>burn</strong>.</p>
<p>Try it: at 10²⁰ ions per cubic metre and 1 second the plasma cools even at its best temperature; at 2 seconds and 15 keV it ignites. The real difficulty is not the heat — machines reach 100 million kelvin routinely — but holding the plasma <strong>long enough and dense enough</strong>.</p>`,
			notes: `<p>The run solves 3n dT/dt = P_α − W/τ_E − P_brems with τ_E held fixed, for eight confinement times; time on the plot is real seconds. A fixed τ_E is generous: in real tokamaks it falls as the heating power grows, which is what holds a burning plasma steady, together with control of the fuel feed. The reactivity formula is only valid up to 100 keV, so a run that reaches it is stopped there.</p>`
		},
		// ------------------------------------------------------------------ confine
		{
			id: 'tokamak',
			chapter: 'confine',
			title: 'A magnetic bottle',
			scene: 'confine',
			hints: { phase: 'magnetic' },
			duration: 30,
			body: `
<p>Nothing solid can touch a plasma at 100 million kelvin. But its particles are charged, and a charge moving across a magnetic field is pushed sideways (the same push that <a href="../motors-generators/#force">turns an electric motor</a>): it spirals round the field lines and can only drift along them. Bend the field lines into a ring and the plasma has nowhere to go. That is the <dfn data-def="A doughnut-shaped magnetic bottle: coils make a field round the ring, and a current in the plasma twists it into helices.">tokamak</dfn>, a Russian acronym for a "toroidal chamber with magnetic coils".</p>
<p>Coils round the ring make the main field; a current driven through the plasma itself twists the field lines into helices, which keeps the particles from drifting out. Still the plasma leaks heat, by turbulence, and τ_E grows with the size of the machine.</p>
<p>The largest tokamak of its time, <strong>JET</strong> in England, in its last experiments in 2023 made <strong>69 megajoules</strong> of fusion energy in a 5-second pulse, from 0.2 milligrams of fuel. That record still used more heating power than it gave back.</p>`,
			notes: `<p>JET (Joint European Torus, Culham, 1983–2023): 69.26 MJ over 5.2 s from 0.21 mg of fuel (EUROfusion and UKAEA, February 2024); its peak fusion power, 16 MW for a fraction of a second in 1997 from about 25 MW of heating, gave Q ≈ 0.64. The plasma here is drawn far denser in particles than the real one; each dot stands for countless ions. The magnetic field is several tesla, a hundred thousand times the Earth's.</p>`
		},
		{
			id: 'inertial',
			chapter: 'confine',
			title: 'Squeezed by lasers',
			scene: 'confine',
			hints: { phase: 'inertial' },
			duration: 30,
			body: `
<p>The other way does not hold the fuel at all. A capsule of frozen deuterium–tritium smaller than a peppercorn is crushed so hard and fast that it fuses before it has time to fly apart: <dfn data-def="Inertial confinement fusion: a fuel capsule imploded so fast that its own inertia holds it together for the moment it burns.">inertial confinement</dfn>. Its density is a hundred billion times a tokamak's, and τ_E is under a billionth of a second; the triple product is what counts.</p>
<p>At the <strong>National Ignition Facility</strong> in California, 192 laser beams heat a gold can round the capsule; its X-rays blow off the capsule's surface, and the recoil drives the rest inwards. On 5 December 2022, 2.05 MJ of laser light gave <strong>3.15 MJ</strong> of fusion: the first time a fusion fuel gave out more than was put into it. In April 2025 a shot gave 8.6 MJ from 2.08 MJ.</p>
<p>NIF calls this “ignition”, but it means target gain above 1, not the steady burn of the last chapter. And the lasers drew around 300 MJ from the grid for each shot.</p>`,
			notes: `<p>Figures from Lawrence Livermore National Laboratory. The gain counts the laser energy reaching the target; the capsule itself absorbs only about a tenth of it. Inside the imploded capsule a central hot spot ignites first and the burn spreads outward through the denser fuel round it. A power plant would need a far higher gain, and several shots every second instead of a few a day.</p>`
		},
		{
			id: 'gain',
			chapter: 'confine',
			title: 'The road to gain',
			scene: 'scorecard',
			duration: 28,
			body: `
<p>Here are the milestones on one scale: the gain, fusion energy out over heating energy in. JET's 1997 peak reached about <strong>0.64</strong>. NIF passed <strong>1</strong> in 2022 and reached about <strong>4</strong> in 2025, measured against the laser light on the target. Counted against the electricity the lasers drew from the grid, NIF's 2022 gain was about 0.01.</p>
<p><strong>ITER</strong>, a tokamak twice JET's size being built in France by an international collaboration, is designed for <strong>Q = 10</strong>: 500 megawatts of fusion power from 50 MW of heating, for several minutes. Its deuterium–tritium experiments are planned for 2039.</p>
<p>A power station needs more still: the heaters, magnets and lasers draw much more electricity than the heat they put into the plasma, and only a third or so of the fusion heat can be turned back into electricity. Fusion gives more energy per kilogram than any other fuel; the challenge is keeping a plasma hot, dense and held for long enough to make it pay.</p>`,
			notes: `<p>The gains are not measured the same way. JET's is the ratio of powers at one moment; NIF's compares energies over a few billionths of a second, against the laser energy delivered to the target. ITER's goal is stated by the ITER Organization (Q ≥ 10 for 300–500 s); its 2024 baseline schedule starts research operation in 2034 and deuterium–tritium operation in 2039. Your plasma's gain is the steady-state Q from the power-balance step, at the settings you left.</p>`
		}
	]
};
