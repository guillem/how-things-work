/**
 * A QR code encoder for short messages, following ISO/IEC 18004: byte mode (UTF-8 text),
 * versions 1 to 6 (21 to 41 cells across: the sizes that need no version-information block),
 * the four error-correction levels, Reed-Solomon blocks interleaved, the zigzag placement in
 * two-cell-wide columns, the eight masks chosen by the standard's penalty score, and the
 * BCH-protected format information.
 *
 * Besides the cells, the encoder records what each cell is (a finder square, the timing line,
 * the format information, a message piece or a spare piece) and which codeword ("piece") each
 * message cell belongs to, so that the page can colour them and count spoiled pieces.
 */
import { rsEncode } from './rs';

export type Level = 'L' | 'M' | 'Q' | 'H';
export const LEVELS: readonly Level[] = ['L', 'M', 'Q', 'H'];
export const MAX_VERSION = 6;

/** Error-correction blocks per version and level: [count, total codewords, data codewords] groups. */
const BLOCKS: Record<Level, [number, number, number][]>[] = [
	{ L: [], M: [], Q: [], H: [] },
	{ L: [[1, 26, 19]], M: [[1, 26, 16]], Q: [[1, 26, 13]], H: [[1, 26, 9]] },
	{ L: [[1, 44, 34]], M: [[1, 44, 28]], Q: [[1, 44, 22]], H: [[1, 44, 16]] },
	{ L: [[1, 70, 55]], M: [[1, 70, 44]], Q: [[2, 35, 17]], H: [[2, 35, 13]] },
	{ L: [[1, 100, 80]], M: [[2, 50, 32]], Q: [[2, 50, 24]], H: [[4, 25, 9]] },
	{
		L: [[1, 134, 108]],
		M: [[2, 67, 43]],
		Q: [
			[2, 33, 15],
			[2, 34, 16]
		],
		H: [
			[2, 33, 11],
			[2, 34, 12]
		]
	},
	{ L: [[2, 86, 68]], M: [[4, 43, 27]], Q: [[4, 43, 19]], H: [[4, 43, 15]] }
];

/** Centres of the alignment squares (rows and columns), versions 1 to 6. */
const ALIGN: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

export interface BlockInfo {
	data: number;
	ec: number;
}

export function blocksOf(version: number, level: Level): BlockInfo[] {
	return BLOCKS[version][level].flatMap(([count, total, data]) =>
		Array.from({ length: count }, () => ({ data, ec: total - data }))
	);
}

export const sizeOf = (version: number) => 17 + 4 * version;
export const dataCapacity = (version: number, level: Level) =>
	blocksOf(version, level).reduce((a, b) => a + b.data, 0);
/** Bytes of text a version holds in byte mode at a level (4-bit mode, 8-bit count). */
export const byteCapacity = (version: number, level: Level) =>
	Math.floor((dataCapacity(version, level) * 8 - 12) / 8);

/** What a cell is for. */
export const Kind = {
	None: 0,
	Finder: 1,
	Separator: 2,
	Timing: 3,
	Alignment: 4,
	Format: 5,
	DarkModule: 6,
	Data: 7,
	Spare: 8,
	Remainder: 9
} as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

export interface QrCode {
	text: string;
	level: Level;
	version: number;
	size: number;
	mask: number;
	/** Row-major, true = dark. */
	modules: boolean[];
	/** Row-major kind of every cell. */
	kinds: Kind[];
	/** Row-major index of the codeword ("piece") a cell belongs to, in the order placed; −1 if none. */
	piece: number[];
	/** Row-major index of the bit within the whole placed bit stream; −1 if none. */
	bit: number[];
	/** The placed codewords, data and spare interleaved. */
	codewords: number[];
	/** Number of data codewords (the first `dataCount` placed codewords are not all data: see `pieceBlock`). */
	dataCount: number;
	blocks: BlockInfo[];
	/** For every placed codeword: [block, index in the block, is spare]. */
	pieceBlock: [number, number, boolean][];
	/** The message's data codewords before interleaving (mode, count, bytes, terminator, padding). */
	data: number[];
}

export function utf8(text: string): number[] {
	return [...new TextEncoder().encode(text)];
}

/** The smallest version (1 to 6) that holds the text at the level, or null if none does. */
export function versionFor(text: string, level: Level): number | null {
	const n = utf8(text).length;
	for (let v = 1; v <= MAX_VERSION; v++) if (byteCapacity(v, level) >= n) return v;
	return null;
}

/** Mode indicator 0100 (bytes), an 8-bit count, the bytes, a terminator, then 0xEC 0x11 padding. */
export function dataCodewords(text: string, version: number, level: Level): number[] {
	const bytes = utf8(text);
	const capacity = dataCapacity(version, level);
	const bits: number[] = [];
	const put = (value: number, len: number) => {
		for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
	};
	put(0b0100, 4);
	put(bytes.length, 8);
	for (const b of bytes) put(b, 8);
	put(0, Math.min(4, capacity * 8 - bits.length));
	while (bits.length % 8) bits.push(0);
	const out: number[] = [];
	for (let i = 0; i < bits.length; i += 8)
		out.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
	for (let pad = 0xec; out.length < capacity; pad ^= 0xec ^ 0x11) out.push(pad);
	return out;
}

