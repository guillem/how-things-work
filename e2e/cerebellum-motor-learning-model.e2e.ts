// Checks the cerebellum page's models against what they are known to do: a one-rate error-driven
// learner (Thoroughman & Shadmehr 2000) approaches its plateau exponentially with the time
// constant −1/ln(A − B) and leaves an aftereffect of the opposite sign when the rotation goes;
// the two-rate model with Smith, Ghazizadeh & Shadmehr's (2006) fitted parameters shows
// spontaneous recovery after a brief reversal and savings on re-adaptation, which a single rate
// cannot; a learner with weaker error sensitivity (the model's picture of cerebellar damage,
// whose trial-to-trial changes barely follow the last error) adapts more slowly and keeps a
// smaller aftereffect; an explicit strategy is undone by the implicit learner (Mazzoni &
// Krakauer 2006); the reader's experiment ends its reverse block when the hand is back to
// straight. The numbers the narrative quotes too.
import { expect, test } from '@playwright/test';
import {
	ADAPT,
	BASELINE,
	adaptThenHide,
	block,
	ONE_RATE,
	plateau,
	recoveryProtocol,
	ROTATION,
	runOneRate,
	runTwoRate,
	scaleB,
	SMITH_FIT,
	strategyErrors,
	timeConstant
} from '../src/routes/cerebellum-motor-learning/model';
import {
	forecast,
	phaseOf,
	READAPT,
	REVERSE_MIN,
	type Reach
} from '../src/routes/cerebellum-motor-learning/experiment';

const { A, B } = ONE_RATE;

test('the one-rate learning curve rises with the time constant −1/ln(A − B)', () => {
	const x = runOneRate(block(400, ROTATION), A, B);
	const top = x[x.length - 1];
	// It levels off where the error teaches as much as retention forgets.
	expect(Math.abs(top - plateau(A, B))).toBeLessThan(0.01);
	const tau = timeConstant(A, B);
	expect(tau).toBeGreaterThan(40);
	expect(tau).toBeLessThan(46);
	// After one time constant it has covered 1 − 1/e of the way; after three, 95%.
	const at = (n: number) => {
		const lo = Math.floor(n);
		return x[lo] + (x[lo + 1] - x[lo]) * (n - lo);
	};
	expect(at(tau) / top).toBeCloseTo(1 - Math.exp(-1), 2);
	expect(at(3 * tau) / top).toBeCloseTo(1 - Math.exp(-3), 2);
	// Narrative: τ ≈ 43 trials and a plateau of 17° for 30°.
	expect(Math.round(tau)).toBe(43);
	expect(Math.round(plateau(A, B))).toBe(17);
	// A larger B learns faster.
	expect(timeConstant(A, 0.05)).toBeLessThan(tau / 2);
});

test('removing the rotation leaves an aftereffect of the opposite sign', () => {
	for (const run of [
		(t: Parameters<typeof runOneRate>[0]) => runOneRate(t, A, B),
		(t: Parameters<typeof runOneRate>[0]) => runTwoRate(t).map((s) => s.total)
	]) {
		const trials = [...block(ADAPT, ROTATION), ...block(60, 0)];
		const x = run(trials);
		const firstError = trials[0].rotation - x[0];
		const afterError = trials[ADAPT].rotation - x[ADAPT];
		expect(firstError).toBe(ROTATION);
		expect(afterError).toBeLessThan(-10);
		// With the cursor seen, it washes out.
		expect(Math.abs(trials[ADAPT + 59].rotation - x[ADAPT + 59])).toBeLessThan(
			Math.abs(afterError) / 2
		);
	}
	// With the cursor hidden, only retention acts: the slow part keeps most of it.
	const hidden = runTwoRate(adaptThenHide());
	const end = BASELINE + ADAPT;
	expect(hidden[end + 20].total / hidden[end].total).toBeGreaterThan(0.6);
	expect(hidden[end + 20].slow / hidden[end + 20].total).toBeGreaterThan(0.95);
});

