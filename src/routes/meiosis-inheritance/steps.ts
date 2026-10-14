import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const pairNames = ['long', 'middle', 'short'];

/** Where the chiasma of each pair sits, as a share of the chromosome's length from its top end. */
const crossovers: Control[] = [0.62, 0.75, 0.25].map((d, i) => ({
	type: 'range',
	id: `xo${i}`,
	label: `Crossover on the ${pairNames[i]} pair`,
	min: 0.04,
	max: 0.96,
	step: 0.01,
	default: d,
	format: (v) => `${Math.round(v * 100)}% from the top`,
	help: i === 0 ? 'Or drag the round handles along the chromosomes in the picture.' : undefined
}));

/** Which way each pair faces at the equator. */
const lineup: Control[] = [0, 1, 2].map((i) => ({
	type: 'toggle',
	id: `flip${i}`,
	label: `${pairNames[i][0].toUpperCase()}${pairNames[i].slice(1)} pair: father’s copy on the left`,
	default: i === 1,
	help: i === 0 ? 'Or click a pair in the picture to turn it round.' : undefined
}));

const genotypeOptions = [
	{ value: 'YY', label: 'YY (yellow seeds)' },
	{ value: 'Yy', label: 'Yy (yellow seeds)' },
	{ value: 'yy', label: 'yy (green seeds)' }
];

const count: Control = {
	type: 'range',
	id: 'count',
	label: 'Offspring to breed',
	min: 4,
	max: 4000,
	default: 400,
	values: () => [4, 10, 20, 40, 100, 200, 400, 1000, 2000, 4000],
	format: (v) => v.toLocaleString('en-GB')
};
const count2: Control = { ...count, id: 'count2', default: 556 };
count2.values = () => [16, 40, 100, 200, 556, 1000, 2000, 4000];

const again: Control = { type: 'action', id: 'again', label: 'New batch', action: 'Breed again' };

