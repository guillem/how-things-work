/**
 * Layouts of the molecule-scale views, in nanometres from each view's centre
 * (y down). The cell drawings use the same positions when they are zoomed far
 * enough to show these molecules as dots, so the two agree where they overlap.
 *
 * Counts follow from measured concentrations for an ideal thin slice: a kind
 * of molecule at n per µm³ with diameter d appears n × d times per µm² of slice.
 */
import { rng } from './random';
import { ecoliSection, BACTERIUM_TARGETS, ECOLI } from './bacterium';
import { THYLAKOID, THYLAKOID_VIEW_OFFSET } from './plant';
import { ATOM_SPOTS } from './frames';
import { MACHINES } from './shapes';

export type Placed = {
	id: keyof typeof MACHINES;
	x: number;
	y: number;
	angle: number;
	flip?: boolean;
};

// ---- chromatin -------------------------------------------------------------------------------

/**
 * Nucleosomes in a human nucleus: 6.4 × 10⁹ bp at one per ~200 bp in ~270 µm³
 * (an 8 µm nucleus) is ≈ 1.2 × 10⁵ per µm³; a slice cuts n × 11 nm ≈ 1,300
 * per µm². They appear in short runs: a slice cuts the 3D thread into pieces.
 */
export const NUCLEOSOMES_PER_UM3 = 6.4e9 / 200 / ((Math.PI / 6) * 8 ** 3);
export const NUCLEOSOME = 11;
/** Linker DNA between nucleosomes, nm (≈ 50 bp × 0.34 nm). */
export const LINKER = 17;

export interface ChromatinRun {
	/** Nucleosome centres along the run, and the linker path between them. */
	beads: [number, number][];
}

let chromatinCache: ChromatinRun[] | null = null;
/** Runs of beads-on-a-string within ±R nm of the chromatin view's centre. */
export function chromatin(R = 260): ChromatinRun[] {
	if (chromatinCache) return chromatinCache;
	const r = rng(41);
	const want = NUCLEOSOMES_PER_UM3 * (NUCLEOSOME / 1000) * ((2 * R) / 1000) ** 2;
	const runs: ChromatinRun[] = [];
	// the run through the DNA view: a straight linker across the atom spot
	const [sx, sy] = ATOM_SPOTS.dna;
	runs.push({
		beads: [
			[sx - (LINKER + NUCLEOSOME) / 2 - 2, sy - 1],
			[sx + (LINKER + NUCLEOSOME) / 2 + 2, sy + 1],
			[sx + (LINKER + NUCLEOSOME) * 1.4, sy - 12]
		]
	});
	let n = 3;
	const all: [number, number][] = [...runs[0].beads];
	for (let tries = 0; tries < 20000 && n < want; tries++) {
		let x = r.range(-R, R);
		let y = r.range(-R, R);
		let a = r.range(0, Math.PI * 2);
		const beads: [number, number][] = [];
		const len = r.int(2, 6);
		for (let k = 0; k < len; k++) {
			if (all.some(([px, py]) => Math.hypot(px - x, py - y) < NUCLEOSOME + 1.5)) break;
			beads.push([x, y]);
			all.push([x, y]);
			a += r.range(-1.1, 1.1);
			const step = NUCLEOSOME + LINKER * r.range(0.6, 1);
			x += step * Math.cos(a);
			y += step * Math.sin(a);
		}
		if (beads.length) {
			runs.push({ beads });
			n += beads.length;
		}
	}
	chromatinCache = runs;
	return runs;
}

// ---- the crista ------------------------------------------------------------------------------

/** The crista view: a fold 30 nm thick coming from the left, its rounded tip at x = 25. */
export const CRISTA = { half: 15, tip: 25, membrane: 4 } as const;

const TILT = 0.6;
const tipX = CRISTA.tip - CRISTA.half;
/**
 * ATP synthases: a dimer on the ridge at the tip, heads leaning apart (rows of
 * dimers line the ridges of cristae; Davies et al. 2012), and more along the faces.
 * Each sits with its membrane part in the crista membrane (centre at |y| = half).
 */
