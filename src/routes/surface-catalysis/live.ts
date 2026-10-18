/**
 * The live surfaces the scenes draw: a seeded run advanced to a number of Monte Carlo steps as
 * the step's clock runs, keeping a trace of its CO₂ rate and coverages, plus the SVG paths that
 * draw the sites holding each species.
 */
import { CO, Surface } from './zgb';

/** MCS per second of animation. */
export const RATE = 20;

export class LiveRun {
	readonly s: Surface;
	/** MCS made so far. */
	done = 0;
	/** CO₂ per site made in each MCS, and the CO and O coverages after it. */
	readonly rate: number[] = [];
	readonly co: number[] = [];
	readonly o: number[] = [];

	constructor(L: number, seed: number, start: 'empty' | 'co') {
		this.s = new Surface(L, L, seed);
		if (start === 'co') this.s.fill(CO);
	}

	step(y: number, k: number) {
		const before = this.s.co2;
		this.s.mcs(y, k);
		this.done++;
		const c = this.s.coverage();
		this.rate.push((this.s.co2 - before) / this.s.n);
		this.co.push(c.co);
		this.o.push(c.o);
	}

	/** Advances to `n` MCS (at most `cap` in one call, so a long jump can't stall a frame). */
	advance(n: number, y: number, k: number, cap = 60) {
		let i = 0;
		while (this.done < n && i++ < cap) this.step(y, k);
	}

	/** The rate averaged over the `w` MCS up to and including MCS `i` (0-based). */
	smoothRate(i: number, w = 10) {
		let sum = 0;
		let n = 0;
		for (let j = Math.max(0, i - w + 1); j <= i; j++) {
			sum += this.rate[j];
			n++;
		}
		return n ? sum / n : 0;
	}

	/** CO₂ made per site since the start. */
	perSite() {
		return this.s.co2 / this.s.n;
	}
}

/** A coordinate with at most two decimals. */
const f = (v: number) => Math.round(v * 100) / 100;

/**
 * SVG path of the sites holding `species` on a surface drawn at (x0, y0) with square cells of
 * `cell` units: one rectangle per run along a row, so each species is a single node.
 */
export function speciesPath(s: Surface, species: number, x0: number, y0: number, cell: number) {
	let d = '';
	const w = s.w;
	const a = s.s;
	for (let y = 0; y < s.h; y++) {
		let x = 0;
		while (x < w) {
			if (a[y * w + x] === species) {
				const start = x;
				while (x < w && a[y * w + x] === species) x++;
				const len = (x - start) * cell;
				d += `M${f(x0 + start * cell)} ${f(y0 + y * cell)}h${f(len)}v${f(cell)}h${f(-len)}z`;
			} else x++;
		}
	}
	return d;
}
