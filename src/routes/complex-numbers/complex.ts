/**
 * Complex numbers for the complex-numbers explainer: arithmetic, length and
 * angle, and two independent ways of computing e^(iθ).
 *
 * A complex number a + bi is stored as { re: a, im: b }. The rules are the
 * ordinary rules of algebra plus i² = −1, so
 *   (a + bi) + (c + di) = (a + c) + (b + d)i
 *   (a + bi)(c + di)    = (ac − bd) + (ad + bc)i.
 * Length (modulus) |a + bi| = √(a² + b²); angle (argument) = atan2(b, a), in
 * degrees here because the narrative uses degrees (the prerequisite,
 * unit-circle, does too); radians are given alongside where e^(iθ) needs them.
 *
 * e^(iθ) is NOT taken from cos and sin here — that would assume Euler's
 * formula. Instead:
 *   - `compound(θ, n)` multiplies 1 by (1 + iθ/n), n times: the same limit
 *     (1 + x/n)^n → e^x that defines e by compound interest, with x = iθ;
 *   - `expSeries(z)` sums the power series 1 + z + z²/2! + z³/3! + …
 * The tests check that both land on cos θ + i sin θ (Euler's formula).
 *
 * Simplifications: none in the arithmetic (floating point only). The scenes
 * round lengths and angles to the slider steps (0.05 and 1°) so that the
 * readouts are exact.
 */

export interface Complex {
	re: number;
	im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });
export const I: Complex = { re: 0, im: 1 };

export const add = (z: Complex, w: Complex): Complex => ({ re: z.re + w.re, im: z.im + w.im });

/** (a + bi)(c + di) = (ac − bd) + (ad + bc)i — just the distributive law and i² = −1. */
export const mul = (z: Complex, w: Complex): Complex => ({
	re: z.re * w.re - z.im * w.im,
	im: z.re * w.im + z.im * w.re
});

export const scale = (z: Complex, k: number): Complex => ({ re: z.re * k, im: z.im * k });

/** zⁿ by repeated multiplication (n ≥ 0). */
export function pow(z: Complex, n: number): Complex {
	let p = c(1);
	for (let k = 0; k < n; k++) p = mul(p, z);
	return p;
}

/** Length |z| = √(a² + b²) (Pythagoras). */
export const abs = (z: Complex) => Math.hypot(z.re, z.im);

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Angle of z in degrees, in (−180°, 180°]; 0 for z = 0. */
export const arg = (z: Complex) => toDeg(Math.atan2(z.im, z.re));

/** The angle in degrees reduced to [0°, 360°). */
export const reduce = (deg: number) => ((deg % 360) + 360) % 360;

/** The number with length r and angle `deg` (degrees): r cos θ + i r sin θ. */
export const fromPolar = (r: number, deg: number): Complex => ({
	re: r * Math.cos(toRad(deg)),
	im: r * Math.sin(toRad(deg))
});

/**
 * The partial products of (1 + iθ/n)^n: [1, (1 + iθ/n), (1 + iθ/n)², …,
 * (1 + iθ/n)^n] (n + 1 points), θ in radians. Each factor turns by
 * atan(θ/n) ≈ θ/n and stretches by √(1 + θ²/n²) ≈ 1, so the points walk
 * round the unit circle and, as n grows, end at the point at angle θ.
 */
export function compound(theta: number, n: number): Complex[] {
	const step = c(1, theta / n);
	const out = [c(1)];
	for (let k = 0; k < n; k++) out.push(mul(out[k], step));
	return out;
}

/** e^z from its power series, summed until the terms are negligible. */
export function expSeries(z: Complex, maxTerms = 200): Complex {
	let term = c(1);
	let sum = c(1);
	for (let k = 1; k < maxTerms; k++) {
		term = scale(mul(term, z), 1 / k);
		sum = add(sum, term);
		if (abs(term) < 1e-17 * Math.max(1, abs(sum))) break;
	}
	return sum;
}

/** e^(iθ) (θ in radians), from the series: it equals cos θ + i sin θ. */
export const expi = (theta: number) => expSeries(c(0, theta));

// ---- readable numbers ---------------------------------------------------------------

/** A number with a real minus sign and `d` decimals, without "−0.00". */
export function num(v: number, d = 2) {
	const s = Math.abs(v).toFixed(d);
	return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
}

/** Shortest decimal up to `d` places: 2, 0.5, 1.25 (real minus sign). */
export function short(v: number, d = 2) {
	const r = Number(v.toFixed(d));
	return num(r, d).replace(/\.?0+$/, '') || '0';
}

/** "2 + 1i", "−0.5 − 2i", "3", "−i": a + bi with `d` decimals at most. */
export function fmt(z: Complex, d = 2) {
	const a = Number(z.re.toFixed(d));
	const b = Number(z.im.toFixed(d));
	const bAbs = short(Math.abs(b), d);
	const bi = bAbs === '1' ? 'i' : `${bAbs}i`;
	if (b === 0) return short(a, d);
	if (a === 0) return (b < 0 ? '−' : '') + bi;
	return `${short(a, d)} ${b < 0 ? '−' : '+'} ${bi}`;
}

/** An angle in whole degrees, with a real minus sign. */
export const deg = (v: number) => `${num(v, 0)}°`;

/** Radians as a multiple of π where exact (π/2, 3π/4…), else 2 decimals. */
export function radText(degrees: number) {
	const k = degrees / 15; // multiples of π/12
	if (Number.isInteger(k)) {
		if (k === 0) return '0';
		const g = gcd(Math.abs(k), 12);
		const num_ = k / g;
		const den = 12 / g;
		const top = num_ === 1 ? 'π' : num_ === -1 ? '−π' : `${num(num_, 0)}π`;
		return den === 1 ? top : `${top}/${den}`;
	}
	return num(toRad(degrees), 2);
}

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}
