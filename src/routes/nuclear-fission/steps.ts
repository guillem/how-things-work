import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Fires the neutron again. */
const fire: Control = {
	type: 'action',
	id: 'fire',
	label: 'Neutron',
	action: 'Fire a neutron',
	help: 'Plays the split again from the start.'
};

/** Which of the many possible splits is shown. */
const split: Control = {
	type: 'select',
	id: 'split',
	label: 'How it splits',
	default: 'bakr',
	options: [
		{ value: 'bakr', label: 'Barium + krypton' },
		{ value: 'xesr', label: 'Xenon + strontium' },
		{ value: 'csrb', label: 'Caesium + rubidium' }
	],
	help: 'Three of the hundreds of ways a uranium nucleus can split. Masses: AME2020.'
};

/** Multiplication factor of the chain. */
const kFactor: Control = {
	type: 'range',
	id: 'k',
	label: 'New fissions per fission (k)',
	min: 0.9,
	max: 1.1,
	step: 0.01,
	default: 1,
	format: (v) => v.toFixed(2),
	help: 'Below 1 the chain dies away, above 1 it grows.'
};

/** Water around the fuel, on or off (moderator step). */
const moderator: Control = {
	type: 'toggle',
	id: 'moderator',
	label: 'Water around the fuel',
	default: true,
	help: 'Without it, neutrons stay fast.'
};

/** U-235 share of the fuel. */
const enrichment: Control = {
	type: 'range',
	id: 'enrichment',
	label: 'Uranium-235 in the fuel',
	min: 0.7,
	max: 5,
	step: 0.1,
	default: 4,
	format: (v) => `${v.toFixed(1)}%`,
	help: 'Natural uranium has 0.7%; power reactors use 3–5%.'
};

/** Water in the core, relative to the design. */
const water: Control = {
	type: 'range',
	id: 'water',
	label: 'Water in the core',
	min: 0,
	max: 500,
	step: 1,
	default: 100,
	format: (v) => `${Math.round(v)}%`,
	help: '100% is the design amount, about 2 litres of water per litre of fuel.'
};

/** Control-rod insertion. */
const rods: Control = {
	type: 'range',
	id: 'rods',
	label: 'Control rods in',
	min: 0,
	max: 100,
	step: 0.1,
	default: 50,
	format: (v) => `${v.toFixed(1)}%`,
	help: 'Use the arrow keys for fine steps.'
};

/** Delayed neutrons on or off (a thought experiment). */
const delayed: Control = {
	type: 'toggle',
	id: 'delayed',
	label: 'Delayed neutrons',
	default: true,
	help: 'Off: what the reactor would do if every neutron came out at once.'
};

/** The operating bank of rods. */
const bank: Control = {
	type: 'range',
	id: 'bank',
	label: 'Control rods in',
	min: 0,
	max: 100,
	step: 1,
	default: 50,
	format: (v) => `${Math.round(v)}%`,
	help: 'Critical at 50%. Their full travel is worth less than the delayed neutrons.'
};

const scram: Control = {
	type: 'action',
	id: 'scram',
	label: 'Shut down',
	action: 'Scram: drop all rods',
	help: 'Every rod falls into the core.'
};

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'Restart',
	action: 'Start again at 100%',
	help: 'A fresh run, at full power with the rods at 50%.'
};

