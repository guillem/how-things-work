/**
 * Geometry of the map of galaxies: an endless lattice with one galaxy per billion light years
 * (comoving, i.e. measured today), slightly jittered. The jitter repeats every 4 × 4 galaxies so
 * that the whole lattice can be drawn as one SVG pattern.
 */
import { hash } from '#lib/draw/index.ts';

/** Pixels per billion light years of proper distance (the map's fixed ruler). */
export const S = 60;
export const TILE = 4;
/** Arrows show where each galaxy would be after this fraction of the Hubble time 1/H. */
export const ARROW_TIME = 0.3;
const JITTER = 0.36;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Comoving position (Gly) of lattice galaxy (i, j). */
export function galaxy(i: number, j: number) {
	const ii = mod(i, TILE);
	const jj = mod(j, TILE);
	return {
		x: i + (hash(ii * 7 + jj * 13 + 1, 3) - 0.5) * JITTER,
		y: j + (hash(ii * 11 + jj * 5 + 2, 9) - 0.5) * JITTER
	};
}

/** The named galaxies a reader can pick, by lattice index. */
export const NAMED: Record<string, { i: number; j: number; name: string }> = {
	mw: { i: 0, j: 0, name: 'Milky Way' },
	a: { i: 3, j: -2, name: 'A' },
	b: { i: -3, j: 2, name: 'B' },
	c: { i: 2, j: 3, name: 'C' }
};

/** Lattice index of a viewpoint parameter: a named galaxy ('a') or a clicked one ('5,-2'). */
export function viewIndex(v: string): { i: number; j: number } {
	const named = NAMED[v];
	if (named) return named;
	const [i, j] = v.split(',').map(Number);
	return Number.isFinite(i) && Number.isFinite(j) ? { i, j } : NAMED.mw;
}

/** The nearest lattice galaxy to comoving point (x, y). */
export function nearest(x: number, y: number) {
	let best = { i: 0, j: 0, d: Infinity };
	for (let i = Math.floor(x) - 1; i <= Math.ceil(x) + 1; i++) {
		for (let j = Math.floor(y) - 1; j <= Math.ceil(y) + 1; j++) {
			const g = galaxy(i, j);
			const d = Math.hypot(g.x - x, g.y - y);
			if (d < best.d) best = { i, j, d };
		}
	}
	return best;
}

/** The film: cosmic time (Gyr) swept back and forth between 3 and 20 Gyr, starting at today. */
const FILM = { from: 3, to: 20, period: 34 };
export function filmTime(t: number, today: number) {
	const span = FILM.to - FILM.from;
	const u0 = (today - FILM.from) / span; // where today sits, going forward
	const p = (t / FILM.period + u0 / 2) % 1;
	const u = p < 0.5 ? p * 2 : 2 - p * 2;
	return { time: FILM.from + span * u, forward: p < 0.5 };
}

/**
 * A sample of the galaxies around a viewpoint (lattice index vi, vj; camera at comoving cam) that
 * fall inside a view of half-size hw × hh px at scale factor a, spaced at least `gap` px apart
 * on screen: their screen offset (px) and proper distance (Gly).
 */
export function sample(
	vi: number,
	vj: number,
	cam: { x: number; y: number },
	a: number,
	hw: number,
	hh: number,
	gap: number
) {
	const px = S * a; // px per comoving Gly
	const k = Math.max(1, Math.ceil(gap / px));
	const ni = Math.ceil(hw / px / k) + 1;
	const nj = Math.ceil(hh / px / k) + 1;
	const out: { key: string; dx: number; dy: number; d: number }[] = [];
	for (let p = -ni; p <= ni; p++) {
		for (let q = -nj; q <= nj; q++) {
			const i = vi + p * k;
			const j = vj + q * k;
			const g = galaxy(i, j);
			const dx = (g.x - cam.x) * px;
			const dy = (g.y - cam.y) * px;
			if (Math.abs(dx) > hw - 4 || Math.abs(dy) > hh - 4) continue;
			out.push({ key: `${i},${j}`, dx, dy, d: Math.hypot(dx, dy) / S });
		}
	}
	return out;
}
