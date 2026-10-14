import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Ready-made quark combinations for the hadron builder (the palette on the stage does the rest). */
const preset: Control = {
	type: 'select',
	id: 'preset',
	label: 'Start from',
	default: 'proton',
	options: [
		{ value: 'proton', label: 'proton' },
		{ value: 'neutron', label: 'neutron' },
		{ value: 'delta', label: 'Δ⁺⁺' },
		{ value: 'lambda', label: 'Λ⁰' },
		{ value: 'omega', label: 'Ω⁻' },
		{ value: 'pion', label: 'π⁺' },
		{ value: 'kaon', label: 'K⁺' },
		{ value: 'charmonium', label: 'cc̄' },
		{ value: 'antiproton', label: 'antiproton' },
		{ value: 'custom', label: 'your own' }
	],
	help: 'Or build your own: tap a quark in the palette to add it, tap a quark in the bag to take it out.'
};

/** What the gluon scene shows. */
const strongView: Control = {
	type: 'select',
	id: 'strongView',
	label: 'Show',
	default: 'inside',
	options: [
		{ value: 'inside', label: 'Inside a proton' },
		{ value: 'pull', label: 'Pull a quark out' }
	]
};

/** Which moment of a process to show. */
const stage: Control = {
	type: 'select',
	id: 'stage',
	label: 'Moment',
	default: 'play',
	options: [
		{ value: 'play', label: 'Play it through' },
		{ value: '0', label: '1 · before' },
		{ value: '1', label: '2 · exchange' },
		{ value: '2', label: '3 · after' }
	],
	help: 'Pick a moment to stop at; the ledger under the diagram adds up everything present then.'
};

/** The process shown by the exchange diagram. */
const processControl: Control = {
	type: 'select',
	id: 'process',
	label: 'Process',
	default: 'beta',
	options: [
		{ value: 'beta', label: 'Neutron decay' },
		{ value: 'muon', label: 'Muon decay' },
		{ value: 'pion', label: 'Pion decay' },
		{ value: 'ee', label: 'Electrons repel' },
		{ value: 'gluon', label: 'Quarks swap colour' }
	]
};

/** Parent particle of the decay checker. */
const parent: Control = {
	type: 'select',
	id: 'parent',
	label: 'Particle that decays',
	default: 'n',
	options: [
		{ value: 'n', label: 'n' },
		{ value: 'mu-', label: 'μ⁻' },
		{ value: 'pi+', label: 'π⁺' },
		{ value: 'pi0', label: 'π⁰' },
		{ value: 'Lambda', label: 'Λ⁰' },
		{ value: 'K+', label: 'K⁺' },
		{ value: 'p', label: 'p' }
	],
	help: 'Each starts from its most common real decay (the proton from the decay physicists search for). Tap products to remove them; tap the palette to add.'
};

const resetDecay: Control = {
	type: 'action',
	id: 'resetDecay',
	label: 'Back to the real decay',
	action: 'Back to the real decay'
};

/** Which force the last table highlights. */
const force: Control = {
	type: 'select',
	id: 'force',
	label: 'Force',
	default: 'all',
	options: [
		{ value: 'all', label: 'All four' },
		{ value: 'strong', label: 'Strong' },
		{ value: 'em', label: 'Electromagnetic' },
		{ value: 'weak', label: 'Weak' },
		{ value: 'gravity', label: 'Gravity' }
	]
};

const PDG = `Particle masses, charges, spins and lifetimes on this page are from the Particle Data Group's <em>Review of Particle Physics</em>, 2026 edition (F. Takahashi et al., Int. J. Mod. Phys. A 41, 2630011 (2026); data CC BY 4.0), read from the PDG's database file.`;

