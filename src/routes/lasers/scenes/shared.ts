/** Number formatting and path helpers shared by the laser scenes. */
import type { Scale } from '#lib/draw/index.ts';

const SUP: Record<string, string> = {
	'-': '⁻',
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹'
};
export const sup = (n: number) =>
	String(n)
		.split('')
		.map((c) => SUP[c] ?? c)
		.join('');

/** 10ⁿ as text. */
export const pow10 = (n: number) => (n === 0 ? '1' : n === 1 ? '10' : `10${sup(n)}`);

/** A plain number with three significant digits, or m·10ⁿ when it is very large or small. */
export function sci(v: number, digits = 3): string {
	if (v === 0) return '0';
	const a = Math.abs(v);
	if (a >= 0.01 && a < 1e4) {
		const d = Math.max(0, digits - 1 - Math.floor(Math.log10(a)));
		return v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
	}
	let e = Math.floor(Math.log10(a));
	let m = v / 10 ** e;
	if (Number(Math.abs(m).toFixed(digits - 1)) >= 10) {
		e += 1;
		m /= 10;
	}
	const ms = m.toFixed(digits - 1).replace(/\.?0+$/, '');
	return ms === '1' ? pow10(e) : `${ms}·${pow10(e)}`;
}

/** A power in watts with a prefix: 2.15 W, 21.6 kW, 0.21 nW. */
export function watts(w: number): string {
	if (w <= 0) return '0 W';
	const units: [number, string][] = [
		[1e3, 'kW'],
		[1, 'W'],
		[1e-3, 'mW'],
		[1e-6, 'µW'],
		[1e-9, 'nW'],
		[1e-12, 'pW'],
		[1e-15, 'fW']
	];
	for (const [k, u] of units) {
		if (w >= k * 0.9995 || k === 1e-15) {
			const v = w / k;
			return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${u}`;
		}
	}
	return `${w} W`;
}

/**
 * The path of y(t) over a time window, thinned to at most two points (the lowest and the
 * highest) per drawing unit across, so that narrow spikes survive.
 */
export function tracePath(
	t: ArrayLike<number>,
	y: ArrayLike<number>,
	sx: Scale,
	sy: (v: number) => number,
	t0: number,
	t1: number
): string {
	let d = '';
	let col = NaN;
	let lo = 0;
	let hi = 0;
	let loV = Infinity;
	let hiV = -Infinity;
	let first = true;
	const flush = () => {
		if (Number.isNaN(col)) return;
		const pts = lo <= hi ? [loV, hiV] : [hiV, loV];
		for (const v of pts) {
			d += `${first ? 'M' : 'L'}${col.toFixed(1)} ${sy(v).toFixed(1)}`;
			first = false;
		}
	};
	for (let i = 0; i < t.length; i++) {
		if (t[i] < t0 || t[i] > t1) continue;
		const c = Math.round(sx(t[i]));
		if (c !== col) {
			flush();
			col = c;
			loV = Infinity;
			hiV = -Infinity;
		}
		if (y[i] < loV) {
			loV = y[i];
			lo = i;
		}
		if (y[i] > hiV) {
			hiV = y[i];
			hi = i;
		}
	}
	flush();
	return d;
}

/** A curve y(x) sampled at n points, as a path. */
export function curvePath(
	n: number,
	x0: number,
	x1: number,
	f: (x: number) => number,
	sx: (v: number) => number,
	sy: (v: number) => number
): string {
	let d = '';
	for (let i = 0; i <= n; i++) {
		const x = x0 + ((x1 - x0) * i) / n;
		d += `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(f(x)).toFixed(1)}`;
	}
	return d;
}
