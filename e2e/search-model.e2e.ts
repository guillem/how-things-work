// Checks the searches behind the graph-search explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	MARSH,
	MIXED,
	OPEN,
	PRESETS,
	REGION,
	fromArt,
	frontierAt,
	parseGrid,
	route,
	search,
	serializeGrid,
	type Grid
} from '../src/routes/graph-search/search';

/** Cheapest cost by brute force (Bellman–Ford style relaxation), to check the searches against. */
function cheapest(g: Grid) {
	const n = g.cols * g.rows;
	const d = new Array(n).fill(Infinity);
	d[g.start] = 0;
	for (let it = 0; it < n; it++) {
		let changed = false;
		for (let i = 0; i < n; i++) {
			if (d[i] === Infinity || g.cells[i] === 2) continue;
			const c = i % g.cols;
			const r = Math.floor(i / g.cols);
			const nbs = [
				r > 0 && i - g.cols,
				c < g.cols - 1 && i + 1,
				r < g.rows - 1 && i + g.cols,
				c > 0 && i - 1
			];
			for (const j of nbs) {
				if (j === false || g.cells[j] === 2) continue;
				const v = d[i] + (g.cells[j] === 1 ? 5 : 1);
				if (v < d[j]) {
					d[j] = v;
					changed = true;
				}
			}
		}
		if (!changed) break;
	}
	return d[g.goal];
}

test('Dijkstra and A* find the cheapest path; BFS the fewest steps', () => {
	for (const g of Object.values(PRESETS)) {
		const best = cheapest(g);
		expect(search(g, 'dijkstra').cost).toBe(best);
		expect(search(g, 'astar').cost).toBe(best);
		const bfs = search(g, 'bfs');
		expect(bfs.path.length).toBeLessThanOrEqual(search(g, 'dijkstra').path.length);
		expect(bfs.cost).toBeGreaterThanOrEqual(best);
	}
});

test('the marsh: BFS wades through the mud, the others go round', () => {
	const bfs = search(MARSH, 'bfs');
	const dij = search(MARSH, 'dijkstra');
	expect(bfs.path.length - 1).toBe(15);
	expect(bfs.cost).toBe(39);
	expect(dij.path.length - 1).toBe(21);
	expect(dij.cost).toBe(21);
});

test('A* visits far fewer cells than Dijkstra', () => {
	for (const g of [OPEN, MARSH]) {
		expect(search(g, 'astar').expanded * 3).toBeLessThan(search(g, 'dijkstra').expanded);
	}
	expect(search(MIXED, 'astar').expanded).toBeLessThan(search(MIXED, 'dijkstra').expanded);
});

test('an estimate that overestimates can miss the cheapest path', () => {
	const greedy = search(MARSH, 'astar', 5);
	expect(greedy.cost).toBeGreaterThan(search(MARSH, 'dijkstra').cost);
	expect(greedy.expanded).toBeLessThan(search(MARSH, 'astar').expanded);
});

test('paths are connected, avoid walls and start and end in the right places', () => {
	for (const g of Object.values(PRESETS))
		for (const a of ['bfs', 'dijkstra', 'astar'] as const) {
			const p = search(g, a).path;
			expect(p[0]).toBe(g.start);
			expect(p.at(-1)).toBe(g.goal);
			for (let i = 1; i < p.length; i++) {
				const d = Math.abs(p[i] - p[i - 1]);
				expect(d === 1 || d === g.cols).toBe(true);
				expect(g.cells[p[i]]).not.toBe(2);
			}
		}
});

test('no way through: no path, and the search stops', () => {
	const g = fromArt(`
		S.#...
		..#...
		..#..G
	`);
	for (const a of ['bfs', 'dijkstra', 'astar'] as const) {
		const r = search(g, a);
		expect(r.path).toEqual([]);
		expect(r.cost).toBe(Infinity);
		expect(r.expanded).toBe(6);
	}
});

test('the frontier grows from the start and the replay ends at the goal', () => {
	const r = search(OPEN, 'bfs');
	expect(frontierAt(r, 0).size).toBe(0);
	expect(frontierAt(r, 1).size).toBe(4);
	expect(r.order.at(-1)).toBe(OPEN.goal);
});

test('roads: A* with straight-line distances agrees with Dijkstra and looks at fewer towns', () => {
	const d = route(REGION, 0, 9, 'dijkstra');
	const a = route(REGION, 0, 9, 'astar');
	expect(a.km).toBe(d.km);
	expect(a.path).toEqual(d.path);
	expect(a.order.length).toBeLessThan(d.order.length);
	// Every road is at least as long as the straight line, so the estimate never overestimates.
	for (const r of REGION.roads) {
		const p = REGION.towns[r.a];
		const q = REGION.towns[r.b];
		expect(r.km).toBeGreaterThanOrEqual(Math.hypot(p.x - q.x, p.y - q.y) - 0.5);
	}
});

test('the text form round-trips', () => {
	for (const g of Object.values(PRESETS))
		expect(serializeGrid(parseGrid(serializeGrid(g))!)).toBe(serializeGrid(g));
	expect(parseGrid('nope')).toBeNull();
});
