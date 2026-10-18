// Checks the random-graph model against what is known about Erdős–Rényi graphs and percolation:
// the giant share solves S = 1 − e^(−cS) (S(2) ≈ 0.797) and the simulated share approaches it as
// n grows; below c = 1 the largest piece grows like log n, at c = 1 like n^(2/3), above it like
// n; the giant's share is a bell curve whose width shrinks like 1/√n (Pittel 1990); degrees are
// Poisson(c); and on the square grid, bond percolation crosses with a chance that passes 1/2 near
// p = 1/2 ever more sharply (Kesten 1980), with exactly one of the grid and its dual crossing.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	clustersAt,
	componentsAt,
	degreeHistogram,
	dualAt,
	generations,
	giantShare,
	giantSigma,
	lattice,
	largestComponent,
	largestSweep,
	linksAt,
	meanSweep,
	poisson,
	randomGraph,
	spanningProbability
} from '../src/routes/random-graphs/model';

const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

/** Least-squares slope of log(mean largest piece) against log n. */
function exponent(c: number, ns: readonly number[], seeds: number): number {
	const pts = ns.map((n) => {
		const sizes = Array.from({ length: seeds }, (_, k) => largestComponent(n, c, 1 + k));
		return { x: Math.log(n), y: Math.log(mean(sizes)) };
	});
	const mx = mean(pts.map((p) => p.x));
	const my = mean(pts.map((p) => p.y));
	const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
	const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
	return sxy / sxx;
}

test('the giant share solves S = 1 − e^(−cS): none up to c = 1, then 0.797 at c = 2', () => {
	expect(giantShare(0.5)).toBe(0);
	expect(giantShare(1)).toBe(0);
	expect(giantShare(2)).toBeCloseTo(0.7968, 3);
	expect(giantShare(3)).toBeCloseTo(0.9405, 3);
	// just above 1 it grows like 2(c − 1): a corner, not a jump
	expect(giantShare(1.01) / 0.02).toBeCloseTo(1, 1);
	for (const c of [1.2, 1.5, 2.5, 4]) {
		const s = giantShare(c);
		expect(Math.abs(s - (1 - Math.exp(-c * s)))).toBeLessThan(1e-9);
	}
});

test('a graph has the expected number of links, and links only get added as c rises', () => {
	const n = 4000;
	const g = randomGraph(n, 3, 5);
	// cn/2 links on average, within a few standard deviations
	for (const c of [0.5, 1, 2, 3]) {
		const m = linksAt(g, c);
		expect(Math.abs(m - (c * n) / 2)).toBeLessThan(4 * Math.sqrt((c * n) / 2));
	}
	// no pair twice, no loop
	const keys = new Set<number>();
	let loops = 0;
	for (let e = 0; e < g.a.length; e++) {
		if (g.a[e] === g.b[e]) loops++;
		keys.add(Math.min(g.a[e], g.b[e]) * n + Math.max(g.a[e], g.b[e]));
	}
	expect(loops).toBe(0);
	expect(keys.size).toBe(g.a.length);
	const sweep = largestSweep(g, [0, 0.5, 1, 1.5, 2, 3]);
	for (let i = 1; i < sweep.length; i++) expect(sweep[i]).toBeGreaterThanOrEqual(sweep[i - 1]);
	expect(sweep[0]).toBe(1);
	expect(componentsAt(g, 3).largest).toBe(sweep[5]);
});

test('degrees follow a Poisson distribution with mean c', () => {
	const n = 20000;
	const c = 2;
	const hist = degreeHistogram(randomGraph(n, c, 2), c);
	for (let k = 0; k <= 5; k++) {
		expect(Math.abs(hist[k] / n - poisson(k, c))).toBeLessThan(0.01);
	}
	expect(hist[0] / n).toBeCloseTo(Math.exp(-2), 2);
});

test('the simulated giant share approaches S = 1 − e^(−cS) as n grows', () => {
	const cs = [0.5, 1.3, 2, 3];
	const err = (n: number) => {
		const sw = meanSweep(n, cs, Math.max(4, Math.round(40000 / n)), 3);
		return sw.map((d) => Math.abs(d.share - giantShare(d.c)));
	};
	const small = err(100);
	const mid = err(1000);
	const big = err(20000);
	// near the knee (c = 1.3) the deviation is large at n = 100 and shrinks steadily
	expect(small[1]).toBeGreaterThan(mid[1]);
	expect(mid[1]).toBeGreaterThan(big[1]);
	expect(big[1]).toBeLessThan(0.03);
	// at every c the big graphs sit on the curve
	for (const e of big) expect(e).toBeLessThan(0.03);
	// at n = 100, below c = 1, the largest piece is still a visible share: the curve is rounded
	expect(1 - small[0]).toBeLessThan(0.95);
	expect(small[0]).toBeGreaterThan(0.05);
});

