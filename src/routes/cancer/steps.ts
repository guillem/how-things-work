import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { KRAS_CHANGES } from './model';
import { SEER_AGE } from './data';

/** Replays the tissue with a new roll of the dice (a new random seed). */
const again: Control = {
	type: 'action',
	id: 'again',
	label: 'Run again',
	action: 'Run again',
	help: 'Same rules, new chance events.'
};

/** How often each gene is hit, relative to the page's standard rate. */
const rate: Control = {
	type: 'range',
	id: 'rate',
	label: 'Mutation rate',
	min: 0.5,
	max: 3,
	step: 0.5,
	default: 1,
	format: (v) => `×${v}`,
	help: 'Something that damages DNA, such as tobacco smoke or sunburn, raises it.'
};

const repair: Control = {
	type: 'toggle',
	id: 'repair',
	label: 'The repair gene can be hit too',
	default: true
};

const treat: Control = {
	type: 'toggle',
	id: 'treat',
	label: 'Treat once the tumour is found',
	default: true,
	help: 'From then on the drug kills cancer cells that do not resist it.'
};

const therapy: Control = {
	type: 'select',
	id: 'therapy',
	label: 'Treatment',
	default: 'one',
	options: [
		{ value: 'one', label: 'One drug' },
		{ value: 'two', label: 'Two drugs at once' }
	]
};

const kras: Control = {
	type: 'select',
	id: 'kras',
	label: 'KRAS codon 12',
	default: 'G12D',
	options: [
		{ value: 'none', label: 'Unchanged (GGT, glycine)' },
		...KRAS_CHANGES.map((c) => ({ value: c.id, label: `${c.id} (${c.codon})` }))
	]
};

const site: Control = {
	type: 'select',
	id: 'site',
	label: 'Cancer',
	default: 'colorectal',
	options: SEER_AGE.map((s) => ({ value: s.id, label: s.label }))
};

const hits: Control = {
	type: 'range',
	id: 'hits',
	label: 'Steps needed (k)',
	min: 1,
	max: 9,
	step: 1,
	default: 5,
	format: (v) => `${v} ${v === 1 ? 'step' : 'steps'}`,
	help: 'The model line rises as age to the power k − 1.'
};

const inherited: Control = {
	type: 'toggle',
	id: 'inherited',
	label: 'The children inherited one broken RB1',
	default: true
};

const children: Control = {
	type: 'action',
	id: 'children',
	label: 'Another 40 children',
	action: 'Another 40 children'
};