export const spec: ExplainerSpec = {
	slug: 'nuclear-fission',
	title: 'Nuclear fission',
	summary:
		'Fire a neutron at a uranium-235 nucleus and watch it split, read where the energy comes from on the curve of binding energy, then run a reactor core: set the fuel, the water and the control rods to hold the chain reaction at exactly one new fission per fission.',
	chapters: [
		{ id: 'split', title: 'Splitting a nucleus' },
		{ id: 'chain', title: 'A chain reaction' },
		{ id: 'core', title: 'Inside a reactor core' },
		{ id: 'control', title: 'Holding it steady' }
	],
	steps: [
		// ------------------------------------------------------------------ split
		{
			id: 'fire',
			chapter: 'split',
			title: 'A neutron splits a uranium nucleus',
			scene: 'nucleus',
			duration: 16,
			controls: [fire, split],
			body: `
<p>A slow <dfn data-def="A particle of the nucleus with no electric charge and about the mass of a proton.">neutron</dfn> drifts into a nucleus of <strong>uranium-235</strong>: 92 protons and 143 neutrons. Having no charge, it is not pushed away, and the nucleus swallows it. It is now uranium-236, with energy to spare, and it starts to wobble.</p>
<p>That energy comes not from the neutron's speed but from its being bound into the nucleus: about 6.5 <dfn data-def="A million electronvolts, the energy unit of nuclear physics; a chemical bond holds a few eV.">MeV</dfn>, enough to set uranium-236 splitting. When uranium-238 swallows a slow neutron it gains less, too little to split.</p>
<p>The wobble stretches it into a dumbbell. The two ends, each full of protons, push each other apart electrically, and the nucleus <strong>splits in two</strong>: this is <dfn data-def="The splitting of a heavy nucleus into two lighter ones, releasing energy and a few neutrons.">nuclear fission</dfn>. The two <dfn data-def="The two lighter nuclei a fission leaves behind. They are radioactive, with too many neutrons.">fission fragments</dfn> fly apart at a few percent of the speed of light, and two or three new neutrons are set free.</p>
<p>Press <em>Fire a neutron</em> and pick how it splits. Each split is different: there are hundreds of possible pairs of fragments, always one lighter and one heavier.</p>`,
			notes: `<p>The fragments are radioactive: they have the neutron-to-proton ratio of uranium, far too many neutrons for nuclei their size. Each then goes through a chain of <a href="../radioactivity/#beta">beta decays</a>, turning neutrons into protons, until it reaches a stable nucleus: barium-141 ends as praseodymium-141, krypton-92 as zirconium-92. Uranium-235 also decays on its own, very slowly (half-life 704 million years, NNDC NuDat); a neutron makes it split almost at once.</p>`
		},
		{
			id: 'binding',
			chapter: 'split',
			title: 'Why splitting releases energy',
			scene: 'curve',
			hints: { view: 'binding' },
			duration: 18,
			body: `
<p>Protons and neutrons are held in a nucleus by the strong force. Pulling a nucleus fully apart takes energy: its <dfn data-def="The energy needed to pull a nucleus apart into separate protons and neutrons. The larger it is per particle, the more tightly the nucleus is held together.">binding energy</dfn>. The curve shows it per particle (per <dfn data-def="A proton or a neutron.">nucleon</dfn>) for every mass number, from measured masses.</p>
<p>It rises steeply among the light nuclei, peaks around <strong>iron and nickel</strong> at about 8.8 MeV per nucleon, and then falls slowly: big nuclei hold their particles less tightly, because the repulsion between their many protons reaches across the whole nucleus while the strong force only grips neighbours. That is why <a href="../stars/#collapse">stars stop at iron</a>.</p>
<p>Uranium-235 sits at <strong>7.59 MeV</strong> per nucleon. Its fragments, about half its size, sit at <strong>8.3 to 8.6</strong>. Splitting lifts the nucleons that stay in the fragments up the curve by about 0.8 MeV each: some 170–185 MeV at once, and about 200 MeV once the fragments have decayed to stable nuclei, which sit higher still.</p>`,
			notes: `<p>The curve plots, for each mass number A, the most tightly bound nucleus, using the 2020 Atomic Mass Evaluation (AME2020, W.J. Huang et al. and M. Wang et al., Chinese Physics C 45, 030002–3, 2021). The very top is nickel-62 at 8.795 MeV per nucleon, just above iron-58 (8.792) and iron-56 (8.790). Light nuclei release energy by joining, which is fusion, the energy source of stars; heavy nuclei by splitting. An MeV (a million electronvolts) is the energy unit of nuclear physics; a chemical bond holds a few eV.</p>`
		},
		{
			id: 'energy',
			chapter: 'split',
			title: 'Where the 200 MeV goes',
			scene: 'curve',
			hints: { view: 'budget' },
			duration: 20,
			controls: [split],
			body: `
<p>Weigh everything before and after: the fragments and neutrons weigh slightly less than the uranium and the neutron that hit it, by about <strong>0.09%</strong>. That missing mass is the energy released, by E = mc², the same rule that makes most of a proton's mass <a href="../standard-model/#mass">the energy of its quarks and gluons in motion</a>.</p>
<p>Most of it, about 170 to 185 MeV depending on the split, comes out at once, mostly as the speed of the two fragments, which crash into the surrounding fuel within a hundredth of a millimetre and heat it. The rest comes later, as the fragments <a href="../radioactivity/#beta">beta-decay</a>. Part of that escapes as antineutrinos, but the spare neutrons add some back when they are absorbed. On average about <strong>200 MeV of heat</strong> stays in the reactor per fission.</p>
<p>That is some 20 million times what burning one molecule of natural gas gives. A kilogram of uranium-235, fully split, gives as much heat as about <strong>1.5 million kilograms</strong> of gas.</p>`,
			notes: `<p>The bars use the AME2020 masses of the split you choose, first for the fragments as they fly apart, then for the stable nuclei they decay into. The average over all splits and the share of the antineutrinos (9.1 MeV) and of neutron captures (8.6 MeV) are from X.B. Ma et al., Phys. Rev. C 88, 014605 (2013), which gives 202.4 MeV of heat per fission of uranium-235. Methane's heat of combustion is 890.7 kJ per mole (NIST Chemistry WebBook), about 9.2 eV per molecule.</p>`
		},
		// ------------------------------------------------------------------ chain
		{
			id: 'chain',
			chapter: 'chain',
			title: 'Neutrons that split more nuclei',
			scene: 'chain',
			hints: { view: 'tree', k: 1 },
			duration: 18,
			body: `
<p>Each fission frees two or three neutrons, <strong>2.43 on average</strong>. If one of them goes on to split another uranium-235 nucleus, that fission frees more, and so on: a <dfn data-def="A process in which each event triggers further events of the same kind.">chain reaction</dfn>. The tree follows a chain for a few generations.</p>
<p>Most neutrons never split anything. In reactor fuel, some are <strong class="tag nf-captured">captured</strong>: swallowed by a nucleus that does not split, mostly uranium-238, the absorbers of the control rods, and sometimes uranium-235 itself. A few, in a large core, <strong class="tag nf-escaped">escape</strong> from it (none in this short run). Only the <strong class="tag nf-fission">ones that split</strong> a nucleus carry the chain on.</p>
<p>This tree is drawn for a chain in which, of the 2.43 neutrons per fission, on average exactly one causes a new fission. Count them in the box: about one new fission per fission, a little more or less by chance in so short a run. The chain neither dies nor grows.</p>`,
			notes: `<p>The number of neutrons per fission of uranium-235 by a slow neutron is ν̄ = 2.425 (IAEA neutron standards 2017). Any one fission frees anywhere from none to about seven; this page draws two or three, with the right average. The time between one generation and the next in a power reactor is about a ten-thousandth of a second: a neutron spends it slowing down and wandering until it is absorbed.</p>`
		},
		{
			id: 'k',
			chapter: 'chain',
			title: 'k: below 1, exactly 1, above 1',
			scene: 'chain',
			hints: { view: 'k' },
			duration: 22,
			controls: [kFactor],
			body: `
<p>The number that matters is the <dfn data-def="The average number of new fissions caused by the neutrons of one fission; equivalently, neutrons in one generation per neutron in the one before.">multiplication factor</dfn> <strong>k</strong>: how many new fissions, on average, each fission leads to. The plot follows 1,000 neutrons for 40 generations.</p>
<ul>
<li><strong>k below 1</strong>: <dfn data-def="A chain reaction that dies away: k less than 1.">subcritical</dfn>. Each generation is smaller than the last; at 0.9 the chain is nearly gone after 40.</li>
<li><strong>k = 1</strong>: <dfn data-def="A chain reaction that keeps itself going at a constant rate: k exactly 1. In reactors “critical” means steady, not dangerous.">critical</dfn>. The count holds steady, like a reactor running at constant power.</li>
<li><strong>k above 1</strong>: <dfn data-def="A chain reaction that grows: k greater than 1.">supercritical</dfn>. Each generation is bigger; at 1.1 the count has grown 45 times after 40 generations.</li>
</ul>
<p>Move k a little either side of 1. A reactor is this chain held at exactly one new fission per fission. The count at k = 1 still wobbles, because 1,000 neutrons is a small number. A real core holds billions of billions, and as with <a href="../radioactivity/#many">radioactive decay</a>, the wobble vanishes.</p>`
		},
		// ------------------------------------------------------------------ core
		{
			id: 'moderator',
			chapter: 'core',
			title: 'Slow neutrons split uranium-235',
			scene: 'core',
			hints: { view: 'slow' },
			duration: 20,
			controls: [moderator],
			body: `
<p>Fission neutrons are born fast, at about 2 MeV, some 20,000 km per second. A fast neutron rarely splits uranium-235. A slow one, moving at about 2 km a second (0.025 eV, the jostling speed of its warm surroundings), is <strong>hundreds of times more likely</strong> to: it lingers near each nucleus long enough to be caught.</p>
<p>So power reactors surround the fuel with a <dfn data-def="A material that slows neutrons down by letting them bounce off its light nuclei, without absorbing many of them.">moderator</dfn>, most often ordinary water. A neutron that hits a hydrogen nucleus, a single proton of nearly its own mass, can lose most of its speed in one bounce, like a billiard ball hitting another. In about <strong>20 collisions</strong> it is slowed from 2 MeV to 0.025 eV.</p>
<p>Switch the water off: the neutron stays fast, and in fuel with only a few percent of uranium-235 the chain cannot continue.</p>`,
			notes: `<p>The likelihood of a reaction is measured as a cross section, an effective target area in barns (10⁻²⁴ cm²). For a slow neutron, uranium-235's fission cross section is 587 barns (IAEA neutron standards 2017); for a fast one it is of the order of 1 barn. Each collision with a nucleus of mass A takes away on average a fixed share of the neutron's energy, measured by ξ (the mean logarithmic energy loss): ξ = 1 for hydrogen, 0.93 for water, 0.16 for carbon. The number of collisions is ln(2 MeV / 0.025 eV) / ξ: 20 in water, 115 in graphite, which is a moderator too but needs more room.</p>`
		},
		{
			id: 'fuel',
			chapter: 'core',
			title: 'Enriched fuel',
			scene: 'core',
			hints: { view: 'fuel' },
			duration: 20,
			controls: [enrichment],
			body: `
<p>Natural uranium is 99.3% <strong>uranium-238</strong>, which slow neutrons do not split, and only <strong>0.7% uranium-235</strong>. The uranium-238 still captures neutrons, and so does the hydrogen of the water: with natural uranium in water, too few neutrons are left to keep the chain going.</p>
<p>So the fuel is <dfn data-def="Uranium whose share of uranium-235 has been raised above the natural 0.7%.">enriched</dfn> to <strong>3 to 5%</strong> uranium-235, pressed into ceramic pellets of uranium oxide and stacked in metal tubes: the fuel rods. Slide the enrichment and watch k. At 0.7% it stays well below 1, even with the rods pulled out (on the next step), and no amount of water changes that; at 4%, with the control rods half in, it is exactly critical.</p>
<p>The rods themselves are the next step. Their job is to soak up the neutrons a fresh core has to spare.</p>`,
			notes: `<p>Power-reactor fuel is enriched to between about 3.5 and 5% (World Nuclear Association). Reactors moderated by heavy water (CANDU) or graphite, which absorb far fewer neutrons than ordinary water, can run on natural uranium. The bars under k are the classic <dfn data-def="k = η ε p f × (share that does not leak out): neutrons per absorption in fuel, extra from fast fission, share escaping capture while slowing down, share of slow neutrons absorbed in the fuel.">four-factor formula</dfn>, worked out for a typical pressurized-water lattice from measured cross sections (see the last step's notes).</p>`
		},
		{
			id: 'core',
			chapter: 'core',
			title: 'Run the core: hold k at 1',
			scene: 'core',
			hints: { view: 'full' },
			duration: 30,
			controls: [enrichment, water, rods],
			body: `
<p>Here is the whole core: fuel rods in water, and <dfn data-def="Rods of a neutron-absorbing material (such as boron or silver–indium–cadmium) that slide in between the fuel rods. In: fewer neutrons, less fission.">control rods</dfn> that slide in from above. The rods are full of a material that swallows neutrons, so the deeper they go, the fewer neutrons are left to split uranium.</p>
<p>Pull the rods out a little: k rises above 1 and the plot shows the neutrons multiplying, generation after generation. Push them in: k drops below 1 and the chain fades. Then change the fuel or the water and find where the rods hold k at <strong>1.000</strong> again.</p>
<p>This is the whole art of running a reactor: just enough absorbers that, of the 2.43 neutrons of every fission, exactly one goes on to split another nucleus.</p>`,
			notes: `<p>A fresh core has neutrons to spare (here k would be 1.41 with the rods fully out), because its fuel has to last a year or more while uranium-235 is used up and fission products that also absorb neutrons build up. Real reactors hold that excess with rods, boron dissolved in the water and burnable absorbers in the fuel; on this page the rods stand for all three, with a strength chosen so that the design core is critical with them half in. A neutron's chance of escaping the core is also fixed here (3%), as for a large core.</p>`
		},
		{
			id: 'void',
			chapter: 'core',
			title: 'Losing water stops the chain',
			scene: 'core',
			hints: { view: 'void' },
			duration: 24,
			controls: [water],
			body: `
<p>A water-cooled reactor is designed with <em>less</em> water than would give the most fissions. So if the water heats up and expands, or boils into steam bubbles, fewer neutrons are slowed down, more are captured by uranium-238 on the way, and <strong>k falls</strong>. Slide the water down from 100% and watch it.</p>
<p>That makes the reactor steady itself: more power heats the water, which lowers k, which lowers the power. And if the water were lost altogether, the chain would stop, because there would be nothing left to slow the neutrons. (With no water this model counts every neutron as lost and shows k = 0; in reality a dry core's k is far below 1, but not zero.)</p>
<p>Push the water up instead: k rises up to about 300%, then levels off and falls by 500%, as the extra water starts absorbing more neutrons than it saves.</p>`,
			notes: `<p>This is the negative <dfn data-def="How k changes when steam bubbles (voids) replace water in the core.">void coefficient</dfn> of water-moderated reactors. The Chernobyl reactor (an RBMK) was moderated by graphite and only cooled by water; losing water there removed an absorber but kept the moderator, so k <em>rose</em>, which, with a flawed shutdown-rod design and a test run outside the rules, led to the 1986 accident. Regulators now require the overall power feedback to be negative; CANDU reactors, for example, have a small positive void coefficient and rely on fast, independent shutdown systems. Losing the water still leaves the decay heat to remove (last step).</p>`
		},
		// ------------------------------------------------------------------ control
		{
			id: 'delayed',
			chapter: 'control',
			title: 'Delayed neutrons buy time',
			scene: 'kinetics',
			hints: { view: 'delayed' },
			duration: 22,
			controls: [delayed],
			body: `
<p>A generation lasts about a ten-thousandth of a second. At k = 1.001, just 0.1% above critical, the neutrons would multiply by e (2.7) every tenth of a second, and by about 22,000 every second. No mechanism could steer that.</p>
<p>What saves the day: not all neutrons come out at once. About <strong>0.65%</strong> of them (β = 0.0065) are <dfn data-def="Neutrons released from a fraction of a second to a few minutes after the fission, by the radioactive decay of some fission fragments.">delayed neutrons</dfn>, given off by some fragments when they decay, a fraction of a second to about a minute after the fission. Below k = 1 + β, the chain can only grow as fast as those late neutrons arrive.</p>
<p>With the same 0.1% step, the power now rises by e about every <strong>55 seconds</strong>, slow enough for the controls and the reactor's own feedback to follow. Switch the delayed neutrons off to see the difference.</p>`,
			notes: `<p>The delayed neutrons come in six groups with half-lives from 0.23 to 55.7 s (G.R. Keepin, 1965). The power follows the point-kinetics equations: the neutron population, plus six populations of delayed-neutron precursors that decay at their own rates. The growth they settle into is given by the inhour equation. A reactor kept below “prompt critical” (k = 1 + β) is always controlled by the delayed neutrons, which is why the worth and speed of the control rods are limited.</p>`
		},
		{
			id: 'operate',
			chapter: 'control',
			title: 'Steering the power',
			scene: 'kinetics',
			hints: { view: 'operate' },
			duration: 40,
			controls: [bank, scram, restart],
			body: `
<p>Now you are at the controls of a 3 GW reactor running at full power with its rods at 50%. Move them a few percent: the power drifts up or down over tens of seconds. Can you bring it back and hold it at 100%?</p>
<p>The rods on this slider are worth less than the delayed neutrons from end to end, as real control rods are limited to be, so even pulling them all the way out only makes the power grow over seconds. And if it climbs past 118%, the protection system drops every rod by itself: an automatic trip.</p>
<p>Press <em>Scram</em>: every rod drops in, the chain stops at once and the power falls below a tenth within a second, and to a few percent within ten seconds. It does not drop to zero: the delayed neutrons still trickle out for a minute or two, and the fragments keep decaying. The readout shows the fission power only; that decay heat comes on top (last step).</p>`,
			notes: `<p>The equations are the point-kinetics model with six groups of delayed neutrons and a prompt generation time of 10⁻⁴ s. Real reactors add their own feedback: hotter fuel captures more neutrons in uranium-238 (the Doppler effect) and warmer water slows fewer, so a power rise lowers k by itself. This page leaves that out so that you can see the chain's own behaviour, which is why holding the power exactly steady takes a careful hand.</p>`
		},
		{
			id: 'heat',
			chapter: 'control',
			title: 'A power plant, and the heat after shutdown',
			scene: 'kinetics',
			hints: { view: 'decay' },
			duration: 24,
			body: `
<p>A large reactor makes about <strong>3 GW of heat</strong>, which boils water into steam to turn a turbine. As in any heat engine, only about a third becomes electricity: about <strong>1 GW</strong>, enough for a city. To do it, it splits about 10<sup>20</sup> nuclei every second: some <strong>3 kg of fissile nuclei a day</strong>, mostly uranium-235 (later in the fuel's life also plutonium made from uranium-238).</p>
<p>After a shutdown the chain stops, but the fission fragments in the fuel are still radioactive. Right after the scram their <dfn data-def="Heat released by the radioactive decay of fission products after the chain reaction has stopped.">decay heat</dfn> is about <strong>6–7%</strong> of full power, some 200 MW, and it falls only slowly: about 1 to 1.5% after an hour, still about 0.4% after a day. The simple formula plotted here gives the lower values, 6% (180 MW) and 1%.</p>
<p>That is why a reactor must be cooled for days after it stops. At Fukushima in 2011 the reactors shut down as designed, but the earthquake cut the grid supply and the tsunami flooded the emergency generators, so the cooling pumps stopped, and the decay heat alone melted the fuel.</p>`,
			notes: `<p>The decay-heat curve is the Way–Wigner approximation, P/P₀ = 0.0622 [t<sup>−0.2</sup> − (t + T)<sup>−0.2</sup>], for a reactor that ran for a year (Glasstone and Sesonske, Nuclear Reactor Engineering); detailed standards (ANS-5.1) agree to within some tens of percent. For scale: a Westinghouse AP1000, such as Vogtle 3 and 4 in the US, gives 1,117 MW of electricity from about 3,400 MW of heat. The core model on this page uses measured thermal cross sections (IAEA standards 2017 for uranium-235; V.F. Sears 1992 for uranium-238, hydrogen and oxygen), Hellstrand's resonance-integral correlation for oxide fuel, and representative lattice values (oxide at 10.4 g/cm³, pellets 8.2 mm across, water at 0.72 g/cm³, two volumes of water per volume of fuel, fast-fission factor 1.03); it is a homogenised textbook model, not a design calculation.</p>`
		}
	]
};
