import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';
import { BRANCHES, DEFAULT_BRANCH, branchFrames, zoomRange } from './frames';
import type { CellType } from './structures';
import { formatLength, NM, UM } from './units';

/**
 * The zoom slider of a step. Its value is −log₁₀ of the width of the view in
 * metres, so that moving it to the right zooms in.
 */
function zoom(step: string, cell: CellType, branch: string, width: number): Control {
	const [lo, hi] = zoomRange(branchFrames(cell, branch));
	return {
		type: 'range',
		id: `zoom-${step}`,
		label: 'Zoom: width of the view',
		min: Math.ceil(-Math.log10(hi) * 100) / 100,
		max: Math.floor(-Math.log10(lo) * 100) / 100,
		step: 0.01,
		default: Math.round(-Math.log10(width) * 100) / 100,
		format: (v) => formatLength(10 ** -v),
		help: 'Slide right to zoom in; or scroll, or use + and −, over the picture. Click any part to see what it does.'
	};
}

const cellChoice: Control = {
	type: 'select',
	id: 'cell',
	label: 'Kind of cell',
	default: 'animal',
	options: [
		{ value: 'animal', label: 'Animal (liver)' },
		{ value: 'plant', label: 'Plant (leaf)' },
		{ value: 'bacterium', label: 'Bacterium (E. coli)' }
	]
};

/** The chain the explore step follows: the kind of cell, and the branch picked in the picture. */
export function exploreChain(params: Params) {
	const cell =
		(String(params.cell ?? 'animal') as CellType) in BRANCHES
			? (String(params.cell ?? 'animal') as CellType)
			: 'animal';
	const branch = String(params[`branch-${cell}`] ?? DEFAULT_BRANCH[cell]);
	return { cell, branch, chain: branchFrames(cell, branch) };
}

const exploreZoom: Control = {
	type: 'range',
	id: 'zoom-explore',
	label: 'Zoom: width of the view',
	min: Math.ceil(-Math.log10(400 * UM * 1.25) * 100) / 100,
	max: Math.floor(-Math.log10(3 * NM) * 100) / 100,
	bounds: (params) => {
		const [lo, hi] = zoomRange(exploreChain(params).chain);
		return [Math.ceil(-Math.log10(hi) * 100) / 100, Math.floor(-Math.log10(lo) * 100) / 100];
	},
	step: 0.01,
	default: Math.round(-Math.log10(40 * UM) * 100) / 100,
	format: (v) => formatLength(10 ** -v),
	help: 'Click a part to read about it; clicking a nucleus, mitochondrion, rough ER or the cell membrane also sets where the zoom dives.'
};

