/**
 * The plant of "The cell": a leaf cross-section and one of its palisade cells.
 *
 * Sizes: leaf 240 µm thick (Arabidopsis, BNID 100823); upper-epidermis cells
 * ≈ 850 µm² in cross-section (BNID 100824); mesophyll cells ≈ 1,335 µm²
 * (BNID 100825), drawn 24 × 56 µm; cell wall 0.1 µm (BNID 106007, 108121).
 * Shares of the cell (spinach mesophyll, BNID 104368–104372): vacuole 79%,
 * chloroplasts 16%, cytosol 3%, mitochondria 0.5%, nucleus 0.3%. As for the
 * liver cell, each share of the volume is drawn as the same share of the
 * section's area (the section passes through the nucleus, drawn whole).
 * Chloroplasts: lens-shaped, ≈ 5 µm long and 2.5 µm thick (BNID 107012), with
 * grana 0.3–0.6 µm across (BNID 107014) made of thylakoids whose membrane is
 * 4.9 nm thick around a 9 nm lumen, stacked with 3.6 nm gaps (measured in the
 * alga Chlamydomonas, BNID 111325–111327). The arrangement of cells is
 * schematic; lengths are in micrometres, y pointing down, leaf centre at 0.
 */
import { rng } from './random';
import type { Capsule, Disc, Pt } from './liver';

export const LEAF = {
	width: 400,
	thickness: 240,
	epidermis: 20,
	palisade: { w: 24, h: 56, gap: 3 },
	wall: 0.1
} as const;

export const PLANT_SHARES = {
	vacuole: 0.79,
	chloroplasts: 0.16,
	cytosol: 0.03,
	mitochondria: 0.005,
	nucleus: 0.003
} as const;

export const THYLAKOID = {
	membrane: 0.0049,
	lumen: 0.009,
	gap: 0.0036,
	/** Centre-to-centre distance of stacked thylakoids. */
	get repeat() {
		return 2 * this.membrane + this.lumen + this.gap;
	}
} as const;

const top = -LEAF.thickness / 2;
const palisadeTop = top + LEAF.epidermis + 1;
const palisadeY = palisadeTop + LEAF.palisade.h / 2;

/** A rounded-rectangle cell. */
export interface BoxCell {
	x: number;
	y: number;
	w: number;
	h: number;
	r: number;
}

export interface Chloroplast {
	x: number;
	y: number;
	/** Half-length and half-thickness of the lens, µm. */
	a: number;
	b: number;
	angle: number;
}

export interface Granum {
	/** Centre in the chloroplast's own frame (u along, v across), µm. */
	u: number;
	v: number;
	/** Width across, µm, and number of stacked thylakoids. */
	w: number;
	n: number;
}

export interface Leaf {
	upper: BoxCell[];
	lower: BoxCell[];
	palisade: BoxCell[];
	spongy: Disc[];
	stomata: number[];
}

export interface PalisadeCell {
	box: BoxCell;
	chloroplasts: Chloroplast[];
	nucleus: Disc;
	mitochondria: Capsule[];
	/** Thickness of the layer of cytoplasm under the wall, and around each chloroplast, µm. */
	band: number;
	halo: number;
	areas: {
		cell: number;
		chloroplasts: number;
		nucleus: number;
		mitochondria: number;
		vacuole: number;
	};
}

const rbox = (x: number, y: number, w: number, h: number, r: number): BoxCell => ({
	x,
	y,
	w,
	h,
	r
});
export const boxArea = (b: BoxCell) => b.w * b.h - (4 - Math.PI) * b.r * b.r;
export const lensArea = (c: Chloroplast) => Math.PI * c.a * c.b;

let leafCache: Leaf | null = null;
export function leaf(): Leaf {
	if (leafCache) return leafCache;
	const r = rng(77);
	const upper: BoxCell[] = [];
	const lower: BoxCell[] = [];
	for (let x = -LEAF.width / 2 - 30; x < LEAF.width / 2 + 30;) {
		const w = r.range(34, 50);
		upper.push(rbox(x + w / 2, top + LEAF.epidermis / 2, w - 1, LEAF.epidermis - 1, 4));
		x += w;
	}
	for (let x = -LEAF.width / 2 - 30; x < LEAF.width / 2 + 30;) {
		const w = r.range(30, 46);
		lower.push(rbox(x + w / 2, -top - LEAF.epidermis / 2, w - 1, LEAF.epidermis - 2, 4));
		x += w;
	}
	const palisade: BoxCell[] = [];
	const P = LEAF.palisade;
	for (let i = -10; i <= 10; i++) {
		const x = i * (P.w + P.gap) + (i === 0 ? 0 : r.range(-1, 1));
		const h = i === 0 ? P.h : P.h - r.range(0, 8);
		palisade.push(rbox(x, palisadeTop + h / 2, P.w, h, 6));
	}
	const spongy: Disc[] = [];
	for (let tries = 0; tries < 4000 && spongy.length < 60; tries++) {
		const d: Disc = {
			x: r.range(-230, 230),
			y: r.range(palisadeTop + P.h + 16, -top - LEAF.epidermis - 12),
			r: r.range(11, 17)
		};
		if (spongy.every((s) => Math.hypot(s.x - d.x, s.y - d.y) > s.r + d.r + 4)) spongy.push(d);
	}
	const stomata = [-150, -40, 75, 185];
	leafCache = { upper, lower, palisade, spongy, stomata };
	return leafCache;
}