test('the largest piece grows like log n below c = 1, like n^(2/3) at c = 1, like n above', () => {
	const ns = [2000, 8000, 32000, 128000];
	const below = exponent(0.5, ns, 12);
	const at = exponent(1, ns, 30);
	const above = exponent(2, ns, 4);
	expect(below).toBeLessThan(0.3);
	expect(at).toBeGreaterThan(0.58);
	expect(at).toBeLessThan(0.76);
	expect(above).toBeGreaterThan(0.95);
	expect(above).toBeLessThan(1.05);
	// below 1 the largest piece is close to (ln n − 2.5 ln ln n) / α, α = c − 1 − ln c (Bollobás)
	const alpha = 0.5 - 1 - Math.log(0.5);
	for (const n of [8000, 128000]) {
		const law = (Math.log(n) - 2.5 * Math.log(Math.log(n))) / alpha;
		const sizes = Array.from({ length: 12 }, (_, k) => largestComponent(n, 0.5, 50 + k));
		expect(mean(sizes) / law).toBeGreaterThan(0.8);
		expect(mean(sizes) / law).toBeLessThan(1.25);
	}
});

test("above c = 1 the giant's share is a bell curve that narrows like 1/√n (Pittel 1990)", () => {
	const c = 2;
	for (const n of [500, 4000]) {
		const shares = Array.from({ length: 300 }, (_, k) => largestComponent(n, c, 100 + k) / n);
		const m = mean(shares);
		const sd = Math.sqrt(mean(shares.map((s) => (s - m) ** 2)));
		expect(Math.abs(m - giantShare(c))).toBeLessThan(0.01);
		// σ/√n with σ ≈ 0.68 at c = 2
		expect(sd * Math.sqrt(n)).toBeGreaterThan(0.85 * giantSigma(c));
		expect(sd * Math.sqrt(n)).toBeLessThan(1.15 * giantSigma(c));
	}
	expect(giantSigma(2)).toBeCloseTo(0.678, 2);
});

test('exploring from a node: on average c new nodes per node at first', () => {
	const n = 50000;
	const c = 1.5;
	const g = randomGraph(n, c, 4);
	const firsts: number[] = [];
	const seconds: number[] = [];
	for (let s = 0; s < 2000; s++) {
		const gen = generations(g, c, s);
		firsts.push(gen[1] ?? 0);
		seconds.push(gen[2] ?? 0);
	}
	expect(mean(firsts)).toBeCloseTo(c, 1);
	// each of them finds about c new ones in turn
	expect(mean(seconds) / (c * c)).toBeGreaterThan(0.9);
	expect(mean(seconds) / (c * c)).toBeLessThan(1.1);
	// the share of starts whose exploration reaches far is the giant share
	let far = 0;
	for (let s = 0; s < 2000; s++) if (generations(g, c, s).reduce((a, x) => a + x, 0) > 500) far++;
	expect(Math.abs(far / 2000 - giantShare(c))).toBeLessThan(0.04);
});

test('on the square grid, the chance of a crossing passes 1/2 near p = 1/2 ever more sharply', () => {
	const ps = [0.4, 0.45, 0.5, 0.55, 0.6];
	const small = spanningProbability(16, ps, 300, 1);
	const big = spanningProbability(64, ps, 300, 2);
	for (const P of [small, big]) {
		expect(P[2]).toBeGreaterThan(0.4);
		expect(P[2]).toBeLessThan(0.6);
		for (let i = 1; i < P.length; i++) expect(P[i]).toBeGreaterThanOrEqual(P[i - 1]);
	}
	// the bigger grid has a steeper switch
	expect(big[1]).toBeLessThan(small[1]);
	expect(big[3]).toBeGreaterThan(small[3]);
	expect(big[0]).toBeLessThan(0.02);
	expect(big[4]).toBeGreaterThan(0.98);
});

test('exactly one of the grid (top to bottom) and its dual (left to right) crosses', () => {
	for (let seed = 1; seed <= 40; seed++) {
		const lat = lattice(12, seed);
		for (const p of [0.3, 0.45, 0.5, 0.55, 0.7]) {
			const primal = clustersAt(lat, p).spanning >= 0;
			expect(primal).not.toBe(dualAt(lat, p).crosses);
		}
	}
});

test('a large grid keeps every one of its bonds: all open joins every site', () => {
	const L = 200;
	const lat = lattice(L, 3);
	const keys = new Set<number>();
	for (let e = 0; e < lat.a.length; e++) keys.add(lat.a[e] * L * L + lat.b[e]);
	expect(keys.size).toBe(2 * L * (L - 1));
	expect(clustersAt(lat, 1.01).largestSize).toBe(L * L);
});
