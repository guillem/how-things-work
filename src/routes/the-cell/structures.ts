/**
 * Every structure the reader can select in "The cell": what it is, how big it
 * is and what it does, with the source of each size.
 *
 * Sizes are typical measured values. "BNID" numbers are entries of the
 * BioNumbers database (Milo et al., Nucleic Acids Res. 38:D750, 2010;
 * https://bionumbers.hms.harvard.edu), most of them quoted in "Cell Biology by
 * the Numbers" (Milo & Phillips, 2015; https://book.bionumbers.org). Sizes of
 * molecules and machines marked "PDB" are measured on the drawn outline itself,
 * traced from that structure (see shapes.ts), and the tests check that they
 * agree with the published sizes quoted here.
 */
import { NM, UM } from './units';

export type CellType = 'animal' | 'plant' | 'bacterium';
export type Kind = 'tissue' | 'cell' | 'organelle' | 'machine' | 'molecule';

export interface Structure {
	id: string;
	name: string;
	kind: Kind;
	/** Characteristic size (diameter, or the length named in `dims`), metres. */
	size: number;
	/** Measured range, metres, when one is known. */
	range?: readonly [number, number];
	/** How the size is meant, for the info card ("≈ 8 µm across"). */
	dims: string;
	/** What it does, in one or two plain sentences. */
	does: string;
	/** Where the size comes from. */
	source: string;
	cells: readonly CellType[];
}

const ALL: readonly CellType[] = ['animal', 'plant', 'bacterium'];
const EUK: readonly CellType[] = ['animal', 'plant'];

