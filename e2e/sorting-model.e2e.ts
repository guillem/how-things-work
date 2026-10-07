// Checks the sorting implementations and their operation counts against the
// textbook results. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import { ALGORITHMS, comparisonsFor, makeInput, recording, run } from '../src/routes/sorting/sorts';

test('every algorithm sorts every kind of input, and the replay agrees', () => {
	for (const algorithm of ALGORITHMS) {
		for (const order of ['shuffled', 'sorted', 'reversed', 'nearly'] as const) {
			for (const n of [0, 1, 2, 3, 7, 16, 33]) {
				const input = makeInput(n, order, n + 3);
				const { sorted } = run(algorithm, input);
				expect(sorted, `${algorithm} ${order} ${n}`).toEqual([...input].sort((x, y) => x - y));
				const rec = recording(algorithm, input, 5);
				expect(rec.at(rec.ops.length)).toEqual(sorted);
				expect(rec.countAt(rec.ops.length)).toEqual(rec.counts);
			}
		}
	}
});

test('exact comparison counts for the cases the page quotes', () => {
	const n = 100;
	const all = (n * (n - 1)) / 2;
	// Bubble (early exit) and insertion: one pass / n − 1 comparisons on sorted input.
	expect(comparisonsFor('bubble', n, 'sorted')).toBe(n - 1);
	expect(comparisonsFor('insertion', n, 'sorted')).toBe(n - 1);
	// Reversed input: every pair is compared.
	expect(comparisonsFor('bubble', n, 'reversed')).toBe(all);
	expect(comparisonsFor('insertion', n, 'reversed')).toBe(all);
	// Quick sort with the last element as pivot: sorted input is the worst case.
	expect(comparisonsFor('quick', n, 'sorted')).toBe(all);
	// Merge sort between (n/2)·log2 n and n·log2 n − n + 1 comparisons.
	for (const order of ['shuffled', 'sorted', 'reversed'] as const) {
		const c = comparisonsFor('merge', 128, order);
		expect(c).toBeGreaterThanOrEqual(64 * 7);
		expect(c).toBeLessThanOrEqual(128 * 7 - 128 + 1);
	}
});

test('growth: doubling n about quadruples the quadratic sorts and about doubles the others', () => {
	const ratio = (a: (typeof ALGORITHMS)[number]) =>
		comparisonsFor(a, 800, 'shuffled', 3) / comparisonsFor(a, 400, 'shuffled', 3);
	expect(ratio('bubble')).toBeGreaterThan(3.8);
	expect(ratio('insertion')).toBeGreaterThan(3.8);
	expect(ratio('merge')).toBeLessThan(2.3);
	expect(ratio('quick')).toBeLessThan(2.7); // n log n doubles to ~2.2×; random noise on top
	// Average insertion sort on shuffled input: about n²/4 comparisons.
	expect(comparisonsFor('insertion', 400, 'shuffled', 10) / ((400 * 400) / 4)).toBeCloseTo(1, 1);
	// Average quick sort: about 1.39 n log2 n comparisons.
	const q = comparisonsFor('quick', 1000, 'shuffled', 10) / (1000 * Math.log2(1000));
	expect(q).toBeGreaterThan(1.1);
	expect(q).toBeLessThan(1.45);
});
