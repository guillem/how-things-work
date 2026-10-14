/**
 * The animal cell of "The cell": a section through a liver cell (hepatocyte),
 * laid out so that every kind of organelle covers the share of the section's
 * area that it fills of a real liver cell's volume.
 *
 * Why area = volume: in a random thin section, the fraction of the area that
 * a component covers equals, on average, the fraction of the volume that it
 * fills (the Delesse principle, the basis of stereology). Our section passes
 * through the middle of the nucleus, so the nucleus is drawn at its full
 * measured diameter, and the organelles of the cytoplasm share the rest in the
 * measured proportions (Alberts et al., Molecular Biology of the Cell, Table
 * 12-1, quoted in Cell Biology by the Numbers):
 *
 *   cytosol 50–60%, mitochondria 20%, rough ER cisternae 10%, smooth ER and
 *   Golgi cisternae 6%, nucleus 6%, peroxisomes 1%, lysosomes 1%, endosomes 1%
 *
 * Sizes: cell volume 6,200 µm³ (a 23 µm sphere; rat, BNID 115150); nucleus
 * 8 µm (BNID 104261); mitochondria ≈ 0.9 µm thick and up to 2 µm long; rough
 * ER sheets 60 nm thick (60–100 nm, BNID 111388) with ribosomes ≈ 27 nm
 * across; smooth ER tubules 60 nm; lysosomes and peroxisomes ≈ 0.5 µm
 * (BNID 106072, 113108); nuclear pores 120 nm at the density of ~2,000 per
 * nucleus (BNID 103695, 111130). The positions are random (seeded) and the
 * shapes simplified: mitochondria are drawn as capsules and every cisterna as
 * an arc around the nucleus.
 *
 * All lengths here are in micrometres, with the cell's centre at (0, 0) and y
 * pointing down.
 */
import { Grid, rng, type Rng } from './random';

export type Pt = [number, number];

export interface Capsule {
	x: number;
	y: number;
	/** Half-length along the long axis, including the round ends, µm. */
	a: number;
	/** Radius (half the width), µm. */
	b: number;
	/** Direction of the long axis, radians (0 = across the page). */
	angle: number;
}

export interface Disc {
	x: number;
	y: number;
	r: number;
}

/** Fractions of the cell volume (Alberts, Table 12-1). */
export const VOLUME_FRACTIONS = {
	mitochondria: 0.2,
	roughER: 0.1,
	smoothERGolgi: 0.06,
	nucleus: 0.06,
	peroxisomes: 0.01,
	lysosomes: 0.01,
	endosomes: 0.01
} as const;

export const SIZES = {
	/** Cell volume, µm³ (BNID 115150). */
	cellVolume: 6200,
	nucleusDiameter: 8,
	nucleolusDiameter: 2,
	rerThickness: 0.06,
	serThickness: 0.06,
	golgiThickness: 0.04,
	/** Gap between neighbouring cisternae of a rough-ER stack (lumen centre to centre). */
	rerSpacing: 0.2,
	ribosome: 0.027,
	/** Ribosome surface density on rough ER, per µm² (BNID 113957: 1,000 ± 300). */
	ribosomeDensity: 1000,
	mitoWidth: 0.9,
	/** Intermembrane space of mitochondria, µm (≈ 20 nm, cryo-ET; Kühlbrandt 2015). */
	ims: 0.02,
	/** Thickness of a crista, µm (30–40 nm, BNID 107021). */
	crista: 0.03,
	membrane: 0.004,
	pore: 0.12,
	/** Pores per µm² of envelope (2,000 over the 200 µm² of an 8 µm nucleus). */
	poreDensity: 10,
	perinuclear: 0.03,
	microtubule: 0.025,
	centriole: { length: 0.5, width: 0.2 }
} as const;

/** The cell outline: an irregular polygon ≈ 26 × 22 µm with a straight top edge. */
const OUTLINE: Pt[] = [
	[-12.6, -5.4],
	[-6.5, -10.6],
	[5.5, -10.6],
	[12.8, -4.2],
	[11.6, 6.6],
	[3.2, 10.9],
	[-7.8, 10.1],
	[-13.1, 3.0]
];

export function polygonArea(p: readonly Pt[]) {
	let s = 0;
	for (let i = 0; i < p.length; i++) {
		const [x0, y0] = p[i];
		const [x1, y1] = p[(i + 1) % p.length];
		s += x0 * y1 - x1 * y0;
	}
	return Math.abs(s) / 2;
}

