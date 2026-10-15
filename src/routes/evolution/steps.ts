import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const fmtCount = (v: number) => v.toLocaleString('en-GB');

/** Mutation rate per gene per generation, as "1 in …". */
export const fmtRate = (v: number) => (v === 0 ? 'none' : `1 in ${fmtCount(Math.round(1 / v))}`);

const environment: Control = {
	type: 'select',
	id: 'env',
	label: 'Environment',
	default: 'sooty',
	options: [
		{ value: 'sooty', label: 'Birds, sooty bark' },
		{ value: 'pale', label: 'Birds, pale bark' },
		{ value: 'none', label: 'No birds' }
	]
};

const predation: Control = {
	type: 'range',
	id: 'predation',
	label: 'How hard the birds hunt',
	min: 0,
	max: 0.8,
	step: 0.05,
	default: 0.5,
	format: (v) => `${Math.round(v * 100)}%`,
	help: 'The extra chance that a moth of the opposite shade to the bark is eaten, compared with one that matches it.'
};

const mutation: Control = {
	type: 'range',
	id: 'mu',
	label: 'Mutation rate (per gene, per generation)',
	min: 0,
	max: 0.01,
	default: 0.001,
	values: () => [0, 0.0001, 0.001, 0.01],
	format: fmtRate,
	help: 'The chance that a gene changes when it is passed on. Real genes mutate far more rarely, about 1 in 100,000 or less.'
};

const population: Control = {
	type: 'range',
	id: 'N',
	label: 'Population size',
	min: 20,
	max: 2000,
	default: 500,
	values: () => [20, 50, 100, 200, 500, 1000, 2000],
	format: (v) => `${fmtCount(v)} moths`
};

const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Run again',
	action: 'Run again',
	help: 'Same settings, different luck: who is eaten, who mates and which genes mutate are random.'
};

const switches: Control[] = [
	{
		type: 'toggle',
		id: 'variation',
		label: 'Variation (moths differ, genes mutate)',
		default: true
	},
	{
		type: 'toggle',
		id: 'inheritance',
		label: 'Inheritance (offspring get their parents’ genes)',
		default: true
	},
	{
		type: 'toggle',
		id: 'selection',
		label: 'Unequal survival (birds see some moths better)',
		default: true
	}
];

const lineSize: Control = {
	type: 'range',
	id: 'lineN',
	label: 'Population size',
	min: 10,
	max: 1000,
	default: 50,
	values: () => [10, 20, 50, 100, 200, 500, 1000],
	format: (v) => `${fmtCount(v)} individuals`
};

