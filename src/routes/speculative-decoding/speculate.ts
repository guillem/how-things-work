/**
 * Speculative decoding (Leviathan, Kalman and Matias 2023; Chen et al. 2023), over any two
 * character models that share one alphabet.
 *
 * A round: the cheap draft model writes k characters one after the other, sampling each from its
 * own probabilities q. The target model then runs once over the last written character and the k
 * guesses, k + 1 positions in one pass, which gives its probabilities p at every guess and one
 * more after the last. The guesses are checked in order: guess x is kept with probability
 * min(1, p(x) / q(x)). At the first one turned down, a character is drawn from the leftover
 * max(0, p − q), normalised, and the round ends there; everything after it is thrown away. If all
 * k are kept, one more character is drawn from the target's last p: the pass produced it anyway.
 *
 * With that rule every written character is distributed exactly as the target's own sampling
 * would have it, whatever the draft (the model tests check it with histograms). Two variants are
 * here for the page: greedy decoding (both models take their most likely character, so a guess
 * is kept when it equals the target's choice), and a wrong rule for sampling (keep a guess only
 * when it is the target's most likely character, otherwise draw from p), which skews the output.
 *
 * Caches: at the start of a round the committed text is c₁ … cₙ and neither model has fed cₙ yet.
 * Rolling back after a rejection is setting the model's `length` (a KV cache is position-major,
 * so later positions are simply overwritten).
 */
import { rng } from '#lib/draw/math.ts';

/** A model that reads one character at a time and keeps what it has read (a cache). */
export interface CharModel {
	/** Positions read so far; setting it lower forgets the rest. */
	length: number;
	/** Most positions it can read. */
	readonly context: number;
	/** Reads `token` at the next position; returns (a copy of) the probabilities of the next. */
	step(token: number): Float64Array;
	/** What the last `step` cost: multiply-adds and bytes read from memory (weights and cache). */
	readonly lastMacs: number;
	readonly lastBytes: number;
}

export type Rule = 'exact' | 'greedy' | 'top-match';

export interface Guess {
	/** The drafted character. */
	token: number;
	/** The target's probabilities at this position, and the draft's. */
	p: Float64Array;
	q: Float64Array;
	/** The uniform number drawn to check it (kept when u < p/q). */
	u: number;
	accepted: boolean;
}

export interface Round {
	/** Committed characters (prompt included) before the round. */
	start: number;
	/** Guesses drafted this round (k, fewer near the end of the context). */
	drafted: number[];
	/** The guesses checked: every kept one, then the first turned down (if any). */
	checked: Guess[];
	/** The character the target adds: drawn from the leftover after a rejection, or the bonus. */
	extra: number;
	/** 'residual' after a rejection, 'bonus' when every guess was kept. */
	kind: 'residual' | 'bonus';
	/** The distribution `extra` was drawn from (normalised leftover, or the last p). */
	from: Float64Array;
	/** Counted work: multiply-adds and bytes read, of the draft's steps and the target's pass. */
	draftMacs: number;
	draftBytes: number;
	draftSteps: number;
	targetMacs: number;
	targetBytes: number;
}

export interface Run {
	/** Characters written after the prompt. */
	tokens: number[];
	rounds: Round[];
}

/** Index of a draw from probabilities `p` with one uniform number `u`. */
export function draw(p: ArrayLike<number>, u: number): number {
	let pick = -1;
	for (let v = 0; v < p.length; v++) {
		if (p[v] <= 0) continue;
		pick = v;
		u -= p[v];
		if (u < 0) break;
	}
	return pick;
}

export function argmax(p: ArrayLike<number>): number {
	let best = 0;
	for (let v = 1; v < p.length; v++) if (p[v] > p[best]) best = v;
	return best;
}

export function oneHot(n: number, i: number): Float64Array {
	const out = new Float64Array(n);
	out[i] = 1;
	return out;
}

/** The leftover max(0, p − q), normalised (all zero when p ≤ q everywhere, i.e. p = q). */
export function residual(p: ArrayLike<number>, q: ArrayLike<number>): Float64Array {
	const r = new Float64Array(p.length);
	let s = 0;
	for (let v = 0; v < p.length; v++) {
		r[v] = Math.max(0, p[v] - q[v]);
		s += r[v];
	}
	if (s > 0) for (let v = 0; v < p.length; v++) r[v] /= s;
	return r;
}

/** Σ min(p, q): the chance a guess drawn from q is kept (1 − the total-variation distance). */
export function overlap(p: ArrayLike<number>, q: ArrayLike<number>): number {
	let s = 0;
	for (let v = 0; v < p.length; v++) s += Math.min(p[v], q[v]);
	return s;
}

/** Whether a guess is kept: with probability min(1, p(x)/q(x)), or by the rule's variant. */
export function keep(rule: Rule, p: ArrayLike<number>, q: ArrayLike<number>, x: number, u: number) {
	if (rule === 'top-match') return x === argmax(p);
	return u * q[x] < p[x];
}

