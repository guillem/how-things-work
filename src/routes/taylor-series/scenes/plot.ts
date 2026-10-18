/**
 * Geometry and text helpers for the Taylor-series scene: the shared x scale
 * of the curve plot and the complex plane under it, paths of functions that
 * may shoot off to ±10¹², and how numbers are written.
 */
import { scale, type Scale } from '#lib/draw/index.ts';
import type { FnId } from '../taylor';

/** The real line shown, and where it sits on the stage. */
export const X0 = -4;
export const X1 = 4;
export const LEFT = 64;
export const RIGHT = 624;
/** Stage units per unit of x (and of Im z in the plane: the plane is not stretched). */
export const U = (RIGHT - LEFT) / (X1 - X0);
export const sx = scale([X0, X1], [LEFT, RIGHT]);
/** The readout panel on the right. */
export const PANEL = 664;

/** The plot of the curve: full height before the plane appears, the top part after. */
export const plotBox = (split: number) => ({ top: 44, bottom: 552 - (552 - 284) * split });
/** The complex plane under the plot, and the y of its real axis. */
export const PLANE = { top: 330, bottom: 570 };
export const PLANE_Y0 = (PLANE.top + PLANE.bottom) / 2;

/** Heights shown for each function. */
export const Y_RANGE: Record<FnId, [number, number]> = {
	exp: [-2, 12],
	sin: [-2.5, 2.5],
	runge: [-1, 2],
	log: [-3, 2.5]
};

export const NAMES: Record<FnId, string> = {
	exp: 'eˣ',
	sin: 'sin x',
	runge: '1/(1 + x²)',
	log: 'log(1 + x)'
};

/**
 * SVG path of y = f(x) over the plot. Values are clamped to a band a little
 * larger than the plot (the clip path hides the rest), so a polynomial at
 * 10¹² still gives sane coordinates; NaN (log left of −1) breaks the path.
 */
export function fnPath(f: (x: number) => number, sy: Scale, samples = 280): string {
	const [lo, hi] = sy.domain;
	const pad = hi - lo;
	let d = '';
	let pen = false;
	for (let i = 0; i <= samples; i++) {
		const x = X0 + ((X1 - X0) * i) / samples;
		const y = f(x);
		if (!Number.isFinite(y)) {
			pen = false;
			continue;
		}
		const v = Math.min(hi + pad, Math.max(lo - pad, y));
		d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(v).toFixed(1)}`;
		pen = true;
	}
	return d;
}

const SUP: Record<string, string> = {
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
	'-': '⁻'
};
const SUB: Record<string, string> = {
	'0': '₀',
	'1': '₁',
	'2': '₂',
	'3': '₃',
	'4': '₄',
	'5': '₅',
	'6': '₆',
	'7': '₇',
	'8': '₈',
	'9': '₉'
};
export const sup = (v: number | string) => [...String(v)].map((c) => SUP[c] ?? c).join('');
export const sub = (v: number | string) => [...String(v)].map((c) => SUB[c] ?? c).join('');

/** A real minus sign, and never "−0.00". */
export function fixed(v: number, decimals = 2): string {
	const s = Math.abs(v).toFixed(decimals);
	return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
}

/** A number of any size, readably: 0.7998, −819, −8.6 × 10⁸, 3.2 × 10⁻⁷. */
export function num(v: number): string {
	if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—';
	const a = Math.abs(v);
	if (a === 0) return '0';
	if (a >= 1e4 || a < 1e-3) {
		const e = Math.floor(Math.log10(a));
		const m = v / 10 ** e;
		return `${fixed(m, 1)} × 10${sup(e)}`;
	}
	const digits = a >= 100 ? 0 : a >= 10 ? 2 : 4;
	return fixed(v, digits);
}

/** A power of ten for a log axis: 10⁻⁸, 1, 10⁴. */
export const pow10 = (e: number) => (e === 0 ? '1' : `10${sup(e)}`);
