// Checks the speculative-decoding page's model against what Leviathan et al. (2023) and Chen et
// al. (2023) prove: whatever the draft, the characters written are distributed exactly as the
// target's own (chi-square over many seeded runs, for the first character after a fixed context
// and the second character of whole runs); a guess is kept with chance Σ min(p, q); with guesses
// kept independently with chance α, the kept count per round is a truncated geometric and the
// characters per pass average (1 − α^(k+1)) / (1 − α); a draft equal to the target has every
// guess kept; greedy speculative decoding writes the target's greedy text; and keeping only the
// target's top choice while sampling skews the output. The numbers the narrative quotes too.
import { expect, test } from '@playwright/test';
import {
	chars,
	decode,
	draftChars,
	DRAFTS,
	encode,
	makeDraft,
	makeTarget,
	NgramModel,
	PROMPT,
	V
} from '../src/routes/speculative-decoding/models';
import {
	expectedPerPass,
	HIST_CONTEXT,
	histogram,
	pooledAlpha,
	probsAfter,
	runOf,
	SAMPLES,
	speedsOf
} from '../src/routes/speculative-decoding/results';
import { RUN_SEEDS } from '../src/routes/speculative-decoding/steps';
import {
	argmax,
	overlap,
	speculate,
	type CharModel
} from '../src/routes/speculative-decoding/speculate';

/**
 * Pearson's chi-square of observed counts against probabilities (bins expected under 5 pooled),
 * with a generous bound: df + 4·√(2·df), about 4 standard deviations of the statistic.
 */
function chiSquare(counts: ArrayLike<number>, p: ArrayLike<number>) {
	const n = Array.from(counts).reduce((a, b) => a + b, 0);
	let stat = 0;
	let bins = 0;
	let poolE = 0;
	let poolO = 0;
	for (let v = 0; v < p.length; v++) {
		const e = n * p[v];
		if (e < 5) {
			poolE += e;
			poolO += counts[v];
			continue;
		}
		stat += (counts[v] - e) ** 2 / e;
		bins++;
	}
	if (poolE > 0) {
		stat += (poolO - poolE) ** 2 / Math.max(poolE, 1e-9);
		bins++;
	}
	const df = bins - 1;
	return { stat, df, bound: df + 4 * Math.sqrt(2 * df) };
}

const tally = (draws: ArrayLike<number>, n = V) => {
	const c = new Array<number>(n).fill(0);
	for (let i = 0; i < draws.length; i++) c[draws[i]]++;
	return c;
};

test('draft and target share one alphabet', () => {
	expect(draftChars).toBe(chars.join(''));
	expect(V).toBe(65);
});

test.describe('the output is distributed exactly as the target’s', () => {
	test('the page’s 10,000 first characters match the target, whatever the draft', () => {
		for (const d of ['unigram', 'bigram', 'small'] as const) {
			const h = histogram(d, 'exact', 1);
			const c = chiSquare(tally(h.draws), h.p);
			expect(c.stat, d).toBeLessThan(c.bound);
			// the drafts themselves are far from the target here
			const own = chiSquare(tally(h.draws), h.q);
			expect(own.stat, d).toBeGreaterThan(10 * own.bound);
		}
	});

	test('keeping only the target’s top choice skews a sampled output', () => {
		const h = histogram('bigram', 'top-match', 1);
		const c = chiSquare(tally(h.draws), h.p);
		expect(c.stat).toBeGreaterThan(10 * c.bound);
		// the most likely character is written far more often than its probability
		const top = argmax(h.p);
		expect(tally(h.draws)[top] / SAMPLES).toBeGreaterThan(h.p[top] + 0.15);
	});

	test('whole runs: the second character written matches the target’s marginal', () => {
		const target = makeTarget();
		const prompt = encode(PROMPT);
		const p1 = probsAfter(makeTarget(), PROMPT);
		// exact marginal of the second character: Σ over the first of p(x₁) p(x₂ | x₁)
		const p2 = new Float64Array(V);
		for (let a = 0; a < V; a++) {
			if (p1[a] < 1e-9) continue;
			const pa = probsAfter(makeTarget(), PROMPT + chars[a]);
			for (let b = 0; b < V; b++) p2[b] += p1[a] * pa[b];
		}
		for (const d of ['bigram', 'small'] as const) {
			const draft = makeDraft(d);
			const first: number[] = [];
			const second: number[] = [];
			for (let seed = 1; seed <= 6000; seed++) {
				const run = speculate(target, draft, prompt, 3, seed, 'exact', 2);
				first.push(run.tokens[0]);
				second.push(run.tokens[1]);
			}
			const c1 = chiSquare(tally(first), p1);
			const c2 = chiSquare(tally(second), p2);
			expect(c1.stat, d).toBeLessThan(c1.bound);
			expect(c2.stat, d).toBeLessThan(c2.bound);
		}
	});
});

