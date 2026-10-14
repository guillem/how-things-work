// Runs the Turing machines of the explainer and checks what they compute: binary
// increment against arithmetic, the palindrome checker, the busy beavers' known step
// counts (BB(5) = 47,176,870, bbchallenge 2024), the halting table, and the
// travelling-salesman counts. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BEAVERS,
	DECREMENT,
	INCREMENT,
	PALINDROME,
	SIGMA3,
	bruteForce,
	bruteForceYears,
	cities,
	countOnes,
	decide,
	eachTour,
	encode,
	fromStandard,
	heldKarpSteps,
	haltingTable,
	machine,
	nearestNeighbour,
	parseMachine,
	run,
	runFast,
	tapeText,
	tourCount,
	tourLength
} from '../src/routes/turing-machines/turing';

const out = (m: typeof INCREMENT, input: string) => {
	const r = run(m, input, 100_000);
	expect(r.stop).toBe('halt');
	return { text: tapeText(r.final, m.blank), state: r.final.state, steps: r.steps };
};

test('the increment machine adds one to every number from 0 to 1023', () => {
	for (let v = 0; v < 1024; v++) {
		expect(out(INCREMENT, v.toString(2)).text).toBe((v + 1).toString(2));
	}
	// All 1s: the carry runs off the left end and grows the number.
	expect(out(INCREMENT, '1111').text).toBe('10000');
});

test('1011 + 1 = 1100 in 8 steps', () => {
	const r = out(INCREMENT, '1011');
	expect(r.text).toBe('1100');
	// 4 digits and the blank to find the end, then 1→0, 1→0, 0→1.
	expect(r.steps).toBe(8);
});

test('the decrement exercise subtracts one from every number from 1 to 1023', () => {
	for (let v = 1; v < 1024; v++) {
		const text = out(DECREMENT, v.toString(2)).text.replace(/^0+(?=.)/, '');
		expect(text).toBe((v - 1).toString(2));
	}
});

test('the palindrome checker answers yes exactly for palindromes', () => {
	for (let len = 0; len <= 9; len++)
		for (let v = 0; v < 1 << len; v++) {
			const w = len ? v.toString(2).padStart(len, '0') : '';
			const r = run(PALINDROME, w, 100_000);
			expect(r.stop).toBe('halt');
			expect(r.final.state, w).toBe(w === [...w].reverse().join('') ? 'yes' : 'no');
		}
});

test('checking a palindrome of n symbols takes (n + 1)(n + 2)/2 steps, about n²/2', () => {
	expect(out(PALINDROME, '0110').steps).toBe(15);
	expect(out(PALINDROME, '0'.repeat(10)).steps).toBe(66);
	expect(out(PALINDROME, '0'.repeat(20)).steps).toBe(231);
	expect(out(PALINDROME, '01101').state).toBe('no');
});

test('busy beavers: S(2) = 6, S(3) = 21, S(4) = 107, with 4, 5 and 13 ones', () => {
	const expected = { 2: [6, 4], 3: [21, 5], 4: [107, 13] } as const;
	for (const n of [2, 3, 4] as const) {
		const r = run(fromStandard(BEAVERS[n]), '', 10_000);
		expect(r.stop).toBe('halt');
		expect(r.final.state).toBe('H');
		expect([r.steps, countOnes(r.final)]).toEqual(expected[n]);
	}
	// The most 1s three states can leave, Σ(3) = 6, comes from a different machine, in 14 steps.
	const s3 = run(fromStandard(SIGMA3), '', 1000);
	expect([s3.steps, countOnes(s3.final)]).toEqual([14, 6]);
});

test('the fifth busy beaver halts after 47,176,870 steps with 4,098 ones', () => {
	const r = runFast(fromStandard(BEAVERS[5]), 50_000_000);
	expect(r).toEqual({ steps: 47_176_870, ones: 4098, halted: true });
	// The fast runner agrees with the recording one.
	const m = fromStandard(BEAVERS[4]);
	expect(runFast(m, 1000)).toEqual({ steps: 107, ones: 13, halted: true });
});

test('the reader’s rule tables: parsed, with errors reported by line', () => {
	const p = parseMachine('# add one\nright 0 -> 0 R right\nright _ -> _ L carry');
	expect(p.ok).toBe(true);
	if (p.ok) expect(p.machine.start).toBe('right');
	const bad = parseMachine('a 1 -> 1 X b\n\na 0 > 1 R b\na 0 -> 0 R a\na 0 -> 1 L a');
	expect(bad.ok).toBe(false);
	if (!bad.ok) expect(bad.errors.map((e) => e.line)).toEqual([1, 3, 5]);
	// A machine that never stops is cut off at the step limit.
	const loop = machine(['a _ -> _ R a']);
	expect(run(loop, '', 500).stop).toBe('limit');
});

test('the halting table: each machine run on each description, decided by watching for repeats', () => {
	const t = haltingTable();
	expect(t.cells.length).toBe(6);
	// Every description is a string of 0s and 1s.
	for (const c of t.codes) expect(c).toMatch(/^[01]+$/);
	const row = (name: string) => t.cells[t.names.indexOf(name)];
	expect(row('Add one').every((v) => v === 'halts')).toBe(true);
	expect(row('Walk right').every((v) => v === 'loops')).toBe(true);
	// Rows that depend on the description: "Even length" halts on even-length codes.
	t.codes.forEach((c, j) =>
		expect(row('Even length')[j]).toBe(c.length % 2 === 0 ? 'halts' : 'loops')
	);
	// The diagonal has both answers, so the machine D that flips it is not a constant row.
	const diag = t.cells.map((r, i) => r[i]);
	expect(new Set(diag).size).toBe(2);
	// A verdict the decider gives is the truth: halting ones really halt.
	const add = machine(['right 0 -> 0 R right', 'right _ -> _ L x']);
	expect(decide(add, encode(add))).toBe('halts');
});

test('travelling salesman: (n − 1)!/2 tours, and brute force finds the shortest', () => {
	expect([4, 5, 8, 10].map(tourCount)).toEqual([3, 12, 2520, 181_440]);
	expect(tourCount(20)).toBe(60_822_550_204_416_000);
	let k = 0;
	const seen = new Set<string>();
	eachTour(6, (tour) => {
		k++;
		seen.add(tour.join());
	});
	expect(k).toBe(60);
	expect(seen.size).toBe(60);
	for (const n of [5, 7, 9]) {
		const cs = cities(n, 3);
		const s = bruteForce(cs);
		// No tour is shorter than the brute-force best, including the greedy one.
		expect(s.bestLength).toBeLessThanOrEqual(tourLength(cs, nearestNeighbour(cs)) + 1e-12);
		let shortest = Infinity;
		eachTour(n, (t) => (shortest = Math.min(shortest, tourLength(cs, t))));
		expect(s.bestLength).toBeCloseTo(shortest, 12);
	}
});

test('at a billion tours a second: 20 cities take about 2 years, 25 about 10 million', () => {
	expect(bruteForceYears(20)).toBeCloseTo(1.93, 2);
	expect(bruteForceYears(25) / 1e6).toBeCloseTo(9.8, 1);
	// Held–Karp's n² 2ⁿ for 25 cities: about 21 seconds at the same rate.
	expect(heldKarpSteps(25) / 1e9).toBeCloseTo(21, 0);
});
