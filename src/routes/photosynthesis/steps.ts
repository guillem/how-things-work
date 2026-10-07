import type { ExplainerSpec, Control } from '#lib/explainer/index.ts';

/** Light-intensity slider shared by the light-reaction steps. */
const light: Control = {
	type: 'range',
	id: 'light',
	label: 'Light intensity',
	min: 0,
	max: 100,
	step: 5,
	default: 70,
	unit: '%',
	help: 'More photons per second means faster electron flow — until the machinery saturates.'
};

export const spec: ExplainerSpec = {
	slug: 'photosynthesis',
	title: 'How photosynthesis works',
	summary:
		'Follow a photon from sunlight into a leaf and watch it split water, power an electron transport chain and build sugar out of thin air.',
	chapters: [
		{ id: 'overview', title: 'The big picture' },
		{ id: 'light', title: 'Light reactions' },
		{ id: 'calvin', title: 'Calvin cycle' },
		{ id: 'wrap', title: 'Putting it together' }
	],
	steps: [
		// ------------------------------------------------------------------ overview
		{
			id: 'equation',
			chapter: 'overview',
			title: 'Sunlight, water and air become sugar',
			scene: 'leaf',
			hints: { view: 'leaf' },
			duration: 16,
			body: `
<p>Photosynthesis is how plants, algae and cyanobacteria capture the energy of sunlight and store it in the chemical bonds of sugar. The overall recipe fits on one line:</p>
<p class="formula"><strong>6 CO<sub>2</sub> + 6 H<sub>2</sub>O + light → C<sub>6</sub>H<sub>12</sub>O<sub>6</sub> + 6 O<sub>2</sub></strong></p>
<p>Carbon dioxide from the air and water from the soil go in; glucose and oxygen come out. Almost every meal you eat and every breath you take traces back to this reaction.</p>
<p>The one-line version hides two very different machines. Let's zoom into a leaf and follow the energy.</p>`,
			notes: `<p>The equation is a summary, not a single reaction: dozens of enzymes and electron carriers are involved, and the oxygen released comes from the water, not from the carbon dioxide. Glucose itself is rarely the end product in the leaf — most of the fixed carbon leaves as sucrose or is stored as starch.</p>`
		},
		{
			id: 'leaf',
			chapter: 'overview',
			title: 'Inside the leaf',
			scene: 'leaf',
			hints: { view: 'section' },
			body: `
<p>A leaf is a solar panel with plumbing. Light enters through the transparent upper skin (the <dfn data-def="The outermost layer of cells of a leaf, usually coated with a waxy cuticle.">epidermis</dfn>) and reaches the <dfn data-def="The soft inner tissue of a leaf, packed with chloroplasts. The palisade layer is on top, the spongy layer below.">mesophyll</dfn> cells inside.</p>
<p>Carbon dioxide diffuses in through <dfn data-def="Microscopic pores, mostly on the underside of the leaf, each flanked by two guard cells that open and close it.">stomata</dfn>, tiny pores that open and close. Water arrives from the roots through the <dfn data-def="The water-conducting vessels of a plant, found in the veins of a leaf.">xylem</dfn> in the veins. Oxygen and water vapour leave through the same pores.</p>
<p>Each mesophyll cell holds dozens of green <dfn data-def="The organelle where photosynthesis happens. A typical leaf cell contains 20–100 of them.">chloroplasts</dfn>, and that is where the chemistry lives.</p>`
		},
		{
			id: 'chloroplast',
			chapter: 'overview',
			title: 'The chloroplast: two compartments, two jobs',
			scene: 'leaf',
			hints: { view: 'chloroplast' },
			body: `
<p>A chloroplast is wrapped in a double membrane. Inside, a fluid called the <dfn data-def="The fluid filling the chloroplast, rich in enzymes. The Calvin cycle runs here.">stroma</dfn> surrounds stacks of flattened sacs called <dfn data-def="Flattened membrane sacs inside the chloroplast; stacks of them are called grana. The light reactions happen in their membranes.">thylakoids</dfn>. Each thylakoid encloses its own tiny space, the <dfn data-def="The watery interior of a thylakoid. Protons accumulate here during the light reactions.">lumen</dfn>.</p>
<p>Photosynthesis is split between these two compartments:</p>
<ul>
<li><strong>Light reactions</strong> run in the thylakoid membrane. They use light to split water, release oxygen and charge up two energy carriers, <strong>ATP</strong> and <strong>NADPH</strong>.</li>
<li>The <strong>Calvin cycle</strong> runs in the stroma. It spends that ATP and NADPH to turn CO<sub>2</sub> into sugar.</li>
</ul>
<p>Neither half works without the other. We'll start with the light.</p>`
		},
		// ------------------------------------------------------------------ light
		{
			id: 'pigments',
			chapter: 'light',
			title: 'Why leaves are green',
			scene: 'spectrum',
			duration: 20,
			controls: [
				{
					type: 'range',
					id: 'wavelength',
					label: 'Wavelength of light',
					min: 400,
					max: 700,
					step: 5,
					default: 550,
					unit: ' nm',
					help: 'Drag across the spectrum to see how strongly the leaf pigments absorb each colour.'
				}
			],
			body: `
<p>Light arrives as <dfn data-def="A particle of light. Its energy is inversely proportional to its wavelength: blue photons carry more energy than red ones.">photons</dfn>, and a pigment molecule can only absorb a photon whose energy matches one of its electronic jumps.</p>
<p><strong>Chlorophyll <i>a</i></strong>, the main pigment, absorbs strongly in the blue-violet (around 430 nm) and the red (around 660 nm). <strong>Chlorophyll <i>b</i></strong> and the yellow-orange <strong>carotenoids</strong> widen the net a little. In between, green light (around 500–570 nm) is absorbed only weakly, so more of it is reflected or passed through than any other colour — which is why leaves look green.</p>
<p>Try sliding through the spectrum.</p>`,
			notes: `<p>The absorption peaks quoted are for chlorophyll in solvent; bound to proteins in the membrane, the red peak shifts by some 15–20 nm to around 675–680 nm (the reaction-centre pairs P680 and P700 are named after their absorption peaks in nm). An intact leaf still absorbs most of the green light that enters it, because the light is scattered back and forth through many layers of cells — but far less of it than red or blue. The classic evidence that red and blue light drive photosynthesis is Engelmann's 1882 experiment: oxygen-seeking bacteria crowded around the parts of an alga lit by red and blue light.</p>`
		},
		{
			id: 'antenna',
			chapter: 'light',
			title: 'Catching a photon',
			scene: 'membrane',
			hints: { focus: 'psii', phase: 'antenna' },
			controls: [light],
			body: `
<p>Among the protein complexes embedded in the thylakoid membrane are two light-driven ones, <strong>photosystem II</strong> and <strong>photosystem I</strong> (named in order of discovery, not of use). Each is surrounded by a <dfn data-def="Light-harvesting complexes: hundreds of chlorophyll and carotenoid molecules held by proteins, which funnel absorbed energy to the reaction centre.">light-harvesting antenna</dfn> of a few hundred pigment molecules.</p>
<p>When any antenna pigment absorbs a photon, one of its electrons jumps to a higher energy level. That excitation hops from pigment to pigment in trillionths of a second until it reaches the <dfn data-def="The protein–pigment core of a photosystem: a special pair of chlorophyll a molecules, which acts as the primary electron donor, together with the chain of electron acceptors beside it.">reaction centre</dfn>. At its heart sits a special pair of chlorophyll molecules — in photosystem II, called <strong>P680</strong>.</p>
<p>P680 is where light energy turns into electrical energy: the excited electron is pulled away from the pair and handed down the reaction centre's chain of acceptors.</p>`
		},
		{
			id: 'water',
			chapter: 'light',
			title: 'Splitting water',
			scene: 'membrane',
			hints: { focus: 'psii', phase: 'water' },
			controls: [light],
			body: `
<p>Having lost an electron, P680<sup>+</sup> is one of the strongest oxidising agents in biology — strong enough to steal electrons from water.</p>
<p>It does so through the <dfn data-def="A cluster of four manganese ions and one calcium ion (Mn₄CaO₅) on the lumen side of photosystem II, which binds two water molecules and strips four electrons from them.">oxygen-evolving complex</dfn>, a tiny cluster of manganese and calcium. After four photons have pulled four electrons out of the cluster, it in turn takes four electrons from two water molecules:</p>
<p class="formula"><strong>2 H<sub>2</sub>O → O<sub>2</sub> + 4 H<sup>+</sup> + 4 e<sup>−</sup></strong></p>
<p>The oxygen is a by-product: the plant uses some of it in its own respiration, and the surplus diffuses out through the stomata. The protons are released into the lumen, where they will matter later. The electrons replace the ones P680 keeps giving away.</p>`,
			notes: `<p>This reaction is the source of essentially all the oxygen in Earth's atmosphere. The manganese cluster cycles through five oxidation states (S<sub>0</sub>–S<sub>4</sub>), one step per photon, and releases O<sub>2</sub> only on the fourth.</p>`
		},
		{
			id: 'etc',
			chapter: 'light',
			title: 'The electron transport chain',
			scene: 'membrane',
			hints: { focus: 'etc', phase: 'etc' },
			controls: [light],
			body: `
<p>The electron leaving P680 is handed to <strong>plastoquinone</strong> (PQ), a small fat-soluble molecule that lives inside the membrane. PQ collects two electrons plus two protons from the stroma and drifts over to the <strong>cytochrome b<sub>6</sub>f</strong> complex.</p>
<p>Cytochrome b<sub>6</sub>f takes the electrons and releases the protons on the <em>other</em> side, into the lumen. Then it passes the electrons to <strong>plastocyanin</strong> (PC), a small copper-containing protein that ferries them along the lumen to photosystem I.</p>
<p>Each hand-off is downhill in energy, and the biggest drop — from plastoquinone through cytochrome b<sub>6</sub>f — is not simply lost as heat: it is used to move protons from the stroma into the lumen, charging the membrane like a battery being filled.</p>`,
			notes: `<p>Cytochrome b<sub>6</sub>f runs a “Q-cycle” that recycles one of the two electrons back into the plastoquinone pool, so that this step moves two protons into the lumen for every electron that passes through, rather than one. That raises the whole chain from two to three protons per electron — from 8 to 12 per O<sub>2</sub> released.</p>`
		},
		{
			id: 'psi',
			chapter: 'light',
			title: 'Photosystem I makes NADPH',
			scene: 'membrane',
			hints: { focus: 'psi', phase: 'psi' },
			controls: [light],
			body: `
<p>By the time an electron reaches <strong>photosystem I</strong> it has spent most of its energy. So the reaction centre here, <strong>P700</strong>, absorbs a second photon to kick it back up — higher than before.</p>
<p>The re-energised electron passes through a chlorophyll (A<sub>0</sub>), a phylloquinone (A<sub>1</sub>) and three iron–sulfur clusters to <strong>ferredoxin</strong>, a small protein on the stroma side. An enzyme then uses two such electrons to charge up the second energy carrier:</p>
<p class="formula"><strong>NADP<sup>+</sup> + H<sup>+</sup> + 2 e<sup>−</sup> → NADPH</strong></p>
<p>NADPH is “reducing power”: a portable pair of high-energy electrons that the Calvin cycle will use to turn CO<sub>2</sub> into sugar. Taking a proton from the stroma also deepens the gradient across the membrane.</p>`,
			notes: `<p>When the cell needs extra ATP, ferredoxin can send its electron back into the plastoquinone pool — and so through cytochrome b<sub>6</sub>f again — instead of to NADP<sup>+</sup>. This <em>cyclic electron flow</em> pumps more protons (more ATP) without producing NADPH.</p>`
		},
		{
			id: 'atp',
			chapter: 'light',
			title: 'ATP synthase: a turbine for protons',
			scene: 'membrane',
			hints: { focus: 'atp', phase: 'atp' },
			controls: [light],
			body: `
<p>Water splitting and cytochrome b<sub>6</sub>f keep pushing protons into the lumen, while NADPH formation removes them from the stroma. In bright light the lumen becomes roughly a thousand times more acidic than the stroma — a difference of about three pH units.</p>
<p>The main way back out is through <strong>ATP synthase</strong>, a molecular turbine. Protons flowing through it spin a rotor in the membrane; the rotor's shaft forces the enzyme's catalytic head through shape changes that snap ADP and phosphate together into <strong>ATP</strong>.</p>
<p>This is <dfn data-def="Peter Mitchell's 1961 hypothesis (Nobel Prize 1978): a proton gradient across a membrane drives ATP synthesis.">chemiosmosis</dfn>, and it is the same mechanism your mitochondria use. One full turn of the rotor makes three ATP.</p>`,
			notes: `<p>In spinach chloroplasts the rotor ring has 14 subunits, so one rotation lets 14 protons through and yields 3 ATP — about 4.7 protons per ATP. Together with NADPH, this ATP now carries the captured light energy into the stroma.</p>`
		},
		{
			id: 'zscheme',
			chapter: 'light',
			title: 'The Z-scheme: an electron’s energy',
			scene: 'zscheme',
			duration: 18,
			body: `
<p>Here is the same journey drawn as an energy diagram. The vertical axis is how much energy an electron has (more precisely, its <dfn data-def="A measure of how readily a molecule gives up electrons, in volts. Lower (more negative) means the electron is more energetic and easier to donate.">redox potential</dfn>, with high energy at the top).</p>
<p>An electron starts low in water, gets a photon's worth of lift at photosystem II, runs downhill through the transport chain (pumping protons on the way), gets a second lift at photosystem I, and ends up high enough to be stored in NADPH.</p>
<p>Two photons per electron; four electrons per oxygen molecule — so at least eight photons for every O<sub>2</sub> released. The zig-zag shape gave this picture its name: the Z-scheme.</p>`
		},
		// ------------------------------------------------------------------ calvin
		{
			id: 'rubisco',
			chapter: 'calvin',
			title: 'Carbon fixation: RuBisCO grabs CO₂',
			scene: 'calvin',
			hints: { phase: 'fixation' },
			controls: [
				{
					type: 'toggle',
					id: 'carbons',
					label: 'Count the carbons',
					default: true,
					help: 'Show each molecule as a chain of carbon atoms.'
				}
			],
			body: `
<p>Now to the stroma, where the Calvin cycle turns CO<sub>2</sub> into sugar in three stages. It starts with the most abundant enzyme on the planet — and one of the slowest: <strong>RuBisCO</strong>.</p>
<p>RuBisCO attaches a CO<sub>2</sub> molecule to a five-carbon sugar, <strong>RuBP</strong> (ribulose-1,5-bisphosphate). The six-carbon product is so unstable that it splits at once into two three-carbon molecules of <strong>3-PGA</strong> (3-phosphoglycerate).</p>
<p>That is <dfn data-def="Converting inorganic carbon (CO₂) into an organic molecule.">carbon fixation</dfn>: a carbon atom that was floating in the air is now part of a molecule a cell can use.</p>`,
			notes: `<p>RuBisCO fixes only about three CO<sub>2</sub> per second per active site, and about one time in four or five it grabs O<sub>2</sub> instead of CO<sub>2</sub>, starting a wasteful side path called photorespiration. Plants compensate by making enormous amounts of it — it can be half the soluble protein in a leaf, which makes it probably the most abundant protein on Earth — and C<sub>4</sub> and CAM plants evolved ways to feed it concentrated CO<sub>2</sub>.</p>`
		},
		{
			id: 'reduction',
			chapter: 'calvin',
			title: 'Reduction: spending ATP and NADPH',
			scene: 'calvin',
			hints: { phase: 'reduction' },
			body: `
<p>Each 3-PGA is first “primed” with a phosphate from <strong>ATP</strong>, then <dfn data-def="To add electrons to a molecule (here, as a hydride from NADPH). Reducing carbon to sugar stores energy; oxidising the sugar back to CO₂, as respiration does, releases it.">reduced</dfn> by <strong>NADPH</strong>, which donates its high-energy electrons. The result is <strong>G3P</strong> (glyceraldehyde-3-phosphate), a three-carbon sugar.</p>
<p>This is the moment the energy captured from light is locked into a carbon compound. The spent carriers — ADP, phosphate and NADP<sup>+</sup> — drift back to the thylakoids to be recharged.</p>
<p>For every three CO<sub>2</sub> fixed, six G3P are made. But the cycle cannot give all of them away.</p>`
		},
		{
			id: 'regeneration',
			chapter: 'calvin',
			title: 'Regeneration: keeping the cycle turning',
			scene: 'calvin',
			hints: { phase: 'regeneration' },
			body: `
<p>Only <strong>one</strong> of the six G3P leaves the cycle as product. The other five — fifteen carbon atoms — are shuffled through a series of enzymes and rebuilt into three molecules of five-carbon RuBP, ready to catch the next three CO<sub>2</sub>. This rearrangement costs three more ATP.</p>
<p>The carbon bookkeeping balances: 3 RuBP (15 C) + 3 CO<sub>2</sub> (3 C) = 6 G3P (18 C) = 1 G3P out (3 C) + 3 RuBP back (15 C).</p>
<p>For each G3P produced — three CO<sub>2</sub> fixed — the cycle consumes <strong>9 ATP and 6 NADPH</strong>. The “dark” reactions are not really dark: they run in daylight and stop within minutes without the light reactions feeding them.</p>`
		},
		{
			id: 'sugar',
			chapter: 'calvin',
			title: 'From G3P to glucose, sucrose and starch',
			scene: 'calvin',
			hints: { phase: 'export' },
			body: `
<p>Two G3P molecules join to form one six-carbon sugar, so a glucose costs two rounds of three CO<sub>2</sub> each: 6 CO<sub>2</sub>, 18 ATP and 12 NADPH.</p>
<p>In the leaf, little of it stays as free glucose. Some is linked into <strong>starch</strong> grains inside the chloroplast, a store that is broken down again at night. The rest is exported from the chloroplast and converted into <strong>sucrose</strong> — table sugar — which travels through the phloem to roots, fruits and growing tips.</p>
<p>There it becomes everything else: <strong>cellulose</strong> for cell walls, fats, amino acids, and the fuel for the plant's own respiration.</p>`
		},
		// ------------------------------------------------------------------ wrap
		{
			id: 'summary',
			chapter: 'wrap',
			title: 'The whole system at a glance',
			scene: 'summary',
			hints: { phase: 'system' },
			controls: [light],
			duration: 20,
			body: `
<p>Two machines, coupled by two shuttles. In the thylakoid membrane, light splits water, releases O<sub>2</sub> and charges ATP and NADPH. In the stroma, the Calvin cycle spends them to fix CO<sub>2</sub> into G3P, returning ADP, phosphate and NADP<sup>+</sup> to be recharged.</p>
<p>Turn the light down and watch the carriers run out: the Calvin cycle stalls within moments. Turn it up and the cycle speeds up — until RuBisCO and CO<sub>2</sub> supply become the bottleneck.</p>`
		},
		{
			id: 'bigpicture',
			chapter: 'wrap',
			title: 'Why it matters',
			scene: 'summary',
			hints: { phase: 'planet' },
			duration: 20,
			body: `
<p>Every year, photosynthesis on land and in the oceans fixes on the order of a hundred billion tonnes of carbon — roughly half of it by microscopic algae and cyanobacteria at sea. The oxygen in the air is the accumulated by-product, first released in bulk by cyanobacteria some 2.4 billion years ago.</p>
<p>It is not especially efficient: a crop field converts only about 1–2% of the sunlight energy falling on it into biomass, against a theoretical ceiling near 5%. But it runs on water, air and light, at ambient temperature, repairing itself continuously — and it feeds nearly every living thing on the planet.</p>
<p>Coal, oil and gas are its fossilised output. Understanding how it works is step one in doing better.</p>`,
			notes: `<p>Estimates of global net primary production are around 105 gigatonnes of carbon per year, split roughly evenly between land and ocean (Field et al., <i>Science</i>, 1998). The theoretical maximum efficiency of converting solar energy into biomass is about 4.6% for C<sub>3</sub> plants and 6% for C<sub>4</sub> plants (Zhu, Long &amp; Ort, 2008); real fields achieve a fraction of that.</p>`
		}
	]
};
