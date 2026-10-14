import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { CHAINS } from './folding';

const show: Control = {
	type: 'select',
	id: 'show',
	label: 'Show',
	default: 'all',
	options: [
		{ value: 'all', label: 'All' },
		{ value: 'buried', label: 'Buried' },
		{ value: 'surface', label: 'On the surface' }
	],
	help: 'Buried: less than a fifth of its surface touches water.'
};

const chain: Control = {
	type: 'select',
	id: 'chain',
	label: 'Chain',
	default: 'a',
	options: CHAINS.map((c) => ({ value: c.id, label: `${c.label}: ${c.seq}` }))
};

const straighten: Control = {
	type: 'action',
	id: 'straighten',
	label: 'Start again',
	action: 'Straighten the chain'
};

const temp: Control = {
	type: 'range',
	id: 'temp',
	label: 'Temperature',
	min: 0.1,
	max: 2,
	step: 0.05,
	default: 0.3,
	format: (v) => `${v.toFixed(2)} ε/k`,
	help: 'In the model’s own units: at 1 the jiggling is as strong as one contact.'
};

const rerun: Control = {
	type: 'action',
	id: 'rerun',
	label: 'Run again',
	action: 'Unfold and run again',
	help: 'The same rules, different luck.'
};

const length: Control = {
	type: 'range',
	id: 'length',
	label: 'Chain length',
	min: 4,
	max: 150,
	step: 1,
	default: 14,
	format: (v) => `${v} amino acids`
};

