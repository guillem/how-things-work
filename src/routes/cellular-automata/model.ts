/**
 * Elementary cellular automata: a row of cells, each 0 or 1, all updated at once from their own
 * state and their two neighbours'. The new state for each of the 8 neighbourhoods 111, 110, ...,
 * 000 is one bit of the rule number (Wolfram's numbering: bit k is the new state for the
 * neighbourhood whose three cells spell k in binary). The row wraps round into a ring.
 */
import { rng } from '#lib/draw/math.ts';

/** The new state for neighbourhood (left, centre, right). */
export const outcome = (rule: number, l: number, c: number, r: number) =>
	(rule >> ((l << 2) | (c << 1) | r)) & 1;

/** One generation, on a ring. */
export function step(row: Uint8Array, rule: number): Uint8Array {
	const n = row.length;
	const next = new Uint8Array(n);
	for (let i = 0; i < n; i++)
		next[i] = outcome(rule, row[(i - 1 + n) % n], row[i], row[(i + 1) % n]);
	return next;
}

/** The starting row and every generation after it, `gens` + 1 rows in all. */
export function evolve(rule: number, start: Uint8Array, gens: number): Uint8Array[] {
	const rows = [start];
	for (let g = 0; g < gens; g++) rows.push(step(rows[rows.length - 1], rule));
	return rows;
}

export function singleCell(width: number): Uint8Array {
	const row = new Uint8Array(width);
	row[Math.floor(width / 2)] = 1;
	return row;
}

export function randomRow(width: number, density: number, seed: number): Uint8Array {
	const rand = rng(seed);
	return Uint8Array.from({ length: width }, () => (rand() < density ? 1 : 0));
}

export const live = (row: Uint8Array) => row.reduce((a, b) => a + b, 0);

// ---- the space of rules -------------------------------------------------------------------

/** The same rule seen in a mirror (left and right swapped). */
export function mirror(rule: number) {
	let m = 0;
	for (let k = 0; k < 8; k++) {
		const l = (k >> 2) & 1;
		const c = (k >> 1) & 1;
		const r = k & 1;
		if (outcome(rule, l, c, r)) m |= 1 << ((r << 2) | (c << 1) | l);
	}
	return m;
}

/** The same rule with 0 and 1 swapped everywhere. */
export function complement(rule: number) {
	let m = 0;
	for (let k = 0; k < 8; k++) {
		const l = (k >> 2) & 1;
		const c = (k >> 1) & 1;
		const r = k & 1;
		if (!outcome(rule, 1 - l, 1 - c, 1 - r)) m |= 1 << k;
	}
	return m;
}

/** The rules that behave the same as `rule` up to a mirror and swapping 0 and 1; the smallest first. */
export function family(rule: number): number[] {
	return [...new Set([rule, mirror(rule), complement(rule), mirror(complement(rule))])].sort(
		(a, b) => a - b
	);
}

export type Behaviour = 'uniform' | 'repeats' | 'keeps changing';

export interface Settling {
	behaviour: Behaviour;
	/** Generations before the ring settles, and the length of the cycle it settles into. */
	transient: number;
	period: number;
}

/**
 * What a rule does to a random ring of 61 cells (half of them alive, a fixed seed), run for up to
 * 1,000 generations: settles to all-0 or all-1 ('uniform'), falls into a repeating cycle
 * ('repeats', shifting patterns included), or neither within the limit ('keeps changing').
 * An odd width keeps rule 90 from dying out, as it must on a ring of 2^k cells.
 */
export function settle(rule: number, width = 61, steps = 1000, seed = 7): Settling {
	let row = randomRow(width, 0.5, seed);
	const seen = new Map<string, number>();
	for (let g = 0; g <= steps; g++) {
		const key = row.join('');
		const first = seen.get(key);
		if (first !== undefined) {
			const n = live(row);
			const uniform = (n === 0 || n === width) && g - first === 1;
			return { behaviour: uniform ? 'uniform' : 'repeats', transient: first, period: g - first };
		}
		seen.set(key, g);
		row = step(row, rule);
	}
	return { behaviour: 'keeps changing', transient: steps, period: 0 };
}

// ---- rule 184 as traffic ----------------------------------------------------------------------

/** A ring road of `width` cells with exactly round(width * density) cars, shuffled (seeded). */
export function road(width: number, density: number, seed: number): Uint8Array {
	const rand = rng(seed);
	const cars = Math.round(width * density);
	const row = Uint8Array.from({ length: width }, (_, i) => (i < cars ? 1 : 0));
	for (let i = width - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[row[i], row[j]] = [row[j], row[i]];
	}
	return row;
}

/**
 * Rule 184 read as cars (1) on a one-lane ring road: a car moves one cell on if the cell ahead is
 * empty. Returns the share of cars that move per generation on this road, averaged over
 * `measure` generations after `warmup` generations of settling.
 */
export function trafficSpeed(start: Uint8Array, warmup = 2 * start.length, measure = 100) {
	const width = start.length;
	let row = start;
	for (let g = 0; g < warmup; g++) row = step(row, 184);
	const cars = live(row);
	if (cars === 0) return 1;
	let moved = 0;
	for (let g = 0; g < measure; g++) {
		// A car at i moves when the cell ahead (i + 1) is empty.
		for (let i = 0; i < width; i++) if (row[i] && !row[(i + 1) % width]) moved++;
		row = step(row, 184);
	}
	return moved / (cars * measure);
}
