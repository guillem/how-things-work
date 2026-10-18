/** The measured accuracies (`results-data.ts`), as shares, with the few numbers the page quotes. */
import { countWeights } from '../training-a-tiny-language-model/tiny-gpt';
import type { Mode } from './addition';
import { NINES_CELLS, PER_CELL } from './problems';
import { results } from './results-data';

export { results };

interface Tallies {
	byDigits: number[][];
	byNines: number[][];
}
const shipped = (mode: Mode): Tallies => results[mode];

/** Share of right answers in each cell of digits 1 … 10. */
export const byDigits = (mode: Mode, t = shipped(mode)) => t.byDigits.map(([r]) => r / PER_CELL);

/** Share of right answers in a runs-of-nines cell. */
export function ninesShare(mode: Mode, run: number, carried: boolean, t = shipped(mode)): number {
	const i = NINES_CELLS.findIndex((c) => c.run === run && c.carried === carried);
	if (i < 0) throw new Error(`no cell for a run of ${run}`);
	return t.byNines[i][0] / PER_CELL;
}

/** Right answers over every runs-of-nines sum (3,200 of them), as a share. */
export const ninesTotal = (mode: Mode, t = shipped(mode)) =>
	t.byNines.reduce((s, [r]) => s + r, 0) / (t.byNines.length * PER_CELL);

/** The lowest share of right answers over the runs-of-nines cells. */
export const ninesWorst = (mode: Mode, t = shipped(mode)) =>
	Math.min(...t.byNines.map(([r]) => r)) / PER_CELL;

/** The same comparison with one block instead of two (measured, not shipped). */
export const oneBlockOf = (mode: Mode): Tallies => results.oneBlock[mode];

/**
 * Share of the 8-digit held-out sums (the 200 random ones and the 3,200 runs-of-nines ones)
 * written exactly right, through training (from the training log).
 */
export function learning(mode: Mode): { step: number; share: number }[] {
	const log = results[mode].log as unknown as [number, number, number[]][];
	return log.map(([step, , cells]) => {
		const pick = [cells[7], ...cells.slice(10)];
		return { step, share: pick.reduce((s, v) => s + v, 0) / (pick.length * PER_CELL) };
	});
}

/** Weights of each model (the same for both). */
export const weightCount = countWeights(results.direct.config);

/** A share as a whole percentage. */
export const pct = (v: number) => `${Math.round(v * 100)}%`;
