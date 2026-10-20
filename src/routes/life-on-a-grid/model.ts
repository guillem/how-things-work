/**
 * Conway's Game of Life on a grid that wraps round at the edges (a torus). Every square looks at
 * its eight neighbours and, all at the same moment, follows the rule: a live square with two or
 * three live neighbours stays alive, an empty square with exactly three becomes alive, every other
 * square is empty next time. The birth and survival counts can be changed.
 */

export interface Rule {
	/** Neighbour counts that bring an empty square to life. */
	birth: readonly number[];
	/** Neighbour counts that keep a live square alive. */
	survive: readonly number[];
}

export const CONWAY: Rule = { birth: [3], survive: [2, 3] };

export interface Grid {
	w: number;
	h: number;
	cells: Uint8Array;
}

export const empty = (w: number, h: number): Grid => ({ w, h, cells: new Uint8Array(w * h) });

export const at = (g: Grid, x: number, y: number) =>
	g.cells[((y + g.h) % g.h) * g.w + ((x + g.w) % g.w)];

/** Live neighbours of (x, y), among its eight. */
export function neighbours(g: Grid, x: number, y: number) {
	let n = 0;
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += at(g, x + dx, y + dy);
	return n;
}

/** The next generation: every square decided from the old grid at once. */
export function step(g: Grid, rule: Rule = CONWAY): Grid {
	const next = empty(g.w, g.h);
	for (let y = 0; y < g.h; y++)
		for (let x = 0; x < g.w; x++) {
			const n = neighbours(g, x, y);
			const alive = at(g, x, y) ? rule.survive.includes(n) : rule.birth.includes(n);
			next.cells[y * g.w + x] = alive ? 1 : 0;
		}
	return next;
}

/**
 * The wrong way, for comparison: squares updated one after another in reading order, each seeing
 * the squares before it already changed.
 */
export function stepInPlace(g: Grid, rule: Rule = CONWAY): Grid {
	const next: Grid = { ...g, cells: g.cells.slice() };
	for (let y = 0; y < g.h; y++)
		for (let x = 0; x < g.w; x++) {
			const n = neighbours(next, x, y);
			const alive = at(next, x, y) ? rule.survive.includes(n) : rule.birth.includes(n);
			next.cells[y * g.w + x] = alive ? 1 : 0;
		}
	return next;
}

export const population = (g: Grid) => g.cells.reduce((a, b) => a + b, 0);
export const same = (a: Grid, b: Grid) => a.cells.every((c, i) => c === b.cells[i]);

/** Live squares as "x,y;x,y" (for storing a painted grid in a control-free param). */
export const encode = (g: Grid) => {
	const out: string[] = [];
	for (let y = 0; y < g.h; y++)
		for (let x = 0; x < g.w; x++) if (at(g, x, y)) out.push(`${x},${y}`);
	return out.join(';');
};

export function decode(s: string, w: number, h: number): Grid {
	const g = empty(w, h);
	for (const pair of s.split(';')) {
		const [x, y] = pair.split(',').map(Number);
		if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < w && y >= 0 && y < h)
			g.cells[y * w + x] = 1;
	}
	return g;
}

/** Shapes as offsets from their top-left corner. */
export const SHAPES: Record<string, readonly (readonly [number, number])[]> = {
	block: [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1]
	],
	beehive: [
		[1, 0],
		[2, 0],
		[0, 1],
		[3, 1],
		[1, 2],
		[2, 2]
	],
	blinker: [
		[0, 0],
		[1, 0],
		[2, 0]
	],
	toad: [
		[1, 0],
		[2, 0],
		[3, 0],
		[0, 1],
		[1, 1],
		[2, 1]
	],
	glider: [
		[1, 0],
		[2, 1],
		[0, 2],
		[1, 2],
		[2, 2]
	],
	rpentomino: [
		[1, 0],
		[2, 0],
		[0, 1],
		[1, 1],
		[1, 2]
	]
};

/** A grid with the given shapes placed at their (x, y) corners. */
export function place(w: number, h: number, items: readonly [string, number, number][]): Grid {
	const g = empty(w, h);
	for (const [name, x0, y0] of items)
		for (const [dx, dy] of SHAPES[name]) g.cells[((y0 + dy) % h) * w + ((x0 + dx) % w)] = 1;
	return g;
}
