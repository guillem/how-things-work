// Checks the cache simulator against what caches are known to do: a miss moves a whole line;
// summing a matrix row by row misses once per line and column by column on every load; a
// direct-mapped cache thrashes on two arrays a cache size apart however large it is, while two
// ways cure it; LRU misses every time on a loop one line bigger than a fully associative cache
// (random replacement doesn't); the three Cs add up; tiling a matrix product cuts its misses;
// a scattered linked list misses on almost every node; and the latency of pointer chasing
// steps up where the working set outgrows each level, the step moving with the L2's size.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	L1,
	L2,
	LATENCY,
	MATMUL,
	amat,
	dotProduct,
	l2Config,
	labRun,
	listWalk,
	loop,
	matmul,
	matmulRun,
	matrixSum,
	missRate,
	program,
	run,
	workingSet,
	type CacheConfig,
	type Trace
} from '../src/routes/cache-memory-hierarchy/model';

const trace = (addrs: number[]): Trace => ({ addrs: Int32Array.from(addrs), regions: [], ops: 0 });

test('a miss brings in the whole line: 64 bytes in a row cost one miss, 64 bytes spread out 64', () => {
	const together = run(trace(Array.from({ length: 64 }, (_, i) => i)), L1);
	expect(together.misses).toBe(1);
	expect(together.hits).toBe(63);
	const apart = run(trace(Array.from({ length: 64 }, (_, i) => i * 64)), L1);
	expect(apart.misses).toBe(64);
});

test('summing a big matrix row by row misses once per line; column by column, on every load', () => {
	const rows = run(matrixSum(1024, 'row'), L1, { classify: false });
	expect(missRate(rows)).toBeCloseTo(8 / 64, 6);
	const cols = run(matrixSum(1024, 'col'), L1, { classify: false });
	expect(missRate(cols)).toBe(1);
	// the same additions, about seven times the cycles waiting for memory on the measured chip
	expect(program('col').amat / program('row').amat).toBeGreaterThan(7);
});

test('a direct-mapped cache misses every load of a · b when b starts one cache size after a, at any size', () => {
	for (const size of [4096, 32 * 1024, 256 * 1024, 1024 * 1024]) {
		const dm: CacheConfig = { size, line: 64, ways: 1, policy: 'lru' };
		const t = run(dotProduct(512, size), dm);
		expect(missRate(t)).toBe(1);
		// all but the first touch of each line are conflict misses: the cache is nearly empty
		expect(t.capacity).toBe(0);
		expect(t.conflict).toBe(t.misses - t.compulsory);
		const twoWay = run(dotProduct(512, size), { ...dm, ways: 2 });
		expect(twoWay.misses).toBe(twoWay.compulsory);
		expect(missRate(twoWay)).toBeCloseTo(1 / 8, 6);
	}
});

test('LRU and FIFO miss on every load of a loop one line bigger than a fully associative cache; random replacement does not', () => {
	const config: CacheConfig = { size: 32 * 1024, line: 64, ways: 0, policy: 'lru' };
	const lines = 512 + 1;
	const t = loop(lines, 64, 5);
	const lru = run(t, config);
	expect(lru.misses).toBe(t.addrs.length);
	expect(lru.compulsory).toBe(lines);
	expect(lru.capacity).toBe(t.addrs.length - lines);
	expect(run(t, { ...config, policy: 'fifo' }).misses).toBe(t.addrs.length);
	const random = run(t, { ...config, policy: 'random' });
	expect(random.misses - random.compulsory).toBeLessThan(0.1 * (t.addrs.length - lines));
	// and a direct-mapped cache of the same size loses only the two lines that share a set
	const dm = run(t, { ...config, ways: 1 });
	expect(dm.misses - dm.compulsory).toBe(2 * 4);
});

