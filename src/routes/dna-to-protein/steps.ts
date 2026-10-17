import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';
import { translate } from './genetics';
import { GENE_OPTIONS, geneOf } from './genes';

const gene: Control = {
	type: 'select',
	id: 'gene',
	label: 'Gene',
	default: 'hbb',
	options: GENE_OPTIONS,
	help: 'Two real genes, or a sequence you type in the box on the stage (letters A, C, G, T).'
};

/** Number of codons the ribosome reads in the chosen gene (stop codon included). */
function codonCount(params: Params): number {
	return Math.max(1, translate(geneOf(params, true).mrna).codons.length);
}

const codon: Control = {
	type: 'range',
	id: 'codon',
	label: 'Codons read',
	min: 1,
	max: 160,
	bounds: (params) => [1, codonCount(params)],
	step: 1,
	default: 1,
	help: 'Step the ribosome along the message one codon at a time (arrow keys on the slider).'
};

const copyAuto: Control = {
	type: 'toggle',
	id: 'copy-auto',
	label: 'Copy by itself',
	default: true,
	help: 'Off: the slider below sets how many letters are copied. Moving the slider turns this off.'
};

const copied: Control = {
	type: 'range',
	id: 'copied',
	label: 'Letters copied',
	min: 0,
	max: 1700,
	bounds: (params) => [0, geneOf(params, true).transcribed.length],
	step: 1,
	default: 0,
	format: (v) => `${v.toLocaleString('en-US')} letters`,
	help: 'Step the polymerase along the gene one letter at a time (arrow keys on the slider).'
};

const edit: Control = {
	type: 'select',
	id: 'edit',
	label: 'Edit',
	default: 'sub',
	options: [
		{ value: 'sub', label: 'Change' },
		{ value: 'ins', label: 'Insert' },
		{ value: 'del', label: 'Delete' },
		{ value: 'none', label: 'None' }
	]
};

const base: Control = {
	type: 'select',
	id: 'base',
	label: 'New letter',
	default: 'A',
	options: ['A', 'C', 'G', 'T'].map((b) => ({ value: b, label: b })),
	help: 'For a change or an insertion.'
};

/** Letter of the message to edit, 1-based (the stage shows its coding-DNA name too). */
const at: Control = {
	type: 'range',
	id: 'at',
	label: 'Position',
	min: 1,
	max: 640,
	bounds: (params) => [1, Math.max(1, geneOf(params, true).mrna.length)],
	step: 1,
	default: 71,
	format: (v) => `letter ${v}`,
	help: 'Counts from the first letter of the message (the stage also gives the c. number). Or click a letter on the stage.'
};

