/**
 * Helpers for plots drawn inside a scene: linear scales, "nice" tick values
 * and SVG paths for data series. Pair with `<Axes>` for the frame and labels.
 */

export interface Scale {
	(v: number): number;
	domain: [number, number];
	range: [number, number];
	/** Inverse mapping, from drawing units back to data units. */
	invert(px: number): number;
}

/** Linear map from `domain` (data units) to `range` (drawing units). */
export function scale(domain: [number, number], range: [number, number]): Scale {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
	const f = ((v: number) => r0 + (v - d0) * k) as Scale;
	f.domain = domain;
	f.range = range;
	f.invert = (px: number) => (k === 0 ? d0 : d0 + (px - r0) / k);
	return f;
}

/** Round, evenly spaced tick values covering [lo, hi] (about `count` of them). */
export function ticks(lo: number, hi: number, count = 5): number[] {
	if (!(hi > lo)) return [lo];
	const raw = (hi - lo) / Math.max(1, count);
	const mag = Math.pow(10, Math.floor(Math.log10(raw)));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
	const out: number[] = [];
	for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) {
		out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
	}
	return out;
}

/** A "nice" upper bound ≥ `v` for an axis that starts at 0 (1, 2, 2.5, 5 × 10ⁿ). */
export function niceMax(v: number): number {
	if (!(v > 0)) return 1;
	const mag = Math.pow(10, Math.floor(Math.log10(v)));
	return ([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= v - 1e-12) ?? 10 * mag) as number;
}

/** SVG path through the data points (x, y) mapped by the scales. */
export function linePath<T>(
	data: readonly T[],
	x: (d: T) => number,
	y: (d: T) => number,
	sx: Scale,
	sy: Scale
): string {
	let d = '';
	for (let i = 0; i < data.length; i++) {
		d += `${i === 0 ? 'M' : 'L'}${sx(x(data[i])).toFixed(1)} ${sy(y(data[i])).toFixed(1)}`;
	}
	return d;
}

/** Closed SVG path of the band between two series (for stacked or shaded areas). */
export function areaPath<T>(
	data: readonly T[],
	x: (d: T) => number,
	lower: (d: T) => number,
	upper: (d: T) => number,
	sx: Scale,
	sy: Scale
): string {
	if (data.length === 0) return '';
	let d = '';
	for (let i = 0; i < data.length; i++) {
		d += `${i === 0 ? 'M' : 'L'}${sx(x(data[i])).toFixed(1)} ${sy(upper(data[i])).toFixed(1)}`;
	}
	for (let i = data.length - 1; i >= 0; i--) {
		d += `L${sx(x(data[i])).toFixed(1)} ${sy(lower(data[i])).toFixed(1)}`;
	}
	return d + 'Z';
}

/**
 * Keeps at most about `max` points of a long series (always keeping the first
 * and last), so that a path stays cheap to draw every frame.
 */
export function thin<T>(data: readonly T[], max = 400): readonly T[] {
	if (data.length <= max) return data;
	const stride = Math.ceil(data.length / max);
	const out: T[] = [];
	for (let i = 0; i < data.length; i += stride) out.push(data[i]);
	if (out[out.length - 1] !== data[data.length - 1]) out.push(data[data.length - 1]);
	return out;
}
