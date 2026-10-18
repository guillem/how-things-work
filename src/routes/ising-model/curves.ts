/**
 * The measured curves (thermal averages per spin against temperature) the plots draw, built
 * offline with the page's own Monte Carlo by `scripts/data/ising-model/build.ts`.
 */
import { CURVES } from './curves-data.ts';

export interface Curve {
	/** 2 for a square lattice of size × size spins, 1 for a ring of `size` spins. */
	dim: 1 | 2;
	size: number;
	/** Temperatures, k·T / J. */
	T: number[];
	/** ⟨|m|⟩ */
	m: number[];
	/** ⟨E⟩ / N */
	e: number[];
	/** Susceptibility per spin, N (⟨m²⟩ − ⟨|m|⟩²) / T. */
	chi: number[];
	/** Heat capacity per spin, in units of k. */
	c: number[];
}

export type Quantity = 'm' | 'e' | 'chi' | 'c';

export const SQUARE_SIZES = [8, 16, 32, 64] as const;
export const RING_SIZES = [16, 64, 256, 1024] as const;

export function curve(dim: 1 | 2, size: number): Curve {
	const c = CURVES.find((k) => k.dim === dim && k.size === size);
	if (!c) throw new Error(`no curve for ${dim}D size ${size}`);
	return c;
}

/** A quantity at temperature T, interpolated linearly between the grid's temperatures. */
export function at(c: Curve, q: Quantity, T: number) {
	const xs = c.T;
	const ys = c[q];
	if (T <= xs[0]) return ys[0];
	if (T >= xs[xs.length - 1]) return ys[ys.length - 1];
	let i = 1;
	while (xs[i] < T) i++;
	const u = (T - xs[i - 1]) / (xs[i] - xs[i - 1]);
	return ys[i - 1] + u * (ys[i] - ys[i - 1]);
}

/** Where a quantity peaks: its temperature and value. */
export function peak(c: Curve, q: Quantity) {
	let k = 0;
	for (let i = 1; i < c.T.length; i++) if (c[q][i] > c[q][k]) k = i;
	return { T: c.T[k], value: c[q][k] };
}