export function insidePolygon(p: readonly Pt[], x: number, y: number) {
	let inside = false;
	for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
		const [xi, yi] = p[i];
		const [xj, yj] = p[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

/** Distance from a point to the polygon's edges. */
function edgeDistance(p: readonly Pt[], x: number, y: number) {
	let d = Infinity;
	for (let i = 0; i < p.length; i++) {
		const [x0, y0] = p[i];
		const [x1, y1] = p[(i + 1) % p.length];
		const dx = x1 - x0;
		const dy = y1 - y0;
		const u = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
		d = Math.min(d, Math.hypot(x - (x0 + u * dx), y - (y0 + u * dy)));
	}
	return d;
}

export const capsuleArea = (c: Capsule) => Math.PI * c.b * c.b + 4 * c.b * (c.a - c.b);

/** Is (x, y) inside capsule c, grown by `pad`? */
export function inCapsule(c: Capsule, x: number, y: number, pad = 0) {
	const ca = Math.cos(c.angle);
	const sa = Math.sin(c.angle);
	const u = (x - c.x) * ca + (y - c.y) * sa;
	const v = -(x - c.x) * sa + (y - c.y) * ca;
	const h = c.a - c.b;
	const uu = Math.max(-h, Math.min(h, u));
	return (u - uu) ** 2 + v * v <= (c.b + pad) ** 2;
}

const polyLength = (pts: readonly Pt[]) =>
	pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/** A crista: a fold of the inner membrane across a mitochondrion. */
export interface Crista {
	/** Position along the long axis, µm from the centre. */
	s: number;
	/** The side it grows from: −1 or +1 (across the long axis). */
	side: -1 | 1;
	/** How far across it reaches, as a fraction of the inner width (0–1). */
	reach: number;
}

/** The cristae of a mitochondrion (liver mitochondria have relatively few). */
export function cristae(c: Capsule, seed: number): Crista[] {
	const r = rng(seed);
	const out: Crista[] = [];
	const h = c.a - c.b * 0.6;
	const n = Math.max(2, Math.round((2 * h) / 0.22));
	for (let i = 0; i < n; i++) {
		const s = -h + ((i + 0.5) / n) * 2 * h + r.range(-0.03, 0.03);
		out.push({ s, side: r.next() < 0.5 ? -1 : 1, reach: r.range(0.45, 0.8) });
	}
	return out;
}

export interface RibosomeOnER {
	x: number;
	y: number;
	/** Outward normal of the membrane (unit vector), pointing into the cytosol. */
	nx: number;
	ny: number;
}

export interface Hepatocyte {
	outline: Pt[];
	area: number;
	nucleus: Disc;
	nucleolus: Disc;
	/** Angles of the nuclear pores around the envelope. */
	pores: number[];
	heterochromatin: Disc[];
	mitochondria: Capsule[];
	/** Centre lines of rough-ER cisternae; the target stack first. */
	rer: Pt[][];
	golgi: Pt[][];
	ser: Pt[][];
	peroxisomes: Disc[];
	lysosomes: Disc[];
	endosomes: Disc[];
	microtubules: Pt[][];
	centrioles: Capsule[];
	/** Areas covered, µm². */
	areas: Record<keyof typeof VOLUME_FRACTIONS | 'cell' | 'cytoplasm', number>;
	/** Points the zoom heads for. */
	targets: {
		mito: Capsule;
		/** The tip of the crista the zoom dives into. */
		cristaTip: Pt;
		/** A point on the cytosolic face of a rough-ER cisterna (membrane horizontal, cytosol below). */
		erFace: Pt;
		/** A point on the cell membrane (top edge, horizontal; outside above). */
		edge: Pt;
		chromatin: Pt;
	};
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, step = 0.15): Pt[] {
	const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / step));
	return Array.from({ length: n + 1 }, (_, i) => {
		const a = a0 + ((a1 - a0) * i) / n;
		return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
	});
}

