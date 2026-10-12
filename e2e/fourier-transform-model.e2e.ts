// Checks the Fourier model behind the fourier-transform explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	closedCurve,
	curveCircles,
	curvePoints,
	dft,
	idft,
	partialSamples,
	partialSum,
	peak,
	pen,
	rmsError,
	shapeSamples,
	strengthAt,
	waveFromStroke,
	waveSpectrum,
	type Complex
} from '../src/routes/fourier-transform/fourier';

const TAU = 2 * Math.PI;
const amp = (samples: number[], n: number) => waveSpectrum(samples)[n].amp;

test('a pure sine wave has exactly one frequency', () => {
	const N = 256;
	const x = Array.from({ length: N }, (_, j) => 0.7 * Math.sin(TAU * 3 * (j / N) + 0.4));
	const s = waveSpectrum(x);
	expect(s[3].amp).toBeCloseTo(0.7, 10);
	expect(s[3].phase).toBeCloseTo(0.4, 10);
	for (const h of s) if (h.n !== 3) expect(h.amp).toBeLessThan(1e-10);
});

test('adding sine waves adds their bars: the transform is linear', () => {
	const N = 128;
	const x = Array.from(
		{ length: N },
		(_, j) => 0.5 + Math.sin(TAU * (j / N)) + 0.25 * Math.cos(TAU * 5 * (j / N))
	);
	const s = waveSpectrum(x);
	expect(s[0].amp).toBeCloseTo(0.5, 10); // the average
	expect(s[1].amp).toBeCloseTo(1, 10);
	expect(s[5].amp).toBeCloseTo(0.25, 10);
	expect(s.filter((h) => h.amp > 1e-9)).toHaveLength(3);
});

test('a square wave has only odd frequencies, with amplitudes 4/(πn)', () => {
	const x = shapeSamples('square', 1024);
	for (let n = 1; n <= 15; n++) {
		if (n % 2) expect(n * amp(x, n)).toBeCloseTo(4 / Math.PI, 2);
		else expect(amp(x, n)).toBeLessThan(1e-9);
	}
	// It is odd about its start, so every ingredient is a plain sine (phase 0).
	for (const n of [1, 3, 5, 7]) expect(waveSpectrum(x)[n].phase).toBeCloseTo(0, 9);
});

test('a sawtooth has every frequency, 2/(πn); a triangle only odd ones, 8/(π²n²)', () => {
	const saw = shapeSamples('sawtooth', 1024);
	const tri = shapeSamples('triangle', 1024);
	for (let n = 1; n <= 8; n++) {
		expect(n * amp(saw, n)).toBeCloseTo(2 / Math.PI, 2);
		if (n % 2) expect(n * n * amp(tri, n)).toBeCloseTo(8 / Math.PI ** 2, 2);
		else expect(amp(tri, n)).toBeLessThan(1e-9);
	}
});

test('sawtooth circles all start at 180°; triangle circles alternate 0° and 180°', () => {
	const saw = waveSpectrum(shapeSamples('sawtooth', 1024));
	const tri = waveSpectrum(shapeSamples('triangle', 1024));
	const wrap = (p: number) => Math.abs(Math.atan2(Math.sin(p), Math.cos(p)));
	for (const n of [1, 2, 3, 4]) expect(wrap(saw[n].phase)).toBeCloseTo(Math.PI, 9);
	for (const [n, p] of [
		[1, 0],
		[3, Math.PI],
		[5, 0],
		[7, Math.PI]
	] as const)
		expect(wrap(tri[n].phase)).toBeCloseTo(p, 9);
});

test('a pulse high for a fifth of the period has no 5th or 10th frequency', () => {
	const x = shapeSamples('pulse', 1000);
	expect(amp(x, 5)).toBeLessThan(1e-9);
	expect(amp(x, 10)).toBeLessThan(1e-9);
	for (const n of [1, 2, 3, 4, 6]) expect(amp(x, n)).toBeGreaterThan(0.05);
	// Its average: high (1) a fifth of the time, low (−1) the rest.
	expect(amp(x, 0)).toBeCloseTo(-0.6, 9);
});

test('the error shrinks as frequencies are added, and never grows', () => {
	const x = shapeSamples('square', 512);
	const s = waveSpectrum(x);
	const err = (terms: number) => rmsError(partialSamples(s, terms, 512), x);
	let last = Infinity;
	for (let terms = 0; terms <= 60; terms++) {
		expect(err(terms)).toBeLessThanOrEqual(last + 1e-12);
		last = err(terms);
	}
	// Adding an even frequency changes nothing; adding an odd one helps.
	expect(err(2)).toBeCloseTo(err(1), 12);
	expect(err(3)).toBeLessThan(err(1));
	expect(err(1)).toBeGreaterThan(2 * err(9));
	expect(err(9)).toBeGreaterThan(2 * err(49));
});

test('with every frequency the rebuilt waveform reproduces each sample', () => {
	const N = 64;
	const x = Array.from({ length: N }, (_, j) => Math.sin(j * j * 0.37) + (j % 7) / 5);
	const s = waveSpectrum(x);
	const back = partialSamples(s, N / 2, N);
	for (let j = 0; j < N; j++) expect(back[j]).toBeCloseTo(x[j], 9);
	// The inverse transform does the same for any complex samples.
	const z: Complex[] = x.map((re, j) => ({ re, im: Math.cos(j) }));
	const zz = idft(dft(z));
	for (let j = 0; j < N; j++) {
		expect(zz[j].re).toBeCloseTo(z[j].re, 9);
		expect(zz[j].im).toBeCloseTo(z[j].im, 9);
	}
});

