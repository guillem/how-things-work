/**
 * The task both tiny transformers learn: adding two whole numbers, written as a string of
 * characters the model reads and writes one at a time.
 *
 * Both numbers are padded with zeros to `WIDTH` digits (a tiny model with learned positions finds
 * a column by where it sits), and the answer is written most-significant digit first, `WIDTH + 1`
 * digits, as people write it:
 *
 *   direct:      0000000457+0000000068=00000000525.
 *   scratchpad:  0000000457+0000000068=5 1 2 1 5 0 0 0 … 0 0>00000000525.
 *
 * The scratchpad ("working") is written from the units column up: for each column, the digit
 * of the column's sum and the carry it passes on (0 or 1); `>` then starts the answer. The
 * training problems have 1 to `TRAINED_DIGITS` digits; the two top columns are only ever zero
 * in training, which lets the page pose 9- and 10-digit sums the models never saw.
 *
 * Kept free of TypeScript-only syntax that Node cannot strip, so the training script in
 * `scripts/data/chain-of-thought-scratchpad/` imports it directly.
 */

/** Digits per operand, zero-padded. */
export const WIDTH = 10;
/** The longest operands in training. */
export const TRAINED_DIGITS = 8;

/** The alphabet: the ten digits, then `+ = > .` and a filler target for prompt positions. */
export const CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '=', '>', '.', '_'];
export const VOCAB = CHARS.length;
export const PLUS = 10;
export const EQUALS = 11;
export const ANSWER = 12;
export const END = 13;
/**
 * The training target at every position of the question (the two numbers): there is nothing to
 * predict there (the numbers are random), so training asks for this constant instead, which the
 * model learns at once; these positions stay in the loss, at almost zero. Never an input.
 */
export const FILLER = 14;

export type Mode = 'direct' | 'scratchpad';
export const MODES: Mode[] = ['direct', 'scratchpad'];

/** Characters of the question `a+b=`. */
export const QUESTION = 2 * WIDTH + 2;
/** Characters of the working (two per column) and the `>` that ends it. */
export const WORKING = 2 * WIDTH + 1;
/** Characters of the answer and the final `.`. */
export const ANSWER_LENGTH = WIDTH + 2;
export const lengthOf = (mode: Mode) =>
	QUESTION + (mode === 'scratchpad' ? WORKING : 0) + ANSWER_LENGTH;
/** Context of both models: the longer (scratchpad) sequence, so the two have the same weights. */
export const CONTEXT = lengthOf('scratchpad');

/** Digits of `n` from the units up, `WIDTH` of them (zero-padded). */
export function digitsOf(n: number): number[] {
	const d: number[] = [];
	for (let i = 0; i < WIDTH; i++) {
		d.push(n % 10);
		n = Math.floor(n / 10);
	}
	return d;
}

export interface Column {
	/** The two digits added in this column. */
	a: number;
	b: number;
	/** The carry coming in from the column to the right (0 or 1). */
	carryIn: number;
	/** The digit written for this column. */
	digit: number;
	/** The carry passed to the column to the left. */
	carryOut: number;
}

/** Column-by-column schoolbook addition, from the units up. */
export function columns(a: number, b: number): Column[] {
	const da = digitsOf(a);
	const db = digitsOf(b);
	const out: Column[] = [];
	let carry = 0;
	for (let i = 0; i < WIDTH; i++) {
		const s = da[i] + db[i] + carry;
		out.push({ a: da[i], b: db[i], carryIn: carry, digit: s % 10, carryOut: s >= 10 ? 1 : 0 });
		carry = s >= 10 ? 1 : 0;
	}
	return out;
}

/** Number of columns that pass a carry on. */
export const carryCount = (a: number, b: number) =>
	columns(a, b).reduce((n, c) => n + c.carryOut, 0);

/**
 * The longest carry chain: the most consecutive columns that each pass a carry on (999 + 1 has a
 * chain of 3: the carry made in the units ripples through the tens and the hundreds).
 */
export function longestChain(a: number, b: number): number {
	let best = 0;
	let run = 0;
	for (const c of columns(a, b)) {
		run = c.carryOut ? run + 1 : 0;
		best = Math.max(best, run);
	}
	return best;
}

/** Number of digits of n (at least 1). */
export const digitCount = (n: number) => (n === 0 ? 1 : Math.floor(Math.log10(n)) + 1);

const pad = (n: number, w: number) => String(n).padStart(w, '0');

/** The question as the models read it: `0000000457+0000000068=`. */
export const questionOf = (a: number, b: number) => `${pad(a, WIDTH)}+${pad(b, WIDTH)}=`;

/** The working: each column's digit and carry, units first (`5121500000…`, 2 × WIDTH chars). */
export const workingOf = (a: number, b: number) =>
	columns(a, b)
		.map((c) => `${c.digit}${c.carryOut}`)
		.join('');

/** The answer, WIDTH + 1 digits, most significant first. */
export const answerOf = (a: number, b: number) => pad(a + b, WIDTH + 1);

/** The full text one model is trained to produce after the question (working, answer, end). */
export function completionOf(mode: Mode, a: number, b: number) {
	return (mode === 'scratchpad' ? `${workingOf(a, b)}>` : '') + `${answerOf(a, b)}.`;
}

