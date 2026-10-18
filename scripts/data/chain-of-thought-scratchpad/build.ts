// Builds results-data.ts and weights-data.ts in src/routes/chain-of-thought-scratchpad/ from two
// training runs written by train.ts (one direct, one scratchpad): the weights rounded to half
// precision, and the accuracies measured with those rounded weights (the ones the page runs) on
// the held-out problems of problems.ts, by number of digits and by run of nines.
//
// Two more runs, with one block instead of two, can follow: their accuracies (not their weights)
// are stored too, for the page's note on depth.
//
// Usage (Node ≥ 23 runs TypeScript directly; each run takes 20 to 40 minutes on one core):
//   T=scripts/data/chain-of-thought-scratchpad/train.ts
//   node $T direct runs/direct.json width=48 layers=2 steps=8000 every=500
//   node $T scratchpad runs/scratch.json width=48 layers=2 steps=8000 every=500
//   node $T direct runs/direct1.json width=48 layers=1 steps=8000 every=500
//   node $T scratchpad runs/scratch1.json width=48 layers=1 steps=8000 every=500
//   node scripts/data/chain-of-thought-scratchpad/build.ts runs/direct.json runs/scratch.json \
//     runs/direct1.json runs/scratch1.json
// The settings of the shipped runs are stored in results-data.ts.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { columns, type Mode } from '../../../src/routes/chain-of-thought-scratchpad/addition.ts';
import {
	byDigits,
	byNines,
	interventions
} from '../../../src/routes/chain-of-thought-scratchpad/problems.ts';
import {
	afterFlippedCarry,
	check,
	solve,
	textOf
} from '../../../src/routes/chain-of-thought-scratchpad/solve.ts';
import {
	packWeights,
	unpackWeights
} from '../../../src/routes/chain-of-thought-scratchpad/weights.ts';
import {
	TinyGPT,
	type Config
} from '../../../src/routes/training-a-tiny-language-model/tiny-gpt.ts';

const ROUTE = new URL('../../../src/routes/chain-of-thought-scratchpad/', import.meta.url);
const RESULTS = new URL('results-data.ts', ROUTE);
const WEIGHTS = new URL('weights-data.ts', ROUTE);

interface RunFile {
	mode: Mode;
	config: Config;
	settings: { steps: number; lr: number; minLr: number; warmup: number; weightDecay: number };
	seed: number;
	batch: number;
	log: [number, number, number[]][];
	msPerStep: number;
	weights: number[];
}

const paths = process.argv.slice(2);
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as RunFile;
const runs = paths.slice(0, 2).map(load);
const oneBlockRuns = paths.slice(2, 4).map(load);
for (const pair of [runs, oneBlockRuns])
	if (pair.length && (pair[0].mode !== 'direct' || pair[1].mode !== 'scratchpad'))
		throw new Error('give each pair direct first, then scratchpad');

const digits = byDigits();
const ninesCells = byNines();

/**
 * Where a model's wrong answers are wrong. An answer digit (column c; c = 10 is the top carry) is
 * "far" when column c − 1 adds up to 9: then the carry into c is not settled by column c − 1 but
 * further down, across a run of nines. Over the held-out problems within the trained lengths
 * (the 8-digit random sums and the runs-of-nines sums), counts the wrong digits of wrong answers
 * and how many of them are far, and the far digits among all digits (the share a model that erred
 * anywhere at random would show).
 */
function whereWrong(model: TinyGPT, mode: Mode, problems: [number, number][]) {
	const far = (a: number, b: number, c: number) => {
		const cols = columns(a, b);
		return c > 0 && cols[c - 1].a + cols[c - 1].b === 9;
	};
	const o = check(model, mode, problems);
	const r = { answers: problems.length, wrong: 0, wrongDigits: 0, wrongFar: 0, digits: 0, far: 0 };
	problems.forEach(([a, b], k) => {
		for (let c = 0; c <= 10; c++) {
			r.digits++;
			if (far(a, b, c)) r.far++;
		}
		if (o[k].answer) return;
		r.wrong++;
		const text = textOf(solve(model, mode, a, b));
		const start = mode === 'scratchpad' ? text.indexOf('>') + 1 : 0;
		const got = text.slice(start, start + 11).padEnd(11, '?');
		const want = String(a + b).padStart(11, '0');
		for (let i = 0; i < 11; i++) {
			if (got[i] === want[i]) continue;
			r.wrongDigits++;
			if (far(a, b, 10 - i)) r.wrongFar++; // answer position i is column 10 − i
		}
	});
	return r;
}

