// Checks the chain-of-thought-scratchpad page's task and its two shipped models: the scratchpad
// format is schoolbook addition (each column's digit and carry, the answer read off them), carry
// chains are counted the way the page says, and the shipped weights reproduce the accuracies
// stored with them and the narrative quotes.
import { expect, test } from '@playwright/test';
import { rng } from '../src/lib/draw/math';
import {
	answerOf,
	carryCount,
	completionOf,
	FILLER,
	example,
	longestChain,
	nines,
	QUESTION,
	randomOf,
	readAnswer,
	sequenceOf,
	trainingProblem,
	TRAINED_DIGITS,
	withNines,
	workingOf,
	type Mode
} from '../src/routes/chain-of-thought-scratchpad/addition';
import {
	byDigits,
	byNines,
	interventions,
	NINES_CELLS,
	PER_CELL
} from '../src/routes/chain-of-thought-scratchpad/problems';
import { results } from '../src/routes/chain-of-thought-scratchpad/results-data';
import {
	afterFlippedCarry,
	check,
	solve,
	textOf,
	type Outcome
} from '../src/routes/chain-of-thought-scratchpad/solve';
import { packWeights, unpackWeights } from '../src/routes/chain-of-thought-scratchpad/weights';
import { weights } from '../src/routes/chain-of-thought-scratchpad/weights-data';
import { TinyGPT } from '../src/routes/training-a-tiny-language-model/tiny-gpt';

test('the working of 457 + 68 is the schoolbook one, column by column from the units', () => {
	// 7 + 8 = 15: write 5, carry 1; 5 + 6 + 1 = 12: write 2, carry 1; 4 + 0 + 1 = 5: write 5
	expect(workingOf(457, 68)).toBe('512150' + '00'.repeat(7));
	expect(answerOf(457, 68)).toBe('00000000525');
	expect(sequenceOf('direct', 457, 68)).toBe('0000000457+0000000068=00000000525.');
	expect(completionOf('scratchpad', 457, 68)).toBe(`${workingOf(457, 68)}>00000000525.`);
});

test('the scratchpad of any sum is correct arithmetic, and its answer is the sum', () => {
	const random = rng(5);
	for (let i = 0; i < 500; i++) {
		const a = randomOf(1 + Math.floor(random() * 10), random);
		const b = randomOf(1 + Math.floor(random() * 10), random);
		const w = workingOf(a, b);
		const da = String(a).padStart(10, '0').split('').reverse().map(Number);
		const db = String(b).padStart(10, '0').split('').reverse().map(Number);
		let carry = 0;
		let total = 0;
		for (let c = 0; c < 10; c++) {
			const digit = Number(w[2 * c]);
			const out = Number(w[2 * c + 1]);
			// what a person adding the column with its incoming carry writes down and carries
			expect(digit + 10 * out).toBe(da[c] + db[c] + carry);
			total += digit * 10 ** c;
			carry = out;
		}
		total += carry * 10 ** 10;
		expect(total).toBe(a + b);
		expect(readAnswer('scratchpad', completionOf('scratchpad', a, b))).toBe(a + b);
		expect(readAnswer('direct', completionOf('direct', a, b))).toBe(a + b);
	}
});

test('carry chains: 999 + 1 ripples through three columns', () => {
	expect(longestChain(999, 1)).toBe(3);
	expect(carryCount(999, 1)).toBe(3);
	expect(longestChain(457, 68)).toBe(2);
	expect(longestChain(1234, 4321)).toBe(0);
	// two separate chains: 19 + 1 (one carry), and 9,000 + 1,000 (one more, not joined)
	expect(longestChain(9019, 1001)).toBe(1);
	expect(carryCount(9019, 1001)).toBe(2);
	expect(longestChain(99_999_999, 1)).toBe(8);
});

