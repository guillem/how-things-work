/** Helpers shared by the scratchpad page's scenes: which sum is posed, and number formats. */
import { rng } from '#lib/draw/math.ts';
import type { Params } from '#lib/explainer/index.ts';
import { randomOf, TRAINED_DIGITS, withNines } from '../addition';

/** The sums the page offers by name (value: "a+b"). */
export const PRESETS: { value: string; label: string }[] = [
	{ value: '34681209+39314615', label: '34,681,209 + 39,314,615' },
	{ value: '457+68', label: '457 + 68' },
	{ value: '58272426+41038446', label: '58,272,426 + 41,038,446' },
	{ value: '38465927+51234068', label: '38,465,927 + 51,234,068' },
	{ value: '49999999+50000001', label: '49,999,999 + 50,000,001' }
];
export const RANDOM = 'random';
export const NINES = 'nines';

const presses = (v: unknown) => (typeof v === 'number' ? v : 0);

/**
 * The sum the reader has posed: a preset, or a random 8-digit sum (any, or one with a run of 5 to
 * 7 columns adding up to 9, with or without a carry coming into it), drawn from a seed that the
 * "another" button moves on.
 */
export function sumOf(p: Params): [number, number] {
	const v = String(p.sum ?? PRESETS[0].value);
	const n = presses(p.another);
	if (v === RANDOM) {
		const r = rng(1000 + n);
		return [randomOf(TRAINED_DIGITS, r), randomOf(TRAINED_DIGITS, r)];
	}
	if (v === NINES) {
		const r = rng(5000 + n);
		return withNines(TRAINED_DIGITS, 5 + Math.floor(r() * 3), r() < 0.5, r);
	}
	const m = /^(\d+)\+(\d+)$/.exec(v);
	return m ? [Number(m[1]), Number(m[2])] : [457, 68];
}

/** A whole number with thousands separators. */
export const int = (v: number) => v.toLocaleString('en-US');

/** A share as a whole percentage. */
export const pct = (v: number) => `${Math.round(v * 100)}%`;
