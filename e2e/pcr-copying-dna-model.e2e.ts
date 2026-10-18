// Checks the PCR page's model: the strands each cycle makes (the piece bounded by both primers
// first appears as a double strand in cycle 3, then dominates), the doubling (thirty perfect
// cycles turn one copy into about a billion), the plateau (set by the primers, the same whatever
// the start), the threshold cycle (a thousand copies cross about ten cycles before one; a
// tenfold dilution adds 3.3 cycles), and the CDC primers, which copy only their own target in the
// real sequences. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	LAYOUT,
	THRESHOLD,
	Tube,
	amplify,
	bestMismatch,
	kindOf,
	primerMolecules,
	primerSites,
	thresholdCycle
} from '../src/routes/pcr-copying-dna/pcr';
import { TARGETS } from '../src/routes/pcr-copying-dna/sequences-data';

test('each cycle doubles the double strands, and the original two strands are never lost', () => {
	const tube = new Tube(LAYOUT);
	for (let c = 1; c <= 6; c++) {
		tube.step();
		expect(tube.duplexes.length).toBe(2 ** c);
		expect(tube.count().original).toBe(2);
	}
});

test('the exact target appears as a double strand only in cycle 3, then dominates', () => {
	const tube = new Tube(LAYOUT);
	tube.step();
	// cycle 1: the two new strands run past the target, to the end of the template
	expect(tube.count().target).toBe(0);
	for (const s of tube.strands())
		if (s.born === 1) expect(s.to - s.from).toBeGreaterThan(LAYOUT.b - LAYOUT.a);
	tube.step();
	// cycle 2: single strands of the target's length exist, but each is paired with a longer one
	expect(tube.count().target).toBeGreaterThan(0);
	expect(tube.targetDuplexes()).toBe(0);
	tube.step();
	expect(tube.targetDuplexes()).toBe(2);
	for (let c = 4; c <= 10; c++) tube.step();
	// after 10 cycles almost every double strand is exactly the target
	expect(tube.targetDuplexes() / tube.duplexes.length).toBeGreaterThan(0.97);
	// the longer pieces grow only by two strands a cycle
	expect(tube.count().long).toBe(20);
	expect(kindOf(tube.duplexes[0].top, LAYOUT)).toBe('original');
});

test('thirty perfect cycles turn one copy into about a billion', () => {
	const run = amplify(1, 30);
	expect(run.copies[30]).toBeGreaterThan(1.0e9);
	expect(run.copies[30]).toBeLessThan(1.1e9);
	// early cycles double almost exactly
	expect(run.copies[10]).toBeCloseTo(1024, 0);
});

test('the curve flattens when the primers run out, at the same level whatever the start', () => {
	const ends = [10, 1000, 100_000].map((n) => amplify(n).copies.at(-1) ?? 0);
	for (const e of ends) expect(Math.abs(e / ends[0] - 1)).toBeLessThan(0.01);
	// the level is the number of primer pairs in the tube (500 nM in 20 µL ≈ 6 × 10¹²)
	expect(ends[0] / primerMolecules()).toBeGreaterThan(0.99);
	const run = amplify(1000);
	expect(run.primers.at(-1)).toBeLessThan(0.01);
	// for a short piece the building blocks are far from used up
	expect(run.nucleotides.at(-1)).toBeGreaterThan(0.9);
	// and the last cycles add almost nothing
	const c = run.copies;
	expect(c[45] / c[44]).toBeLessThan(1.01);
});

test('a thousand copies cross the detection line about ten cycles before one copy', () => {
	const ct = (n: number, e = 1) => thresholdCycle(amplify(n, 45, e)) ?? NaN;
	// 1000 ≈ 2¹⁰
	expect(ct(1) - ct(1000)).toBeCloseTo(Math.log2(1000), 1);
	// each tenfold step adds log₂ 10 ≈ 3.3 cycles while the doubling is perfect
	expect(ct(100) - ct(1000)).toBeCloseTo(3.32, 1);
	// at 90 % per cycle the steps are wider: log 10 / log 1.9 ≈ 3.6
	expect(ct(100, 0.9) - ct(1000, 0.9)).toBeCloseTo(Math.log(10) / Math.log(1.9), 1);
	// with no template there is nothing to cross the line
	expect(thresholdCycle(amplify(0))).toBeNull();
	// one copy crosses 10¹⁰ at log₂ 10¹⁰ ≈ 33 cycles
	expect(ct(1)).toBeCloseTo(Math.log2(THRESHOLD), 1);
});

test('the CDC primers copy their own target and nothing in the other sequence', () => {
	const [n1, rp] = TARGETS;
	const on = (t: (typeof TARGETS)[number], p: (typeof TARGETS)[number]) =>
		primerSites(t.top, p.forward, p.reverse).product;
	const own = on(n1, n1);
	expect(own).not.toBeNull();
	if (own) expect(own[1] - own[0]).toBe(72);
	const rpOwn = on(rp, rp);
	if (rpOwn) expect(rpOwn[1] - rpOwn[0]).toBe(65);
	expect(on(rp, n1)).toBeNull();
	expect(on(n1, rp)).toBeNull();
	// the closest stretch of the other sequence differs in several letters
	expect(bestMismatch(rp.top, n1.forward)).toBeGreaterThan(5);
	expect(bestMismatch(n1.top, rp.forward)).toBeGreaterThan(5);
	// the probe sits inside the copied piece
	if (own) expect(n1.top.slice(own[0], own[1])).toContain(n1.probe);
});
