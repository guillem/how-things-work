/**
 * The wave physics behind the waves-interference explainer. Pure functions,
 * no imports: the Node model tests load this file directly.
 *
 * - a travelling sine wave and the speed rule v = f·λ;
 * - superposition: the displacement where waves overlap is the sum of the
 *   displacements each would cause alone;
 * - two point sources in a ripple tank: circular waves whose amplitude falls
 *   as 1/√r (in two dimensions the energy of a ring spreads over its
 *   circumference, 2πr); still water where the path difference is a
 *   half-integer number of wavelengths, the strongest waves where it is a
 *   whole number;
 * - a string fixed at both ends: standing waves at f_n = n·v / 2L, and the
 *   pluck of an ideal string as a sum of those harmonics;
 * - the Doppler shift of a moving source, f' = f·c / (c − v·cos θ).
 *
 * Simplifications, stated on the page: ideal (lossless, perfectly flexible)
 * string; water waves without damping or reflections from the tank walls;
 * near a source the 1/√r rule is capped (it would grow without limit);
 * every ripple wavelength travels at the same speed.
 */

// ---- constants --------------------------------------------------------------------------

/** Ratio of specific heats of dry air, κ = 1.4 (ISO 2533:1975, Standard Atmosphere). */
const GAMMA_AIR = 1.4;
/** Molar gas constant, J/(mol·K) (CODATA 2018; exact since the 2019 SI redefinition). */
const GAS_CONSTANT = 8.314462618;
/** Mean molar mass of dry air, kg/mol (ISO 2533:1975; also the U.S. Standard Atmosphere 1976). */
const MOLAR_MASS_AIR = 0.0289644;

/**
 * Speed of sound in dry air (m/s) at a temperature in °C, from the ideal-gas
 * formula c = √(γ·R·T / M). Gives 340.29 m/s at 15 °C, the ISO 2533 sea-level
 * value, and 343.2 m/s at 20 °C.
 */
export function speedOfSound(tempC: number): number {
	return Math.sqrt((GAMMA_AIR * GAS_CONSTANT * (tempC + 273.15)) / MOLAR_MASS_AIR);
}

/** Speed of sound used on the page: dry air at 20 °C (≈ 343 m/s). */
export const SOUND_SPEED = speedOfSound(20);

/**
 * A₂, the guitar's open fifth string: two octaves below the A₄ = 440 Hz
 * concert pitch of ISO 16:1975, so 440 / 4 = 110 Hz.
 */
export const A2 = 440 / 4;

/** Vibrating length of a classical guitar string (the usual 650 mm scale length), m. */
export const GUITAR_SCALE = 0.65;

// ---- a travelling wave ------------------------------------------------------------------

/** Wavelength (m) of a wave of speed v (m/s) and frequency f (Hz): λ = v / f. */
export const wavelength = (v: number, f: number) => v / f;

/**
 * Displacement at x (m) and time t (s) of a sine wave of frequency f sent
 * along a rope from x = 0 at speed v, starting at t = 0 (the rope ahead of
 * the front is still). The end at x = 0 moves as A·sin(2πft).
 */
export function travelling(x: number, t: number, f: number, v: number, amp = 1): number {
	const delay = x / v;
	if (t < delay || x < 0) return 0;
	return amp * Math.sin(2 * Math.PI * f * (t - delay));
}

/** A smooth single pulse (a Gaussian bump) of height `amp` and half-width `w` centred at c. */
export const pulse = (x: number, c: number, w: number, amp = 1) =>
	amp * Math.exp(-(((x - c) / w) ** 2));

// ---- two sources in a ripple tank ---------------------------------------------------------