const protein: Control = {
	type: 'select',
	id: 'protein',
	label: 'Protein',
	default: 'globin',
	options: [
		{ value: 'globin', label: 'β-globin' },
		{ value: 'lysozyme', label: 'Lysozyme' },
		{ value: 'p53', label: 'p53' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'protein-folding',
	title: 'Protein folding',
	summary:
		'Fold a chain of water-loving and water-repelling beads by hand against an energy score, then let it fold itself. See why trying every shape would take longer than the age of the universe, and compare real proteins with the shapes AlphaFold predicts for them.',
	chapters: [
		{ id: 'shape', title: 'From chain to shape' },
		{ id: 'hand', title: 'Fold it yourself' },
		{ id: 'itself', title: 'Folding on its own' },
		{ id: 'predict', title: 'Predicting the shape' }
	],
	steps: [
		// ------------------------------------------------------------------ shape
		{
			id: 'chain',
			chapter: 'shape',
			title: 'A chain folds into a machine',
			scene: 'protein',
			hints: { colour: 'ss' },
			duration: 24,
			body: `
<p>In <a href="../dna-to-protein/#protein">DNA to protein</a> a ribosome strung together the 147 amino acids of β-globin and let the chain go. A chain is not yet a working protein. Within moments it folds into one particular compact shape, the one drawn here, measured by X-ray crystallography. The line runs through the 146 amino acids the experiment located, one bend per amino acid; drag the drawing to turn it.</p>
<p>Most of the chain is wound into eight <dfn data-def="A stretch of chain wound into a right-handed spiral, 3.6 amino acids per turn, held by hydrogen bonds between every fourth amino acid.">α-helices</dfn>, packed around a pocket. The pocket holds <strong>haem</strong>, a flat ring with an iron atom at its centre, and that iron is where oxygen binds. Four such folded chains make one haemoglobin.</p>
<p>That is the whole idea of this page: the order of the amino acids decides the shape, and the shape decides what the protein can do. A β-globin chain that is not folded carries no oxygen.</p>`,
			notes: `<p>Structure: PDB entry 2DN2, human deoxyhaemoglobin at 1.25 Å resolution (Park et al., J. Mol. Biol. 2006), chain B; only the position of each amino acid’s central carbon atom (Cα) is drawn, about 3.8 Å apart along the chain. Helices as annotated in the entry; some neighbouring helices, which the textbooks name A to H, run into one another there. The first methionine was trimmed off in the cell, so the measured chain starts at the valine. 1 Å (ångström) = 0.1 nanometres; the whole chain spans about 4.5 nm.</p>`
		},
		{
			id: 'inside-out',
			chapter: 'shape',
			title: 'Oily inside, watery outside',
			scene: 'protein',
			hints: { colour: 'kind' },
			duration: 26,
			controls: [show],
			body: `
<p>What decides the shape? The cell is mostly water, and water is <a href="../chemical-bonds/#properties">polar</a>: its molecules cling to each other and to other polar or charged groups, but not to oily ones, as with oil in water. Now the amino acids are coloured as in the genetic-code table: <strong>water-repelling</strong> (yellow), <strong>water-loving</strong> (green) and <strong>charged</strong> (blue and red).</p>
<p>Show only the <strong>buried</strong> amino acids, then only the ones <strong>on the surface</strong>. The water-repelling ones are mostly hidden inside, and the charged ones are almost all outside, touching water. Folding is largely the chain burying its oily parts, the <dfn data-def="The tendency of water-repelling molecules or groups to cluster together in water: water molecules around them lose freedom, and clustering frees them.">hydrophobic effect</dfn>. Hydrogen bonds between the backbone’s N–H and C=O groups then hold helices and sheets in shape.</p>
<p>One exception is famous: β6 (amino acid 7 here), the glutamic acid on the surface that sickle-cell disease turns into a water-repelling valine. That oily patch outside makes haemoglobin molecules stick to each other.</p>`,
			notes: `<p>“Buried” here means that less than 20% of the amino acid’s surface is reachable by a water molecule, computed for the single chain from every atom of the measured structure (the Shrake–Rupley method, with a 1.4 Å probe for water), relative to the largest surface that amino acid can have (Tien et al., PLoS ONE 2013). Thresholds of 20–25% are common; the pattern is the same with either. In the whole haemoglobin some surface of each chain is also hidden against its partners.</p>`
		},
		// ------------------------------------------------------------------ hand
		{
			id: 'hp-model',
			chapter: 'hand',
			title: 'A protein you can fold by hand',
			scene: 'lattice',
			hints: { mode: 'rules' },
			duration: 22,
			body: `
<p>In 1961 Christian Anfinsen unfolded the enzyme ribonuclease in a test tube with chemicals, then removed them. The chain folded back by itself into its working shape. No machine and no template is needed: the sequence holds all the instructions.</p>
<p>To see how, physicists use a toy protein, the <dfn data-def="A simplified model of protein folding (Ken Dill, 1985): a chain of H and P beads on a grid, scored by the number of H–H contacts.">HP model</dfn>. Each amino acid is a bead on a square grid, either <strong>H</strong> (hydrophobic, water-repelling) or <strong>P</strong> (polar, water-loving). Neighbours along the chain sit on neighbouring grid points, and no two beads may share a point.</p>
<p>The score is the energy: <strong>−1</strong> for every pair of H beads that touch on the grid without being neighbours along the chain (the dotted lines). The lower the energy, the more water-repelling beads are tucked against each other, away from water. The best fold has the lowest energy.</p>`,
			notes: `<p>The HP model is K. A. Dill, Biochemistry 24, 1501 (1985), and Lau &amp; Dill, Macromolecules 22, 3986 (1989). It throws away almost everything: 20 amino acids become 2 letters, space becomes a flat grid, and there are no hydrogen bonds or side-chain shapes. What survives is the main driving force, the hydrophobic effect, and a chain that is small enough to check every possible shape. Anfinsen’s refolding work is summarised in his Nobel lecture: C. B. Anfinsen, Science 181, 223 (1973).</p>`
		},
		{
			id: 'fold',
			chapter: 'hand',
			title: 'Fold it yourself',
			scene: 'lattice',
			hints: { mode: 'fold' },
			duration: 40,
			controls: [chain, straighten],
			body: `
<p>Your turn. <strong>Click a bead</strong> to bend the chain there: each click turns the rest of the chain left, then right, then back to straight (or focus a bead and press Enter). Beads that land on the same grid point turn red; that shape is not allowed.</p>
<p>Try to bring the orange H beads together into a core, with the blue P beads around the outside. The energy counts your contacts. This chain of 14 beads has <strong>110,188</strong> possible shapes, and only <strong>one</strong> of them reaches the lowest energy, <strong>−6</strong>. Can you find it?</p>`,
			notes: `<p>The count is exact: the page lists every self-avoiding walk of 14 beads on the grid, counting a shape and its rotations and mirror images once. Both chains were chosen, among all 14-bead chains with 7 H and 7 P, from the ones whose lowest energy is reached by a single shape, so that each has one “native” fold, as real proteins do. Many HP sequences have several equally good folds instead.</p>`
		},
		{
			id: 'landscape',
			chapter: 'hand',
			title: 'Few good shapes, very many bad ones',
			scene: 'landscape',
			duration: 24,
			controls: [chain],
			body: `
<p>Here are all 110,188 shapes of the chain at once, sorted by energy. Each bar counts the shapes with that energy; the scale goes up ten-fold at each line. Your own fold from the last step is marked.</p>
<p>Most shapes are loose and score 0 or −1. Each step down in energy has far fewer shapes, until at the bottom there is just one. That is what makes a protein reliable: once its chain finds its best fold, every change makes things worse, so it stays.</p>
<p>The picture is often drawn as a <dfn data-def="A sketch of a protein’s energy against how many shapes it can take: wide at the top (many loose, high-energy shapes), narrowing to one shape at the bottom.">folding funnel</dfn>: wide at the top, with many shapes, narrowing to one at the bottom.</p>`,
			notes: `<p>The funnel picture comes from J. D. Bryngelson, J. N. Onuchic, N. D. Socci &amp; P. G. Wolynes, Proteins 21, 167 (1995), and K. A. Dill &amp; H. S. Chan, Nat. Struct. Biol. 4, 10 (1997). Real chains also gain freedom (entropy) when they unfold, which the HP energy leaves out, so a real folded protein is only a little more stable than its unfolded chain.</p>`
		},
		{
			id: 'levinthal',
			chapter: 'hand',
			title: 'Too many shapes to try',
			scene: 'count',
			duration: 26,
			controls: [length],
			body: `
<p>Could a protein find its shape by trying them all? Slide the chain length. On the grid each extra bead multiplies the number of shapes by about <strong>2.6</strong>: 110,188 shapes for 14 beads, about 4 × 10⁴¹ for 100.</p>
<p>A real chain has more freedom. Allow each amino acid just 3 positions, and a chain of 100 has 3¹⁰⁰ ≈ 5 × 10⁴⁷ shapes. Trying 10 trillion of them every second, as fast as atoms can move, would take about <strong>10²⁷ years</strong>, a hundred million billion times the age of the universe. Yet proteins fold in microseconds to seconds.</p>
<p>This is <dfn data-def="Cyrus Levinthal’s observation (1968–69) that a protein cannot find its shape by random search, so folding must follow guided pathways.">Levinthal’s paradox</dfn>. Its answer is the funnel: a chain does not search at random, it goes downhill, keeping each contact that helps.</p>`,
			notes: `<p>Cyrus Levinthal, J. Chim. Phys. 65, 44 (1968) and “How to fold graciously” (1969). The figures (3 states per amino acid, 10¹³ tries a second) are those of R. Zwanzig, A. Szabo &amp; B. Bagchi, PNAS 89, 20 (1992), who showed that a small energy bias against wrong local shapes, a few times the thermal energy, cuts the search to a biologically reasonable time. The grid counts up to 14 beads are exact; longer chains use the known growth law of self-avoiding walks, c(n) ≈ A·μⁿ·n^(11/32) with μ = 2.6381585 (Clisby &amp; Jensen 2012). The fastest small proteins fold in a few microseconds (Kubelka, Hofrichter &amp; Eaton, Curr. Opin. Struct. Biol. 14, 76, 2004).</p>`
		},
		// ------------------------------------------------------------------ itself
		{
			id: 'self-fold',
			chapter: 'itself',
			title: 'Let it fold itself',
			scene: 'mc',
			duration: 40,
			controls: [chain, temp, rerun],
			body: `
<p>Now the chain folds on its own. Like a real molecule, it is jostled all the time by the heat of the water around it, and every jostle tries a small change: a bead flips across a corner, a hairpin swings over, or a piece of the chain turns about one bead.</p>
<p>The rule is the one physicists use to simulate molecules, the <dfn data-def="A recipe for simulating a system at a temperature: always accept a change that lowers the energy; accept one that raises it by ΔE with probability e^(−ΔE/kT).">Metropolis rule</dfn>: a change that lowers the energy always happens; one that raises it happens only sometimes, less often the bigger the cost and the colder it is. Watch the energy trace drop as the orange H beads find each other, down to −6, the chain’s one best fold. The jostling still knocks it out now and then, but it keeps coming back and spends most of its time there.</p>
<p>It never comes near trying all 110,188 shapes: each step downhill is kept, and the chain is guided to the bottom. That is the way out of Levinthal’s paradox.</p>`,
			notes: `<p>A Metropolis Monte Carlo simulation (Metropolis et al., J. Chem. Phys. 21, 1087, 1953) of the HP model, with the moves of Lau &amp; Dill (end moves, corner flips, crankshafts) and pivot moves, which together can reach every shape. Each frame shows 50 tried moves. The temperature is in the model’s own units, ε/k (ε is the energy of one contact, k Boltzmann’s constant); it is not a temperature in degrees. Real folding is far richer: water, side chains and hydrogen bonds are all left out here.</p>`
		},
		{
			id: 'heat',
			chapter: 'itself',
			title: 'Too hot, too cold',
			scene: 'mc',
			duration: 40,
			controls: [temp, chain, rerun],
			body: `
<p>Turn up the temperature. Above about 0.6 the jostling wins: the chain keeps folding and unfolding, and spends hardly any time in its best fold. This is <dfn data-def="Loss of a protein’s folded shape, by heat or chemicals, without breaking its chain.">denaturing</dfn>, what happens to egg white in a hot pan. Most proteins unfold well below the boiling point of water; egg white’s chains then tangle with each other and never come back.</p>
<p>Now turn it right down, below 0.2, and run again. Changes that cost energy almost never happen, so the chain can get stuck in a fold that is good but not the best, a <dfn data-def="A wrong fold that is stable enough that the chain stays in it for a long time.">misfold</dfn>. Try chain B, whose wrong folds are especially sticky.</p>
<p>Real cells have helpers for this, <dfn data-def="Proteins that help other proteins fold, often by giving a stuck chain a fresh chance.">chaperones</dfn>. Misfolded proteins that clump together are behind diseases such as Alzheimer’s and Parkinson’s.</p>`,
			notes: `<p>The two chains have the same beads in a different order, and each has a single best fold, a different one: the sequence, not the composition, decides the shape. In this model a cold run of chain B often settles into one of its 28 folds at −5, one contact short of its best, and stays there for the whole run: escaping means first breaking a contact, which almost never happens when it is cold. Clumps of misfolded proteins (amyloid fibres) are found in the brains of people with Alzheimer’s (amyloid-β, tau) and Parkinson’s (α-synuclein) disease.</p>`
		},
		{
			id: 'sequence',
			chapter: 'itself',
			title: 'Same beads, different shape',
			scene: 'lattice',
			hints: { mode: 'compare' },
			duration: 22,
			body: `
<p>Here are the best folds of the two chains, found by checking every one of their 110,188 shapes. Both have 7 H and 7 P beads; only the order differs. Each order has its own single best fold, and the two are not alike.</p>
<p>This is Anfinsen’s lesson in miniature: <strong>the sequence determines the shape</strong>. Real proteins work the same way, with 20 kinds of amino acid instead of 2 and many more forces. Change the order, as a mutation does, and the shape, and so what the protein does, can change too.</p>`,
			notes: `<p>Either chain folded into the other’s best shape scores worse than −6: chain B laid out as chain A’s best fold makes fewer H–H contacts. In real proteins most single changes leave the fold intact (it is robust), but some, especially in the buried core, unfold it.</p>`
		},
		// ------------------------------------------------------------------ predict
		{
			id: 'problem',
			chapter: 'predict',
			title: 'The protein folding problem',
			scene: 'gap',
			duration: 24,
			body: `
<p>If the sequence decides the shape, we should be able to compute the shape from the sequence. For fifty years that was the <strong>protein folding problem</strong>, and it resisted.</p>
<p>Measuring shapes is slow: X-ray crystallography, nuclear magnetic resonance and electron microscopy can take months or years per protein. The Protein Data Bank, the world’s archive, holds about <strong>260,000</strong> measured structures. Reading sequences is fast: UniProt lists about <strong>150 million</strong> protein sequences. Most proteins will never have their shape measured.</p>
<p>Since 1994 a blind contest, <dfn data-def="Critical Assessment of protein Structure Prediction: every two years, groups predict structures that have been measured but not yet published.">CASP</dfn>, has scored predictions against fresh measurements. Progress was slow until 2020, when DeepMind’s <strong>AlphaFold 2</strong>, a <a href="../neural-networks/">neural network</a> trained on the PDB’s structures, predicted most targets almost as accurately as the experiments.</p>`,
			notes: `<p>Counts from the RCSB PDB search service (experimental entries, October 2026) and UniProtKB release 2026_03. At CASP14 AlphaFold’s median backbone error was 0.96 Å (Cα root-mean-square deviation over 95% of residues), against 2.8 Å for the next best method (Jumper et al., Nature 596, 583, 2021). The AlphaFold Protein Structure Database now holds predictions for more than 214 million sequences (Varadi et al., Nucleic Acids Res. 52, D368, 2024). Demis Hassabis and John Jumper shared half of the 2024 Nobel Prize in Chemistry for it; the other half went to David Baker for designing new proteins. AlphaFold learns from evolution as well as physics: it compares the protein with its relatives in other species, whose amino acids that touch in the fold tend to change together.</p>`
		},
		{
			id: 'compare',
			chapter: 'predict',
			title: 'Measured and predicted, side by side',
			scene: 'compare',
			duration: 30,
			controls: [protein],
			body: `
<p>Left, the measured structure; right, AlphaFold’s prediction made from the sequence alone. Drag either to turn both. The prediction is coloured by AlphaFold’s own <dfn data-def="pLDDT, 0–100: AlphaFold’s estimate of how well each amino acid’s position agrees with the true structure.">confidence</dfn> in each amino acid: dark blue very high, light blue confident, yellow low, orange very low.</p>
<p>For β-globin and lysozyme the two are almost the same. After the best overlap, the average distance between matching amino acids is about <strong>half an ångström</strong>, less than the width of an atom.</p>`,
			notes: `<p>Predicted structures: AlphaFold Protein Structure Database, model version 6 (entries AF-P68871-F1, AF-P00698-F1, AF-P04637-F1), under the CC BY 4.0 licence. Measured: PDB 2DN2 (chain B), 2VB1 (hen lysozyme at 0.65 Å, chain A) and 2OCJ (p53 core, chain A), under CC0. The prediction is turned and shifted onto the measurement over all measured amino acids, and the readout gives the root-mean-square distance between matching Cα atoms. The predicted lysozyme still has its 18-amino-acid signal peptide, a tag that is cut off when the protein leaves the cell, so it is missing from the crystal.</p>`
		},
		{
			id: 'confidence',
			chapter: 'predict',
			title: 'Where the prediction is unsure',
			scene: 'compare',
			hints: { protein: 'p53' },
			duration: 30,
			body: `
<p><strong>p53</strong> guards our cells against cancer, and it is damaged in about half of all human tumours. Only its middle, the part that grips DNA, has been crystallised (left). AlphaFold predicts the whole chain of 393 amino acids, and its core matches the crystal as closely as the other two.</p>
<p>The ends, in orange, are another matter. AlphaFold is very unsure of them, and rightly so: in the cell these stretches have no fixed shape at all. They are <dfn data-def="Stretches of protein (or whole proteins) that do not fold into one shape but keep moving between many.">disordered</dfn>, flexible tails that grab other proteins, which is also why they never crystallise. A low confidence score is information: it often marks the floppy parts of a protein.</p>`,
			notes: `<p>Mean pLDDT over p53’s DNA-binding core (amino acids 100–290) is above 90, and below 50 over its last 25 amino acids. The short helix near amino acid 330 is the tetramerisation domain, which in the cell holds four p53 chains together; AlphaFold predicts it confidently, but its placement relative to the core is uncertain. The ends that AlphaFold leaves floppy match what experiments find (Wells et al., PNAS 105, 5762, 2008). The fraction of human tumours with a mutated p53 gene is about 50% (Olivier, Hollstein &amp; Hainaut, Cold Spring Harb. Perspect. Biol. 2010).</p>`
		},
		{
			id: 'function',
			chapter: 'predict',
			title: 'Shape is what a protein does',
			scene: 'compare',
			hints: { protein: 'lysozyme', site: 1 },
			duration: 30,
			body: `
<p>Lysozyme, from egg white and our tears, kills bacteria by cutting the sugar chains of their cell walls. It was the first enzyme whose shape was solved, in 1965. Its fold brings two acids together, a glutamic acid and an aspartic acid 17 amino acids apart along the chain, on either side of a cleft that holds the sugar chain. Together they cut it. Unfold the chain and the two are far apart and the enzyme is dead.</p>
<p>AlphaFold puts both in the right place. But it predicts a shape, not how the chain gets there, and it shows each protein alone, without the haem of β-globin or the partners of p53.</p>
<p>That is the whole story: <strong>a protein’s sequence determines its shape, and its shape determines what it does; predicting the shape from the sequence resisted solution for decades, until machine learning largely cracked it.</strong></p>`,
			notes: `<p>The active-site acids are Glu35 and Asp52 in the usual numbering of the mature enzyme (positions 53 and 70 of the UniProt sequence, which includes the signal peptide). Structure of lysozyme: Blake et al., Nature 206, 757 (1965). AlphaFold predicts single chains; AlphaFold 3 (Abramson et al., Nature 630, 493, 2024) and other methods also place partners, DNA and small molecules.</p>`
		}
	]
};
