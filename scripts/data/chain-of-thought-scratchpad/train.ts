// Trains one tiny transformer on the addition task of
// src/routes/chain-of-thought-scratchpad/addition.ts, with the training page's own model and
// optimiser (src/routes/training-a-tiny-language-model/tiny-gpt.ts), seeded.
//
// Usage: node scripts/data/chain-of-thought-scratchpad/train.ts <mode> <out.json> [key=value ...]
//   keys: width, layers, heads, steps, batch, lr, seed, every
// Prints the loss and the held-out exact-answer accuracy as it goes; writes the final weights
// (float64, as JSON) and the settings to <out.json>.
import { writeFileSync } from 'node:fs';
import { rng } from '../../../src/lib/draw/math.ts';
import {
	AdamW,
	initWeights,
	TinyGPT,
	type Config,
	type TrainSettings
} from '../../../src/routes/training-a-tiny-language-model/tiny-gpt.ts';
import {
	CONTEXT,
	example,
	lengthOf,
	questionOf,
	trainingProblem,
	VOCAB,
	type Mode
} from '../../../src/routes/chain-of-thought-scratchpad/addition.ts';
import { check } from '../../../src/routes/chain-of-thought-scratchpad/solve.ts';
import {
	byNines,
	byDigits,
	PER_CELL,
	heldOut
} from '../../../src/routes/chain-of-thought-scratchpad/problems.ts';

const [mode, outPath, ...rest] = process.argv.slice(2) as [Mode, string, ...string[]];
if (mode !== 'direct' && mode !== 'scratchpad') throw new Error('mode: direct or scratchpad');
const opt = Object.fromEntries(rest.map((kv) => kv.split('=')).map(([k, v]) => [k, Number(v)]));
const width = opt.width ?? 64;
const layers = opt.layers ?? 2;
const heads = opt.heads ?? 4;
const steps = opt.steps ?? 3000;
const batch = opt.batch ?? 32;
const seed = opt.seed ?? 1;
const every = opt.every ?? 250;

const config: Config = { vocab: VOCAB, width, context: CONTEXT, heads, layers };
const settings: TrainSettings = {
	steps,
	lr: opt.lr ?? 0.003,
	minLr: (opt.lr ?? 0.003) / 10,
	warmup: 100,
	weightDecay: 0.1,
	beta1: 0.9,
	beta2: 0.99,
	clip: 1
};

const model = new TinyGPT(config, initWeights(config, seed), batch);
const adam = new AdamW(model.L, settings);
const random = rng(seed * 1000 + 7);
const T = lengthOf(mode) - 1;
const tokens = new Int32Array(batch * T);
const targets = new Int32Array(batch * T);
const held = heldOut();
const heldKeys = new Set(held.map(([a, b]) => questionOf(a, b)));

// the held-out cells, measured as training goes: how many problems of each cell the model
// writes exactly right (every character; a lower bound on right answers, cheap to measure)
const cells = [...byDigits(), ...byNines()];
const measure = () =>
	cells.map((cell) => check(model, mode, cell, false).filter((o) => o.exact).length);

/** [step, smoothed training loss, exact counts per cell (byDigits 1…10, then byNines)] */
const log: [number, number, number[]][] = [];
const t0 = performance.now();
let avg = 0;
let measuring = 0;
for (let step = 1; step <= steps; step++) {
	for (let k = 0; k < batch; k++) {
		let p = trainingProblem(random);
		while (heldKeys.has(questionOf(p[0], p[1]))) p = trainingProblem(random);
		const ex = example(mode, p[0], p[1]);
		tokens.set(ex.tokens, k * T);
		targets.set(ex.targets, k * T);
	}
	model.forward(tokens, batch, T);
	const loss = model.loss(targets);
	model.backward(tokens, targets);
	adam.step(model.weights, model.grads);
	avg = step === 1 ? loss : 0.98 * avg + 0.02 * loss;
	if (step % every === 0 || step === steps) {
		const m0 = performance.now();
		const counts = measure();
		measuring += performance.now() - m0;
		log.push([step, Math.round(avg * 1e4) / 1e4, counts]);
		const acc = counts.slice(0, 8).reduce((x, y) => x + y, 0) / (8 * PER_CELL);
		const ms = (performance.now() - t0 - measuring) / step;
		console.log(
			`${mode} w${width} l${layers} s${seed} step ${step} loss ${avg.toFixed(4)} exact(1-8 digits) ${acc.toFixed(3)} nines ${counts.slice(10).join(' ')} ${ms.toFixed(0)} ms/step`
		);
	}
}
writeFileSync(
	outPath,
	JSON.stringify({
		mode,
		config,
		settings,
		seed,
		batch,
		log,
		msPerStep: (performance.now() - t0 - measuring) / steps,
		weights: Array.from(model.weights)
	})
);