export const CRISTA_MACHINES: Placed[] = [
	{
		id: 'atpSynthase',
		x: tipX + CRISTA.half * Math.sin(TILT),
		y: -CRISTA.half * Math.cos(TILT),
		angle: TILT,
		flip: true
	},
	{
		id: 'atpSynthase',
		x: tipX + CRISTA.half * Math.sin(TILT),
		y: CRISTA.half * Math.cos(TILT),
		angle: -TILT
	},
	{ id: 'atpSynthase', x: -42, y: -CRISTA.half, angle: 0, flip: true },
	{ id: 'atpSynthase', x: -64, y: CRISTA.half, angle: 0 }
];

/** Where the head (F1, ≈ 10 nm across, centred ≈ 15 nm from the membrane) of a placed ATP synthase is. */
export function headCentre(m: Placed): [number, number] {
	const d = 15 * (m.flip ? -1 : 1);
	// local (0, d) turned by angle (SVG: x' = −d sin a, y' = d cos a)
	return [m.x - d * Math.sin(m.angle), m.y + d * Math.cos(m.angle)];
}

/** ATP in a liver cell: 3.38 mM (BioNumbers 100858), molecules per nm³. */
export const ATP_PER_NM3 = 3.38e-3 * 6.022e23 * 1e-24;

/** Proteins scattered at `perUm3` in a box, avoiding `exclude`, from a mixture of kinds. */
export function scatter(
	seed: number,
	box: { x0: number; x1: number; y0: number; y1: number },
	exclude: (x: number, y: number, r: number) => boolean,
	mix: { id: Placed['id']; share: number; d: number }[],
	perUm3 = PROTEINS_PER_UM3
): Placed[] {
	const r = rng(seed);
	const area = (box.x1 - box.x0) * (box.y1 - box.y0);
	const out: Placed[] = [];
	for (const m of mix) {
		const n = Math.round(perUm3 * 1e-9 * m.share * m.d * area);
		const rad = m.d / 2;
		for (let k = 0, tries = 0; k < n && tries < 6000; tries++) {
			const x = r.range(box.x0, box.x1);
			const y = r.range(box.y0, box.y1);
			if (exclude(x, y, rad)) continue;
			if (out.some((q) => Math.hypot(q.x - x, q.y - y) < rad * 0.9)) continue;
			out.push({ id: m.id, x, y, angle: r.range(0, Math.PI * 2) });
			k++;
		}
	}
	return out;
}

/** Points scattered at `perNm3` × `d` per nm² in a box, avoiding `exclude`. */
export function scatterSmall(
	seed: number,
	box: { x0: number; x1: number; y0: number; y1: number },
	exclude: (x: number, y: number) => boolean,
	perNm3: number,
	d: number
) {
	const r = rng(seed);
	const n = Math.round(perNm3 * d * (box.x1 - box.x0) * (box.y1 - box.y0));
	const out: { x: number; y: number; angle: number }[] = [];
	for (let tries = 0; tries < n * 40 && out.length < n; tries++) {
		const x = r.range(box.x0, box.x1);
		const y = r.range(box.y0, box.y1);
		if (exclude(x, y)) continue;
		out.push({ x, y, angle: r.range(0, Math.PI * 2) });
	}
	return out;
}

// ---- the ribosome on the ER -------------------------------------------------------------------

/** The ER view: the membrane at y = −12, lumen above, cytosol below. Ribosomes 37 nm apart. */
export const ER = { membrane: -12, spacing: 37 } as const;
export const ER_RIBOSOMES: Placed[] = [-2, -1, 0, 1, 2].map((k) => ({
	id: 'ribosome80S',
	x: k * ER.spacing,
	y: ER.membrane,
	angle: 0
}));

// ---- the cell membrane ----------------------------------------------------------------------------

