/**
 * The phone's camera and decoder. The camera takes a picture: the code's cells (with any paint
 * on them) drawn as dark and light pixels, turned by any angle, with a light margin around. The
 * decoder then works the way real readers do (it follows ZXing's method, without the perspective
 * correction a slanted photo would need):
 *
 * 1. look along every row of pixels for dark-light-dark-light-dark runs in the proportions
 *    1:1:3:1:1, check the same proportions up and down and across through the middle, and keep
 *    the places found more than once: those are the three corner squares;
 * 2. the corner square that sits at the right angle is the top-left; which of the other two
 *    is top-right follows from the turn, so the code's size and orientation are known;
 * 3. read every cell at its centre, read the format information (level and mask, two copies,
 *    each repairable), undo the mask, collect the pieces in placement order, un-interleave them
 *    into blocks, repair each block with Reed-Solomon, and read the text.
 */
import { rsDecode } from './rs';
import {
	blocksOf,
	FORMATS,
	formatPositions,
	functionKinds,
	Kind,
	maskAt,
	placementOrder,
	sizeOf,
	type Level
} from './qr';

export interface Picture {
	width: number;
	height: number;
	/** Row-major, 1 = dark. */
	px: Uint8Array;
}

/** Pixels per cell in the camera's picture. */
export const PX = 6;
/** Light cells of margin around the code (the standard's quiet zone). */
export const QUIET = 4;

/** Takes the camera's picture of a code (row-major dark cells, size × size) turned by `angle` degrees. */
export function photograph(cells: readonly boolean[], size: number, angle = 0): Picture {
	const half = ((size + 2 * QUIET) * PX) / 2;
	const a = (angle * Math.PI) / 180;
	const cos = Math.cos(a);
	const sin = Math.sin(a);
	const reach = Math.ceil(half * (Math.abs(cos) + Math.abs(sin)));
	const width = 2 * reach;
	const height = width;
	const px = new Uint8Array(width * height);
	const mid = size / 2;
	for (let y = 0; y < height; y++) {
		const dy = y + 0.5 - reach;
		for (let x = 0; x < width; x++) {
			const dx = x + 0.5 - reach;
			// Turn the pixel back by the angle to find which cell it shows.
			const u = (cos * dx + sin * dy) / PX + mid;
			const v = (-sin * dx + cos * dy) / PX + mid;
			if (u < 0 || v < 0 || u >= size || v >= size) continue;
			if (cells[Math.floor(v) * size + Math.floor(u)]) px[y * width + x] = 1;
		}
	}
	return { width, height, px };
}

export interface Point {
	x: number;
	y: number;
}

export interface Finder extends Point {
	/** Estimated width of one cell, in pixels. */
	cell: number;
	/** How many row scans found it. */
	count: number;
}

function ratioOk(counts: readonly number[]): boolean {
	const total = counts.reduce((a, b) => a + b, 0);
	if (total < 7 || counts.some((c) => c === 0)) return false;
	const cell = total / 7;
	const v = cell / 2;
	return (
		Math.abs(cell - counts[0]) < v &&
		Math.abs(cell - counts[1]) < v &&
		Math.abs(3 * cell - counts[2]) < 3 * v &&
		Math.abs(cell - counts[3]) < v &&
		Math.abs(cell - counts[4]) < v
	);
}

/**
 * Checks the 1:1:3:1:1 proportions along a line through (x, y) in direction (dx, dy); returns how
 * far along that line the middle of the dark centre is, or null.
 */
function crossCheck(
	p: Picture,
	x: number,
	y: number,
	dx: number,
	dy: number
): { at: number; total: number } | null {
	const at = (k: number) => {
		const xx = Math.round(x + k * dx);
		const yy = Math.round(y + k * dy);
		if (xx < 0 || yy < 0 || xx >= p.width || yy >= p.height) return -1;
		return p.px[yy * p.width + xx];
	};
	if (at(0) !== 1) return null;
	const c = [0, 0, 0, 0, 0];
	// Backwards from the centre: the middle dark run, the light ring, the dark border.
	let k = 0;
	while (at(k) === 1) {
		c[2]++;
		k--;
	}
	const lo = k + 1;
	while (at(k) === 0) {
		c[1]++;
		k--;
	}
	while (at(k) === 1) {
		c[0]++;
		k--;
	}
	// Forwards.
	k = 1;
	while (at(k) === 1) {
		c[2]++;
		k++;
	}
	const hi = k - 1;
	while (at(k) === 0) {
		c[3]++;
		k++;
	}
	while (at(k) === 1) {
		c[4]++;
		k++;
	}
	if (!ratioOk(c)) return null;
	// The middle of the dark centre, relative to (x, y), in steps along (dx, dy).
	return { at: (lo + hi) / 2, total: c.reduce((a, b) => a + b, 0) };
}