/** Splits data codewords into blocks, adds each block's spare codewords, and interleaves them. */
export function interleave(data: readonly number[], blocks: readonly BlockInfo[]) {
	const split: number[][] = [];
	let at = 0;
	for (const b of blocks) {
		split.push(data.slice(at, at + b.data));
		at += b.data;
	}
	const ecs = split.map((d, i) => rsEncode(d, blocks[i].ec));
	const codewords: number[] = [];
	const pieceBlock: [number, number, boolean][] = [];
	const maxData = Math.max(...blocks.map((b) => b.data));
	for (let i = 0; i < maxData; i++)
		split.forEach((d, bi) => {
			if (i < d.length) {
				codewords.push(d[i]);
				pieceBlock.push([bi, i, false]);
			}
		});
	const ec = blocks[0].ec;
	for (let i = 0; i < ec; i++)
		ecs.forEach((e, bi) => {
			codewords.push(e[i]);
			pieceBlock.push([bi, split[bi].length + i, true]);
		});
	return { codewords, pieceBlock };
}

const MASKS: ((r: number, c: number) => boolean)[] = [
	(r, c) => (r + c) % 2 === 0,
	(r) => r % 2 === 0,
	(_r, c) => c % 3 === 0,
	(r, c) => (r + c) % 3 === 0,
	(r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
	(r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
	(r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
	(r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];
export const maskAt = (mask: number, r: number, c: number) => MASKS[mask](r, c);

const LEVEL_BITS: Record<Level, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** The 15 format bits for a level and mask: 5 bits, 10 BCH check bits, XOR 101010000010010. */
export function formatBits(level: Level, mask: number): number {
	const data = (LEVEL_BITS[level] << 3) | mask;
	let rem = data;
	for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
	return ((data << 10) | rem) ^ 0x5412;
}

/** All 32 valid format words with their level and mask (for reading). */
export const FORMATS = LEVELS.flatMap((level) =>
	Array.from({ length: 8 }, (_, mask) => ({ level, mask, bits: formatBits(level, mask) }))
);

/**
 * Where the 15 format bits go: the first copy around the top-left finder, the second split
 * between the other two. Each entry is [row, col] for bits 0 (least significant) to 14.
 */
export function formatPositions(size: number): { a: [number, number][]; b: [number, number][] } {
	const a: [number, number][] = [];
	const b: [number, number][] = [];
	for (let i = 0; i <= 5; i++) a.push([i, 8]);
	a.push([7, 8], [8, 8], [8, 7]);
	for (let i = 9; i < 15; i++) a.push([8, 14 - i]);
	for (let i = 0; i < 8; i++) b.push([8, size - 1 - i]);
	for (let i = 8; i < 15; i++) b.push([size - 15 + i, 8]);
	return { a, b };
}

/** The cells every code of this version has in fixed places (finders, timing, format…). */
export function functionKinds(version: number): Kind[] {
	const size = sizeOf(version);
	const kinds = new Array<Kind>(size * size).fill(Kind.None);
	const set = (r: number, c: number, k: Kind) => {
		if (r >= 0 && c >= 0 && r < size && c < size) kinds[r * size + c] = k;
	};
	for (const [fr, fc] of [
		[0, 0],
		[0, size - 7],
		[size - 7, 0]
	]) {
		for (let r = -1; r <= 7; r++)
			for (let c = -1; c <= 7; c++)
				set(fr + r, fc + c, r < 0 || r > 6 || c < 0 || c > 6 ? Kind.Separator : Kind.Finder);
	}
	for (let i = 8; i < size - 8; i++) {
		set(6, i, Kind.Timing);
		set(i, 6, Kind.Timing);
	}
	const al = ALIGN[version];
	for (const r of al)
		for (const c of al) {
			if (kinds[r * size + c] === Kind.Finder || kinds[r * size + c] === Kind.Separator) continue;
			for (let dr = -2; dr <= 2; dr++)
				for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Kind.Alignment);
		}
	const { a, b } = formatPositions(size);
	for (const [r, c] of [...a, ...b]) set(r, c, Kind.Format);
	set(size - 8, 8, Kind.DarkModule);
	return kinds;
}

/** Message cells in placement order: two-cell-wide columns from the right, up then down. */
export function placementOrder(version: number): number[] {
	const size = sizeOf(version);
	const kinds = functionKinds(version);
	const order: number[] = [];
	for (let right = size - 1; right >= 1; right -= 2) {
		if (right === 6) right = 5;
		const upward = ((right + 1) & 2) === 0;
		for (let v = 0; v < size; v++) {
			const r = upward ? size - 1 - v : v;
			for (let j = 0; j < 2; j++) {
				const c = right - j;
				if (kinds[r * size + c] === Kind.None) order.push(r * size + c);
			}
		}
	}
	return order;
}

function finderLike(line: readonly boolean[]): number {
	// The 1:1:3:1:1 finder pattern with four light cells on one side (the standard's rule 3).
	const P = [true, false, true, true, true, false, true];
	let n = 0;
	for (let i = 0; i + 7 <= line.length; i++) {
		if (!P.every((p, k) => line[i + k] === p)) continue;
		const lightBefore = [1, 2, 3, 4].every((k) => i - k < 0 || !line[i - k]);
		const lightAfter = [1, 2, 3, 4].every((k) => i + 6 + k >= line.length || !line[i + 6 + k]);
		if (lightBefore || lightAfter) n++;
	}
	return n;
}

/** The standard's penalty score; the mask with the lowest score is used. */
export function penalty(modules: readonly boolean[], size: number): number {
	let score = 0;
	const at = (r: number, c: number) => modules[r * size + c];
	for (let pass = 0; pass < 2; pass++) {
		for (let i = 0; i < size; i++) {
			const line = Array.from({ length: size }, (_, j) => (pass === 0 ? at(i, j) : at(j, i)));
			let run = 1;
			for (let j = 1; j <= size; j++) {
				if (j < size && line[j] === line[j - 1]) run++;
				else {
					if (run >= 5) score += 3 + (run - 5);
					run = 1;
				}
			}
			score += 40 * finderLike(line);
		}
	}
	for (let r = 0; r < size - 1; r++)
		for (let c = 0; c < size - 1; c++) {
			const v = at(r, c);
			if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
		}
	const dark = modules.filter(Boolean).length;
	score += 10 * Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5);
	return score;
}

/** Encodes the text; `mask` forces a mask instead of choosing the best. Null if it doesn't fit. */
export function encode(
	text: string,
	level: Level = 'M',
	opts: { mask?: number; version?: number } = {}
): QrCode | null {
	const version = opts.version ?? versionFor(text, level);
	if (version === null || byteCapacity(version, level) < utf8(text).length) return null;
	const size = sizeOf(version);
	const blocks = blocksOf(version, level);
	const data = dataCodewords(text, version, level);
	const { codewords, pieceBlock } = interleave(data, blocks);
	const kinds = functionKinds(version);
	const order = placementOrder(version);
	const piece = new Array<number>(size * size).fill(-1);
	const bit = new Array<number>(size * size).fill(-1);
	const raw = new Array<boolean>(size * size).fill(false);
	order.forEach((cell, i) => {
		const w = i >> 3;
		if (w < codewords.length) {
			piece[cell] = w;
			bit[cell] = i;
			raw[cell] = ((codewords[w] >>> (7 - (i & 7))) & 1) === 1;
			kinds[cell] = pieceBlock[w][2] ? Kind.Spare : Kind.Data;
		} else kinds[cell] = Kind.Remainder;
	});
	// Finders, timing, alignment and the dark module.
	const fixed = new Array<boolean>(size * size).fill(false);
	for (let r = 0; r < size; r++)
		for (let c = 0; c < size; c++) {
			const k = kinds[r * size + c];
			if (k === Kind.Finder) {
				const fr = r < 7 ? r : r - (size - 7);
				const fc = c < 7 ? c : c - (size - 7);
				const ring = Math.max(Math.abs(fr - 3), Math.abs(fc - 3));
				fixed[r * size + c] = ring !== 2;
			} else if (k === Kind.Timing) fixed[r * size + c] = (r + c) % 2 === 0;
			else if (k === Kind.Alignment) {
				const al = ALIGN[version];
				const cr = al.reduce((best, a) => (Math.abs(a - r) < Math.abs(best - r) ? a : best));
				const cc = al.reduce((best, a) => (Math.abs(a - c) < Math.abs(best - c) ? a : best));
				const ring = Math.max(Math.abs(r - cr), Math.abs(c - cc));
				fixed[r * size + c] = ring !== 1;
			} else if (k === Kind.DarkModule) fixed[r * size + c] = true;
		}
	const isMessage = (k: Kind) => k === Kind.Data || k === Kind.Spare || k === Kind.Remainder;
	const build = (mask: number) => {
		const m = fixed.slice();
		for (let r = 0; r < size; r++)
			for (let c = 0; c < size; c++) {
				const i = r * size + c;
				if (isMessage(kinds[i])) m[i] = raw[i] !== maskAt(mask, r, c);
			}
		const f = formatBits(level, mask);
		const { a, b } = formatPositions(size);
		for (let k = 0; k < 15; k++) {
			const on = ((f >>> k) & 1) === 1;
			m[a[k][0] * size + a[k][1]] = on;
			m[b[k][0] * size + b[k][1]] = on;
		}
		return m;
	};
	let mask = opts.mask ?? 0;
	let modules = build(mask);
	if (opts.mask === undefined) {
		let best = penalty(modules, size);
		for (let k = 1; k < 8; k++) {
			const m = build(k);
			const p = penalty(m, size);
			if (p < best) {
				best = p;
				mask = k;
				modules = m;
			}
		}
	}
	return {
		text,
		level,
		version,
		size,
		mask,
		modules,
		kinds,
		piece,
		bit,
		codewords,
		dataCount: data.length,
		blocks,
		pieceBlock,
		data
	};
}