export const spec: ExplainerSpec = {
	slug: 'evolution',
	title: 'Evolution by natural selection',
	summary:
		'Run a population of moths whose wing shade is inherited, set the mutation rate, the population size and the birds that hunt them, and watch the population change over generations. Then see the part chance plays, and evolution measured in peppered moths, bacteria on an antibiotic and a 50,000-generation experiment.',
	chapters: [
		{ id: 'ingredients', title: 'Three ingredients' },
		{ id: 'selection', title: 'Generation after generation' },
		{ id: 'chance', title: 'The part chance plays' },
		{ id: 'observed', title: 'Evolution observed' }
	],
	steps: [
		// ----------------------------------------------------------- ingredients
		{
			id: 'variation',
			chapter: 'ingredients',
			title: 'A population that varies',
			scene: 'moths',
			hints: { phase: 'variation' },
			body: `
<p>Here are 100 of the 500 moths of a woodland, resting on tree bark by day. No two look quite alike: their wings range from pale to dark. That difference between individuals is <dfn data-def="Differences between the members of a population: in size, colour, behaviour, or in the genes behind them.">variation</dfn>.</p>
<p>In these moths the wing shade is set by <strong>six genes</strong>, each with a pale and a dark <a href="../meiosis-inheritance/">allele</a>. Each moth carries two copies of every gene, so it has from 0 to 12 dark alleles, and the more it has, the darker it is. The chart counts the moths of each shade: most are pale, a few are dark.</p>
<p>Where does the variation come from? From the reshuffling we met in <a href="../meiosis-inheritance/">meiosis</a>, which deals out a new mix of alleles to every offspring, and, more rarely, from <dfn data-def="A change in a gene's DNA, here turning a pale allele into a dark one or back. Mutations are copying mistakes and other accidents: they happen at random.">mutations</dfn>, which make new alleles.</p>`,
			notes: `<p>This is a model moth: real wing patterns can depend on one gene or many. In the real peppered moth, which we meet at the end, one gene with a dominant dark allele does most of the work. Six genes that simply add up give a smooth range of shades, which is how many traits behave (height in people, for example, depends on thousands of genes).</p>`
		},
		{
			id: 'inheritance',
			chapter: 'ingredients',
			title: 'Offspring take after their parents',
			scene: 'moths',
			hints: { phase: 'inherit' },
			body: `
<p>Moths mate, and each parent passes on <strong>one copy of each gene</strong>, picked at random. So an offspring gets about half its dark alleles from each parent: two dark parents tend to have dark offspring, two pale ones pale offspring.</p>
<p>On the left, a few families: two parents and one of their offspring, with their numbers of dark alleles. On the right, every offspring of a generation, placed by the average shade of its parents (across) and its own shade (up). The cloud climbs from left to right: the shade is <dfn data-def="Passed from parents to offspring through the genes.">heritable</dfn>.</p>
<p>It does not climb exactly along the line. Two parents with 4 dark alleles each can have an offspring with 2 or 6, depending on which copies it drew. Inheritance passes the trait on, and reshuffles it as it goes.</p>`
		},
		{
			id: 'survival',
			chapter: 'ingredients',
			title: 'Not everyone survives',
			scene: 'moths',
			hints: { phase: 'survive' },
			controls: [environment, predation],
			body: `
<p>Birds hunt moths by sight. On bark blackened by soot, a pale moth stands out, and a dark one is hard to see. Watch one generation: the birds take some moths, and the pale ones go more often.</p>
<p>The chart shows the moths before the birds came (outline) and the survivors (filled). The survivors are darker <strong>on average</strong>, though no moth changed colour: the ringed moth keeps its shade all its life. The population changed because <strong>some moths survived more often than others</strong>.</p>
<p>This happens in real woods. In a polluted wood near Birmingham in 1953, Bernard Kettlewell released marked peppered moths and caught them again later: he got back 27.5% of the dark ones but only 13.1% of the pale ones. Switch to <em>pale bark</em> and the birds favour the pale moths instead.</p>`,
			notes: `<p>In the model a moth survives with probability 1 − P × |shade − bark|, where P is the slider: a moth that matches its bark is never singled out, and one of the opposite shade survives (1 − P) times as often. At P = 50% that is half as often, close to Kettlewell’s 13.1% against 27.5% (Kettlewell 1955, <i>Heredity</i> 9: 323–342; recapture also depends on moths flying away, which this ignores). Survival is still a matter of luck: a well-camouflaged moth can be eaten and a conspicuous one can survive. Selection only shifts the odds.</p>`
		},
		// ------------------------------------------------------------ selection
		{
			id: 'generations',
			chapter: 'selection',
			title: 'Selection, generation after generation',
			scene: 'moths',
			hints: { phase: 'run' },
			controls: [environment, predation, mutation, population, again],
			body: `
<p>Now let it run. Every generation the birds take their share, the survivors mate, and the next generation inherits the survivors’ genes. Because the survivors were a little darker than average, so are their offspring, and the next round of birds starts from there.</p>
<p>Small shifts add up. On sooty bark the dark alleles become more common generation after generation, and within a few dozen generations most moths are dark. The chart at the bottom follows the average shade; the dashed line is the bark. This is <dfn data-def="The process by which heritable traits that help their bearers survive and reproduce become more common over generations.">natural selection</dfn>, and the change it makes is <dfn data-def="Change in the genes of a population over generations.">evolution</dfn>.</p>
<p>Try <em>No birds</em>: the average wanders but goes nowhere in particular. Try a tiny population, or no mutations, and run it several times.</p>`,
			notes: `<p><strong>The model.</strong> A <dfn data-def="The standard model of a population of constant size N: each generation is made of N offspring of parents drawn at random (here, among the survivors).">Wright–Fisher</dfn> population of N moths without sexes (any moth can mate with any other, and a moth can even be drawn as both parents, a standard simplification), two copies of each of 6 genes, genes on different chromosomes (independent assortment), and every allele of every offspring mutating with the chosen probability. The population is kept at N each generation, as if the wood could feed only so many moths. Generations do not overlap. One generation is one year for the peppered moth.</p>`
		},
		{
			id: 'ingredients',
			chapter: 'selection',
			title: 'Take one ingredient away',
			scene: 'moths',
			hints: { phase: 'run' },
			controls: [...switches, again],
			body: `
<p>Darwin’s argument has three parts. Individuals <strong>vary</strong>; some of the variation is <strong>inherited</strong>; and some variants <strong>survive and reproduce</strong> better than others. Put together, they make a population adapt. Remove any one and it stops. Switch them off, one at a time:</p>
<ul>
<li><strong>No variation:</strong> every moth has the same shade and no gene mutates. The birds eat some moths, but there is nothing to choose between.</li>
<li><strong>No inheritance:</strong> offspring get genes at random, not from their parents. The survivors were darker, but their offspring start again from scratch.</li>
<li><strong>Equal survival:</strong> the birds eat as many moths as before, but at random. Nothing pushes the shade either way.</li>
</ul>
<p>Nothing else is needed: no plan, no goal, no moth trying to change. Variation, inheritance and unequal survival are enough.</p>`
		},
		{
			id: 'foresight',
			chapter: 'selection',
			title: 'No foresight',
			scene: 'moths',
			hints: { phase: 'reverse' },
			controls: [mutation, population, again],
			body: `
<p>After 60 generations the air is cleaned and the bark turns pale again, as happened in Britain after the clean-air laws of the 1950s and 60s. Now the dark moths stand out, and the population swings back.</p>
<p>Selection cannot look ahead. It favoured dark moths while the bark was black, without “knowing” that the bark would change; it only ever acts on the moths alive now. And it can only choose among the alleles that are there. Set <strong>no mutations</strong> and a <strong>small population</strong> (50 or fewer): chance and selection use up the variation, alleles are lost for good, and the population gets stuck partway, unable to turn pale again when the bark does, however much it would need to. Run it a few times, then give it mutations or more moths.</p>
<p>Notice what never happens: no moth changes its colour to match the bark, and mutations do not turn up because they are needed. A mutation is a random accident; whether it helps is decided afterwards, by the environment.</p>`,
			notes: `<p>In the model, mutation is a coin toss for every allele, with the same chance on pale and sooty bark: the code that mutates a gene is not even told what the bark looks like. Real mutation rates do vary along the genome and with stress, but not according to whether the change would help. That was shown in bacteria in 1943: see “Mutations don’t come when they are needed”.</p>`
		},
		// --------------------------------------------------------------- chance
		{
			id: 'drift',
			chapter: 'chance',
			title: 'Chance alone: genetic drift',
			scene: 'lines',
			hints: { phase: 'drift' },
			controls: [lineSize, { ...again, help: 'Twenty new populations.' }],
			body: `
<p>Even without any selection, allele frequencies change, by luck. Which individuals happen to have more offspring, and which copy of a gene each parent happens to pass on, are random. This is <dfn data-def="Random change in allele frequencies from one generation to the next, because which individuals reproduce and which copies they pass on is a matter of chance.">genetic drift</dfn>.</p>
<p>Here are 20 populations, each starting with an allele that does nothing, carried by half of the gene copies. Each line follows its frequency for 200 generations. In small populations the lines wander wildly, and many hit 0% (the allele is <strong>lost</strong>) or 100% (it is <strong>fixed</strong>: everyone has it). In large ones they barely move.</p>
<p>Once lost or fixed, an allele stays so until a new mutation comes along: drift uses up variation, faster in small populations.</p>`,
			notes: `<p>Each generation, the 2N gene copies of the next generation are a random sample (with replacement) of the copies of this one: a binomial draw. The frequency then wanders like a random walk whose steps are about √(p(1 − p)/2N), and an allele with no effect fixes with a probability equal to its current frequency. Starting from half, loss or fixation takes about 2.8N generations on average, so only the smaller populations reach it within the chart.</p>`
		},
		{
			id: 'new-mutation',
			chapter: 'chance',
			title: 'Most new mutations are lost, even good ones',
			scene: 'lines',
			hints: { phase: 'fate' },
			controls: [
				{
					type: 'range',
					id: 's',
					label: 'Advantage of the new allele',
					min: 0,
					max: 0.2,
					default: 0.05,
					values: () => [0, 0.01, 0.02, 0.05, 0.1, 0.2],
					format: (v) => (v === 0 ? 'none' : `+${Math.round(v * 100)}% offspring`),
					help: 'How many more offspring a copy of the allele leaves, on average, than a copy of the old one.'
				},
				{ ...lineSize, id: 'fateN', default: 200, values: () => [50, 100, 200, 500, 1000] },
				{ ...again, help: '2,000 new mutations.' }
			],
			body: `
<p>A new mutation starts as a <strong>single copy</strong> in a single individual. Even if it helps, that individual may die young or pass on its other copy, and the allele is gone. Here a new allele appears 2,000 times, and each line follows one of them.</p>
<p>Almost all the lines drop to zero within a few generations. With a 5% advantage, only about <strong>1 in 10</strong> new mutations ever takes over: the chance is about <strong>2 × the advantage</strong>, whatever the population size (unless it is tiny). With no advantage at all, the chance is just <strong>1 in 2N</strong>, the share of copies it starts with.</p>
<p>So evolution does not simply pick up every good mutation. It needs the same lucky mutation to arise again and again, which is easier in large populations, where more mutations happen every generation.</p>`,
			notes: `<p>The “2s” rule was found by J. B. S. Haldane in 1927; Motoo Kimura’s formula from 1962, u = (1 − e<sup>−2s</sup>) / (1 − e<sup>−4Ns</sup>), gives the chance for any s and N (here s is the extra offspring per copy, so a carrier of one copy has s more offspring and a carrier of two copies about 2s more). The panel compares the simulation with it. A harmful mutation can also fix by drift, but only in small populations: with N = 10 and s = −1%, it still fixes about 4% of the time.</p>`
		},
		{
			id: 'blind',
			chapter: 'chance',
			title: 'Mutations don’t come when they are needed',
			scene: 'plates',
			controls: [
				{
					type: 'select',
					id: 'hypothesis',
					label: 'Where does resistance come from?',
					default: 'random',
					options: [
						{ value: 'random', label: 'Random mutations during growth' },
						{ value: 'induced', label: 'The virus causes it' }
					]
				},
				{ ...again, label: 'New cultures', action: 'Grow 20 new cultures' }
			],
			body: `
<p>Do organisms produce the mutations they need when they need them? In 1943 Salvador Luria and Max Delbrück tested it with bacteria and a virus that kills them. A few bacteria survive the virus, because they are resistant. Did the virus make them resistant, or were they resistant <em>before</em> it arrived?</p>
<p>They grew 20 separate cultures from a small number of bacteria each, then spread each on a dish with the virus and counted the resistant colonies. If the virus caused resistance, every dish would get about the same number, scattered only by chance. If mutations happen at random as the bacteria multiply, one that happens early leaves a large family of resistant cells (a <strong>jackpot</strong>), and one that happens late, just one or two.</p>
<p>Switch between the two ideas. Luria and Delbrück saw jackpots: in one experiment, 11 of 20 cultures had no resistant cells and a few had dozens or more. Resistance was there before the virus. Selection only revealed it.</p>`,
			notes: `<p>Figures: Luria &amp; Delbrück 1943, <i>Genetics</i> 28: 491–511, experiments 16 and 10a as summarised in S. M. Carr’s course notes (Memorial University; we could not check them against the original tables): 20 separate cultures had a mean of 11.3 resistant bacteria and a variance of 694, while 10 samples from one large culture had a mean of 16.7 and a variance of 15, as a count driven by chance alone should. The fraction of cultures with no mutant, 11 of 20, gives a mutation rate of about 3 in 100 million per cell division. The model grows each culture by 15 doublings to 20 million cells with that mutation rate.</p>`
		},
		// ------------------------------------------------------------- observed
		{
			id: 'peppered-moth',
			chapter: 'observed',
			title: 'The peppered moth, up and down',
			scene: 'history',
			hints: { phase: 'moth' },
			controls: [
				{
					type: 'range',
					id: 'rise',
					label: 'Advantage of dark moths on sooty bark',
					min: 0,
					max: 0.5,
					step: 0.01,
					default: 0.32,
					format: (v) => `+${Math.round(v * 100)}% survival`
				},
				{
					type: 'range',
					id: 'fall',
					label: 'Disadvantage on clean bark',
					min: 0,
					max: 0.5,
					step: 0.01,
					default: 0.27,
					format: (v) => `−${Math.round(v * 100)}% survival`
				}
			],
			body: `
<p>The first black peppered moth on record was caught in Manchester in 1848. By 1895, about 98% of the peppered moths there were reported to be black. The black form, <i>carbonaria</i>, comes from one dominant allele, and in 2016 it was traced to a piece of mobile DNA that jumped into a gene called <i>cortex</i>, most likely around <strong>1819</strong>, though it may be decades older. The mutation was an accident: it may have waited, rare and of no use, until the soot made it pay off.</p>
<p>Left: suppose the black form was 2% in 1848 (a round figure; nobody counted). How much better must it have survived to reach 98% by 1895? In this model, about <strong>32%</strong> better per generation (one a year). Right: after the air was cleaned, the black form fell. Near Cambridge it went from 12% of the moths in 2001 to 1% in 2007; the best fit is a disadvantage of about <strong>27%</strong>.</p>
<p>Michael Majerus tested the birds directly: of 4,864 moths he released in his garden near Cambridge over six years, the birds ate 29% of the black ones and 21% of the pale ones.</p>`,
			notes: `<p>Sources: the 1848 moth was caught by R. S. Edleston and reported in 1864, and is generally regarded as the first record (van’t Hof et al. 2016); the 98% in 1895 is as reported by Majerus 2009, <i>Evolution: Education and Outreach</i> 2: 63–74. The 2% start is our round figure for illustration. J. B. S. Haldane made a calculation of this kind in 1924, the first estimate of the strength of natural selection in the wild; the 32% is this model’s answer, not his. The mutation: van’t Hof et al. 2016, <i>Nature</i> 534: 102–105; 1819 is their most likely date, but the estimate is skewed towards older dates (middle half 1681–1806), and the allele may have been around, rare, long before it was noticed. Cambridge shares and Majerus’s experiment: Cook, Grant, Saccheri &amp; Mallet 2012, <i>Biology Letters</i> 8: 609–612, table 2 (the shares were read by those authors from a graph of Majerus’s; 29% and 21% are our totals of their counts: 100 of 342 black and 963 of 4,522 pale moths eaten). They estimate the daily selection against black moths at about 9%, enough over a moth’s few days of life to explain the local decline, which they put at a selection of 10–20% per generation. Our least-squares fit of this simple model to the same Cambridge shares gives about 27%, above their range; across Britain the decline implies 8–35% depending on place and period (Cook &amp; Saccheri 2013, <i>Heredity</i> 110: 207–212). The model: one gene, black dominant, selection acting on survival, no migration between woods.</p>`
		},
		{
			id: 'antibiotics',
			chapter: 'observed',
			title: 'Bacteria on an antibiotic',
			scene: 'plate',
			controls: [
				{
					type: 'toggle',
					id: 'steps',
					label: 'Intermediate doses',
					default: true,
					help: 'Off: the plate jumps from no antibiotic straight to 3,000 times the dose that stops the original bacteria.'
				},
				{
					type: 'range',
					id: 'plateMu',
					label: 'Mutation rate (per cell division)',
					min: 1e-9,
					max: 1e-6,
					default: 1e-7,
					values: () => [1e-9, 1e-8, 1e-7, 1e-6],
					format: (v) => `1 in ${fmtCount(Math.round(1 / v))}`,
					help: 'The chance that a dividing cell gains the next resistance mutation.'
				},
				{
					type: 'range',
					id: 'K',
					label: 'Bacteria per patch of agar',
					min: 1e5,
					max: 1e8,
					default: 1e7,
					values: () => [1e5, 1e6, 1e7, 1e8],
					format: (v) => fmtCount(v)
				},
				{
					...again,
					help: 'Same settings, different luck: which cell mutates, and when, is random.'
				}
			],
			body: `
<p>In 2016 Michael Baym and colleagues at Harvard poured a dish 120 cm long, with bands of the antibiotic trimethoprim: none at the ends, then 3, 30, 300 and 3,000 times the dose that stops ordinary <i>E. coli</i>. They put bacteria at the ends and filmed them.</p>
<p>The bacteria fill the first band and stop at the edge of the next. Then a mutant that survives a little more antibiotic appears, by chance, and its descendants spread into the next band, until the next mutation lets them go further. In 10 days the bacteria reached the middle; there, resistance was <strong>10,000 times</strong> that of their ancestors. The colours show each step of resistance.</p>
<p>Switch the intermediate doses off: the bacteria never get past the first edge. No single mutation is enough, and without the middle bands, the partly resistant mutants have nowhere to multiply. Fewer bacteria, or a lower mutation rate, also slow it down.</p>`,
			notes: `<p>Baym et al. 2016, <i>Science</i> 353: 1147–1151 (the MEGA-plate). They also made a plate with no middle bands, and found that “the addition of an intermediate concentration step enabled adaptation”. This model is a line of patches of agar, each holding K bacteria when full, in five steps of resistance, each mutation making a cell tolerate 10 times more antibiotic (a simplification: real resistance mutations, mostly in the drug’s target gene <i>folA</i>, give steps of different sizes). Cells divide once a generation while there is room, die where the drug is above what they tolerate, and spread into neighbouring patches that still have room. The same logic is one reason doctors combine drugs: resistance that needs several steps evolves most easily where partly resistant cells can survive and multiply.</p>`
		},
		{
			id: 'lenski',
			chapter: 'observed',
			title: '50,000 generations in a flask',
			scene: 'history',
			hints: { phase: 'lenski' },
			controls: [{ type: 'toggle', id: 'each', label: 'Show each population', default: true }],
			body: `
<p>On 24 February 1988, Richard Lenski started 12 flasks of <i>E. coli</i> from one ancestor, and a drop of each has been moved into fresh food almost every day since (since 2022 in Jeffrey Barrick’s lab): about 6.6 generations a day, 50,000 generations by 2010. Samples are frozen every 500 generations, so the ancestors can be revived and raced against their descendants.</p>
<p>The chart shows how fast each population grows compared with the ancestor. After 50,000 generations they grew about <strong>70% faster</strong>. The gains were quick at first and slower later, but they have not stopped: the curve, our fit of the power law Lenski’s team proposed, is still rising.</p>
<p>And something new happened. Around generation 31,500, one population evolved the ability to eat citrate, which <i>E. coli</i> cannot normally use in air. It took a chain of earlier mutations to make it possible: variation, inheritance and selection, with no foresight, building something new. The same process, among the cells of a body, is how a cancer arises.</p>`,
			notes: `<p>Fitness data: Wiser, Ribeck &amp; Lenski 2013, <i>Science</i> 342: 1364–1367, data on Dryad (doi:10.5061/dryad.0hc2m). Fitness is the ratio of the growth rates of an evolved population and the ancestor when they compete in the same flask; the thick line averages the nine populations measured at every time point. The curve w = (b t + 1)<sup>a</sup> with a = 0.094 and b = 0.0055 is our least-squares fit to those averages. Citrate: Blount, Borland &amp; Lenski 2008, <i>PNAS</i> 105: 7899–7906 (a Cit⁺ variant “by 31,500 generations”, in population Ara−3, after a potentiating mutation by 20,000).</p>`
		}
	]
};