/** Finds the corner squares in the picture. */
export function findFinders(p: Picture): Finder[] {
	const found: Finder[] = [];
	const add = (x: number, y: number, cell: number) => {
		for (const f of found) {
			if (Math.hypot(f.x - x, f.y - y) < Math.max(cell, f.cell) * 2) {
				const n = f.count;
				f.x = (f.x * n + x) / (n + 1);
				f.y = (f.y * n + y) / (n + 1);
				f.cell = (f.cell * n + cell) / (n + 1);
				f.count = n + 1;
				return;
			}
		}
		found.push({ x, y, cell, count: 1 });
	};
	for (let y = 0; y < p.height; y++) {
		// The row as runs of one colour: [dark?, length, end].
		const row = y * p.width;
		const runs: [boolean, number, number][] = [];
		for (let x = 0; x < p.width; x++) {
			const dark = p.px[row + x] === 1;
			const last = runs[runs.length - 1];
			if (last && last[0] === dark) {
				last[1]++;
				last[2] = x + 1;
			} else runs.push([dark, 1, x + 1]);
		}
		for (let i = 0; i + 5 <= runs.length; i++) {
			if (!runs[i][0]) continue;
			const c = runs.slice(i, i + 5).map((r) => r[1]);
			if (!ratioOk(c)) continue;
			const cx = runs[i + 2][2] - c[2] / 2 - 0.5;
			const vy = crossCheck(p, cx, y, 0, 1);
			if (vy === null) continue;
			const cy = y + vy.at;
			const hx = crossCheck(p, cx, cy, 1, 0);
			if (hx !== null) add(cx + hx.at, cy, c.reduce((a, b) => a + b, 0) / 7);
		}
	}
	// Only places confirmed by at least two rows count.
	return found.filter((f) => f.count >= 2);
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export interface Reading {
	ok: boolean;
	text: string | null;
	/** Why it failed, in plain words. */
	problem: string | null;
	/** The corner squares found, in picture pixels. */
	finders: Finder[];
	level: Level | null;
	mask: number | null;
	version: number | null;
	/** Pieces repaired in each block (when every block could be repaired). */
	fixed: number[];
	/** The cells as read (after the camera; before un-masking), when the code was located. */
	cells: boolean[] | null;
}

const fail = (problem: string, finders: Finder[] = [], extra: Partial<Reading> = {}): Reading => ({
	ok: false,
	text: null,
	problem,
	finders,
	level: null,
	mask: null,
	version: null,
	fixed: [],
	cells: null,
	...extra
});

/** Reads a picture the way a phone's QR reader does. */
export function decodePicture(p: Picture): Reading {
	const all = findFinders(p);
	if (all.length < 3) return fail('it can’t find three corner squares', all);
	// Of the candidates, take the three most-confirmed with similar cell sizes.
	const sorted = [...all].sort((a, b) => b.count - a.count);
	let trio: Finder[] | null = null;
	outer: for (let i = 0; i < sorted.length; i++)
		for (let j = i + 1; j < sorted.length; j++)
			for (let k = j + 1; k < sorted.length; k++) {
				const t = [sorted[i], sorted[j], sorted[k]];
				const cells = t.map((f) => f.cell);
				if (Math.max(...cells) / Math.min(...cells) > 1.4) continue;
				// They must make a right-angled, two-equal-sides triangle.
				const [d01, d02, d12] = [dist(t[0], t[1]), dist(t[0], t[2]), dist(t[1], t[2])];
				const sides = [d01, d02, d12].sort((a, b) => a - b);
				if (Math.abs(sides[0] - sides[1]) > 0.1 * sides[1]) continue;
				if (Math.abs(sides[2] - Math.SQRT2 * sides[1]) > 0.1 * sides[2]) continue;
				trio = t;
				break outer;
			}
	if (!trio) return fail('it can’t find three corner squares', all);
	// The top-left square is opposite the longest side.
	const [p0, p1, p2] = trio;
	const d01 = dist(p0, p1);
	const d02 = dist(p0, p2);
	const d12 = dist(p1, p2);
	let tl: Finder, a: Finder, b: Finder;
	if (d12 >= d01 && d12 >= d02) [tl, a, b] = [p0, p1, p2];
	else if (d02 >= d01 && d02 >= d12) [tl, a, b] = [p1, p0, p2];
	else [tl, a, b] = [p2, p0, p1];
	// Top-right is the one a quarter turn clockwise (on screen) from bottom-left, seen from top-left.
	const cross = (a.x - tl.x) * (b.y - tl.y) - (a.y - tl.y) * (b.x - tl.x);
	const [tr, bl] = cross > 0 ? [a, b] : [b, a];
	// The width of a cell, measured across each corner square towards the next one (a row of
	// pixels crosses a turned square slantwise, so the row's own runs are too long).
	const across = (from: Finder, to: Finder) => {
		const d = dist(from, to);
		const r = crossCheck(p, from.x, from.y, (to.x - from.x) / d, (to.y - from.y) / d);
		return r ? r.total / 7 : from.cell;
	};
	const cell = (across(tl, tr) + across(tr, tl) + across(tl, bl) + across(bl, tl)) / 4;
	let dim = Math.round((dist(tl, tr) + dist(tl, bl)) / 2 / cell) + 7;
	if (dim % 4 === 0) dim++;
	else if (dim % 4 === 2) dim--;
	else if (dim % 4 === 3) return fail('the corner squares don’t fit together', all);
	const version = (dim - 17) / 4;
	if (version < 1 || version > 6) return fail('the corner squares don’t fit together', all);
	const size = sizeOf(version);
	// Read every cell at its centre.
	const ux = { x: (tr.x - tl.x) / (size - 7), y: (tr.y - tl.y) / (size - 7) };
	const uy = { x: (bl.x - tl.x) / (size - 7), y: (bl.y - tl.y) / (size - 7) };
	const cells = new Array<boolean>(size * size);
	for (let r = 0; r < size; r++)
		for (let c = 0; c < size; c++) {
			const u = c + 0.5 - 3.5;
			const v = r + 0.5 - 3.5;
			const x = Math.round(tl.x + u * ux.x + v * uy.x);
			const y = Math.round(tl.y + u * ux.y + v * uy.y);
			cells[r * size + c] =
				x >= 0 && y >= 0 && x < p.width && y < p.height && p.px[y * p.width + x] === 1;
		}
	return decodeCells(cells, size, [tl, tr, bl]);
}

/** Reads the format information: the valid format word nearest to either copy, if within 3 bits. */
export function readFormat(cells: readonly boolean[], size: number) {
	const { a, b } = formatPositions(size);
	const word = (pos: [number, number][]) =>
		pos.reduce((w, [r, c], k) => w | ((cells[r * size + c] ? 1 : 0) << k), 0);
	const copies = [word(a), word(b)];
	let best = { level: 'M' as Level, mask: 0, distance: 99 };
	for (const f of FORMATS)
		for (const w of copies) {
			let x = f.bits ^ w;
			let d = 0;
			while (x) {
				d += x & 1;
				x >>>= 1;
			}
			if (d < best.distance) best = { level: f.level, mask: f.mask, distance: d };
		}
	return best.distance <= 3 ? best : null;
}

/** Reads a code from its cells (row-major, size × size). */
export function decodeCells(
	cells: readonly boolean[],
	size: number,
	finders: Finder[] = []
): Reading {
	const version = (size - 17) / 4;
	const base = { finders, version, cells: [...cells] };
	const format = readFormat(cells, size);
	if (!format) return fail('the level-and-pattern cells are spoiled', finders, base);
	const { level, mask } = format;
	const kinds = functionKinds(version);
	const order = placementOrder(version);
	const blocks = blocksOf(version, level);
	const total = blocks.reduce((s, x) => s + x.data + x.ec, 0);
	const words = new Array<number>(total).fill(0);
	order.forEach((cell, i) => {
		const w = i >> 3;
		if (w >= total || kinds[cell] !== Kind.None) return;
		const r = Math.floor(cell / size);
		const c = cell % size;
		const bit = cells[cell] !== maskAt(mask, r, c);
		if (bit) words[w] |= 1 << (7 - (i & 7));
	});
	// Un-interleave.
	const split = blocks.map((b) => ({ data: [] as number[], ec: [] as number[], info: b }));
	let at = 0;
	const maxData = Math.max(...blocks.map((b) => b.data));
	for (let i = 0; i < maxData; i++)
		for (const s of split) if (i < s.info.data) s.data.push(words[at++]);
	for (let i = 0; i < blocks[0].ec; i++) for (const s of split) s.ec.push(words[at++]);
	const data: number[] = [];
	const fixed: number[] = [];
	for (const s of split) {
		const r = rsDecode([...s.data, ...s.ec], s.info.ec);
		if (!r.block)
			return fail('too many pieces are spoiled to repair', finders, { ...base, level, mask });
		data.push(...r.block.slice(0, s.info.data));
		fixed.push(r.fixed);
	}
	// Byte mode: 0100, an 8-bit count, then the bytes.
	const bitAt = (k: number) => (data[k >> 3] >>> (7 - (k & 7))) & 1;
	const read = (from: number, len: number) => {
		let v = 0;
		for (let k = 0; k < len; k++) v = v * 2 + bitAt(from + k);
		return v;
	};
	if (read(0, 4) !== 0b0100)
		return fail('too many pieces are spoiled to repair', finders, { ...base, level, mask });
	const count = read(4, 8);
	if (12 + 8 * count > data.length * 8)
		return fail('too many pieces are spoiled to repair', finders, { ...base, level, mask });
	const bytes = Uint8Array.from({ length: count }, (_, k) => read(12 + 8 * k, 8));
	return {
		ok: true,
		text: new TextDecoder().decode(bytes),
		problem: null,
		finders,
		level,
		mask,
		version,
		fixed,
		cells: [...cells]
	};
}
