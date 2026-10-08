// Checks the bit readings behind the binary explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	add,
	bytes,
	char,
	colour,
	float,
	float16Bits,
	float32Bits,
	hex,
	parseBits,
	signed,
	toBits,
	unsigned
} from '../src/routes/binary/binary';

const b = (s: string) => [...s.replace(/ /g, '')].map(Number);

test('unsigned and signed whole numbers', () => {
	expect(unsigned(b('0100 0001'))).toBe(65);
	expect(unsigned(b('1111 1111'))).toBe(255);
	expect(signed(b('1111 1111'))).toBe(-1);
	expect(signed(b('1000 0000'))).toBe(-128);
	expect(signed(b('0111 1111'))).toBe(127);
	expect(signed(b('1100 1000'))).toBe(-56);
	expect(unsigned(b('1100 1000'))).toBe(200);
	for (let v = -128; v < 128; v++) expect(signed(toBits(v, 8))).toBe(v);
	expect(signed(toBits(-1, 32))).toBe(-1);
	expect(unsigned(toBits(-1, 32))).toBe(2 ** 32 - 1);
	expect(hex(b('1100 1000'))).toBe('C8');
});

test('text: ASCII and Latin-1', () => {
	expect(char(65)).toEqual({ text: 'A', kind: 'printable' });
	expect(char(97).text).toBe('a');
	expect(char(48).text).toBe('0');
	expect(char(10)).toEqual({ text: 'LF', kind: 'control' });
	expect(char(32).kind).toBe('space');
	expect(char(233).text).toBe('é');
	expect(
		bytes(b('0100 1000 0110 1001'))
			.map((x) => char(x).text)
			.join('')
	).toBe('Hi');
});

test('colours: 3-3-2, 5-6-5 and 8-8-8-8', () => {
	expect(colour(b('1110 0000'))).toMatchObject({ r: 255, g: 0, b: 0 });
	expect(colour(b('0000 0011'))).toMatchObject({ r: 0, g: 0, b: 255 });
	expect(colour(b('1111 1111'))).toMatchObject({ r: 255, g: 255, b: 255 });
	expect(colour(toBits(0x07e0, 16))).toMatchObject({ r: 0, g: 255, b: 0 });
	expect(colour(toBits(0xff8000ff, 32))).toMatchObject({ r: 255, g: 128, b: 0, a: 1 });
});

test('floating point agrees with the hardware (32-bit) and the IEEE half format (16-bit)', () => {
	for (const x of [1, -2, 0.5, 0.1, 3.14159, 1e-40, 6.5e4, -0]) {
		const r = float(float32Bits(x))!;
		expect(r.value).toBe(Math.fround(x));
	}
	expect(float(float32Bits(1))).toMatchObject({
		sign: 0,
		exponent: 0,
		exponentBits: 127,
		kind: 'normal'
	});
	expect(float(float32Bits(Infinity))!.kind).toBe('infinity');
	expect(float(float32Bits(NaN))!.kind).toBe('nan');
	expect(float(float32Bits(1e-40))!.kind).toBe('subnormal');
	// Half precision: 1.0 = 0x3C00, the largest is 65504, the smallest positive 2^-24.
	expect(hex(float16Bits(1))).toBe('3C00');
	expect(float(toBits(0x7bff, 16))!.value).toBe(65504);
	expect(float(toBits(0x0001, 16))!.value).toBe(2 ** -24);
	expect(float(toBits(0xc000, 16))!.value).toBe(-2);
	expect(float(float16Bits(0.1))!.value).toBeCloseTo(0.0999755859375, 15);
	expect(float(b('0000 0001'))).toBeNull();
});

test('0.1 cannot be stored exactly', () => {
	const r = float(float32Bits(0.1))!;
	expect(r.value).not.toBe(0.1);
	expect(Math.abs(r.value - 0.1)).toBeLessThan(2e-9);
});

test('adding with carries, and the two kinds of overflow', () => {
	const s = add(toBits(5, 8), toBits(3, 8));
	expect(unsigned(s.bits)).toBe(8);
	expect(s.carries.slice(5, 8)).toEqual([1, 1, 0]); // carries into the three right-hand columns
	expect(s.unsignedOverflow).toBe(false);
	const u = add(toBits(200, 8), toBits(100, 8));
	expect(unsigned(u.bits)).toBe(44); // 300 − 256
	expect(u.unsignedOverflow).toBe(true);
	const v = add(toBits(100, 8), toBits(100, 8));
	expect(signed(v.bits)).toBe(-56);
	expect(v.signedOverflow).toBe(true);
	expect(v.unsignedOverflow).toBe(false); // 200 fits as unsigned
	const w = add(toBits(-1, 8), toBits(1, 8));
	expect(unsigned(w.bits)).toBe(0);
	expect(w.unsignedOverflow).toBe(true);
	expect(w.signedOverflow).toBe(false); // −1 + 1 = 0 is fine as signed
	for (let x = -128; x < 128; x += 7)
		for (let y = -128; y < 128; y += 11) {
			const r = add(toBits(x, 8), toBits(y, 8));
			expect(r.signedOverflow).toBe(x + y < -128 || x + y > 127);
			if (!r.signedOverflow) expect(signed(r.bits)).toBe(x + y);
		}
});

test('the text form', () => {
	expect(parseBits('01000001')).toEqual(b('01000001'));
	expect(parseBits('0102')).toBeNull();
	expect(parseBits('0101', 8)).toBeNull();
});
