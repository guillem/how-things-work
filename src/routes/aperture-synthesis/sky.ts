/**
 * The model skies (generated, not observed) and the arrays the page starts from.
 *
 * Skies are drawn on the page's N × N grid of 15″ pixels, in Jy per pixel, with east (+l) to the
 * left on screen and north (+m) up, as astronomers draw the sky. Positions below are in
 * arcminutes from the pointing centre.
 */
import { ARCMIN, N, PIX, pixel, visibilities, type Dish, type Visibilities } from './model';
import { VLA_D } from './vla';

export type SkyKind = 'points' | 'double' | 'galaxy' | 'disc';

export const SKY_NAMES: Record<SkyKind, string> = {
	points: 'five point sources',
	double: 'a close double',
	galaxy: 'a radio galaxy',
	disc: 'a disc and a point'
};

interface Gauss {
	x: number;
	y: number;
	/** FWHM along and across the position angle, arcmin; 0 for a point. */
	major: number;
	minor: number;
	/** Position angle, degrees from north through east. */
	pa: number;
	flux: number;
}
interface Disc {
	x: number;
	y: number;
	radius: number;
	flux: number;
}

const point = (x: number, y: number, flux: number): Gauss => ({
	x,
	y,
	major: 0,
	minor: 0,
	pa: 0,
	flux
});

/** A radio galaxy: a core, two jets of knots, two lobes with hot spots at their ends. */
function galaxy(): Gauss[] {
	const out: Gauss[] = [point(0, 0, 0.4)];
	const pa = 62; // degrees east of north
	const ux = Math.sin((pa * Math.PI) / 180);
	const uy = Math.cos((pa * Math.PI) / 180);
	for (const s of [1, -1]) {
		for (let k = 1; k <= 5; k++) {
			const d = 0.7 * k;
			out.push({ x: s * d * ux, y: s * d * uy, major: 0.5, minor: 0.35, pa, flux: 0.06 });
		}
		out.push({ x: s * 4.6 * ux, y: s * 4.6 * uy, major: 2.2, minor: 1.4, pa, flux: 2.2 });
		out.push(point(s * 5.4 * ux, s * 5.4 * uy, 0.5));
	}
	return out;
}

const SKIES: Record<SkyKind, { gauss: Gauss[]; discs: Disc[] }> = {
	points: {
		gauss: [
			point(0, 0, 1),
			point(5, 3, 0.6),
			point(-6, -2.5, 0.5),
			point(-2, 6.5, 0.3),
			point(3.5, -7, 0.4)
		],
		discs: []
	},
	double: { gauss: [point(0.75, 0, 1), point(-0.75, 0, 1)], discs: [] },
	galaxy: { gauss: galaxy(), discs: [] },
	disc: { gauss: [point(6, -5, 1)], discs: [{ x: -1, y: 1, radius: 3, flux: 3 }] }
};

/** Separation of the close double, rad. */
export const DOUBLE_SEPARATION = 1.5 * ARCMIN;
/** The disc's diameter, rad, and its flux, Jy. */
export const DISC_DIAMETER = 6 * ARCMIN;
export const DISC_FLUX = 3;
export const DISC_CENTRE = { x: -1, y: 1 };

const cache = new Map<SkyKind, Float64Array>();

/** The sky as an image, Jy per pixel. */
export function sky(kind: SkyKind): Float64Array {
	const hit = cache.get(kind);
	if (hit) return hit;
	const img = new Float64Array(N * N);
	const pixArcmin = PIX / ARCMIN;
	const { gauss, discs } = SKIES[kind];
	for (const g of gauss) {
		const cx = g.x / pixArcmin;
		const cy = g.y / pixArcmin;
		if (g.major === 0) {
			img[pixel(Math.round(cx), Math.round(cy))] += g.flux;
			continue;
		}
		const sa = g.major / pixArcmin / (2 * Math.sqrt(2 * Math.LN2));
		const sb = g.minor / pixArcmin / (2 * Math.sqrt(2 * Math.LN2));
		const th = (g.pa * Math.PI) / 180;
		const ax = Math.sin(th);
		const ay = Math.cos(th);
		const part = new Float64Array(N * N);
		let sum = 0;
		for (let y = -N / 2; y < N / 2; y++) {
			for (let x = -N / 2; x < N / 2; x++) {
				const dx = x - cx;
				const dy = y - cy;
				const along = dx * ax + dy * ay;
				const across = -dx * ay + dy * ax;
				const v = Math.exp(-0.5 * ((along / sa) ** 2 + (across / sb) ** 2));
				part[pixel(x, y)] = v;
				sum += v;
			}
		}
		for (let i = 0; i < img.length; i++) img[i] += (g.flux * part[i]) / sum;
	}
	for (const d of discs) {
		// uniform brightness, each pixel weighted by the share of it inside the disc (4 × 4 subsamples)
		const cx = d.x / pixArcmin;
		const cy = d.y / pixArcmin;
		const r = d.radius / pixArcmin;
		const part = new Float64Array(N * N);
		let sum = 0;
		for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
			for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
				let inside = 0;
				for (let j = 0; j < 4; j++)
					for (let i = 0; i < 4; i++)
						if (Math.hypot(x - 0.375 + 0.25 * i - cx, y - 0.375 + 0.25 * j - cy) <= r) inside++;
				if (inside) {
					part[pixel(x, y)] = inside / 16;
					sum += inside / 16;
				}
			}
		}
		for (let i = 0; i < img.length; i++) img[i] += (d.flux * part[i]) / sum;
	}
	cache.set(kind, img);
	return img;
}

