/**
 * The measured steady states the plots draw, built offline with the page's own lattice and
 * mean-field equations by `scripts/data/surface-catalysis/build.ts`.
 */
import { CURVES } from './curves-data.ts';

export interface Curve {
	/** CO desorption probability per trial. */
	k: number;
	/** CO fractions of the gas. */
	y: number[];
	/** Lattice (64 × 64): CO₂ per site per MCS, and the CO and O coverages. */
	rate: number[];
	co: number[];
	o: number[];
	/** The mean-field rate equations of the same moves. */
	mfRate: number[];
	mfCo: number[];
	mfO: number[];
}

export type Quantity = 'rate' | 'co' | 'o' | 'mfRate' | 'mfCo' | 'mfO';

/** The desorption probabilities the page offers (one curve set each). */
export const K_VALUES = [0, 0.02, 0.05, 0.1, 0.2] as const;

export function curve(k: number): Curve {
	const c = CURVES.find((x) => x.k === k);
	if (!c) throw new Error(`no curve for k = ${k}`);
	return c;
}

/** A quantity at CO fraction y, interpolated linearly between the grid's points. */
export function at(c: Curve, q: Quantity, y: number) {
	const xs = c.y;
	const ys = c[q];
	if (y <= xs[0]) return ys[0];
	if (y >= xs[xs.length - 1]) return ys[ys.length - 1];
	let i = 1;
	while (xs[i] < y) i++;
	const u = (y - xs[i - 1]) / (xs[i] - xs[i - 1]);
	return ys[i - 1] + u * (ys[i] - ys[i - 1]);
}

/** Where a quantity peaks: its y and value. */
export function peak(c: Curve, q: Quantity) {
	let k = 0;
	for (let i = 1; i < c.y.length; i++) if (c[q][i] > c[q][k]) k = i;
	return { y: c.y[k], value: c[q][k] };
}
