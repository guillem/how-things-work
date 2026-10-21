// QR codes: the encoder against the standard's worked examples, and the camera's reader on
// turned, painted and damaged codes.
import { expect, test } from '@playwright/test';
import { rsDecode, rsEncode } from '../src/routes/qr-codes/rs';
import { byteCapacity, encode, formatBits, LEVELS, type QrCode } from '../src/routes/qr-codes/qr';
import { decodeCells } from '../src/routes/qr-codes/camera';
import {
	blot,
	changedPieces,
	coverCorner,
	damage,
	scan,
	specks
} from '../src/routes/qr-codes/model';

const MESSAGE = 'Hello from a QR code';

/** A small seeded generator, so the random damage is the same every run. */
function rng(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

test('spare codewords match the worked examples (ISO 18004 "01234567" and "HELLO WORLD", 1-M)', () => {
	// The standard's annex example: numeric "01234567", version 1-M.
	expect(
		rsEncode([16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17], 10)
	).toEqual([165, 36, 212, 193, 237, 54, 199, 135, 44, 85]);
	// The widely used "HELLO WORLD" tutorial example, alphanumeric, version 1-M.
	expect(
		rsEncode([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10)
	).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('format information matches the standard table', () => {
	expect(formatBits('L', 0).toString(2).padStart(15, '0')).toBe('111011111000100');
	expect(formatBits('M', 0).toString(2).padStart(15, '0')).toBe('101010000010010');
	expect(formatBits('Q', 0).toString(2).padStart(15, '0')).toBe('011010101011111');
	expect(formatBits('H', 0).toString(2).padStart(15, '0')).toBe('001011010001001');
	expect(formatBits('L', 4).toString(2).padStart(15, '0')).toBe('110011000101111');
});

test('how many letters fit: the standard byte-mode capacities, versions 1 to 4', () => {
	const table = {
		L: [17, 32, 53, 78],
		M: [14, 26, 42, 62],
		Q: [11, 20, 32, 46],
		H: [7, 14, 24, 34]
	};
	for (const level of LEVELS)
		expect([1, 2, 3, 4].map((v) => byteCapacity(v, level))).toEqual(table[level]);
});

test('the page’s message makes a 25 × 25 code with 26 message pieces and 16 spare ones', () => {
	const code = encode(MESSAGE, 'M')!;
	expect(code.size).toBe(25);
	expect(code.dataCount).toBe(28);
	expect(code.codewords).toHaveLength(44);
	expect(code.blocks).toEqual([{ data: 28, ec: 16 }]);
	// Three corner squares of 7 × 7 cells, none of them part of a message piece.
	for (const [r0, c0] of [
		[0, 0],
		[0, 18],
		[18, 0]
	])
		for (let r = 0; r < 7; r++)
			for (let c = 0; c < 7; c++) expect(code.piece[(r0 + r) * 25 + c0 + c]).toBe(-1);
});

test('the camera reads codes at every level, any mask, any turn, and UTF-8 text', () => {
	for (const text of [MESSAGE, 'A', 'Café, 3 €', 'abcdefghijklmnopqrstuvwxyz012345'])
		for (const level of LEVELS) {
			const code = encode(text, level)!;
			for (const angle of [0, 17, 90, 137, 180, 251, 315])
				expect(scan(code, new Set(), angle).text, `${text} ${level} ${angle}°`).toBe(text);
		}
	for (let mask = 0; mask < 8; mask++)
		expect(scan(encode(MESSAGE, 'Q', { mask })!).text).toBe(MESSAGE);
});

test('Reed-Solomon repairs up to half the spare codewords in a block, and no more', () => {
	const rand = rng(7);
	const data = Array.from({ length: 28 }, () => Math.floor(rand() * 256));
	const block = [...data, ...rsEncode(data, 16)];
	for (let errors = 0; errors <= 9; errors++)
		for (let trial = 0; trial < 20; trial++) {
			const bad = [...block];
			const where = new Set<number>();
			while (where.size < errors) where.add(Math.floor(rand() * bad.length));
			for (const k of where) bad[k] ^= 1 + Math.floor(rand() * 255);
			const r = rsDecode(bad, 16);
			if (errors <= 8) {
				expect(r.block).toEqual(block);
				expect(r.fixed).toBe(errors);
			} else expect(r.block).not.toEqual(block);
		}
});

/** Flips one cell in each of the given pieces. */
function spoil(code: QrCode, pieces: number[]): boolean[] {
	const cells = [...code.modules];
	for (const w of pieces) {
		const i = code.piece.indexOf(w);
		cells[i] = !cells[i];
	}
	return cells;
}

test('a code reads with up to 8 spoiled pieces (level M, 25 × 25), not with 9', () => {
	const code = encode(MESSAGE, 'M')!;
	const rand = rng(3);
	for (let trial = 0; trial < 20; trial++) {
		const order = [...Array(44).keys()].sort(() => rand() - 0.5);
		expect(decodeCells(spoil(code, order.slice(0, 8)), 25).text).toBe(MESSAGE);
		expect(decodeCells(spoil(code, order.slice(0, 9)), 25).text).not.toBe(MESSAGE);
	}
});

test('specks fail where one blot of as many cells reads: damage is counted in pieces', () => {
	const code = encode(MESSAGE, 'M')!;
	const s = specks(code);
	const b = blot(code, s.size);
	expect(s.size).toBe(9);
	expect(b.size).toBe(9);
	expect(damage(code, s).spoiled).toEqual([9]);
	expect(damage(code, b).spoiled[0]).toBeLessThanOrEqual(4);
	expect(scan(code, s).ok).toBe(false);
	expect(scan(code, b).text).toBe(MESSAGE);
});

test('a patch over a corner square stops the reading, though it touches no message piece', () => {
	const code = encode(MESSAGE, 'M')!;
	const patch = coverCorner(code);
	expect(damage(code, patch).spoiled).toEqual([0]);
	const r = scan(code, patch);
	expect(r.ok).toBe(false);
	expect(r.problem).toBe('it can’t find three corner squares');
	// The same patch in the message area is repaired.
	const elsewhere = blot(code, patch.size);
	expect(scan(code, elsewhere).text).toBe(MESSAGE);
});

test('spare pieces are computed, not copied: one changed letter changes every spare piece', () => {
	const a = encode(MESSAGE, 'M')!;
	const b = encode('Jello from a QR code', 'M', { mask: a.mask })!;
	const changed = changedPieces(a, b);
	const spare = a.pieceBlock.flatMap(([, , s], i) => (s ? [i] : []));
	for (const w of spare) expect(changed).toContain(w);
	// Only one message piece changes (the one holding the first letter, plus none else).
	expect(changed.filter((w) => !a.pieceBlock[w][2]).length).toBeLessThanOrEqual(2);
});

test('higher levels can repair a bigger share of each block, and the code grows', () => {
	const share = LEVELS.map((level) => {
		const code = encode(MESSAGE, level)!;
		const b = code.blocks[0];
		return { size: code.size, share: Math.floor(b.ec / 2) / (b.data + b.ec) };
	});
	expect(share.map((s) => s.size)).toEqual([25, 25, 25, 29]);
	for (let i = 1; i < 4; i++) expect(share[i].share).toBeGreaterThan(share[i - 1].share);
});

test('the mask is chosen by the standard’s penalty score (as the reference generator does)', () => {
	// Nayuki's reference QR generator picks mask 6 for "Meet at 4" at level M.
	expect(encode('Meet at 4', 'M')!.mask).toBe(6);
});

test('text that isn’t plain ASCII is declared as UTF-8 (ECI 26) before the bytes', () => {
	const plain = encode('Hello', 'M')!;
	expect(plain.data[0] >> 4).toBe(0b0100);
	const accented = encode('Café', 'M')!;
	// 0111 (ECI) 00011010 (26 = UTF-8) 0100 (bytes) 00000101 (5 bytes: é is two).
	expect(accented.data.slice(0, 3)).toEqual([0b01110001, 0b10100100, 0b00000101]);
	expect(scan(accented).text).toBe('Café');
});