test('two rates show spontaneous recovery after a brief reversal; one rate cannot', () => {
	const { trials, reverse } = recoveryProtocol();
	const s = runTwoRate(trials);
	const start = BASELINE + ADAPT + reverse;
	// The reversal is brief and ends with the correction back to zero...
	expect(reverse).toBeLessThanOrEqual(6);
	expect(s[start].total).toBeLessThanOrEqual(0);
	// ...made of a positive slow part and a negative fast part.
	expect(s[start].slow).toBeGreaterThan(10);
	expect(s[start].fast).toBeLessThan(-10);
	// With the errors hidden, the correction rebounds toward the first adaptation, peaking within
	// the first 10–20 clamp trials (as the participants' did), then decays.
	const clamp = s.slice(start).map((st) => st.total);
	const peak = Math.max(...clamp);
	const at = clamp.indexOf(peak);
	expect(peak).toBeGreaterThan(10);
	expect(at).toBeGreaterThan(3);
	expect(at).toBeLessThan(20);
	expect(clamp[clamp.length - 1]).toBeLessThan(peak);

	// One rate run through the same protocol (its own reversal until zero) stays at zero.
	const head = [...block(BASELINE, 0), ...block(ADAPT, ROTATION)];
	let n = 0;
	let x: number[];
	do {
		n++;
		x = runOneRate([...head, ...block(n, -ROTATION)], A, B);
	} while (x[x.length - 1] > 0);
	const one = runOneRate([...head, ...block(n, -ROTATION), ...block(60, 0, false)], A, B);
	expect(Math.max(...one.slice(head.length + n))).toBeLessThanOrEqual(0);
	// Narrative: a rebound to about half the adapted correction.
	expect(Math.round(peak)).toBe(13);
});

test('two rates relearn faster after a reversal (savings); one rate does not', () => {
	const trialsToHalf = (x: number[], from: number, level: number) =>
		x.slice(from).findIndex((v) => v >= level);
	const first = runTwoRate(block(ADAPT, ROTATION)).map((s) => s.total);
	const level = first[ADAPT] / 2;
	const { trials, reverse } = recoveryProtocol(SMITH_FIT, ADAPT, 0);
	const again = runTwoRate([...trials, ...block(ADAPT, ROTATION)]).map((s) => s.total);
	const from = BASELINE + ADAPT + reverse;
	expect(trialsToHalf(again, from, level)).toBeLessThan(trialsToHalf(first, 0, level) / 2);

	// One rate: the reversal leaves no trace, so relearning takes as long as learning.
	const one = runOneRate(block(ADAPT, ROTATION), A, B);
	const oneLevel = one[ADAPT] / 2;
	let n = 0;
	let x: number[];
	do {
		n++;
		x = runOneRate([...block(ADAPT, ROTATION), ...block(n, -ROTATION)], A, B);
	} while (x[x.length - 1] > 0);
	const oneAgain = runOneRate(
		[...block(ADAPT, ROTATION), ...block(n, -ROTATION), ...block(ADAPT, ROTATION)],
		A,
		B
	);
	const d = trialsToHalf(oneAgain, ADAPT + n, oneLevel) - trialsToHalf(one, 0, oneLevel);
	expect(Math.abs(d)).toBeLessThanOrEqual(1);
});

