// Checks the hash-table and Bloom-filter simulator, on real words with a seeded MurmurHash3, against
// the textbook results: MurmurHash3's published test vectors; chaining's expected probes 1 + α/2
// (found) and α (not found); linear probing's ½(1 + 1/(1 − α)) and ½(1 + 1/(1 − α)²) for a large
// table (Knuth, TAOCP vol. 3, §6.4) and Knuth's exact values for a small one; chain lengths that
// follow a Poisson distribution; the Bloom filter's false-positive rate (1 − e^(−kn/m))^k with its
// optimum k = (m/n) ln 2 (Broder & Mitzenmacher 2004), no false negatives, and a measured rate
// above the formula in tiny filters (Bose et al. 2008); doubling and rehashing; and a hash that
// reads only the first letters clustering both. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	INSERTABLE,
	QUERIES,
	averageFillCurve,
	bitsPerKeyFor,
	buildBloom,
	buildTable,
	chainHistogram,
	expectedProbes,
	fillCurve,
	fpApprox,
	fpExact,
	growRun,
	hashReading,
	kOptimal,
	longest,
	maybeHas,
	meanHit,
	meanMiss,
	measuredFP,
	measuredFPAverage,
	murmur3,
	search
} from '../src/routes/hash-tables-bloom-filters/model';

/** Mean of f over `runs` seeds. */
const avg = (runs: number, f: (salt: number) => number) => {
	let s = 0;
	for (let r = 0; r < runs; r++) s += f(r);
	return s / runs;
};

test('MurmurHash3 x86_32 gives the published test vectors', () => {
	expect(murmur3('', 0)).toBe(0);
	expect(murmur3('', 1)).toBe(0x514e28b7);
	expect(murmur3('hello', 0)).toBe(0x248bfa47);
	expect(murmur3('The quick brown fox jumps over the lazy dog', 0)).toBe(0x2e4ff723);
});

test('the keys are real words, and the queried ones were never inserted', () => {
	expect(INSERTABLE.length + QUERIES.length).toBeGreaterThan(6000);
	const inserted = new Set(INSERTABLE);
	expect(inserted.size).toBe(INSERTABLE.length);
	expect(QUERIES.some((q) => inserted.has(q))).toBe(false);
	for (const w of ['king', 'thou', 'love'])
		expect(inserted.has(w) || QUERIES.includes(w)).toBe(true);
});

test('chaining: a found key takes about 1 + α/2 comparisons, a missing one α', () => {
	const m = 2048;
	for (const alpha of [0.5, 1, 2]) {
		const n = alpha * m;
		const hit = avg(8, (salt) =>
			meanHit(buildTable('chaining', INSERTABLE.slice(0, n), m, { salt }))
		);
		const miss = avg(8, (salt) =>
			meanMiss(buildTable('chaining', INSERTABLE.slice(0, n), m, { salt }), QUERIES, { salt })
		);
		expect(hit).toBeCloseTo(1 + alpha / 2, 1);
		expect(Math.abs(miss / alpha - 1)).toBeLessThan(0.04);
	}
});

test('linear probing in a large table follows Knuth: ½(1 + 1/(1 − α)) found, ½(1 + 1/(1 − α)²) not', () => {
	const m = 4096;
	for (const alpha of [0.5, 0.7, 0.8]) {
		const n = Math.round(alpha * m);
		const tables = (salt: number) => buildTable('linear', INSERTABLE.slice(0, n), m, { salt });
		const hit = avg(10, (salt) => meanHit(tables(salt)));
		const miss = avg(10, (salt) => meanMiss(tables(salt), QUERIES, { salt }));
		const knuthHit = 0.5 * (1 + 1 / (1 - alpha));
		const knuthMiss = 0.5 * (1 + 1 / (1 - alpha) ** 2);
		expect(Math.abs(hit / knuthHit - 1)).toBeLessThan(0.03);
		expect(Math.abs(miss / knuthMiss - 1)).toBeLessThan(0.08);
	}
	// the exact values tend to the same limits
	const big = 1e5;
	expect(expectedProbes('linear', big, 0.9 * big).hit).toBeCloseTo(5.5, 1);
	expect(expectedProbes('linear', big, 0.9 * big).miss).toBeCloseTo(50.5, 0);
});

test('a small table of 64 slots: averaged over 400 tables, the probes match Knuth’s exact values', () => {
	const curve = averageFillCurve('linear', 64, 60, 400);
	for (const n of [16, 32, 48, 56, 60]) {
		const e = expectedProbes('linear', 64, n);
		expect(Math.abs(curve.hit[n - 1] / e.hit - 1)).toBeLessThan(0.04);
		expect(Math.abs(curve.miss[n - 1] / e.miss - 1)).toBeLessThan(0.06);
	}
	// and a nearly full small table does better than the large-table formula
	expect(expectedProbes('linear', 64, 60).hit).toBeLessThan(0.5 * (1 + 1 / (1 - 60 / 64)));
	// one table alone scatters about the average: it is an average, not a guarantee
	const one = buildTable('linear', INSERTABLE.slice(0, 60), 64);
	expect(Math.max(...one.hitProbes)).toBeGreaterThan(10);
});

test('a lookup retraces the probes of the insertion, and a missing key stops at an empty slot', () => {
	const t = buildTable('linear', INSERTABLE.slice(0, 50), 64);
	for (let i = 0; i < 50; i++) {
		const s = search(t, INSERTABLE[i]);
		expect(s.found).toBe(true);
		expect(s.probes).toBe(t.hitProbes[i]);
		expect(s.path[s.path.length - 1]).toBe(t.slotOf[i]);
	}
	const miss = search(t, QUERIES[0]);
	expect(miss.found).toBe(false);
	expect(t.slots[miss.path[miss.path.length - 1]]).toBe(-1);
});

