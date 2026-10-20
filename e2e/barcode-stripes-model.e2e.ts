// UPC-A barcodes: encoding, the check digit, and reading by proportions.
import { expect, test } from '@playwright/test';
import {
	checkDigit,
	encode,
	isValid,
	L_CODES,
	misprint,
	R_CODES,
	read,
	runs,
	slanted,
	smudge,
	sweep
} from '../src/routes/barcode-stripes/model';

// The UPC-A example printed in the GS1 and Wikipedia descriptions: 0 36000 29145 2.
const CODE = [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2];

test('the check digit of 03600029145 is 2', () => {
	expect(checkDigit(CODE.slice(0, 11))).toBe(2);
	expect(isValid(CODE)).toBe(true);
});

test('a code is 95 modules; each digit is two bars and two gaps adding up to 7', () => {
	const m = encode(CODE);
	expect(m).toHaveLength(95);
	for (const c of [...L_CODES, ...R_CODES]) {
		const r = runs(c);
		expect(r).toHaveLength(4);
		expect(r.reduce((a, [, w]) => a + w, 0)).toBe(7);
	}
	// Left codes have an odd number of dark modules, right codes an even number.
	for (const c of L_CODES) expect([...c].filter((b) => b === '1').length % 2).toBe(1);
	for (const c of R_CODES) expect([...c].filter((b) => b === '1').length % 2).toBe(0);
});

test('reading works by proportions: any speed or slant gives the same digits', () => {
	for (const stretch of [0.3, 1, 2.7, 13])
		expect(read(sweep(encode(CODE), { stretch })).digits).toEqual(CODE);
});

test('upside down, the scanner notices and still reads the right number', () => {
	const r = read(sweep(encode(CODE), { reversed: true }));
	expect(r.reversed).toBe(true);
	expect(r.digits).toEqual(CODE);
	expect(r.valid).toBe(true);
});

test('the check digit catches every single wrong digit', () => {
	for (let pos = 0; pos < 12; pos++)
		for (let d = 0; d < 10; d++) {
			if (d === CODE[pos]) continue;
			const wrong = [...CODE];
			wrong[pos] = d;
			expect(isValid(wrong), `position ${pos} -> ${d}`).toBe(false);
		}
});

test('a smudged stripe is caught: either no digit matches, or the check digit fails', () => {
	const m = encode(CODE);
	let caught = 0;
	let tried = 0;
	for (let k = 1; k < runs(m).length - 2; k++) {
		const s = smudge(m, k);
		if (s === m) continue;
		tried++;
		const r = read(sweep(s));
		if (!r.valid) caught++;
	}
	expect(tried).toBeGreaterThan(20);
	expect(caught).toBe(tried);
});

test('a bar printed one column out of place can make another valid digit; only the check digit catches it', () => {
	const m = encode(CODE);
	// The fourth digit, a 0 (widths 3, 2, 1, 1), with its first bar one column to the left
	// becomes widths 2, 2, 2, 1: a perfectly good 1.
	const bad = misprint(m, 3)!;
	expect(bad.reads).toBe(1);
	const r = read(sweep(bad.modules));
	expect(r.digits).toEqual([0, 3, 6, 1, 0, 0, 2, 9, 1, 4, 5, 2]);
	expect(r.valid).toBe(false);
	expect(r.problem).toBe('the check digit does not match');
});

test('moving any single edge of a digit by one column never makes another valid digit', () => {
	for (const codes of [L_CODES, R_CODES])
		codes.forEach((code, d) => {
			const r = runs(code);
			for (let b = 0; b < r.length - 1; b++)
				for (const delta of [1, -1]) {
					const rr = r.map(([dark, w]) => [dark, w] as [boolean, number]);
					rr[b][1] += delta;
					rr[b + 1][1] -= delta;
					if (rr[b][1] < 1 || rr[b + 1][1] < 1) continue;
					const moved = rr.map(([dark, w]) => (dark ? '1' : '0').repeat(w)).join('');
					const other = codes.indexOf(moved);
					expect(other === -1 || other === d).toBe(true);
				}
		});
});

test('moving an edge by two columns can make another digit (a 0 becomes a 3)', () => {
	// Left-hand 0 is 0001101; moving its first gap/bar edge two columns left gives 0111101, a 3.
	expect(L_CODES.indexOf('0111101')).toBe(3);
});

test('a misprint in the right half also moves one whole black bar by one column', () => {
	const m = encode(CODE);
	for (let g = 6; g < 12; g++) {
		const bad = misprint(m, g);
		if (!bad) continue;
		const at = 50 + 7 * (g - 6);
		const before = runs(m.slice(at, at + 7))
			.filter(([dark]) => dark)
			.map(([, w]) => w);
		const after = runs(bad.modules.slice(at, at + 7))
			.filter(([dark]) => dark)
			.map(([, w]) => w);
		// The same black bars, of the same widths: one of them moved.
		expect(after).toEqual(before);
		expect(read(sweep(bad.modules)).valid).toBe(false);
	}
});

test('only 12 digits from 0 to 9 make a code', () => {
	expect(isValid([10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(false);
	expect(() => encode([1, 2, 3])).toThrow();
});

test('a slanted scan stretches every stripe alike, until it runs off the bars', () => {
	const s = slanted(10, 665, 150);
	expect(s.stretch).toBeCloseTo(1 / Math.cos(Math.PI / 18), 12);
	expect(s.crossesAll).toBe(true);
	expect(read(sweep(encode(CODE), { stretch: s.stretch })).digits).toEqual(CODE);
	expect(slanted(20, 665, 150).crossesAll).toBe(false);
});
