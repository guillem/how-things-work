// Checks the population-genetics page's model against the exact results it quotes: random mating
// puts genotypes at the Hardy–Weinberg proportions p², 2pq, q² in one generation and leaves the
// allele share alone; a neutral allele fixes with a chance equal to its share (1/2N for a new
// mutation); heterozygosity decays by 1/2N per generation; a new beneficial mutation fixes with
// a chance of about 2s whatever N (Haldane), as Kimura's diffusion approximation gives; a harmful
// one can fix in a small population; a recessive allele hides from selection while rare. The
// simulations are seeded, and each is compared with the theory within three standard errors.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import { rng } from '../src/lib/draw/math';
import {
	alleleShare,
	deterministic,
	fixationChance,
	gameteShare,
	hardyWeinberg,
	heterozygosity,
	mutationFates,
	newMutationFixes,
	newborns,
	runMany,
	runOne
} from '../src/routes/population-genetics/model';

/** Asserts that `hits` of `n` trials is within three standard errors of the chance `u`. */
function expectShare(hits: number, n: number, u: number) {
	const se = Math.sqrt((u * (1 - u)) / n);
	expect(Math.abs(hits / n - u)).toBeLessThan(3 * se);
}

test('one generation of random mating gives the Hardy–Weinberg genotypes, and keeps p', () => {
	// parents that are all homozygous: 30% AA, 70% aa, no heterozygotes
	const parents = { AA: 300, Aa: 0, aa: 700 };
	const p = gameteShare(parents, 0, 0.5);
	expect(p).toBeCloseTo(0.3, 12);
	const N = 1_000_000;
	const kids = newborns(N, p, rng(1));
	// p² = 0.09, 2pq = 0.42, q² = 0.49
	expect(kids.AA / N).toBeCloseTo(0.09, 2);
	expect(kids.Aa / N).toBeCloseTo(0.42, 2);
	expect(kids.aa / N).toBeCloseTo(0.49, 2);
	expect(alleleShare(kids)).toBeCloseTo(0.3, 2);
	// with no forces at all (an infinite population, no selection) p never moves
	for (const share of deterministic(0.3, 0, 0, 100)) expect(share).toBeCloseTo(0.3, 12);
});

test('the newborns match Hardy–Weinberg each generation even while selection changes p', () => {
	const run = runOne({ N: 2000, p0: 0.05, s: 0.05, h: 0.5, generations: 200, seed: 4 });
	const g = run.genotypes ?? [];
	expect(run.p[200]).toBeGreaterThan(0.9);
	for (let t = 1; t <= 200; t++) {
		const p = run.p[t];
		// the share of heterozygotes is 2pq up to sampling (its standard error is under 0.012)
		expect(Math.abs(g[t].Aa / 2000 - heterozygosity(p))).toBeLessThan(0.04);
	}
});

test('a neutral allele fixes with a chance equal to its share: 1/2N for a new mutation', () => {
	const runs = runMany({ N: 20, p0: 0.2, s: 0, h: 0.5, generations: 2000, seed: 2 }, 4000);
	expect(runs.every((r) => r.fixedAt !== null || r.lostAt !== null)).toBe(true);
	expectShare(runs.filter((r) => r.fixedAt !== null).length, 4000, 0.2);
	const fates = mutationFates(50, 0, 0.5, 20_000, 3);
	expectShare(fates.fixed, 20_000, 1 / 100);
	expect(newMutationFixes(50, 0, 0.5)).toBe(1 / 100);
});

test('heterozygosity falls by 1/2N each generation', () => {
	for (const N of [10, 50]) {
		const runs = runMany({ N, p0: 0.5, s: 0, h: 0.5, generations: 60, seed: 5 }, 4000);
		for (const t of [10, 30, 60]) {
			const mean = runs.reduce((a, r) => a + heterozygosity(r.p[t]), 0) / runs.length;
			const expected = 0.5 * (1 - 1 / (2 * N)) ** t;
			expect(Math.abs(mean - expected)).toBeLessThan(0.01);
		}
	}
});