export const spec: ExplainerSpec = {
	slug: 'cancer',
	title: 'How cancer starts: evolution inside the body',
	summary:
		'Let the cells of a tissue divide and occasionally mutate. A cell whose growth controls break outdivides its neighbours, its descendants pick up more changes, and a tumour grows. Then treat it and watch which cells survive.',
	chapters: [
		{ id: 'rules', title: 'Cells that keep to the rules' },
		{ id: 'evolution', title: 'Evolution among cells' },
		{ id: 'odds', title: 'Why it takes decades' },
		{ id: 'treatment', title: 'Treatment and resistance' }
	],
	steps: [
		// ------------------------------------------------------------------ rules
		{
			id: 'balance',
			chapter: 'rules',
			title: 'A tissue in balance',
			scene: 'tissue',
			hints: { view: 'balance' },
			duration: 18,
			body: `
<p>The lining of your gut, your skin and your blood are renewed all the time. Cells wear out and die, and others divide to replace them: your body replaces about <strong>330 billion cells a day</strong>, mostly blood cells and cells of the gut lining.</p>
<p>The picture is a patch of such a tissue, seen from above. Each dot is a cell. Every few seconds some cells die (a gap opens) and a neighbour divides to fill the gap. A cell divides <em>only</em> when there is room next to it: cells sense their neighbours and stop when they are crowded. This is <dfn data-def="The way normal cells stop dividing when they touch their neighbours on all sides, so that a tissue keeps its size.">contact inhibition</dfn>.</p>
<p>So the tissue stays the same size for decades, as the chart shows: divisions exactly replace losses. Cancer begins when one cell stops keeping to these rules.</p>`,
			notes: `<p>The figure of (0.33 ± 0.02) × 10¹² cells a day, about 90% of them blood cells, is from Sender &amp; Milo, “The distribution of cellular turnover in the human body”, <i>Nature Medicine</i> 27:45 (2021). Real tissues are organised: in the gut, a few <dfn data-def="Long-lived cells that divide to renew a tissue: one daughter usually stays a stem cell and the other goes on to specialise.">stem cells</dfn> at the bottom of each pit (a crypt) make all the others, which move up and are shed after a few days. Only mutations in stem cells last, because everything else is soon lost. The model is a flat sheet of identical, self-renewing cells: each generation, a cell dies with a chance of 8%, and a cell next to a gap divides into it.</p>`
		},
		{
			id: 'copies',
			chapter: 'rules',
			title: 'Every division risks a copying error',
			scene: 'tissue',
			hints: { view: 'passengers' },
			duration: 22,
			body: `
<p>Before a cell divides it copies its DNA, all six billion letters of it. The copying is extraordinarily accurate, and errors are mostly caught and repaired, but not all: each division leaves a few new <a href="../dna-to-protein/#missense">mutations</a>, and both daughters pass theirs on.</p>
<p>The cells are now shaded by how many mutations they carry. They pile up steadily, so that no two cells in the tissue have quite the same DNA. Measured in human stem cells of the gut and liver, the count rises by about <strong>40 mutations a year</strong>, throughout life.</p>
<p>Almost all of them do nothing: they fall between genes, or change a letter that <a href="../dna-to-protein/#silent">does not change the protein</a>, or change a gene the cell never uses. They are called <dfn data-def="Mutations that happen to be carried along in a cell but have no effect on its growth.">passengers</dfn>. In the model they change nothing at all.</p>`,
			notes: `<p>Blokzijl et al., “Tissue-specific mutation accumulation in human adult stem cells during life”, <i>Nature</i> 538:260 (2016), sequenced the whole genomes of single stem cells from people aged 3 to 87: about 40 new mutations a year in small intestine, colon and liver alike. A colon stem cell of a 60-year-old therefore carries a few thousand mutations, nearly all harmless. In the model each daughter cell gets on average half a passenger mutation per division, to keep the shading readable.</p>`
		},
		{
			id: 'genes',
			chapter: 'rules',
			title: 'The accelerator and the brakes',
			scene: 'genes',
			duration: 24,
			controls: [kras],
			body: `
<p>A few hundred of our 20,000 genes control <em>whether a cell divides</em>. Mutations in them are the dangerous ones, the <dfn data-def="A mutation that gives a cell a growth advantage and so helps a cancer to develop.">drivers</dfn>. They come in two kinds.</p>
<ul>
<li><strong>Oncogenes</strong> are accelerators. <strong>KRAS</strong> makes a switch protein that passes on the signal “divide” and then switches itself off. A single letter changed in codon 12 swaps one amino acid (pick one below) and jams the switch <em>on</em>: the cell behaves as if it were always told to divide. One hit, in one of the two copies, is enough.</li>
<li><strong>Tumour-suppressor genes</strong> are brakes. <strong>TP53</strong> stops a cell with damaged DNA from dividing, or makes it destroy itself. <strong>RB1</strong> holds the cell cycle until it is time to divide. Each cell has two copies of each, and one working copy is enough, so the brake fails only when <strong>both copies</strong> are hit.</li>
</ul>
<p>About one person with cancer in five has a mutated RAS gene, and a broken TP53 turns up in cancers of almost every kind.</p>`,
			notes: `<p>The DNA shown is the real start of the human KRAS gene (NCBI RefSeq NM_004985.5), translated with the genetic code of the <a href="../dna-to-protein/#code-table">DNA to protein</a> page. Codon 12, GGT, codes for glycine, the smallest amino acid; the swaps shown (to aspartic acid, valine, cysteine) are among the most frequent in cancers, and each bulges into the pocket where KRAS normally switches itself off. Prior, Hood &amp; Hartley (<i>Cancer Research</i>, 2020) estimate that about 19% of people with cancer have a RAS mutation. A broken copy of a tumour suppressor can be lost by a mutation that stops the protein early (a <a href="../dna-to-protein/#nonsense">nonsense</a> or <a href="../dna-to-protein/#frameshift">frameshift</a> mutation), or by losing a piece of the chromosome that carries it.</p>`
		},
		// ------------------------------------------------------------------ evolution
		{
			id: 'driver',
			chapter: 'evolution',
			title: 'One stuck accelerator',
			scene: 'tissue',
			hints: { view: 'driver' },
			duration: 26,
			controls: [again],
			body: `
<p>Now let mutations hit KRAS. Each time a cell divides, there is a small chance that one of the daughters has its accelerator jammed on (yellow). That cell tries to divide more often than its neighbours, so when a gap opens next to it, it is more likely to be the one that fills it.</p>
<p>This is <a href="../evolution/#survival">natural selection</a>, among cells: variation (mutations), inheritance (daughters keep them) and unequal reproduction. Watch the yellow <dfn data-def="A group of cells all descended from one cell, and so sharing its mutations.">clones</dfn> spread. Many new ones still vanish, by bad luck, before they can grow, just as <a href="../evolution/#new-mutation">most new mutations are lost</a> in a population.</p>
<p>But even when yellow cells fill the patch, there is no tumour: they still divide only into free space. The tissue has a new owner, and keeps its size.</p>`,
			notes: `<p>Such silent takeovers really happen. Sequencing of normal tissue from healthy people finds patches of cells carrying cancer driver mutations everywhere: in sun-exposed eyelid skin, over a quarter of the cells carry a cancer-causing mutation (Martincorena et al., <i>Science</i>, 2015), and in the oesophagus of middle-aged and elderly people, clones with such mutations cover much of the lining (Martincorena et al., <i>Science</i>, 2018). In the model, a cell with KRAS on tries to divide with a chance of 70% each generation instead of 50%.</p>`
		},
		{
			id: 'hits',
			chapter: 'evolution',
			title: 'Hit after hit: a tumour',
			scene: 'tissue',
			hints: { view: 'hits' },
			duration: 34,
			controls: [again, rate],
			body: `
<p>Now TP53 can be hit too. A cell with one copy of TP53 hit (outlined) looks like any other. A second hit in the same lineage takes the brake off: the cell no longer dies when it should (orange).</p>
<p>A cell with <strong>both</strong> changes, accelerator on and brakes off, is a cancer cell (red). It divides even when it is surrounded, crowding out its neighbours, and its clone takes over the patch faster than any before it. This is a <dfn data-def="A mass of cells that grows without the normal controls. It is malignant (a cancer) when it can invade the tissue around it and spread.">tumour</dfn>.</p>
<p>The chart shows the waves: each new clone grows inside the one before. Cancer is not one mutation but a sequence of them, each one selected because it lets its cells outgrow the rest. Run it again: the order and the timing change every time. Raise the mutation rate and the tumour comes sooner.</p>`,
			notes: `<p><strong>What the model leaves out.</strong> Real cancers need more changes than two (a typical tumour carries two to eight driver mutations, Vogelstein et al., <i>Science</i>, 2013), for example to recruit blood vessels, to escape the immune system and to invade; here the rule “both drivers and the cell ignores its neighbours” stands for all of them. Mutation rates are thousands of times higher than in real cells, so that the story fits in a minute; time is counted in cell generations, not years; and the patch has a thousand cells, where a real tumour is found at about a billion. In colorectal cancer the usual order is a gene called APC first, then KRAS, then TP53 and others, over decades.</p>`
		},
		{
			id: 'repair',
			chapter: 'evolution',
			title: 'When the repair crew is hit',
			scene: 'tissue',
			hints: { view: 'repair' },
			duration: 32,
			controls: [repair, again],
			body: `
<p>Some genes do neither job directly: they <strong>repair</strong> DNA. One family, the <dfn data-def="A set of proteins that check freshly copied DNA for mismatched letters and correct them. MLH1 and MSH2 are two of its genes.">mismatch-repair</dfn> genes, proofreads every copy. A cell whose repair gene is hit (marked with a dot) gives no advantage by itself, but it and its descendants now mutate 20 times as often.</p>
<p>So the next drivers arrive sooner. The repair defect rides along with the driver mutations it helps to produce, and most tumours in this tissue end up made of dotted cells. Switch the repair gene off and compare the generation at which the tumour is found.</p>
<p>About one colorectal cancer in six is <em>hypermutated</em>, carrying far more mutations than usual, most often because mismatch repair is broken. People with <dfn data-def="An inherited condition in which one copy of a mismatch-repair gene is broken in every cell, which raises the risk of colorectal and some other cancers.">Lynch syndrome</dfn> inherit one broken copy of such a gene.</p>`,
			notes: `<p>The Cancer Genome Atlas Network (<i>Nature</i> 487:330, 2012) found 16% of colorectal cancers hypermutated: three quarters of these with the signature of broken mismatch repair, usually because the MLH1 gene has been switched off, the rest with mutations in repair genes or in the DNA-copying enzyme polymerase ε. Like a tumour suppressor, a repair gene normally fails only when both copies are lost; the model counts it as one event. The factor of 20 is the model's choice.</p>`
		},
		// ------------------------------------------------------------------ odds
		{
			id: 'age',
			chapter: 'odds',
			title: 'Mostly a disease of old age',
			scene: 'age',
			duration: 28,
			controls: [site, hits],
			body: `
<p>If a cancer needs several rare hits in one lineage, it should take a long time, and the risk should climb steeply with age. The dots are real: new cases per 100,000 people a year in the United States, by age, from the SEER cancer registries (2018–2022).</p>
<p>Both axes are <dfn data-def="Each gridline is ten times the one before. A quantity that grows as a power of age, age², age³…, becomes a straight line whose slope is the power.">logarithmic</dfn>. In 1954 Armitage and Doll noticed that on such a chart many cancers fall on a straight line. That is what a sequence of <em>k</em> random steps predicts: the risk rises as age to the power k − 1. For colorectal cancer the best line has k ≈ <strong>5</strong>: double your age and the yearly risk rises about sixteenfold. Pancreatic cancer gives six or seven.</p>
<p>Change k and see the line tilt. Then look at childhood leukaemia: it does not fit at all.</p>`,
			notes: `<p>Armitage &amp; Doll, “The age distribution of cancer and a multi-stage theory of carcinogenesis”, <i>British Journal of Cancer</i> 8:1 (1954). If each of k steps happens at a small constant rate u per year, the chance of having completed all of them by age t is about (ut)<sup>k</sup>/k!, so the yearly rate is about u<sup>k</sup>t<sup>k−1</sup>/(k−1)!. The line is fitted to ages 30–79. <em>k</em> counts the <em>rate-limiting</em> steps: clones that grow between hits, as in the simulation, make fewer steps look like more or fewer, so k is not a count of mutations. Reading the data: the 50–54 point is pushed up by screening, which in the US starts at 45–50 and finds tumours earlier; above about 85 the rates level off. Childhood leukaemia often starts with a change before birth, and needs only one or two more. Data: SEER*Explorer, National Cancer Institute (November 2024 submission), observed rates, both sexes, all races, all stages.</p>`
		},
		{
			id: 'knudson',
			chapter: 'odds',
			title: 'Born with one hit',
			scene: 'knudson',
			duration: 26,
			controls: [inherited, children],
			body: `
<p><dfn data-def="A cancer of the retina, the light-sensitive layer at the back of the eye, that occurs in young children.">Retinoblastoma</dfn> is a rare eye cancer of small children. In 1971 Alfred Knudson noticed that children whose families had it got tumours younger and often in <em>both</em> eyes, while the others got one tumour, in one eye, later.</p>
<p>His explanation was two hits in the same gene, now known to be <strong>RB1</strong>. A child who inherits one broken copy carries the first hit in every cell of the retina: one more hit, in any of millions of cells, is enough. Knudson calculated an average of <strong>three</strong> tumours per such child. Then by chance about 5% of them have none, about 35% have tumours in one eye and about 60% in both. A child born with two working copies needs both hits in the same cell, which almost never happens.</p>
<p>Each pair of circles is a child's two eyes, and each red spot a tumour. Draw more children, or switch the inherited hit off.</p>`,
			notes: `<p>Knudson, “Mutation and cancer: statistical study of retinoblastoma”, <i>PNAS</i> 68:820 (1971). With a Poisson number of tumours of mean 3, shared between two eyes (1.5 each), the chance that an eye is spared is e<sup>−1.5</sup> ≈ 0.22: no tumour in either eye for 0.22² ≈ 5% of carriers, both eyes for 0.78² ≈ 60%. The same logic explains families with an inherited broken TP53 (Li–Fraumeni syndrome), BRCA1 or BRCA2 (breast and ovarian cancer) or a mismatch-repair gene (Lynch syndrome): one hit is already there, so cancers come earlier and more often. The inherited risks are real, but most cancers arise in people who inherited no such mutation.</p>`
		},
		// ------------------------------------------------------------------ treatment
		{
			id: 'treat',
			chapter: 'treatment',
			title: 'Treatment, and the cells that survive it',
			scene: 'tissue',
			hints: { view: 'treat' },
			duration: 36,
			controls: [treat, again],
			body: `
<p>Now the tumour is treated as soon as it is found. The drug kills cancer cells, and the tumour shrinks.</p>
<p>But look at the blue cells. They are cancer cells that, by a chance mutation, are <strong>resistant</strong> to the drug. Usually they were there <em>before</em> the first dose; sometimes one arises from a cancer cell that survives the first doses. Either way the drug does not create them: they arise by chance, and the drug picks them out, just as an <a href="../evolution/#antibiotics">antibiotic selects resistant bacteria</a>. With their competitors gone, they regrow, and the tumour comes back, made of cells the drug cannot touch.</p>
<p>Switch the treatment off to see the untreated tumour, and run it again: sometimes no resistant cell is there in time and the tumour is cleared.</p>`,
			notes: `<p>Goldie &amp; Coldman (<i>Cancer Treatment Reports</i>, 1979) applied the Luria–Delbrück reasoning of the <a href="../evolution/#blind">evolution page</a> to tumours: a tumour of a billion cells, found at about a centimetre across, almost always already contains cells resistant to any one drug. In the model a cancer cell becomes resistant with a chance of 0.3% per division, much more often than in reality to make up for its tiny size; the drug kills 60% of the cancer cells that do not resist it each generation, and none of the healthy ones. Real drugs also harm healthy dividing cells, which is why they cause side effects. The immune system also attacks tumour cells, which the model leaves out.</p>`
		},
		{
			id: 'combo',
			chapter: 'treatment',
			title: 'Two drugs at once',
			scene: 'tissue',
			hints: { view: 'combo' },
			duration: 34,
			controls: [therapy, treat, again],
			body: `
<p>Resistance to one drug is a rare event, but in a big tumour rare events happen. Resistance to two unrelated drugs <em>in the same cell</em> is rarer still: roughly the product of the two chances.</p>
<p>Give two drugs at once. A cell resistant to only one of them (light blue ring) is still killed, and the tumour is usually cleared. Over 30 runs of this model, one drug failed to clear the tumour 18 times (three in five), two drugs 3 times (one in ten). Press “Run again” a few times and count.</p>
<p>This is why many cancers, like tuberculosis and HIV, are treated with combinations of drugs. It is also why finding a cancer early matters: a smaller tumour has had fewer divisions in which to produce resistant cells.</p>`,
			notes: `<p>The counts come from 30 runs of the model with different random seeds (the model tests check them). Real treatment is decided by doctors for each patient and cancer, and includes surgery and radiotherapy, which remove or kill the cells whatever their mutations; this page is not medical advice. Newer approaches use evolution deliberately, for example by timing doses so that sensitive cells keep resistant ones in check (adaptive therapy).</p>`
		},
		{
			id: 'recap',
			chapter: 'treatment',
			title: 'Evolution inside the body',
			scene: 'tissue',
			hints: { view: 'recap' },
			duration: 36,
			controls: [again],
			body: `
<p>The whole story in one run, with every gene able to change and one drug given when the tumour is found. The chart marks the events.</p>
<ol>
<li>Cells divide to keep a tissue in balance, and every division risks a mutation, blind to whether it helps or harms.</li>
<li>A mutation in a gene that controls division lets a clone outgrow its neighbours: <strong>selection</strong>.</li>
<li>Inside that clone, further hits add up, sooner if repair is broken, until one lineage ignores its neighbours: a <strong>tumour</strong>. That takes many divisions, which is why cancer is mostly a disease of old age, and why inherited first hits and DNA-damaging exposures bring it earlier.</li>
<li>Treatment is selection too: it removes the cells it can kill and leaves those it cannot.</li>
</ol>
<p>Cancer is evolution inside the body: cells that acquire mutations letting them divide unchecked outgrow their neighbours.</p>`,
			notes: `<p>Peter Nowell described cancer as clonal evolution in 1976 (“The clonal evolution of tumor cell populations”, <i>Science</i> 194:23). Much of cancer risk is out of anyone's control (Tomasetti &amp; Vogelstein, <i>Science</i>, 2015, found that the lifetime risk of cancer in a tissue correlates (0.81) with the number of stem-cell divisions in it), but not all: tobacco smoke, ultraviolet light and some infections add mutations or divisions, and in this model any extra mutation brings the tumour sooner. This page explains mechanisms; it is not medical advice.</p>`
		}
	]
};