test('runs of nines: the digits above a run depend on the column below it', () => {
	// 4,999 + 5,000: columns add up to 9, 9, 9, 9 and nothing comes in: 9,999
	expect(nines(4999, 5000)).toEqual({ run: 4, carried: false });
	expect(4999 + 5000).toBe(9999);
	// change only the units, 4,999 + 5,001: 9 + 1 makes a carry that ripples to the top: 10,000
	expect(nines(4999, 5001)).toEqual({ run: 3, carried: true });
	expect(longestChain(4999, 5001)).toBe(4);
	expect(nines(1234, 4321)).toEqual({ run: 0, carried: false });
	const random = rng(3);
	for (let r = 0; r <= 8; r++)
		for (const carried of r === 0 || r === 8 ? [false] : [true, false])
			for (let i = 0; i < 40; i++) {
				const [a, b] = withNines(8, r, carried, random);
				expect(String(a)).toHaveLength(8);
				expect(String(b)).toHaveLength(8);
				expect(nines(a, b).run).toBe(r);
				// a carry into a run of r nines is a carry chain at least r + 1 columns long
				if (r > 0) expect(nines(a, b).carried).toBe(carried);
				if (carried) expect(longestChain(a, b)).toBeGreaterThanOrEqual(r + 1);
			}
});

test('training problems have 1 to 8 digits, with filler targets over the question', () => {
	const random = rng(9);
	let long = 0;
	for (let i = 0; i < 5000; i++) {
		const [a, b] = trainingProblem(random);
		expect(Math.max(a, b)).toBeLessThan(10 ** TRAINED_DIGITS);
		if (nines(a, b).run >= 5) long++;
	}
	// planted runs make long ones common enough to learn from (uniform digits: well under 1%)
	expect(long / 5000).toBeGreaterThan(0.03);
	const { tokens, targets } = example('scratchpad', 457, 68);
	expect(targets.slice(0, QUESTION - 1).every((t) => t === FILLER)).toBe(true);
	expect(targets.slice(QUESTION - 1).includes(FILLER)).toBe(false);
	expect(tokens).toHaveLength(targets.length);
});

test('half-precision weights round-trip within half precision', () => {
	const w = [0, 1, -1, 0.5, 0.1, -0.02, 1e-5, 3.14159, -65504];
	const u = unpackWeights(packWeights(w));
	expect(u).toHaveLength(w.length);
	w.forEach((x, i) => expect(Math.abs(u[i] - x)).toBeLessThanOrEqual(Math.abs(x) / 1024 + 6e-8));
	expect(u[0]).toBe(0);
	expect(u[1]).toBe(1);
	expect(u[8]).toBe(-65504);
});

// ----------------------------------------------------------------------------- shipped models

const model = (mode: Mode) => new TinyGPT(results[mode].config, unpackWeights(weights[mode]), 50);
const cellIndex = (run: number, carried: boolean) =>
	NINES_CELLS.findIndex((c) => c.run === run && c.carried === carried);
const counts = (o: Outcome[]) => [
	o.filter((x) => x.answer).length,
	o.filter((x) => x.exact).length
];

test('the shipped weights reproduce the stored accuracies', () => {
	const digits = byDigits();
	const ninesCells = byNines();
	for (const mode of ['direct', 'scratchpad'] as Mode[]) {
		const m = model(mode);
		expect(counts(check(m, mode, digits[7]))).toEqual(results[mode].byDigits[7]);
		for (const [run, carried] of [
			[0, false],
			[3, true],
			[3, false]
		] as [number, boolean][]) {
			const i = cellIndex(run, carried);
			expect(counts(check(m, mode, ninesCells[i]))).toEqual(results[mode].byNines[i]);
		}
	}
	// the same size: identical architecture, so identical weight counts
	expect(results.direct.config).toEqual(results.scratchpad.config);
});

test('as the narrative says: the scratchpad model is right everywhere within training, the direct one slips on runs of nines', () => {
	const share = (mode: Mode, run: number, carried: boolean) =>
		results[mode].byNines[cellIndex(run, carried)][0] / PER_CELL;
	for (const mode of ['direct', 'scratchpad'] as Mode[])
		// shipped models: a right answer always comes with exactly right working
		for (const cell of [...results[mode].byDigits, ...results[mode].byNines])
			expect(cell[0]).toBe(cell[1]);
	expect(results.scratchpad.byNines.every(([r]) => r === PER_CELL)).toBe(true);
	expect(results.scratchpad.byDigits.slice(0, 8).every(([r]) => r === PER_CELL)).toBe(true);
	// "nearly perfect" on random sums and without nines, "about two in three" on runs of 2–4
	// nines with no carry coming in
	expect(share('direct', 0, false)).toBeGreaterThanOrEqual(0.95);
	expect(results.direct.byDigits[7][0] / PER_CELL).toBeGreaterThanOrEqual(0.95);
	for (const run of [2, 3, 4]) {
		expect(share('direct', run, false)).toBeGreaterThan(0.55);
		expect(share('direct', run, false)).toBeLessThan(0.75);
	}
	// beyond training both fail completely
	for (const mode of ['direct', 'scratchpad'] as Mode[])
		for (const n of [8, 9]) expect(results[mode].byDigits[n][0]).toBe(0);
	// the scratchpad model learnt faster
	const at1000 = (mode: Mode) =>
		(results[mode].log as unknown as [number, number, number[]][]).find(([s]) => s === 1000)![2];
	const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
	expect(sum(at1000('scratchpad'))).toBeGreaterThan(sum(at1000('direct')));
});

