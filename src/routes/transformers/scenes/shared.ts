/** Small helpers shared by the attention scenes. */
import type { Params } from '#lib/explainer/index.ts';
import { tokenLabel } from '../attention';
import { gpt2 } from '../gpt2';

export const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** The sentence chosen in the `s` control (or `def`). */
export const sentenceOf = (params: Params, def = 'animal') =>
	gpt2.sentence(typeof params.s === 'string' ? params.s : def);

export const label = (t: string, showSpace = false) => tokenLabel(t, showSpace);

/** Width of a token chip for `text` at 13 px (a rough average glyph width). */
export const chipWidth = (text: string, size = 13, min = 26) =>
	Math.max(min, Math.round(text.length * size * 0.58 + 14));

/** Two decimals, with a real minus sign. */
export const fix = (v: number, d = 2) => {
	const s = v.toFixed(d);
	return Number(s) === 0 ? (0).toFixed(d) : s.replace('-', '−');
};

/**
 * Bars for a vector, as one path: `values[i]` scaled by `scale` px per unit, drawn up (positive)
 * or down from the line y = `mid`, each `bw` wide starting at `x`. Clamped to ± `max` px.
 */
export function bars(
	values: readonly number[],
	x: number,
	mid: number,
	bw: number,
	scale: number,
	max: number
) {
	let d = '';
	values.forEach((v, i) => {
		const h = Math.max(-max, Math.min(max, v * scale));
		if (Math.abs(h) < 0.3) return;
		const x0 = x + i * bw;
		const y0 = h > 0 ? mid - h : mid;
		d += `M${x0.toFixed(1)} ${y0.toFixed(1)}h${(bw * 0.8).toFixed(2)}v${Math.abs(h).toFixed(1)}h${(-bw * 0.8).toFixed(2)}Z`;
	});
	return d;
}

/**
 * A matrix of values in 0..1 as a few paths, one per brightness band (instead of one rect per
 * cell): `cells(i, j)` returns the value or null for no cell. Returns [{ key, d, level }].
 */
export function bands(
	n: number,
	m: number,
	value: (i: number, j: number) => number | null,
	x: number,
	y: number,
	cw: number,
	ch: number,
	levels = 8,
	gap = 0.6
) {
	const paths = Array.from({ length: levels }, () => '');
	for (let i = 0; i < n; i++)
		for (let j = 0; j < m; j++) {
			const v = value(i, j);
			if (v === null || v < 0.5 / levels) continue;
			const b = Math.min(levels - 1, Math.floor(v * levels));
			paths[b] +=
				`M${(x + j * cw + gap / 2).toFixed(1)} ${(y + i * ch + gap / 2).toFixed(1)}h${(cw - gap).toFixed(1)}v${(ch - gap).toFixed(1)}h${(gap - cw).toFixed(1)}Z`;
		}
	return paths.flatMap((d, b) => (d ? [{ key: b, d, level: (b + 0.5) / levels }] : []));
}

/** Enter or Space on a focusable SVG element acts like a click. */
export function onkey(event: KeyboardEvent, act: () => void) {
	if (event.key !== 'Enter' && event.key !== ' ') return;
	event.preventDefault();
	act();
}

/** The `n` largest weights of a row, as { j, w }. */
export const top = (row: readonly number[], n = 3) =>
	row
		.map((w, j) => ({ j, w }))
		.sort((a, b) => b.w - a.w)
		.slice(0, n);
