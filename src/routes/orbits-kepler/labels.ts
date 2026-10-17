/**
 * Where to put a short label (an area such as "0.785 AU²") just outside an
 * orbit, on the line from the Sun through a point of the orbit, without
 * crowding the labels already placed and without leaving the panel.
 */

interface Point {
	x: number;
	y: number;
}

/** Two label centres closer than this (in x and in y at once) crowd each other. */
export const LABEL_GAP = { x: 70, y: 18 };
/** Half the room a label takes, for keeping it inside the panel. */
const HALF = { x: 32, y: 9 };
const OUT = 22; // first distance outside the orbit
const RING = 20; // each further ring out
const RINGS = 4;
const STEP = 0.04; // radians round the Sun
const STEPS = 8; // so at most 0.32 rad (≈ 18°) either side

/**
 * The label's centre for an orbit point at angle `phi` and distance `rho` from
 * `sun`. The first choice is `OUT` beyond the orbit point. If that crowds a
 * placed label, the nearest free spot wins among a few rings further out and
 * small slides round the Sun on either side (nearest to the first choice, so a
 * label stays by its own point). Every spot is pulled inside `bounds`. When all
 * are taken, the first choice is used.
 */
export function placeLabel(
	sun: Point,
	phi: number,
	rho: number,
	placed: readonly Point[],
	bounds: { x0: number; y0: number; x1: number; y1: number }
): Point {
	const at = (off: number, dp: number): Point => ({
		x: Math.min(
			bounds.x1 - HALF.x,
			Math.max(bounds.x0 + HALF.x, sun.x + (rho + off) * Math.cos(phi + dp))
		),
		y: Math.min(
			bounds.y1 - HALF.y,
			Math.max(bounds.y0 + HALF.y, sun.y + (rho + off) * Math.sin(phi + dp))
		)
	});
	const first = at(OUT, 0);
	const spots: { p: Point; cost: number }[] = [];
	for (let ring = 0; ring < RINGS; ring++) {
		for (let j = -STEPS; j <= STEPS; j++) {
			const p = at(OUT + ring * RING, j * STEP);
			spots.push({ p, cost: Math.hypot(p.x - first.x, p.y - first.y) });
		}
	}
	spots.sort((a, b) => a.cost - b.cost);
	const free = (p: Point) =>
		!placed.some((q) => Math.abs(q.x - p.x) < LABEL_GAP.x && Math.abs(q.y - p.y) < LABEL_GAP.y);
	return spots.find((s) => free(s.p))?.p ?? first;
}
