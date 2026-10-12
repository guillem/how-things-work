// Checks the glucose–insulin–glucagon model against clinical reference values
// (definition of done #5 in docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	THRESHOLDS,
	at,
	basalFor,
	extremes,
	fasting,
	simulate,
	type Scenario
} from '../src/routes/homeostasis/model';

const healthy = { production: 1, sensitivity: 1, basal: 0 };
const meal = (o: Partial<Scenario> = {}) => simulate({ carbs: 75, mealAt: 0, ...o }, -30, 360);

test('a healthy adult has a normal fasting glucose and insulin', () => {
	const f = fasting(healthy);
	// ADA: normal fasting glucose is under 100 mg/dL; Topp et al.'s normal state is 100.
	expect(f.g).toBeGreaterThanOrEqual(70);
	expect(f.g).toBeLessThanOrEqual(THRESHOLDS.fastingNormal + 0.5);
	expect(f.i).toBeCloseTo(10, 1);
	// Nothing happens without a disturbance: the steady state holds.
	const quiet = simulate({}, 0, 300);
	expect(Math.abs(at(quiet, 300).g - f.g)).toBeLessThan(0.1);
});

test('after a 75 g glucose drink, negative feedback brings glucose back down', () => {
	const s = meal();
	const f = fasting(healthy);
	const { hi } = extremes(s, 0, 360);
	expect(hi.g).toBeGreaterThan(140);
	// A normal glucose tolerance test: under 140 mg/dL two hours later (ADA).
	expect(at(s, 120).g).toBeLessThan(THRESHOLDS.twoHourNormal);
	// Back near the fasting level within four hours.
	expect(at(s, 240).g - f.g).toBeLessThan(10);
	// Insulin rises several-fold, glucagon is held down.
	const peakInsulin = Math.max(...s.map((p) => p.i));
	expect(peakInsulin).toBeGreaterThan(4 * f.i);
	expect(at(s, 60).gcg).toBeLessThan(0.8);
	// The page says the peak is near 190 mg/dL, higher than in real people;
	// a recalibration must not push it further.
	expect(hi.g).toBeLessThan(200);
});

test('with no insulin production (type 1) glucose stays high', () => {
	const f = fasting({ ...healthy, production: 0 });
	expect(f.g).toBeGreaterThanOrEqual(THRESHOLDS.fastingDiabetes);
	const s = meal({ production: 0 });
	expect(at(s, 120).g).toBeGreaterThanOrEqual(THRESHOLDS.twoHourDiabetes);
	expect(at(s, 360).g).toBeGreaterThan(f.g);
	// Above the kidneys' threshold glucose spills into urine.
	expect(Math.max(...s.map((p) => p.urine))).toBeGreaterThan(0);
});

test('below about a quarter of normal insulin production, fasting glucose is diabetic', () => {
	expect(fasting({ ...healthy, production: 0.2 }).g).toBeGreaterThanOrEqual(
		THRESHOLDS.fastingDiabetes
	);
	expect(fasting({ ...healthy, production: 0.3 }).g).toBeLessThan(THRESHOLDS.fastingDiabetes);
});

test('with no insulin at all, a meal sends glucose to about 600 and it stays above 400 for hours', () => {
	const s = meal({ production: 0 });
	expect(extremes(s, 0, 360).hi.g).toBeGreaterThan(550);
	expect(at(s, 360).g).toBeGreaterThan(400);
});

test('with insulin resistance insulin rises but glucose still falls, only more slowly', () => {
	const normal = meal();
	const resistant = meal({ sensitivity: 0.4 });
	const f = fasting({ ...healthy, sensitivity: 0.4 });
	expect(f.i).toBeGreaterThan(fasting(healthy).i);
	expect(Math.max(...resistant.map((p) => p.i))).toBeGreaterThan(
		Math.max(...normal.map((p) => p.i))
	);
	expect(at(resistant, 120).g).toBeGreaterThan(at(normal, 120).g);
	const { hi } = extremes(resistant, 0, 360);
	expect(at(resistant, 360).g).toBeLessThan(hi.g - 80);
});

