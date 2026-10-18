/**
 * What the page's scenes show, computed from the models: one speculative run (the text strip and
 * its rounds), the next-character histogram after a fixed context, and the speed of each draft
 * for k = 1 … 8 guesses per round, with its counted costs against plain decoding.
 */
import { rng } from '#lib/draw/math.ts';
import { decode, encode, makeDraft, makeTarget, PROMPT, type DraftId } from './models.ts';
import {
	draw,
	keep,
	residual,
	speculate,
	stats,
	type CharModel,
	type Rule,
	type Run
} from './speculate.ts';

export const K_MAX = 8;

const runs = new Map<string, Run>();
/** The speculative run of `draft` with `k` guesses per round and random numbers from `seed`. */
export function runOf(draft: DraftId, k: number, seed: number, rule: Rule = 'exact'): Run {
	const key = `${draft}/${k}/${seed}/${rule}`;
	let r = runs.get(key);
	if (!r) {
		r = speculate(makeTarget(), makeDraft(draft), encode(PROMPT), k, seed, rule);
		runs.set(key, r);
	}
	return r;
}

/** Probabilities of the next character after `context`, from a fresh copy of a model. */
export function probsAfter(model: CharModel, context: string): Float64Array {
	model.length = 0;
	let p: Float64Array = new Float64Array(0);
	for (const c of encode(context)) p = model.step(c);
	return p;
}

/** The context of the histogram: a word starting with "Wh" (Wha-, Whe-, Whi-, Who-, Why). */
export const HIST_CONTEXT = 'ROMEO:\nWh';
export const SAMPLES = 10_000;

export interface Histogram {
	p: Float64Array;
	q: Float64Array;
	/** The character each of the `SAMPLES` speculative draws wrote. */
	draws: Uint8Array;
	/** 1 where it was the draft's guess, kept; 0 where it came from the leftover (or from p). */
	kept: Uint8Array;
}

const hists = new Map<string, Histogram>();
/**
 * 10,000 first characters written after `HIST_CONTEXT` by speculative rounds of `draft`: a guess
 * from q, checked by `rule`, and if turned down a draw from the normalised leftover (from p under
 * the wrong top-choice rule). Three uniform numbers per draw, from `seed`.
 */
export function histogram(draft: DraftId, rule: Rule, seed: number): Histogram {
	const key = `${draft}/${rule}/${seed}`;
	let h = hists.get(key);
	if (!h) {
		const p = probsAfter(makeTarget(), HIST_CONTEXT);
		const q = probsAfter(makeDraft(draft), HIST_CONTEXT);
		const r = rule === 'top-match' ? p : residual(p, q);
		const random = rng(seed);
		const draws = new Uint8Array(SAMPLES);
		const kept = new Uint8Array(SAMPLES);
		for (let i = 0; i < SAMPLES; i++) {
			const x = draw(q, random());
			const ok = keep(rule, p, q, x, random());
			const u = random();
			draws[i] = ok ? x : draw(r, u);
			kept[i] = ok ? 1 : 0;
		}
		h = { p, q, draws, kept };
		hists.set(key, h);
	}
	return h;
}

/**
 * The total-variation distance that sampling noise alone gives `n` draws from `p`, on average:
 * ½ Σ E|f − p| with each frequency f about normal, of standard deviation √(p(1 − p)/n).
 */
export function noiseDistance(p: ArrayLike<number>, n: number): number {
	let s = 0;
	for (let v = 0; v < p.length; v++) s += Math.sqrt((2 * p[v] * (1 - p[v])) / (Math.PI * n));
	return s / 2;
}

/** Total-variation distance between the first `n` draws' frequencies and `p`. */
export function distance(draws: Uint8Array, n: number, p: ArrayLike<number>): number {
	const c = new Float64Array(p.length);
	for (let i = 0; i < n; i++) c[draws[i]]++;
	let s = 0;
	for (let v = 0; v < p.length; v++) s += Math.abs(c[v] / n - p[v]);
	return s / 2;
}

/** What plain decoding (one target step per character) reads and computes to write `run`'s text. */
export function plainCost(run: Run) {
	const target = makeTarget();
	const text = [...encode(PROMPT), ...run.tokens];
	let bytes = 0;
	let macs = 0;
	for (let i = 0; i < text.length - 1; i++) {
		target.step(text[i]);
		if (i >= PROMPT.length - 1) {
			bytes += target.lastBytes;
			macs += target.lastMacs;
		}
	}
	return { bytes, macs };
}

export const SPEED_SEEDS = [1, 2, 3, 4, 5, 6];

export interface Speed {
	k: number;
	/** Characters written per target pass, measured over the rounds that drafted k guesses. */
	perPass: number;
	/** Share of the checked guesses that were kept, and the counts. */
	alpha: number;
	kept: number;
	checked: number;
	/** (1 − α^(k+1)) / (1 − α): the expected characters per pass if every guess were kept with chance α. */
	predicted: number;
	/** Bytes read per character (target and draft), as a share of plain decoding's. */
	bytesShare: number;
	/** Multiply-adds per character (target and draft), as a share of plain decoding's. */
	macsShare: number;
}

/** The expected characters per pass with k guesses each kept independently with chance α. */
export const expectedPerPass = (alpha: number, k: number) =>
	alpha >= 1 ? k + 1 : (1 - alpha ** (k + 1)) / (1 - alpha);

const speeds = new Map<DraftId, Speed[]>();
/** The draft's speed for k = 1 … K_MAX, over `SPEED_SEEDS`. */
export function speedsOf(draft: DraftId): Speed[] {
	let out = speeds.get(draft);
	if (out) return out;
	out = [];
	for (let k = 1; k <= K_MAX; k++) {
		let passes = 0;
		let written = 0;
		let kept = 0;
		let checked = 0;
		let bytes = 0;
		let macs = 0;
		let plainBytes = 0;
		let plainMacs = 0;
		for (const seed of SPEED_SEEDS) {
			const run = runOf(draft, k, seed);
			const s = stats(run);
			// characters per pass over the rounds that drafted all k (the last ones are cut short
			// by the end of the 64-character context)
			for (const r of run.rounds) {
				if (r.drafted.length < k) continue;
				passes++;
				const n = r.checked.filter((g) => g.accepted).length;
				written += n + 1;
				kept += n;
				checked += r.checked.length;
			}
			bytes += s.targetBytes + s.draftBytes;
			macs += s.targetMacs + s.draftMacs;
			const plain = plainCost(run);
			plainBytes += plain.bytes;
			plainMacs += plain.macs;
		}
		const alpha = kept / checked;
		out.push({
			k,
			perPass: written / passes,
			alpha,
			kept,
			checked,
			predicted: expectedPerPass(alpha, k),
			bytesShare: bytes / plainBytes,
			macsShare: macs / plainMacs
		});
	}
	speeds.set(draft, out);
	return out;
}

/** The draft's keep rate over all its runs, k = 1 … K_MAX together. */
export function pooledAlpha(draft: DraftId): number {
	const rows = speedsOf(draft);
	return rows.reduce((s, r) => s + r.kept, 0) / rows.reduce((s, r) => s + r.checked, 0);
}

export { decode };