/**
 * The scratchpad intervention (problems.ts `interventions`): flip one carry in the working and
 * let the model go on. Counts the sums where the next column's digit follows the flipped carry,
 * and where the final answer is off from the true sum by exactly that carry.
 */
function flipCarries(model: TinyGPT) {
	const r = { sums: 0, nextFollows: 0, answerFollows: 0 };
	for (const [a, b, col] of interventions()) {
		r.sums++;
		const out = afterFlippedCarry(model, a, b, col);
		const cols = columns(a, b);
		const flipped = 1 - cols[col].carryOut;
		if (Number(out[0]) === (cols[col + 1].a + cols[col + 1].b + flipped) % 10) r.nextFollows++;
		const start = out.indexOf('>') + 1;
		const shift = (flipped ? 1 : -1) * 10 ** (col + 1);
		if (start > 0 && Number(out.slice(start, start + 11)) === a + b + shift) r.answerFollows++;
	}
	return r;
}

function measure(run: RunFile) {
	const packed = packWeights(run.weights);
	const model = new TinyGPT(run.config, unpackWeights(packed), 50);
	const tally = (cells: [number, number][][]) =>
		cells.map((cell) => {
			const o = check(model, run.mode, cell);
			return [o.filter((x) => x.answer).length, o.filter((x) => x.exact).length];
		});
	const t0 = performance.now();
	const result = {
		mode: run.mode,
		config: run.config,
		steps: run.settings.steps,
		batch: run.batch,
		lr: run.settings.lr,
		seed: run.seed,
		msPerStep: Math.round(run.msPerStep),
		/** [step, smoothed training loss, exactly right per cell: byDigits, then byNines] */
		log: run.log,
		byDigits: tally(digits),
		byNines: tally(ninesCells),
		errors: whereWrong(model, run.mode, [...digits[7], ...ninesCells.flat()]),
		flipped: run.mode === 'scratchpad' ? flipCarries(model) : null,
		weights: packed
	};
	console.log(run.mode, `${((performance.now() - t0) / 1000).toFixed(0)} s`);
	console.log('  digits', result.byDigits.map(([a]) => a).join(' '));
	console.log('  nines ', result.byNines.map(([a]) => a).join(' '));
	console.log('  exact ', result.byNines.map(([, e]) => e).join(' '));
	console.log('  errors', result.errors, 'flipped', result.flipped);
	return result;
}

const out = runs.map(measure);
const oneBlock = oneBlockRuns.map(measure).map((r) => ({
	config: r.config,
	steps: r.steps,
	byDigits: r.byDigits,
	byNines: r.byNines
}));

const head = `// Generated by scripts/data/chain-of-thought-scratchpad/build.ts: do not edit.
// Two tiny transformers trained by the project on generated addition problems (see train.ts
// there); the weights are the project's own, under the site's MIT licence.
`;
const results = out.map((r) => ({ ...r, weights: undefined }));
writeFileSync(
	RESULTS,
	head +
		`// Accuracies measured with the shipped (half-precision) weights on the held-out problems of
// problems.ts: [right answers, exactly right transcripts] out of PER_CELL per cell.
// oneBlock: the same comparison with one block instead of two (weights not shipped).
export const results = ${JSON.stringify({
			direct: results[0],
			scratchpad: results[1],
			oneBlock: oneBlock.length ? { direct: oneBlock[0], scratchpad: oneBlock[1] } : null
		})};
`
);
writeFileSync(
	WEIGHTS,
	head +
		`// The weights, rounded to half precision, base64 (see weights.ts).
export const weights = ${JSON.stringify({ direct: out[0].weights, scratchpad: out[1].weights })};
`
);
execFileSync('npx', ['prettier', '--write', RESULTS.pathname, WEIGHTS.pathname], {
	stdio: 'inherit'
});
