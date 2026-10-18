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
	probsAfter,
	runOf,
	SAMPLES,
	speedsOf
} from '../src/routes/speculative-decoding/results';
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