export const spec: ExplainerSpec = {
	slug: 'meiosis-inheritance',
	title: 'Meiosis and inheritance',
	summary:
		'Step through the cell division that makes eggs and pollen, choosing where the chromosomes cross over and how they line up. Then cross pea plants as Mendel did, breed thousands of offspring and watch his 3 : 1 and 9 : 3 : 3 : 1 appear, and see why brothers and sisters differ.',
	chapters: [
		{ id: 'copies', title: 'Two copies of everything' },
		{ id: 'meiosis', title: 'Meiosis' },
		{ id: 'crosses', title: 'Crossing parents' },
		{ id: 'families', title: 'Families' }
	],
	steps: [
		// ---------------------------------------------------------------- copies
		{
			id: 'pairs',
			chapter: 'copies',
			title: 'Chromosomes come in pairs',
			scene: 'cell',
			hints: { focus: 'pairs' },
			body: `
<p>In <a href="../the-cell/">the cell</a> we met the <strong>nucleus</strong> and its <dfn data-def="One long DNA molecule with its packing proteins, carrying hundreds to thousands of genes.">chromosomes</dfn>: 46 in a human cell, 23 inherited from the mother and 23 from the father. They come in <strong>pairs</strong>: chromosome 1 from your mother and chromosome 1 from your father carry the same genes, in the same order.</p>
<p>The two chromosomes of a pair are <dfn data-def="The two chromosomes of a pair, one from each parent: same genes in the same order, possibly different versions of them.">homologous</dfn>. They are not identical: each gene may come in different versions, and each parent passed on their own.</p>
<p>This is a pea plant, the plant Gregor Mendel used to discover how inheritance works. A pea cell has 7 pairs; to keep the picture clear we draw 3 of them, each with one of Mendel’s genes. The copy from the plant’s mother is drawn <strong class="tag mom">red</strong>, the one from its father <strong class="tag dad">blue</strong>.</p>`,
			notes: `<p>The three genes are real and do lie on different pea chromosomes: seed shape (<i>R</i>) on linkage group V, seed colour (Mendel’s yellow/green cotyledons, gene <i>I</i>, here written <i>Y</i> as in most textbooks) on linkage group I, and flower colour (<i>A</i>) on linkage group II (Reid &amp; Ross 2011, <i>Genetics</i> 189: 3–10; Hellens et al. 2010, <i>PLoS ONE</i> 5: e13230). Their positions along the chromosomes, and the chromosomes’ lengths, are drawn for clarity. Real chromosomes are this tidy only while a cell divides; the rest of the time they are long threads of chromatin filling the nucleus.</p>`
		},
		{
			id: 'alleles',
			chapter: 'copies',
			title: 'Versions of a gene',
			scene: 'cell',
			hints: { focus: 'alleles' },
			body: `
<p>The versions of a gene are its <dfn data-def="One version of a gene. The two copies of a gene in a cell can be the same allele or two different ones.">alleles</dfn>. For seed colour, a pea has two: <strong>Y</strong> makes the seeds yellow, <strong>y</strong> leaves them green. Since every cell has two copies, a plant can be <strong>YY</strong>, <strong>Yy</strong> or <strong>yy</strong>: its <dfn data-def="The alleles an individual carries for a gene, e.g. Yy.">genotype</dfn>.</p>
<p>A <strong>Yy</strong> plant has yellow seeds, just like <strong>YY</strong>: one working copy is enough. <strong>Y</strong> is <dfn data-def="An allele whose effect shows even when only one copy is present.">dominant</dfn>, and <strong>y</strong> is <dfn data-def="An allele whose effect shows only when both copies are that allele.">recessive</dfn>: green shows only in <strong>yy</strong>. The y allele is a broken version of a gene that breaks down chlorophyll as the seed ripens.</p>
<p>“Dominant” does not mean stronger, better or more common. It only says which allele shows when a plant has one of each. A recessive allele can hide, unseen, in a plant that carries it.</p>`,
			notes: `<p>Seed colour: the green (<i>i</i>) allele Mendel used is a 6-letter insertion in the <i>stay-green</i> gene, whose protein starts the breakdown of chlorophyll (Armstead et al. 2007; Sato et al. 2007). Seed shape: the wrinkled (<i>r</i>) allele is a 0.8 kb insertion that breaks starch-branching enzyme 1; the seeds hold more sugar and water and wrinkle as they dry (Bhattacharyya et al. 1990). Flower colour: white (<i>a</i>) flowers carry a broken switch gene for purple pigment (Hellens et al. 2010). Not every gene works this simply: many traits depend on many genes, and some alleles are only partly dominant.</p>`
		},
		// --------------------------------------------------------------- meiosis
		{
			id: 'copy',
			chapter: 'meiosis',
			title: 'First, copy every chromosome',
			scene: 'meiosis',
			hints: { phase: 0 },
			body: `
<p>Eggs and pollen (and sperm in animals) are made by a special cell division, <dfn data-def="The two-step cell division that makes eggs, sperm and pollen: each product gets one chromosome of every pair, half the usual number.">meiosis</dfn>. It must halve the number of chromosomes: when an egg and a sperm join, the new cell should have 2 copies again, not 4.</p>
<p>It starts like an ordinary division: the cell copies its DNA. Each chromosome becomes two identical <dfn data-def="The two identical copies of a chromosome made when the DNA is copied, held together at one point, the centromere, until they are pulled apart.">sister chromatids</dfn>, held together at a pinch, the <strong>centromere</strong>. The plant now has 6 chromosomes made of 12 chromatids.</p>`
		},
		{
			id: 'crossover',
			chapter: 'meiosis',
			title: 'Pairs meet and cross over',
			scene: 'meiosis',
			hints: { phase: 1 },
			controls: crossovers,
			body: `
<p>Now something happens that never happens in an ordinary division: the two chromosomes of each pair find each other and lie side by side, gene against gene.</p>
<p>Where they touch, two chromatids, one from each, break at the same point and swap ends. This is <dfn data-def="The exchange of matching pieces between the two chromosomes of a pair during meiosis. Its point of contact is a chiasma.">crossing over</dfn>. Every pair crosses over at least once; long chromosomes often two or three times. Afterwards, two of the four chromatids are a new mix: part grandmother, part grandfather.</p>
<p><strong>Choose where each pair crosses over</strong> with the sliders, or drag the handles. Watch the letters: a gene beyond the crossover (counting from the centromere) changes chromatid; a gene between the centromere and the crossover stays put.</p>`,
			notes: `<p>The crossover is drawn between the two inner chromatids. In a real cell any of the four combinations of non-sister chromatids can cross, at sites chosen by an enzyme (Spo11) that cuts the DNA on purpose; most of the cuts are repaired without a swap. The simulation that breeds offspring later on lets the crossovers fall at random, about one per 100 centimorgans of chromosome per chromatid (that is what a centimorgan means).</p>`
		},
		{
			id: 'lineup',
			chapter: 'meiosis',
			title: 'The pairs line up at random',
			scene: 'meiosis',
			hints: { phase: 2 },
			controls: lineup,
			body: `
<p>The pairs line up across the middle of the cell. Fibres from the two ends of the cell grab them, one chromosome of each pair from each side. Which side gets the mother’s copy is a coin toss, made <strong>separately for every pair</strong>.</p>
<p><strong>Turn the pairs round</strong> with the switches, or click a pair. With 3 pairs there are 2 × 2 × 2 = <strong>8</strong> different ways to share them out. A human cell has 23 pairs: 2²³, about <strong>8.4 million</strong> ways, before crossing over is even counted.</p>
<p>This is <dfn data-def="Mendel’s second law: genes on different chromosomes are passed on independently of each other, because each pair lines up independently in meiosis.">independent assortment</dfn>: which seed-colour allele a pollen grain gets says nothing about which seed-shape allele it gets.</p>`
		},
		{
			id: 'first',
			chapter: 'meiosis',
			title: 'Division one: the pairs split',
			scene: 'meiosis',
			hints: { phase: 3 },
			body: `
<p>The fibres pull: the two chromosomes of each pair go to opposite ends, and the cell divides. Each new cell has <strong>one chromosome of each pair</strong>, 3 instead of 6. That is the halving.</p>
<p>Each chromosome still has its two chromatids, and after crossing over they are no longer identical. Look at the long chromosome: as set at first, each cell holds both <strong>R</strong> and <strong>r</strong>, because its crossover fell between the centromere and the gene. Those two separate in the next division.</p>`
		},
		{
			id: 'second',
			chapter: 'meiosis',
			title: 'Division two: four different cells',
			scene: 'meiosis',
			hints: { phase: 4 },
			body: `
<p>Each cell divides again, now like an ordinary division: the sister chromatids are pulled apart. The result is <strong>four cells, each with one copy of every chromosome</strong>: half of the parent’s genes, one allele of each gene. In a pea flower, these cells grow into pollen grains or egg cells.</p>
<p>Count the colours: each chromosome is the mother’s, the father’s or a patchwork of both. Go back and move a crossover or turn a pair round: the four cells change. Every pollen grain is a different, random half.</p>`,
			notes: `<p>In flowering plants the four products of a meiosis in the anther become four pollen grains; in the ovule only one of the four survives to make the egg (the same happens in human eggs; in sperm all four are used). After meiosis the plant cells divide a few more times by ordinary division, which copies chromosomes exactly.</p>`
		},
		// --------------------------------------------------------------- crosses
		{
			id: 'punnett',
			chapter: 'crosses',
			title: 'Crossing two plants',
			scene: 'cross',
			hints: { mode: 'punnett' },
			controls: [
				{
					type: 'select',
					id: 'mom',
					label: 'Plant that gives the egg cells',
					default: 'Yy',
					options: genotypeOptions
				},
				{
					type: 'select',
					id: 'dad',
					label: 'Plant that gives the pollen',
					default: 'Yy',
					options: genotypeOptions
				}
			],
			body: `
<p>A pea seed starts when a pollen grain fertilises an egg cell. The seed gets one seed-colour allele from each. A <dfn data-def="A grid that lists one parent’s egg cells across the top and the other’s pollen down the side; each box is one way they can meet. Named after Reginald Punnett.">Punnett square</dfn> lists every way it can happen: the egg cells along one side, the pollen along the other, and in each box, the seed they would make.</p>
<p>A <strong>Yy</strong> plant makes Y and y cells in equal numbers, because meiosis gives one allele of the pair to each. So two Yy parents give YY, Yy, yY and yy equally often: 3 boxes of 4 yellow, 1 green. <strong>Three yellow to one green.</strong></p>
<p>Try other parents. Two yy plants can only have green seeds; a YY parent makes every seed yellow, whatever the other.</p>`
		},
		{
			id: 'breed',
			chapter: 'crosses',
			title: 'Breed hundreds: the 3 : 1 appears',
			scene: 'cross',
			hints: { mode: 'breed' },
			controls: [
				{
					type: 'select',
					id: 'gene',
					label: 'Trait',
					default: 'Y',
					options: [
						{ value: 'Y', label: 'Seed colour (Yy × Yy)' },
						{ value: 'R', label: 'Seed shape (Rr × Rr)' },
						{ value: 'A', label: 'Flower colour (Aa × Aa)' }
					]
				},
				count,
				again
			],
			body: `
<p>The square gives chances, not certainties. Here every seed is bred for real: the model runs a meiosis in each parent, picks one of its four cells, and joins them.</p>
<p>With 4 seeds, anything can happen: often 2 : 2 or 4 : 0. With hundreds, the share of green seeds settles near <strong>one in four</strong>. Mendel counted 8,023 seeds from 258 plants: 6,022 yellow and 2,001 green, a ratio of 3.01 : 1. For seed shape he got 5,474 round to 1,850 wrinkled (2.96 : 1).</p>
<p>Press <em>Breed again</em> to see how much a small batch wanders, and how little a large one does.</p>`,
			notes: `<p>Mendel’s counts are from his 1866 paper (<i>Versuche über Pflanzen-Hybriden</i>, experiments 1–3, in Druery &amp; Bateson’s English translation). His third experiment followed the grey-brown seed coats that go with violet flowers: 705 plants against 224 with white coats and white flowers (3.15 : 1). The spread of a small batch follows the binomial distribution: with n seeds, the share of green ones wanders by about √(3/16 ÷ n), 22% for 4 seeds but 0.7% for 4,000. Statisticians have long argued (since R. A. Fisher in 1936) that Mendel’s numbers fit 3 : 1 a little too well; whatever the reason, the ratios themselves have been confirmed countless times.</p>`
		},
		{
			id: 'two-genes',
			chapter: 'crosses',
			title: 'Two genes at once: 9 : 3 : 3 : 1',
			scene: 'cross',
			hints: { mode: 'dihybrid' },
			controls: [count2, again],
			body: `
<p>Mendel also crossed plants that differ in two traits. A plant with round, yellow seeds (<strong>RrYy</strong>) makes four kinds of pollen and egg cells, <strong>RY, Ry, rY, ry</strong>, equally often, because the two genes sit on different chromosomes that line up independently.</p>
<p>The square now has 4 × 4 = 16 boxes: 9 round yellow, 3 round green, 3 wrinkled yellow, 1 wrinkled green. Mendel’s 556 seeds: <strong>315 : 108 : 101 : 32</strong>, close to 9 : 3 : 3 : 1. Notice the new combinations, round green and wrinkled yellow, that neither grandparent had.</p>`
		},
		{
			id: 'linked',
			chapter: 'crosses',
			title: 'Genes that travel together',
			scene: 'linkage',
			controls: [
				{
					type: 'range',
					id: 'dist',
					label: 'Distance between the genes',
					min: 0,
					max: 200,
					step: 1,
					default: 20,
					unit: ' cM',
					help: 'Centimorgans: 1 cM is the length along which crossovers mix two genes in 1% of cells, for short distances.'
				},
				again
			],
			body: `
<p>A chromosome carries hundreds or thousands of genes, so most genes share a chromosome with others. Two genes on the same chromosome stay together in a pollen grain unless a crossover falls <strong>between them</strong>.</p>
<p>Here a parent got genes <strong>A</strong> and <strong>B</strong> together from one of its parents, and <strong>a</strong> and <strong>b</strong> from the other. Close genes almost always travel together: few <dfn data-def="A sex cell with a new combination of alleles (Ab or aB here), made by a crossover between the two genes.">recombinant</dfn> cells. The further apart they are, the more often they get separated, but never in more than <strong>half</strong> of the cells: a crossover swaps only two of the four chromatids, and two crossovers between the genes can undo each other.</p>
<p>Far apart on one long chromosome, genes behave as if they were on different ones. Measuring how often genes separate is how the first maps of chromosomes were drawn, by Alfred Sturtevant in 1913, from fruit flies.</p>`,
			notes: `<p>The model lets crossovers fall at random and independently along the chromosome. Then the share of recombinant cells for two genes d Morgans apart (1 M = 100 cM) is Haldane’s formula r = ½ (1 − e<sup>−2d</sup>), the curve on the right: r ≈ d for close genes, and r → ½ for distant ones. Real crossovers keep their distance from each other (crossover interference), which makes double crossovers rarer than this; other map functions (Kosambi’s) allow for it. Bateson, Saunders and Punnett saw the first case of genes travelling together, in sweet peas, in 1905.</p>`
		},
		// -------------------------------------------------------------- families
		{
			id: 'skip',
			chapter: 'families',
			title: 'How a trait skips a generation',
			scene: 'pedigree',
			controls: [
				{
					type: 'toggle',
					id: 'genes',
					label: 'Show the alleles',
					default: false
				},
				{ ...again, label: 'Another family', action: 'New family' }
			],
			body: `
<p>Mendel crossed a plant from a line that always had yellow seeds (<strong>YY</strong>) with one from a green line (<strong>yy</strong>). All their offspring had yellow seeds: green seemed to have vanished.</p>
<p>But every one of them was <strong>Yy</strong>, carrying the green allele unseen. When two of them were crossed, green came back in about one seed in four: a trait that <strong>skips a generation</strong>.</p>
<p>The same happens in families. Two parents who both carry one recessive allele, and show nothing of it, each pass it on to half their children; a child has a one-in-four chance of getting it from both. Switch on the alleles to see who carries it, and press <em>New family</em>: how many green seeds a family has is down to chance.</p>`,
			notes: `<p>This is how recessive conditions such as cystic fibrosis run in families: carriers are healthy, and a child of two carriers has a 1 in 4 chance of being affected, independently for each child. The pedigree draws eight offspring of the two hybrids, bred by the same simulation.</p>`
		},
		{
			id: 'siblings',
			chapter: 'families',
			title: 'Why brothers and sisters differ',
			scene: 'siblings',
			controls: [{ ...again, label: 'Another pair', action: 'Two more siblings' }],
			body: `
<p>Back to people. Here are the 22 numbered chromosome pairs of two children of the same parents, with their real lengths. Each child got one chromosome of every pair from the mother (the left one) and one from the father (the right one). Each colour shows which grandparent a stretch came from.</p>
<p>Each child got a random half of each parent’s genome, cut and reshuffled by about 35 crossovers per parent. Where the two children have the same colour at the same place, they inherited the same piece. On average brothers and sisters share <strong>half</strong>, but it varies: measured in 4,401 pairs of siblings, from 37% to 62%.</p>
<p>So each parent passes on a random, reshuffled half of their genes. That is why brothers and sisters differ, why a hidden allele can reappear generations later, and why no two people (except identical twins) are genetically the same.</p>`,
			notes: `<p><strong>How this is drawn.</strong> Chromosome lengths are from the human reference genome (GRCh38, UCSC), and the crossovers fall according to the HapMap genetic map (International HapMap Consortium 2007; total 3,544 cM for the 22 autosomes, as the Beagle GRCh38 map), more often where real recombination is frequent. The model uses the same, sex-averaged map for both parents (real mothers have about 1.6 times as many crossovers as fathers), ignores crossover interference, and leaves out the X and Y chromosomes. It gives a sibling sharing of 50% on average, spread a little wider than measured (standard deviation 4.3% against 3.6%). Measured sharing: Visscher et al. 2006, <i>PLoS Genetics</i> 2: e41 (mean 49.8%, range 37.4–61.7%). The short arms of chromosomes 13, 14, 15, 21 and 22 carry no mapped genes and are drawn without crossovers.</p>`
		}
	]
};