test('the direct model’s wrong digits sit just above runs of nines, mostly a carry that never comes', () => {
	const m = model('direct');
	const ninesCells = byNines();
	let wrongDigits = 0;
	let far = 0;
	let tooBig = 0;
	let wrong = 0;
	for (const run of [2, 3]) {
		const cell = ninesCells[cellIndex(run, false)];
		const o = check(m, 'direct', cell);
		cell.forEach(([a, b], k) => {
			if (o[k].answer) return;
			wrong++;
			const got = textOf(solve(m, 'direct', a, b)).slice(0, 11);
			const want = answerOf(a, b);
			if (Number(got) > a + b) tooBig++;
			for (let i = 0; i < 11; i++) {
				if (got[i] === want[i]) continue;
				wrongDigits++;
				// answer digit i stands for column 10 − i; "far": the column below adds up to 9
				const c = 10 - i;
				const da = Math.floor(a / 10 ** (c - 1)) % 10;
				const db = Math.floor(b / 10 ** (c - 1)) % 10;
				if (c > 0 && da + db === 9) far++;
			}
		});
	}
	expect(wrong).toBeGreaterThan(50);
	expect(far / wrongDigits).toBeGreaterThan(0.95);
	expect(tooBig / wrong).toBeGreaterThan(0.9);
});

test('the scratchpad model’s own working is correct column arithmetic', () => {
	const m = model('scratchpad');
	const random = rng(11);
	for (let i = 0; i < 12; i++) {
		const [a, b] = withNines(8, 1 + Math.floor(random() * 7), random() < 0.5, random);
		const w = textOf(solve(m, 'scratchpad', a, b));
		const da = String(a).padStart(10, '0').split('').reverse().map(Number);
		const db = String(b).padStart(10, '0').split('').reverse().map(Number);
		let carry = 0;
		for (let c = 0; c < 10; c++) {
			expect(Number(w[2 * c]) + 10 * Number(w[2 * c + 1])).toBe(da[c] + db[c] + carry);
			carry = Number(w[2 * c + 1]);
		}
		expect(readAnswer('scratchpad', w)).toBe(a + b);
	}
});

test('the scratchpad model uses the carries it wrote: flip one and the answer follows it', () => {
	const m = model('scratchpad');
	// the stored run of the intervention: every one of the 100 sums followed the flipped carry
	expect(results.scratchpad.flipped).toEqual({ sums: 100, nextFollows: 100, answerFollows: 100 });
	for (const [a, b, col] of interventions().slice(0, 8)) {
		const out = afterFlippedCarry(m, a, b, col);
		// the true carry out of column col (with whatever came in) flipped: the answer moves by it
		const trueCarry = Math.floor(((a % 10 ** (col + 1)) + (b % 10 ** (col + 1))) / 10 ** (col + 1));
		const shift = (trueCarry ? -1 : 1) * 10 ** (col + 1);
		expect(readAnswer('scratchpad', out)).toBe(a + b + shift);
	}
});

test('the page’s first sum: the direct model writes 74,995,824 for 73,995,824', () => {
	const [a, b] = [34_681_209, 39_314_615];
	expect(readAnswer('direct', textOf(solve(model('direct'), 'direct', a, b)))).toBe(74_995_824);
	expect(readAnswer('scratchpad', textOf(solve(model('scratchpad'), 'scratchpad', a, b)))).toBe(
		73_995_824
	);
	expect(nines(a, b)).toEqual({ run: 2, carried: false });
});
