/**
 * The random-graph model behind the page: Erdős–Rényi graphs G(n, p) and bond percolation on a
 * square grid, with union–find for the connected pieces.
 *
 * Every possible link gets its own random number once, and is present when that number is below
 * the link probability. Raising the probability then only ever adds links, so one seeded graph
 * can be swept from no links to many, exactly as the page's slider does, and every frame of the
 * sweep is an honest G(n, p) (Erdős & Rényi 1960; the "coupled" random graph process). The same
 * trick on the grid's bonds gives bond percolation at every p at once.
 *
 * Exact results used as references: the giant share S solves S = 1 − e^(−cS) for average degree
 * c = p(n − 1) > 1 and is 0 for c ≤ 1; the largest component is of order log n below c = 1 and of
 * order n^(2/3) at c = 1; the bond-percolation threshold of the square lattice is exactly 1/2
 * (Kesten 1980).
 */
import { rng } from '#lib/draw/math.ts';

// ---- union–find ------------------------------------------------------------------------------

/** Disjoint sets with union by size and path halving. */
export class UnionFind {
	readonly parent: Int32Array;
	readonly size: Int32Array;
	/** The size of the largest set so far. */
	largest = 1;
	/** How many sets there are. */
	count: number;

	constructor(n: number) {
		this.parent = new Int32Array(n);
		this.size = new Int32Array(n).fill(1);
		for (let i = 0; i < n; i++) this.parent[i] = i;
		this.count = n;
		if (n === 0) this.largest = 0;
	}

	find(i: number): number {
		const p = this.parent;
		while (p[i] !== i) {
			p[i] = p[p[i]];
			i = p[i];
		}
		return i;
	}

	/** Joins the sets of a and b; returns false when they were already one. */
	union(a: number, b: number): boolean {
		let ra = this.find(a);
		let rb = this.find(b);
		if (ra === rb) return false;
		if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra];
		this.parent[rb] = ra;
		this.size[ra] += this.size[rb];
		if (this.size[ra] > this.largest) this.largest = this.size[ra];
		this.count--;
		return true;
	}
}

// ---- Erdős–Rényi graphs ----------------------------------------------------------------------

/**
 * A seeded G(n, p) for every average degree c = p(n − 1) up to `cMax`: the links whose random
 * number fell below cMax / (n − 1), sorted by the average degree `at` which each appears.
 */
export interface RandomGraph {
	n: number;
	cMax: number;
	a: Int32Array;
	b: Int32Array;
	at: Float64Array;
}

/**
 * Draws the graph. Instead of a coin for each of the n(n − 1)/2 pairs, it jumps from one link to
 * the next with geometric gaps (Batagelj & Brandes 2005), which gives the same distribution in
 * time proportional to n plus the number of links.
 */
export function randomGraph(n: number, cMax: number, seed: number): RandomGraph {
	const rand = rng(seed * 2654435761 + n);
	const pMax = n > 1 ? Math.min(1, cMax / (n - 1)) : 0;
	const a: number[] = [];
	const b: number[] = [];
	const u: number[] = [];
	if (pMax > 0) {
		const logq = Math.log(1 - pMax);
		let v = 1;
		let w = -1;
		while (v < n) {
			const skip = pMax >= 1 ? 0 : Math.floor(Math.log(1 - rand()) / logq);
			w += 1 + skip;
			while (w >= v && v < n) {
				w -= v;
				v++;
			}
			if (v < n) {
				a.push(v);
				b.push(w);
				// given that the pair's number is below pMax, it is uniform on [0, pMax)
				u.push(rand() * pMax * (n - 1));
			}
		}
	}
	const order = u.map((_, i) => i).sort((i, j) => u[i] - u[j]);
	return {
		n,
		cMax,
		a: Int32Array.from(order, (i) => a[i]),
		b: Int32Array.from(order, (i) => b[i]),
		at: Float64Array.from(order, (i) => u[i])
	};
}

