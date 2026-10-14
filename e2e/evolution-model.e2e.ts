// Checks the evolution models against population-genetics results and real
// measurements (definition of done #5 in docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import { LTEE_GENERATIONS, LTEE_GRAND_MEAN, LTEE_POWER_LAW } from '../src/routes/evolution/ltee';
import {
	MADINGLEY,
	advantageFor,
	dominantSelection,
	fateOfMutation,
	fitMadingley,
	fluctuation,
	kimuraFixation,
	mutate,
	rng,
	runMoths,
	runPlate
} from '../src/routes/evolution/model';

/** |observed − expected| share within z binomial standard errors. */
function withinSE(hits: number, trials: number, p: number, z = 4) {
	const se = Math.sqrt((p * (1 - p)) / trials);
	expect(Math.abs(hits / trials - p)).toBeLessThan(z * se);
}

test('a new neutral mutation fixes with probability 1/2N', () => {
	for (const N of [25, 100]) {
		const f = fateOfMutation(N, 0, 30000, N);
		withinSE(f.fixed, f.trials, 1 / (2 * N));
		expect(f.fixed + f.lost).toBe(f.trials);
	}
});

test('a new beneficial mutation fixes with probability about 2s, and is usually lost', () => {
	for (const s of [0.02, 0.05, 0.1]) {
		const f = fateOfMutation(200, s, 12000, Math.round(s * 1000));
		const u = kimuraFixation(200, s);
		expect(u).toBeGreaterThan(1.8 * s);
		expect(u).toBeLessThan(2 * s);
		withinSE(f.fixed, f.trials, u);
		// Even a 10% advantage is lost most of the time.
		expect(f.lost / f.trials).toBeGreaterThan(0.8);
	}
});

test('a harmful mutation almost never fixes in a large population, but can in a tiny one', () => {
	expect(kimuraFixation(1000, -0.01)).toBeLessThan(1e-15);
	expect(kimuraFixation(10, -0.01)).toBeCloseTo(0.04, 2);
});

const sooty = () => 1;
const base = { N: 400, mu: 0.001, predation: 0.5, bark: sooty, generations: 80, seed: 3 };

test('birds hunting on sooty bark make the population darker, generation after generation', () => {
	const run = runMoths(base);
	expect(run[0].mean).toBeCloseTo(0.2, 1);
	expect(run[40].mean).toBeGreaterThan(0.6);
	expect(run[80].mean).toBeGreaterThan(0.85);
	// Within one generation the survivors are darker than the moths the birds found.
	expect(run[0].survivorMean).toBeGreaterThan(run[0].mean);
});

test('take away any one ingredient and the population stops adapting', () => {
	for (const off of ['variation', 'inheritance', 'selection'] as const) {
		const run = runMoths({ ...base, [off]: false });
		expect(Math.abs(run[80].mean - run[0].mean), off).toBeLessThan(0.15);
	}
});

test('mutation flips pale and dark alleles at the same rate, and is never told the environment', () => {
	const genome = () => {
		const g = new Uint8Array(20000);
		const r = rng(5);
		for (let i = 0; i < g.length; i++) g[i] = r() < 0.2 ? 1 : 0;
		return g;
	};
	// mutate() is never told the environment. A mostly pale population gains
	// dark alleles at the rate μ per pale allele, and loses them at μ per dark one.
	const a = mutate(genome(), 0.01, rng(9));
	expect(a.toDark / 16000).toBeCloseTo(0.01, 2);
	expect(a.toPale / 4000).toBeCloseTo(0.01, 2);
});

test('without new mutations a small population gets stuck when the bark changes back', () => {
	// Sooty bark for 60 generations, then clean bark again (the foresight step's run).
	const bark = (g: number) => (g < 60 ? 1 : 0);
	const end = (N: number, mu: number, seed: number) =>
		runMoths({ N, mu, predation: 0.5, bark, generations: 140, seed })[140].mean * 12;
	let stuck = 0;
	for (let seed = 1; seed <= 12; seed++) if (end(50, 0, seed) > 3) stuck++;
	expect(stuck).toBeGreaterThanOrEqual(9);
	// With mutations, a large population turns pale again every time.
	for (let seed = 1; seed <= 6; seed++) expect(end(500, 0.001, seed)).toBeLessThan(2.5);
});

test('Luria–Delbrück: separate cultures fluctuate far more than a Poisson count', () => {
	const random = fluctuation('random', 400, 1);
	const induced = fluctuation('induced', 400, 1);
	expect(random.variance / random.mean).toBeGreaterThan(10);
	expect(induced.variance / induced.mean).toBeGreaterThan(0.7);
	expect(induced.variance / induced.mean).toBeLessThan(1.4);
	// The share of cultures with no mutant is e^(−μN) = 0.55 for μ = 3·10⁻⁸ and
	// N = 2·10⁷ (Luria and Delbrück's experiment 16 had 11 of 20).
	expect(random.zeros / 400).toBeGreaterThan(0.48);
	expect(random.zeros / 400).toBeLessThan(0.62);
});

test('MEGA-plate: 10,000-fold resistance evolves through intermediate doses, not without', () => {
	for (const seed of [1, 2, 3]) {
		const steps = runPlate({ K: 1e7, mu: 1e-7, intermediate: true, generations: 300, seed });
		expect(steps.best.at(-1)).toBe(4);
		const jump = runPlate({ K: 1e7, mu: 1e-7, intermediate: false, generations: 300, seed });
		expect(jump.best.at(-1)).toBeLessThan(2);
	}
});

test('peppered moth: the decline near Cambridge fits a selection of about 0.27 per generation', () => {
	const s = fitMadingley();
	expect(s).toBeGreaterThan(0.2);
	expect(s).toBeLessThan(0.35);
	expect(dominantSelection(0.12, -s, 6)[6]).toBeCloseTo(MADINGLEY[6].share, 1);
});

test('peppered moth: going from 2% to 98% black in 47 years needs an advantage of about 32%', () => {
	const s = advantageFor(0.02, 0.98, 47);
	expect(s).toBeGreaterThan(0.3);
	expect(s).toBeLessThan(0.34);
	expect(dominantSelection(0.02, s, 47)[47]).toBeCloseTo(0.98, 3);
});

test('Lenski: fitness rose about 70% in 50,000 generations and is still rising', () => {
	const i50 = LTEE_GENERATIONS.indexOf(50000);
	expect(LTEE_GRAND_MEAN[0]).toBeCloseTo(1, 1);
	expect(LTEE_GRAND_MEAN[i50]).toBeGreaterThan(1.6);
	expect(LTEE_GRAND_MEAN[i50]).toBeLessThan(1.8);
	const w = (t: number) => (LTEE_POWER_LAW.b * t + 1) ** LTEE_POWER_LAW.a;
	expect(w(50000)).toBeCloseTo(LTEE_GRAND_MEAN[i50], 1);
	expect(w(50000)).toBeGreaterThan(w(40000));
});