test('Kimura: the closed form for additive effects, √(4s/πN) for a recessive allele', () => {
	for (const N of [10, 100, 1000]) {
		for (const s of [-0.002, 0.001, 0.05]) {
			const closed = (1 - Math.exp(-2 * s)) / (1 - Math.exp(-4 * N * s));
			expect(newMutationFixes(N, s, 0.5) / closed).toBeCloseTo(1, 5);
		}
	}
	// a fully recessive allele whose homozygote has an advantage S = 2s: √(2S/πN) (Kimura 1957)
	expect(newMutationFixes(1000, 0.05, 0) / Math.sqrt(0.2 / (Math.PI * 1000))).toBeCloseTo(1, 2);
	// a share already present: from half, a neutral allele fixes half the time
	expect(fixationChance(500, 0, 1, 0.5)).toBe(0.5);
});

test('a new beneficial mutation fixes with a chance of about 2s, however large the population', () => {
	// 5% per copy: about 1 in 10, at N = 100 as at N = 100,000
	for (const N of [100, 100_000]) expect(newMutationFixes(N, 0.05, 0.5)).toBeCloseTo(0.095, 3);
	// the simulation agrees with Kimura, in a small and a large population
	for (const N of [100, 5000]) {
		const fates = mutationFates(N, 0.02, 0.5, 20_000, 6);
		expect(fates.drifting).toBe(0);
		expectShare(fates.fixed, 20_000, newMutationFixes(N, 0.02, 0.5));
	}
	expect(newMutationFixes(5000, 0.02, 0.5) / 0.04).toBeCloseTo(1, 1);
});

test('chance can fix a harmful allele in a small population, but not in a large one', () => {
	// N = 10, each copy 1% worse: still fixes about 4% of the time (a neutral one: 5%)
	const u = newMutationFixes(10, -0.01, 0.5);
	expect(u).toBeCloseTo(0.041, 3);
	expectShare(mutationFates(10, -0.01, 0.5, 20_000, 8).fixed, 20_000, u);
	expect(newMutationFixes(1000, -0.01, 0.5)).toBeLessThan(1e-15);
});

test('a recessive allele hides from selection while it is rare', () => {
	const gens = 5000;
	const reach = (h: number, from: number, to: number) => {
		const p = deterministic(from, 0.05, h, gens);
		return p.findIndex((x) => x >= to);
	};
	// from 1%, a recessive advantage takes far longer to reach half the population
	const rec = reach(0, 0.01, 0.5);
	const add = reach(0.5, 0.01, 0.5);
	const dom = reach(1, 0.01, 0.5);
	expect(rec).toBeGreaterThan(5 * add);
	expect(dom).toBeLessThan(add);
	// near the top it is the dominant one that stalls: the last a copies hide in heterozygotes
	expect(reach(1, 0.9, 0.99)).toBeGreaterThan(5 * reach(0, 0.9, 0.99));
	// at 1%, 99% of the copies of A are in heterozygotes, where a recessive allele is not seen
	const g = hardyWeinberg(0.01);
	expect(g.Aa / (g.Aa + 2 * g.AA)).toBeCloseTo(0.99, 3);
	// and a new recessive mutation fixes less often than an additive one
	const fates = mutationFates(1000, 0.05, 0, 20_000, 9);
	expectShare(fates.fixed, 20_000, newMutationFixes(1000, 0.05, 0));
	expect(newMutationFixes(1000, 0.05, 0)).toBeLessThan(newMutationFixes(1000, 0.05, 0.5) / 5);
});

test('a run replays identically from its seed', () => {
	const o = { N: 50, p0: 0.5, s: 0.01, h: 0.5, generations: 100, seed: 12 };
	expect(runMany(o, 3)).toEqual(runMany(o, 3));
});