let cellCache: PalisadeCell | null = null;
const BAND = 0.2;
const HALO = 0.1;

/** The palisade cell at the centre of the leaf, with its chloroplasts. */
export function palisadeCell(): PalisadeCell {
	if (cellCache) return cellCache;
	const r = rng(5);
	const box = rbox(0, palisadeY, LEAF.palisade.w, LEAF.palisade.h, 6);
	const area = boxArea(box);
	const want = PLANT_SHARES.chloroplasts * area;
	const chloroplasts: Chloroplast[] = [];
	const a = 2.5;
	const b = 1.25;
	const inset = LEAF.wall + 0.25 + b;
	// the target first: lying along the top wall
	chloroplasts.push({ x: 0, y: box.y - box.h / 2 + inset, a, b, angle: 0 });
	let got = lensArea(chloroplasts[0]);
	// then along both long walls, top to bottom
	const xs = [box.x - box.w / 2 + inset, box.x + box.w / 2 - inset];
	for (let k = 0; got < want && k < 40; k++) {
		const side = k % 2;
		const row = Math.floor(k / 2);
		const y = box.y - box.h / 2 + 7 + row * 5.25;
		if (y > box.y + box.h / 2 - 4) break;
		const c = {
			x: xs[side],
			y: y + r.range(-0.2, 0.2),
			a: a * r.range(0.9, 1.0),
			b: b * r.range(0.9, 1.0),
			angle: Math.PI / 2
		};
		chloroplasts.push(c);
		got += lensArea(c);
	}
	// along the bottom wall, if more are needed
	for (const x of [-6, 0, 6]) {
		if (got >= want) break;
		const c = { x, y: box.y + box.h / 2 - inset, a, b, angle: 0 };
		chloroplasts.push(c);
		got += lensArea(c);
	}
	// the nucleus, pressed against a wall: 0.3% of the volume, drawn whole in this section
	const nucleus: Disc = { x: box.x + box.w / 2 - 3.6, y: box.y + 9, r: 2.75 };
	const mitochondria: Capsule[] = [];
	let mito = 0;
	const mwant = PLANT_SHARES.mitochondria * area;
	for (let k = 0; mito < mwant && k < 20; k++) {
		const side = k % 2;
		const y = box.y - box.h / 2 + 4.4 + Math.floor(k / 2) * 5.25 + 2.6;
		const c: Capsule = {
			x: (side ? 1 : -1) * (box.w / 2 - LEAF.wall - 0.55),
			y,
			a: 0.5,
			b: 0.3,
			angle: Math.PI / 2
		};
		mitochondria.push(c);
		mito += Math.PI * c.b * c.b + 4 * c.b * (c.a - c.b);
	}
	cellCache = {
		box,
		chloroplasts,
		nucleus,
		mitochondria,
		band: BAND,
		halo: HALO,
		areas: {
			cell: area,
			chloroplasts: got,
			nucleus: Math.PI * nucleus.r ** 2,
			mitochondria: mito,
			// what is left inside the wall, the cytoplasm layer and the cytoplasm around
			// each chloroplast, the nucleus and the mitochondria
			vacuole:
				boxArea(
					rbox(box.x, box.y, box.w - 2 * (LEAF.wall + BAND), box.h - 2 * (LEAF.wall + BAND), box.r)
				) -
				chloroplasts.reduce((s, c) => s + Math.PI * (c.a + HALO) * (c.b + HALO), 0) -
				Math.PI * (nucleus.r + HALO) ** 2 -
				mito
		}
	};
	return cellCache;
}

/** Grana of a chloroplast, in its own frame; the target granum (index 0) at the centre. */
export function grana(seed: number, c: Chloroplast): Granum[] {
	const r = rng(seed);
	const out: Granum[] = [{ u: 0, v: 0, w: 0.45, n: 12 }];
	for (let u = -c.a + 0.55; u < c.a - 0.5; u += 0.62) {
		if (Math.abs(u) < 0.5) continue;
		const lim = c.b * Math.sqrt(Math.max(0, 1 - (u / c.a) ** 2)) - 0.3;
		if (lim < 0.15) continue;
		out.push({
			u: u + r.range(-0.05, 0.05),
			v: r.range(-lim * 0.4, lim * 0.4),
			w: r.range(0.32, 0.55),
			n: r.int(5, Math.min(16, Math.floor((2 * lim) / THYLAKOID.repeat)))
		});
	}
	return out;
}

const target = palisadeCell().chloroplasts[0];
const g0 = grana(11, target)[0];
/** Height of the target granum, µm. */
const g0h = g0.n * THYLAKOID.repeat;

export const PLANT_TARGETS: { cell: Pt; chloroplast: Pt; granum: Pt; thylakoid: Pt } = {
	cell: [palisadeCell().box.x, palisadeCell().box.y],
	chloroplast: [target.x, target.y],
	granum: [target.x + g0.u, target.y + g0.v],
	// the right-hand margin of the granum, at the middle of the stack
	thylakoid: [target.x + g0.u + g0.w / 2 - 0.02, target.y + g0.v + (g0h / g0.n) * 0.5 - 0.0]
};
