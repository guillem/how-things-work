// Checks the mathematics behind the calculus explainer against known results:
// derivatives of standard functions, the convergence of Riemann sums and the
// fundamental theorem of calculus. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	DEFAULT_KNOTS,
	G,
	KNOT_X,
	V0,
	chordSlope,
	curveFor,
	integral,
	numericSlope,
	presets,
	riemann,
	runningArea,
	spline
} from '../src/routes/calculus/calculus';

const square = (x: number) => x * x;
const xs = [0, 0.5, 1, 1.5, 2.25, 3];

test('the slope of x² at x is 2x, and the chord slope tends to it as h shrinks', () => {
	for (const x of xs) {
		expect(numericSlope(square, x)).toBeCloseTo(2 * x, 6);
		expect(presets.parabola.df(x)).toBeCloseTo(2 * x, 12);
	}
	// The narrative: from x = 1, the chord to x + h has slope 2 + h.
	for (const h of [1, 0.5, 0.1, 0.01]) expect(chordSlope(square, 1, h)).toBeCloseTo(2 + h, 9);
	// Each tenfold shrink of h brings the chord ten times closer to the tangent.
	const gap = (h: number) => Math.abs(chordSlope(Math.sin, 1, h) - Math.cos(1));
	expect(gap(0.01) / gap(0.001)).toBeCloseTo(10, 0);
});

test('every curve on the page has the derivative it claims', () => {
	const curves = [...Object.values(presets), curveFor('custom', DEFAULT_KNOTS)];
	for (const c of curves) {
		for (const x of [0.05, 0.4, 1.1, 1.5, 2.2, 2.95]) {
			expect(c.df(x), `${c.id} at ${x}`).toBeCloseTo(numericSlope(c.f, x), 5);
		}
	}
	// The thrown ball: its velocity falls by 9.8 m/s every second, from 14.7 m/s.
	expect(presets.ball.df(0)).toBeCloseTo(14.7, 9);
	expect(presets.ball.df(1) - presets.ball.df(2)).toBeCloseTo(G, 9);
	expect(presets.ball.f(3)).toBeCloseTo(0, 9);
	expect(presets.ball.df(V0 / G)).toBeCloseTo(0, 9); // at the top it stops rising
	// The sine wave's slope is the cosine (scaled by the chain rule).
	expect(presets.wave.df(0)).toBeCloseTo(2 * Math.PI, 9);
	expect(presets.wave.df(0.75)).toBeCloseTo(0, 9); // its peak
});

test('the editable curve passes through its knots smoothly', () => {
	const s = spline(KNOT_X, DEFAULT_KNOTS);
	KNOT_X.forEach((x, i) => expect(s.f(x)).toBeCloseTo(DEFAULT_KNOTS[i], 9));
	// No corner at the knots: the slope just left and right of each one agrees.
	for (const x of KNOT_X.slice(1, -1)) expect(s.df(x - 1e-9)).toBeCloseTo(s.df(x + 1e-9), 5);
	// Knots on a straight line give that straight line.
	const line = spline(
		KNOT_X,
		KNOT_X.map((x) => 2 * x + 1)
	);
	for (const x of xs) expect(line.f(x)).toBeCloseTo(2 * x + 1, 9);
});

test('Riemann sums converge to the exact integral', () => {
	// ∫₀³ x² dx = 3³/3 = 9.
	expect(integral(square, 0, 3)).toBeCloseTo(9, 9);
	const err = (n: number, rule: 'left' | 'mid' | 'right') =>
		Math.abs(riemann(square, 0, 3, n, rule) - 9);
	// The left sums under a rising curve are too small; they close in on 9.
	expect(riemann(square, 0, 3, 4, 'left')).toBeLessThan(9);
	expect(riemann(square, 0, 3, 4, 'right')).toBeGreaterThan(9);
	for (const n of [1, 2, 4, 8, 16, 32, 64]) expect(err(2 * n, 'left')).toBeLessThan(err(n, 'left'));
	// Doubling the rectangles halves the left-sum error: it shrinks like 1/n …
	expect(err(100, 'left') / err(200, 'left')).toBeCloseTo(2, 1);
	expect(err(100, 'right') / err(200, 'right')).toBeCloseTo(2, 1);
	// … and quarters the midpoint error: 1/n².
	expect(err(100, 'mid') / err(200, 'mid')).toBeCloseTo(4, 1);
	// The narrative's numbers: 4 rectangles give about 5.9, 100 give about 8.87.
	expect(riemann(square, 0, 3, 4, 'left')).toBeCloseTo(5.906, 3);
	expect(riemann(square, 0, 3, 100, 'left')).toBeCloseTo(8.865, 3);
});

test('area below the axis counts as negative', () => {
	// One whole period of the sine wave: as much below the axis as above.
	expect(integral(presets.wave.f, 0, 3)).toBeCloseTo(0, 9);
	expect(integral(presets.wave.f, 0, 1.5)).toBeCloseTo(9 / Math.PI, 9);
	expect(integral(presets.wave.f, 1.5, 3)).toBeCloseTo(-9 / Math.PI, 9);
});

test('the slope of the running area is the curve (the fundamental theorem)', () => {
	const curves = [...Object.values(presets), curveFor('custom', DEFAULT_KNOTS)];
	for (const c of curves) {
		const A = (x: number) => runningArea(c.f, 0, x);
		for (const x of [0.3, 1, 1.7, 2.6]) {
			expect(numericSlope(A, x, 1e-4), `${c.id} at ${x}`).toBeCloseTo(c.f(x), 5);
		}
	}
	// Under x², the area from 0 to x is x³/3, whose slope is x² again.
	expect(runningArea(square, 0, 2)).toBeCloseTo(8 / 3, 9);
});

test('adding up the slope gives back the change in the curve', () => {
	// ∫ₐᵇ f′(x) dx = f(b) − f(a), for every curve, from any start.
	const curves = [...Object.values(presets), curveFor('custom', DEFAULT_KNOTS)];
	for (const c of curves) {
		for (const [a, b] of [
			[0, 3],
			[0, 1.2],
			[0.7, 2.4]
		]) {
			expect(integral(c.df, a, b), `${c.id} ${a}–${b}`).toBeCloseTo(c.f(b) - c.f(a), 5);
		}
	}
	// The ball: the area under its velocity is how high it has climbed.
	expect(integral(presets.ball.df, 0, 1.5)).toBeCloseTo(11.025, 6);
});
