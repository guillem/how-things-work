/**
 * Layout shared by the finite-field scenes: the p × p grid of F_p × F_p drawn as a square, with
 * (0, 0) at the bottom left, and the toy curve's points and multiples as plain numbers.
 */
import type { Point } from '#lib/draw/index.ts';
import { TOY, TOY_G, multiples, points, type Point as FPoint } from '../ecc';

export const GRID = { x0: 70, y0: 40, size: 500 };

export function gridOf(p: number) {
	const cell = GRID.size / p;
	return {
		p,
		cell,
		/** Screen position of the lattice point (x, y), at the centre of its cell. */
		at: (x: number, y: number): Point => ({
			x: GRID.x0 + (x + 0.5) * cell,
			y: GRID.y0 + GRID.size - (y + 0.5) * cell
		}),
		/** Dot radius that suits the cell size. */
		r: Math.max(2.6, Math.min(7, cell * 0.68))
	};
}

export interface NPoint {
	x: number;
	y: number;
}
export const toN = (P: FPoint): NPoint | null =>
	P === null ? null : { x: Number(P.x), y: Number(P.y) };
export const pointText = (P: NPoint | null) => (P === null ? 'O' : `(${P.x}, ${P.y})`);

/** The toy curve's 78 affine points, sorted by x then y. */
export const TOY_POINTS = points(TOY).map((q) => ({ x: Number(q.x), y: Number(q.y) }));
/** G, 2G, …, 78G on the toy curve. */
export const TOY_MULTIPLES = multiples(TOY, TOY_G).map((q) => toN(q) as NPoint);
/** k·G for 1 ≤ k ≤ 78 (and O for multiples of 79). */
export const kG = (k: number) => {
	const r = ((k % 79) + 79) % 79;
	return r === 0 ? null : TOY_MULTIPLES[r - 1];
};

/** Index (0-based) of the toy point nearest a screen position. */
export function nearestPoint(pts: NPoint[], g: ReturnType<typeof gridOf>, s: Point) {
	let best = 0;
	let bestD = Infinity;
	pts.forEach((q, i) => {
		const c = g.at(q.x, q.y);
		const d = (c.x - s.x) ** 2 + (c.y - s.y) ** 2;
		if (d < bestD) [best, bestD] = [i, d];
	});
	return best;
}
