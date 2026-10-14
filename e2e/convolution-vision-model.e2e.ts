// Checks the convolution-vision model: the hand-made filters do what their names say (a blur
// keeps a flat image, edge filters see only edges of their orientation), convolution commutes
// with shifting the image, the page's forward pass reproduces what the training script recorded
// for real MNIST test digits, and digits drawn anywhere and at any size reach the network the
// same way and are read correctly. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	BOX,
	PARAMS,
	SIDE,
	decodeBytes,
	decodeWeights,
	drawAsIs,
	forward,
	prepare,
	type Stroke
} from '../src/routes/convolution-vision/cnn';
import { PRESETS, divisor, filter, shift } from '../src/routes/convolution-vision/filters';
import {
	CONFUSION,
	SAMPLES,
	TEST_ACCURACY,
	TEST_COUNT,
	TEST_ERRORS,
	WEIGHTS
} from '../src/routes/convolution-vision/mnist-cnn';

const N = SIDE * SIDE;
const at = (img: ArrayLike<number>, x: number, y: number) => img[y * SIDE + x];
const pixels = (s: (typeof SAMPLES)[number]) =>
	Float32Array.from(decodeBytes(s.pixels), (v) => v / 255);
const wt = decodeWeights(WEIGHTS);

test('a blur keeps a flat image flat; edge filters give 0 on it', () => {
	const flat = new Float32Array(N).fill(0.6);
	for (const id of ['blur', 'sharpen', 'identity'] as const) {
		const out = filter(flat, PRESETS[id].k);
		// away from the border, where the zero padding comes in
		for (let y = 1; y < SIDE - 1; y++)
			for (let x = 1; x < SIDE - 1; x++) expect(at(out, x, y)).toBeCloseTo(0.6, 5);
	}
	expect(divisor(PRESETS.blur.k)).toBe(9);
	for (const id of ['vertical', 'horizontal', 'outline'] as const) {
		expect(divisor(PRESETS[id].k)).toBe(1);
		const out = filter(flat, PRESETS[id].k);
		for (let y = 1; y < SIDE - 1; y++)
			for (let x = 1; x < SIDE - 1; x++) expect(at(out, x, y)).toBeCloseTo(0, 5);
	}
});

test('the vertical-edge filter sees a dark-to-light edge from left to right, the horizontal one does not', () => {
	// ink on the right half
	const img = Float32Array.from({ length: N }, (_, i) => (i % SIDE >= 14 ? 1 : 0));
	const v = filter(img, PRESETS.vertical.k);
	const h = filter(img, PRESETS.horizontal.k);
	expect(at(v, 13, 10)).toBe(4); // −(1+2+1)·0 + (1+2+1)·1
	expect(at(v, 14, 10)).toBe(4);
	expect(at(v, 6, 10)).toBe(0);
	expect(at(v, 20, 10)).toBe(0);
	for (let y = 1; y < SIDE - 1; y++) expect(at(h, 13, y)).toBe(0);
	// the edge the other way round gives the opposite sign
	const flipped = filter(
		img.map((p) => 1 - p),
		PRESETS.vertical.k
	);
	expect(at(flipped, 13, 10)).toBe(-4);
});

test('convolution commutes with moving the image: the same detector everywhere', () => {
	const img = pixels(SAMPLES[0]);
	for (const id of ['vertical', 'outline', 'blur'] as const) {
		const a = filter(shift(img, 3, -2), PRESETS[id].k);
		const b = shift(filter(img, PRESETS[id].k), 3, -2);
		for (let i = 0; i < N; i++) expect(a[i]).toBeCloseTo(b[i], 5);
	}
});