/** Proteins in the membrane view (membrane centre at y = 0; outside above). */
export const MEMBRANE_PROTEINS: Placed[] = [
	{ id: 'naKPump', x: -14, y: 0, angle: 0 },
	{ id: 'kChannel', x: 3, y: 0, angle: 0 },
	{ id: 'glut1', x: 18, y: 0, angle: 0 }
];

// ---- the thylakoid ----------------------------------------------------------------------------------

/** Centre lines of the stacked thylakoids in view (lumen centres), nm; the middle one continues right. */
export const THYLAKOIDS = [-2, -1, 0, 1, 2].map((k) => k * THYLAKOID.repeat * 1000);
/** The granum's margin, nm from the view's centre. */
export const GRANUM_EDGE = -THYLAKOID_VIEW_OFFSET * 1000;
const mOff = (THYLAKOID.lumen / 2 + THYLAKOID.membrane / 2) * 1000;
export const THYLAKOID_MACHINES: Placed[] = [
	// stacked region: photosystem II in the upper and lower membranes of each thylakoid
	...[-1, 0, 1].flatMap((k) => [
		// upper membrane of a thylakoid: the stroma is above, so the shape is flipped
		{ id: 'psii' as const, x: -46 + k * 9, y: THYLAKOIDS[k + 2] - mOff, angle: 0, flip: true },
		{ id: 'b6f' as const, x: -24 - k * 6, y: THYLAKOIDS[k + 2] + mOff, angle: 0, flip: false }
	]),
	// the unstacked lamella facing the stroma: photosystem I and ATP synthase
	{ id: 'psi', x: 16, y: -mOff, angle: 0, flip: true },
	{ id: 'cfAtpSynthase', x: 40, y: mOff, angle: 0 },
	{ id: 'psi', x: 62, y: mOff, angle: 0 }
];
/** Rubisco in the stroma beyond the granum's edge. */
export const STROMA_RUBISCO: [number, number][] = [
	[20, -27],
	[44, -30],
	[18, 34],
	[66, -26],
	[70, 36]
];

// ---- the bacterium's cytoplasm ---------------------------------------------------------------------

/** Envelope layers in the cytoplasm view, nm (y down): outer surface at −32. */
export const ENVELOPE = (() => {
	const om0 = -32;
	const om1 = om0 + ECOLI.outerMembrane * 1000;
	const im0 = om1 + ECOLI.periplasm * 1000;
	const im1 = im0 + ECOLI.innerMembrane * 1000;
	const pg0 = (om1 + im0) / 2 - (ECOLI.peptidoglycan * 1000) / 2;
	return { om0, om1, pg0, pg1: pg0 + ECOLI.peptidoglycan * 1000, im0, im1 };
})();

/** Proteins per µm³ (BioNumbers: 2–4 million) and the share of each kind drawn (illustrative). */
export const PROTEINS_PER_UM3 = 3e6;
const MIX: { id: Placed['id']; share: number; d: number }[] = [
	{ id: 'efTuTrna', share: 0.25, d: 8 },
	{ id: 'adk', share: 0.45, d: 5 },
	{ id: 'trna', share: 0.12, d: 6 },
	{ id: 'groEL', share: 0.05, d: 15 },
	{ id: 'rnaPolymerase', share: 0.05, d: 15 },
	{ id: 'citrateSynthase', share: 0.08, d: 8 }
];

export interface Crowd {
	ribosomes: Placed[];
	proteins: Placed[];
	membrane: Placed[];
	/** DNA strands of the nucleoid's edge: polylines, nm. */
	dna: [number, number][][];
	/** How many proteins the concentration predicts for the slice. */
	expected: number;
	/** Area of the slice of cytoplasm considered, nm². */
	area: number;
}

