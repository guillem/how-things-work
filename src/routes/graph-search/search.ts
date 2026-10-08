/**
 * Graph search on a grid of cells and on a road map: breadth-first search,
 * Dijkstra's algorithm and A*, recorded step by step so a scene can replay
 * them.
 *
 * Grid: cells are plain ground (cost 1 to enter), slow terrain such as mud
 * (cost MUD to enter) or walls (impassable); moves go up, down, left or right.
 * The cost of a path is the sum of the costs of the cells it enters.
 *
 * - Breadth-first search (BFS) ignores costs: it finds the path with the
 *   fewest steps.
 * - Dijkstra's algorithm always expands the cell with the lowest cost so far:
 *   it finds the cheapest path.
 * - A* expands the cell with the lowest cost so far + an estimate of the cost
 *   still to go. With the Manhattan distance × the cheapest cell cost (1) as
 *   the estimate, it never overestimates, and A* finds the cheapest path too —
 *   usually after visiting far fewer cells. `weight` > 1 multiplies the
 *   estimate (weighted A*): it can then overestimate, search less, and miss the
 *   cheapest path.
 *
 * Ties are broken deterministically (by insertion order, then by the most
 * recently found), so every replay is identical.
 */

export const MUD = 5;

export type Cell = 0 | 1 | 2; // 0 ground, 1 mud, 2 wall

export interface Grid {
	cols: number;
	rows: number;
	cells: Cell[]; // row-major
	start: number;
	goal: number;
}

export type Algorithm = 'bfs' | 'dijkstra' | 'astar';

export interface SearchStep {
	/** The cell expanded at this step (taken off the frontier). */
	current: number;
	/** Cells added to the frontier at this step (newly discovered or improved). */
	added: number[];
}

export interface SearchResult {
	algorithm: Algorithm;
	steps: SearchStep[];
	/** Cells expanded, in order (= steps.map(s => s.current)). */
	order: number[];
	/** The path found, start → goal, or [] if none. */
	path: number[];
	/** Total cost of the path found (sum of entered cells' costs), or Infinity. */
	cost: number;
	/** Cost so far of every cell reached (Infinity if never reached). */
	dist: number[];
	/** Number of cells expanded before reaching the goal (inclusive). */
	expanded: number;
}

export const cellCost = (c: Cell) => (c === 1 ? MUD : 1);

export const col = (g: Pick<Grid, 'cols'>, i: number) => i % g.cols;
export const row = (g: Pick<Grid, 'cols'>, i: number) => Math.floor(i / g.cols);

export function neighbours(g: Grid, i: number): number[] {
	const c = col(g, i);
	const r = row(g, i);
	const out: number[] = [];
	if (r > 0) out.push(i - g.cols);
	if (c < g.cols - 1) out.push(i + 1);
	if (r < g.rows - 1) out.push(i + g.cols);
	if (c > 0) out.push(i - 1);
	return out.filter((j) => g.cells[j] !== 2);
}

/** Manhattan distance between two cells (the fewest moves ignoring walls). */
export const manhattan = (g: Grid, a: number, b: number) =>
	Math.abs(col(g, a) - col(g, b)) + Math.abs(row(g, a) - row(g, b));

/** A small binary heap keyed by [priority, tie-break]. */
class Heap {
	private items: { key: number; tie: number; value: number }[] = [];
	get size() {
		return this.items.length;
	}
	push(key: number, tie: number, value: number) {
		const a = this.items;
		a.push({ key, tie, value });
		let i = a.length - 1;
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (this.less(a[i], a[p])) {
				[a[i], a[p]] = [a[p], a[i]];
				i = p;
			} else break;
		}
	}
	pop() {
		const a = this.items;
		const top = a[0];
		const last = a.pop()!;
		if (a.length) {
			a[0] = last;
			let i = 0;
			for (;;) {
				const l = 2 * i + 1;
				const r = l + 1;
				let m = i;
				if (l < a.length && this.less(a[l], a[m])) m = l;
				if (r < a.length && this.less(a[r], a[m])) m = r;
				if (m === i) break;
				[a[i], a[m]] = [a[m], a[i]];
				i = m;
			}
		}
		return top;
	}
	private less(x: { key: number; tie: number }, y: { key: number; tie: number }) {
		return x.key < y.key || (x.key === y.key && x.tie < y.tie);
	}
}