test('a full linear-probing table: a miss examines every slot, and the expectation says so', () => {
	for (const m of [4, 16]) {
		const t = buildTable('linear', INSERTABLE.slice(0, m), m);
		expect(search(t, QUERIES[0]).probes).toBe(m);
		expect(expectedProbes('linear', m, m).miss).toBe(m);
		const curve = fillCurve('linear', INSERTABLE.slice(0, m), m);
		expect(curve.miss[m - 1]).toBe(m);
	}
});

test('with a good hash, chain lengths follow a Poisson distribution; the longest grows slowly', () => {
	const m = 4096;
	const t = buildTable('chaining', INSERTABLE.slice(0, m), m); // α = 1
	const h = chainHistogram(t);
	// e^(−1) of the slots stay empty, e^(−1) hold one key, e^(−1)/2 hold two
	expect(h[0] / m).toBeCloseTo(Math.exp(-1), 1);
	expect(h[1] / m).toBeCloseTo(Math.exp(-1), 1);
	expect(h[2] / m).toBeCloseTo(Math.exp(-1) / 2, 1);
	// the longest chain is a handful (about ln n / ln ln n), not hundreds
	expect(longest(t)).toBeGreaterThanOrEqual(4);
	expect(longest(t)).toBeLessThanOrEqual(10);
});

test('the Bloom filter’s measured false-positive rate tracks (1 − e^(−kn/m))^k in a large filter', () => {
	const n = 2000;
	for (const [bitsPerKey, k] of [
		[4, 2],
		[8, 3],
		[8, 6],
		[10, 7]
	]) {
		const m = n * bitsPerKey;
		const fp = avg(6, (salt) =>
			measuredFP(buildBloom(INSERTABLE.slice(0, n), m, k, salt), QUERIES, salt)
		);
		const formula = (1 - Math.exp((-k * n) / m)) ** k;
		expect(Math.abs(fp / formula - 1)).toBeLessThan(0.15);
	}
});

test('it never says “absent” for a word it holds', () => {
	const words = INSERTABLE.slice(0, 1000);
	const f = buildBloom(words, 2000, 4, 3);
	expect(words.every((w) => maybeHas(f, w, 3))).toBe(true);
});

test('the best number of hash functions is about (m/n) ln 2, and 1% costs 9.6 bits a key', () => {
	const n = 1000;
	const m = 10 * n;
	expect(kOptimal(n, m)).toBeCloseTo(6.93, 2);
	const rate = (k: number) =>
		avg(4, (salt) => measuredFP(buildBloom(INSERTABLE.slice(0, n), m, k, salt), QUERIES, salt));
	const best = rate(7);
	expect(best).toBeLessThan(rate(2));
	expect(best).toBeLessThan(rate(14));
	expect(best).toBeGreaterThan(0.004);
	expect(best).toBeLessThan(0.013);
	expect(bitsPerKeyFor(0.01)).toBeCloseTo(9.59, 2);
	// at the optimum about half the bits are set
	const f = buildBloom(INSERTABLE.slice(0, n), m, 7);
	expect(f.ones / m).toBeCloseTo(0.5, 1);
});

test('in a tiny filter the measured rate drifts above the formula; the exact value matches it', () => {
	const k = 6;
	for (const m of [16, 32]) {
		const n = m / 8;
		const approx = fpApprox(n, m, k);
		const exact = fpExact(n, m, k);
		const measured = measuredFPAverage(n, m, k, 600);
		expect(exact).toBeGreaterThan(approx * 1.15);
		expect(Math.abs(measured / exact - 1)).toBeLessThan(0.1);
	}
	// for a large filter at the same 8 bits a key, the three agree
	expect(fpExact(256, 2048, k) / fpApprox(256, 2048, k)).toBeLessThan(1.02);
});

test('a table that doubles past its maximum load keeps the probes short', () => {
	const { points, resizes } = growRun('linear', INSERTABLE.slice(0, 1000), 0.75);
	// 8 slots, doubled whenever a key would push α past 0.75: at the 7th, 13th, 25th … key
	expect(resizes.slice(0, 3)).toEqual([7, 13, 25]);
	const last = points[points.length - 1];
	expect(last.m).toBe(2048);
	expect(last.n / last.m).toBeLessThanOrEqual(0.75);
	// rehashing moves fewer than two keys per key inserted: constant on average
	expect(last.moved / last.n).toBeLessThan(2);
	expect(Math.max(...points.slice(20).map((p) => p.hit))).toBeLessThan(4);
});

test('a hash that reads only the first letters clusters the table and the filter', () => {
	const good = hashReading(99);
	const bad = hashReading(2);
	const m = 1024;
	const keys = INSERTABLE.slice(0, m);
	const tGood = buildTable('chaining', keys, m, { hash: good });
	const tBad = buildTable('chaining', keys, m, { hash: bad });
	expect(meanHit(tGood)).toBeCloseTo(1.5, 1);
	expect(meanHit(tBad)).toBeGreaterThan(5);
	expect(longest(tBad)).toBeGreaterThan(30);
	// the filter sets fewer bits, yet says "maybe" far more often
	const n = 1000;
	const fGood = buildBloom(INSERTABLE.slice(0, n), 8 * n, 6, 0, good);
	const fBad = buildBloom(INSERTABLE.slice(0, n), 8 * n, 6, 0, bad);
	expect(fBad.ones).toBeLessThan(fGood.ones / 2);
	expect(measuredFP(fGood, QUERIES, 0, good)).toBeLessThan(0.04);
	expect(measuredFP(fBad, QUERIES, 0, bad)).toBeGreaterThan(0.5);
});
