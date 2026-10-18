/**
 * The held-out problems, drawn from their own seeds (never used in training: the training script
 * skips any problem whose question is among them), PER_CELL in each cell.
 * - `byDigits`: for n = 1 … 10, pairs of n-digit numbers (9 and 10 digits: beyond training).
 * - `byNines`: 8-digit pairs whose longest run of nines (columns adding up to 9) is r columns,
 *   with a carry coming into the run or not (see `NINES_CELLS`).
 */
import { rng } from '#lib/draw/math.ts';
import { randomOf, WIDTH, withNines } from './addition.ts';

export const PER_CELL = 200;
export const NINES_DIGITS = 8;

/** The cells of `byNines`: run length, and whether a carry comes into the run. */
export const NINES_CELLS: { run: number; carried: boolean }[] = [{ run: 0, carried: false }];
for (let r = 1; r < NINES_DIGITS; r++)
	NINES_CELLS.push({ run: r, carried: true }, { run: r, carried: false });
NINES_CELLS.push({ run: NINES_DIGITS, carried: false });

export function byDigits(): [number, number][][] {
	const random = rng(101);
	const out: [number, number][][] = [];
	for (let n = 1; n <= WIDTH; n++) {
		const cell: [number, number][] = [];
		for (let i = 0; i < PER_CELL; i++) cell.push([randomOf(n, random), randomOf(n, random)]);
		out.push(cell);
	}
	return out;
}

export function byNines(): [number, number][][] {
	const random = rng(303);
	return NINES_CELLS.map(({ run, carried }) => {
		const cell: [number, number][] = [];
		for (let i = 0; i < PER_CELL; i++) cell.push(withNines(NINES_DIGITS, run, carried, random));
		return cell;
	});
}

/**
 * The sums of the scratchpad intervention: 100 random 8-digit sums, each with a column (0 … 6)
 * whose carry is flipped in the working (see `afterFlippedCarry` in solve.ts).
 */
export function interventions(): [number, number, number][] {
	const random = rng(404);
	return Array.from({ length: 100 }, () => [
		randomOf(NINES_DIGITS, random),
		randomOf(NINES_DIGITS, random),
		Math.floor(random() * (NINES_DIGITS - 1))
	]);
}

/** Every held-out problem within the trained lengths. */
export const heldOut = (): [number, number][] => [
	...byDigits().slice(0, NINES_DIGITS).flat(),
	...byNines().flat()
];
