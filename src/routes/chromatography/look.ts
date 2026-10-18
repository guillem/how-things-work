/**
 * What the scenes share: the compounds of the mixture, the conditions a step sets (a control's
 * value on the steps that offer it, the default elsewhere), and helpers to draw peaks and many
 * dots cheaply.
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import { DEFAULT, type Compound, type Conditions } from './model';

/** Compound 1's retention factor; compound 2's is a control on some steps (default 2). */
export const K1 = 1.8;
export const K2 = 2;

/** The surfaces of the tailing step. */
export const SURFACES: Record<string, Partial<Compound>> = {
	even: {},
	sticky: { sticky: { share: 1e-4, hold: 2 } },
	slow: { exchange: 1 / 2000 }
};

const offers = (step: Step, id: string) => step.controls?.some((c) => c.id === id) ?? false;

/** The column's conditions and the compounds on this step. */
export function setup(step: Step, params: Params) {
	const num = (id: string, fallback: number) => (offers(step, id) ? Number(params[id]) : fallback);
	const c: Conditions = {
		L: num('L', DEFAULT.L),
		u: offers(step, 'logu') ? Number((10 ** Number(params.logu)).toPrecision(2)) : DEFAULT.u,
		dp: offers(step, 'dp') ? Number(params.dp) : DEFAULT.dp
	};
	const surface = offers(step, 'surface') ? String(params.surface) : 'even';
	const extra = SURFACES[surface] ?? {};
	const k2 = num('k2', K2);
	const compounds: { id: 'marker' | 'c1' | 'c2'; cmp: Compound }[] = [
		{ id: 'marker', cmp: { k: 0 } },
		{ id: 'c1', cmp: { k: K1, ...extra } },
		{ id: 'c2', cmp: { k: k2, ...extra } }
	];
	return { c, compounds, k2, surface };
}

/**
 * A smoothed histogram of `times` on [t0, t1] in `bins` bins (Gaussian kernel of `smooth`
 * bins), scaled so that its area is `weight`.
 */
export function density(
	times: ArrayLike<number>,
	t0: number,
	t1: number,
	bins: number,
	smooth: number,
	weight = 1
) {
	const raw = new Float64Array(bins);
	const w = (t1 - t0) / bins;
	for (let i = 0; i < times.length; i++) {
		const b = Math.floor((times[i] - t0) / w);
		if (b >= 0 && b < bins) raw[b]++;
	}
	const out = new Float64Array(bins);
	const R = Math.ceil(3 * smooth);
	const kern = Array.from({ length: 2 * R + 1 }, (_, j) =>
		Math.exp(-0.5 * ((j - R) / smooth) ** 2)
	);
	const ksum = kern.reduce((a, b) => a + b, 0);
	const scale = weight / (times.length * w * ksum);
	for (let b = 0; b < bins; b++) {
		if (raw[b] === 0) continue;
		for (let j = -R; j <= R; j++) {
			const o = b + j;
			if (o >= 0 && o < bins) out[o] += raw[b] * kern[j + R] * scale;
		}
	}
	return out;
}

/** One SVG path drawing a dot of radius r at each point (one node for many dots). */
export function dotsPath(xs: readonly number[], ys: readonly number[], r: number) {
	let d = '';
	for (let i = 0; i < xs.length; i++) {
		const x = xs[i];
		const y = ys[i];
		d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
	}
	return d;
}

/** Number with thin-space thousands, e.g. 6 400. */
export const thousands = (v: number) =>
	Math.round(v)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Seconds, with one decimal under 10 s. */
export const seconds = (v: number) => (v < 10 ? v.toFixed(1) : Math.round(v).toString());
