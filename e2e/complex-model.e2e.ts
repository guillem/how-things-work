// Checks the complex-number model behind the complex-numbers explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	I,
	abs,
	add,
	arg,
	c,
	compound,
	expSeries,
	expi,
	fmt,
	fromPolar,
	mul,
	pow,
	radText,
	reduce,
	type Complex
} from '../src/routes/complex-numbers/complex';

const close = (z: Complex, w: Complex, digits = 12) => {
	expect(z.re).toBeCloseTo(w.re, digits);
	expect(z.im).toBeCloseTo(w.im, digits);
};

test('i² = −1, i⁴ = 1, and the arithmetic quoted in the text', () => {
	close(mul(I, I), c(-1));
	close(pow(I, 3), c(0, -1));
	close(pow(I, 4), c(1));
	expect(fmt(add(c(2, 1), c(1, 2)))).toBe('3 + 3i');
	expect(fmt(mul(I, c(2, 1)))).toBe('−1 + 2i');
	expect(fmt(mul(c(1, 1), c(1, 1)))).toBe('2i');
	expect(fmt(mul(c(2, 1), c(1, 2)))).toBe('5i');
	expect(abs(c(1.5, 2))).toBeCloseTo(2.5, 12);
	expect(abs(c(1, 1))).toBeCloseTo(1.41, 2);
	expect(arg(c(1, 1))).toBeCloseTo(45, 12);
	expect(Math.E).toBeCloseTo(2.718, 3);
});

test('multiplying by i turns any point a quarter turn: (a, b) → (−b, a)', () => {
	for (const [a, b] of [
		[2, 1],
		[-1.3, 0.4],
		[0, -2.5],
		[3, -3]
	]) {
		const iz = mul(I, c(a, b));
		close(iz, c(-b, a));
		expect(abs(iz)).toBeCloseTo(abs(c(a, b)), 12);
		expect(reduce(arg(iz) - arg(c(a, b)))).toBeCloseTo(90, 9);
	}
});

test('polar form: z = |z|(cos φ + i sin φ)', () => {
	for (const z of [c(1.5, 2), c(-2, 0.7), c(-0.3, -2.9), c(2.4, -1)]) {
		close(fromPolar(abs(z), arg(z)), z);
	}
});

test('products: lengths multiply and angles add (mod 360°)', () => {
	for (const [r1, a1, r2, a2] of [
		[1.4, 20, 1.25, 45],
		[0.2, 0, 1.6, 360],
		[1.6, 200, 1.6, 250],
		[0.75, 359, 0.5, 1],
		[1, 90, 1, 90]
	]) {
		const p = mul(fromPolar(r1, a1), fromPolar(r2, a2));
		expect(abs(p)).toBeCloseTo(r1 * r2, 12);
		expect(Math.cos((arg(p) - (a1 + a2)) * (Math.PI / 180))).toBeCloseTo(1, 12);
		close(p, fromPolar(r1 * r2, a1 + a2));
	}
	// 200° + 250° = 450° points the same way as 90°.
	expect(reduce(arg(mul(fromPolar(1, 200), fromPolar(1, 250))))).toBeCloseTo(90, 9);
	// The defaults on the page: 1.40 × 1.25 = 1.75 at 20° + 45° = 65°.
	const p = mul(fromPolar(1.4, 20), fromPolar(1.25, 45));
	expect(abs(p)).toBeCloseTo(1.75, 12);
	expect(arg(p)).toBeCloseTo(65, 12);
	// The algebraic rule, against an independent expansion.
	const [a, b, cc, d] = [0.3, -1.7, 2.2, 0.9];
	close(mul(c(a, b), c(cc, d)), c(a * cc - b * d, a * d + b * cc));
});

test("Euler's formula: the power series gives cos θ + i sin θ", () => {
	for (let deg = -360; deg <= 720; deg += 15) {
		const th = (deg * Math.PI) / 180;
		close(expi(th), c(Math.cos(th), Math.sin(th)), 10); // series cancellation at large θ
		expect(abs(expi(th))).toBeCloseTo(1, 10);
	}
	close(expSeries(c(1)), c(Math.E), 14);
	close(expi(Math.PI / 2), I, 14);
	close(expi(Math.PI), c(-1), 14); // e^(iπ) = −1
	// e^(iα) e^(iβ) = e^(i(α+β))
	close(mul(expi(0.7), expi(2.1)), expi(2.8), 12);
});

test('compounding (1 + iθ/n)^n approaches e^(iθ); the numbers in the text', () => {
	// One step shoots off to 1 + iθ.
	close(compound(Math.PI, 1)[1], c(1, Math.PI));
	expect(compound(Math.PI, 7)).toHaveLength(8);
	// θ = 180°: 10 steps end at −1.59 + 0.16i, 100 steps at −1.05.
	expect(fmt(compound(Math.PI, 10).at(-1)!)).toBe('−1.59 + 0.16i');
	expect(fmt(compound(Math.PI, 100).at(-1)!)).toBe('−1.05');
	// The error shrinks as n grows, roughly like 1/n (|end| ≈ e^(θ²/2n)).
	let previous = Infinity;
	for (const n of [1, 2, 4, 10, 100, 1000, 100000]) {
		const end = compound(Math.PI, n).at(-1)!;
		const err = abs(add(end, c(1)));
		expect(err).toBeLessThan(previous);
		previous = err;
		if (n >= 10) expect(abs(end)).toBeCloseTo(Math.exp((Math.PI * Math.PI) / (2 * n)), 1);
	}
	expect(previous).toBeLessThan(1e-4);
	// Each factor turns by atan(θ/n) ≈ θ/n.
	const pts = compound(1, 50);
	expect(arg(pts[1]) * (Math.PI / 180)).toBeCloseTo(Math.atan(1 / 50), 12);
	// Any angle: the end tends to the point at angle θ.
	for (const th of [0.5, 2, 4, 6]) close(compound(th, 200000).at(-1)!, expi(th), 3);
});

test('radians are shown as multiples of π where exact', () => {
	expect(radText(180)).toBe('π');
	expect(radText(90)).toBe('π/2');
	expect(radText(60)).toBe('π/3');
	expect(radText(270)).toBe('3π/2');
	expect(radText(360)).toBe('2π');
	expect(radText(0)).toBe('0');
	expect(radText(37)).toBe('0.65');
});
