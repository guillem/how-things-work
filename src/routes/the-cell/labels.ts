/**
 * Callouts on the zoom's drawings: where each label points (in the drawing's
 * own units, as in frames/*), what it says, and the magnifications (stage px
 * per drawing unit) at which it is shown. They are taken from the same
 * geometry as the drawings, so they always point at the right thing.
 */
import { colors } from '#lib/draw/index.ts';
import { colony } from './bacterium';
import { hepatocyte, liverTissue } from './liver';
import {
	CRISTA,
	CRISTA_MACHINES,
	ENVELOPE,
	ER,
	GRANUM_EDGE,
	MEMBRANE_PROTEINS,
	STROMA_RUBISCO,
	THYLAKOIDS,
	THYLAKOID_MACHINES,
	chromatin,
	crowd,
	headCentre
} from './molecular';
import { leaf, palisadeCell } from './plant';
import { ATOM_SPOTS } from './frames';

export interface Callout {
	/** Structure the label picks. */
	id: string;
	text: string;
	/** Anchor, drawing units. */
	x: number;
	y: number;
	/** Offset of the label from the anchor, stage units. */
	dx: number;
	dy: number;
	/** Shown between these magnifications (stage px per drawing unit). */
	min?: number;
	max?: number;
}

const h = hepatocyte();
const T = liverTissue();
const N = h.nucleus;
const nearest = <P extends { x: number; y: number }>(list: P[], x: number, y: number) =>
	list.reduce((b, p) => (Math.hypot(p.x - x, p.y - y) < Math.hypot(b.x - x, b.y - y) ? p : b));

const leftCell = T.cells
	.filter((c) => !c.target)
	.reduce((b, c) =>
		Math.abs(c.nucleus.x + 60) + Math.abs(c.nucleus.y) <
		Math.abs(b.nucleus.x + 60) + Math.abs(b.nucleus.y)
			? c
			: b
	);
const rbc = nearest(T.rbcs, 40, -15);
const mito = nearest(h.mitochondria.slice(1), -9, -4);
const lyso = nearest(h.lysosomes, 8, 6);
const perox = nearest(h.peroxisomes, -8, 6);
const golgiMid = h.golgi[2]?.[Math.floor((h.golgi[2]?.length ?? 1) / 2)] ?? [N.x, N.y - 6];
const rer = h.rer[0][Math.floor(h.rer[0].length / 2)];
const pore = h.pores[Math.floor(h.pores.length * 0.62)];
const [tx, ty] = h.targets.cristaTip;
const [ex, ey] = h.targets.erFace;
const [bx, by] = h.targets.edge;
const run =
	chromatin().find(
		(r) => r.beads.length > 2 && Math.hypot(r.beads[1][0] - 30, r.beads[1][1] + 10) < 60
	) ?? chromatin()[1];

const L = leaf();
const P = palisadeCell();
const bug = colony()[0];
const cr = crowd();
const nearC = (id: string, x: number, y: number) => {
	const list = [
		...cr.proteins.filter((p) => p.id === id),
		...cr.ribosomes.filter((p) => p.id === id)
	];
	return list.length ? nearest(list, x, y) : { x, y };
};

