/**
 * The page's own scaling sweep (sweep-data.ts, built by scripts/data/scaling-laws/build.ts):
 * the tiny GPT of training-a-tiny-language-model trained by that page's code at seven widths and
 * five amounts of Tiny Shakespeare, every run for 3,000 steps of 1,024 characters with a context
 * of 32. A run's score is its lowest held-out loss over its measurements (early stopping), in
 * nats per character; its size is counted as Kaplan et al. 2020 count it, without the embedding
 * and read-out weights.
 */
import { runKey, type Point } from '../training-a-tiny-language-model/train.ts';
import { layout, LAYERS } from '../training-a-tiny-language-model/tiny-gpt.ts';
import { data } from './sweep-data.ts';

export const SWEEP_WIDTHS = data.widths as readonly number[];
/** Characters of training text: 10,000 to all 1,003,854 (stored as 'all'). */
export const SWEEP_DATA = data.data.map((d) => (d === 'all' ? Infinity : Number(d)));
export const CONTEXT = data.context;
/** Characters in Tiny Shakespeare's training part (the first 90%). */
export const ALL_CHARS = 1_003_854;
/** Characters the model reads in 3,000 steps of 1,024. */
export const CHARS_SEEN = 3000 * 1024;
export const VOCAB = 65;

const config = (width: number) => ({
	vocab: VOCAB,
	width,
	context: CONTEXT,
	heads: 4,
	layers: LAYERS
});
/** All the weights of a model of this width. */
export const totalWeights = (width: number) => layout(config(width)).total;
/** The weights outside the embeddings and the read-out (Kaplan et al.'s N). */
export function blockWeights(width: number) {
	const L = layout(config(width));
	return L.total - L.wte.size - L.wpe.size - L.wout.size - L.bout.size;
}
/** Characters of training text, with 'all' as the whole training part. */
export const charsOf = (size: number) => (Number.isFinite(size) ? size : ALL_CHARS);

const raw = data.runs as Record<string, number[][]>;
/** The measured curve of one run. */
export function curveOf(width: number, size: number): Point[] {
	const r = raw[runKey(width, CONTEXT, size)];
	if (!r) throw new Error(`no run of width ${width} on ${size} characters`);
	return r.map(([step, train, val]) => ({ step, train, val }));
}

export interface SweepPoint {
	width: number;
	size: number;
	/** Kaplan-style parameter count. */
	N: number;
	/** Characters of training text available. */
	D: number;
	/** Lowest held-out loss (nats per character) and the step it came at. */
	loss: number;
	step: number;
	/** Training loss at that step. */
	train: number;
}

export function pointOf(width: number, size: number): SweepPoint {
	const best = curveOf(width, size).reduce((a, b) => (b.val < a.val ? b : a));
	return {
		width,
		size,
		N: blockWeights(width),
		D: charsOf(size),
		loss: best.val,
		step: best.step,
		train: best.train
	};
}

export const SWEEP: readonly SweepPoint[] = SWEEP_WIDTHS.flatMap((w) =>
	SWEEP_DATA.map((d) => pointOf(w, d))
);
const find = (w: number, d: number) => SWEEP.find((p) => p.width === w && p.size === d)!;
/** One amount of text, every width (loss against model size). */
export const bySize = (size: number) => SWEEP_WIDTHS.map((w) => find(w, size));
/** One width, every amount of text (loss against data). */
export const byWidth = (width: number) => SWEEP_DATA.map((d) => find(width, d));

export interface PowerLaw {
	/** L = k · x^(−alpha) */
	k: number;
	alpha: number;
	/** Largest |log10 L − fitted| over the fitted points. */
	worst: number;
}

/** Least-squares straight line through the points on log-log axes. */
export function fitPowerLaw(points: readonly { x: number; y: number }[]): PowerLaw {
	const n = points.length;
	const lx = points.map((p) => Math.log10(p.x));
	const ly = points.map((p) => Math.log10(p.y));
	const mx = lx.reduce((a, b) => a + b, 0) / n;
	const my = ly.reduce((a, b) => a + b, 0) / n;
	let sxy = 0;
	let sxx = 0;
	for (let i = 0; i < n; i++) {
		sxy += (lx[i] - mx) * (ly[i] - my);
		sxx += (lx[i] - mx) ** 2;
	}
	const slope = sxx > 0 ? sxy / sxx : 0;
	const k = Math.pow(10, my - slope * mx);
	let worst = 0;
	for (let i = 0; i < n; i++)
		worst = Math.max(worst, Math.abs(ly[i] - (Math.log10(k) + slope * lx[i])));
	return { k, alpha: -slope, worst };
}
export const powerLaw = (f: PowerLaw, x: number) => f.k * Math.pow(x, -f.alpha);