test('the shipped network reproduces what training recorded on real test digits', () => {
	expect(PARAMS).toBe(11274);
	for (const s of SAMPLES) {
		const a = forward(wt, pixels(s));
		expect(a.digit).toBe(s.predicted);
		a.probs.forEach((p, j) => expect(p).toBeCloseTo(s.probs[j], 4));
	}
	// two of each digit right, then four it gets wrong
	expect(SAMPLES.filter((s) => s.predicted === s.label)).toHaveLength(20);
	expect(SAMPLES.slice(20).every((s) => s.predicted !== s.label)).toBe(true);
	const total = CONFUSION.flat().reduce((a, b) => a + b, 0);
	const right = CONFUSION.reduce((n, row, i) => n + row[i], 0);
	expect(total).toBe(TEST_COUNT);
	expect(TEST_COUNT - right).toBe(TEST_ERRORS);
	expect(TEST_ACCURACY).toBe(right / TEST_COUNT);
	expect(TEST_ACCURACY).toBeGreaterThan(0.99); // the page quotes 99.1%
});

// ---- drawn digits ---------------------------------------------------------------------------
const line = (x0: number, y0: number, x1: number, y1: number, n = 12): Stroke =>
	Array.from({ length: n + 1 }, (_, i) => ({
		x: x0 + ((x1 - x0) * i) / n,
		y: y0 + ((y1 - y0) * i) / n
	}));
const ellipse = (cx: number, cy: number, rx: number, ry: number): Stroke =>
	Array.from({ length: 41 }, (_, i) => ({
		x: cx + rx * Math.sin((2 * Math.PI * i) / 40),
		y: cy - ry * Math.cos((2 * Math.PI * i) / 40)
	}));
const moved = (strokes: Stroke[], dx: number, dy: number, s: number) =>
	strokes.map((st) => st.map((p) => ({ x: p.x * s + dx, y: p.y * s + dy })));
const ONE = [line(0.5, 0.15, 0.5, 0.85)];
const ZERO = [ellipse(0.5, 0.5, 0.25, 0.35)];
const SEVEN = [[...line(0.25, 0.2, 0.75, 0.2), ...line(0.75, 0.2, 0.45, 0.85).slice(1)]];

test('a drawn digit is centred and scaled like MNIST, wherever and however big it is drawn', () => {
	const a = prepare(SEVEN);
	const b = prepare(moved(SEVEN, 3, -1, 0.3));
	expect(a).not.toBeNull();
	for (let i = 0; i < N; i++) expect(a![i]).toBeCloseTo(b![i], 3);
	// the ink fits a 20 × 20 box and its centre of mass is the centre of the 28 × 28 image
	let m = 0;
	let mx = 0;
	let my = 0;
	let x0 = SIDE;
	let x1 = 0;
	let y0 = SIDE;
	let y1 = 0;
	for (let y = 0; y < SIDE; y++)
		for (let x = 0; x < SIDE; x++) {
			const v = at(a!, x, y);
			if (v === 0) continue;
			[m, mx, my] = [m + v, mx + v * (x + 0.5), my + v * (y + 0.5)];
			[x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
		}
	expect(Math.max(x1 - x0 + 1, y1 - y0 + 1)).toBeLessThanOrEqual(BOX + 1);
	expect(mx / m).toBeCloseTo(14, 0);
	expect(my / m).toBeCloseTo(14, 0);
	expect(prepare([])).toBeNull();
});

test('the network reads simple drawn digits correctly', () => {
	expect(forward(wt, prepare(ONE)!).digit).toBe(1);
	expect(forward(wt, prepare(ZERO)!).digit).toBe(0);
	expect(forward(wt, prepare(SEVEN)!).digit).toBe(7);
});

test('without the MNIST preparation, a small digit in a corner is misread', () => {
	// the same small strokes, at the top left and at the bottom right of the pad
	for (const [dx, dy] of [
		[0.04, 0.04],
		[0.6, 0.6]
	])
		for (const [digit, strokes] of [
			[7, SEVEN],
			[1, ONE],
			[0, ZERO]
		] as const) {
			const small = moved(strokes, dx, dy, 0.3);
			expect(forward(wt, prepare(small)!).digit).toBe(digit);
			expect(forward(wt, drawAsIs(small)!).digit).not.toBe(digit);
		}
});