test('making more insulin can make up for resistance; failing to is type 2 diabetes', () => {
	const compensated = fasting({ production: 2, sensitivity: 0.5, basal: 0 });
	expect(compensated.g).toBeLessThan(THRESHOLDS.fastingNormal);
	expect(compensated.i).toBeGreaterThan(1.5 * fasting(healthy).i);
	const failing = fasting({ production: 0.4, sensitivity: 0.4, basal: 0 });
	expect(failing.g).toBeGreaterThanOrEqual(THRESHOLDS.fastingDiabetes);
});

test('a run lowers glucose after a meal, and a healthy body keeps it in range', () => {
	const run = { intensity: 65, runAt: 30, runFor: 45 };
	expect(at(meal(run), 60).g).toBeLessThan(at(meal(), 60).g - 20);
	// Fasting, the loop holds glucose in the normal range: insulin falls, glucagon rises.
	const fastingRun = simulate({ ...run, runAt: 0 }, -30, 240);
	expect(extremes(fastingRun).lo.g).toBeGreaterThan(THRESHOLDS.hypo);
	expect(at(fastingRun, 40).i).toBeLessThan(0.5 * fasting(healthy).i);
	expect(at(fastingRun, 40).gcg).toBeGreaterThan(1.5);
	// The page: on an empty stomach glucose dips by only about 10–15 mg/dL.
	const dip = fasting(healthy).g - extremes(fastingRun).lo.g;
	expect(dip).toBeGreaterThanOrEqual(10);
	expect(dip).toBeLessThanOrEqual(15);
	// Even a run an hour after the meal keeps a healthy body out of hypoglycaemia.
	expect(extremes(meal({ ...run, runAt: 60 })).lo.g).toBeGreaterThan(THRESHOLDS.hypo);
});

test('with injected insulin, a run lowers glucose much more', () => {
	const basal = basalFor(100);
	const t1 = { production: 0, basal, carbs: 60, dose: 6, doseAt: -15 };
	const still = simulate(t1);
	const running = simulate({ ...t1, intensity: 65, runAt: 60, runFor: 45 });
	expect(at(running, 120).g).toBeLessThan(at(still, 120).g - 40);
});

test('dosing insulin by hand: too little leaves glucose high, too much causes hypoglycaemia', () => {
	const basal = basalFor(100);
	expect(fasting({ production: 0, sensitivity: 1, basal }).g).toBeCloseTo(100, 0);
	const t1 = (dose: number, carbs = 60) =>
		simulate({ production: 0, basal, carbs, dose, doseAt: -15 });
	expect(extremes(t1(0)).hi.g).toBeGreaterThan(250);
	const matched = extremes(t1(6));
	expect(matched.hi.g).toBeLessThan(extremes(t1(0)).hi.g - 80);
	expect(matched.lo.g).toBeGreaterThan(THRESHOLDS.hypo);
	expect(extremes(t1(12)).lo.g).toBeLessThan(THRESHOLDS.hypo);
	// Insulin without food: level 2 hypoglycaemia (ADA: under 54 mg/dL).
	expect(extremes(t1(8, 0)).lo.g).toBeLessThan(THRESHOLDS.severeHypo);
});

test('timing matters: a dose that works before the meal soars, then crashes, an hour after it', () => {
	const basal = basalFor(100);
	const t1 = (doseAt: number) => simulate({ production: 0, basal, carbs: 75, dose: 7, doseAt });
	const onTime = extremes(t1(-15));
	expect(onTime.lo.g).toBeGreaterThan(THRESHOLDS.hypo);
	const late = extremes(t1(60));
	expect(late.hi.g).toBeGreaterThan(onTime.hi.g + 80);
	expect(late.lo.g).toBeLessThan(THRESHOLDS.hypo);
	expect(late.lo.t).toBeGreaterThan(late.hi.t);
});

test('glucagon defends against a low only while the islets work', () => {
	const dose = { carbs: 0, dose: 8, doseAt: 0 };
	const withIslets = simulate({ ...dose, production: 1 });
	const without = simulate({ ...dose, production: 0, basal: basalFor(100) });
	expect(Math.max(...withIslets.map((p) => p.gcg))).toBeGreaterThan(2);
	expect(Math.max(...without.map((p) => p.gcg))).toBeLessThan(1.05);
	expect(extremes(withIslets).lo.g).toBeGreaterThan(extremes(without).lo.g + 15);
});
