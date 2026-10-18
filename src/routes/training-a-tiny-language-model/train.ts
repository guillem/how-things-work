/**
 * One training run of the tiny GPT on Tiny Shakespeare, as the page's Web Worker and the offline
 * script (`scripts/data/training-a-tiny-language-model/build.ts`) both run it: the same data,
 * split, seeds, schedule, measurements and samples, so a run trained in the page retraces the
 * stored one.
 */
import { rng } from '#lib/draw/math.ts';
import {
	AdamW,
	evaluate,
	fillBatch,
	initWeights,
	LAYERS,
	sample,
	TinyGPT,
	type Config,
	type TrainSettings
} from './tiny-gpt.ts';

/** The choices the page offers. */
export const WIDTHS = [16, 32, 64] as const;
export const CONTEXTS = [8, 32, 64] as const;
/** Characters of the training part used: 10,000, 100,000, or all of it (1,003,854). */
export const DATA_SIZES = [10_000, 100_000, Infinity] as const;
export type Width = (typeof WIDTHS)[number];
export type Context = (typeof CONTEXTS)[number];
export type DataSize = (typeof DATA_SIZES)[number];

/** The run the page shows first and trains live. */
export const DEFAULT = { width: 32 as Width, context: 32 as Context, data: Infinity };

export const HEADS = 4;
export const STEPS = 3000;
/** Characters predicted per step, whatever the context: 32 windows of 32, 128 of 8 or 16 of 64. */
export const TOKENS = 1024;
export const batchOf = (context: number) => TOKENS / context;
export const SETTINGS: TrainSettings = {
	steps: STEPS,
	lr: 0.006,
	minLr: 0.0006,
	warmup: 100,
	weightDecay: 0.1,
	beta1: 0.9,
	beta2: 0.99,
	clip: 1
};
export const INIT_SEED = 1;
export const BATCH_SEED = 2;
/** Every sample is drawn with the same random numbers: only the model changes. */
export const SAMPLE_SEED = 7;
export const SAMPLE_LENGTH = 240;
/** Samples start after a blank line, where a speech begins. */
export const SAMPLE_PROMPT = '\n\n';

/** Steps at which both losses are measured. */
export const EVAL_STEPS: number[] = [0, 10, 20, 30, 40, 50, 75];
for (let s = 100; s <= STEPS; s += 100) EVAL_STEPS.push(s);
/** Steps at which a sample is written. */
export const SAMPLE_STEPS = [0, 100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000];

/** The measurement windows: 32 stretches of 256 characters spread evenly over a text. */
export const SEGMENTS = 32;
export const SEGMENT_LENGTH = 256;
export function segments(length: number): number[][] {
	const out: number[][] = [];
	const span = length - SEGMENT_LENGTH - 1;
	for (let i = 0; i < SEGMENTS; i++)
		out.push([Math.floor((i * span) / (SEGMENTS - 1)), SEGMENT_LENGTH]);
	return out;
}
/** The characters those windows predict (every character of a stretch after its first). */
export function targets(length: number): number[] {
	const out: number[] = [];
	for (const [s, n] of segments(length)) for (let p = s + 1; p <= s + n; p++) out.push(p);
	return out;
}

export const configOf = (vocab: number, width: number, context: number): Config => ({
	vocab,
	width,
	context,
	heads: HEADS,
	layers: LAYERS
});

export const runKey = (width: number, context: number, data: number) =>
	`w${width}-c${context}-d${Number.isFinite(data) ? data : 'all'}`;

export interface Point {
	step: number;
	/** Cross-entropy on the training text's measurement windows (nats per character). */
	train: number;
	/** The same on the held-out text's windows. */
	val: number;
}

/** What one run reports as it goes. */
export interface Progress {
	points: Point[];
	samples: { step: number; text: string }[];
}

export class Run {
	readonly model: TinyGPT;
	readonly opt: AdamW;
	readonly train: Int32Array;
	readonly val: Int32Array;
	readonly chars: string[];
	step = 0;
	/** Windows per batch. */
	readonly batch: number;
	private readonly random: () => number;
	private readonly tokens: Int32Array;
	private readonly next: Int32Array;
	private readonly trainSegs: number[][];
	private readonly valSegs: number[][];
	private readonly prompt: number[];
	readonly progress: Progress = { points: [], samples: [] };
	/** Milliseconds spent measuring the losses and writing samples, not training. */
	measureMs = 0;

	/**
	 * `train` and `val` are the codes (0 … chars.length − 1) of the two parts of the text;
	 * only the first `data` characters of `train` are learned from.
	 */
	constructor(
		chars: string[],
		train: Int32Array,
		val: Int32Array,
		width: number,
		context: number,
		data: number
	) {
		this.chars = chars;
		this.train = Number.isFinite(data) ? train.subarray(0, data) : train;
		this.val = val;
		const config = configOf(chars.length, width, context);
		this.batch = batchOf(context);
		this.model = new TinyGPT(config, initWeights(config, INIT_SEED), Math.max(this.batch, 64));
		this.opt = new AdamW(this.model.L, SETTINGS);
		this.random = rng(BATCH_SEED);
		this.tokens = new Int32Array(TOKENS);
		this.next = new Int32Array(TOKENS);
		this.trainSegs = segments(this.train.length);
		this.valSegs = segments(val.length);
		const index = new Map(chars.map((c, i) => [c, i]));
		this.prompt = Array.from(SAMPLE_PROMPT, (c) => index.get(c) ?? 0);
		this.measure();
	}

	get done() {
		return this.step >= STEPS;
	}

	/** Records the losses and the sample due at the current step, if any. */
	private measure() {
		const t0 = performance.now();
		const s = this.step;
		if (EVAL_STEPS.includes(s))
			this.progress.points.push({
				step: s,
				train: evaluate(this.model, this.train, this.trainSegs),
				val: evaluate(this.model, this.val, this.valSegs)
			});
		if (SAMPLE_STEPS.includes(s)) {
			const out = sample(this.model, this.prompt, SAMPLE_LENGTH, SAMPLE_SEED);
			this.progress.samples.push({ step: s, text: out.map((c) => this.chars[c]).join('') });
		}
		this.measureMs += performance.now() - t0;
	}

	/** One gradient-descent step on a fresh batch; returns that batch's loss. */
	advance(): number {
		const T = this.model.config.context;
		fillBatch(this.train, this.batch, T, this.random, this.tokens, this.next);
		this.model.forward(this.tokens, this.batch, T);
		const loss = this.model.loss(this.next);
		this.model.backward(this.tokens, this.next);
		this.opt.step(this.model.weights, this.model.grads);
		this.step++;
		this.measure();
		return loss;
	}
}