/** How many of the graph's links are present at average degree c. */
export function linksAt(g: RandomGraph, c: number): number {
	let lo = 0;
	let hi = g.at.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (g.at[mid] <= c) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/** The connected pieces of the graph at average degree c. */
export function componentsAt(g: RandomGraph, c: number): UnionFind {
	const uf = new UnionFind(g.n);
	const m = linksAt(g, c);
	for (let e = 0; e < m; e++) uf.union(g.a[e], g.b[e]);
	return uf;
}

/** The size of the largest piece at each of the (ascending) average degrees `cs`, in one pass. */
export function largestSweep(g: RandomGraph, cs: readonly number[]): number[] {
	const uf = new UnionFind(g.n);
	const out: number[] = [];
	let e = 0;
	for (const c of cs) {
		while (e < g.at.length && g.at[e] <= c) {
			uf.union(g.a[e], g.b[e]);
			e++;
		}
		out.push(uf.largest);
	}
	return out;
}

/** The size of the largest piece of a fresh G(n, c / (n − 1)). */
export function largestComponent(n: number, c: number, seed: number): number {
	return componentsAt(randomGraph(n, c, seed), c).largest;
}

/**
 * The mean share of the nodes in the largest piece at each average degree `cs`, over `graphs`
 * seeded graphs of n nodes.
 */
export function meanSweep(
	n: number,
	cs: readonly number[],
	graphs: number,
	seed = 1
): { c: number; share: number }[] {
	const sum = cs.map(() => 0);
	const cMax = cs[cs.length - 1];
	for (let k = 0; k < graphs; k++) {
		const s = largestSweep(randomGraph(n, cMax, seed + k * 7907), cs);
		for (let i = 0; i < cs.length; i++) sum[i] += s[i] / n;
	}
	return cs.map((c, i) => ({ c, share: sum[i] / graphs }));
}

/** Each node's number of links at average degree c, counted into a histogram. */
export function degreeHistogram(g: RandomGraph, c: number): number[] {
	const deg = new Int32Array(g.n);
	const m = linksAt(g, c);
	for (let e = 0; e < m; e++) {
		deg[g.a[e]]++;
		deg[g.b[e]]++;
	}
	const hist: number[] = [];
	for (const d of deg) {
		while (hist.length <= d) hist.push(0);
		hist[d]++;
	}
	return hist;
}

/** Poisson probability of k with mean c: the limit of a node's degree for large n. */
export function poisson(k: number, c: number): number {
	let p = Math.exp(-c);
	for (let i = 1; i <= k; i++) p *= c / i;
	return p;
}

// ---- the exact large-n results ---------------------------------------------------------------

/**
 * The share S of the nodes in the giant component of G(n, c/n) as n → ∞: the largest root of
 * S = 1 − e^(−cS), which is 0 for c ≤ 1. Found by bisection (fixed-point iteration crawls near
 * c = 1). It is also the chance that a branching process with Poisson(c) children never dies out.
 */
export function giantShare(c: number): number {
	if (!(c > 1)) return 0;
	const f = (s: number) => 1 - Math.exp(-c * s) - s;
	let lo = 1e-12;
	let hi = 1;
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		if (f(mid) > 0) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/**
 * The standard deviation of the giant's share above c = 1 is σ/√n, with
 * σ² = S(1 − S) / (1 − c(1 − S))² (Pittel 1990): the share follows a bell curve that narrows like
 * 1/√n. Returns σ.
 */
export function giantSigma(c: number): number {
	const s = giantShare(c);
	if (s === 0) return 0;
	return Math.sqrt((s * (1 - s)) / (1 - c * (1 - s)) ** 2);
}

// ---- exploring from one node: the branching process ------------------------------------------

/** One node reached by a breadth-first search, with its parent's index in the previous level. */
export interface Reached {
	node: number;
	parent: number;
}

/**
 * Breadth-first search from `start` in the graph at average degree c, level by level: level k
 * holds the nodes first reached k links away (level 0 is the start itself).
 */
export function bfsLevels(g: RandomGraph, c: number, start: number): Reached[][] {
	const m = linksAt(g, c);
	const head = new Int32Array(g.n).fill(-1);
	const next = new Int32Array(2 * m);
	const to = new Int32Array(2 * m);
	for (let e = 0; e < m; e++) {
		to[2 * e] = g.b[e];
		next[2 * e] = head[g.a[e]];
		head[g.a[e]] = 2 * e;
		to[2 * e + 1] = g.a[e];
		next[2 * e + 1] = head[g.b[e]];
		head[g.b[e]] = 2 * e + 1;
	}
	const seen = new Uint8Array(g.n);
	seen[start] = 1;
	const levels: Reached[][] = [[{ node: start, parent: -1 }]];
	for (;;) {
		const frontier = levels[levels.length - 1];
		const nxt: Reached[] = [];
		frontier.forEach(({ node }, i) => {
			for (let h = head[node]; h >= 0; h = next[h]) {
				const w = to[h];
				if (!seen[w]) {
					seen[w] = 1;
					nxt.push({ node: w, parent: i });
				}
			}
		});
		if (nxt.length === 0) return levels;
		levels.push(nxt);
	}
}

/** The number of nodes in each level of `bfsLevels`. */
export function generations(g: RandomGraph, c: number, start: number): number[] {
	return bfsLevels(g, c, start).map((l) => l.length);
}

// ---- bond percolation on a square grid --------------------------------------------------------

/**
 * An L × L grid of sites; each bond between neighbours is open for bond probability p when its
 * random number `at` is below p. Bonds are sorted by `at`. Sites are numbered y·L + x, row 0 at
 * the top.
 */
export interface Lattice {
	L: number;
	a: Int32Array;
	b: Int32Array;
	at: Float64Array;
}

export function lattice(L: number, seed: number): Lattice {
	const rand = rng(seed * 40503 + L * 97 + 3);
	const a: number[] = [];
	const b: number[] = [];
	for (let y = 0; y < L; y++) {
		for (let x = 0; x < L; x++) {
			const s = y * L + x;
			if (x + 1 < L) {
				a.push(s);
				b.push(s + 1);
			}
			if (y + 1 < L) {
				a.push(s);
				b.push(s + L);
			}
		}
	}
	// each bond's random number (32 bits) with its index below it, so that a fast numeric sort
	// of plain numbers orders the bonds (exact: 2^48 < 2^53)
	const B = a.length;
	const keys = new Float64Array(B);
	for (let i = 0; i < B; i++) keys[i] = Math.floor(rand() * 2 ** 32) * 2 ** 16 + i;
	keys.sort();
	const out: Lattice = {
		L,
		a: new Int32Array(B),
		b: new Int32Array(B),
		at: new Float64Array(B)
	};
	for (let k = 0; k < B; k++) {
		const i = keys[k] % 2 ** 16;
		out.a[k] = a[i];
		out.b[k] = b[i];
		out.at[k] = Math.floor(keys[k] / 2 ** 16) / 2 ** 32;
	}
	return out;
}

/** The grid's clusters at bond probability p, with two extra nodes joined to the top and bottom rows. */
export interface Clusters {
	uf: UnionFind;
	/** How many bonds are open. */
	open: number;
	/** The root of the cluster joining top to bottom, or −1. */
	spanning: number;
	/** The root of the largest cluster of grid sites. */
	largestRoot: number;
	largestSize: number;
}

export function clustersAt(lat: Lattice, p: number): Clusters {
	const { L } = lat;
	const N = L * L;
	const uf = new UnionFind(N);
	let open = 0;
	while (open < lat.at.length && lat.at[open] < p) {
		uf.union(lat.a[open], lat.b[open]);
		open++;
	}
	const top = new Set<number>();
	for (let x = 0; x < L; x++) top.add(uf.find(x));
	let spanning = -1;
	for (let x = 0; x < L && spanning < 0; x++) {
		const r = uf.find((L - 1) * L + x);
		if (top.has(r)) spanning = r;
	}
	let largestRoot = 0;
	for (let i = 0; i < N; i++) {
		if (uf.parent[i] === i && uf.size[i] > uf.size[largestRoot]) largestRoot = i;
	}
	return { uf, open, spanning, largestRoot, largestSize: uf.size[largestRoot] };
}

/** The bond probability at which this grid first joins its top row to its bottom row. */
export function spanThreshold(lat: Lattice): number {
	const { L } = lat;
	const N = L * L;
	const uf = new UnionFind(N + 2);
	for (let x = 0; x < L; x++) {
		uf.union(N, x);
		uf.union(N + 1, (L - 1) * L + x);
	}
	for (let e = 0; e < lat.at.length; e++) {
		uf.union(lat.a[e], lat.b[e]);
		if (uf.find(N) === uf.find(N + 1)) return lat.at[e];
	}
	return 1;
}

/**
 * The chance that an L × L grid has a top-to-bottom crossing at each bond probability in `ps`,
 * estimated from `samples` seeded grids (the share of grids whose crossing threshold is ≤ p).
 */
export function spanningProbability(
	L: number,
	ps: readonly number[],
	samples: number,
	seed = 1
): number[] {
	const th: number[] = [];
	for (let k = 0; k < samples; k++) th.push(spanThreshold(lattice(L, seed + k * 104729)));
	th.sort((x, y) => x - y);
	return ps.map((p) => {
		let n = 0;
		while (n < th.length && th[n] < p) n++;
		return n / samples;
	});
}

/** The dual grid at bond probability p: its clusters, and whether they cross left to right. */
export interface Dual {
	uf: UnionFind;
	/** Dual site of the face right of grid site (x, y) and below it; LEFT and RIGHT are the outsides. */
	face: (fx: number, fy: number) => number;
	LEFT: number;
	RIGHT: number;
	crosses: boolean;
}

/**
 * The dual of the grid: its sites are the faces between grid sites plus the two outsides (left
 * and right), and each closed grid bond is crossed by one open dual bond. A top-to-bottom
 * crossing of open bonds and a left-to-right crossing of the dual block each other, so exactly
 * one of the two happens; at p = 1/2 open and closed bonds are equally likely, which is why the
 * threshold is 1/2.
 */
export function dualAt(lat: Lattice, p: number): Dual {
	const { L } = lat;
	// faces (fx, fy), fx = 0..L−2 between columns fx and fx+1, fy = 0..L−2 between rows fy and fy+1
	const F = L - 1;
	const LEFT = F * F;
	const RIGHT = F * F + 1;
	const uf = new UnionFind(F * F + 2);
	const face = (fx: number, fy: number) => (fx < 0 ? LEFT : fx >= F ? RIGHT : fy * F + fx);
	for (let e = 0; e < lat.at.length; e++) {
		if (lat.at[e] < p) continue; // open bonds can't be crossed
		const s = lat.a[e];
		const x = s % L;
		const y = Math.floor(s / L);
		if (lat.b[e] === s + 1) {
			// horizontal grid bond between (x, y) and (x+1, y): separates faces above and below it
			if (y > 0 && y < L - 1) uf.union(face(x, y - 1), face(x, y));
		} else {
			// vertical grid bond between (x, y) and (x, y+1): separates faces left and right of it
			uf.union(face(x - 1, y), face(x, y));
		}
	}
	return { uf, face, LEFT, RIGHT, crosses: uf.find(LEFT) === uf.find(RIGHT) };
}
