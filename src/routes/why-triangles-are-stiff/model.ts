/**
 * Frames of sticks joined by pins, in a plane. A pin lets the sticks turn freely, so a frame keeps
 * its shape only if its stick lengths leave no way to move. Some joints are pinned to the ground.
 *
 * "How many ways it can wobble" is the number of independent small motions of the free joints
 * that change no stick's length: twice the free joints minus the rank of the rigidity matrix
 * (one row per stick, saying how fast its length changes). A frame is stiff when that is zero.
 * A push is followed for real by moving the pushed joint a little at a time and putting every
 * stick back to its length after each move.
 */

export interface Frame {
	/** Joint positions (any units; y up). */
	pts: { x: number; y: number }[];
	/** Sticks, as pairs of joint indices. */
	sticks: [number, number][];
	/** Joints pinned to the ground (they never move). */
	pinned: number[];
}

/** The number of independent ways the free joints can move without changing any stick's length. */
export function wobbles(f: Frame): number {
	const free = f.pts.map((_, i) => i).filter((i) => !f.pinned.includes(i));
	const col = new Map(free.map((j, k) => [j, k]));
	const n = free.length * 2;
	// Rigidity matrix rows: for stick (i, j), (pi - pj) against vi and (pj - pi) against vj.
	const rows = f.sticks.map(([i, j]) => {
		const r = new Array<number>(n).fill(0);
		const dx = f.pts[i].x - f.pts[j].x;
		const dy = f.pts[i].y - f.pts[j].y;
		const ci = col.get(i);
		const cj = col.get(j);
		if (ci !== undefined) {
			r[2 * ci] = dx;
			r[2 * ci + 1] = dy;
		}
		if (cj !== undefined) {
			r[2 * cj] = -dx;
			r[2 * cj + 1] = -dy;
		}
		return r;
	});
	return n - rank(rows);
}

/** Rank of a matrix by Gaussian elimination with partial pivoting. */
export function rank(m: number[][]): number {
	const a = m.map((r) => [...r]);
	const cols = a[0]?.length ?? 0;
	let r = 0;
	for (let c = 0; c < cols && r < a.length; c++) {
		let best = r;
		for (let i = r + 1; i < a.length; i++) if (Math.abs(a[i][c]) > Math.abs(a[best][c])) best = i;
		if (Math.abs(a[best][c]) < 1e-9) continue;
		[a[r], a[best]] = [a[best], a[r]];
		for (let i = 0; i < a.length; i++) {
			if (i === r) continue;
			const k = a[i][c] / a[r][c];
			for (let j = c; j < cols; j++) a[i][j] -= k * a[r][j];
		}
		r++;
	}
	return r;
}

export const length = (f: Frame, [i, j]: [number, number]) =>
	Math.hypot(f.pts[i].x - f.pts[j].x, f.pts[i].y - f.pts[j].y);

/**
 * Pushes joint `joint` sideways (or down) by up to `distance`, a little at a time, putting every stick back
 * to its length after each little move (and leaving the pinned joints where they are). The pushed
 * joint only goes where the sticks let it: a stiff frame hardly moves.
 */
export function push(
	f: Frame,
	joint: number,
	distance: number,
	{ steps = 200, down = false } = {}
): Frame {
	const pts = f.pts.map((p) => ({ ...p }));
	const rest = f.sticks.map((s) => length(f, s));
	const fixed = (i: number) => f.pinned.includes(i);
	for (let k = 0; k < steps; k++) {
		if (down) pts[joint].y -= distance / steps;
		else pts[joint].x += distance / steps;
		// Put the sticks back to their lengths (repeated projection, the pushed joint included).
		for (let it = 0; it < 60; it++) {
			f.sticks.forEach(([i, j], s) => {
				const dx = pts[j].x - pts[i].x;
				const dy = pts[j].y - pts[i].y;
				const d = Math.hypot(dx, dy) || 1e-12;
				const err = (d - rest[s]) / d;
				// The pushed joint gives way less than the others (the hand keeps pushing it).
				const wi = fixed(i) ? 0 : i === joint ? 0.25 : 1;
				const wj = fixed(j) ? 0 : j === joint ? 0.25 : 1;
				if (wi + wj === 0) return;
				const ki = (wi / (wi + wj)) * err;
				const kj = (wj / (wi + wj)) * err;
				pts[i].x += dx * ki;
				pts[i].y += dy * ki;
				pts[j].x -= dx * kj;
				pts[j].y -= dy * kj;
			});
		}
	}
	return { ...f, pts };
}

/** The largest change in any stick's length between two frames with the same sticks. */
export const stretch = (a: Frame, b: Frame) =>
	Math.max(...a.sticks.map((s) => Math.abs(length(a, s) - length(b, s))));

/** How far a joint moved. */
export const moved = (a: Frame, b: Frame, i: number) =>
	Math.hypot(a.pts[i].x - b.pts[i].x, a.pts[i].y - b.pts[i].y);

// ---- the frames on the page ---------------------------------------------------------------------

/** A square standing on its two bottom corners (joints: 0 bottom-left, 1 bottom-right, 2 top-right, 3 top-left). */
export const square = (diagonal = false): Frame => ({
	pts: [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
		{ x: 0, y: 1 }
	],
	sticks: [[0, 1], [1, 2], [2, 3], [3, 0], ...(diagonal ? ([[0, 2]] as [number, number][]) : [])],
	pinned: [0, 1]
});

/** A triangle standing on its base. */
export const triangle = (): Frame => ({
	pts: [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 0.5, y: 0.87 }
	],
	sticks: [
		[0, 1],
		[1, 2],
		[2, 0]
	],
	pinned: [0, 1]
});

/**
 * A tower of `storeys` square panels, two joints wide, standing on its bottom two; `braced[k]`
 * adds a diagonal to panel k (joints 2k, 2k + 1 at the bottom of the panel, left and right).
 */
export function tower(storeys: number, braced: readonly boolean[] = []): Frame {
	const pts = Array.from({ length: 2 * (storeys + 1) }, (_, i) => ({
		x: i % 2,
		y: Math.floor(i / 2)
	}));
	const sticks: [number, number][] = [];
	for (let k = 0; k <= storeys; k++) {
		if (k > 0) sticks.push([2 * k, 2 * k + 1]);
		if (k < storeys) {
			sticks.push([2 * k, 2 * k + 2], [2 * k + 1, 2 * k + 3]);
			if (braced[k]) sticks.push([2 * k, 2 * k + 3]);
		}
	}
	return { pts, sticks, pinned: [0, 1] };
}

/** A garden gate: a frame twice as wide as tall, hung on its two left-hand joints (the hinges). */
export const gate = (brace = false): Frame => ({
	pts: [
		{ x: 0, y: 0 },
		{ x: 2, y: 0 },
		{ x: 2, y: 1 },
		{ x: 0, y: 1 }
	],
	sticks: [[0, 1], [1, 2], [2, 3], [3, 0], ...(brace ? ([[0, 2]] as [number, number][]) : [])],
	pinned: [0, 3]
});
