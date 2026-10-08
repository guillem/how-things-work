// Checks the Hamming code and the noisy channel behind the error-correction explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	blockOk,
	charOkCoded,
	charOkPlain,
	covered,
	decode,
	decodeSecded,
	distance,
	encode,
	encodeSecded,
	nibbles,
	parityOk,
	sendCoded,
	sendPlain,
	syndrome,
	withParity,
	xor
} from '../src/routes/error-correction/hamming';

const flipAt = (n: number, ...pos: number[]) =>
	Array.from({ length: n }, (_, i) => (pos.includes(i + 1) ? 1 : 0));
const s = (b: number[]) => b.join('');

test('the (7, 4) layout: checks at 1, 2, 4 and what they cover', () => {
	expect(covered(1)).toEqual([1, 3, 5, 7]);
	expect(covered(2)).toEqual([2, 3, 6, 7]);
	expect(covered(4)).toEqual([4, 5, 6, 7]);
	// the narrative's example: message 1011 → 0110011
	expect(s(encode([1, 0, 1, 1]))).toBe('0110011');
	expect(s(encode([0, 0, 0, 0]))).toBe('0000000');
	expect(s(encode([1, 1, 1, 1]))).toBe('1111111');
});

test('16 codewords, all at least 3 flips apart, and the code is perfect', () => {
	const words = nibbles().map(encode);
	let dmin = 99;
	for (let i = 0; i < 16; i++)
		for (let j = i + 1; j < 16; j++) dmin = Math.min(dmin, distance(words[i], words[j]));
	expect(dmin).toBe(3);
	// every one of the 128 seven-bit words is within one flip of exactly one codeword
	for (let v = 0; v < 128; v++) {
		const w = [6, 5, 4, 3, 2, 1, 0].map((i) => (v >> i) & 1);
		expect(words.filter((c) => distance(c, w) <= 1).length).toBe(1);
	}
	expect(16 * 8).toBe(2 ** 7);
});

test('any single flip is located by the syndrome and repaired', () => {
	for (const d of nibbles()) {
		const c = encode(d);
		expect(syndrome(c)).toBe(0);
		for (let p = 1; p <= 7; p++) {
			const r = decode(xor(c, flipAt(7, p)));
			expect(r.position).toBe(p);
			expect(r.data).toEqual(d);
		}
	}
	// the example: flipping position 5 fails checks 1 and 4: 1 + 4 = 5 = 101 in binary
	const r = xor(encode([1, 0, 1, 1]), flipAt(7, 5));
	expect(syndrome(r)).toBe(5);
});

test('any double flip is "repaired" at the wrong place and gives wrong data', () => {
	for (const d of nibbles()) {
		const c = encode(d);
		for (let a = 1; a <= 7; a++)
			for (let b = a + 1; b <= 7; b++) {
				const r = decode(xor(c, flipAt(7, a, b)));
				expect(r.position).toBe(a ^ b);
				expect(r.position).not.toBe(a);
				expect(r.position).not.toBe(b);
				expect(r.data).not.toEqual(d);
			}
	}
	// the narrative's example: flips at 3 and 5 → syndrome 6, message 1011 decoded as 0101
	const r = decode(xor(encode([1, 0, 1, 1]), flipAt(7, 3, 5)));
	expect(r.position).toBe(6);
	expect(s(r.data)).toBe('0101');
});

test('a single parity bit detects one flip but misses two', () => {
	const w = withParity([1, 0, 1, 1]);
	expect(s(w)).toBe('10111');
	for (let a = 1; a <= 5; a++) {
		expect(parityOk(xor(w, flipAt(5, a)))).toBe(false);
		for (let b = a + 1; b <= 5; b++) expect(parityOk(xor(w, flipAt(5, a, b)))).toBe(true);
	}
});

test('extended (8, 4) code corrects one flip and detects two', () => {
	for (const d of nibbles()) {
		const c = encodeSecded(d);
		expect(decodeSecded(c)).toEqual({ status: 'ok', data: d });
		for (let a = 1; a <= 8; a++) {
			expect(decodeSecded(xor(c, flipAt(8, a)))).toEqual({ status: 'corrected', data: d });
			for (let b = a + 1; b <= 8; b++)
				expect(decodeSecded(xor(c, flipAt(8, a, b))).status).toBe('double');
		}
	}
});

