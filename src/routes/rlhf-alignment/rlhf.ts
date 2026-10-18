/**
 * The model of the rlhf-alignment explainer: a reward model fitted to pairwise comparisons by the
 * Bradley–Terry rule, and a policy that maximises that reward minus a KL penalty to the reference
 * model, both on a finite set of candidate answers.
 *
 * - The reference policy π_ref is GPT-2 small (see `rlhf-data.ts`); its candidates are N answers
 *   sampled from it, so on the set it is the empirical distribution of the sample: 1/N each.
 * - The reward model is linear in each answer's features: r(y) = w · f(y). Bradley–Terry says a
 *   rater prefers a to b with probability σ(r(a) − r(b)); w is fitted by maximising that
 *   likelihood over the comparisons (a logistic regression on feature differences), with a small
 *   L2 penalty so a handful of comparisons still give an answer.
 * - The KL-regularised objective J(π) = E_π[r] − β·KL(π ‖ π_ref) has the closed-form optimum
 *   π*(y) ∝ π_ref(y)·exp(r(y)/β) (`tilt`); `gradientAscent` and `reinforce` reach it the way RL
 *   does, by following the gradient of J, exactly or from sampled answers.
 */

export interface Comparison {
	/** Index of the preferred answer. */
	win: number;
	/** Index of the other one. */
	lose: number;
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** A small seeded generator (mulberry32): the same seed gives the same sequence everywhere. */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let x = a;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

/** A random pair of different indices below n. */
export function randomPair(n: number, rand: () => number): [number, number] {
	const a = Math.floor(rand() * n);
	let b = Math.floor(rand() * (n - 1));
	if (b >= a) b++;
	return [a, b];
}

/**
 * How sharply the page's stand-in rater prefers the better answer: its Bradley–Terry strength is
 * this times its score, so of two answers one point apart it picks the better one with
 * probability σ(2) ≈ 88%, and of two equal ones either, at even odds.
 */
export const RATER_SCALE = 2;

/** The rater's Bradley–Terry strengths for scores on its −3 to 4 scale. */
export const strengths = (scores: readonly number[]) => scores.map((s) => RATER_SCALE * s);

/**
 * Comparisons by a simulated rater whose preferences follow the Bradley–Terry rule on hidden
 * scores: of a random pair (a, b) it picks a with probability σ(score[a] − score[b]).
 */
export function simulateComparisons(
	scores: readonly number[],
	count: number,
	seed: number
): Comparison[] {
	const rand = rng(seed);
	const out: Comparison[] = [];
	for (let i = 0; i < count; i++) out.push(rate(scores, randomPair(scores.length, rand), rand));
	return out;
}

/** The simulated rater's verdict on one pair. */
export function rate(
	scores: readonly number[],
	[a, b]: readonly [number, number],
	rand: () => number
): Comparison {
	return rand() < sigmoid(scores[a] - scores[b]) ? { win: a, lose: b } : { win: b, lose: a };
}

/** Solves A x = b for a small symmetric positive-definite A (Cholesky). */
function solve(A: number[][], b: number[]): number[] {
	const n = b.length;
	const L = A.map(() => new Array<number>(n).fill(0));
	for (let i = 0; i < n; i++)
		for (let j = 0; j <= i; j++) {
			let s = A[i][j];
			for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
			L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
		}
	const y = new Array<number>(n).fill(0);
	for (let i = 0; i < n; i++) {
		let s = b[i];
		for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
		y[i] = s / L[i][i];
	}
	const x = new Array<number>(n).fill(0);
	for (let i = n - 1; i >= 0; i--) {
		let s = y[i];
		for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
		x[i] = s / L[i][i];
	}
	return x;
}

/**
 * Fits the reward model's weights to the comparisons by maximum likelihood under Bradley–Terry,
 * with an L2 penalty `lambda`·|w|²/2 (Newton's method; the loss is convex, so it converges to the
 * one optimum). With no comparisons the weights are zero: every answer scores the same.
 */
export function fitRewardModel(
	features: readonly (readonly number[])[],
	comparisons: readonly Comparison[],
	lambda = 3
): number[] {
	const d = features[0].length;
	const w = new Array<number>(d).fill(0);
	if (!comparisons.length) return w;
	const diffs = comparisons.map(({ win, lose }) =>
		features[win].map((v, k) => v - features[lose][k])
	);
	for (let iter = 0; iter < 50; iter++) {
		const g = w.map((v) => lambda * v);
		const H = w.map((_, i) => w.map((__, j) => (i === j ? lambda : 0)));
		for (const x of diffs) {
			let z = 0;
			for (let k = 0; k < d; k++) z += w[k] * x[k];
			const p = sigmoid(z);
			for (let i = 0; i < d; i++) {
				g[i] -= (1 - p) * x[i];
				for (let j = 0; j < d; j++) H[i][j] += p * (1 - p) * x[i] * x[j];
			}
		}
		const step = solve(H, g);
		let size = 0;
		for (let k = 0; k < d; k++) {
			w[k] -= step[k];
			size = Math.max(size, Math.abs(step[k]));
		}
		if (size < 1e-10) break;
	}
	return w;
}

/** The reward model's score of every answer: r = w · f. */
export function rewards(features: readonly (readonly number[])[], w: readonly number[]): number[] {
	return features.map((f) => f.reduce((s, v, k) => s + v * w[k], 0));
}

/** The mean negative log-likelihood of the comparisons under the scores (the training loss). */
export function comparisonLoss(r: readonly number[], comparisons: readonly Comparison[]): number {
	if (!comparisons.length) return Math.LN2;
	let s = 0;
	for (const { win, lose } of comparisons) s += Math.log1p(Math.exp(-(r[win] - r[lose])));
	return s / comparisons.length;
}

/** π_ref on the candidate set: the sample's own distribution, 1/N per answer. */
export const reference = (n: number) => new Array<number>(n).fill(1 / n);

/**
 * The KL-regularised optimum, π*(y) ∝ π_ref(y)·exp(r(y)/β). β = ∞ gives π_ref; as β → 0 all the
 * probability goes to the answers the reward model scores highest.
 */
export function tilt(r: readonly number[], beta: number, ref = reference(r.length)): number[] {
	if (!Number.isFinite(beta)) return [...ref];
	const top = Math.max(...r);
	const u = r.map((v, i) => ref[i] * Math.exp((v - top) / beta));
	const z = u.reduce((a, b) => a + b, 0);
	return u.map((v) => v / z);
}

/** KL(π ‖ π_ref) in nats. */
export function kl(pi: readonly number[], ref = reference(pi.length)): number {
	let s = 0;
	for (let i = 0; i < pi.length; i++) if (pi[i] > 0) s += pi[i] * Math.log(pi[i] / ref[i]);
	return Math.max(0, s);
}

/** E_π[v]. */
export const expect = (pi: readonly number[], v: readonly number[]) =>
	pi.reduce((s, p, i) => s + p * v[i], 0);

/** The objective the policy maximises: E_π[r] − β·KL(π ‖ π_ref). */
export const objective = (pi: readonly number[], r: readonly number[], beta: number) =>
	expect(pi, r) - beta * kl(pi);

function softmax(theta: readonly number[]): number[] {
	const top = Math.max(...theta);
	const u = theta.map((v) => Math.exp(v - top));
	const z = u.reduce((a, b) => a + b, 0);
	return u.map((v) => v / z);
}

export interface PolicyRun {
	/** The policy after every recorded iteration, starting with π_ref. */
	pis: number[][];
	/** The iteration number of each entry of `pis`. */
	iters: number[];
}

/**
 * Policy-gradient ascent on J(π) = E_π[r] − β·KL(π ‖ π_ref) for a softmax policy over the
 * candidates (one logit each), starting at π_ref. With `batch` = 0 the gradient is computed
 * exactly from all the candidates; otherwise it is estimated, as RL does, from `batch` answers
 * sampled from the current policy (REINFORCE with the batch mean as baseline, seeded).
 */
export function policyGradient(
	r: readonly number[],
	beta: number,
	{
		iters = 400,
		lr = 1,
		batch = 0,
		seed = 1,
		every = 10
	}: { iters?: number; lr?: number; batch?: number; seed?: number; every?: number } = {}
): PolicyRun {
	const n = r.length;
	const ref = reference(n);
	const theta = new Array<number>(n).fill(0);
	const rand = rng(seed);
	const pis: number[][] = [softmax(theta)];
	const at: number[] = [0];
	for (let it = 1; it <= iters; it++) {
		const pi = softmax(theta);
		// the per-answer return: the reward minus β times its log-ratio to the reference
		const ret = pi.map((p, i) => r[i] - beta * Math.log(p / ref[i]));
		const g = new Array<number>(n).fill(0);
		if (batch === 0) {
			const mean = expect(pi, ret);
			for (let i = 0; i < n; i++) g[i] = pi[i] * (ret[i] - mean);
		} else {
			const ys: number[] = [];
			for (let s = 0; s < batch; s++) {
				let u = rand();
				let y = 0;
				while (y < n - 1 && u >= pi[y]) u -= pi[y++];
				ys.push(y);
			}
			const base = ys.reduce((s, y) => s + ret[y], 0) / batch;
			for (const y of ys) {
				const adv = (ret[y] - base) / batch;
				// ∇ log π(y) for a softmax: one-hot(y) − π
				for (let i = 0; i < n; i++) g[i] -= adv * pi[i];
				g[y] += adv;
			}
		}
		// a step of lr/β: the KL term's curvature is β, so a larger step would overshoot
		for (let i = 0; i < n; i++) theta[i] += (lr / beta) * g[i];
		if (it % every === 0 || it === iters) {
			pis.push(softmax(theta));
			at.push(it);
		}
	}
	return { pis, iters: at };
}

/** Total-variation distance between two distributions: half the sum of absolute differences. */
export const tv = (p: readonly number[], q: readonly number[]) =>
	p.reduce((s, v, i) => s + Math.abs(v - q[i]), 0) / 2;

/** Pearson correlation of two equally long lists. */
export function correlation(a: readonly number[], b: readonly number[]): number {
	const n = a.length;
	const ma = a.reduce((s, v) => s + v, 0) / n;
	const mb = b.reduce((s, v) => s + v, 0) / n;
	let sab = 0;
	let saa = 0;
	let sbb = 0;
	for (let i = 0; i < n; i++) {
		sab += (a[i] - ma) * (b[i] - mb);
		saa += (a[i] - ma) ** 2;
		sbb += (b[i] - mb) ** 2;
	}
	return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

/** The β values of the leash slider and of the over-optimisation curve: 10 down to 0.01. */
export const BETAS = Array.from({ length: 61 }, (_, i) => 10 ** (1 - (3 * i) / 60));

export interface CurvePoint {
	beta: number;
	kl: number;
	/** E_π[r]: the reward model's score the policy expects. */
	proxy: number;
	/** E_π[score]: the rater's own score it expects. */
	gold: number;
}

/** Proxy and true score of the KL-regularised optimum as the leash loosens (β falls). */
export function overoptimisation(
	r: readonly number[],
	gold: readonly number[],
	betas: readonly number[] = BETAS
): CurvePoint[] {
	return betas.map((beta) => {
		const pi = tilt(r, beta);
		return { beta, kl: kl(pi), proxy: expect(pi, r), gold: expect(pi, gold) };
	});
}
