/**
 * The live lattices the scenes draw: a seeded run that is advanced to a number of updates
 * (sweeps) as the step's clock runs, keeping a trace of its magnetisation and energy, plus the
 * SVG path that draws its up spins.
 */
import { Lattice } from './ising';

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
	 * One update at temperature T: a Metropolis sweep, or Wolff clusters worth about N spins.
	 * After a Wolff update the lattice is shown with its majority up (flipping every spin is an
	 * exact symmetry without a field, so this changes nothing physical): below T_c a Wolff
	 * cluster is most of the lattice, and the picture would otherwise flash between colours.
	 */
	step(T: number, algo: Algorithm) {
		if (algo === 'wolff') {
			this.lat.wolffSweep(T);
			if (this.lat.magnetisation() < 0) this.lat.flipAll();
		} else {
			this.lat.metropolis(T);
		}
		this.done++;
		this.m.push(this.lat.magnetisation());
		this.e.push(this.lat.energy());
	}

	/** Advances to `k` updates (at most `cap` in one call, so a long jump can't stall a frame). */
	advance(k: number, T: number, algo: Algorithm, cap = 400) {
		let n = 0;
		while (this.done < k && n++ < cap) this.step(T, algo);
	}

	/** Settles the lattice at T without recording: Wolff (fast at any T) plus Metropolis. */
	settle(T: number, updates: number) {
		for (let k = 0; k < updates; k++) {
			this.lat.wolffSweep(T);
			this.lat.metropolis(T);
		}
		if (this.lat.magnetisation() < 0) this.lat.flipAll();
	}
}

/** A coordinate with at most two decimals. */
const f = (v: number) => Math.round(v * 100) / 100;

/**
 * SVG path of the up spins of a lattice drawn at (x0, y0) with square cells of `cell` units:
 * one rectangle per run of up spins along a row, so the whole lattice is a single node.
 */
export function upPath(lat: Lattice, x0: number, y0: number, cell: number, rows = lat.h) {
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