const list: Structure[] = [
	// ---------------------------------------------------------------- animal: liver
	{
		id: 'liver',
		name: 'Liver tissue',
		kind: 'tissue',
		size: 300 * UM,
		dims: 'a slice 0.3 mm across',
		does: 'Plates of liver cells, one cell thick, with blood flowing between them. Each cell takes up sugar, fats and toxins from the blood and processes them.',
		source: 'Standard histology; cell sizes below.',
		cells: ['animal']
	},
	{
		id: 'hepatocyte',
		name: 'Liver cell (hepatocyte)',
		kind: 'cell',
		size: 23 * UM,
		range: [20 * UM, 30 * UM],
		dims: '≈ 23 µm across (6,200 µm³)',
		does: 'The liver’s main worker: it stores sugar as glycogen, makes blood proteins, and breaks down drugs and toxins. Each is packed with organelles.',
		source:
			'Volume 6,200 µm³ (rat, BNID 115150), the volume of a 23 µm sphere; textbooks give 20–30 µm.',
		cells: ['animal']
	},
	{
		id: 'redBloodCell',
		name: 'Red blood cell',
		kind: 'cell',
		size: 7.5 * UM,
		range: [7 * UM, 8 * UM],
		dims: '7–8 µm across, a dimpled disc',
		does: 'Carries oxygen. It has no nucleus and is one of the smallest human cells, a handy ruler for the others.',
		source: 'BNID 100509.',
		cells: ['animal']
	},
	{
		id: 'sinusoid',
		name: 'Sinusoid (a liver capillary)',
		kind: 'tissue',
		size: 9 * UM,
		range: [5 * UM, 15 * UM],
		dims: 'drawn 9 µm wide; measured 5–15 µm',
		does: 'A leaky blood vessel between the plates of liver cells, so that the cells can exchange substances with the blood.',
		source: 'Widths of 5–15 µm are reported, depending on species and preparation.',
		cells: ['animal']
	},
	{
		id: 'plasmaMembrane',
		name: 'Cell membrane',
		kind: 'organelle',
		size: 4 * NM,
		range: [3.5 * NM, 4.5 * NM],
		dims: '≈ 4 nm thick (lipids only)',
		does: 'A double layer of fat-like molecules (lipids) that wraps every cell. Proteins set in it decide what gets in and out.',
		source:
			'Lipid bilayer ≈ 4 nm; hepatocyte plasma membrane 3.6–4.3 nm by X-ray scattering (BNID 105821, 105822).',
		cells: ALL
	},
	{
		id: 'cytosol',
		name: 'Cytosol',
		kind: 'organelle',
		size: 5 * NM,
		dims: 'proteins ≈ 7 nm apart',
		does: 'The watery gel between the organelles, packed with 2–4 million proteins in every cubic micrometre, so crowded that molecules jostle constantly.',
		source:
			'2–4 million proteins per µm³ of cell (BioNumbers); average spacing between proteins in E. coli 7 nm (BNID 100032).',
		cells: ALL
	},
	{
		id: 'nucleus',
		name: 'Nucleus',
		kind: 'organelle',
		size: 8 * UM,
		range: [2 * UM, 10 * UM],
		dims: '≈ 8 µm across',
		does: 'Holds the cell’s DNA, the instructions for building every protein. Messages copied from the DNA leave through pores in its double membrane.',
		source: 'Rat hepatocyte nucleus 8 µm (BNID 104261); 2–10 µm in most cells.',
		cells: EUK
	},
	{
		id: 'nucleolus',
		name: 'Nucleolus',
		kind: 'organelle',
		size: 2 * UM,
		range: [0.5 * UM, 5 * UM],
		dims: '≈ 2 µm across',
		does: 'A dense spot in the nucleus where the parts of ribosomes are made.',
		source: 'Nucleoli 0.5–5 µm (BNID 107498).',
		cells: EUK
	},
	{
		id: 'nuclearPore',
		name: 'Nuclear pore',
		kind: 'machine',
		size: 120 * NM,
		dims: '≈ 120 nm across; ~2,000 per nucleus',
		does: 'A gate through both membranes of the nucleus. Messenger RNA goes out, proteins come in.',
		source: 'Diameter 120 nm (vertebrates, BNID 103695); ~2,000 per nucleus (BNID 111130).',
		cells: EUK
	},
	{
		id: 'nuclearEnvelope',
		name: 'Nuclear envelope',
		kind: 'organelle',
		size: 38 * NM,
		dims: 'two membranes ≈ 30 nm apart',
		does: 'Two membranes around the nucleus, joined at the pores. The outer one carries on into the endoplasmic reticulum.',
		source: 'Perinuclear space 20–40 nm (Gene Ontology GO:0005635).',
		cells: EUK
	},
	{
		id: 'chromatin',
		name: 'Chromatin',
		kind: 'machine',
		size: 11 * NM,
		dims: 'DNA on beads ≈ 11 nm wide',
		does: 'DNA wound onto spools of protein (nucleosomes), so that 2 metres of DNA fit in a nucleus 8 µm across.',
		source:
			'Nucleosome ≈ 10 nm across (BNID 102979); human DNA 6.4 billion base pairs × 0.34 nm = 2.2 m.',
		cells: EUK
	},
	{
		id: 'nucleosome',
		name: 'Nucleosome',
		kind: 'machine',
		size: 11 * NM,
		range: [10 * NM, 11 * NM],
		dims: '≈ 11 nm across, 147 base pairs of DNA',
		does: 'A spool of eight histone proteins with DNA wrapped 1¾ times around it. Packing and unpacking it decides which genes can be read.',
		source: 'PDB 1KX5; 147 bp wrapped ~1.75 turns, ≈ 10 nm disc (BNID 102979, 102985).',
		cells: EUK
	},
	{
		id: 'dna',
		name: 'DNA',
		kind: 'molecule',
		size: 2 * NM,
		dims: '2 nm wide; 0.34 nm per letter',
		does: 'The double helix that stores genes in a four-letter code (A, C, G, T). Each rung of the ladder is one letter pair.',
		source: 'Radius ≈ 1 nm, 1/3 nm between base pairs (Cell Biology by the Numbers); PDB 1BNA.',
		cells: ALL
	},
	{
		id: 'mitochondrion',
		name: 'Mitochondrion',
		kind: 'organelle',
		size: 2 * UM,
		range: [1 * UM, 2 * UM],
		dims: '≈ 1 µm wide, 2 µm long',
		does: 'The power station: it burns food molecules with oxygen and stores the energy as ATP. A liver cell has about 1,700.',
		source:
			'≈ 1 × 2 µm (Cell Biology by the Numbers); 1,665 per rat hepatocyte, 22% of its volume (BNID 105783, 105782).',
		cells: EUK
	},
	{
		id: 'crista',
		name: 'Crista',
		kind: 'organelle',
		size: 35 * NM,
		range: [30 * NM, 40 * NM],
		dims: 'folds 30–40 nm thick',
		does: 'A fold of the mitochondrion’s inner membrane. The folds give room for many more ATP-making machines.',
		source: 'Tubular segments of cristae 30–40 nm wide, rat liver (BNID 107021).',
		cells: EUK
	},
	{
		id: 'atpSynthase',
		name: 'ATP synthase',
		kind: 'machine',
		size: 23 * NM,
		dims: '≈ 23 nm tall',
		does: 'A rotary motor in the inner membrane: hydrogen ions flowing through it spin its rotor, and each turn makes three ATP.',
		source: 'PDB 6ZPO (cow heart), measured on the outline.',
		cells: ALL
	},
	{
		id: 'atp',
		name: 'ATP',
		kind: 'molecule',
		size: 1.4 * NM,
		dims: '≈ 1.4 nm',
		does: 'The cell’s energy currency. Breaking off its last phosphate releases energy that powers pumps, motors and building work.',
		source: 'Effective diameter 1.4 nm (BNID 106978); atoms from RCSB ligand ATP.',
		cells: ALL
	},
	{
		id: 'roughER',
		name: 'Rough endoplasmic reticulum',
		kind: 'organelle',
		size: 80 * NM,
		range: [60 * NM, 100 * NM],
		dims: 'flat sacs 60–100 nm thick',
		does: 'Stacks of flattened sacs studded with ribosomes. Proteins for membranes or for export are made here and threaded into the sacs.',
		source:
			'Sheet thickness 60–100 nm (BNID 111388); 9% of a liver cell’s volume (Alberts, Table 12-1).',
		cells: EUK
	},
	{
		id: 'smoothER',
		name: 'Smooth endoplasmic reticulum',
		kind: 'organelle',
		size: 60 * NM,
		dims: 'tubules ≈ 60 nm thick',
		does: 'A network of tubes without ribosomes. It makes lipids for the cell’s membranes and, in the liver, breaks down drugs and poisons.',
		source:
			'Tubules ≈ 60 nm; smooth ER and Golgi together 6% of a liver cell’s volume (Alberts, Table 12-1).',
		cells: EUK
	},
	{
		id: 'ribosome',
		name: 'Ribosome',
		kind: 'machine',
		size: 30 * NM,
		range: [25 * NM, 30 * NM],
		dims: '≈ 30 nm across (mammal)',
		does: 'The protein factory: it reads a messenger RNA three letters at a time and links amino acids into a protein chain.',
		source:
			'Ribosomes 20–30 nm (BNID 102320); 13 million on the rough ER of one liver cell (BNID 105781); PDB 3J7R.',
		cells: EUK
	},
	{
		id: 'sec61',
		name: 'Sec61 channel',
		kind: 'machine',
		size: 5 * NM,
		dims: 'a pore through the ER membrane',
		does: 'The channel the ribosome docks on, through which a new protein is threaded into the endoplasmic reticulum.',
		source: 'PDB 3J7R.',
		cells: EUK
	},
	{
		id: 'golgi',
		name: 'Golgi apparatus',
		kind: 'organelle',
		size: 1 * UM,
		dims: 'stacks ≈ 1 µm across',
		does: 'The post office: it sorts and tags proteins from the endoplasmic reticulum and sends them on in small bubbles (vesicles).',
		source: 'Smooth ER and Golgi together 6% of a liver cell’s volume (Alberts).',
		cells: EUK
	},
	{
		id: 'lysosome',
		name: 'Lysosome',
		kind: 'organelle',
		size: 0.5 * UM,
		range: [0.1 * UM, 1.2 * UM],
		dims: '≈ 0.5 µm across',
		does: 'The recycling bin: an acid bag of enzymes that digests worn-out parts and things the cell has swallowed.',
		source: '0.5 µm (0.1–1.2 µm, BNID 106072); 1% of a liver cell’s volume (Alberts).',
		cells: ['animal']
	},
	{
		id: 'peroxisome',
		name: 'Peroxisome',
		kind: 'organelle',
		size: 0.5 * UM,
		range: [0.1 * UM, 1 * UM],
		dims: '≈ 0.5 µm across in liver',
		does: 'Breaks down fatty acids and toxins such as alcohol, safely destroying the hydrogen peroxide this makes.',
		source:
			'Most 0.1–0.2 µm, larger in liver (BNID 113108); 1% of a liver cell’s volume (Alberts).',
		cells: EUK
	},
	{
		id: 'endosome',
		name: 'Endosome',
		kind: 'organelle',
		size: 0.5 * UM,
		range: [0.1 * UM, 1 * UM],
		dims: '≈ 0.3–0.6 µm across',
		does: 'A sorting station for material the cell has taken in from outside: some is recycled to the surface, the rest is sent to lysosomes.',
		source: '1% of a liver cell’s volume (Alberts); drawn 0.3–0.6 µm.',
		cells: EUK
	},
	{
		id: 'vesicle',
		name: 'Vesicle',
		kind: 'organelle',
		size: 50 * NM,
		range: [40 * NM, 100 * NM],
		dims: '≈ 50 nm across',
		does: 'A tiny membrane bubble that carries cargo between organelles or to the cell surface.',
		source: 'Transport vesicles ≈ 50 nm (BNID 101799).',
		cells: EUK
	},
	{
		id: 'microtubule',
		name: 'Microtubule',
		kind: 'machine',
		size: 25 * NM,
		dims: '25 nm wide hollow tube',
		does: 'A rail of the cell’s skeleton. Motor proteins walk along it carrying vesicles and organelles.',
		source: 'Diameter 25 nm (Cell Biology by the Numbers).',
		cells: EUK
	},
	{
		id: 'actin',
		name: 'Actin filament',
		kind: 'machine',
		size: 6 * NM,
		range: [6 * NM, 7 * NM],
		dims: '6–7 nm wide',
		does: 'A thin protein cable. A mesh of them under the membrane gives the cell its shape and lets it move.',
		source: 'Diameter 6 nm (Cell Biology by the Numbers); 6–7 nm (BNID 112072).',
		cells: EUK
	},
	{
		id: 'centriole',
		name: 'Centriole',
		kind: 'organelle',
		size: 0.5 * UM,
		dims: '0.2 µm wide, 0.5 µm long',
		does: 'A short barrel of microtubules near the nucleus; a pair of them organises the microtubule rails.',
		source: 'BNID 105741.',
		cells: ['animal']
	},
	{
		id: 'naKPump',
		name: 'Sodium–potassium pump',
		kind: 'machine',
		size: 15 * NM,
		dims: '≈ 15 nm tall',
		does: 'Spends one ATP to push 3 sodium ions out and 2 potassium ions in. Nerve signals depend on the difference it builds.',
		source: 'PDB 3WGU, measured on the outline.',
		cells: ['animal']
	},
	{
		id: 'kChannel',
		name: 'Potassium channel',
		kind: 'machine',
		size: 15 * NM,
		dims: '≈ 15 nm tall',
		does: 'A gated pore that lets only potassium ions through, millions per second when open.',
		source: 'PDB 2R9R (Kv1.2), measured on the outline.',
		cells: ['animal']
	},
	{
		id: 'glut',
		name: 'Glucose transporter',
		kind: 'machine',
		size: 7 * NM,
		dims: '≈ 7 nm tall',
		does: 'Lets glucose cross the membrane, one molecule per flip. Liver cells use GLUT2; GLUT1, drawn here, is its close relative.',
		source: 'PDB 4PYP (GLUT1), measured on the outline.',
		cells: ['animal']
	},
	{
		id: 'protein',
		name: 'A typical protein',
		kind: 'molecule',
		size: 5 * NM,
		range: [4 * NM, 5 * NM],
		dims: '4–5 nm across',
		does: 'Proteins do most of the cell’s work: enzymes, pumps, motors, signals. An average one is a few hundred amino acids folded into a blob.',
		source: 'Mean protein diameter 4–5 nm (BioNumbers).',
		cells: ALL
	},
	{
		id: 'water',
		name: 'Water',
		kind: 'molecule',
		size: 0.3 * NM,
		dims: 'molecules 0.3 nm apart',
		does: 'About two thirds of a cell. Every other molecule is surrounded by it.',
		source: '55 mol per litre: one molecule per 0.03 nm³, 0.3 nm apart (BNID 106548).',
		cells: ALL
	},
	// ---------------------------------------------------------------- plant: leaf
	{
		id: 'leaf',
		name: 'Leaf (cross-section)',
		kind: 'tissue',
		size: 240 * UM,
		dims: '≈ 0.24 mm thick',
		does: 'A sandwich of cells: a skin (epidermis) on each side, a tall layer of cells full of chloroplasts, and a spongy layer with air spaces.',
		source: 'Arabidopsis leaf 240 µm thick (BNID 100823).',
		cells: ['plant']
	},
	{
		id: 'mesophyllCell',
		name: 'Leaf cell (palisade mesophyll)',
		kind: 'cell',
		size: 55 * UM,
		dims: 'a section ≈ 24 × 55 µm',
		does: 'A photosynthesising cell. A huge water-filled vacuole presses the cytoplasm and chloroplasts into a thin layer under the wall.',
		source: 'Cross-section 1,335 µm² (Arabidopsis, BNID 100825).',
		cells: ['plant']
	},
	{
		id: 'cellWall',
		name: 'Cell wall',
		kind: 'organelle',
		size: 100 * NM,
		dims: '≈ 0.1 µm thick',
		does: 'A tough layer of cellulose fibres outside the membrane. It lets the cell hold water under pressure without bursting, which keeps the plant stiff.',
		source: 'Primary walls ≈ 100 nm (onion BNID 106007; grape 97 nm, BNID 108121).',
		cells: ['plant']
	},
	{
		id: 'vacuole',
		name: 'Central vacuole',
		kind: 'organelle',
		size: 45 * UM,
		dims: '≈ 80% of the cell’s volume',
		does: 'A bag of water, salts and pigments. It keeps the cell swollen and firm and stores or locks away substances.',
		source: '79% of a spinach mesophyll cell (BNID 104368); 80–90% in plants (BNID 103442).',
		cells: ['plant']
	},
	{
		id: 'chloroplast',
		name: 'Chloroplast',
		kind: 'organelle',
		size: 5 * UM,
		range: [4 * UM, 6 * UM],
		dims: '≈ 5 µm long, 2.5 µm thick',
		does: 'Captures sunlight and uses it to turn carbon dioxide and water into sugar. It has its own DNA, a trace of its past as a free-living bacterium.',
		source: '≈ 5 µm × 2.5 µm (BNID 107012); 16% of a mesophyll cell (BNID 104369).',
		cells: ['plant']
	},
	{
		id: 'granum',
		name: 'Granum',
		kind: 'organelle',
		size: 0.45 * UM,
		range: [0.3 * UM, 0.6 * UM],
		dims: 'stacks 0.3–0.6 µm across',
		does: 'A stack of flattened membrane sacs (thylakoids), where light is captured. A chloroplast has 40–60 of them.',
		source: 'BNID 107013, 107014.',
		cells: ['plant']
	},
	{
		id: 'thylakoid',
		name: 'Thylakoid membrane',
		kind: 'organelle',
		size: 4.9 * NM,
		dims: 'membrane 4.9 nm; lumen 9 nm',
		does: 'The membrane that holds the light-capturing machines. Protons pumped into the space inside it drive ATP synthase.',
		source:
			'Membrane 4.9 nm, lumen 9 nm, gap between stacked sacs 3.6 nm (alga Chlamydomonas; BNID 111325–111327).',
		cells: ['plant']
	},
	{
		id: 'psii',
		name: 'Photosystem II',
		kind: 'machine',
		size: 33 * NM,
		dims: '≈ 33 nm long with its antennae',
		does: 'Uses light to pull electrons out of water, releasing the oxygen we breathe.',
		source: 'PDB 5XNM (pea), measured on the outline.',
		cells: ['plant']
	},
	{
		id: 'b6f',
		name: 'Cytochrome b₆f',
		kind: 'machine',
		size: 11 * NM,
		dims: '≈ 11 nm tall',
		does: 'Passes electrons on and pumps protons into the thylakoid.',
		source: 'PDB 6RQF (spinach), measured on the outline.',
		cells: ['plant']
	},
	{
		id: 'psi',
		name: 'Photosystem I',
		kind: 'machine',
		size: 17 * NM,
		dims: '≈ 17 nm wide',
		does: 'A second light-driven machine that lifts electrons high enough to make NADPH.',
		source: 'PDB 5L8R (pea), measured on the outline.',
		cells: ['plant']
	},
	{
		id: 'cfAtpSynthase',
		name: 'Chloroplast ATP synthase',
		kind: 'machine',
		size: 23 * NM,
		dims: '≈ 23 nm tall',
		does: 'The same kind of rotary motor as in mitochondria, driven by protons leaving the thylakoid.',
		source: 'PDB 6FKF (spinach), measured on the outline.',
		cells: ['plant']
	},
	{
		id: 'rubisco',
		name: 'Rubisco',
		kind: 'machine',
		size: 11 * NM,
		dims: '≈ 11 nm across',
		does: 'The enzyme that fixes carbon dioxide into sugar. It is slow, so leaves make huge amounts of it: it is probably the most abundant protein on Earth.',
		source: 'PDB 8RUC (spinach), measured on the outline.',
		cells: ['plant']
	},
	{
		id: 'chlorophyll',
		name: 'Chlorophyll a',
		kind: 'molecule',
		size: 2.5 * NM,
		dims: 'head ≈ 1 nm, tail ≈ 2 nm',
		does: 'The green pigment. Its ring absorbs red and blue light; the long tail anchors it in the membrane.',
		source: 'Atoms from RCSB ligand CLA.',
		cells: ['plant']
	},
	// ---------------------------------------------------------------- bacterium: E. coli
	{
		id: 'colony',
		name: 'Bacteria (E. coli)',
		kind: 'tissue',
		size: 30 * UM,
		dims: 'a field 30 µm across',
		does: 'Single cells that live on their own. Each one grows and splits in two, as often as every 20 minutes.',
		source: 'Doubling time 20 min (Cell Biology by the Numbers).',
		cells: ['bacterium']
	},
	{
		id: 'ecoli',
		name: 'E. coli bacterium',
		kind: 'cell',
		size: 2 * UM,
		dims: '≈ 1 µm wide, 2 µm long',
		does: 'A whole living cell with no nucleus and no organelles: its DNA lies in the cytoplasm, crowded in with its ribosomes and proteins.',
		source: '≈ 1 × 2 µm, volume ≈ 1 µm³ (BNID 101788); diameter 1–1.1 µm (BNID 100002).',
		cells: ['bacterium']
	},
	{
		id: 'flagellum',
		name: 'Flagellum',
		kind: 'machine',
		size: 20 * NM,
		dims: '20 nm thick, 5–10 µm long',
		does: 'A corkscrew tail turned by a rotary motor in the envelope. Spinning it pushes the bacterium along.',
		source:
			'Diameter ≈ 20 nm, length 5–10 µm (BNID 100096, 100095); helix pitch 2.5 µm (BNID 109341).',
		cells: ['bacterium']
	},
	{
		id: 'envelope',
		name: 'Cell envelope',
		kind: 'organelle',
		size: 34 * NM,
		dims: 'two membranes ≈ 34 nm across overall',
		does: 'An outer membrane, a thin mesh wall (peptidoglycan) and the inner cell membrane. Antibiotics like penicillin attack the wall.',
		source:
			'Periplasm 21 nm and peptidoglycan 6.35 nm, by cryo-electron microscopy of frozen cells (BNID 105387, 105385; Matias et al. 2003); inner membrane ≈ 6 nm (BNID 114122).',
		cells: ['bacterium']
	},
	{
		id: 'nucleoid',
		name: 'Nucleoid',
		kind: 'organelle',
		size: 0.5 * UM,
		dims: '≈ 0.2 µm³; 1.5 mm of DNA',
		does: 'The region where the bacterium’s single circular chromosome lies, folded but not enclosed by a membrane.',
		source: 'Volume 0.2 µm³ (BNID 107009); chromosome 1.5 mm long (BNID 107010).',
		cells: ['bacterium']
	},
	{
		id: 'ribosome70S',
		name: 'Ribosome (bacterial)',
		kind: 'machine',
		size: 25 * NM,
		range: [20 * NM, 30 * NM],
		dims: '≈ 25 nm across',
		does: 'The protein factory, slightly smaller than ours. Many antibiotics jam it without harming our own ribosomes.',
		source:
			'Ribosomes 20–30 nm (BNID 102320); ~10,000 per cell, up to 72,000 when growing fast (Cell Biology by the Numbers); PDB 7K00.',
		cells: ['bacterium']
	},
	{
		id: 'rnaPolymerase',
		name: 'RNA polymerase',
		kind: 'machine',
		size: 15 * NM,
		dims: '≈ 15 nm',
		does: 'Copies a gene from DNA into messenger RNA, the first step in making a protein.',
		source: 'PDB 4YG2, measured on the outline.',
		cells: ALL
	},
	{
		id: 'groEL',
		name: 'GroEL chaperone',
		kind: 'machine',
		size: 20 * NM,
		dims: '≈ 15 nm wide, 20 nm tall',
		does: 'A barrel that gives a newly made protein a sheltered space in which to fold correctly.',
		source: 'PDB 1AON, measured on the outline.',
		cells: ['bacterium']
	},
	{
		id: 'trna',
		name: 'Transfer RNA',
		kind: 'molecule',
		size: 7 * NM,
		dims: 'an L shape ≈ 7 nm long',
		does: 'Brings one amino acid to the ribosome and matches it to three letters of the messenger RNA.',
		source: 'PDB 1EHZ, measured on the outline.',
		cells: ALL
	},
	{
		id: 'glucose',
		name: 'Glucose',
		kind: 'molecule',
		size: 1 * NM,
		dims: '≈ 1 nm',
		does: 'A sugar: the cell’s fuel and the raw material it builds many of its other molecules from.',
		source: '≈ 1 nm long (BNID 110368); atoms from RCSB ligand GLC.',
		cells: ALL
	}
];

export const STRUCTURES: Record<string, Structure> = Object.fromEntries(list.map((s) => [s.id, s]));
export const STRUCTURE_LIST: readonly Structure[] = list;
