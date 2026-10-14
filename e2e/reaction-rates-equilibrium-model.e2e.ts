// Checks the H₂ + I₂ ⇌ 2 HI model against Bodenstein's measurements, an independent
// equilibrium measurement and the laws the narrative states (definition of done #5
// in docs/TOPICS.md). Runs in Node.
import { expect, test } from '@playwright/test';
import {
	DECOMPOSITION,
	EQUILIBRIUM,
	FORMATION,
	OPENSTAX_DECOMPOSITION
} from '../src/routes/reaction-rates-equilibrium/bodenstein';
import {
	DH,
	EA_F,
	EA_R,
	GOLD_LOWERING,
	START,
	START_HI,
	START_TOTAL,
	UNIT,
	ZERO_C,
	equilibriumConstant,
	equilibriumMix,
	fractionAbove,
	halfLife,
	hiShare,
	kForward,
	kFromFraction,
	kReverse,
	mixAt,
	quotient,
	rates,
	sampleAt,
	simulate,
	timeToEquilibrium
} from '../src/routes/reaction-rates-equilibrium/model';
import { BoxRun, startSpecies } from '../src/routes/reaction-rates-equilibrium/box';

const at = (T: number, lowering = 0) => ({ T, lowering });

test('the rate constants reproduce every one of Bodenstein’s measurements to within 25 %', () => {
	for (const [c, k] of FORMATION) {
		expect(Math.abs(Math.log(kForward(c + ZERO_C) / (k / UNIT)))).toBeLessThan(0.25);
	}
	for (const [c, k] of DECOMPOSITION) {
		expect(Math.abs(Math.log(kReverse(c + ZERO_C) / (k / UNIT)))).toBeLessThan(0.25);
	}
	for (const [T, k] of OPENSTAX_DECOMPOSITION) {
		expect(Math.abs(Math.log(kReverse(T) / k))).toBeLessThan(0.25);
	}
});

test('the barriers the page quotes, and they differ by exactly the reaction enthalpy', () => {
	expect(EA_F / 1000).toBeCloseTo(171, 0);
	expect(EA_R / 1000).toBeCloseTo(183, 0);
	expect(DH / 1000).toBeCloseTo(-12.2, 1);
	// Detailed balance: k_f / k_r is K at every temperature.
	for (const T of [560, 650, 700, 780]) {
		expect(kForward(T) / kReverse(T)).toBeCloseTo(equilibriumConstant(T), 9);
	}
	// The apparent activation energy of k_r, measured from two temperatures.
	const slope = Math.log(kReverse(710) / kReverse(690)) / (1 / 690 - 1 / 710);
	expect((slope * 8.314462618) / 1000).toBeCloseTo(EA_R / 1000, 3);
});

test('K follows Bodenstein’s equilibrium and an independent measurement (Taylor & Crist 1941)', () => {
	for (const [c, xi] of EQUILIBRIUM) {
		expect(Math.abs(Math.log(equilibriumConstant(c + ZERO_C) / kFromFraction(xi)))).toBeLessThan(
			0.1
		);
	}
	// Taylor and Crist: 22.3 % of HI dissociated at 730.8 K (K ≈ 48.6).
	expect(equilibriumConstant(730.8) / kFromFraction(0.223)).toBeGreaterThan(0.95);
	expect(equilibriumConstant(730.8) / kFromFraction(0.223)).toBeLessThan(1.05);
	expect(equilibriumConstant(700)).toBeCloseTo(52, 0);
	// Exothermic: K falls as the temperature rises.
	expect(equilibriumConstant(780)).toBeLessThan(equilibriumConstant(650));
});

test('only a tiny share of collisions carries enough energy; +10 K makes reactions 1.5× faster', () => {
	const share = fractionAbove(EA_F, 700);
	expect(share).toBeGreaterThan(1e-13);
	expect(share).toBeLessThan(3e-13);
	expect(kForward(710) / kForward(700)).toBeCloseTo(1.5, 1);
	// From 650 to 750 K the forward rate constant grows about 70-fold.
	const ratio = kForward(750) / kForward(650);
	expect(ratio).toBeGreaterThan(60);
	expect(ratio).toBeLessThan(80);
});

test('the rate law: twice the hydrogen, twice the rate', () => {
	const r1 = rates(START, 700).forward;
	const r2 = rates({ ...START, h2: START.h2 * 2 }, 700).forward;
	expect(r2 / r1).toBeCloseTo(2, 9);
	// The reaction slows as the reactants are used up: half-life about half an hour at 700 K.
	expect(halfLife(START, at(700)) / 60).toBeCloseTo(31, 0);
	expect(halfLife(START, at(780)) / 60).toBeLessThan(2);
});

