/**
 * The page's model: a real QR code for the reader's message (`qr.ts`), paint on its cells, and
 * the phone's camera and decoder reading the result (`camera.ts`). Paint is dark ink: a painted
 * cell looks dark to the camera, whatever it was.
 */
import { decodePicture, photograph, type Reading } from './camera';
import { encode, Kind, type Level, type QrCode } from './qr';

export { encode, LEVELS, type Level, type QrCode, Kind, versionFor, byteCapacity } from './qr';
export { decodeCells, type Reading } from './camera';

/** The longest message the page accepts, in bytes of UTF-8 (fits version 4 even at level H). */
export const MAX_BYTES = 32;

/** The cells as the camera sees them: painted cells are dark. */
export function painted(code: QrCode, paint: ReadonlySet<number>): boolean[] {
	return code.modules.map((m, i) => m || paint.has(i));
}

/** Points the phone at the (painted) code, turned by `angle` degrees, and reads it. */
export function scan(code: QrCode, paint: ReadonlySet<number> = new Set(), angle = 0): Reading {
	return decodePicture(photograph(painted(code, paint), code.size, angle));
}

export interface Damage {
	/** Cells under paint. */
	covered: number;
	/** Cells whose colour the paint changed (light cells painted dark). */
	changed: number;
	/** Pieces (codewords) with at least one changed cell, per block. */
	spoiled: number[];
	/** Pieces each block can repair: half its spare pieces. */
	fixable: number[];
	/** Changed cells in the corner squares, the format cells and the timing lines. */
	structure: number;
}

/** Counts the damage: cells covered, cells changed, and spoiled pieces in each block. */
export function damage(code: QrCode, paint: ReadonlySet<number>): Damage {
	const spoiledPieces = new Set<number>();
	let changed = 0;
	let structure = 0;
	for (const i of paint) {
		if (code.modules[i]) continue;
		changed++;
		if (code.piece[i] >= 0) spoiledPieces.add(code.piece[i]);
		else if (code.kinds[i] !== Kind.Remainder) structure++;
	}
	const spoiled = code.blocks.map(() => 0);
	for (const w of spoiledPieces) spoiled[code.pieceBlock[w][0]]++;
	return {
		covered: paint.size,
		changed,
		spoiled,
		fixable: code.blocks.map((b) => Math.floor(b.ec / 2)),
		structure
	};
}

/** Cells whose centres lie within `radius` cells of (row, col) (a round brush). */
export function brush(code: QrCode, row: number, col: number, radius = 1.1): number[] {
	const out: number[] = [];
	for (let r = Math.floor(row - radius); r <= Math.ceil(row + radius); r++)
		for (let c = Math.floor(col - radius); c <= Math.ceil(col + radius); c++) {
			if (r < 0 || c < 0 || r >= code.size || c >= code.size) continue;
			if (Math.hypot(r + 0.5 - row, c + 0.5 - col) <= radius) out.push(r * code.size + c);
		}
	return out;
}

/**
 * Scattered specks: one light cell in each of just enough pieces of the first block to spoil it
 * beyond repair (half its spare pieces, plus one), spread through the block.
 */
export function specks(code: QrCode): Set<number> {
	const need = Math.floor(code.blocks[0].ec / 2) + 1;
	const pieces = code.pieceBlock.flatMap(([b], w) => (b === 0 ? [w] : []));
	const out = new Set<number>();
	const step = pieces.length / need;
	for (let k = 0; k < need; k++) {
		// From the chosen place onward, the first piece with a light cell.
		for (let j = Math.floor(k * step); j < pieces.length; j++) {
			const w = pieces[j];
			const cell = code.piece.findIndex((p, i) => p === w && !code.modules[i]);
			if (cell >= 0 && ![...out].some((o) => code.piece[o] === w)) {
				out.add(cell);
				break;
			}
		}
	}
	return out;
}

/**
 * One blot of the same number of cells as `count`, in a corner of the message area: the
 * roundest patch of message cells with the fewest spoiled pieces, nearest the bottom-right.
 */
export function blot(code: QrCode, count: number): Set<number> {
	const n = code.size;
	const isMsg = (i: number) => code.piece[i] >= 0 || code.kinds[i] === Kind.Remainder;
	let best: { cells: number[]; score: number } | null = null;
	for (let r0 = 0; r0 < n; r0++)
		for (let c0 = 0; c0 < n; c0++) {
			// Grow a patch from (r0, c0) by distance, keeping only message cells.
			const cand: [number, number][] = [];
			const reach = Math.ceil(Math.sqrt(count)) + 1;
			for (let r = r0 - reach; r <= r0 + reach; r++)
				for (let c = c0 - reach; c <= c0 + reach; c++) {
					if (r < 0 || c < 0 || r >= n || c >= n) continue;
					cand.push([r * n + c, Math.hypot(r - r0, c - c0)]);
				}
			cand.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
			const cells = cand.slice(0, count).map(([i]) => i);
			if (cells.length < count || !cells.every(isMsg)) continue;
			const d = damage(code, new Set(cells));
			const worst = Math.max(...d.spoiled.map((s, b) => s - d.fixable[b]));
			// Fewest spoiled pieces first; then nearest the bottom-right corner.
			const score = worst * 1000 - (r0 + c0);
			if (!best || score < best.score) best = { cells, score };
		}
	return new Set(best?.cells ?? []);
}

/** A patch of paint over the middle of the top-left corner square (rows 2–4, columns 1–5). */
export function coverCorner(code: QrCode): Set<number> {
	const out = new Set<number>();
	for (let r = 2; r <= 4; r++) for (let c = 1; c <= 5; c++) out.add(r * code.size + c);
	return out;
}

/** The pieces whose value differs between two codes of the same size (spare pieces only if `spare`). */
export function changedPieces(a: QrCode, b: QrCode): number[] {
	return a.codewords.flatMap((w, i) => (w !== b.codewords[i] ? [i] : []));
}

/** Encodes with a fallback: null when the text is too long for the page. */
export function codeFor(text: string, level: Level): QrCode | null {
	return encode(text, level);
}
