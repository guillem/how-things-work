/**
 * Drawing constants shared by the special-relativity scenes. Every scene uses
 * the same speed of light on screen, so the animations can be compared.
 */

/** The speed of light on the stage, in stage units per second of animation. */
export const C_PX = 160;

/** `u` wrapped into [a, b). */
export function wrap(u: number, a: number, b: number) {
	const span = b - a;
	return a + ((((u - a) % span) + span) % span);
}

/** How far `u` is from being wrapped back into [a, b): the shift subtracted. */
export function wrapShift(u: number, a: number, b: number) {
	return u - wrap(u, a, b);
}

/** Opacity that fades something in and out near the ends of [a, b]. */
export function edgeFade(x: number, a: number, b: number, ramp = 50) {
	const fin = Math.min(1, Math.max(0, (x - a) / ramp));
	const fout = Math.min(1, Math.max(0, (b - x) / ramp));
	return Math.min(fin, fout);
}

/** A duration in seconds as a readable string: ns, µs. */
export function duration(seconds: number) {
	const ns = seconds * 1e9;
	if (Math.abs(ns) < 1000) return `${ns.toFixed(Math.abs(ns) < 100 ? 1 : 0)} ns`;
	return `${(ns / 1000).toFixed(2)} µs`;
}