const vCache = new Map<SkyKind, Visibilities>();

/** The sky's visibilities on the uv grid (computed once). */
export function skyVisibilities(kind: SkyKind): Visibilities {
	let v = vCache.get(kind);
	if (!v) {
		v = visibilities(sky(kind));
		vCache.set(kind, v);
	}
	return v;
}

// ======================================================================================
// Arrays
// ======================================================================================

export type Layout = 'vla12' | 'vla27' | 'line' | 'random';

export const LAYOUT_NAMES: Record<Layout, string> = {
	vla12: '12 dishes on the VLA’s Y',
	vla27: 'the VLA, D configuration (27)',
	line: '8 in an east–west line',
	random: '12 scattered at random'
};

const pad = (name: string): Dish => {
	const p = VLA_D.find((q) => q.name === name);
	if (!p) throw new Error(name);
	return { e: p.e, n: p.n };
};

/** A small seeded generator (mulberry32), so "random" is the same every time. */
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Radius of the map dishes can be placed on, m. */
export const MAP_RADIUS = 650;
/** Closest two dishes may stand, centre to centre, m (25 m dishes, a little room to turn). */
export const MIN_SPACING = 30;

function scattered(): Dish[] {
	const r = rng(7);
	const out: Dish[] = [];
	while (out.length < 12) {
		const e = (r() * 2 - 1) * 520;
		const n = (r() * 2 - 1) * 520;
		if (Math.hypot(e, n) > 520) continue;
		if (out.some((d) => Math.hypot(d.e - e, d.n - n) < 120)) continue;
		out.push({ e: Math.round(e), n: Math.round(n) });
	}
	return out;
}

export function layout(name: Layout): Dish[] {
	switch (name) {
		case 'vla27':
			return VLA_D.map((p) => ({ e: p.e, n: p.n }));
		case 'line':
			return Array.from({ length: 8 }, (_, i) => ({ e: -504 + 144 * i, n: 0 }));
		case 'random':
			return scattered();
		default:
			return ['W', 'E', 'N'].flatMap((arm) => ['03', '05', '07', '09'].map((k) => pad(arm + k)));
	}
}

/** The pair of the two-dish steps: 700 m east–west. */
export const PAIR: Dish[] = [
	{ e: -350, n: 0 },
	{ e: 350, n: 0 }
];

/** Dishes as a parameter string, "e,n;e,n" in whole metres. */
export function serialize(ds: readonly Dish[]): string {
	return ds.map((d) => `${Math.round(d.e)},${Math.round(d.n)}`).join(';');
}

export function parse(s: unknown, fallback: readonly Dish[]): Dish[] {
	if (typeof s !== 'string' || s === '') return fallback.slice();
	const out: Dish[] = [];
	for (const part of s.split(';')) {
		const [e, n] = part.split(',').map(Number);
		if (Number.isFinite(e) && Number.isFinite(n)) out.push({ e, n });
	}
	return out.length ? out : fallback.slice();
}

/** The same array, every dish's distance from the centre multiplied by `f`. */
export function scaled(ds: readonly Dish[], f: number): Dish[] {
	return ds.map((d) => ({ e: d.e * f, n: d.n * f }));
}

/** Shortest and longest distance between two dishes, m. */
export function spacings(ds: readonly Dish[]): { min: number; max: number } {
	let min = Infinity;
	let max = 0;
	for (let a = 0; a < ds.length; a++)
		for (let b = a + 1; b < ds.length; b++) {
			const d = Math.hypot(ds[a].e - ds[b].e, ds[a].n - ds[b].n);
			min = Math.min(min, d);
			max = Math.max(max, d);
		}
	return { min: ds.length > 1 ? min : 0, max };
}
