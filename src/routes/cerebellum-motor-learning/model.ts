/**
 * Error-driven motor adaptation as a state-space model.
 *
 * On every reach n the learner's correction x(n) (in degrees, positive = turned against the
 * rotation) meets a perturbation f(n) (the cursor's rotation). Where the cursor is seen, the
 * error is e(n) = f(n) − x(n); where it is hidden (no visual feedback, like the error clamp of
 * Smith et al. 2006) the learner gets no error, e(n) = 0, and only its retention acts.
 *
 *   one rate (Thoroughman & Shadmehr 2000):  x(n+1) = A·x(n) + B·e(n)
 *   two rates (Smith, Ghazizadeh & Shadmehr 2006):
 *     x_f(n+1) = A_f·x_f(n) + B_f·e(n),  x_s(n+1) = A_s·x_s(n) + B_s·e(n),  x = x_f + x_s
 *
 * The two-rate parameters are Smith et al.'s least-squares fit to people adapting to a force
 * field (PLoS Biology 4(6): e179, Fig. 3D); the one-rate defaults are the values that paper used
 * to illustrate a single-state model (Figs. 1–2). Both are in trials, not seconds.
 */

/** One reach: the cursor's rotation in degrees and whether the cursor was shown. */
export interface Trial {
	rotation: number;
	feedback: boolean;
}

export interface TwoRates {
	Af: number;
	Bf: number;
	As: number;
	Bs: number;
}

/** Smith, Ghazizadeh & Shadmehr 2006, Fig. 3D: the fit to their participants' force-field data. */
export const SMITH_FIT: TwoRates = { Af: 0.59, Bf: 0.21, As: 0.992, Bs: 0.02 };

/** The single-state model Smith et al. 2006 used for comparison in Figs. 1–2. */
export const ONE_RATE = { A: 0.99, B: 0.013 };

/** The rotation of the page's experiment, in degrees. */
export const ROTATION = 30;

/** The learner's correction before each trial, and after the last (length n + 1). */
export interface TwoRateState {
	fast: number;
	slow: number;
	total: number;
}

/** One trial of the two-rate learner: its state after `tr`. */
export function stepTwoRate(st: TwoRateState, tr: Trial, r: TwoRates = SMITH_FIT): TwoRateState {
	const e = tr.feedback ? tr.rotation - st.total : 0;
	const fast = r.Af * st.fast + r.Bf * e;
	const slow = r.As * st.slow + r.Bs * e;
	return { fast, slow, total: fast + slow };
}

export function runTwoRate(trials: readonly Trial[], r: TwoRates = SMITH_FIT): TwoRateState[] {
	const out: TwoRateState[] = [{ fast: 0, slow: 0, total: 0 }];
	for (const tr of trials) out.push(stepTwoRate(out[out.length - 1], tr, r));
	return out;
}

/** The one-rate learner's correction before each trial, and after the last (length n + 1). */
export function runOneRate(trials: readonly Trial[], A: number, B: number): number[] {
	let x = 0;
	const out = [x];
	for (const tr of trials) {
		const e = tr.feedback ? tr.rotation - x : 0;
		x = A * x + B * e;
		out.push(x);
	}
	return out;
}

/**
 * Under a constant seen rotation the one-rate error shrinks by a factor A − B per trial, so the
 * correction approaches its plateau as 1 − (A − B)ⁿ: the time constant in trials.
 */
export function timeConstant(A: number, B: number): number {
	const k = A - B;
	return k > 0 && k < 1 ? -1 / Math.log(k) : k <= 0 ? 0 : Infinity;
}

/** Where the one-rate correction levels off under a constant rotation: B·f / (1 − A + B). */
export function plateau(A: number, B: number, rotation = ROTATION): number {
	return (B * rotation) / (1 - A + B);
}

/** `n` trials of the same kind. */
export function block(n: number, rotation: number, feedback = true): Trial[] {
	return Array.from({ length: n }, () => ({ rotation, feedback }));
}

/** The canonical schedule of the model chapter: baseline, a long rotation, then hidden cursor. */
export const BASELINE = 10;
export const ADAPT = 150;
export const HIDDEN = 50;
export const adaptThenHide = (): Trial[] => [
	...block(BASELINE, 0),
	...block(ADAPT, ROTATION),
	...block(HIDDEN, 0, false)
];

/**
 * Smith et al.'s spontaneous-recovery protocol: adapt, reverse the perturbation just until the
 * learner's correction is back to zero, then hide the errors (error clamp). Returns the schedule
 * and the length of the reverse block.
 */
export function recoveryProtocol(
	r: TwoRates = SMITH_FIT,
	adapt = ADAPT,
	clamp = 60
): { trials: Trial[]; reverse: number } {
	const head = [...block(BASELINE, 0), ...block(adapt, ROTATION)];
	let reverse = 0;
	while (reverse < 200) {
		reverse++;
		const s = runTwoRate([...head, ...block(reverse, -ROTATION)], r);
		if (s[s.length - 1].total <= 0) break;
	}
	return {
		trials: [...head, ...block(reverse, -ROTATION), ...block(clamp, 0, false)],
		reverse
	};
}

/** The same rates with both error sensitivities scaled by `k` (the cerebellar patients' case). */
export const scaleB = (r: TwoRates, k: number): TwoRates => ({
	...r,
	Bf: r.Bf * k,
	Bs: r.Bs * k
});

/**
 * Mazzoni & Krakauer 2006: told about the rotation, a person aims `ROTATION` degrees the other
 * way and hits the target at once. The implicit learner still learns from the gap between where
 * it aimed and where the cursor went, which the strategy does not remove: its correction adds to
 * the aim, and the cursor drifts past the target. The fast process tracks deliberate aiming in
 * rotation tasks (McDougle, Bond & Taylor 2015), so with a strategy the slow learner alone is
 * taken as the implicit one. Returns the target error (cursor − target, in degrees, positive in
 * the rotation's direction) before each trial: without a strategy (the whole two-rate model) and
 * with one (the slow learner under the fixed aim).
 */
export function strategyErrors(
	trials: number,
	r: TwoRates = SMITH_FIT
): { plain: number[]; strategy: number[] } {
	const both = runTwoRate(block(trials, ROTATION), r).slice(0, trials);
	// The aim error the slow learner sees is rotation − its correction, as without a strategy;
	// the aim already cancels the rotation, so the target error is minus the correction.
	const slow = runOneRate(block(trials, ROTATION), r.As, r.Bs).slice(0, trials);
	return {
		plain: both.map((st) => ROTATION - st.total),
		strategy: slow.map((x) => -x)
	};
}
