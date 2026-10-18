/** Helpers the resampling scenes share: the chosen groups of penguins and number formats. */
import type { Params } from '#lib/explainer/index.ts';
import { COMPARISONS, pick } from '../resample';

/** The two groups the controls pick (`comparison`, `perGroup`), drawn with the `redraw` seed. */
export function chosenGroups(params: Params) {
	const id = String(params.comparison ?? 'species');
	const cmp = COMPARISONS[id] ?? COMPARISONS.species;
	const per = String(params.perGroup ?? 'all');
	const k = per === 'all' ? Infinity : Number(per);
	const seed = 1 + Number(params.redraw ?? 0);
	return {
		id,
		cmp,
		seed,
		key: `${id}|${per}|${seed}`,
		a: pick(cmp.a.values, k, seed),
		b: pick(cmp.b.values, k, seed),
		/** Axis range for flipper length: all the penguins of both groups, padded to 5 mm. */
		range: [
			Math.floor((Math.min(...cmp.a.values, ...cmp.b.values) - 1) / 5) * 5,
			Math.ceil((Math.max(...cmp.a.values, ...cmp.b.values) + 1) / 5) * 5
		] as [number, number]
	};
}

export const signed = (v: number, digits = 1) =>
	`${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(digits)}`;

export const fmt = (v: number) => v.toLocaleString('en-US');

/** A p-value with sensible digits. */
export const pText = (p: number) =>
	p < 0.001 ? p.toFixed(4) : p < 0.1 ? p.toFixed(3) : p.toFixed(2);
