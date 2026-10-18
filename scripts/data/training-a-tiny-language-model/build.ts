// Builds src/routes/training-a-tiny-language-model/runs-data.ts: the page's precomputed training
// runs of its tiny character-level GPT on Tiny Shakespeare, one for every combination of the
// page's width, context and data-size choices (27 runs), trained with the page's own code
// (`train.ts` and `tiny-gpt.ts`, imported from the route as they are), plus the smoothed n-gram
// baselines of `baselines.ts` counted from the same training text and scored on the same held-out
// characters.
//
// Data: Tiny Shakespeare (Karpathy's char-rnn, MIT; the text is public domain), the copy the
// n-gram page ships (scripts/data/ngram-text-models/fetch.mjs), split as nanoGPT does: the first
// 90% to learn from, the last 10% held out.
//
// Usage (Node ≥ 23 runs TypeScript directly; about 20 minutes on 10 cores):
//   node scripts/data/training-a-tiny-language-model/build.ts [workers]
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { Alphabet, split } from '../../../src/routes/ngram-text-models/ngram.ts';
import { KneserNey } from '../../../src/routes/training-a-tiny-language-model/baselines.ts';
import {
	CONTEXTS,
	DATA_SIZES,
	DEFAULT,
	EVAL_STEPS,
	Run,
	runKey,
	SAMPLE_STEPS,
	STEPS,
	targets,
	WIDTHS,
	type Point
} from '../../../src/routes/training-a-tiny-language-model/train.ts';
import { countWeights } from '../../../src/routes/training-a-tiny-language-model/tiny-gpt.ts';

const ROUTE = new URL('../../../src/routes/training-a-tiny-language-model/', import.meta.url);
const TEXT = new URL('../../../src/routes/ngram-text-models/tinyshakespeare.txt', import.meta.url);

/** The held-out line the first scene reads, character by character. */
export const PASSAGE_START = 'BAPTISTA:\nGood morrow, neighbour Gremio';

function load() {
	const text = readFileSync(TEXT, 'utf8');
	const chars = new Alphabet(text).chars;
	const index = new Map(chars.map((c, i) => [c, i]));
	const enc = (s: string) => Int32Array.from(Array.from(s), (c) => index.get(c) ?? 0);
	const { train, heldOut } = split(text);
	return { chars, train: enc(train), val: enc(heldOut), heldOut };
}

interface Job {
	width: number;
	context: number;
	data: number;
	/** held-out position of the passage to read with the model at every sample step */
	passage: number | null;
}

interface Prediction {
	/** the character's probability at each position of the passage */
	actual: number[];
	/** the four likeliest next characters at each position, with their probabilities */
	top: [string, number][][];
}

interface Result {
	key: string;
	points: Point[];
	samples: { step: number; text: string }[];
	predictions: { step: number; p: Prediction }[];
	msPerStep: number;
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

if (!isMainThread) {
	const job = workerData as Job;
	const { chars, train, val } = load();
	const run = new Run(chars, train, val, job.width, job.context, job.data);
	const predictions: Result['predictions'] = [];
	const predict = () => {
		if (job.passage === null || !SAMPLE_STEPS.includes(run.step)) return;
		const T = job.context;
		const toks = Array.from(val.subarray(job.passage, job.passage + T));
		const next = Array.from(val.subarray(job.passage + 1, job.passage + T + 1));
		run.model.forward(toks, 1, T);
		const V = chars.length;
		const P = run.model.logits;
		const p: Prediction = { actual: [], top: [] };
		for (let t = 0; t < T; t++) {
			p.actual.push(r4(P[t * V + next[t]]));
			const order = Array.from({ length: V }, (_, v) => v).sort(
				(a, b) => P[t * V + b] - P[t * V + a]
			);
			p.top.push(order.slice(0, 4).map((v) => [chars[v], r4(P[t * V + v])]));
		}
		predictions.push({ step: run.step, p });
	};
	predict();
	const t0 = performance.now();
	while (!run.done) {
		run.advance();
		predict();
	}
	const msPerStep = (performance.now() - t0) / STEPS;
	parentPort?.postMessage({
		key: runKey(job.width, job.context, job.data),
		points: run.progress.points,
		samples: run.progress.samples,
		predictions,
		msPerStep
	} satisfies Result);
} else {
	const { chars, train, val, heldOut } = load();
	const passage = heldOut.indexOf(PASSAGE_START);
	if (passage < 0) throw new Error('passage not found');
	const jobs: Job[] = [];
	for (const width of WIDTHS)
		for (const context of CONTEXTS)
			for (const data of DATA_SIZES) {
				const isDefault =
					width === DEFAULT.width && context === DEFAULT.context && data === DEFAULT.data;
				jobs.push({ width, context, data, passage: isDefault ? passage : null });
			}
	// the slowest first
	jobs.sort((a, b) => b.width * b.width * b.context - a.width * a.width * a.context);

	// baselines, per data size, on the held-out characters the transformer is measured on
	const positions = targets(val.length);
	const baselines: Record<string, Record<string, number>> = {};
	for (const data of DATA_SIZES) {
		const t = Number.isFinite(data) ? train.subarray(0, data) : train;
		const row: Record<string, number> = {};
		for (const n of [1, 2, 3, 5]) {
			const m = new KneserNey(t, n, chars.length);
			row[`n${n}`] = r4(m.crossEntropy(val, positions));
		}
		baselines[Number.isFinite(data) ? String(data) : 'all'] = row;
		console.log('baselines', data, row);
	}

	const workers = Number(process.argv[2] ?? Math.max(1, availableParallelism() - 2));
	const results: Result[] = [];
	let next = 0;
	await new Promise<void>((resolve, reject) => {
		let running = 0;
		const launch = () => {
			if (next >= jobs.length) {
				if (running === 0) resolve();
				return;
			}
			const job = jobs[next++];
			running++;
			const w = new Worker(new URL(import.meta.url), { workerData: job });
			w.on('message', (r: Result) => {
				results.push(r);
				const last = r.points[r.points.length - 1];
				console.log(
					`${r.key}: ${countWeights({ vocab: chars.length, width: job.width, context: job.context, heads: 4, layers: 2 })} weights, train ${last.train.toFixed(3)}, val ${last.val.toFixed(3)}, ${r.msPerStep.toFixed(0)} ms/step`
				);
			});
			w.on('error', reject);
			w.on('exit', () => {
				running--;
				launch();
			});
		};
		for (let i = 0; i < workers; i++) launch();
	});

	results.sort((a, b) => (a.key < b.key ? -1 : 1));
	const runs: Record<string, unknown> = {};
	let predictions: Result['predictions'] = [];
	for (const r of results) {
		runs[r.key] = {
			points: r.points.map((p) => [p.step, r4(p.train), r4(p.val)]),
			samples: r.samples.map((s) => [s.step, s.text])
		};
		if (r.predictions.length) predictions = r.predictions;
	}
	const passageText = heldOut.slice(passage, passage + DEFAULT.context + 1);
	const out = `// Generated by scripts/data/training-a-tiny-language-model/build.ts: do not edit.
// Training runs of the page's tiny GPT on Tiny Shakespeare (the text is public domain; the
// char-rnn copy is MIT); the weights and numbers are the page's own.
export const data = ${JSON.stringify({
		evalSteps: EVAL_STEPS,
		baselines,
		passage: passageText,
		predictions: predictions.map((p) => [p.step, p.p.actual, p.p.top]),
		runs
	})};
`;
	writeFileSync(new URL('runs-data.ts', ROUTE), out);
	console.log(`wrote runs-data.ts (${(out.length / 1024).toFixed(0)} kB)`);
}