/** Runs one of the three searches on a grid and records every step. */
export function search(g: Grid, algorithm: Algorithm, weight = 1): SearchResult {
	const n = g.cols * g.rows;
	const dist = new Array(n).fill(Infinity);
	const prev = new Array(n).fill(-1);
	const done = new Array(n).fill(false);
	const steps: SearchStep[] = [];
	const order: number[] = [];
	dist[g.start] = 0;
	const h = (i: number) => (algorithm === 'astar' ? weight * manhattan(g, i, g.goal) : 0);
	let counter = 0;
	const finish = (): SearchResult => {
		const path: number[] = [];
		if (dist[g.goal] < Infinity && done[g.goal]) {
			for (let i = g.goal; i !== -1; i = prev[i]) path.unshift(i);
		}
		const cost = path.length
			? path.slice(1).reduce((s, i) => s + cellCost(g.cells[i]), 0)
			: Infinity;
		return { algorithm, steps, order, path, cost, dist, expanded: order.length };
	};

	if (g.cells[g.start] === 2 || g.cells[g.goal] === 2) return finish();

	if (algorithm === 'bfs') {
		const queue = [g.start];
		done[g.start] = true; // "discovered"
		let head = 0;
		while (head < queue.length) {
			const cur = queue[head++];
			const added: number[] = [];
			if (cur === g.goal) {
				steps.push({ current: cur, added });
				order.push(cur);
				break;
			}
			for (const nb of neighbours(g, cur)) {
				if (done[nb]) continue;
				done[nb] = true;
				dist[nb] = dist[cur] + cellCost(g.cells[nb]);
				prev[nb] = cur;
				queue.push(nb);
				added.push(nb);
			}
			steps.push({ current: cur, added });
			order.push(cur);
		}
		return finish(); // here `done` means "discovered": the goal is reached once it is queued
	}

	const heap = new Heap();
	heap.push(h(g.start), counter--, g.start);
	while (heap.size) {
		const { value: cur } = heap.pop();
		if (done[cur]) continue;
		done[cur] = true;
		const added: number[] = [];
		order.push(cur);
		if (cur === g.goal) {
			steps.push({ current: cur, added });
			break;
		}
		for (const nb of neighbours(g, cur)) {
			if (done[nb]) continue;
			const d = dist[cur] + cellCost(g.cells[nb]);
			if (d < dist[nb]) {
				dist[nb] = d;
				prev[nb] = cur;
				// Newer entries first among equal priorities (counter decreases): a depth-first
				// tie-break that keeps A* heading for the goal.
				heap.push(d + h(nb), counter--, nb);
				added.push(nb);
			}
		}
		steps.push({ current: cur, added });
	}
	return finish();
}

/** The frontier (discovered but not yet expanded) after `k` steps of a recorded search. */
export function frontierAt(r: SearchResult, k: number): Set<number> {
	const f = new Set<number>();
	const expanded = new Set<number>();
	const upto = Math.max(0, Math.min(r.steps.length, Math.floor(k)));
	for (let i = 0; i < upto; i++) {
		const s = r.steps[i];
		expanded.add(s.current);
		f.delete(s.current);
		for (const a of s.added) if (!expanded.has(a)) f.add(a);
	}
	return f;
}

// ------------------------------------------------------------ text form (for params)

/** `cols x rows|start|goal|cells` with cells as a string of 0/1/2. */
export const serializeGrid = (g: Grid) =>
	`${g.cols}x${g.rows}|${g.start}|${g.goal}|${g.cells.join('')}`;

export function parseGrid(s: unknown): Grid | null {
	if (typeof s !== 'string') return null;
	const m = /^(\d+)x(\d+)\|(\d+)\|(\d+)\|([012]+)$/.exec(s);
	if (!m) return null;
	const cols = +m[1];
	const rows = +m[2];
	const cells = [...m[5]].map(Number) as Cell[];
	if (cells.length !== cols * rows) return null;
	const start = +m[3];
	const goal = +m[4];
	if (start >= cells.length || goal >= cells.length) return null;
	return { cols, rows, cells, start, goal };
}

// ------------------------------------------------------------ the maps the page starts from

/**
 * A map from ASCII art: `.` ground, `~` mud, `#` wall, `S` start, `G` goal.
 */
export function fromArt(art: string): Grid {
	const lines = art
		.trim()
		.split('\n')
		.map((l) => l.trim());
	const rows = lines.length;
	const cols = lines[0].length;
	const cells: Cell[] = [];
	let start = 0;
	let goal = 0;
	lines.forEach((line, r) =>
		[...line].forEach((ch, c) => {
			const i = r * cols + c;
			if (ch === 'S') start = i;
			if (ch === 'G') goal = i;
			cells.push(ch === '#' ? 2 : ch === '~' ? 1 : 0);
		})
	);
	return { cols, rows, cells, start, goal };
}