test.describe('how many guesses are kept', () => {
	test('a guess is kept with chance Σ min(p, q)', () => {
		const target = makeTarget();
		const prompt = encode(HIST_CONTEXT);
		for (const d of ['unigram', 'bigram', 'small'] as const) {
			const draft = makeDraft(d);
			const beta = overlap(
				probsAfter(makeTarget(), HIST_CONTEXT),
				probsAfter(makeDraft(d), HIST_CONTEXT)
			);
			const n = 6000;
			let kept = 0;
			for (let seed = 1; seed <= n; seed++)
				if (speculate(target, draft, prompt, 1, seed, 'exact', 1).rounds[0].checked[0].accepted)
					kept++;
			const sigma = Math.sqrt((beta * (1 - beta)) / n);
			expect(Math.abs(kept / n - beta), d).toBeLessThan(4 * sigma);
		}
	});

	test('guesses kept independently: a truncated geometric, (1 − α^(k+1)) / (1 − α) per pass', () => {
		// context-free models: the target writes by character frequencies, the draft uniformly,
		// so every guess is kept with the same chance α = Σ min(p, 1/65)
		const uniform: CharModel = {
			length: 0,
			context: Infinity,
			lastMacs: 0,
			lastBytes: 0,
			step() {
				this.length++;
				return new Float64Array(V).fill(1 / V);
			}
		};
		const target = new NgramModel(1);
		const alpha = overlap(target.step(0), new Float64Array(V).fill(1 / V));
		const k = 4;
		const run = speculate(target, uniform, [0], k, 3, 'exact', 40_000);
		const counts = new Array<number>(k + 1).fill(0);
		for (const r of run.rounds) counts[r.checked.filter((g) => g.accepted).length]++;
		const expected = Array.from({ length: k + 1 }, (_, j) =>
			j < k ? alpha ** j * (1 - alpha) : alpha ** k
		);
		const c = chiSquare(counts, expected);
		expect(c.stat).toBeLessThan(c.bound);
		const perPass = run.tokens.length / run.rounds.length;
		expect(perPass).toBeCloseTo(expectedPerPass(alpha, k), 1);
	});

	test('with the real models the formula predicts the characters per pass from the keep rate', () => {
		for (const d of ['unigram', 'bigram', 'small'] as const)
			for (const s of speedsOf(d))
				expect(Math.abs(s.perPass / s.predicted - 1), `${d} k=${s.k}`).toBeLessThan(0.05);
	});

	test('a draft that is the target has every guess kept: k + 1 characters per pass', () => {
		for (const s of speedsOf('self')) {
			expect(s.alpha).toBe(1);
			expect(s.perPass).toBe(s.k + 1);
		}
	});

	test('a better draft keeps more guesses', () => {
		const alpha = (d: (typeof DRAFTS)[number]['id']) => speedsOf(d)[3].alpha;
		expect(alpha('unigram')).toBeLessThan(alpha('bigram'));
		expect(alpha('bigram')).toBeLessThan(alpha('small'));
	});
});

test('greedy speculative decoding writes the target’s greedy text', () => {
	const target = makeTarget();
	const prompt = encode(PROMPT);
	const p = probsAfter(target, PROMPT);
	const greedy: number[] = [argmax(p)];
	while (target.length < target.context)
		greedy.push(argmax(target.step(greedy[greedy.length - 1])));
	for (const d of ['unigram', 'bigram', 'small'] as const)
		for (const k of [1, 4, 8])
			expect(decode(speculate(makeTarget(), makeDraft(d), prompt, k, 9, 'greedy').tokens)).toBe(
				decode(greedy)
			);
});

test('a speculative run fills the window like plain decoding: 58 characters', () => {
	for (const d of ['bigram', 'small'] as const) {
		const run = runOf(d, 4, 1);
		expect(run.tokens.length).toBe(58);
		expect(run.rounds.length).toBeLessThan(30);
	}
});