test('weaker error sensitivity (cerebellar damage) adapts slowly and keeps less', () => {
	const healthy = runTwoRate(adaptThenHide());
	const patient = runTwoRate(adaptThenHide(), scaleB(SMITH_FIT, 0.33));
	const end = BASELINE + ADAPT;
	const half = healthy[end].total / 2;
	const reach = (s: typeof healthy) => s.slice(BASELINE).findIndex((st) => st.total >= half);
	expect(reach(patient)).toBeGreaterThan(5 * reach(healthy));
	expect(patient[end].total).toBeLessThan(0.8 * healthy[end].total);
	// The aftereffect when the rotation goes (cursor hidden) is smaller too.
	expect(patient[end + 1].total).toBeLessThan(healthy[end + 1].total);
	// No error sensitivity, no learning.
	expect(runTwoRate(adaptThenHide(), scaleB(SMITH_FIT, 0))[end].total).toBe(0);
	// Narrative: healthy reaches 13° in 10 reaches and 22° by the end; at a third, 6° and 14°.
	expect(Math.round(healthy[BASELINE + 10].total)).toBe(13);
	expect(Math.round(healthy[end].total)).toBe(22);
	// ...of which 9 fast after ten reaches, and 18 slow at the end.
	expect(Math.round(healthy[BASELINE + 10].fast)).toBe(9);
	expect(Math.round(healthy[end].slow)).toBe(18);
	expect(Math.round(patient[BASELINE + 10].total)).toBe(6);
	expect(Math.round(patient[end].total)).toBe(14);
});

test('an explicit strategy works at once, then the implicit learner pushes past the target', () => {
	const { plain, strategy } = strategyErrors(ADAPT);
	expect(plain[0]).toBe(ROTATION);
	expect(strategy[0]).toBeCloseTo(0, 9);
	// The error without a strategy shrinks; with it, it grows the other way.
	expect(plain[ADAPT - 1]).toBeLessThan(10);
	expect(strategy[10]).toBeLessThan(-3);
	expect(strategy[ADAPT - 1]).toBeLessThan(strategy[10]);
	expect(Math.round(-strategy[ADAPT - 1])).toBe(21);
});

test('the recovery step reverses the rotation until the hand is back to straight', () => {
	const reach = (rotation: number, hand: number, feedback = true): Reach => ({
		step: 'recover',
		target: 90,
		hand,
		rotation,
		feedback
	});
	const adapted = Array.from({ length: READAPT }, () => reach(ROTATION, -25));
	expect(phaseOf('recover', adapted.slice(0, 5)).rotation).toBe(ROTATION);
	expect(phaseOf('recover', adapted).rotation).toBe(-ROTATION);
	// Still turned against the first rotation: the reversal goes on.
	const r1 = [...adapted, reach(-ROTATION, -10), reach(-ROTATION, -5), reach(-ROTATION, -2)];
	expect(phaseOf('recover', r1).rotation).toBe(-ROTATION);
	// Back to straight (or past it): the cursor is hidden from now on.
	const r2 = [...r1, reach(-ROTATION, 3)];
	expect(phaseOf('recover', r2)).toMatchObject({ rotation: 0, feedback: false });
	expect(phaseOf('recover', [...r2, reach(0, -8, false)]).feedback).toBe(false);
	// At least REVERSE_MIN reversed reaches, even for a hand that never adapted.
	const none = Array.from({ length: READAPT }, () => reach(ROTATION, 0));
	expect(phaseOf('recover', [...none, reach(-ROTATION, 0)]).rotation).toBe(-ROTATION);
	expect(
		phaseOf('recover', [...none, ...Array.from({ length: REVERSE_MIN }, () => reach(-ROTATION, 0))])
			.feedback
	).toBe(false);

	// A hand that never comes back: the reversal stops at its limit, and says so.
	const stuck = [...adapted, ...Array.from({ length: 15 }, () => reach(-ROTATION, -20))];
	expect(phaseOf('recover', stuck)).toMatchObject({ rotation: 0, feedback: false });
	expect(phaseOf('recover', stuck).name).toContain('not back to straight');

	// The model doing the whole step itself shows the rebound.
	const f = forecast('recover', [], { fast: 0, slow: 0, total: 0 }, 70).map((s) => s.total);
	const low = Math.min(...f.slice(READAPT));
	const lowAt = f.indexOf(low, READAPT);
	expect(low).toBeLessThanOrEqual(1);
	expect(Math.max(...f.slice(lowAt))).toBeGreaterThan(low + 4);
});
