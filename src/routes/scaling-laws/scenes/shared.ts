/** Formatting helpers and control readers shared by the scaling scenes. */
import type { Params } from '#lib/explainer/index.ts';
import { fitById, type ParametricFit } from '../laws';
import { SWEEP_DATA, SWEEP_WIDTHS } from '../sweep';

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
/** 10 to a whole power, with a superscript: 10²³. */
export const pow10 = (k: number) =>
	`10${String(Math.round(k))
		.split('')
		.map((c) => SUP[c] ?? c)
		.join('')}`;

/** A number in scientific notation: 5.8 × 10²³. */
export function sci(v: number, digits = 1): string {
	if (v === 0) return '0';
	const k = Math.floor(Math.log10(v));
	const m = v / 10 ** k;
	const ms = m.toFixed(digits);
	if (ms.startsWith('10')) return `1 × ${pow10(k + 1)}`;
	return Number(ms) === 1 ? pow10(k) : `${ms} × ${pow10(k)}`;
}

/** A count with the usual suffixes: 1.8 thousand → "1.8k", 7.0e10 → "70B", 1.4e12 → "1.4T". */
export function short(v: number): string {
	const units: [number, string][] = [
		[1e15, 'P'],
		[1e12, 'T'],
		[1e9, 'B'],
		[1e6, 'M'],
		[1e3, 'k']
	];
	for (const [u, s] of units)
		if (v >= u) {
			const x = v / u;
			return `${x >= 10 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, '')}${s}`;
		}
	return v.toFixed(0);
}

export const int = (v: number) => Math.round(v).toLocaleString('en-US');
export const nats = (v: number) => v.toFixed(2);

/** The amount of training text a select picks (its values are '10000' … 'all'). */
export const sizeOf = (p: Params, id = 'size') => {
	const v = p[id];
	const n = v === 'all' ? Infinity : Number(v);
	return SWEEP_DATA.includes(n) ? n : Infinity;
};
export const widthOf = (p: Params, id = 'width') => {
	const n = Number(p[id]);
	return SWEEP_WIDTHS.includes(n) ? n : 32;
};
export const sizeLabel = (size: number) =>
	Number.isFinite(size) ? `${int(size)} characters` : 'all 1,003,854 characters';
export const sizeShort = (size: number) => (Number.isFinite(size) ? short(size) : 'all 1M');

/** The fit the select picks. */
export const fitOf = (p: Params): ParametricFit => fitById(String(p.fit ?? 'hoffmann'));
/** The compute budget, from the slider's log10 value. */
export const budgetOf = (p: Params) => {
	const v = Number(p.budget);
	return 10 ** (Number.isFinite(v) ? Math.min(26, Math.max(18, v)) : 23.76);
};