/** Tests a polyline of tube half-width `hw` (+ clearance) against the grid. */
function tubeFree(grid: Grid, pts: readonly Pt[], hw: number) {
	return pts.every(([x, y]) => grid.freeDisc(x, y, hw));
}
function markTube(grid: Grid, pts: readonly Pt[], hw: number) {
	for (let i = 0; i < pts.length; i++) {
		grid.markDisc(pts[i][0], pts[i][1], hw);
		if (i) {
			const [x0, y0] = pts[i - 1];
			const [x1, y1] = pts[i];
			const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (grid.h * 0.7));
			for (let k = 1; k < n; k++)
				grid.markDisc(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, hw);
		}
	}
}

let cache: Hepatocyte | null = null;

/** The hepatocyte section (deterministic; computed once). */
export function hepatocyte(): Hepatocyte {
	if (cache) return cache;
	const r = rng(20261014);
	const outline = OUTLINE;
	const area = polygonArea(outline);
	const N: Disc = { x: -1.5, y: 0.4, r: SIZES.nucleusDiameter / 2 };
	const nucleolus: Disc = { x: N.x + 1.3, y: N.y - 1.0, r: SIZES.nucleolusDiameter / 2 };
	const cytoplasm = area - Math.PI * N.r * N.r;
	const want = (k: keyof typeof VOLUME_FRACTIONS) =>
		(VOLUME_FRACTIONS[k] / (1 - VOLUME_FRACTIONS.nucleus)) * cytoplasm;

	const grid = new Grid(-14, -12, 14, 12, 0.05);
	// outside the cell, and a margin under the membrane (the cortex), is taken
	grid.mark(
		-14,
		-12,
		14,
		12,
		(x, y) => !insidePolygon(outline, x, y) || edgeDistance(outline, x, y) < 0.25
	);
	grid.markDisc(N.x, N.y, N.r + 0.15);

	// ---- targets placed first ---------------------------------------------------------
	const mito: Capsule = { x: 6.6, y: -3.4, a: 1.0, b: SIZES.mitoWidth / 2, angle: Math.PI / 2 };
	const mitochondria: Capsule[] = [mito];
	const markCapsule = (c: Capsule, pad: number) =>
		grid.mark(c.x - c.a - pad, c.y - c.a - pad, c.x + c.a + pad, c.y + c.a + pad, (x, y) =>
			inCapsule(c, x, y, pad)
		);
	markCapsule(mito, 0.08);

	// ---- rough ER: stacks of arcs concentric with the nucleus ------------------------------
	const rer: Pt[][] = [];
	let rerLength = 0;
	const half = SIZES.rerThickness / 2 + SIZES.ribosome + 0.01;
	/** A stack of `count` arcs; each keeps its free stretches longer than 0.8 µm. */
	const tryStack = (angle: number, r0: number, count: number, len: number, whole = false) => {
		const placed: Pt[][] = [];
		for (let k = 0; k < count; k++) {
			const rr = r0 + k * SIZES.rerSpacing;
			const span = len / rr;
			const pts = arc(N.x, N.y, rr, angle - span / 2, angle + span / 2);
			if (whole) {
				if (!tubeFree(grid, pts, half)) break;
				markTube(grid, pts, half);
				placed.push(pts);
				continue;
			}
			let run: Pt[] = [];
			const flush = () => {
				if (run.length >= 7) {
					markTube(grid, run, half);
					placed.push(run);
				}
				run = [];
			};
			for (const p of pts) {
				if (grid.freeDisc(p[0], p[1], half)) run.push(p);
				else flush();
			}
			flush();
		}
		return placed;
	};
	const addStacks = (until: number) => {
		for (let tries = 0; tries < 3000 && rerLength < until; tries++) {
			const st = tryStack(
				r.range(0, Math.PI * 2),
				N.r + r.range(0.4, 8.5),
				r.int(3, 6),
				r.range(2.5, 7)
			);
			rer.push(...st);
			for (const c of st) rerLength += polyLength(c);
		}
	};
	// the target stack, directly below the nucleus: there the cisternae run horizontally
	const target = tryStack(Math.PI / 2, N.r + 0.55, 5, 5.5, true);
	rer.push(...target);
	for (const c of target) rerLength += polyLength(c);

	// ---- Golgi: two stacks of curved cisternae near the nucleus ----------------------------
	const golgi: Pt[][] = [];
	let golgiLength = 0;
	for (const [gx, gy, ga] of [
		[N.x - 2.2, N.y - N.r - 1.4, -0.5],
		[N.x + 3.4, N.y - N.r - 0.9, 0.6]
	] as const) {
		for (let k = 0; k < 6; k++) {
			const rr = 1.6 + k * 0.09;
			const len = 1.25 - Math.abs(k - 2.5) * 0.12;
			const pts = arc(
				gx,
				gy + 1.6,
				rr,
				-Math.PI / 2 + ga - len / rr / 2,
				-Math.PI / 2 + ga + len / rr / 2,
				0.08
			);
			if (!tubeFree(grid, pts, SIZES.golgiThickness / 2 + 0.02)) continue;
			markTube(grid, pts, SIZES.golgiThickness / 2 + 0.02);
			golgi.push(pts);
			golgiLength += polyLength(pts);
		}
	}

	addStacks((0.6 * want('roughER')) / SIZES.rerThickness);

	// ---- centrioles and microtubules -------------------------------------------------------
	const cx = N.x + 4.6;
	const cy = N.y - 3.2;
	const centrioles: Capsule[] = [
		{ x: cx, y: cy, a: SIZES.centriole.length / 2, b: SIZES.centriole.width / 2, angle: 0.3 },
		{
			x: cx + 0.35,
			y: cy + 0.3,
			a: SIZES.centriole.length / 2,
			b: SIZES.centriole.width / 2,
			angle: 0.3 + Math.PI / 2
		}
	];
	for (const c of centrioles) markCapsule(c, 0.05);
	const microtubules: Pt[][] = [];
	for (let k = 0; k < 16; k++) {
		let a = (k / 16) * Math.PI * 2 + r.range(-0.1, 0.1);
		let x = cx;
		let y = cy;
		const pts: Pt[] = [[x, y]];
		for (let s = 0; s < 120; s++) {
			a += r.range(-0.06, 0.06);
			x += 0.25 * Math.cos(a);
			y += 0.25 * Math.sin(a);
			if (!insidePolygon(outline, x, y) || edgeDistance(outline, x, y) < 0.3) break;
			if (Math.hypot(x - N.x, y - N.y) < N.r + 0.1) {
				// bend around the nucleus
				a += 0.5;
				continue;
			}
			pts.push([x, y]);
		}
		if (pts.length > 3) microtubules.push(pts);
	}

	// ---- mitochondria --------------------------------------------------------------------
	let mitoArea = capsuleArea(mito);
	for (let tries = 0; tries < 60000 && mitoArea < want('mitochondria'); tries++) {
		const b = r.range(0.28, 0.45);
		const c: Capsule = {
			x: r.range(-13, 13),
			y: r.range(-11, 11),
			a: Math.max(b, r.range(0.45, 1.05)),
			b,
			angle: r.range(0, Math.PI)
		};
		const ok = (() => {
			for (let s = -1; s <= 1; s += 0.25) {
				const u = (c.a - c.b) * s;
				const px = c.x + u * Math.cos(c.angle);
				const py = c.y + u * Math.sin(c.angle);
				if (!grid.freeDisc(px, py, c.b + 0.04)) return false;
			}
			return true;
		})();
		if (!ok) continue;
		markCapsule(c, 0.04);
		mitochondria.push(c);
		mitoArea += capsuleArea(c);
	}

	// ---- the rest of the rough ER ----------------------------------------------------------
	addStacks(want('roughER') / SIZES.rerThickness);

	// ---- round organelles ----------------------------------------------------------------------
	const scatter = (wantArea: number, r0: number, r1: number) => {
		const out: Disc[] = [];
		let a = 0;
		for (let tries = 0; tries < 40000 && a < wantArea; tries++) {
			const d: Disc = { x: r.range(-13, 13), y: r.range(-11, 11), r: r.range(r0, r1) };
			if (!grid.freeDisc(d.x, d.y, d.r + 0.05)) continue;
			grid.markDisc(d.x, d.y, d.r + 0.05);
			out.push(d);
			a += Math.PI * d.r * d.r;
		}
		return { out, a };
	};
	const perox = scatter(want('peroxisomes'), 0.2, 0.3);
	const lyso = scatter(want('lysosomes'), 0.18, 0.32);
	const endo = scatter(want('endosomes'), 0.16, 0.3);

	// ---- smooth ER: a meshwork of tubules in the remaining space -----------------------------
	const ser: Pt[][] = [];
	let serLength = 0;
	const serWant = (want('smoothERGolgi') - golgiLength * SIZES.golgiThickness) / SIZES.serThickness;
	const hw = SIZES.serThickness / 2 + 0.012;
	for (let tries = 0; tries < 80000 && serLength < serWant; tries++) {
		let x = r.range(-13, 13);
		let y = r.range(-11, 11);
		if (!grid.freeDisc(x, y, hw)) continue;
		let a = r.range(0, Math.PI * 2);
		const pts: Pt[] = [[x, y]];
		for (let s = 0; s < 40; s++) {
			a += r.range(-0.7, 0.7);
			const nx = x + 0.1 * Math.cos(a);
			const ny = y + 0.1 * Math.sin(a);
			if (!grid.freeDisc(nx, ny, hw)) break;
			x = nx;
			y = ny;
			pts.push([x, y]);
		}
		if (pts.length < 3) continue;
		markTube(grid, pts, hw);
		ser.push(pts);
		serLength += polyLength(pts);
	}

	// ---- nucleus details -------------------------------------------------------------------------
	const perimeter = 2 * Math.PI * N.r;
	// pores cut by a thin section: density × pore diameter per µm of envelope
	const nPores = Math.round(perimeter * SIZES.poreDensity * SIZES.pore);
	const pores = Array.from(
		{ length: nPores },
		(_, i) => ((i + r.range(-0.3, 0.3)) / nPores) * Math.PI * 2
	);
	const heterochromatin: Disc[] = [];
	for (let i = 0; i < 26; i++) {
		const a = r.range(0, Math.PI * 2);
		const rr = N.r - r.range(0.25, 0.6);
		heterochromatin.push({
			x: N.x + rr * Math.cos(a),
			y: N.y + rr * Math.sin(a),
			r: r.range(0.25, 0.6)
		});
	}
	for (let i = 0; i < 10; i++) {
		const a = r.range(0, Math.PI * 2);
		const rr = r.range(0.5, N.r - 1.2);
		const d = { x: N.x + rr * Math.cos(a), y: N.y + rr * Math.sin(a), r: r.range(0.2, 0.45) };
		if (Math.hypot(d.x - nucleolus.x, d.y - nucleolus.y) > nucleolus.r + d.r + 0.1)
			heterochromatin.push(d);
	}

	// ---- targets ------------------------------------------------------------------------------------
	const cr = cristae(mito, 7);
	const mid = cr.reduce((best, c) => (Math.abs(c.s) < Math.abs(best.s) ? c : best));
	mid.side = 1;
	mid.reach = 0.62;
	const innerB = mito.b - SIZES.ims - SIZES.membrane;
	// the mitochondrion stands upright (angle π/2): along = y, across = −x… use its own axes
	const along: Pt = [Math.cos(mito.angle), Math.sin(mito.angle)];
	const across: Pt = [-Math.sin(mito.angle), Math.cos(mito.angle)];
	const tipV = mid.side * (innerB - 2 * innerB * mid.reach);
	const cristaTip: Pt = [
		mito.x + along[0] * mid.s + across[0] * tipV,
		mito.y + along[1] * mid.s + across[1] * tipV
	];
	const stack0 = target[2] ?? target[0];
	const lowest = stack0.reduce((b, p) => (p[1] > b[1] ? p : b));
	const erFace: Pt = [N.x, lowest[1] + SIZES.rerThickness / 2];
	cache = {
		outline,
		area,
		nucleus: N,
		nucleolus,
		pores,
		heterochromatin,
		mitochondria,
		rer,
		golgi,
		ser,
		peroxisomes: perox.out,
		lysosomes: lyso.out,
		endosomes: endo.out,
		microtubules,
		centrioles,
		areas: {
			cell: area,
			cytoplasm,
			nucleus: Math.PI * N.r * N.r,
			mitochondria: mitoArea,
			roughER: rerLength * SIZES.rerThickness,
			smoothERGolgi: serLength * SIZES.serThickness + golgiLength * SIZES.golgiThickness,
			peroxisomes: perox.a,
			lysosomes: lyso.a,
			endosomes: endo.a
		},
		targets: {
			mito,
			cristaTip,
			erFace,
			edge: [0, -10.6],
			chromatin: [N.x - 1.6, N.y + 1.4]
		}
	};
	cristaeOfTarget = cr;
	return cache;
}

let cristaeOfTarget: Crista[] = [];
/** The cristae of the target mitochondrion (the zoom's crista among them, adjusted). */
export function targetCristae() {
	hepatocyte();
	return cristaeOfTarget;
}

export type { Rng };
