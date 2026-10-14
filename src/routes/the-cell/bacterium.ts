/**
 * The bacterium of "The cell": a field of E. coli and one cell in section.
 *
 * Sizes: cells ≈ 1 µm wide and 2 µm long (BNID 101788, 100002), drawn
 * 1.6–3 µm long as they grow before dividing; flagella ≈ 20 nm thick and
 * 5–10 µm long (BNID 100096, 100095), a helix 0.5 µm across with a 2.5 µm
 * pitch (BNID 109341). Envelope: outer membrane, a periplasm 11–15 nm wide
 * (BNID 100016) holding the 6.35 nm peptidoglycan wall (BNID 105385), and the
 * ≈ 6 nm inner membrane (BNID 114122). Nucleoid ≈ 0.2 µm³ (BNID 107009).
 * Ribosomes ≈ 25 nm, about 10,000 per cell (Cell Biology by the Numbers;
 * up to 72,000 in fast growth), 85–90% of them outside the nucleoid
 * (BNID 108595).
 *
 * Sections are ideal thin slices: a ribosome is drawn if the slice passes
 * through it, so per µm² of section there are (ribosomes per µm³) × (ribosome
 * diameter) of them. Lengths in micrometres, y down, the target cell at 0.
 */
import { rng } from './random';
import { inCapsule, type Capsule, type Pt } from './liver';

export const ECOLI = {
	length: 2.2,
	width: 1.0,
	outerMembrane: 0.007,
	periplasm: 0.013,
	peptidoglycan: 0.00635,
	innerMembrane: 0.006,
	ribosome: 0.025,
	ribosomesPerCell: 10000,
	/** Share of ribosomes inside the nucleoid (10–15%, BNID 108595). */
	inNucleoid: 0.12,
	flagellum: { width: 0.02, pitch: 2.5, radius: 0.25 }
} as const;

export const envelopeThickness = ECOLI.outerMembrane + ECOLI.periplasm + ECOLI.innerMembrane;

/** Volume of a spherocylinder (capsule) of length L and diameter d. */
export const capsuleVolume = (L: number, d: number) =>
	Math.PI * (d / 2) ** 2 * (L - d) + (Math.PI / 6) * d ** 3;

export interface Bug extends Capsule {
	flagella: { angle: number; length: number; phase: number; at: number }[];
}

let colonyCache: Bug[] | null = null;
export function colony(): Bug[] {
	if (colonyCache) return colonyCache;
	const r = rng(101);
	const cells: Bug[] = [
		{
			x: 0,
			y: 0,
			a: ECOLI.length / 2,
			b: ECOLI.width / 2,
			angle: 0,
			flagella: [
				{ angle: Math.PI + 0.25, length: 7, phase: 0.1, at: -0.7 },
				{ angle: Math.PI - 0.35, length: 6, phase: 0.6, at: -0.3 },
				{ angle: 0.3, length: 5.5, phase: 0.3, at: 0.5 }
			]
		}
	];
	for (let tries = 0; tries < 3000 && cells.length < 34; tries++) {
		const L = r.range(1.6, 3.0);
		const c: Bug = {
			x: r.range(-16, 16),
			y: r.range(-10, 10),
			a: L / 2,
			b: r.range(0.45, 0.52),
			angle: r.range(0, Math.PI * 2),
			flagella: []
		};
		if (cells.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.a + c.a + 0.6)) continue;
		const nf = r.int(1, 4);
		for (let k = 0; k < nf; k++)
			c.flagella.push({
				angle: c.angle + Math.PI + r.range(-0.6, 0.6),
				length: r.range(5, 9),
				phase: r.next(),
				at: r.range(-0.8, 0.8)
			});
		cells.push(c);
	}
	colonyCache = cells;
	return cells;
}