test('the three Cs add up to the misses, and compulsory misses are the distinct lines touched', () => {
	const small: CacheConfig = { size: 1024, line: 32, ways: 2, policy: 'lru' };
	for (const t of [matrixSum(32, 'col'), matmul(12), listWalk(200, true), dotProduct(64, 1024)]) {
		const r = run(t, small);
		expect(r.compulsory + r.capacity + r.conflict).toBe(r.misses);
		expect(r.hits + r.misses).toBe(t.addrs.length);
		expect(r.compulsory).toBe(new Set(Array.from(t.addrs, (a) => a >> 5)).size);
	}
});

test('tiling the matrix product does the same arithmetic with many times fewer misses', () => {
	const naive = matmulRun(0);
	const tiled = MATMUL.blocks.map((b) => ({ b, ...matmulRun(b) }));
	for (const r of tiled) expect(r.ops).toBe(naive.ops);
	const best = tiled.reduce((x, y) => (y.tally.misses < x.tally.misses ? y : x));
	expect(naive.tally.misses / best.tally.misses).toBeGreaterThan(20);
	expect(naive.cycles / best.cycles).toBeGreaterThan(10);
	// the best tile of B (b × b × 8 bytes) fills a fraction of the 4 KB cache, leaving room for
	// the rows of A it meets; the biggest tile no longer fits and loses most of the gain
	expect(best.b * best.b * 8).toBeLessThan(MATMUL.l1.size / 2);
	const biggest = tiled[tiled.length - 1];
	expect(biggest.tally.misses).toBeGreaterThan(10 * best.tally.misses);
});

test('a list of scattered nodes misses on almost every node; in order, once per line', () => {
	expect(missRate(program('list').tally)).toBeCloseTo(16 / 64, 6);
	expect(missRate(program('scattered').tally)).toBeGreaterThan(0.95);
});

test('pointer-chasing latency steps up where the working set outgrows L1, and with an L2, where it outgrows L2', () => {
	const kb = 1024;
	expect(workingSet(16 * kb, 'chase', null)).toBe(LATENCY.l1);
	expect(workingSet(32 * kb, 'chase', null)).toBe(LATENCY.l1);
	expect(workingSet(64 * kb, 'chase', null)).toBe(LATENCY.mem);
	expect(workingSet(64 * kb, 'chase', L2)).toBe(LATENCY.l2);
	expect(workingSet(256 * kb, 'chase', L2)).toBe(LATENCY.l2);
	expect(workingSet(512 * kb, 'chase', L2)).toBe(LATENCY.mem);
	// a bigger L2 moves the knee
	expect(workingSet(512 * kb, 'chase', l2Config(1024 * kb))).toBe(LATENCY.l2);
	expect(workingSet(2048 * kb, 'chase', l2Config(1024 * kb))).toBe(LATENCY.mem);
	// summing in order uses every byte of each line: one load in eight goes to the next level
	const sum = workingSet(1024 * kb, 'sum', null);
	expect(sum).toBeCloseTo((7 * LATENCY.l1 + LATENCY.mem) / 8, 6);
});

test('the lab: a column walk that thrashes a small direct-mapped cache fits a fully associative one twice the size', () => {
	const dm = labRun('col', { size: 512, line: 64, ways: 1, policy: 'lru' }).replay;
	expect(dm.totals.at(-1)!.misses).toBe(256);
	const fa = labRun('col', { size: 1024, line: 64, ways: 0, policy: 'lru' }).replay;
	expect(fa.totals.at(-1)!.misses).toBe(32);
	expect(amat(fa.totals.at(-1)!)).toBeLessThan(amat(dm.totals.at(-1)!) / 5);
});

test('the bills the narrative quotes', () => {
	expect(Math.round(program('row').amat)).toBe(35);
	expect(Math.round(program('col').amat)).toBe(250);
	expect(Math.round(program('list').amat)).toBe(66);
	expect(Math.round(program('scattered').amat / 10) * 10).toBe(240);
	const perOp = (r: { cycles: number; ops: number }) => r.cycles / r.ops;
	expect(Math.round(perOp(matmulRun(0)))).toBe(287);
	expect(Math.round(perOp(matmulRun(12)))).toBe(15);
	expect(Math.round(matmulRun(0).tally.misses / matmulRun(12).tally.misses / 10) * 10).toBe(40);
});
