// Elementary cellular automata: the rule table, the rule space, rule 90, rule 30, rule 184.
import { expect, test } from '@playwright/test';
import {
	evolve,
	family,
	live,
	outcome,
	randomRow,
	settle,
	singleCell,
	trafficSpeed
} from '../src/routes/cellular-automata/model';

test('the rule number is its lookup table: rule 30 = 00011110 for 111 ... 000', () => {
	const table = [7, 6, 5, 4, 3, 2, 1, 0].map((k) => outcome(30, (k >> 2) & 1, (k >> 1) & 1, k & 1));
	expect(table.join('')).toBe('00011110');
});

test('rule 90 from one cell draws Pascal’s triangle mod 2 (a Sierpinski triangle)', () => {
	const W = 129;
	const rows = evolve(90, singleCell(W), 63);
	const mid = Math.floor(W / 2);
	// Binomial coefficients mod 2: C(t, k) is odd exactly when k & (t - k) === 0.
	for (let t = 0; t < rows.length; t++)
		for (let x = mid - t; x <= mid + t; x += 2) {
			const k = (x - (mid - t)) / 2;
			expect(rows[t][x], `t=${t} k=${k}`).toBe((k & (t - k)) === 0 ? 1 : 0);
		}
	// Row 63 (binary 111111) is all odd: 64 live cells.
	expect(live(rows[63])).toBe(64);
});

test('rule 30 is deterministic: the same start gives the same pattern, and its centre never settles', () => {
	const a = evolve(30, singleCell(401), 200);
	const b = evolve(30, singleCell(401), 200);
	expect(a.map((r) => r.join(''))).toEqual(b.map((r) => r.join('')));
	const centre = a.map((r) => r[200]).join('');
	// No period shows up in the centre column over these generations.
	for (let p = 1; p <= 50; p++)
		expect(centre.slice(100, 150)).not.toBe(centre.slice(100 + p, 150 + p));
});

test('the 256 rules fall into 88 families of mirror images and colour swaps', () => {
	const families = new Set(Array.from({ length: 256 }, (_, r) => family(r)[0]));
	expect(families.size).toBe(88);
	expect(family(110)).toEqual([110, 124, 137, 193]);
});

test('on a random ring: rule 0 dies out, rule 4 freezes, rule 170 shifts, rules 30 and 90 keep changing', () => {
	expect(settle(0).behaviour).toBe('uniform');
	expect(settle(4)).toMatchObject({ behaviour: 'repeats', period: 1 });
	expect(settle(170)).toMatchObject({ behaviour: 'repeats', period: 61 });
	expect(settle(30).behaviour).toBe('keeps changing');
	expect(settle(90).behaviour).toBe('keeps changing');
});

test('most rules die out or repeat: fewer than a quarter keep changing', () => {
	const kinds = Array.from({ length: 256 }, (_, r) => settle(r).behaviour);
	const changing = kinds.filter((k) => k === 'keeps changing').length;
	expect(changing).toBeGreaterThan(10);
	expect(changing).toBeLessThan(64);
});

test('rule 184 conserves cars', () => {
	const rows = evolve(184, randomRow(200, 0.4, 5), 100);
	for (const r of rows) expect(live(r)).toBe(live(rows[0]));
});

test('rule 184 traffic flows freely below half full and jams above: speed (1 - d) / d', () => {
	expect(trafficSpeed(0.3)).toBeCloseTo(1, 2);
	expect(trafficSpeed(0.45)).toBeCloseTo(1, 1);
	for (const d of [0.6, 0.75, 0.9]) expect(trafficSpeed(d)).toBeCloseTo((1 - d) / d, 1);
});
