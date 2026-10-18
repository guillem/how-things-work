// Checks the rlhf-alignment page's model against what RLHF's maths says: the Bradley–Terry fit
// recovers the strengths that generated a set of comparisons, the closed-form KL-regularised
// policy π ∝ π_ref·exp(r/β) is the one that maximises E[r] − β·KL (and the one policy-gradient
// ascent converges to, exactly or from sampled answers), its limits are π_ref and the reward
// model's favourite, and on the page's own GPT-2 answers loosening the leash raises the reward
// model's score while the rater's own score first rises and then falls (Gao et al. 2023), less so
// with more comparisons. The numbers the narrative quotes are checked here too.
import { expect, test } from '@playwright/test';
import { prompts } from '../src/routes/rlhf-alignment/rlhf-data';
import {
	BETAS,
	correlation,
	expect as mean,
	fitRewardModel,
	kl,
	objective,
	overoptimisation,
	policyGradient,
	rewards,
	rng,
	simulateComparisons,
	strengths,
	tilt,
	tv
} from '../src/routes/rlhf-alignment/rlhf';
import { DEFAULT_COMPARISONS, DEFAULT_SEED } from '../src/routes/rlhf-alignment/prefs';

const P = (id: string) => prompts.find((p) => p.id === id)!;

/** The reward model fitted to `n` of the stand-in rater's comparisons with the given seed. */
function rewardModel(id: string, n: number, seed: number) {
	const p = P(id);
	const F = p.answers.map((a) => a.f);
	const s = p.answers.map((a) => a.score);
	const r = rewards(F, fitRewardModel(F, simulateComparisons(strengths(s), n, seed)));
	return { r, s };
}

test('the data: 64 different GPT-2 answers per question, scored on the rater’s scale', () => {
	expect(prompts.map((p) => p.id)).toEqual(['sleep', 'hiking', 'plants']);
	for (const p of prompts) {
		expect(p.answers).toHaveLength(64);
		expect(new Set(p.answers.map((a) => a.text)).size).toBe(64);
		for (const a of p.answers) {
			expect(a.text.length).toBeGreaterThan(0);
			expect(a.score).toBeGreaterThanOrEqual(-3);
			expect(a.score).toBeLessThanOrEqual(4);
			expect(a.f).toHaveLength(48);
		}
	}
});

test('Bradley–Terry recovers the strengths that generated the comparisons', () => {
	// ten items, one feature each (a table of scores), many comparisons
	const truth = [-2, -1.5, -1, -0.5, 0, 0.3, 0.8, 1.2, 1.7, 2.5];
	const F = truth.map((_, i) => truth.map((__, j) => (i === j ? 1 : 0)));
	const r = rewards(F, fitRewardModel(F, simulateComparisons(truth, 20_000, 7), 0.01));
	const shift = mean(new Array(10).fill(0.1), r) - mean(new Array(10).fill(0.1), truth);
	for (let i = 0; i < 10; i++) expect(Math.abs(r[i] - shift - truth[i])).toBeLessThan(0.12);
	// only differences are learnt: adding a constant to every strength changes nothing
	const moved = rewards(
		F,
		fitRewardModel(
			F,
			simulateComparisons(
				truth.map((v) => v + 5),
				20_000,
				7
			),
			0.01
		)
	);
	for (let i = 0; i < 10; i++) expect(moved[i]).toBeCloseTo(r[i], 6);
});

test('with no comparisons the reward model scores every answer the same', () => {
	const F = P('sleep').answers.map((a) => a.f);
	expect(new Set(rewards(F, fitRewardModel(F, []))).size).toBe(1);
});

test('more comparisons make a better reward model (correlations the page quotes)', () => {
	const avg = (n: number) => {
		let s = 0;
		let k = 0;
		for (const p of prompts)
			for (const seed of [1, 2, 3, 4, 5]) {
				const m = rewardModel(p.id, n, seed);
				s += correlation(m.r, m.s);
				k++;
			}
		return s / k;
	};
	const few = avg(30);
	const some = avg(100);
	const many = avg(400);
	expect(few).toBeLessThan(0.4);
	expect(some).toBeGreaterThan(few);
	expect(many).toBeGreaterThan(0.7);
});