export const sequenceOf = (mode: Mode, a: number, b: number) =>
	questionOf(a, b) + completionOf(mode, a, b);

export const encode = (s: string) => Array.from(s, (c) => CHARS.indexOf(c));

/**
 * Inputs and targets of one training sequence: the targets are the next characters, except over
 * the question, where they are the constant FILLER.
 */
export function example(mode: Mode, a: number, b: number) {
	const codes = encode(sequenceOf(mode, a, b));
	const tokens = codes.slice(0, -1);
	const targets = codes.slice(1);
	for (let t = 0; t < QUESTION - 1; t++) targets[t] = FILLER;
	return { tokens, targets };
}

/**
 * Reads the answer out of a model's completion: the WIDTH + 1 digits after `>` (scratchpad) or
 * right after the question (direct), or null when they are not all digits.
 */
export function readAnswer(mode: Mode, completion: string): number | null {
	const start = mode === 'scratchpad' ? completion.indexOf('>') + 1 : 0;
	if (mode === 'scratchpad' && start === 0) return null;
	const s = completion.slice(start, start + WIDTH + 1);
	if (!/^\d+$/.test(s) || s.length !== WIDTH + 1) return null;
	return Number(s);
}

// ----------------------------------------------------------------------------- problems

/** A random number of exactly `n` digits. */
export function randomOf(n: number, random: () => number): number {
	if (n === 1) return Math.floor(random() * 10);
	const lo = 10 ** (n - 1);
	return lo + Math.floor(random() * 9 * lo);
}

/**
 * Runs of nines: consecutive columns whose two digits add up to exactly 9. Such a column passes
 * on whatever carry it gets (9 + 1 = 10: write 0, carry 1; 9 + 0: write 9, carry 0), so its digit,
 * and every digit above it in the run, depends on the column just below the run. The length of
 * the longest run is how far down a digit of the answer can depend; `carried` says whether a
 * carry comes into (the bottom of) a longest run.
 */
export function nines(a: number, b: number): { run: number; carried: boolean } {
	const cols = columns(a, b);
	let run = 0;
	let carried = false;
	let len = 0;
	for (let i = 0; i < WIDTH; i++) {
		len = cols[i].a + cols[i].b === 9 ? len + 1 : 0;
		if (len === 0) continue;
		const inCarry = cols[i - len + 1].carryIn === 1;
		if (len > run) {
			run = len;
			carried = inCarry;
		} else if (len === run && inCarry) carried = true;
	}
	return { run, carried };
}

/** A column sum, split at random into two digits. */
function split(sum: number, random: () => number): [number, number] {
	const lo = Math.max(0, sum - 9);
	const hi = Math.min(9, sum);
	const d = lo + Math.floor(random() * (hi - lo + 1));
	return [d, sum - d];
}

/**
 * A pair of `n`-digit numbers whose longest run of nines is exactly `r` columns, with a carry
 * coming into it (`carried`: the column below the run adds up to 10 or more, making a carry chain
 * r + 1 columns long) or not (the run starts at the units, or the column below adds up to 8 or
 * less). The run is planted at a random place, the other digits are random, and pairs that come
 * out different are drawn again.
 */
export function withNines(
	n: number,
	r: number,
	carried: boolean,
	random: () => number
): [number, number] {
	if (r > n || (carried && r > n - 1)) throw new Error('the run does not fit');
	const digit = () => Math.floor(random() * 10);
	for (;;) {
		const da = Array.from({ length: n }, digit);
		const db = Array.from({ length: n }, digit);
		if (r > 0) {
			const lowest = carried ? 1 : 0;
			const start = lowest + Math.floor(random() * (n - r - lowest + 1));
			for (let i = start; i < start + r; i++) [da[i], db[i]] = split(9, random);
			if (start > 0) {
				const below = carried ? 10 + Math.floor(random() * 9) : Math.floor(random() * 9);
				[da[start - 1], db[start - 1]] = split(below, random);
			}
		}
		// leading digits are not zero, so both numbers have n digits
		if (n > 1 && (da[n - 1] === 0 || db[n - 1] === 0)) continue;
		const a = da.reduceRight((s, d) => s * 10 + d, 0);
		const b = db.reduceRight((s, d) => s * 10 + d, 0);
		const got = nines(a, b);
		if (got.run === r && (r === 0 || got.carried === carried)) return [a, b];
	}
}

/**
 * One training problem: each number gets 1 to TRAINED_DIGITS digits, drawn independently and
 * uniformly. In a quarter of the problems a run of nines of random length is planted, with a
 * carry coming into it half the time, because uniformly random digits rarely make long runs
 * (both models see the same problems).
 */
export function trainingProblem(random: () => number): [number, number] {
	const na = 1 + Math.floor(random() * TRAINED_DIGITS);
	const nb = 1 + Math.floor(random() * TRAINED_DIGITS);
	if (random() < 0.25) {
		const n = Math.max(na, nb);
		const r = 1 + Math.floor(random() * n);
		const carried = r < n && random() < 0.5;
		return withNines(n, r, carried, random);
	}
	return [randomOf(na, random), randomOf(nb, random)];
}
