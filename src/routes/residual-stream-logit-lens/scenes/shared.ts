/** Small helpers shared by the residual-stream scenes. */
import type { Params } from '#lib/explainer/index.ts';
import { prompt, tokenLabel } from '../lens';

export const promptOf = (params: Params) =>
	prompt(typeof params.s === 'string' ? params.s : 'mary');

/** A probability as a percentage: one decimal under 10%, none above; "<0.1%" for tiny ones. */
export function pct(p: number): string {
	const v = p * 100;
	if (v > 0 && v < 0.1) return '<0.1%';
	if (v >= 99.95 && p < 1) return '>99.9%';
	return v < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`;
}

/** A token for the stage, cut to `max` characters with an ellipsis. */
export function short(t: string, max = 9): string {
	const s = tokenLabel(t);
	return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** The token between curly quotes, as the narrative writes it. */
export const q = (t: string) => `“${tokenLabel(t)}”`;

/** "after block 3" / "the embedding" for a grid row. */
export const rowName = (r: number) => (r === 0 ? 'the embedding' : `block ${r}`);

/** Two decimals, with a real minus sign. */
export const signed = (v: number, d = 0) => {
	const s = (v * 100).toFixed(d);
	return Number(s) === 0 ? '0' : (v > 0 ? '+' : '') + s.replace('-', '−');
};