export const spec: ExplainerSpec = {
	slug: 'the-cell',
	title: 'Inside a cell',
	summary:
		'Zoom from a slice of liver into one cell, its nucleus, its power stations and its protein factories, down to single molecules, with a scale bar that tells the truth at every step. Then compare a plant cell and a bacterium.',
	chapters: [
		{ id: 'zoom', title: 'Zooming in' },
		{ id: 'parts', title: 'The parts of a cell' },
		{ id: 'kinds', title: 'Plants and bacteria' },
		{ id: 'scale', title: 'A sense of scale' }
	],
	steps: [
		// ------------------------------------------------------------------ zoom
		{
			id: 'tissue',
			chapter: 'zoom',
			title: 'You are made of cells',
			scene: 'zoom',
			hints: { cell: 'animal', branch: 'mitochondrion', sel: 'hepatocyte' },
			controls: [zoom('tissue', 'animal', 'mitochondrion', 300 * UM)],
			body: `
<p>This is a slice of liver a third of a millimetre across, about what the eye can just make out as a speck. Under the microscope it falls apart into tiles: <dfn data-def="The smallest unit of life: a package of chemicals wrapped in a membrane that can take in food, grow and make copies of itself.">cells</dfn>. Each tile here is one liver cell; the dark disc in each is its <strong>nucleus</strong>. The red discs squeezing between the rows are red blood cells, 7–8 µm across.</p>
<p>Every living thing is made of cells, and every cell comes from another cell that split in two. A human body has about 37 trillion of them, of a few hundred different kinds.</p>
<p>The scale bar at the bottom left is always a round length drawn at its true size, and the ruler at the bottom right shows how wide the view is, in powers of ten. A <dfn data-def="A micrometre (µm) is a thousandth of a millimetre. A nanometre (nm) is a thousandth of a micrometre.">micrometre</dfn> is a thousandth of a millimetre. Drag the zoom slider, or scroll over the picture, to dive into the cell in the middle.</p>`,
			notes: `<p>37 trillion: 3.7 × 10¹³ cells in an adult (Bianconi et al. 2013, BioNumbers 109716). Liver cells (hepatocytes) form plates one cell thick, with blood flowing past both faces in leaky capillaries called sinusoids. The arrangement of the cells is drawn schematically; their sizes are measured ones (sources in the info card of each part and in the last step).</p>`
		},
		{
			id: 'cell',
			chapter: 'zoom',
			title: 'Inside one liver cell',
			scene: 'zoom',
			hints: { cell: 'animal', branch: 'mitochondrion', sel: 'hepatocyte' },
			controls: [zoom('cell', 'animal', 'mitochondrion', 40 * UM)],
			body: `
<p>One liver cell, about 23 µm across, cut through the middle like a slice of bread. A thin <strong>cell membrane</strong> wraps it. Inside, the <dfn data-def="Everything inside the cell membrane apart from the nucleus: the organelles and the watery, protein-packed gel around them (the cytosol).">cytoplasm</dfn> is packed with <dfn data-def="‘Little organs’: compartments of the cell, most of them wrapped in their own membrane, each with a job.">organelles</dfn>, each with its own job:</p>
<ul>
<li>the <strong>nucleus</strong>, which holds the DNA;</li>
<li>about a hundred sausage-shaped <strong>mitochondria</strong> in this slice, the power stations;</li>
<li>stacks of flat sacs, the <strong>rough endoplasmic reticulum</strong>, where many proteins are made, and the <strong>Golgi</strong> that ships them;</li>
<li>small round <strong>lysosomes</strong> and <strong>peroxisomes</strong> that digest and detoxify.</li>
</ul>
<p>Nothing here is placed by eye: each kind of organelle covers the share of the slice that it fills of a real liver cell (mitochondria a fifth, rough ER a tenth). What is left, the <strong>cytosol</strong>, is only about half. A cell is crowded, and organised. Click any part to see what it does.</p>`,
			notes: `<p><strong>How this picture was made.</strong> In a thin random slice, each component covers on average the same share of the area as it fills of the volume (the Delesse principle used in stereology), so the drawing uses the measured volume shares of a liver cell (Alberts et al., <em>Molecular Biology of the Cell</em>, Table 12-1): cytosol 50–60%, mitochondria 20%, rough ER 10%, smooth ER and Golgi 6%, nucleus 6%, lysosomes, peroxisomes and endosomes 1% each. The slice goes through the middle of the nucleus, which is therefore drawn at its full 8 µm (BioNumbers 104261) and covers more than 6% of the slice. Positions are random, and the shapes are simplified: real mitochondria are often branched, and real ER sheets are curved and connected.</p>`
		},
		// ------------------------------------------------------------------ parts
		{
			id: 'nucleus',
			chapter: 'parts',
			title: 'The nucleus: a library of instructions',
			scene: 'zoom',
			hints: { cell: 'animal', branch: 'nucleus', sel: 'nucleus' },
			controls: [zoom('nucleus', 'animal', 'nucleus', 14 * UM)],
			body: `
<p>The <strong>nucleus</strong> holds the cell’s <dfn data-def="Deoxyribonucleic acid: a long molecule that stores genetic instructions in a sequence of four chemical letters, A, C, G and T.">DNA</dfn>: the instructions for making every protein the body needs. A human cell has 46 pieces of DNA, the <dfn data-def="One long DNA molecule with its packing proteins. Human cells have 46: 23 inherited from each parent.">chromosomes</dfn>; a stretch of DNA that codes for one protein is a <dfn data-def="A stretch of DNA that holds the instructions for one protein (or one functional RNA).">gene</dfn>.</p>
<p>It is wrapped in two membranes, the <strong>nuclear envelope</strong>, pierced by about 2,000 <strong>nuclear pores</strong>, each 120 nm across. Copies of genes leave through them; proteins come in. The dark patches are tightly packed DNA; the dense spot is the <strong>nucleolus</strong>, where the parts of ribosomes are made.</p>
<p>Zoom in to see how the DNA is packed.</p>`,
			notes: `<p>Pores are drawn at the measured density of ~2,000 per nucleus (BioNumbers 111130), which in a thin slice means about one pore every 0.8 µm of envelope. The two membranes of the envelope are 20–40 nm apart (drawn 30 nm).</p>`
		},
		{
			id: 'dna',
			chapter: 'parts',
			title: 'Two metres of DNA on beads',
			scene: 'zoom',
			hints: { cell: 'animal', branch: 'nucleus', sel: 'nucleosome' },
			controls: [zoom('dna', 'animal', 'nucleus', 100 * NM)],
			body: `
<p>We are now 100 nm across, a hundred times narrower than the nucleus. The DNA is a thread just 2 nm thick, wound every 200 letters or so around a spool of eight proteins. Each spool with its DNA is a <dfn data-def="A spool of eight histone proteins with 147 base pairs of DNA wrapped 1¾ times around it, about 11 nm across. The basic unit of chromatin.">nucleosome</dfn>; the beads on a string are called <dfn data-def="DNA together with the proteins that pack it in the nucleus.">chromatin</dfn>. These outlines are traced from the real structure, atom by atom.</p>
<p>Unwound, the DNA of one human cell would be about <strong>2 metres</strong> long (6.4 billion letters × 0.34 nm each), packed into a nucleus 8 µm across: like 17 km of fine thread packed into a tennis ball.</p>
<p>Zoom all the way in: the double helix itself. Each rung of the twisted ladder is one pair of letters, <strong>A</strong> with <strong>T</strong> or <strong>C</strong> with <strong>G</strong>. The order of the letters is the code.</p>`,
			notes: `<p>Nucleosome: PDB 1KX5 (Davey et al. 2002), 147 base pairs wrapped about 1¾ times around a histone octamer; the histone tails stick out further than the 11 nm disc. Linker DNA between nucleosomes is drawn as a smooth 2 nm band, and the irregular, beads-on-a-string arrangement follows electron tomography of chromatin in nuclei (Ou et al., Science 2017), which finds no regular 30 nm fibre. The atoms are from PDB 1BNA (Drew et al. 1981), a 12-base-pair B-DNA. The tennis ball: 2 m is 250,000 times the 8 µm nucleus; scaled up to a 6.7 cm ball, that is 17 km of thread 17 µm thick.</p>`
		},
		{
			id: 'ribosomes',
			chapter: 'parts',
			title: 'Protein factories',
			scene: 'zoom',
			hints: { cell: 'animal', branch: 'er', sel: 'ribosome' },
			controls: [zoom('ribosomes', 'animal', 'er', 80 * NM)],
			body: `
<p><dfn data-def="Large molecules made of a chain of amino acids folded into a precise shape. Enzymes, pumps, motors, receptors and antibodies are all proteins.">Proteins</dfn> do most of the work in a cell. They are built by <dfn data-def="The machine that reads a messenger RNA and joins amino acids into a protein. About 30 nm across in our cells.">ribosomes</dfn>, molecular machines about 30 nm across, made of RNA and proteins. A copy of a gene, a <dfn data-def="Messenger RNA: a working copy of a gene, made in the nucleus and read by ribosomes.">messenger RNA</dfn>, comes out of the nucleus; a ribosome reads it three letters at a time and joins <dfn data-def="The 20 small building blocks of proteins.">amino acids</dfn> into a chain in that order.</p>
<p>Here a ribosome sits on the <strong>rough endoplasmic reticulum</strong>: the sheets look rough because of the ribosomes on them, about a thousand per square micrometre. Proteins made here are threaded through a channel (<strong>Sec61</strong>) into the sac, then shipped in small bubbles, <dfn data-def="Tiny membrane bubbles that carry cargo between organelles and to the cell surface.">vesicles</dfn>, to the <strong>Golgi</strong> for sorting. A liver cell has about 13 million ribosomes on its ER alone.</p>
<p>Zoom out to see the stacks of sheets, then the whole cell.</p>`,
			notes: `<p>Ribosome on the Sec61 channel: PDB 3J7R (Voorhees et al. 2014), placed in the membrane as computed by the OPM database. Ribosome density on ER sheets 1,000 ± 300 per µm² (BioNumbers 113957); 1.27 × 10⁷ bound ribosomes per rat liver cell (BioNumbers 105781). Ribosomes reading the same messenger RNA travel in groups (polysomes); here they are spaced as the density gives, about 37 nm apart in a thin slice.</p>`
		},
		{
			id: 'mitochondria',
			chapter: 'parts',
			title: 'Power stations',
			scene: 'zoom',
			hints: { cell: 'animal', branch: 'mitochondrion', sel: 'mitochondrion' },
			controls: [zoom('mitochondria', 'animal', 'mitochondrion', 3 * UM)],
			body: `
<p>A <dfn data-def="The organelle that burns food molecules with oxygen and stores the released energy as ATP. It has two membranes and its own small DNA.">mitochondrion</dfn> is about 1 µm wide and 2 µm long; a liver cell has about 1,700. It has two membranes: a smooth outer one and an inner one folded into ridges, the <strong>cristae</strong>.</p>
<p>Here the cell burns the breakdown products of food with oxygen. The energy is used to pump hydrogen ions across the inner membrane, and they flow back through a rotary motor, <dfn data-def="An enzyme in the inner membrane of mitochondria (and in chloroplasts and bacteria) that uses a flow of hydrogen ions to turn a rotor and make ATP.">ATP synthase</dfn>, sitting in rows along the edges of the cristae. Each turn of its rotor makes three molecules of <dfn data-def="Adenosine triphosphate: the cell’s energy currency. Splitting off its end phosphate releases energy that powers most of the cell’s work.">ATP</dfn>, the energy currency every part of the cell spends.</p>
<p>Zoom in to the edge of a crista, then to a single ATP: about 1.4 nm, a fifteenth the height of the machine that made it.</p>`,
			notes: `<p>Mitochondria in liver: 1,665 per cell, 22% of its volume (Weibel et al. 1969, BioNumbers 105783, 105782). Cristae 30–40 nm thick (BioNumbers 107021); the gap between the outer and inner membranes is about 20 nm. ATP synthase: PDB 6ZPO (cow heart, Spikes et al. 2020); in cristae it forms rows of pairs (dimers) whose heads lean apart (Davies et al., PNAS 2012), drawn here with two copies of the single-machine structure. Our bodies turn over roughly their own weight in ATP every day.</p>`
		},
		{
			id: 'membrane',
			chapter: 'parts',
			title: 'The membrane: a skin with gates',
			scene: 'zoom',
			hints: { cell: 'animal', branch: 'membrane', sel: 'plasmaMembrane' },
			controls: [zoom('membrane', 'animal', 'membrane', 50 * NM)],
			body: `
<p>The cell membrane is a double layer of fat-like molecules (<dfn data-def="Fat-like molecules with a water-loving head and two water-hating tails. In water they line up tail to tail into a sheet two molecules thick.">lipids</dfn>), only about 4 nm thick: if the cell were blown up to the size of a football, its skin would be less than a twentieth of a millimetre thick. Water-loving heads face out on both sides; oily tails face each other inside, so most charged and water-soluble things cannot cross.</p>
<p>Proteins set in the membrane are the gates:</p>
<ul>
<li>a <strong>pump</strong> spends ATP to push 3 sodium ions (Na⁺) out and 2 potassium ions (K⁺) in;</li>
<li>a <dfn data-def="A protein with a pore that opens and closes and lets one kind of ion through.">potassium channel</dfn> lets K⁺ leak back out, which leaves the inside of the cell electrically negative;</li>
<li>a <strong>transporter</strong> lets glucose in.</li>
</ul>
<p>Nerve signals are made of these ion movements, and the proteins sticking out of the membrane are how cells recognise each other, and how the immune system tells our own cells from invaders.</p>`,
			notes: `<p>Bilayer ≈ 4 nm (Cell Biology by the Numbers; hepatocyte plasma membranes 3.6–4.3 nm, BioNumbers 105821–2). Proteins: Na⁺/K⁺ pump PDB 3WGU (pig kidney), Kv1.2 potassium channel PDB 2R9R (rat), glucose transporter GLUT1 PDB 4PYP (human; liver cells mainly use its close relative GLUT2). All are placed in the membrane as computed by the OPM database. The lipids are drawn as two bands; the sugars on the outer face (the glycocalyx) are not drawn. About half of a membrane’s area is protein (BioNumbers 106255); here they are spaced out to be seen one by one.</p>`
		},
		// ------------------------------------------------------------------ kinds
		{
			id: 'plant',
			chapter: 'kinds',
			title: 'A plant cell',
			scene: 'zoom',
			hints: { cell: 'plant', branch: 'chloroplast', sel: 'mesophyllCell' },
			controls: [zoom('plant', 'plant', 'chloroplast', 100 * UM)],
			body: `
<p>Plant cells have a nucleus, mitochondria and the rest, and three things animal cells lack:</p>
<ul>
<li>a stiff <dfn data-def="A layer of cellulose fibres outside the cell membrane of plants, about 0.1 µm thick in young cells.">cell wall</dfn> outside the membrane;</li>
<li>a huge <dfn data-def="A membrane bag of water, salts and pigments that fills most of a mature plant cell.">central vacuole</dfn>, about four fifths of the cell, which presses everything else into a thin layer under the wall;</li>
<li><dfn data-def="The organelle that captures light energy and uses it to make sugar from carbon dioxide and water.">chloroplasts</dfn>, the green organelles of photosynthesis: about 5 µm long, a sixth of the cell’s volume.</li>
</ul>
<p>This is a palisade cell from just under the top surface of a leaf, where the light comes in. Water pushing on the walls from inside keeps the leaf firm; when a plant wilts, its vacuoles are losing water.</p>`,
			notes: `<p>Leaf 240 µm thick and mesophyll cells 1,335 µm² in section (Arabidopsis, BioNumbers 100823, 100825); vacuole 79%, chloroplasts 16%, cytosol 3% of a spinach mesophyll cell (BioNumbers 104368–104370); cell wall ≈ 0.1 µm (BioNumbers 106007). The cell arrangement in the leaf is schematic.</p>`
		},
		{
			id: 'chloroplast',
			chapter: 'kinds',
			title: 'Inside a chloroplast',
			scene: 'zoom',
			hints: { cell: 'plant', branch: 'chloroplast', sel: 'chloroplast' },
			controls: [zoom('chloroplast', 'plant', 'chloroplast', 8 * UM)],
			body: `
<p>A chloroplast is wrapped in two membranes and filled with stacks of flattened sacs, the <strong>thylakoids</strong>; a stack is a <strong>granum</strong>, 0.3–0.6 µm across, and a chloroplast has 40–60 of them.</p>
<p>Zoom into the edge of a stack: the thylakoid membranes, 5 nm thick, are packed with light-capturing machines, <strong>photosystem II</strong> and <strong>photosystem I</strong> with their antennae, and with the same kind of <strong>ATP synthase</strong> as in mitochondria. Around them float the <strong>Rubisco</strong> enzymes that fix carbon dioxide into sugar. Zoom further and you reach a single <strong>chlorophyll</strong>, the green pigment: a ring that absorbs light and a long oily tail.</p>
<p>How all this turns light into sugar is the subject of <a href="../photosynthesis/">photosynthesis</a>.</p>`,
			notes: `<p>Grana 40–60 per chloroplast, 0.3–0.6 µm across (BioNumbers 107013–4); thylakoid membrane 4.9 nm, lumen 9 nm, 3.6 nm between stacked sacs (measured in the alga Chlamydomonas, BioNumbers 111325–7). Photosystem II sits mostly in the stacked parts and photosystem I and ATP synthase in the unstacked ones, as drawn. Structures: PSII with antennae PDB 5XNM (pea), cytochrome b₆f 6RQF, PSI 5L8R, chloroplast ATP synthase 6FKF (spinach), Rubisco 8RUC (spinach), chlorophyll a from the RCSB ligand CLA. In the chlorophyll view the protein that holds the pigment is not drawn.</p>`
		},
		{
			id: 'bacterium',
			chapter: 'kinds',
			title: 'A bacterium: a cell without a nucleus',
			scene: 'zoom',
			hints: { cell: 'bacterium', branch: 'cytoplasm', sel: 'ecoli' },
			controls: [zoom('bacterium', 'bacterium', 'cytoplasm', 3 * UM)],
			body: `
<p><i>E. coli</i>, a bacterium from our gut, is about 1 µm wide and 2 µm long: you could fit thousands inside a liver cell. It is a complete living cell, but much simpler: no nucleus, no mitochondria, no internal membranes at all. Cells like this are <dfn data-def="Cells without a nucleus: bacteria and archaea. Cells with a nucleus (animals, plants, fungi) are eukaryotes.">prokaryotes</dfn>; ours, with a nucleus, are <strong>eukaryotes</strong>.</p>
<p>Its single, circular chromosome (1.5 mm of DNA) lies in the cytoplasm in a region called the <strong>nucleoid</strong>. Its ribosomes, the grey dots, are a little smaller than ours, which is why some antibiotics can jam them and leave ours alone. A tough envelope of two membranes and a thin wall surrounds it, and a few corkscrew <strong>flagella</strong>, 20 nm thick and several µm long, spun by motors in the envelope, drive it along.</p>`,
			notes: `<p>Sizes: BioNumbers 101788, 100002 (cell), 100095–6 and 109341 (flagella), 107009–10 (nucleoid), 100016 and 105385 (envelope). Ribosomes: about 10,000 per cell at moderate growth (Cell Biology by the Numbers; up to 72,000 when dividing every 24 minutes), 85–90% outside the nucleoid (BioNumbers 108595). A thin slice through such a cell cuts about 500 of them, as drawn. Mitochondria and chloroplasts are the descendants of bacteria that came to live inside other cells over a billion years ago, which is why they have their own DNA and ribosomes.</p>`
		},
		{
			id: 'crowded',
			chapter: 'kinds',
			title: 'A crowded factory',
			scene: 'zoom',
			hints: { cell: 'bacterium', branch: 'cytoplasm', sel: 'cytosol' },
			controls: [zoom('crowded', 'bacterium', 'cytoplasm', 150 * NM)],
			body: `
<p>Now we are 150 nm across, just under the bacterium’s envelope. Every outline is a real molecule traced from its measured structure, at its true size: ribosomes, RNA polymerases copying DNA, chaperones that help proteins fold, transfer RNAs, enzymes.</p>
<p>And this is how crowded it really is. A cubic micrometre of cell holds 2–4 million proteins; in <i>E. coli</i> their centres are on average only about 7 nm apart, barely more than the size of a protein. Water fills the gaps (each grey speck at the deepest zoom is one water molecule, 0.3 nm apart). Molecules here don’t travel in straight lines: battered by water molecules trillions of times a second, they wander through the crowd at random, and that constant jostling is what brings each enzyme to its next molecule.</p>
<p>A cell is a factory in which the machines are packed shoulder to shoulder and the parts arrive by chance.</p>`,
			notes: `<p>How the crowd is drawn: the view is an ideal thin slice, so each kind of molecule appears in proportion to its concentration × its diameter. Proteins: 3 million per µm³ (BioNumbers: 2–4 × 10⁶); ribosomes 10,000 per cell. The mixture of protein kinds shown (EF-Tu with a tRNA, adenylate kinase, GroEL, RNA polymerase, free tRNA) stands in for the thousands of different proteins of a real cell; their sizes are real, their share is illustrative. Spacing between proteins in E. coli ≈ 7 nm (BioNumbers 100032). Inner membrane with the lactose permease LacY (PDB 1PV6) and outer membrane with the porin OmpF (PDB 2OMF); the peptidoglycan wall between them is drawn as a mesh 6 nm thick.</p>`
		},
		// ------------------------------------------------------------------ scale
		{
			id: 'sizes',
			chapter: 'scale',
			title: 'Six orders of magnitude',
			scene: 'sizes',
			controls: [
				{
					type: 'toggle',
					id: 'linear',
					label: 'Ordinary (linear) ruler',
					default: false,
					help: 'Off: every step to the right is ten times bigger. On: every step is the same length.'
				}
			],
			body: `
<p>Here is everything we have met on one ruler. Each mark is <strong>ten times</strong> the one before, so the line covers six powers of ten: from a water molecule (0.3 nm) to the slice of liver (0.3 mm), a factor of a million.</p>
<p>Switch to an ordinary ruler and everything but the largest few things collapses into a single point at zero: on a scale where a liver cell is visible, a ribosome is a thousandth of the way along, and a water molecule a hundred-thousandth. That is why cells were invisible until microscopes, and molecular machines until X-rays and electron microscopes, and why biologists think in powers of ten.</p>`,
			notes: `<p>Each bar spans the measured range of the structure and the dot marks the typical size used in the drawings. Sources are listed in each part’s info card in the zoom views.</p>`
		},
		{
			id: 'explore',
			chapter: 'scale',
			title: 'Explore',
			scene: 'zoom',
			hints: { cell: 'explore', branch: 'explore' },
			controls: [cellChoice, exploreZoom],
			body: `
<p>Pick a kind of cell and zoom freely. Click any part to read what it is, how big it is and what it does. In the liver cell, clicking the nucleus, a mitochondrion, the rough ER or the cell membrane also chooses where the zoom dives.</p>
<p>Look for the jumps in scale: tissue to cell (×10), cell to organelle (×10), organelle to molecular machine (×100), machine to small molecule (×10). A cell is a crowded, organised factory, and its parts span six orders of magnitude.</p>`,
			notes: `<p><strong>How these pictures were made.</strong> Molecules and molecular machines are traced from their atomic structures in the Protein Data Bank and drawn at their true size (outlines of space-filling models; small molecules atom by atom). Membrane proteins sit in the membrane as computed by the OPM database. Cells and organelles are drawn by hand to their measured sizes, and each kind of organelle covers the share of a slice that it fills of the real cell. What is simplified: positions are random, shapes are smoothed, sections are ideal thin slices, the cross-fades between views blend two drawings, and molecules are shown frozen (in reality they jiggle billions of times a second). Each info card names the source of its size; most come from BioNumbers (Milo et al. 2010) and <em>Cell Biology by the Numbers</em> (Milo &amp; Phillips 2015).</p>`
		}
	]
};