test('the numbers the narrative quotes', () => {
	// the default run: the small GPT drafting 4 guesses, at the first seed of "Write another"
	const run = runOf('small', 4, RUN_SEEDS[0]);
	expect(run.tokens.length).toBe(58);
	expect(run.rounds.length).toBe(20);
	const [r1, r2] = run.rounds;
	expect(decode(r1.drafted)).toBe('Whag');
	const at = (i: number) => {
		const g = r1.checked[i];
		return { p: g.p[g.token], q: g.q[g.token], u: g.u, kept: g.accepted };
	};
	expect(at(0).q).toBeCloseTo(0.066, 3);
	expect(at(0).p).toBeCloseTo(0.097, 3);
	expect(at(2).q).toBeCloseTo(0.284, 3);
	expect(at(2).p).toBeCloseTo(0.252, 3);
	expect(at(2).p / at(2).q).toBeCloseTo(0.89, 2);
	expect(at(2).u).toBeCloseTo(0.08, 2);
	expect(at(3).q).toBeCloseTo(0.005, 3);
	expect(at(3).p).toBeLessThan(0.001);
	expect(at(3).kept).toBe(false);
	expect(chars[r1.extra]).toBe('t');
	expect(r1.from[r1.extra]).toBeGreaterThan(0.95);
	expect(decode(r2.drafted)).toBe(' thi');
	expect(r2.kind).toBe('bonus');
	expect(chars[r2.extra]).toBe('s');
	expect(r2.from[r2.extra]).toBeCloseTo(0.574, 3);
	// plain decoding: one pass per character
	expect(runOf('small', 0, RUN_SEEDS[0]).rounds.length).toBe(58);

	// the histogram's context
	const p = probsAfter(makeTarget(), HIST_CONTEXT);
	const pc = (c: string) => p[chars.indexOf(c)];
	expect(pc('e')).toBeCloseTo(0.27, 2);
	expect(pc('a')).toBeCloseTo(0.25, 2);
	expect(pc('o')).toBeCloseTo(0.18, 2);
	expect(pc('y')).toBeCloseTo(0.16, 1);
	expect(pc('i')).toBeCloseTo(0.14, 2);
	const qUni = probsAfter(makeDraft('unigram'), HIST_CONTEXT);
	expect(qUni[chars.indexOf(' ')]).toBeCloseTo(0.15, 2);
	const beta = (d: 'unigram' | 'bigram' | 'small') =>
		overlap(p, probsAfter(makeDraft(d), HIST_CONTEXT));
	expect(beta('small')).toBeCloseTo(0.88, 2);
	expect(beta('bigram')).toBeCloseTo(0.73, 2);
	expect(beta('unigram')).toBeCloseTo(0.26, 2);
	// the wrong rule writes "e" about half the time
	const wrong = histogram('small', 'top-match', 1);
	const e = wrong.draws.filter((x) => x === chars.indexOf('e')).length / SAMPLES;
	expect(e).toBeGreaterThan(0.45);
	expect(e).toBeLessThan(0.55);

	// keep rates, and the most a round can average
	expect(pooledAlpha('unigram')).toBeCloseTo(0.33, 2);
	expect(pooledAlpha('bigram')).toBeCloseTo(0.55, 2);
	expect(pooledAlpha('small')).toBeCloseTo(0.76, 2);
	expect(1 / (1 - pooledAlpha('small'))).toBeCloseTo(4.2, 1);
	expect(1 / (1 - pooledAlpha('bigram'))).toBeCloseTo(2.2, 1);

	// a step of the small GPT reads 28% of the bytes of a target step
	const t = makeTarget();
	const s = makeDraft('small');
	t.step(0);
	s.step(0);
	expect(s.lastBytes / t.lastBytes).toBeCloseTo(0.28, 2);
	// at k = 4: the small GPT reads 1.25 times fewer bytes per character for about twice the
	// arithmetic; the bigram about 2 times fewer; the target as its own draft more than plain
	const small = speedsOf('small')[3];
	expect(1 / small.bytesShare).toBeCloseTo(1.25, 2);
	expect(small.macsShare).toBeCloseTo(2.1, 1);
	expect(1 / speedsOf('bigram')[3].bytesShare).toBeCloseTo(2, 0);
	expect(speedsOf('self')[3].bytesShare).toBeGreaterThan(1);
});
