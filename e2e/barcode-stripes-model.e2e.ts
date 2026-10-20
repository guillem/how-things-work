// UPC-A barcodes: encoding, the check digit, and reading by proportions.
import { expect, test } from '@playwright/test';
import {
	checkDigit,
	encode,
	isValid,
	L_CODES,
	R_CODES,
	read,
	runs,
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