test('the run settles where forward and reverse rates are equal, and Q = K', () => {
	const run = simulate(START, at(700), [], 40 * 3600, 60);
	const end = run[run.length - 1];
	expect(end.forward / end.reverse).toBeCloseTo(1, 4);
	expect(quotient(end)).toBeCloseTo(equilibriumConstant(700), 2);
	// Atoms are conserved.
	expect(end.h2 * 2 + end.hi).toBeCloseTo(START_TOTAL, 12);
	expect(end.i2 * 2 + end.hi).toBeCloseTo(START_TOTAL, 12);
	// The cumulative counts keep growing: the reaction still runs both ways.
	expect(end.done).toBeGreaterThan(run[run.length - 100].done);
	expect(end.undone).toBeGreaterThan(run[run.length - 100].undone);
	// About 78 % of the iodine ends up in HI.
	expect(hiShare(end)).toBeCloseTo(0.783, 2);
});

test('the same equilibrium from either side', () => {
	const a = equilibriumMix(START, 700);
	const b = equilibriumMix(START_HI, 700);
	expect(a.hi).toBeCloseTo(b.hi, 12);
	const run = simulate(START_HI, at(700), [], 60 * 3600, 60);
	expect(run[run.length - 1].hi).toBeCloseTo(a.hi, 6);
});

test('a catalyst speeds both directions alike: the same mixture, reached sooner', () => {
	const slow = timeToEquilibrium(START, at(700));
	const fast = timeToEquilibrium(START, at(700, GOLD_LOWERING));
	expect(slow / fast).toBeGreaterThan(1e5);
	expect(kForward(700, GOLD_LOWERING) / kForward(700)).toBeCloseTo(
		kReverse(700, GOLD_LOWERING) / kReverse(700),
		6
	);
	const run = simulate(START, at(700, GOLD_LOWERING), [], fast * 5, fast / 100);
	expect(run[run.length - 1].hi).toBeCloseTo(equilibriumMix(START, 700).hi, 6);
	// Gold lowers the 183 kJ/mol barrier to 105.
	expect((EA_R - GOLD_LOWERING) / 1000).toBeCloseTo(105, 6);
});

test('Le Chatelier: added hydrogen is partly used up, and makes more HI', () => {
	const eq = equilibriumMix(START, 700);
	const extra = START_TOTAL / 6;
	const run = simulate(eq, at(700), [{ at: 600, addH2: extra }], 30 * 3600, 60);
	const end = run[run.length - 1];
	expect(end.hi).toBeGreaterThan(eq.hi);
	expect(end.i2).toBeLessThan(eq.i2);
	expect(end.h2).toBeLessThan(eq.h2 + extra);
	expect(end.h2).toBeGreaterThan(eq.h2);
	expect(quotient(end)).toBeCloseTo(equilibriumConstant(700), 2);
	// Just after the addition Q < K, so the forward rate wins.
	const after = sampleAt(run, 660);
	expect(quotient(after)).toBeLessThan(equilibriumConstant(700));
	expect(after.forward).toBeGreaterThan(after.reverse);
});

test('heating shifts this exothermic equilibrium only a little towards H₂ and I₂', () => {
	const cool = hiShare(equilibriumMix(START, 650));
	const hot = hiShare(equilibriumMix(START, 780));
	expect(hot).toBeLessThan(cool);
	expect(cool - hot).toBeLessThan(0.05);
	// …while the rates grow more than a hundredfold.
	expect(kForward(780) / kForward(650)).toBeGreaterThan(100);
});

test('the box of molecules follows the model to within a molecule or two', () => {
	const unit = START_TOTAL / 60;
	const lapse = 600; // 1 s of animation = 10 min
	const run = simulate(START, at(700), [], 40 * lapse, lapse / 30);
	const box = new BoxRun(startSpecies(30, 30, 0), (t) => {
		const s = sampleAt(run, t * lapse);
		return { forward: s.done / unit, reverse: s.undone / unit };
	});
	for (const t of [2, 5, 10, 20, 39]) {
		const st = box.stateAt(t);
		const model = sampleAt(run, t * lapse);
		expect(Math.abs(st.counts.hi - model.hi / unit)).toBeLessThanOrEqual(3);
		expect(st.counts.h2 + st.counts.hi / 2).toBe(30);
	}
	// At equilibrium the box still reacts both ways.
	const st = box.stateAt(39);
	expect(st.reverse).toBeGreaterThan(2);
});

test('the step-by-step integration agrees with the exact solution of the rate law', () => {
	for (const [start, c] of [
		[START, at(700)],
		[START_HI, at(760)],
		[{ ...START, h2: START.h2 * 2 }, at(650, 20e3)]
	] as const) {
		const tau = 1 / (kForward(c.T, c.lowering) * START_TOTAL);
		const run = simulate(start, c, [], 10 * tau, tau / 10);
		for (const k of [3, 10, 40, 100]) {
			const exact = mixAt(start, c, run[k].t);
			expect(run[k].hi / exact.hi).toBeCloseTo(1, 6);
		}
	}
});