/** Points along a flagellum: a helix seen side-on, starting at the cell surface. */
export function flagellumPath(cell: Capsule, fl: Bug['flagella'][number], t = 0, step = 0.1): Pt[] {
	const ca = Math.cos(cell.angle);
	const sa = Math.sin(cell.angle);
	// base point on the cell's surface, near the end facing the flagellum
	const u = fl.at * (cell.a - cell.b);
	const dir = [Math.cos(fl.angle), Math.sin(fl.angle)];
	const bx = cell.x + u * ca;
	const by = cell.y + u * sa;
	// step out of the capsule along the flagellum direction
	let s0 = 0;
	while (inCapsule(cell, bx + dir[0] * s0, by + dir[1] * s0) && s0 < 3) s0 += 0.02;
	const pts: Pt[] = [];
	const { pitch, radius } = ECOLI.flagellum;
	for (let s = 0; s <= fl.length; s += step) {
		const w = radius * Math.min(1, s / 0.6) * Math.sin(((s - t) / pitch + fl.phase) * Math.PI * 2);
		pts.push([bx + dir[0] * (s0 + s) - dir[1] * w, by + dir[1] * (s0 + s) + dir[0] * w]);
	}
	return pts;
}

export interface EcoliSection {
	cell: Capsule;
	/** Nucleoid outline (a lobed blob), µm. */
	nucleoid: Pt[];
	/** Centres of the ribosomes cut by the section, µm. */
	ribosomes: Pt[];
	sectionArea: number;
}

function inPoly(p: readonly Pt[], x: number, y: number) {
	let inside = false;
	for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
		const [xi, yi] = p[i];
		const [xj, yj] = p[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

let sectionCache: EcoliSection | null = null;
export function ecoliSection(): EcoliSection {
	if (sectionCache) return sectionCache;
	const r = rng(3);
	const cell: Capsule = { x: 0, y: 0, a: ECOLI.length / 2, b: ECOLI.width / 2, angle: 0 };
	const nucleoid: Pt[] = [];
	for (let k = 0; k < 48; k++) {
		const a = (k / 48) * Math.PI * 2;
		const rr =
			1 + 0.12 * Math.sin(3 * a + 0.5) + 0.08 * Math.sin(5 * a + 1.3) + 0.05 * Math.sin(9 * a);
		nucleoid.push([0.62 * rr * Math.cos(a), 0.24 * rr * Math.sin(a) + 0.02]);
	}
	const L = ECOLI.length;
	const d = ECOLI.width;
	const volume = capsuleVolume(L, d);
	const inner = d / 2 - envelopeThickness;
	const sectionArea = Math.PI * inner * inner + 2 * inner * (L - d);
	// ribosomes cut by an ideal thin section, per µm² of section
	const perArea = (ECOLI.ribosomesPerCell / volume) * ECOLI.ribosome;
	const n = Math.round(perArea * sectionArea);
	const ribosomes: Pt[] = [];
	const nIn = Math.round(n * ECOLI.inNucleoid);
	const innerCap: Capsule = { ...cell, b: inner - ECOLI.ribosome / 2 };
	const near = (x: number, y: number) =>
		ribosomes.some(([px, py]) => Math.hypot(px - x, py - y) < ECOLI.ribosome * 1.05);
	let inside = 0;
	for (let tries = 0; tries < 200000 && ribosomes.length < n; tries++) {
		const x = r.range(-L / 2, L / 2);
		const y = r.range(-d / 2, d / 2);
		if (!inCapsule(innerCap, x, y)) continue;
		const inNuc = inPoly(nucleoid, x, y);
		if (inNuc && inside >= nIn) continue;
		if (!inNuc && ribosomes.length - inside >= n - nIn) continue;
		if (near(x, y)) continue;
		ribosomes.push([x, y]);
		if (inNuc) inside++;
	}
	sectionCache = { cell, nucleoid, ribosomes, sectionArea };
	return sectionCache;
}

export const BACTERIUM_TARGETS: { envelope: Pt } = {
	// the top of the cell, where the envelope runs straight: outside above, cytoplasm below
	envelope: [0.15, -ECOLI.width / 2]
};
