// Checks the curve fitting behind the learning-from-data explainer. Node only.
import { expect, test } from '@playwright/test';
import {
	errorCurve,
	fitPolynomial,
	legendre,
	makeData,
	mse
} from '../src/routes/learning-from-data/fit';

test('Legendre basis is right', () => {
	const [p0, p1, p2, p3] = legendre(0.5, 3);
	expect(p0).toBe(1);
	expect(p1).toBe(0.5);
	expect(p2).toBeCloseTo((3 * 0.25 - 1) / 2, 12);
	expect(p3).toBeCloseTo((5 * 0.125 - 3 * 0.5) / 2, 12);
});

test('a straight-line fit matches the textbook least-squares formula', () => {
	const pts = [
		{ x: -0.8, y: -0.5 },
		{ x: -0.2, y: 0.1 },
		{ x: 0.3, y: 0.2 },
		{ x: 0.9, y: 0.8 }
	];
	const n = pts.length;
	const mx = pts.reduce((s, p) => s + p.x, 0) / n;
	const my = pts.reduce((s, p) => s + p.y, 0) / n;
	const slope =
		pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) /
		pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
	const m = fitPolynomial(pts, 1);
	expect(m.predict(0)).toBeCloseTo(my - slope * mx, 9);
	expect(m.predict(1) - m.predict(0)).toBeCloseTo(slope, 9);
});

test('with as many coefficients as points the curve passes through every point', () => {
	const pts = makeData(8, 0.1, 3, 0);
	const m = fitPolynomial(pts, 7);
	expect(mse(m, pts)).toBeLessThan(1e-12);
	expect(m.predict(0)).not.toBeNaN();
});

test('training error falls with flexibility while test error turns upward', () => {
	const data = makeData(30, 0.15, 7);
	const train = data.filter((p) => !p.test);
	const testSet = data.filter((p) => p.test);
	const curve = errorCurve(train, testSet, 12);
	for (let d = 1; d < curve.length; d++)
		expect(curve[d].train).toBeLessThanOrEqual(curve[d - 1].train + 1e-12);
	const best = curve.reduce((a, b) => (b.test < a.test ? b : a));
	expect(best.degree).toBeGreaterThan(1); // a line underfits this curve
	expect(best.degree).toBeLessThan(10);
	expect(curve[12].test).toBeGreaterThan(best.test * 1.5); // too flexible: worse on new points
});

test('the sweet spot moves right with more examples and left with more noise', () => {
	// Best degree for the test error, averaged (geometric mean) over 40 random sets.
	const best = (n: number, noise: number) => {
		const sum = new Array(13).fill(0);
		for (let k = 0; k < 40; k++) {
			const d = makeData(n, noise, 1 + 1000 * k);
			const curve = errorCurve(
				d.filter((p) => !p.test),
				d.filter((p) => p.test),
				12
			);
			curve.forEach((e, i) => (sum[i] += Math.log(Math.max(1e-12, e.test))));
		}
		const maxDegree = Math.min(12, n - Math.ceil(n / 3) - 1);
		let b = 0;
		for (let i = 0; i <= maxDegree; i++) if (sum[i] < sum[b]) b = i;
		return b;
	};
	expect(best(12, 0.15)).toBeLessThan(best(40, 0.15));
	expect(best(21, 0.3)).toBeLessThan(best(21, 0.05));
	expect(best(21, 0.05)).toBeGreaterThanOrEqual(best(21, 0.15));
});