/** Open ground with a wall in the way. */
export const OPEN = fromArt(`
	......................
	......................
	......................
	..........#...........
	..........#...........
	...S......#.......G...
	..........#...........
	..........#...........
	......................
	......................
	......................
`);

/**
 * A marsh: the straight route crosses mud; the dry way round is longer in
 * steps but cheaper. BFS goes through the mud; Dijkstra and A* go round.
 */
export const MARSH = fromArt(`
	......................
	......................
	......................
	........~~~~~~........
	........~~~~~~........
	...S....~~~~~~....G...
	........~~~~~~........
	........~~~~~~........
	........~~~~~~........
	........~~~~~~........
	........~~~~~~........
`);

/** A maze-like map with walls and mud, for the comparison. */
export const MIXED = fromArt(`
	......................
	.....#........~~......
	.....#..####..~~......
	.....#.....#..~~..#...
	..S..#.....#......#...
	.....#..~~.#..##..#.G.
	.....#..~~.#......#...
	........~~.#####..#...
	........~~........#...
	..............~~......
	..............~~......
`);

export const PRESETS: Record<string, Grid> = { open: OPEN, marsh: MARSH, mixed: MIXED };

// ------------------------------------------------------------ road map

export interface Town {
	name: string;
	/** Position in km. */
	x: number;
	y: number;
}

export interface Road {
	a: number;
	b: number;
	/** Length in km (at least the straight-line distance). */
	km: number;
}

export interface RoadMap {
	towns: Town[];
	roads: Road[];
}

const straight = (p: Town, q: Town) => Math.hypot(p.x - q.x, p.y - q.y);

/**
 * Dijkstra or A* on a road map; the estimate for A* is the straight-line
 * distance to the goal ("as the crow flies"), which a road can never beat.
 */
export function route(map: RoadMap, from: number, to: number, algorithm: 'dijkstra' | 'astar') {
	const n = map.towns.length;
	const adj: { to: number; km: number }[][] = map.towns.map(() => []);
	for (const r of map.roads) {
		adj[r.a].push({ to: r.b, km: r.km });
		adj[r.b].push({ to: r.a, km: r.km });
	}
	const dist = new Array(n).fill(Infinity);
	const prev = new Array(n).fill(-1);
	const done = new Array(n).fill(false);
	const order: number[] = [];
	const h = (i: number) => (algorithm === 'astar' ? straight(map.towns[i], map.towns[to]) : 0);
	dist[from] = 0;
	const heap = new Heap();
	let counter = 0;
	heap.push(h(from), counter--, from);
	while (heap.size) {
		const { value: cur } = heap.pop();
		if (done[cur]) continue;
		done[cur] = true;
		order.push(cur);
		if (cur === to) break;
		for (const { to: nb, km } of adj[cur]) {
			const d = dist[cur] + km;
			if (d < dist[nb]) {
				dist[nb] = d;
				prev[nb] = cur;
				heap.push(d + h(nb), counter--, nb);
			}
		}
	}
	const path: number[] = [];
	if (done[to]) for (let i = to; i !== -1; i = prev[i]) path.unshift(i);
	return { order, path, km: done[to] ? dist[to] : Infinity, dist };
}

/** A small, made-up region: towns and roads (lengths a little more than straight-line). */
export const REGION: RoadMap = (() => {
	const towns: Town[] = [
		{ name: 'Ashford', x: 20, y: 150 },
		{ name: 'Brookley', x: 70, y: 60 },
		{ name: 'Carwick', x: 90, y: 200 },
		{ name: 'Dunmore', x: 150, y: 120 },
		{ name: 'Elmstead', x: 160, y: 30 },
		{ name: 'Fenwick', x: 200, y: 220 },
		{ name: 'Glenholm', x: 250, y: 90 },
		{ name: 'Harrow End', x: 300, y: 170 },
		{ name: 'Ivybridge', x: 330, y: 50 },
		{ name: 'Juniper', x: 380, y: 130 }
	];
	const links: [number, number, number][] = [
		[0, 1, 1.25],
		[0, 2, 1.2],
		[1, 3, 1.3],
		[1, 4, 1.15],
		[2, 3, 1.25],
		[2, 5, 1.2],
		[3, 6, 1.35],
		[3, 5, 1.3],
		[4, 6, 1.2],
		[5, 7, 1.15],
		[6, 7, 1.25],
		[6, 8, 1.2],
		[7, 9, 1.2],
		[8, 9, 1.25],
		[4, 8, 1.4]
	];
	const roads = links.map(([a, b, f]) => ({
		a,
		b,
		km: Math.round(straight(towns[a], towns[b]) * f)
	}));
	return { towns, roads };
})();