test('Gibbs: the overshoot at a jump stays near 9% of the jump however many terms', () => {
	const s = waveSpectrum(shapeSamples('square', 4096));
	// The jump is from −1 to 1 (size 2); the limit is 8.95% of it.
	for (const terms of [21, 51, 101]) {
		const over = (peak(s, terms, 40000) - 1) / 2;
		expect(over).toBeGreaterThan(0.087);
		expect(over).toBeLessThan(0.091);
	}
	// Far from the jump the error does shrink.
	expect(Math.abs(partialSum(s, 101, 0.25) - 1)).toBeLessThan(0.01);
});

test('winding finds each frequency: twice the centre of mass is its amplitude', () => {
	const x = shapeSamples('square', 512);
	expect(strengthAt(x, 1)).toBeCloseTo(4 / Math.PI, 2);
	expect(strengthAt(x, 3)).toBeCloseTo(4 / (3 * Math.PI), 2);
	expect(strengthAt(x, 2)).toBeLessThan(1e-9);
	expect(strengthAt(x, 0)).toBeLessThan(1e-9); // the average of a square wave is 0
	// Between whole frequencies one period leaves sizeable leftovers; winding
	// more periods shrinks them, and the strength then peaks at the whole frequencies.
	expect(strengthAt(x, 1.5)).toBeGreaterThan(0.25);
	expect(strengthAt(x, 1.5, 8)).toBeLessThan(0.05);
	expect(strengthAt(x, 3, 8)).toBeCloseTo(strengthAt(x, 3), 9);
	const ks = Array.from({ length: 801 }, (_, i) => i / 200);
	const s8 = ks.map((k) => strengthAt(x, k, 8));
	const peaks = ks.filter(
		(_, i) => i > 0 && i < 800 && s8[i] > s8[i - 1] && s8[i] >= s8[i + 1] && s8[i] > 0.35
	);
	expect(peaks).toHaveLength(2);
	expect(peaks[0]).toBeCloseTo(1, 1);
	expect(peaks[1]).toBeCloseTo(3, 1);
});

test('a hand-drawn stroke becomes a periodic waveform, gaps joined across the period end', () => {
	// A stroke drawn backwards over the middle of the period only.
	const stroke = Array.from({ length: 50 }, (_, i) => ({ u: 0.75 - i / 100, y: 1 }));
	const x = waveFromStroke(stroke, 100)!;
	expect(x).toHaveLength(100);
	expect(x[50]).toBeCloseTo(1, 9);
	expect(x[0]).toBeCloseTo(1, 9); // the gap at the period end is bridged at the same height
	expect(waveFromStroke([{ u: 0.3, y: 1 }], 100)).toBeNull(); // a click is not a waveform
	// A drawn square wave has the square wave's spectrum.
	const sq = Array.from({ length: 400 }, (_, i) => ({ u: i / 400, y: i < 200 ? 1 : -1 }));
	const s = waveSpectrum(waveFromStroke(sq, 256)!);
	expect(s[1].amp).toBeCloseTo(4 / Math.PI, 1);
	expect(s[2].amp).toBeLessThan(0.02);
});

test('a circle is one rotating circle; reversed, it turns the other way', () => {
	const N = 64;
	const circle = Array.from({ length: N }, (_, j) => ({
		re: 2 + 0.5 * Math.cos((TAU * j) / N),
		im: -1 + 0.5 * Math.sin((TAU * j) / N)
	}));
	const c = curveCircles(circle);
	expect(c[0].k).toBe(0);
	expect(c[0].c.re).toBeCloseTo(2, 9); // the centre
	expect(c[0].c.im).toBeCloseTo(-1, 9);
	expect(c[1].k).toBe(1); // anticlockwise, once per period
	expect(c[1].radius).toBeCloseTo(0.5, 9);
	expect(c[2].radius).toBeLessThan(1e-9);
	const back = curveCircles([...circle].reverse());
	expect(back[1].k).toBe(-1);
});

test('epicycles: with all circles the pen retraces every point, and fewer get close', () => {
	for (const shape of ['heart', 'star', 'square'] as const) {
		const pts = curvePoints(shape, 128);
		const circles = curveCircles(pts);
		const gap = (count: number) => {
			let s = 0;
			for (let j = 0; j < 128; j++) {
				const p = pen(circles, count, j / 128);
				s += (p.re - pts[j].re) ** 2 + (p.im - pts[j].im) ** 2;
			}
			return Math.sqrt(s / 128);
		};
		expect(gap(127)).toBeLessThan(1e-9);
		expect(gap(30)).toBeLessThan(gap(5));
		expect(gap(30)).toBeLessThan(0.05);
	}
});

test('a drawn closed stroke is resampled evenly and closed; a dot is rejected', () => {
	const square: Complex[] = [
		{ re: 0, im: 0 },
		{ re: 1, im: 0 },
		{ re: 1, im: 1 },
		{ re: 0, im: 1 }
	];
	const pts = closedCurve(square, 8)!;
	expect(pts).toHaveLength(8);
	// Perimeter 4 split into 8 steps of 0.5, the last one back towards the start.
	expect(pts[1]).toEqual({ re: 0.5, im: 0 });
	expect(pts[7].re).toBeCloseTo(0, 12);
	expect(pts[7].im).toBeCloseTo(0.5, 12);
	expect(
		closedCurve(
			[
				{ re: 1, im: 1 },
				{ re: 1, im: 1 },
				{ re: 1, im: 1 }
			],
			8
		)
	).toBeNull();
});