export const spec: ExplainerSpec = {
	slug: 'dna-to-protein',
	title: 'DNA to protein',
	summary:
		'Follow a real human gene from DNA to protein: copied into RNA, edited, read three letters at a time by a ribosome with the genetic code. Then change, insert or delete one letter and see the protein survive, change or fall apart.',
	chapters: [
		{ id: 'code', title: 'A code in four letters' },
		{ id: 'transcription', title: 'DNA to RNA' },
		{ id: 'translation', title: 'RNA to protein' },
		{ id: 'mutations', title: 'One letter changed' }
	],
	steps: [
		// ------------------------------------------------------------------ code
		{
			id: 'letters',
			chapter: 'code',
			title: 'A four-letter alphabet',
			scene: 'dna',
			hints: { phase: 'letters' },
			duration: 20,
			body: `
<p>In <a href="../the-cell/#dna">the cell</a> we zoomed into the nucleus and found <strong>DNA</strong>, a twisted ladder two metres long. Here is a short piece of it, untwisted and laid flat. Each rung is a pair of <dfn data-def="The ‘letters’ of DNA: four small molecules called adenine (A), thymine (T), cytosine (C) and guanine (G).">bases</dfn>, and the pairs always match: <strong>A</strong> with <strong>T</strong>, and <strong>C</strong> with <strong>G</strong>. So each strand fixes the other: read one and you know its partner.</p>
<p>The information is in the <em>order</em> of the letters along a strand. These are real letters of the human <dfn data-def="The gene HBB on chromosome 11. It makes β-globin, one of the four protein chains of haemoglobin, the molecule that carries oxygen in red blood cells.">β-globin gene</dfn>, which makes part of <strong>haemoglobin</strong>, the protein that carries oxygen in red blood cells. They are taken from just where its instructions begin: after six letters come ATG, the start. The instructions take 444 letters. One copy of our genome (23 chromosomes) holds about 3 billion letters, and only about 1–2% of them spell out proteins.</p>
<p>The two strands run in opposite directions. Chemists mark the ends <strong>5′</strong> and <strong>3′</strong> (“five prime”, “three prime”), and the cell always builds new DNA and RNA from the 5′ end towards the 3′ end; that is why a polymerase reads its template strand the other way, 3′ to 5′.</p>`,
			notes: `<p>The sequence is the start of HBB as recorded in NCBI RefSeq NM_000518.5 (the messenger RNA) and the Ensembl genome annotation (transcript ENST00000335295, GRCh38): the first 50 letters lead up to the start of the instructions, which begin at the letters ATG. A human cell holds two copies of the genome, about 6.4 billion letter pairs in all. The 5′ and 3′ names come from the numbering of the carbon atoms in the sugar of each letter: each strand has a free 5′ carbon at one end and a free 3′ carbon at the other.</p>`
		},
		{
			id: 'triplets',
			chapter: 'code',
			title: 'Three letters per word',
			scene: 'dna',
			hints: { phase: 'triplets' },
			duration: 20,
			body: `
<p>Many genes are recipes for <a href="../the-cell/#ribosomes">proteins</a>, and a protein is a chain of <dfn data-def="The 20 small building blocks of proteins. Each has the same backbone and a different side chain, which may be water-repelling, water-loving, or electrically charged.">amino acids</dfn> of 20 kinds. How can four letters name twenty things?</p>
<ul>
<li>one letter at a time gives only <strong>4</strong> words;</li>
<li>two letters give 4 × 4 = <strong>16</strong>, still too few;</li>
<li>three letters give 4 × 4 × 4 = <strong>64</strong>: enough, with plenty to spare.</li>
</ul>
<p>So the cell reads its genes in words of three letters, called <dfn data-def="Three letters of DNA or RNA that stand for one amino acid, or for ‘stop’.">codons</dfn>, one after the other, with no gaps and no commas, starting from a fixed point. That starting point matters: the same letters grouped from one letter later spell entirely different words.</p>`,
			notes: `<p>That the code is read in non-overlapping triplets from a fixed start was shown in 1961 by Francis Crick, Sydney Brenner and colleagues, using exactly the kind of one-letter insertions and deletions in a virus gene that we will meet at the end. The same year Marshall Nirenberg and Heinrich Matthaei made the first ‘word’ readable: an RNA of only U letters made a chain of only phenylalanine, so UUU means phenylalanine.</p>`
		},
		// ------------------------------------------------------------------ transcription
		{
			id: 'transcribe',
			chapter: 'transcription',
			title: 'Copying a gene into RNA',
			scene: 'transcribe',
			duration: 85,
			controls: [gene, copyAuto, copied],
			body: `
<p>DNA never leaves the nucleus. To use a gene, the cell makes a working copy of it in <dfn data-def="Ribonucleic acid: a single-stranded cousin of DNA, with U (uracil) in place of T.">RNA</dfn>. This is <strong>transcription</strong>.</p>
<p>An enzyme, <dfn data-def="The enzyme that unzips a short stretch of DNA and builds an RNA copy of one strand, letter by letter.">RNA polymerase</dfn>, opens a short bubble in the double helix and reads one strand, the <strong>template strand</strong>. For each letter it adds the matching RNA letter: G for C, C for G, A for T, and <strong>U</strong> (uracil) for A, because RNA uses U instead of T. It reads the template from 3′ to 5′ and builds the RNA from 5′ to 3′, then the DNA zips up again behind it.</p>
<p>The RNA comes out with the same letters as the other DNA strand, the <strong>coding strand</strong>, only with U for T. In our cells the polymerase copies about 500–4,000 letters a minute; here it runs at 1,200. Pick a gene: β-globin, a short bacterial gene, or type your own. To follow it letter by letter, move the <strong>Letters copied</strong> slider: the polymerase stops and steps with it.</p>`,
			notes: `<p>Human genes that code for proteins are copied by RNA polymerase II, a machine of 12 proteins; the drawing is schematic. It starts at a <dfn data-def="A stretch of DNA just before a gene where proteins gather to start the polymerase.">promoter</dfn> before the gene and copies the whole gene, introns included (next step). Elongation rates measured in human cells range from about 0.5 to 4 kilobases per minute (Jonkers &amp; Lis, Nat. Rev. Mol. Cell Biol. 2015). The β-globin sequence shown is the gene from its transcription start, GRCh38 chr11:5,225,464–5,227,071 (minus strand). trpL is the 45-letter gene of the <i>E. coli</i> trp leader peptide (RefSeq NC_000913.3); bacteria have no nucleus, so their ribosomes start reading an RNA while it is still being made. Only trpL’s 45 coding letters are shown; the real RNA starts a little earlier and continues into the next genes of the operon.</p>`
		},
		{
			id: 'splice',
			chapter: 'transcription',
			title: 'Editing the message and sending it out',
			scene: 'splice',
			duration: 22,
			body: `
<p>The β-globin gene is 1,608 letters long, yet the message the ribosomes read is only 628. Our genes come in pieces: the parts that are kept, the <dfn data-def="The parts of a gene that remain in the finished messenger RNA.">exons</dfn>, are interrupted by <dfn data-def="Stretches inside a gene that are copied into RNA and then cut out.">introns</dfn>. β-globin has three exons and two introns, of 130 and 850 letters, drawn here to scale.</p>
<p>As the copy is being made and just after, the introns are cut out and the exons joined: <dfn data-def="Cutting the introns out of a freshly made RNA and joining its exons.">splicing</dfn>. The cell also puts a <strong>cap</strong> on the 5′ end and a <strong>tail</strong> of A letters on the 3′ end, which protect the message and help ribosomes find it. The finished <dfn data-def="Messenger RNA: the edited working copy of a gene that a ribosome reads.">messenger RNA</dfn> (mRNA) leaves the nucleus through a <a href="../the-cell/#nucleus">nuclear pore</a>.</p>
<p>Not all of it is instructions: 50 letters before the start codon and 134 after the stop codon help control how the message is used. The protein is spelled by the 444 letters in between.</p>`,
			notes: `<p>Exons of HBB transcript ENST00000335295 (Ensembl release 116): 142, 223 and 263 letters; introns 130 and 850. Joined, the exons are exactly RefSeq NM_000518.5, whose coding part runs from letter 51 to 494. The tail is not encoded in the gene: about 200 A letters are added by an enzyme after the RNA is cut at a signal near its end (AATAAA, letters 602–607). Bacterial genes such as trpL have no introns and no cap.</p>`
		},
		// ------------------------------------------------------------------ translation
		{
			id: 'code-table',
			chapter: 'translation',
			title: 'The genetic code',
			scene: 'table',
			duration: 24,
			body: `
<p>Here are all 64 codons, written in RNA letters. Find a codon by its first letter (the row band on the left), its second letter (the column) and its third letter (the line inside the box).</p>
<p><strong>61</strong> codons stand for an amino acid; <strong>3</strong>, UAA, UAG and UGA, mean <strong>stop</strong>. AUG, for methionine, also marks where the instructions <strong>start</strong>. Most amino acids have several codons, and they usually differ only in the third letter: look at the boxes, each of which holds the codons of one amino acid. Leucine, serine and arginine have six codons each; methionine and tryptophan only one.</p>
<p>Click any codon. The colours sort the amino acids by their side chains: water-repelling, water-loving, and electrically charged. Almost every living thing, from bacteria to us, uses this same table.</p>`,
			notes: `<p>This is NCBI translation table 1, “The Standard Code”. A few genomes use small variants of it: our mitochondria, for example, read UGA as tryptophan instead of stop (table 2). Bacteria use table 11, which assigns every codon exactly as table 1 does and differs only in which codons can serve as a start. The grouping of the side chains follows the usual textbook one (tyrosine with the water-loving ones, glycine with the water-repelling ones).</p>`
		},
		{
			id: 'ribosome',
			chapter: 'translation',
			title: 'Reading codon by codon',
			scene: 'translate',
			hints: { mode: 'manual' },
			duration: 26,
			controls: [codon, gene],
			body: `
<p>In the cytoplasm a <a href="../the-cell/#ribosomes">ribosome</a> clamps onto the mRNA near its 5′ end and slides along until it finds the first <strong>AUG</strong>. From there it reads three letters at a time. This is <strong>translation</strong>.</p>
<p>Each codon is matched by a <dfn data-def="Transfer RNA: a small folded RNA with three letters (the anticodon) at one end and the matching amino acid at the other.">transfer RNA</dfn> (tRNA), an adapter that carries an amino acid at one end and, at the other, three letters, the <strong>anticodon</strong>, that pair with the codon. The ribosome joins the new amino acid to the growing chain, lets go of the empty tRNA and moves three letters along.</p>
<p>Step through the message with the slider. The code table lights up the codon being read: the table is, in effect, the list of which tRNA carries which amino acid.</p>`,
			notes: `<p>The ribosome holds two tRNAs at a time, in its P site (holding the chain) and A site (bringing the next amino acid), plus a third on its way out (E site). It actually covers about 30 letters of mRNA; the drawing shows a few codons. The ‘dictionary’ is held by 20 enzymes, the aminoacyl-tRNA synthetases, each of which loads one amino acid onto its own tRNAs. Many tRNAs pair loosely at the third letter (‘wobble’), so one tRNA can read several codons; the drawing shows exact pairing.</p>`
		},
		{
			id: 'protein',
			chapter: 'translation',
			title: 'To the stop codon',
			scene: 'translate',
			hints: { mode: 'auto' },
			duration: 60,
			controls: [gene],
			body: `
<p>Now the whole message, at half the real speed: a ribosome in our cells adds about 6 amino acids a second, so the 147 of β-globin take under half a minute.</p>
<p>At a stop codon no tRNA fits. A <dfn data-def="A protein shaped like a tRNA that fits a stop codon and makes the ribosome let go of the finished chain.">release factor</dfn> binds instead, the chain is let go, and the ribosome falls off the message. The chain folds into its working shape (for β-globin, the first methionine is trimmed off while the chain is still emerging), and four such chains (two α, two β) make one haemoglobin.</p>
<p>Try the bacterial gene, 14 amino acids, or type your own sequence on the stage. As in our cells, the ribosome starts at the first AUG; if there is no stop codon in its frame, it runs off the end.</p>`,
			notes: `<p>Elongation rate: 5.6 amino acids per second in mouse cells, measured by ribosome profiling (Ingolia, Lareau &amp; Weissman, Cell 2011); bacteria are faster, 10–20 per second. Many ribosomes read the same message at once, one behind the other. Because the first methionine is removed, haemoglobin specialists number β-globin from the next amino acid (valine): the 146 amino acids of the finished chain.</p>`
		},
		// ------------------------------------------------------------------ mutations
		{
			id: 'silent',
			chapter: 'mutations',
			title: 'A change that does nothing',
			scene: 'mutate',
			hints: { variant: 'silent' },
			duration: 22,
			body: `
<p>DNA is copied before every cell division, and now and then a letter comes out wrong. Such a change is a <dfn data-def="A change in the sequence of DNA.">mutation</dfn>. What does a one-letter change do to the protein?</p>
<p>Often, nothing. Here letter 9 of the β-globin instructions is a C instead of a T: codon 3 reads CAC instead of CAU, and both mean histidine. The protein is identical. Geneticists write this change <strong>c.9T>C</strong>, as on the stage: letter 9 counting from the A of AUG, T changed to C. It is real and harmless. Both spellings are common: worldwide about one copy of the gene in five has the T of the reference sequence, and the rest have C.</p>
<p>This is the redundancy of the table at work. Of the 1,332 possible one-letter changes in β-globin’s 444 letters, <strong>325</strong> (about a quarter) leave the protein unchanged, and 306 of those are in the third letter of a codon.</p>`,
			notes: `<p>The variant is dbSNP rs713040, NM_000518.5:c.9T>C (p.His3=), classified benign in ClinVar; the reference letter T is the less common one, on about 18% of gene copies worldwide (gnomAD genomes) and about half in Korean, Japanese and Vietnamese samples. Names like c.9T>C count letters from the A of the start codon (c.1). Silent changes are not always perfectly silent: a few alter how the message is spliced or how fast it is read.</p>`
		},
		{
			id: 'missense',
			chapter: 'mutations',
			title: 'One amino acid swapped: sickle cell',
			scene: 'mutate',
			hints: { variant: 'missense' },
			duration: 22,
			body: `
<p>Change letter 20 of the instructions from A to T and codon 7 reads GUG instead of GAG: <strong>valine</strong> instead of <strong>glutamic acid</strong>. The protein is the same length, with one amino acid in 147 different.</p>
<p>That one swap matters, because the two are very different: glutamic acid is charged and water-loving, valine water-repelling. When oxygen runs low, haemoglobin with this valine sticks to itself in long fibres that bend red blood cells into stiff sickles, which block small blood vessels. People with two copies have <strong>sickle cell disease</strong>.</p>
<p>Carrying one copy protects against severe malaria, which is why the change is common where malaria is. Doctors call it <strong>β6 Glu→Val</strong>: they number from the amino acid after the trimmed methionine.</p>`,
			notes: `<p>HbS, NM_000518.5:c.20A>T (p.Glu7Val), ClinVar 15333. Its link to malaria, first proposed by Anthony Allison in 1954, is one of the best-documented cases of natural selection in humans. Not every swap is harmful: many change an amino acid for a similar one and make little difference.</p>`
		},
		{
			id: 'nonsense',
			chapter: 'mutations',
			title: 'An early stop',
			scene: 'mutate',
			hints: { variant: 'nonsense' },
			duration: 22,
			body: `
<p>Now letter 118 of the instructions changes from C to T. Codon 40 was CAG, glutamine; it becomes <strong>UAG</strong>, a <strong>stop</strong>. The ribosome lets go of the chain after 39 amino acids, about a quarter of the protein, and the stub is useless.</p>
<p>People with two such copies make no β-globin at all: <dfn data-def="An inherited anaemia in which too little β-globin is made.">β-thalassaemia</dfn>, a severe anaemia treated with regular blood transfusions. This mutation is common around the Mediterranean, above all in Sardinia.</p>
<p>Only 34 of the 1,332 possible one-letter changes in β-globin make a stop codon, and almost all of them destroy the protein. The exceptions sit at the very end: a stop in place of the last-but-one amino acid (the real Hb McKees Rocks) removes just the last two, and that haemoglobin still works, though it holds on to oxygen too tightly.</p>`,
			notes: `<p>NM_000518.5:c.118C>T (p.Gln40Ter), ClinVar 15402, called β⁰39 in the traditional numbering. In practice the cell rarely even makes the stub: messages with an early stop codon are detected and destroyed (nonsense-mediated decay).</p>`
		},
		{
			id: 'frameshift',
			chapter: 'mutations',
			title: 'One letter lost: everything after it scrambled',
			scene: 'mutate',
			hints: { variant: 'frameshift' },
			duration: 24,
			body: `
<p>Delete a single letter, the A at letter 20 of the instructions, and every codon after it is read from one letter later. The brackets slip: GAG GAG AAG TCT… becomes GGG AGA AGT CTG… and every amino acid from there on is wrong. A stop codon soon turns up in the new frame, and the protein ends after 18 amino acids, 12 of them nonsense.</p>
<p>This is a <dfn data-def="An insertion or deletion of a number of letters that is not a multiple of three, which shifts how all later letters are grouped into codons.">frameshift</dfn>. Inserting a letter does the same. This exact deletion is another cause of β-thalassaemia.</p>
<p>Compare the bars: a one-letter change did nothing, changed one amino acid, or cut the protein short; one letter lost scrambles everything after it. Because the code is read three letters at a time, with no commas, where a change falls in its codon and whether it shifts the frame decides what it does.</p>`,
			notes: `<p>NM_000518.5:c.20del (p.Glu7fs), ClinVar 15418, the “codon 6 (−A)” β-thalassaemia mutation. Crick and Brenner used this logic in 1961: one or two letters added or removed wrecked a virus gene, but three together usually gave a working protein again, because the frame was restored after a short stretch. That is how they knew the words have three letters.</p>`
		},
		{
			id: 'lab',
			chapter: 'mutations',
			title: 'Edit a gene yourself',
			scene: 'mutate',
			hints: { variant: 'lab' },
			duration: 30,
			controls: [edit, base, at, gene],
			body: `
<p>Your turn. Click any letter of the message (or use the position slider, which counts from the first letter of the message: β-globin’s instructions start at letter 51), choose to change it, insert a letter before it or delete it, and compare the two proteins. Try the third letter of a codon, then the first; try deleting a letter near the start, then near the end.</p>
<p>You can also pick the bacterial gene or your own sequence. Edits outside the instructions, before the start codon or after the stop, leave the protein alone, unless they create a new AUG ahead of the real one; break the start codon and the ribosome starts at the next AUG instead.</p>
<p>That is the whole story: DNA stores instructions in a four-letter code read three letters at a time, so a one-letter change can do nothing, alter one amino acid, or scramble everything after it.</p>`,
			notes: `<p>What is simplified: the ribosome here always starts at the first AUG and the protein is compared letter by letter. In real cells the letters around an AUG affect whether it is used, changes near the edges of exons can break splicing, and changes outside the coding part can still alter how much protein is made. Which changes matter for health is decided by evidence, recorded in databases such as ClinVar.</p>`
		}
	]
};