/**
 * One character from a fixed context, the way a speculative round writes its first one: a guess
 * from q (uniform number u1), checked (u2), and if turned down a draw from the leftover (u3).
 */
export function firstChar(
	rule: Rule,
	p: Float64Array,
	q: Float64Array,
	u1: number,
	u2: number,
	u3: number
) {
	const x = draw(q, u1);
	if (keep(rule, p, q, x, u2)) return x;
	return draw(rule === 'top-match' ? p : residual(p, q), u3);
}

/**
 * Writes after `prompt` until the target's context is full (or at least `max` characters are
 * written), k guesses per round. Each round is one pass of the target. Uniform numbers come from
 * `seed`, in order: the guesses, their checks, the extra character.
 */
export function speculate(
	target: CharModel,
	draft: CharModel,
	prompt: readonly number[],
	k: number,
	seed: number,
	rule: Rule = 'exact',
	max = Infinity
): Run {
	const random = rng(seed);
	// greedy decoding is the same rule on one-hot distributions: each model's top choice
	const sharpen = (p: Float64Array) => (rule === 'greedy' ? oneHot(p.length, argmax(p)) : p);
	target.length = 0;
	draft.length = 0;
	const text = prompt.slice();
	// read the prompt but its last character
	for (let i = 0; i < text.length - 1; i++) target.step(text[i]);
	const tokens: number[] = [];
	const rounds: Round[] = [];
	while (text.length < target.context + 1 && tokens.length < max) {
		const n = text.length;
		const kk = Math.max(0, Math.min(k, target.context - n));
		const round: Round = {
			start: n,
			drafted: [],
			checked: [],
			extra: 0,
			kind: 'bonus',
			from: new Float64Array(0),
			draftMacs: 0,
			draftBytes: 0,
			draftSteps: 0,
			targetMacs: 0,
			targetBytes: 0
		};
		// the draft catches up with the committed text, then guesses
		const qs: Float64Array[] = [];
		if (kk > 0) {
			let q = new Float64Array(0);
			while (draft.length < n) {
				q = draft.step(text[draft.length]);
				round.draftMacs += draft.lastMacs;
				round.draftBytes += draft.lastBytes;
				round.draftSteps++;
			}
			for (let i = 0; i < kk; i++) {
				const qi = sharpen(q);
				qs.push(qi);
				const x = draw(qi, random());
				round.drafted.push(x);
				if (i < kk - 1) {
					q = draft.step(x);
					round.draftMacs += draft.lastMacs;
					round.draftBytes += draft.lastBytes;
					round.draftSteps++;
				}
			}
		}
		// one pass of the target over the last committed character and the guesses
		const ps: Float64Array[] = [];
		const feed = [text[n - 1], ...round.drafted];
		for (let i = 0; i < feed.length; i++) {
			ps.push(sharpen(target.step(feed[i])));
			round.targetMacs += target.lastMacs;
		}
		// a pass reads the weights and the cache once for all its positions: what its last
		// position alone reads
		round.targetBytes = target.lastBytes;
		// check the guesses in order
		let kept = 0;
		let rejected = false;
		for (let i = 0; i < kk; i++) {
			const x = round.drafted[i];
			const u = random();
			const ok = keep(rule, ps[i], qs[i], x, u);
			round.checked.push({ token: x, p: ps[i], q: qs[i], u, accepted: ok });
			if (!ok) {
				rejected = true;
				break;
			}
			kept++;
		}
		if (rejected) {
			const from = rule === 'top-match' ? ps[kept] : residual(ps[kept], qs[kept]);
			round.kind = 'residual';
			round.from = from;
			round.extra = draw(from, random());
		} else {
			round.kind = 'bonus';
			round.from = ps[kk];
			round.extra = draw(ps[kk], random());
		}
		const written = [...round.drafted.slice(0, kept), round.extra];
		for (const c of written) {
			text.push(c);
			tokens.push(c);
		}
		// forget what was read past the kept guesses
		target.length = n + kept;
		if (draft.length > n + kept) draft.length = n + kept;
		rounds.push(round);
	}
	return { tokens, rounds };
}

/** Summary of a run: tokens per target pass, keep rate and counted costs. */
export function stats(run: Run) {
	let checked = 0;
	let kept = 0;
	let drafted = 0;
	let targetMacs = 0;
	let draftMacs = 0;
	let targetBytes = 0;
	let draftBytes = 0;
	let draftSteps = 0;
	for (const r of run.rounds) {
		drafted += r.drafted.length;
		for (const g of r.checked) {
			checked++;
			if (g.accepted) kept++;
		}
		targetMacs += r.targetMacs;
		draftMacs += r.draftMacs;
		targetBytes += r.targetBytes;
		draftBytes += r.draftBytes;
		draftSteps += r.draftSteps;
	}
	const written = run.rounds.reduce(
		(s, r) => s + r.checked.filter((g) => g.accepted).length + 1,
		0
	);
	return {
		passes: run.rounds.length,
		written,
		drafted,
		checked,
		kept,
		draftSteps,
		targetMacs,
		draftMacs,
		targetBytes,
		draftBytes
	};
}
