// Checks the mathematics behind the Taylor-series explainer against known results: the
// series of eˣ, sin x, 1/(1 + x²) and log(1 + x), where they converge, Taylor's error bound,
// the radius read off the coefficients, and Chebyshev interpolation. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	bernsteinRho,
	chebyshev,
	equispaced,
	functions,
	maxError,
	radius,
	radiusFromCoefficients,
	remainderBound,
	taylor
} from '../src/routes/taylor-series/taylor';

const { exp, sin, runge, log } = functions;
const err = (fn: typeof exp, a: number, n: number, x: number) =>
	Math.abs(taylor(fn, a, n)(x) - fn.f(x));

test('the textbook series: eˣ = Σ xᵏ/k!, sin x = x − x³/6 + …, 1/(1 + x²) = 1 − x² + x⁴ − …', () => {
	expect(exp.coefficients(0, 4)).toEqual([1, 1, 1 / 2, 1 / 6, 1 / 24]);
	const s = sin.coefficients(0, 5);
	[0, 1, 0, -1 / 6, 0, 1 / 120].forEach((v, k) => expect(s[k]).toBeCloseTo(v, 12));
	const r = runge.coefficients(0, 6);
	[1, 0, -1, 0, 1, 0, -1].forEach((v, k) => expect(r[k]).toBeCloseTo(v, 12));
	const l = log.coefficients(0, 4);
	[0, 1, -1 / 2, 1 / 3, -1 / 4].forEach((v, k) => expect(l[k]).toBeCloseTo(v, 12));
});

test('about any centre, the coefficients are the derivatives: P_n matches f to order n + 1', () => {
	// Halving the distance from the centre divides the error by about 2^(n+1).
	for (const fn of [exp, sin, runge, log]) {
		for (const a of [-0.5, 0.7, 2]) {
			const n = 4;
			const ratio = err(fn, a, n, a + 0.1) / err(fn, a, n, a + 0.05);
			expect(ratio, `${fn.id} about ${a}`).toBeGreaterThan(2 ** (n + 1) * 0.8);
			expect(ratio, `${fn.id} about ${a}`).toBeLessThan(2 ** (n + 1) * 1.25);
		}
	}
});

test('the radius read off the coefficients is the distance to the nearest singularity', () => {
	// 1/(1 + x²) blows up at ±i: about a the radius is √(1 + a²).
	for (const a of [0, 1, 2, 3, -1.5]) {
		expect(radius(runge, a)).toBeCloseTo(Math.sqrt(1 + a * a), 12);
		expect(radiusFromCoefficients(runge, a) / Math.sqrt(1 + a * a)).toBeCloseTo(1, 1);
	}
	// log(1 + x) blows up at −1: about a the radius is 1 + a.
	for (const a of [-0.5, 0, 0.5, 2]) {
		expect(radius(log, a)).toBeCloseTo(1 + a, 12);
		expect(radiusFromCoefficients(log, a) / (1 + a)).toBeCloseTo(1, 1);
	}
	// eˣ and sin have no singularity: the root test's estimate keeps growing with k.
	for (const fn of [exp, sin]) {
		expect(radius(fn, 0)).toBe(Infinity);
		expect(radiusFromCoefficients(fn, 0, 80, 120)).toBeGreaterThan(
			1.4 * radiusFromCoefficients(fn, 0, 40, 60)
		);
	}
});

