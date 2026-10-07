/**
 * Small, exact helpers for the unit-circle explainer: angle conversions, the
 * angle of a dragged point, and readable values (exact surds for the special
 * angles, multiples of π for radians). The drawings use Math.sin/Math.cos
 * directly; these helpers only decide how numbers are shown.
 */
import type { Params, Step } from '#lib/explainer/index.ts';

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Angle in degrees, in [0, 360), of point (x, y) seen from (cx, cy), with y pointing DOWN on screen. */
export function screenAngle(cx: number, cy: number, x: number, y: number) {
	const deg = toDeg(Math.atan2(cy - y, x - cx));
	return deg < 0 ? deg + 360 : deg;
}

/**
 * Continues a drag smoothly across the 0°/360° seam: returns the angle equal
 * to `raw` (mod 360) that is closest to `previous`. Lets the angle keep
 * growing past 360° (or below 0°) when the control allows it.
 */
export function unwrap(previous: number, raw: number) {
	const delta = ((((raw - previous) % 360) + 540) % 360) - 180;
	return previous + delta;
}

/** Angle in degrees reduced to [0, 360). */
export const reduce = (deg: number) => ((deg % 360) + 360) % 360;

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Exact form of sin/cos at multiples of 30° and 45°, e.g. "√3/2", "−½", or null. */
export function exact(value: number): string | null {
	const forms: [number, string][] = [
		[0, '0'],
		[0.5, '½'],
		[Math.SQRT1_2, '√2/2'],
		[Math.sqrt(3) / 2, '√3/2'],
		[1, '1']
	];
	for (const [v, s] of forms) {
		if (near(Math.abs(value), v)) return value < 0 && v !== 0 ? `−${s}` : s;
	}
	return null;
}

/** True when the angle (degrees) is a whole multiple of 30° or 45°. */
export const isSpecial = (deg: number) =>
	Number.isInteger(deg) && (reduce(deg) % 30 === 0 || reduce(deg) % 45 === 0);

/** A number with a real minus sign and fixed decimals: −0.50. */
export const num = (v: number, decimals = 2) => {
	const s = Math.abs(v).toFixed(decimals);
	return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
};

/** sin or cos of an angle in degrees, as shown to the reader ("√3/2 ≈ 0.87" or "0.64"). */
export function trigText(deg: number, fn: 'sin' | 'cos') {
	const v = fn === 'sin' ? Math.sin(toRad(deg)) : Math.cos(toRad(deg));
	if (isSpecial(deg)) {
		const e = exact(v);
		if (e && !/^−?[01]$/.test(e)) return `${e} ≈ ${num(v)}`;
		if (e) return e;
	}
	return num(v);
}

/**
 * Radians as a reader-friendly string: a multiple of π for angles that are a
 * whole number of degrees divisible by 15 ("π/6", "3π/4", "2π"), otherwise
 * decimal ("1.00").
 */
export function radText(deg: number) {
	if (Number.isInteger(deg) && deg % 15 === 0) {
		if (deg === 0) return '0';
		const g = gcd(Math.abs(deg), 180);
		const n = deg / g;
		const d = 180 / g;
		const top = n === 1 ? 'π' : n === -1 ? '−π' : `${num(n, 0)}π`;
		return d === 1 ? top : `${top}/${d}`;
	}
	return num(toRad(deg));
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Degrees as shown: whole numbers when whole, one decimal otherwise. */
export const degText = (deg: number) =>
	`${num(deg, Number.isInteger(Math.round(deg * 10) / 10) && Math.abs(deg - Math.round(deg)) < 0.05 ? 0 : 1)}°`;

/** The angle (degrees) a step should show: the `angle` control if the step offers it. */
export function angleParam(step: Step, params: Params, fallback = 30) {
	const offered = (step.controls ?? []).some((c) => c.id === 'angle');
	return offered ? Number(params.angle) : fallback;
}