export const CALLOUTS: Record<string, Callout[]> = {
	liver: [
		{
			id: 'hepatocyte',
			text: 'liver cell',
			x: leftCell.nucleus.x + 6,
			y: leftCell.nucleus.y + 6,
			dx: -30,
			dy: 60
		},
		{
			id: 'nucleus',
			text: 'nucleus',
			x: leftCell.nucleus.x,
			y: leftCell.nucleus.y,
			dx: -40,
			dy: -50
		},
		{ id: 'redBloodCell', text: 'red blood cell', x: rbc.x, y: rbc.y, dx: 30, dy: -40 },
		{ id: 'sinusoid', text: 'blood capillary (sinusoid)', x: rbc.x + 30, y: rbc.y, dx: 40, dy: 40 }
	],
	hepatocyte: [
		{ id: 'nucleus', text: 'nucleus', x: N.x - 2.8, y: N.y + 2.4, dx: -70, dy: 60, max: 45 },
		{
			id: 'nucleolus',
			text: 'nucleolus',
			x: h.nucleolus.x,
			y: h.nucleolus.y,
			dx: 50,
			dy: -66,
			max: 50
		},
		{ id: 'mitochondrion', text: 'mitochondrion', x: mito.x, y: mito.y, dx: -40, dy: -50, max: 45 },
		{ id: 'roughER', text: 'rough ER', x: rer[0], y: rer[1], dx: 40, dy: 50, max: 45 },
		{ id: 'golgi', text: 'Golgi', x: golgiMid[0], y: golgiMid[1], dx: -40, dy: -40, max: 45 },
		{ id: 'lysosome', text: 'lysosome', x: lyso.x, y: lyso.y, dx: 40, dy: 40, max: 45 },
		{ id: 'peroxisome', text: 'peroxisome', x: perox.x, y: perox.y, dx: -50, dy: 46, max: 45 },
		{ id: 'plasmaMembrane', text: 'cell membrane', x: -10.5, y: -6.9, dx: -40, dy: -50, max: 45 },
		// the nucleus close up
		{
			id: 'nuclearEnvelope',
			text: 'nuclear envelope (2 membranes)',
			x: N.x + N.r * Math.cos(-2.4),
			y: N.y + N.r * Math.sin(-2.4),
			dx: -40,
			dy: -40,
			min: 50,
			max: 160
		},
		{
			id: 'nuclearPore',
			text: 'nuclear pore',
			x: N.x + N.r * Math.cos(pore),
			y: N.y + N.r * Math.sin(pore),
			dx: 50,
			dy: 40,
			min: 50,
			max: 160
		},
		{
			id: 'nucleolus',
			text: 'nucleolus',
			x: h.nucleolus.x,
			y: h.nucleolus.y,
			dx: 60,
			dy: -60,
			min: 50,
			max: 160
		},
		{
			id: 'chromatin',
			text: 'packed DNA (chromatin)',
			x: h.heterochromatin[3].x,
			y: h.heterochromatin[3].y,
			dx: -60,
			dy: 50,
			min: 50,
			max: 160
		},
		// the mitochondrion
		{
			id: 'crista',
			text: 'crista (fold of the inner membrane)',
			x: tx - 0.15,
			y: ty,
			dx: -60,
			dy: -70,
			min: 200,
			max: 700
		},
		{
			id: 'mitochondrion',
			text: 'outer membrane',
			x: h.targets.mito.x - h.targets.mito.b,
			y: h.targets.mito.y + 0.6,
			dx: -70,
			dy: 40,
			min: 200,
			max: 700
		},
		// rough ER
		{
			id: 'roughER',
			text: 'rough ER sheet',
			x: ex - 0.4,
			y: ey - 0.03,
			dx: -40,
			dy: -60,
			min: 300,
			max: 1100
		},
		{
			id: 'ribosome',
			text: 'ribosomes',
			x: ex + 0.185,
			y: ey + 0.014,
			dx: 40,
			dy: 50,
			min: 300,
			max: 1100
		},
		// the edge
		{
			id: 'plasmaMembrane',
			text: 'cell membrane',
			x: bx - 0.3,
			y: by,
			dx: -30,
			dy: -50,
			min: 400,
			max: 1400
		},
		{
			id: 'actin',
			text: 'actin filaments',
			x: bx + 0.2,
			y: by + 0.08,
			dx: 50,
			dy: 50,
			min: 400,
			max: 1400
		}
	],
	chromatin: [
		{
			id: 'nucleosome',
			text: 'nucleosome',
			x: run.beads[1][0],
			y: run.beads[1][1],
			dx: 50,
			dy: -50
		},
		{ id: 'dna', text: 'DNA', x: ATOM_SPOTS.dna[0], y: ATOM_SPOTS.dna[1], dx: -30, dy: 60 },
		{ id: 'protein', text: 'proteins', x: 30, y: 25, dx: 40, dy: 40 }
	],
	crista: [
		...CRISTA_MACHINES.slice(0, 1).map((m) => {
			const [hx, hy] = headCentre(m);
			return { id: 'atpSynthase', text: 'ATP synthase', x: hx, y: hy, dx: -50, dy: -40 };
		}),
		{ id: 'crista', text: 'crista membrane', x: -20, y: CRISTA.half, dx: -40, dy: 60 },
		{ id: 'atp', text: 'ATP', x: ATOM_SPOTS.atp[0], y: ATOM_SPOTS.atp[1], dx: 40, dy: -30 },
		{ id: 'mitochondrion', text: 'matrix', x: 40, y: 22, dx: 30, dy: 40 }
	],
	ribosome: [
		{ id: 'ribosome', text: 'ribosome', x: -10, y: ER.membrane + 18, dx: -50, dy: 60 },
		{ id: 'sec61', text: 'Sec61 channel', x: 0, y: ER.membrane, dx: 50, dy: -40 },
		{ id: 'roughER', text: 'inside the ER', x: -30, y: ER.membrane - 6, dx: -30, dy: -30 },
		{ id: 'cytosol', text: 'cytosol', x: 40, y: 22, dx: 40, dy: 40 }
	],
	membrane: [
		{ id: 'naKPump', text: 'Na⁺/K⁺ pump', x: MEMBRANE_PROTEINS[0].x, y: 6, dx: -40, dy: 70 },
		{ id: 'kChannel', text: 'K⁺ channel', x: MEMBRANE_PROTEINS[1].x, y: -5, dx: 10, dy: -70 },
		{ id: 'glut', text: 'glucose transporter', x: MEMBRANE_PROTEINS[2].x, y: 3, dx: 30, dy: 70 },
		{ id: 'plasmaMembrane', text: 'lipid bilayer', x: -22, y: 0, dx: -30, dy: -60 },
		{ id: 'sinusoid', text: 'outside the cell', x: -2, y: -12, dx: 0, dy: 0 },
		{ id: 'cytosol', text: 'inside the cell', x: -2, y: 13, dx: 0, dy: 0 }
	],
	leaf: [
		{ id: 'leaf', text: 'epidermis', x: L.upper[8].x, y: L.upper[8].y, dx: -40, dy: -46 },
		{
			id: 'mesophyllCell',
			text: 'palisade cell',
			x: L.palisade[8].x,
			y: L.palisade[8].y,
			dx: -60,
			dy: 40
		},
		{
			id: 'chloroplast',
			text: 'chloroplasts',
			x: L.palisade[12].x + 10.4,
			y: L.palisade[12].y + 6,
			dx: 50,
			dy: -30
		},
		{
			id: 'leaf',
			text: 'spongy layer, air spaces',
			x: L.spongy[3].x,
			y: L.spongy[3].y,
			dx: 40,
			dy: 40
		}
	],
	mesophyll: [
		{
			id: 'cellWall',
			text: 'cell wall',
			x: P.box.x - P.box.w / 2,
			y: P.box.y - 12,
			dx: -60,
			dy: -40,
			max: 40
		},
		{ id: 'vacuole', text: 'vacuole', x: P.box.x - 2, y: P.box.y + 4, dx: -50, dy: 50, max: 40 },
		{
			id: 'chloroplast',
			text: 'chloroplast',
			x: P.chloroplasts[3].x,
			y: P.chloroplasts[3].y,
			dx: 50,
			dy: -36,
			max: 40
		},
		{ id: 'nucleus', text: 'nucleus', x: P.nucleus.x, y: P.nucleus.y, dx: 50, dy: 40, max: 40 },
		{
			id: 'granum',
			text: 'granum',
			x: P.chloroplasts[0].x,
			y: P.chloroplasts[0].y,
			dx: -40,
			dy: 70,
			min: 60,
			max: 600
		},
		{
			id: 'thylakoid',
			text: 'thylakoid',
			x: P.chloroplasts[0].x + 0.4,
			y: P.chloroplasts[0].y + 0.02,
			dx: 40,
			dy: 60,
			min: 300,
			max: 1400
		}
	],
	thylakoid: [
		{
			id: 'psii',
			text: 'photosystem II',
			x: THYLAKOID_MACHINES[2].x - 6,
			y: THYLAKOID_MACHINES[2].y,
			dx: -50,
			dy: -50
		},
		{
			id: 'b6f',
			text: 'cytochrome b₆f',
			x: THYLAKOID_MACHINES[3].x,
			y: THYLAKOID_MACHINES[3].y,
			dx: -30,
			dy: 50
		},
		{
			id: 'psi',
			text: 'photosystem I',
			x: THYLAKOID_MACHINES[6].x,
			y: THYLAKOID_MACHINES[6].y - 4,
			dx: 30,
			dy: -60
		},
		{
			id: 'cfAtpSynthase',
			text: 'ATP synthase',
			x: THYLAKOID_MACHINES[7].x,
			y: THYLAKOID_MACHINES[7].y + 14,
			dx: 40,
			dy: 40
		},
		{
			id: 'rubisco',
			text: 'Rubisco',
			x: STROMA_RUBISCO[1][0],
			y: STROMA_RUBISCO[1][1],
			dx: 40,
			dy: -30
		},
		{ id: 'thylakoid', text: 'lumen', x: GRANUM_EDGE - 30, y: THYLAKOIDS[3], dx: 0, dy: 0 }
	],
	colony: [
		{ id: 'ecoli', text: 'E. coli', x: bug.x, y: bug.y, dx: -30, dy: -50 },
		{ id: 'flagellum', text: 'flagellum', x: bug.x - 4, y: bug.y + 0.8, dx: -30, dy: 50 }
	],
	ecoli: [
		{ id: 'envelope', text: 'envelope', x: -0.6, y: -0.5, dx: -40, dy: -46, max: 600 },
		{ id: 'nucleoid', text: 'nucleoid (DNA)', x: 0.1, y: 0.05, dx: -60, dy: 90, max: 600 },
		{ id: 'ribosome70S', text: 'ribosomes', x: 0.75, y: 0.2, dx: 40, dy: 60, max: 600 },
		{ id: 'flagellum', text: 'flagellum', x: -1.4, y: 0.35, dx: -10, dy: 60, max: 600 }
	],
	cytoplasm: [
		{
			id: 'envelope',
			text: 'outer membrane',
			x: -60,
			y: (ENVELOPE.om0 + ENVELOPE.om1) / 2,
			dx: -20,
			dy: -30
		},
		{
			id: 'envelope',
			text: 'wall (peptidoglycan)',
			x: 30,
			y: (ENVELOPE.pg0 + ENVELOPE.pg1) / 2,
			dx: 0,
			dy: 0
		},
		{
			id: 'ribosome70S',
			text: 'ribosome',
			x: nearC('ribosome70S', 0, 40).x,
			y: nearC('ribosome70S', 0, 40).y,
			dx: -60,
			dy: 40
		},
		{
			id: 'groEL',
			text: 'GroEL',
			x: nearC('groEL', -40, 20).x,
			y: nearC('groEL', -40, 20).y,
			dx: -40,
			dy: 0
		},
		{
			id: 'rnaPolymerase',
			text: 'RNA polymerase',
			x: nearC('rnaPolymerase', 30, 30).x,
			y: nearC('rnaPolymerase', 30, 30).y,
			dx: 40,
			dy: 30
		},
		{
			id: 'glucose',
			text: 'glucose',
			x: ATOM_SPOTS.glucose[0],
			y: ATOM_SPOTS.glucose[1],
			dx: 40,
			dy: -30
		}
	],
	atoms: []
};

