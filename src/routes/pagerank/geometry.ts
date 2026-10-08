/**
 * Drawing geometry shared by the PageRank scenes: how big a page is drawn and
 * where the arrow for a link runs.
 */
import type { Point } from '#lib/draw/math.ts';
import { hasLink, type Web } from './pagerank';

/** Radius of a page's circle for a rank (area roughly proportional to rank), in scene units. */
export const pageRadius = (rank: number, n: number) =>
	Math.max(16, Math.min(58, 30 * Math.sqrt(rank * Math.max(1, n))));

export interface LinkGeometry {
	/** SVG path from the edge of the source page to the tip of the arrowhead. */
	d: string;
	/** Arrowhead polygon points (`x,y x,y x,y`). */
	head: string;
	/** Point halfway along the link, and the direction there (radians). */
	mid: Point & { angle: number };
	/** Position along the link for u in [0, 1] (for things travelling along it). */
	at: (u: number) => Point;
}

/**
 * A link a → b between page circles of radius ra and rb. When b also links
 * to a, both links bow out to opposite sides so the two arrows do not overlap.
 */
export function linkGeometry(
	web: Web,
	a: number,
	b: number,
	ra: number,
	rb: number,
	/**
	 * Optional radius of every page: a one-way link that would run through
	 * another page bows around it instead (for webs the reader edits).
	 */
	radii?: readonly number[]
): LinkGeometry {
	const A = web.pages[a];
	const B = web.pages[b];
	const dx = B.x - A.x;
	const dy = B.y - A.y;
	const len = Math.hypot(dx, dy) || 1;
	const ux = dx / len;
	const uy = dy / len;
	// Left-hand normal; a pair of opposite links bow to their own left.
	const nx = uy;
	const ny = -ux;
	let bow = hasLink(web, b, a) ? Math.min(34, len * 0.18) : 0;
	if (radii && bow === 0) {
		// The curve's offset at fraction s is 2s(1 − s)·bow: bow away from the
		// page in the way by just enough to clear it.
		for (let p = 0; p < web.pages.length; p++) {
			if (p === a || p === b) continue;
			const P = web.pages[p];
			const s = ((P.x - A.x) * ux + (P.y - A.y) * uy) / len;
			if (s <= 0.08 || s >= 0.92) continue;
			const off = (P.x - A.x) * nx + (P.y - A.y) * ny;
			const clear = (radii[p] ?? 16) + 12;
			if (Math.abs(off) >= clear) continue;
			const need = (clear - Math.abs(off)) / (2 * s * (1 - s));
			const h = Math.min(len * 0.5, need) * (off > 0 ? -1 : 1);
			if (Math.abs(h) > Math.abs(bow)) bow = h;
		}
	}
	const cx = (A.x + B.x) / 2 + nx * bow;
	const cy = (A.y + B.y) / 2 + ny * bow;
	// Start and end on the circles, aimed at the control point.
	const toward = (P: Point, r: number) => {
		const ex = cx - P.x;
		const ey = cy - P.y;
		const el = Math.hypot(ex, ey) || 1;
		return { x: P.x + (ex / el) * r, y: P.y + (ey / el) * r, ux: ex / el, uy: ey / el };
	};
	const s = toward(A, ra + 3);
	const eRaw = toward(B, rb + 3);
	const head = 11;
	// Arrow tip on the circle; the path stops at the base of the head.
	const tip = { x: eRaw.x, y: eRaw.y };
	const base = { x: tip.x + eRaw.ux * head, y: tip.y + eRaw.uy * head };
	const w = 5.5;
	const hx = -eRaw.uy;
	const hy = eRaw.ux;
	const quad = (u: number) => ({
		x: (1 - u) ** 2 * s.x + 2 * (1 - u) * u * cx + u * u * base.x,
		y: (1 - u) ** 2 * s.y + 2 * (1 - u) * u * cy + u * u * base.y
	});
	const m = quad(0.5);
	const m2 = quad(0.52);
	return {
		d: `M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${base.x.toFixed(1)} ${base.y.toFixed(1)}`,
		head: `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${(base.x + hx * w).toFixed(1)},${(base.y + hy * w).toFixed(1)} ${(base.x - hx * w).toFixed(1)},${(base.y - hy * w).toFixed(1)}`,
		mid: { ...m, angle: Math.atan2(m2.y - m.y, m2.x - m.x) },
		at: (u: number) => (u >= 1 ? tip : quad(u))
	};
}