let crowdCache: Crowd | null = null;
/** The crowd in a box ±X × (envelope … +Y) nm around the cytoplasm view's centre. */
export function crowd(X = 110, Y = 90): Crowd {
	if (crowdCache) return crowdCache;
	const r = rng(23);
	const sec = ecoliSection();
	const [ex, ey] = BACTERIUM_TARGETS.envelope;
	const ribosomes: Placed[] = sec.ribosomes
		.map(([x, y]) => ({ x: (x - ex) * 1000, y: (y - ey) * 1000 - 32 }))
		.filter((p) => Math.abs(p.x) < X + 20 && p.y < Y + 20)
		.map((p) => ({ id: 'ribosome70S' as const, ...p, angle: r.range(0, Math.PI * 2) }));
	const top = ENVELOPE.im1 + 1;
	const area = 2 * X * (Y - top);
	const proteins: Placed[] = [];
	let expected = 0;
	const [gx, gy] = ATOM_SPOTS.glucose;
	for (const m of MIX) {
		// n per nm² of slice = n per nm³ × diameter
		const n = Math.round(PROTEINS_PER_UM3 * 1e-9 * m.share * m.d * area);
		expected += n;
		const rad = m.d / 2;
		for (let k = 0, tries = 0; k < n && tries < 4000; tries++) {
			const x = r.range(-X, X);
			const y = r.range(top + rad, Y);
			if (Math.hypot(x - gx, y - gy) < rad + 2.5) continue;
			if (ribosomes.some((q) => Math.hypot(q.x - x, q.y - y) < 12 + rad * 0.6)) continue;
			if (proteins.some((q) => Math.hypot(q.x - x, q.y - y) < rad * 0.9)) continue;
			proteins.push({ id: m.id, x, y, angle: r.range(0, Math.PI * 2) });
			k++;
		}
	}
	const membrane: Placed[] = [];
	for (let x = -X + 6; x < X; x += r.range(16, 26))
		membrane.push({ id: 'ompF', x, y: (ENVELOPE.om0 + ENVELOPE.om1) / 2, angle: 0, flip: true });
	for (let x = -X + 14; x < X; x += r.range(24, 40))
		membrane.push({ id: 'lacY', x, y: (ENVELOPE.im0 + ENVELOPE.im1) / 2, angle: 0 });
	const dna: [number, number][][] = [];
	for (let k = 0; k < 3; k++) {
		const pts: [number, number][] = [];
		let x = -X - 10;
		let y = Y - 20 - k * 22 + r.range(-5, 5);
		let a = r.range(-0.3, 0.3);
		while (x < X + 10) {
			pts.push([x, y]);
			a += r.range(-0.25, 0.25);
			a = Math.max(-0.7, Math.min(0.7, a));
			x += 4 * Math.cos(a);
			y += 4 * Math.sin(a);
		}
		dna.push(pts);
	}
	crowdCache = { ribosomes, proteins, membrane, dna, expected, area };
	return crowdCache;
}

// ---- water around the small molecules ----------------------------------------------------------------

/**
 * Water molecules in a slice of thickness `depth` nm: 33.4 per nm³ (55 mol/L).
 * Positions are a random packing at least 0.24 nm apart in projection (seeded), oriented at
 * random; the molecule in the view keeps a clear space around its atoms.
 */
export const WATER_PER_NM3 = 33.4;
export function waters(
	w: number,
	h: number,
	keepOut: (x: number, y: number) => boolean,
	depth = 0.3,
	seed = 5
): { x: number; y: number; angle: number }[] {
	const r = rng(seed);
	const want = Math.round(WATER_PER_NM3 * depth * w * h);
	const out: { x: number; y: number; angle: number }[] = [];
	for (let tries = 0; tries < want * 60 && out.length < want; tries++) {
		const x = r.range(-w / 2, w / 2);
		const y = r.range(-h / 2, h / 2);
		if (keepOut(x, y)) continue;
		if (out.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < 0.24 * 0.24)) continue;
		out.push({ x, y, angle: r.range(0, Math.PI * 2) });
	}
	return out;
}