test('longer Hamming codes: (15, 11) corrects any single flip', () => {
	const d = [1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1];
	const c = encode(d);
	expect(c.length).toBe(15);
	for (let p = 1; p <= 15; p++) expect(decode(xor(c, flipAt(15, p))).data).toEqual(d);
});

test('the odds quoted in the text', () => {
	// limiting cases
	expect(charOkPlain(0)).toBe(1);
	expect(charOkCoded(0)).toBe(1);
	expect(blockOk(0.5)).toBeCloseTo(1 / 16, 12);
	expect((1 - 0.5) ** 4).toBeCloseTo(blockOk(0.5), 12);
	// coding helps at every noise level below 50 %
	for (let p = 0.005; p < 0.5; p += 0.005) expect(blockOk(p)).toBeGreaterThan((1 - p) ** 4);
	// 1 % noise: 92 % of letters intact without coding, 99.6 % with
	expect(charOkPlain(0.01)).toBeCloseTo(0.923, 3);
	expect(charOkCoded(0.01)).toBeCloseTo(0.996, 3);
	// 5 % noise: about two letters in three without coding, 91 % with
	expect(charOkPlain(0.05)).toBeCloseTo(0.663, 3);
	expect(charOkCoded(0.05)).toBeCloseTo(0.913, 3);
	// 20 % noise: 17 % vs 33 %
	expect(charOkPlain(0.2)).toBeCloseTo(0.168, 3);
	expect(charOkCoded(0.2)).toBeCloseTo(0.333, 3);
	// cost: 7 bits sent for every 4 → 75 % more; (15, 11): 36 % more
	expect(7 / 4 - 1).toBe(0.75);
	expect(Math.round((15 / 11 - 1) * 100)).toBe(36);
	// ECC memory: 64 data bits need 7 check bits (2⁷ ≥ 64 + 7 + 1), plus one for double detection = 72
	const checkBitsFor = (k: number) => {
		let r = 1;
		while (2 ** r < k + r + 1) r++;
		return r;
	};
	expect(checkBitsFor(64)).toBe(7);
	expect(checkBitsFor(4)).toBe(3);
	expect(checkBitsFor(11)).toBe(4);
});

test('the channel: same dice, more noise only adds flips; decoding fails only on 2+ flips in a block', () => {
	const msg = 'GREETINGS FROM SATURN.';
	const a = sendPlain(msg, 0.03, 7);
	const b = sendPlain(msg, 0.1, 7);
	expect(a.sent).toBe(msg.length * 8);
	for (const f of a.flips) expect(b.flips).toContain(f);
	expect(sendPlain(msg, 0, 7).text).toBe(msg);
	expect(sendCoded(msg, 0, 7).text).toBe(msg);
	const c = sendCoded(msg, 0.08, 11);
	expect(c.sent).toBe(msg.length * 14);
	expect(c.repaired.length + c.failed.length).toBe(c.flips.length);
	// a character is wrong exactly when one of its two blocks had 2+ flips
	const bad = new Set(c.failed.map((i) => Math.floor(i / 14)));
	c.intact.forEach((ok, i) => expect(ok).toBe(!bad.has(i)));
	// the plain lane: a character is wrong exactly when one of its bits flipped
	const badPlain = new Set(b.flips.map((i) => Math.floor(i / 8)));
	b.intact.forEach((ok, i) => expect(ok).toBe(!badPlain.has(i)));
});

test('over many characters the channel matches the odds', () => {
	const msg = 'A'.repeat(20000);
	const p = 0.05;
	const plain = sendPlain(msg, p, 3).intact.filter(Boolean).length / msg.length;
	const coded = sendCoded(msg, p, 4).intact.filter(Boolean).length / msg.length;
	expect(Math.abs(plain - charOkPlain(p))).toBeLessThan(0.015);
	expect(Math.abs(coded - charOkCoded(p))).toBeLessThan(0.01);
});