test('inside the radius more terms help; outside, each term makes it worse', () => {
	// 1/(1 + x²) about 0, radius 1.
	for (const x of [0.5, -0.8, 0.95]) {
		expect(err(runge, 0, 40, x)).toBeLessThan(err(runge, 0, 20, x));
		expect(err(runge, 0, 200, x)).toBeLessThan(1e-3);
	}
	for (const x of [1.1, -1.5, 2]) {
		expect(err(runge, 0, 20, x)).toBeGreaterThan(err(runge, 0, 10, x));
		expect(err(runge, 0, 30, x)).toBeGreaterThan(err(runge, 0, 20, x));
	}
	// The numbers the narrative quotes: at x = 0.5, degree 10 gives 0.7998 for 0.8; at x = 2
	// the degree 10 polynomial is −819 for the true 0.2.
	expect(taylor(runge, 0, 10)(0.5)).toBeCloseTo(0.7998, 4);
	expect(taylor(runge, 0, 10)(2)).toBeCloseTo(-819, 6);
	// Re-centring at a = 2 moves the fit out to 2 ± √5: x = 4 now converges.
	expect(err(runge, 2, 60, 4)).toBeLessThan(1e-3);
	expect(err(runge, 2, 60, 4)).toBeLessThan(err(runge, 2, 20, 4));
	// log(1 + x) about 0 also fails beyond x = 1, where nothing happens to the function.
	// at x = 1.5, degree 8 gives −0.91 and degree 16 about −23, for the true 0.92
	expect(taylor(log, 0, 8)(1.5)).toBeCloseTo(-0.91, 2);
	expect(taylor(log, 0, 16)(1.5)).toBeCloseTo(-23.1, 1);
	expect(log.f(1.5)).toBeCloseTo(0.92, 2);
	// at x = 2, degree 30 is about −8.6 × 10⁸
	expect(taylor(runge, 0, 30)(2) / -8.6e8).toBeCloseTo(1, 2);
});

test('on the boundary circle the series of 1/(1 + x²) does not converge', () => {
	// At x = ±1 the partial sums are 1, 0, 1, 0, …: they never settle.
	for (const x of [1, -1]) {
		const sums = [0, 2, 4, 6, 40, 42].map((n) => taylor(runge, 0, n)(x));
		[1, 0, 1, 0, 1, 0].forEach((v, i) => expect(sums[i]).toBeCloseTo(v, 9));
	}
});

test("Taylor's error bound holds for eˣ and sin x", () => {
	for (const fn of [exp, sin]) {
		for (const a of [0, 1.5, -2]) {
			for (const x of [-4, -1, 0.3, 2, 4]) {
				for (const n of [0, 1, 3, 6, 10, 20, 30]) {
					const e = err(fn, a, n, x);
					// a floating-point floor: high-degree bounds drop below rounding error
					expect(e, `${fn.id} a=${a} x=${x} n=${n}`).toBeLessThanOrEqual(
						remainderBound(fn, a, x, n) + 1e-12
					);
				}
			}
		}
	}
	// The narrative: about 0, degree 10 already gives e² to 4 decimals and sin 4 to 1 in 100.
	expect(err(exp, 0, 10, 2)).toBeLessThan(1e-4);
	expect(err(sin, 0, 11, 4)).toBeCloseTo(0.01, 3);
	expect(err(sin, 0, 7, 4)).toBeGreaterThan(0.5);
});

test('Chebyshev interpolation fits 1/(1 + x²) on the whole interval, at the ellipse rate', () => {
	const errAt = (n: number) => maxError(runge.f, chebyshev(runge.f, -4, 4, n).at, -4, 4);
	// It passes through its nodes.
	const c = chebyshev(runge.f, -4, 4, 12);
	c.nodes.forEach((x, i) => expect(c.at(x)).toBe(c.values[i]));
	expect(errAt(20)).toBeLessThan(errAt(10));
	expect(errAt(40)).toBeLessThan(1e-4);
	// The rate is set by ±i too: an ellipse with foci ±4 through i has ρ = (1 + √17)/4.
	const rho = bernsteinRho(runge, -4, 4);
	expect(rho).toBeCloseTo((1 + Math.sqrt(17)) / 4, 12);
	expect(Math.pow(errAt(20) / errAt(40), 1 / 20)).toBeCloseTo(rho, 1);
	// The narrative: degree 20 is within 0.007 everywhere on [−4, 4], where the Taylor
	// polynomial of degree 20 is off by about 10¹² at the ends.
	expect(errAt(20)).toBeLessThan(0.007);
	const taylorErr = maxError(runge.f, taylor(runge, 0, 20), -4, 4);
	expect(Math.log10(taylorErr)).toBeCloseTo(12, 0);
	// Equally spaced points instead get worse with the degree (Runge's phenomenon).
	const equiErr = (n: number) => maxError(runge.f, equispaced(runge.f, -4, 4, n), -4, 4);
	expect(equiErr(20)).toBeGreaterThan(equiErr(10));
	expect(equiErr(20)).toBeGreaterThan(1);
	expect(bernsteinRho(exp, -4, 4)).toBe(Infinity);
});