export interface Point {
	x: number;
	y: number;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Path difference r₁ − r₂ from two sources to a point (same units as the points). */
export const pathDifference = (p: Point, s1: Point, s2: Point) => dist(p, s1) - dist(p, s2);

/**
 * Amplitude where two equal waves arrive with a path difference Δ, as a
 * fraction of the sum of their amplitudes: |cos(π·Δ/λ)|. 1 when Δ is a whole
 * number of wavelengths (crest meets crest), 0 when it is a half-integer
 * number (crest meets trough).
 */
export const combinedAmplitude = (delta: number, lambda: number) =>
	Math.abs(Math.cos((Math.PI * delta) / lambda));

/**
 * Path differences (in wavelengths) of the quiet lines between two sources d
 * apart: every half-integer m + ½ with |m + ½|·λ < d. Each is one branch of a
 * hyperbola whose foci are the sources.
 */
export function quietOrders(d: number, lambda: number): number[] {
	const out: number[] = [];
	for (let m = 0; (m + 0.5) * lambda < d; m++) out.push(-(m + 0.5), m + 0.5);
	return out.sort((a, b) => a - b);
}

/** Path differences (in wavelengths) of the lines of strongest waves: whole numbers with |m|·λ < d. */
export function loudOrders(d: number, lambda: number): number[] {
	const out = [0];
	for (let m = 1; m * lambda < d; m++) out.push(-m, m);
	return out.sort((a, b) => a - b);
}

/**
 * Far from the sources, the angle (degrees, from the line straight ahead) of
 * the line with path difference `order`·λ: sin θ = order·λ / d.
 */
export const farAngle = (order: number, d: number, lambda: number) =>
	(Math.asin(Math.max(-1, Math.min(1, (order * lambda) / d))) * 180) / Math.PI;

/**
 * The curve of points whose path difference r₁ − r₂ is Δ: one branch of the
 * hyperbola with foci s1 and s2, sampled for hyperbolic parameter |s| ≤ sMax
 * (needs |Δ| < |s1 s2|).
 */
export function hyperbola(s1: Point, s2: Point, delta: number, sMax = 3, n = 80): Point[] {
	const c = dist(s1, s2) / 2;
	const a = delta / 2;
	if (Math.abs(a) >= c) return [];
	const b = Math.sqrt(c * c - a * a);
	const mx = (s1.x + s2.x) / 2;
	const my = (s1.y + s2.y) / 2;
	// unit vector from s1 to s2 (the focal axis) and its normal
	const ux = (s2.x - s1.x) / (2 * c);
	const uy = (s2.y - s1.y) / (2 * c);
	const pts: Point[] = [];
	for (let i = 0; i <= n; i++) {
		const s = -sMax + (2 * sMax * i) / n;
		// r₁ > r₂ (Δ > 0) means nearer s2: the branch on the s2 side.
		const u = a * Math.cosh(s);
		const w = b * Math.sinh(s);
		pts.push({ x: mx + u * ux - w * uy, y: my + u * uy + w * ux });
	}
	return pts;
}

/**
 * Smallest distance, in wavelengths, at which the 1/√r rule is applied; closer
 * to a source the amplitude is held at its value there (a real source has a
 * size, and the rule would grow without limit).
 */
export const NEAR = 0.25;

/**
 * Complex amplitude at p of circular waves of wavelength λ from in-phase
 * sources: each contributes cos(2π r/λ − ωt) / √(r/λ). The water height at
 * phase ωt is `re·cos ωt + im·sin ωt`, and the size of the up-and-down motion
 * there is √(re² + im²).
 */
export function amplitudeAt(p: Point, sources: Point[], lambda: number) {
	let re = 0;
	let im = 0;
	for (const s of sources) {
		const r = dist(p, s) / lambda;
		const a = 1 / Math.sqrt(Math.max(r, NEAR));
		re += a * Math.cos(2 * Math.PI * r);
		im += a * Math.sin(2 * Math.PI * r);
	}
	return { re, im, size: Math.hypot(re, im) };
}

/** Water height at p at phase ωt (radians) — see `amplitudeAt`. */
export function heightAt(p: Point, sources: Point[], lambda: number, phase: number) {
	const { re, im } = amplitudeAt(p, sources, lambda);
	return re * Math.cos(phase) + im * Math.sin(phase);
}

// ---- standing waves on a string ---------------------------------------------------------

/** Fundamental frequency of a string of length L (m) with wave speed v (m/s): v / 2L. */
export const fundamental = (L: number, v: number) => v / (2 * L);

/** Frequency of the n-th harmonic: n·v / 2L. */
export const harmonicFrequency = (n: number, L: number, v: number) => (n * v) / (2 * L);

/** Wave speed on a string of length L whose fundamental is f₁: v = 2·L·f₁. */
export const stringWaveSpeed = (L: number, f1: number) => 2 * L * f1;

/** Positions (fractions of the length) of the nodes of the n-th harmonic, ends included. */
export const nodes = (n: number) => Array.from({ length: n + 1 }, (_, m) => m / n);

/**
 * The n-th standing wave on a string fixed at both ends, at position u (0–1
 * along the string) and phase ωt: sin(nπu)·cos(ωt). It is the sum of two
 * equal waves travelling in opposite directions (see `travellingHalves`).
 */
export const standing = (n: number, u: number, phase: number) =>
	Math.sin(n * Math.PI * u) * Math.cos(phase);

/**
 * The two travelling waves whose sum is `standing(n, u, phase)`:
 * ½·sin(nπu − ωt) moving towards larger u and ½·sin(nπu + ωt) moving back.
 */
export const travellingHalves = (n: number, u: number, phase: number) => ({
	right: 0.5 * Math.sin(n * Math.PI * u - phase),
	left: 0.5 * Math.sin(n * Math.PI * u + phase)
});

/**
 * Amplitude of the n-th harmonic when an ideal string is pulled aside by
 * `height` at position p (0–1) and let go (its shape is then a triangle):
 * bₙ = 2·h·sin(nπp) / (n²π²·p·(1 − p)). Plucked in the middle, the even
 * harmonics vanish (they all have a node there).
 */
export function pluckAmplitude(n: number, p: number, height = 1): number {
	return (2 * height * Math.sin(n * Math.PI * p)) / (n * n * Math.PI * Math.PI * p * (1 - p));
}

/**
 * Shape of a plucked string at position u (0–1) and time measured in periods
 * of the fundamental (`cycles`), as the sum of its first `terms` harmonics,
 * each swinging at its own frequency n·f₁.
 */
export function pluckedString(u: number, cycles: number, p: number, height = 1, terms = 60) {
	let y = 0;
	for (let n = 1; n <= terms; n++) {
		const b = pluckAmplitude(n, p, height);
		if (b !== 0) y += b * Math.sin(n * Math.PI * u) * Math.cos(2 * Math.PI * n * cycles);
	}
	return y;
}

// ---- the Doppler effect --------------------------------------------------------------------

/**
 * Frequency heard from a source of frequency f moving at speed v through air
 * where sound travels at c, when the sound leaves the source at angle θ to
 * its direction of motion (cos θ = 1 straight ahead, −1 straight behind):
 * f' = f·c / (c − v·cos θ). The listener is at rest in the air.
 */
const dopplerShift = (f: number, v: number, c: number, cosTheta: number) =>
	(f * c) / (c - v * cosTheta);

/** Heard straight ahead of an approaching source: f·c / (c − v). */
export const dopplerAhead = (f: number, v: number, c: number) => dopplerShift(f, v, c, 1);

/** Heard straight behind a receding source: f·c / (c + v). */
export const dopplerBehind = (f: number, v: number, c: number) => dopplerShift(f, v, c, -1);

/**
 * A source of frequency f passes a listener in a straight line at speed v
 * (slower than c), its closest point d away, reached at time 0 (the source is
 * at x = v·t). Returns the frequency the listener hears at time `t` (s), and
 * when that sound was sent: t = τ + r(τ)/c.
 */
export function passBy(f: number, v: number, c: number, d: number, t: number) {
	// (c(t − τ))² = (vτ)² + d², taking the root with τ < t.
	const A = c * c - v * v;
	const B = c * c * t;
	const C = c * c * t * t - d * d;
	const tau = (B - Math.sqrt(Math.max(0, B * B - A * C))) / A;
	const x = v * tau;
	const r = Math.hypot(x, d);
	// direction from the source to the listener (at x = 0) against the velocity
	const cosTheta = r === 0 ? 0 : -x / r;
	return { f: dopplerShift(f, v, c, cosTheta), emitted: tau, distance: r };
}