/** Colour keys shown with some views (by frame id). */
const C = { color: 'var(--carbon)', text: 'carbon' };
const O = { color: colors.oxygen, text: 'oxygen' };
const Nn = { color: colors.nitrogen, text: 'nitrogen' };
const Hh = { color: colors.hydrogen, text: 'hydrogen' };
const Pp = { color: colors.phosphate, text: 'phosphorus' };
const W = { color: 'var(--tc-water)', text: 'water molecules' };
export const LEGENDS: Record<string, { color: string; text: string }[]> = {
	membrane: [
		{ color: '#9c36b5', text: 'Na⁺ sodium ion' },
		{ color: '#2f9e44', text: 'K⁺ potassium ion' }
	],
	dnaAtoms: [
		{ color: '#f76707', text: 'A adenine' },
		{ color: '#fab005', text: 'T thymine' },
		{ color: '#40c057', text: 'C cytosine' },
		{ color: '#228be6', text: 'G guanine' },
		{ color: '#adb5bd', text: 'sugar–phosphate backbone' },
		W
	],
	atpAtoms: [C, O, Nn, Pp, Hh, W],
	chlorophyllAtoms: [C, O, Nn, Hh, { color: '#40c057', text: 'magnesium' }],
	glucoseAtoms: [C, O, Hh, W]
};
