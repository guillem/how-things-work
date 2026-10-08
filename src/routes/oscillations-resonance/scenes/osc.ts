/**
 * Helpers shared by the three oscillation scenes: the common layout (drawing on
 * the left, readout card top right, trace below it), sampled-motion lookups and
 * the coil of a spring.
 */

/** Every motion is precomputed at 60 samples per second. */
export const SAMPLE = 1 / 60;

/** Centre of the drawing column (spring, pendulum). */
export const COL_X = 220;
/** Readout card, top right. */
export const CARD = { x: 440, y: 16, w: 504, h: 100 };
/** Horizontal extent of the plots under the card. */
export const PLOT_X0 = 516;
export const PLOT_X1 = 920;

/** Linear interpolation of a sampled series at time s (clamped to its ends). */
export function valueAt(arr: Float64Array, s: number): number {
	const f = Math.max(0, s / SAMPLE);
	const i = Math.min(arr.length - 2, Math.floor(f));
	const u = Math.min(1, f - i);
	return arr[i] + (arr[i + 1] - arr[i]) * u;
}

/**
 * Times (s) of the crests of a sampled series: its local maxima (sign 1) or
 * minima (sign −1), refined with a parabola. The first sample is never a crest.
 */
export function crests(arr: Float64Array, sign = 1): number[] {
	const out: number[] = [];
	for (let i = 1; i < arr.length - 1; i++) {
		const a = sign * arr[i - 1];
		const b = sign * arr[i];
		const c = sign * arr[i + 1];
		if (b > a && b >= c) {
			const den = a - 2 * b + c;
			const d = den === 0 ? 0 : (0.5 * (a - c)) / den;
			out.push((i + d) * SAMPLE);
		}
	}
	return out;
}

/**
 * Time to read from a motion computed for `end` seconds when the clock runs
 * past it: the last whole period repeats (a steady swing goes on for ever).
 */
export function loopTime(s: number, end: number, period: number): number {
	const e = end - 0.05;
	if (s <= e) return s;
	if (!(period > 0) || period > e) return e;
	const base = e - period;
	return base + ((s - base) % period);
}

/**
 * The last two crests at or before time s, extending the list periodically
 * past the end of the computed motion (see `loopTime`).
 */
export function lastTwo(list: number[], s: number, end: number, period: number) {
	const e = end - 0.05;
	if (s <= e || !(period > 0)) {
		let j = -1;
		for (let i = 0; i < list.length && list[i] <= Math.min(s, e); i++) j = i;
		return j >= 1 ? [list[j - 1], list[j]] : null;
	}
	const known = list.filter((c) => c <= e);
	const last = known.at(-1);
	if (last === undefined) return null;
	const n = Math.floor((s - last) / period);
	const c2 = last + n * period;
	return [c2 - period, c2];
}

/** Zig-zag coil of a spring hanging at x from y1 down to y2, with straight ends. */
export function coilPath(x: number, y1: number, y2: number, turns = 11, w = 24, lead = 10) {
	const top = y1 + lead;
	const bottom = Math.max(top + 4, y2 - lead);
	const n = turns * 2;
	let d = `M${x} ${y1} L${x} ${top.toFixed(1)}`;
	for (let i = 0; i < n; i++) {
		const y = top + ((i + 0.5) / n) * (bottom - top);
		d += ` L${(x + (i % 2 === 0 ? w / 2 : -w / 2)).toFixed(1)} ${y.toFixed(1)}`;
	}
	return d + ` L${x} ${bottom.toFixed(1)} L${x} ${y2.toFixed(1)}`;
}

/** A length in metres as centimetres (or metres when it gets big). */
export const fmtLen = (m: number) =>
	!Number.isFinite(m) ? '∞' : m < 0.995 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(2)} m`;

/** One cell of the readout card. */
export interface Cell {
	id: string;
	label: string;
	value: string;
	sub?: string;
	color?: string;
	/** 0–1: draws a bar under the value instead of the note. */
	bar?: number;
	barColor?: string;
}