test('the tilted policy maximises E[r] − β·KL, and its limits are π_ref and the favourite', () => {
	const { r } = rewardModel('sleep', DEFAULT_COMPARISONS, DEFAULT_SEED);
	const rand = rng(3);
	for (const beta of [0.1, 1, 5]) {
		const best = objective(tilt(r, beta), r, beta);
		for (let k = 0; k < 50; k++) {
			const u = r.map(() => rand() ** 3);
			const z = u.reduce((a, b) => a + b, 0);
			expect(
				objective(
					u.map((v) => v / z),
					r,
					beta
				)
			).toBeLessThanOrEqual(best + 1e-12);
		}
		// nudging the optimum lowers the objective
		const pi = tilt(r, beta);
		const nudged = pi.map((p, i) => (i === 0 ? p + 0.01 : p));
		const z = nudged.reduce((a, b) => a + b, 0);
		expect(
			objective(
				nudged.map((v) => v / z),
				r,
				beta
			)
		).toBeLessThan(best);
	}
	expect(kl(tilt(r, 1e6))).toBeLessThan(1e-9);
	const top = r.indexOf(Math.max(...r));
	expect(tilt(r, 1e-4)[top]).toBeGreaterThan(0.999);
	expect(kl(tilt(r, 1e-4))).toBeCloseTo(Math.log(64), 3);
});

test('policy-gradient ascent converges to the closed form, exactly and from sampled answers', () => {
	const { r } = rewardModel('sleep', DEFAULT_COMPARISONS, DEFAULT_SEED);
	for (const beta of [0.5, 1, 2]) {
		const target = tilt(r, beta);
		const exact = policyGradient(r, beta, { iters: 3000, lr: 1.5 });
		expect(tv(exact.pis.at(-1)!, target)).toBeLessThan(0.005);
		const sampled = policyGradient(r, beta, { iters: 3000, batch: 16, lr: 0.5, seed: 1 });
		expect(tv(sampled.pis[0], target)).toBeGreaterThan(0.1);
		expect(tv(sampled.pis.at(-1)!, target)).toBeLessThan(0.03);
	}
});

test('over-optimisation: as β falls the proxy reward rises but the rater’s score peaks and falls', () => {
	const { r, s } = rewardModel('sleep', DEFAULT_COMPARISONS, DEFAULT_SEED);
	const curve = overoptimisation(r, s);
	for (let i = 1; i < curve.length; i++) {
		expect(curve[i].kl).toBeGreaterThanOrEqual(curve[i - 1].kl - 1e-12);
		expect(curve[i].proxy).toBeGreaterThanOrEqual(curve[i - 1].proxy - 1e-12);
	}
	const base = mean(new Array(64).fill(1 / 64), s);
	const peak = curve.reduce((a, b) => (b.gold > a.gold ? b : a));
	const end = curve.at(-1)!;
	expect(peak.gold).toBeGreaterThan(base + 0.3);
	expect(peak.beta).toBeGreaterThan(BETAS.at(-1)!);
	expect(end.gold).toBeLessThan(peak.gold - 0.3);
	// the policy ends on one answer the reward model over-rates
	const top = r.indexOf(Math.max(...r));
	expect(s[top]).toBeLessThan(peak.gold);
});

test('more comparisons make the drop smaller: the reward model has fewer mistakes to exploit', () => {
	const drop = (n: number) => {
		let d = 0;
		for (const p of prompts)
			for (const seed of [1, 2, 3, 4, 5]) {
				const { r, s } = rewardModel(p.id, n, seed);
				const curve = overoptimisation(r, s);
				d += Math.max(...curve.map((c) => c.gold)) - curve.at(-1)!.gold;
			}
		return d / 15;
	};
	expect(drop(400)).toBeLessThan(drop(100) / 2);
});
