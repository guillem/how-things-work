/** Helpers for drawing HP chains: bond angles from turns, and screen points from angles. */
import { centred, fromTurns } from '../hp';

/** Direction of each bond (radians, anticlockwise from +x) of a chain given by its turns. */
export function anglesOf(turns: string): number[] {
	const out = [0];
	for (const c of turns)
		out.push(out[out.length - 1] + (c === 'L' ? Math.PI / 2 : c === 'R' ? -Math.PI / 2 : 0));
	return out;
}

/**
 * Screen points of a chain from its bond angles: unit bonds of `cell` px, y up, translated
 * so that the grid point `origin` (in cells, from the chain's first bead) is at (cx, cy).
 */
export function pointsOf(
	angles: readonly number[],
	cell: number,
	cx: number,
	cy: number,
	origin: { x: number; y: number }
) {
	let x = 0;
	let y = 0;
	const pts = [{ x: cx - origin.x * cell, y: cy + origin.y * cell }];
	for (const a of angles) {
		x += Math.cos(a);
		y += Math.sin(a);
		pts.push({ x: cx + (x - origin.x) * cell, y: cy - (y - origin.y) * cell });
	}
	return pts;
}

/** Centre of a chain's bounding box, in cells from its first bead. */
export function middleOf(turns: string) {
	const fold = fromTurns(turns);
	const c = centred(fold)[0];
	return { x: -c.x, y: -c.y };
}

export const straight = (n: number) => 'S'.repeat(n - 2);
