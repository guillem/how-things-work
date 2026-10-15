import { rng as seeded } from '#lib/draw/math.ts';

/** The shared seeded generator (mulberry32) with range, int and pick helpers. */
export function rng(seed: number) {
	const next = seeded(seed);
	return {
		next,
		range: (lo: number, hi: number) => lo + (hi - lo) * next(),
		int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
		pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)]
	};
}

export type Rng = ReturnType<typeof rng>;

/** An occupancy grid for placing shapes without overlap. */
export class Grid {
	readonly cells: Uint8Array;
	readonly nx: number;
	readonly ny: number;
	constructor(
		readonly x0: number,
		readonly y0: number,
		readonly x1: number,
		readonly y1: number,
		readonly h: number
	) {
		this.nx = Math.ceil((x1 - x0) / h);
		this.ny = Math.ceil((y1 - y0) / h);
		this.cells = new Uint8Array(this.nx * this.ny);
	}
	private index(x: number, y: number) {
		const i = Math.floor((x - this.x0) / this.h);
		const j = Math.floor((y - this.y0) / this.h);
		if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return -1;
		return j * this.nx + i;
	}
	/** Is the point free (inside the grid and not taken)? */
	free(x: number, y: number) {
		const k = this.index(x, y);
		return k >= 0 && this.cells[k] === 0;
	}
	/** Are all grid points within `r` of (x, y) free? */
	freeDisc(x: number, y: number, r: number) {
		const h = this.h;
		for (let yy = y - r; yy <= y + r + 1e-9; yy += h)
			for (let xx = x - r; xx <= x + r + 1e-9; xx += h)
				if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r && !this.free(xx, yy)) return false;
		return true;
	}
	/** Marks every cell for which `inside(x, y)` holds within the box. */
	mark(
		bx0: number,
		by0: number,
		bx1: number,
		by1: number,
		inside: (x: number, y: number) => boolean
	) {
		const h = this.h;
		for (let y = by0; y <= by1; y += h)
			for (let x = bx0; x <= bx1; x += h) {
				const k = this.index(x, y);
				if (k >= 0 && inside(x, y)) this.cells[k] = 1;
			}
	}
	markDisc(x: number, y: number, r: number) {
		this.mark(x - r, y - r, x + r, y + r, (px, py) => (px - x) ** 2 + (py - y) ** 2 <= r * r);
	}
}
