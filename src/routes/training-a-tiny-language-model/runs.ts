/** The stored training runs (`runs-data.ts`), typed, with the few numbers the page reads off. */
import { data } from './runs-data.ts';
import { runKey, type Point } from './train.ts';

export interface StoredRun {
	points: Point[];
	samples: { step: number; text: string }[];
}

const cache = new Map<string, StoredRun>();
type Raw = { points: number[][]; samples: (number | string)[][] };
const raw = data.runs as Record<string, Raw>;

/** The stored run of one width, context and amount of data. */
export function runOf(width: number, context: number, size: number): StoredRun {
	const key = runKey(width, context, size);
	let r = cache.get(key);
	if (!r) {
		const d = raw[key];
		if (!d) throw new Error(`no stored run ${key}`);
		r = {
			points: d.points.map(([step, train, val]) => ({ step, train, val })),
			samples: d.samples.map(([step, text]) => ({ step: Number(step), text: String(text) }))
		};
		cache.set(key, r);
	}
	return r;
}

export const finalOf = (r: StoredRun) => r.points[r.points.length - 1];
/** The measurement with the lowest held-out loss. */
export const minVal = (r: StoredRun) => r.points.reduce((a, b) => (b.val < a.val ? b : a));
/** Perplexity: e to the mean cross-entropy (in nats) per character. */
export const perplexity = (nats: number) => Math.exp(nats);

/** The losses at `step`, interpolated between the measurements around it. */
export function pointAt(points: readonly Point[], step: number): Point {
	if (step <= points[0].step) return points[0];
	for (let i = 1; i < points.length; i++) {
		const b = points[i];
		if (step <= b.step) {
			const a = points[i - 1];
			const u = (step - a.step) / (b.step - a.step);
			return { step, train: a.train + u * (b.train - a.train), val: a.val + u * (b.val - a.val) };
		}
	}
	return points[points.length - 1];
}

/** The last sample written at or before `step`. */
export function sampleAt(samples: readonly { step: number; text: string }[], step: number) {
	let s = samples[0];
	for (const x of samples) if (x.step <= step) s = x;
	return s;
}

export type BaselineKey = '10000' | '100000' | 'all';
export const baselineKey = (size: number): BaselineKey =>
	Number.isFinite(size) ? (String(size) as BaselineKey) : 'all';
/** Smoothed n-gram cross-entropies on the held-out characters, for one amount of data. */
export const baselines = (size: number) => data.baselines[baselineKey(size)];

/** The held-out line the first scene reads, and the default model's guesses along it. */
export const passage = data.passage;
export interface Guess {
	step: number;
	/** Probability the model gave to each actual next character. */
	actual: number[];
	/** Its four likeliest guesses at each position. */
	top: [string, number][][];
}
export const guesses: Guess[] = (
	data.predictions as unknown as [number, number[], [string, number][][]][]
).map(([step, actual, top]) => ({ step, actual, top }));