export const spec: ExplainerSpec = {
	slug: 'standard-model',
	title: 'Particle physics and the Standard Model',
	summary:
		'Open up an atom down to its quarks, build protons, pions and stranger particles from quarks under the real charge and colour rules, step through beta decay as the exchange of a W boson, and test which decays nature allows.',
	chapters: [
		{ id: 'matter', title: 'What matter is made of' },
		{ id: 'hadrons', title: 'Building with quarks' },
		{ id: 'forces', title: 'Forces as exchanges' },
		{ id: 'rules', title: 'What can decay into what' },
		{ id: 'summary', title: 'Four forces, three carriers' }
	],
	steps: [
		// ------------------------------------------------------------------ matter
		{
			id: 'inside',
			chapter: 'matter',
			title: 'Inside the atom, and inside again',
			scene: 'zoom',
			duration: 18,
			body: `
<p>An atom is a cloud of electrons around a nucleus of protons and neutrons, as the <a href="../atoms-periodic-table/">atoms explainer</a> builds it. Zoom in further. The nucleus is tens of thousands of times smaller than the atom, and a proton is under a femtometre across (10<sup>−15</sup> m).</p>
<p>Inside a proton are three <dfn data-def="Elementary particles that make up protons, neutrons and the other hadrons. They come in six kinds (flavours) and are never found alone.">quarks</dfn>: two <strong>up</strong> quarks and one <strong>down</strong>. A neutron has one up and two down. As far as anyone can tell, quarks and electrons are not made of anything smaller: experiments see no size at all, down to less than a thousandth of a proton's width.</p>
<p>So everything you have ever touched is made of just <strong>three kinds of particle</strong>: up quarks, down quarks and electrons, held together by forces.</p>`,
			notes: `<p>The proton's charge radius is 0.8407 ± 0.0006 fm (PDG 2026). The best limit on a quark's size comes from electron–proton collisions at HERA: the ZEUS experiment found quarks smaller than 0.43 × 10<sup>−18</sup> m (2016). The panels are not to scale: drawn to scale, the proton would be a speck you could not see in the nucleus, and the nucleus a speck in the atom.</p>
<p>${PDG}</p>`
		},
		{
			id: 'seventeen',
			chapter: 'matter',
			title: 'The whole cast: 17 particles',
			scene: 'table',
			hints: { view: 'browse' },
			duration: 26,
			body: `
<p>The <dfn data-def="The theory of the elementary particles and three of the four known forces (strong, electromagnetic and weak), completed in the 1970s and confirmed by every experiment since, including the 2012 discovery of the Higgs boson.">Standard Model</dfn> needs only 17 particles. Tap any one to see its mass, charge, spin and how long it lives.</p>
<ul>
<li><strong class="tag sm-quark">Quarks</strong> (six) and <strong class="tag sm-lepton">leptons</strong> (six: the electron, its heavier cousins the muon and tau, and three <dfn data-def="Neutral leptons with a tiny mass that barely interact with anything; trillions pass through you every second, most of them from the Sun.">neutrinos</dfn>) are the matter particles. They come in three <dfn data-def="Copies of the same set of matter particles (two quarks, a charged lepton and a neutrino) with identical charges but larger masses.">generations</dfn>; only the first lasts, and it makes all ordinary matter.</li>
<li><strong class="tag sm-boson">Force carriers</strong> (four): the gluon, the photon, and the W and Z bosons.</li>
<li>The <strong class="tag sm-higgs">Higgs boson</strong>, the trace of the field that gives the W, the Z, the quarks and the charged leptons their masses.</li>
</ul>
<p>Each matter particle has a <dfn data-def="Every particle has an antiparticle with the same mass and opposite charge: the positron (e⁺) for the electron, the antiquark ū for the up quark. Some neutral particles, like the photon, are their own antiparticle.">antiparticle</dfn> with the opposite charge, not counted in the 17. <dfn data-def="An intrinsic amount of rotation a particle carries, measured in units of ħ. Matter particles have spin ½, force carriers spin 1, the Higgs spin 0. It decides how particles can combine and decay.">Spin</dfn> sorts them too: ½ for matter, 1 for the carriers, 0 for the Higgs.</p>`,
			notes: `<p>The count of 17 is a convention: it lists the W⁺ and W⁻ as one entry, the eight kinds of gluon (which differ only in their colours) as one, and leaves out the antiparticles. Counting every colour, charge and antiparticle separately gives 61.</p>
<p>Quark masses can't be weighed directly, because quarks never come out alone: they are inferred from the hadrons they make and depend on how they are defined. The values here are the PDG's: for u, d and s in the "MS-bar" scheme at 2 GeV, for c and b at their own mass, for t from direct measurements. Neutrinos have mass (they change flavour as they travel, which needs it), but nobody has measured it yet; the direct limit is below 0.45 eV, under a millionth of the electron's.</p>
<p>Masses are given as energies, using E = mc²: 1 MeV (a million electronvolts) is about 1.8 × 10<sup>−30</sup> kg. The proton weighs 938 MeV, the electron 0.511 MeV.</p>`
		},
		// ------------------------------------------------------------------ hadrons
		{
			id: 'proton',
			chapter: 'hadrons',
			title: 'Fractional charges that add up',
			scene: 'builder',
			hints: { focus: 'charge' },
			duration: 28,
			controls: [preset],
			body: `
<p>Quarks have charges that are fractions of the electron's: an up quark carries <strong>+⅔</strong>, a down quark <strong>−⅓</strong>. Add them up for the proton, up + up + down: ⅔ + ⅔ − ⅓ = <strong>+1</strong>. The neutron, up + down + down: ⅔ − ⅓ − ⅓ = <strong>0</strong>.</p>
<p>Swap a quark and see what you get: tap the d in the bag to take it out, then tap u in the palette. Three up quarks make the Δ⁺⁺, with a charge of +2. It exists, but lives only about 6 × 10<sup>−24</sup> s.</p>
<p>Particles built from quarks are called <dfn data-def="Any particle made of quarks held together by the strong force: baryons (three quarks), mesons (a quark and an antiquark) and a few rarer, larger combinations.">hadrons</dfn>; those of three quarks are <dfn data-def="A hadron made of three quarks, such as the proton and neutron. Each quark has baryon number ⅓, so a baryon has baryon number 1.">baryons</dfn>. Each quark counts ⅓ towards the <dfn data-def="A count that no process has ever been seen to change: +⅓ for each quark, −⅓ for each antiquark. The proton and neutron have 1, electrons and photons 0.">baryon number</dfn>, so every baryon has baryon number 1.</p>`,
			notes: `<p>The fractional charges were proposed in 1964 (Gell-Mann and Zweig) to explain the pattern of hadron masses and charges, and seen in 1968, when electrons fired at protons at SLAC bounced off hard, point-like parts inside. No experiment has found a free particle with a third of the electron's charge.</p>`
		},
		{
			id: 'colour',
			chapter: 'hadrons',
			title: 'Colour: only white things exist',
			scene: 'builder',
			hints: { focus: 'colour' },
			duration: 28,
			controls: [preset],
			body: `
<p>Why three quarks, and not two or four? Quarks carry a second kind of charge, called <dfn data-def="The charge of the strong force. It comes in three kinds, called red, green and blue (just names: nothing to do with real colours), and each antiquark carries an anticolour.">colour</dfn>, in three kinds named red, green and blue. The strong force allows only <strong>colourless</strong> combinations to exist on their own: one quark of each colour (red + green + blue, like the three primary colours of light making white), or a quark and an antiquark of a colour and its <em>anti</em>colour.</p>
<p>Try it. Take one quark out of the proton: two quarks can't be colourless, and the bag turns red. Try a quark and an antiquark (u and d̄): a colour and its anticolour, colourless again. That is a <dfn data-def="A hadron made of a quark and an antiquark, such as the pion (π) and the kaon (K). Its baryon number is ⅓ − ⅓ = 0.">meson</dfn>, here the pion π⁺.</p>
<p>And look at the charges: every colourless combination has a <strong>whole-number charge</strong>. The colour rule is why we never see ⅓ or ⅔ of a charge.</p>`,
			notes: `<p>The rule is that the number of quarks minus the number of antiquarks must be a multiple of three. The builder holds three at most, so it makes baryons, antibaryons and mesons, but the same rule allows four- and five-quark particles. Since 2003 experiments have found several (tetraquarks such as the Z<sub>c</sub>(3900), pentaquarks such as the P<sub>c</sub> states seen at CERN's LHCb in 2015).</p>
<p>Colour was invented partly because of the Δ⁺⁺ (uuu, spin 3/2): three identical quarks in the same state would break the Pauli exclusion principle, unless they differ in some hidden charge. They do: one is red, one green, one blue.</p>`
		},
		{
			id: 'gluons',
			chapter: 'hadrons',
			title: 'Gluons, the glue that never lets go',
			scene: 'gluon',
			duration: 24,
			controls: [strongView],
			body: `
<p>The quarks are held together by the <dfn data-def="The force between colour charges, carried by gluons. It binds quarks into hadrons, and (as a leftover effect) protons and neutrons into nuclei.">strong force</dfn>, carried by <dfn data-def="The carriers of the strong force: massless, spin 1, and (unlike photons) charged themselves: each carries a colour and an anticolour.">gluons</dfn>. Quarks swap gluons all the time, and each gluon carries a colour and an anticolour, so a swap <strong>changes the quarks' colours</strong>. Watch: the colours keep moving, but at every instant there is one red, one green and one blue.</p>
<p>Now pull a quark out. Unlike gravity or electric attraction, which weaken with distance, the pull between quarks <strong>does not weaken</strong>: the gluon field between them forms a narrow tube, and the energy stored in it grows with every bit of distance. Long before the quark is free, there is enough energy to make a new quark and antiquark (E = mc²). The tube snaps, and instead of a free quark you have two hadrons.</p>
<p>This is <dfn data-def="The fact that quarks and gluons are never seen alone, only inside colourless hadrons.">confinement</dfn>: no one has ever seen a single quark.</p>`,
			notes: `<p>The leftover of the strong force between the quarks of neighbouring protons and neutrons is what holds a nucleus together, against the electric repulsion of the protons (it is the nuclear force of the <a href="../radioactivity/">radioactivity explainer</a>).</p>
<p>The swap shown is a single gluon exchange between two quarks; in reality a proton is a seething mixture of gluons and short-lived quark–antiquark pairs as well as the three "valence" quarks that set its charge.</p>`
		},
		{
			id: 'mass',
			chapter: 'hadrons',
			title: 'Where a proton’s mass comes from',
			scene: 'builder',
			hints: { focus: 'mass' },
			duration: 26,
			controls: [preset],
			body: `
<p>Add up the masses of the proton's quarks: 2.16 + 2.16 + 4.70 = about <strong>9 MeV</strong>. The proton weighs <strong>938 MeV</strong>. The quarks' own masses are only about <strong>1%</strong> of it.</p>
<p>The other 99% is the energy of the gluon field and of the quarks moving in it, which counts as mass by E = mc². So most of the mass of you, and of everything around you, is the energy of the strong force at work inside protons and neutrons, not the mass of the particles they're made of.</p>
<p>Compare others with the presets or your own builds. The light quarks are a small part of every hadron made of them; the Ω⁻ (sss) gets about 17% from its strange quarks; the bottom quark is so heavy that a bb̄ meson (ηb) is almost 90% quark mass.</p>`,
			notes: `<p>The Higgs field gives the quarks their own masses, so it is responsible for that 1%, not for the mass of the proton. (It does matter: without the quark masses, a neutron would not be heavier than a proton, and atoms would be very different.)</p>
<p>The bars compare the quarks' masses as the PDG defines them (see the note on the table step) with the measured mass of the lightest hadron with those quarks.</p>`
		},
		{
			id: 'zoo',
			chapter: 'hadrons',
			title: 'The particle zoo',
			scene: 'builder',
			hints: { focus: 'zoo' },
			duration: 30,
			controls: [preset],
			body: `
<p>By the 1960s particle accelerators had turned up hundreds of hadrons, a "particle zoo". Quarks tidied it up: every one of them is a colourless combination of quarks. Build your own with all six flavours and their antiquarks. The stage names the lightest known hadron with those quarks, with its mass and lifetime from the PDG.</p>
<p>Some allowed combinations have never been seen (try ccc): the rules don't forbid them, but they are hard to make. And no combination with a <strong>top</strong> quark works: the top decays in about 5 × 10<sup>−25</sup> s, before the strong force has time to bind it.</p>
<p>All of them except the proton (and the antiproton) decay, most within a billionth of a second; a free neutron lasts about 15 minutes. Only protons and neutrons inside nuclei last.</p>`,
			notes: `<p>Quark content alone doesn't fix the particle: the same quarks can be bound with different spins or energies. uud is the proton but also the heavier Δ⁺; ud̄ is the π⁺ but also the ρ⁺; cc̄ is the η<sub>c</sub> and the famous J/ψ, whose discovery in 1974 confirmed the charm quark. The builder shows the lightest and names a sibling where there is a well-known one. uū and dd̄ are not separate particles: the π⁰ is a quantum mixture of the two.</p>
<p>The K⁰ and its antiparticle mix too, into a short-lived K<sub>S</sub> (8.95 × 10<sup>−11</sup> s) and a long-lived K<sub>L</sub> (5.12 × 10<sup>−8</sup> s).</p>`
		},
		// ------------------------------------------------------------------ forces
		{
			id: 'photon',
			chapter: 'forces',
			title: 'A force is an exchange',
			scene: 'process',
			hints: { process: 'ee' },
			duration: 24,
			controls: [stage],
			body: `
<p>In the Standard Model a force is not a pull acting across empty space. Particles <strong>exchange other particles</strong>, the force carriers. Two electrons repel each other by exchanging a <dfn data-def="The particle of light and of every electromagnetic wave, and the carrier of the electromagnetic force: massless, neutral, spin 1.">photon</dfn>: one emits it and recoils, the other absorbs it and is pushed away.</p>
<p>The drawing is a <dfn data-def="A drawing of a particle process as lines (particles) meeting at points (vertices), invented by Richard Feynman in 1948. Each one stands for a term in a calculation; the lines are not paths.">Feynman diagram</dfn>: time runs left to right, each line is a particle, and the particles meet at points called vertices. The lines are not paths through space; the diagram only records what turns into what.</p>
<p>The ledger below adds up everything present at the moment marked "now". Charge is the same at every moment: at each vertex, what comes in equals what goes out.</p>`,
			notes: `<p>The exchanged photon is <dfn data-def="A particle that exists only as an intermediate step in a process, between two vertices. It does not have the mass a free particle of that kind would have, and it can never be detected on its own.">virtual</dfn>: it does not travel like a free photon and can never be detected; it is a disturbance of the electromagnetic field passing momentum from one electron to the other. Quantum electrodynamics, the theory of these exchanges, predicts the electron's magnetic strength to better than one part in a billion, the most precisely tested prediction in science.</p>`
		},
		{
			id: 'beta',
			chapter: 'forces',
			title: 'Beta decay, one W at a time',
			scene: 'process',
			hints: { process: 'beta' },
			duration: 30,
			controls: [stage],
			body: `
<p>The <a href="../radioactivity/">radioactivity explainer</a> showed beta decay: a neutron turns into a proton, an electron and an antineutrino. Here is what happens inside, through the <dfn data-def="The force that can change one kind of quark or lepton into another; responsible for beta decay and for the fusion reactions in the Sun. Carried by the W and Z bosons.">weak force</dfn>.</p>
<ol>
<li>One of the neutron's <strong>down</strong> quarks turns into an <strong>up</strong> quark by emitting a <dfn data-def="A carrier of the weak force with charge +1 or −1 and a mass of 80.4 GeV, about 86 times a proton.">W⁻ boson</dfn>. The quarks are now u u d: a proton.</li>
<li>The W⁻ turns into an <strong>electron</strong> and an <strong>electron antineutrino</strong>.</li>
</ol>
<p>Step through the moments and watch the ledger. At every moment the charge is 0, the baryon number 1 and the electron number 0: the W⁻ carries the −1 charge from the quark to the electron, and the antineutrino (electron number −1) balances the electron (+1).</p>`,
			notes: `<p>The decay releases m(n) − m(p) − m(e) = 0.782 MeV (from PDG masses), shared between the electron and the antineutrino as motion. That is about a hundred thousand times too little to make a real W, which weighs 80.4 GeV: the W here is virtual. A particle that can only exist this briefly can't reach far, which is why the weak force acts only over about 10<sup>−18</sup> m and why beta decay is so slow.</p>`
		},
		{
			id: 'weak',
			chapter: 'forces',
			title: 'Why the weak force is weak',
			scene: 'clocks',
			duration: 24,
			body: `
<p>Compare how long particles live, grouped by the force that makes them decay. Decays through the strong force take 10<sup>−24</sup> to 10<sup>−22</sup> s; through electromagnetism, 10<sup>−20</sup> to 10<sup>−16</sup> s; through the weak force, anything from a tenth of a nanosecond to a quarter of an hour.</p>
<p>The weak force isn't feeble by nature. Its trouble is the mass of its carrier: a W boson weighs <strong>80.4 GeV</strong>, while a neutron's decay has only 0.78 MeV to spend. The heavier the carrier, the shorter its reach, ħ/(Mc): for the W about <strong>2.5 × 10<sup>−18</sup> m</strong>, a few hundred times less than a proton's radius. For two particles to interact this way they must almost touch, so it rarely happens, and decays take long.</p>
<p>The photon and gluon are massless, so electromagnetism reaches across the universe, and the strong force is only held in by confinement.</p>`,
			notes: `<p>At energies near the W's mass, as in the Large Hadron Collider, the weak force is as strong as electromagnetism: the two are aspects of one electroweak force, whose symmetry is hidden at low energy by the Higgs field (Glashow, Salam and Weinberg, Nobel Prize 1979). Particles heavy enough to make real W's decay through the weak force quickly: the top quark lives about 5 × 10<sup>−25</sup> s.</p>
<p>Lifetimes are PDG mean lives; for the Δ, φ and Σ⁰ they come from the measured width Γ as τ = ħ/Γ (the Δ's width is a PDG estimate).</p>`
		},
		{
			id: 'processes',
			chapter: 'forces',
			title: 'Pick a process',
			scene: 'process',
			hints: { process: 'param' },
			duration: 30,
			controls: [processControl, stage],
			body: `
<p>Every process in the Standard Model is made of the same kind of vertex: a matter particle emits or absorbs a force carrier. Pick one and step through it:</p>
<ul>
<li><strong>Muon decay</strong>: the muon becomes a muon neutrino by emitting a W⁻, which becomes an electron and an electron antineutrino. It takes 2.2 μs on average.</li>
<li><strong>Pion decay</strong>: the u and d̄ of a π⁺ annihilate into a W⁺, which becomes an antimuon and a muon neutrino (26 ns).</li>
<li><strong>Quarks swap colour</strong>: a red quark emits a red–antigreen gluon and turns green; a green quark absorbs it and turns red. The colour count in the ledger never changes.</li>
</ul>
<p>In each, the ledger shows the same totals at every moment. The carriers move charge, colour and lepton number from one particle to another; they never create or destroy them.</p>`
		},
		// ------------------------------------------------------------------ rules
		{
			id: 'conserve',
			chapter: 'rules',
			title: 'The books must balance',
			scene: 'decay',
			hints: { parent: 'n' },
			duration: 28,
			controls: [resetDecay],
			body: `
<p>Because every vertex conserves them, whole decays must too. Here is the neutron's decay checked against the <dfn data-def="Quantities that are the same before and after any process: energy, momentum, angular momentum, charge, and (in every process ever observed) baryon number and lepton number.">conservation laws</dfn>: charge, baryon number, the electron and muon lepton numbers, energy (the products must weigh less than the parent), and spin.</p>
<p>Now remove the antineutrino: tap ν̄e. Charge and baryon number still balance, but electron number doesn't (0 before, +1 after), and the spins can't add up (two spin-½ particles can't make the neutron's ½). This is how Wolfgang Pauli guessed, in 1930, that an unseen particle had to be there. The neutrino was detected 26 years later.</p>
`,
			notes: `<p>Lepton number counts +1 for each electron and electron neutrino, −1 for their antiparticles; the muon has its own count. The checker requires at least two products: a particle at rest can't turn into just one other particle and conserve both energy and momentum.</p>`
		},
		{
			id: 'forbidden',
			chapter: 'rules',
			title: 'Decays that never happen',
			scene: 'decay',
			hints: { parent: 'param' },
			duration: 30,
			controls: [parent, resetDecay],
			body: `
<p>Pick a particle and build decays. Real ones pass every check, and the PDG's measured share of decays appears. Some that fail:</p>
<ul>
<li><strong>A free proton</strong> can't beta-decay, p → n e⁺ νe: every charge balances, but the neutron is heavier than the proton, so there isn't the energy.</li>
<li><strong>Nor can it decay into lighter things</strong>: p → e⁺ π⁰ would break baryon number. Searches in a tank of 50,000 tonnes of water find that the proton, if it decays this way at all, lives more than <strong>2.4 × 10<sup>34</sup> years</strong>, 10<sup>24</sup> times the age of the universe.</li>
<li><strong>The muon</strong>: μ⁻ → e⁻ γ would turn muon number into electron number. It has never been seen: fewer than 1.5 in 10<sup>13</sup> muon decays, if any.</li>
</ul>
<p>Passing every check doesn't mean a decay happens. π⁰ → γγγ passes these laws, but another rule forbids it; Λ⁰ → p π⁻ passes, but changes <dfn data-def="Minus the number of strange quarks (plus the number of strange antiquarks). The strong and electromagnetic forces never change it; the weak force can.">strangeness</dfn>, which only the weak force can do, so the Λ⁰ lives a slow 2.6 × 10<sup>−10</sup> s.</p>`,
			notes: `<p>Inside some nuclei a proton <em>can</em> turn into a neutron (beta-plus decay), because the nucleus as a whole supplies the energy.</p>
<p>Limits from the PDG 2026 tables: τ/B(p → e⁺π⁰) > 2.4 × 10<sup>34</sup> years (Super-Kamiokande); B(μ⁻ → e⁻γ) < 1.5 × 10<sup>−13</sup> (MEG II). π⁰ → 3γ is forbidden by charge-conjugation symmetry (C-parity), which electromagnetism respects: B < 3.1 × 10<sup>−8</sup>.</p>
<p>The separate electron, muon and tau numbers hold in every decay seen, but not exactly: neutrinos change flavour as they travel (oscillations), so only the total lepton number is believed to be conserved. Many theories that unify the forces predict that the proton does decay, extremely slowly.</p>`
		},
		// ------------------------------------------------------------------ summary
		{
			id: 'four-forces',
			chapter: 'summary',
			title: 'Four forces, three carried by particles',
			scene: 'table',
			hints: { view: 'forces' },
			duration: 30,
			controls: [force],
			body: `
<p>Pick a force to see which particles feel it and which particle carries it.</p>
<ul>
<li><strong>Strong</strong>: carried by gluons, felt by quarks (and gluons themselves). It binds quarks into hadrons and nuclei.</li>
<li><strong>Electromagnetic</strong>: carried by photons, felt by everything with charge. It holds atoms and molecules together.</li>
<li><strong>Weak</strong>: carried by the W and Z, felt by every matter particle, even neutrinos. It changes one kind of particle into another.</li>
<li><strong>Gravity</strong>: felt by everything, but the Standard Model has <strong>no particle that carries it</strong>. It is described by Einstein's general relativity; a carrier (the graviton) is a hypothesis.</li>
</ul>
<p>That is the Standard Model: <strong>all ordinary matter is made of a few kinds of particle, and three of the four known forces arise from exchanging other particles.</strong></p>`,
			notes: `<p>What the Standard Model leaves out: gravity, the dark matter that outweighs ordinary matter about five to one, why there is far more matter than antimatter, and why neutrinos have mass. It is not wrong, but it is not the whole story.</p>`
		}
	]
};
