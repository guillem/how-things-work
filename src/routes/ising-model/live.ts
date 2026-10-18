/**
 * The live lattices the scenes draw: a seeded run that is advanced to a number of updates
 * (sweeps) as the step's clock runs, keeping a trace of its magnetisation and energy, plus the
 * SVG path that draws its up spins.
 */
import { Lattice } from './ising';
import { at, curve } from './curves';

export type Algorithm = 'metropolis' | 'wolff';

/** Updates per second of animation. */
export const RATE = 30;

export class LiveRun {
	readonly lat: Lattice;
	/** Updates made so far. */
	done = 0;
	/** m and E/N after each update. */
	readonly m: number[] = [];
	readonly e: number[] = [];

	constructor(L: number, H: number, seed: number) {
		this.lat = new Lattice(L, H, seed);
	}

	/**
	 * One update at temperature T: a Metropolis sweep, or a fixed number of Wolff clusters that
	 * flip about N spins on average at this temperature and size (see `wolffCount`).
	 */
	step(T: number, algo: Algorithm) {
		if (algo === 'wolff') this.lat.wolffClusters(T, wolffCount(T, this.lat.w));
		else this.lat.metropolis(T);
		this.done++;
		this.m.push(this.lat.magnetisation());
		this.e.push(this.lat.energy());
	}

	/** Advances to `k` updates (at most `cap` in one call, so a long jump can't stall a frame). */
	advance(k: number, T: number, algo: Algorithm, cap = 400) {
		let n = 0;
		while (this.done < k && n++ < cap) this.step(T, algo);
	}

	/**
	 * Settles the lattice at T without recording: Wolff clusters (fast at any T) and Metropolis
	 * sweeps. Ends with the majority up: flipping every spin preserves the energy and the
	 * Boltzmann weight without a field, so it is a fair starting point either way round.
	 */
	settle(T: number, updates: number) {
		const count = wolffCount(T, this.lat.w);
		for (let k = 0; k < updates; k++) {
			this.lat.wolffClusters(T, count);
			this.lat.metropolis(T);
		}
		if (this.lat.magnetisation() < 0) this.lat.flipAll();
	}
}

/**
 * Wolff clusters per update for an L × L lattice at T: about N spins' worth. The average Wolff
 * cluster holds N⟨m²⟩ spins, so that is 1 / ⟨m²⟩ clusters, with ⟨m²⟩ = χT / N + ⟨|m|⟩² from the
 * measured curves. It depends only on T and L, never on the run (which would bias it).
 */
export function wolffCount(T: number, L: number) {
	const c = curve(2, L);
	const m = at(c, 'm', T);
	const m2 = (at(c, 'chi', T) * T) / (L * L) + m * m;
	return Math.max(1, Math.min(L * L, Math.round(1 / Math.max(m2, 1e-9))));
}

/** A coordinate with at most two decimals. */
const f = (v: number) => Math.round(v * 100) / 100;

/**
 * SVG path of the up spins of a lattice drawn at (x0, y0) with square cells of `cell` units:
 * one rectangle per run of up spins along a row, so the whole lattice is a single node.
 */
export function upPath(lat: Lattice, x0: number, y0: number, cell: number) {
	const rows = lat.h;
	let d = '';
	const w = lat.w;
	const s = lat.s;
	for (let y = 0; y < rows; y++) {
		let x = 0;
		while (x < w) {
			if (s[y * w + x] > 0) {
				const start = x;
				while (x < w && s[y * w + x] > 0) x++;
				const len = (x - start) * cell;
				d += `M${f(x0 + start * cell)} ${f(y0 + y * cell)}h${f(len)}v${f(cell)}h${f(-len)}z`;
			} else x++;
		}
	}
	return d;
}

/** The same for a row of spins given as an array (one row of the chain's history). */
export function rowPath(row: Int8Array, x0: number, y0: number, cw: number, ch: number) {
	let d = '';
	let x = 0;
	while (x < row.length) {
		if (row[x] > 0) {
			const start = x;
			while (x < row.length && row[x] > 0) x++;
			const len = (x - start) * cw;
			d += `M${f(x0 + start * cw)} ${f(y0)}h${f(len)}v${f(ch)}h${f(-len)}z`;
		} else x++;
	}
	return d;
}
