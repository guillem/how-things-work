// Checks the pharmacokinetics page's one-compartment model against the closed forms of linear
// elimination and against the numbers its five drug labels state: an injection halves every
// ln 2 · V / CL; a tablet peaks within the label's range of peak times; repeated doses reach
// 50, 75, 87.5, 94 and 97% of the steady state after 1 to 5 half-lives, whatever the dose; a
// doubled dose doubles the plateau but not the speed; a loading dose reaches it at once; the
// theophylline infusion and loading dose of the aminophylline label give about 10 mcg/mL; digoxin's
// days to steady state match the Lanoxin label's table; halving lithium's clearance doubles its
// level; and phenytoin's saturable elimination makes the level rise far faster than the dose.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	DRUGS,
	LITHIUM_MEQ_PER_300MG,
	halfLife
} from '../src/routes/pharmacokinetics-dosing/drugs';
import {
	bodyOf,
	halfLifeAt,
	ivLevel,
	levelAt,
	oralLevel,
	oralPeakTime,
	range,
	repeated,
	shareAfter,
	simulate,
	steadyAverage,
	timeToShare
} from '../src/routes/pharmacokinetics-dosing/model';

const { theophylline, digoxin, lithium, vancomycin, phenytoin } = DRUGS;

test('an injection falls by half every ln 2 · V / CL hours', () => {
	const b = bodyOf(theophylline);
	const t12 = halfLifeAt(b);
	// the label: half-life 8.7 h (6.1 to 12.8) in healthy non-smoking adults
	expect(t12).toBeGreaterThan(6.1);
	expect(t12).toBeLessThan(12.8);
	const s = simulate(b, [{ t: 0, form: 'injection', amount: 320 }], 48);
	const c0 = levelAt(s, 0);
	expect(levelAt(s, t12) / c0).toBeCloseTo(0.5, 3);
	expect(levelAt(s, 3 * t12) / c0).toBeCloseTo(0.125, 3);
	for (const time of [1, 5, 20, 40]) expect(levelAt(s, time)).toBeCloseTo(ivLevel(b, 320, time), 3);
	// doubling the volume doubles the half-life, and so does halving the clearance
	expect(halfLifeAt(bodyOf(theophylline, { volume: 2 }))).toBeCloseTo(2 * t12, 6);
	expect(halfLifeAt(bodyOf(theophylline, { clearance: 0.5 }))).toBeCloseTo(2 * t12, 6);
});

test('the labels’ loading doses: theophylline 4.6 mg/kg gives about 10 mcg/mL', () => {
	const b = bodyOf(theophylline);
	const s = simulate(b, [{ t: 0, form: 'injection', amount: 4.6 * 70, duration: 0.5 }], 4, 400);
	// "a maximum post-distribution serum concentration of 10 mcg/mL with a range of 6-16"
	const peak = range(s, 0, 4).max;
	expect(peak).toBeGreaterThan(9);
	expect(peak).toBeLessThan(11);
});

test('a tablet peaks within the label’s range of peak times', () => {
	// [drug, earliest, latest] hours, from the labels
	const cases: [typeof theophylline, number, number][] = [
		[theophylline, 1, 2],
		[digoxin, 1, 3],
		[lithium, 0.25, 3],
		[phenytoin, 4, 12]
	];
	for (const [d, lo, hi] of cases) {
		const b = bodyOf(d, { saturable: false });
		const tp = oralPeakTime(b);
		expect(tp, d.id).toBeGreaterThanOrEqual(lo);
		expect(tp, d.id).toBeLessThanOrEqual(hi);
		// the integrator agrees with the closed form
		const s = simulate(b, [{ t: 0, form: 'tablet', amount: d.tablet }], 3 * tp + 24, 2000);
		expect(levelAt(s, tp)).toBeCloseTo(oralLevel(b, d.tablet, tp), 4);
	}
	// theophylline: "after a single dose ... of 5 mg/kg in adults, a mean peak serum concentration
	// of about 10 mcg/mL (range 5 mcg/mL to 15 mcg/mL)"
	const b = bodyOf(theophylline);
	const peak = oralLevel(b, 5 * 70, oralPeakTime(b));
	expect(peak).toBeGreaterThan(8);
	expect(peak).toBeLessThan(12);
});

test('a slower absorption lowers and delays the peak but not the total exposure', () => {
	const fast = bodyOf(theophylline, { ka: 2 });
	const slow = bodyOf(theophylline, { ka: 0.3 });
	const a = simulate(fast, [{ t: 0, form: 'tablet', amount: 300 }], 200, 4000);
	const b = simulate(slow, [{ t: 0, form: 'tablet', amount: 300 }], 200, 4000);
	expect(range(b, 0, 200).max).toBeLessThan(0.75 * range(a, 0, 200).max);
	const auc = (s: typeof a) => s.c.reduce((x, y) => x + y, 0) * s.dt;
	// area under the curve = F · dose / CL either way
	expect(auc(a)).toBeCloseTo(300 / fast.CL, 0);
	expect(auc(b)).toBeCloseTo(300 / slow.CL, 0);
});

test('repeated injections reach 50, 75, 87.5, 94 and 97% of the steady state after 1–5 half-lives', () => {
	const b = bodyOf(theophylline);
	const t12 = halfLifeAt(b);
	// a drip: the cleanest case; its plateau is rate / CL
	const s = simulate(b, [{ t: 0, form: 'drip', amount: 28, duration: 200 }], 100, 4000);
	const plateau = steadyAverage(b, 28, 1, 'drip');
	for (const n of [1, 2, 3, 4, 5]) {
		expect(levelAt(s, n * t12) / plateau).toBeCloseTo(shareAfter(n), 3);
	}
	expect(shareAfter(4)).toBeCloseTo(0.94, 2);
	expect(shareAfter(5)).toBeCloseTo(0.97, 2);
});

test('the aminophylline label: 0.4 mg/kg/h of theophylline settles near 10 mcg/mL', () => {
	const b = bodyOf(theophylline);
	const plateau = steadyAverage(b, 0.4 * 70, 1, 'drip');
	expect(plateau).toBeGreaterThan(9);
	expect(plateau).toBeLessThan(11.5);
	const s = simulate(b, [{ t: 0, form: 'drip', amount: 0.4 * 70, duration: 200 }], 150, 3000);
	expect(levelAt(s, 150)).toBeCloseTo(plateau, 2);
});

test('doubling the dose doubles the plateau but reaches it no sooner', () => {
	const b = bodyOf(digoxin);
	const tEnd = 20 * 24;
	const one = repeated({ amount: 250, interval: 24, form: 'tablet', until: tEnd });
	const two = repeated({ amount: 500, interval: 24, form: 'tablet', until: tEnd });
	const s1 = simulate(b, one, tEnd, 4000);
	const s2 = simulate(b, two, tEnd, 4000);
	const late1 = levelAt(s1, tEnd - 1e-3);
	const late2 = levelAt(s2, tEnd - 1e-3);
	expect(late2 / late1).toBeCloseTo(2, 3);
	const t1 = timeToShare(s1, one, late1, 0.9);
	const t2 = timeToShare(s2, two, late2, 0.9);
	expect(t1).toBe(t2);
	// the average plateau of 250 mcg a day sits inside the label's 0.5–2 ng/mL
	const avg = steadyAverage(b, 250, 24, 'tablet');
	expect(avg).toBeGreaterThan(0.5);
	expect(avg).toBeLessThan(2);
});

test('digoxin takes the days to steady state of the Lanoxin label', () => {
	// the label's table: 7 days at normal kidney function, 19 days at a creatinine clearance of 10
	// mL/min; half-life 1.5–2 days normally, 3.5–5 days without kidneys. Four to five half-lives:
	const t12 = halfLife(digoxin) / 24;
	expect(t12).toBeGreaterThanOrEqual(1.5);
	expect(t12).toBeLessThanOrEqual(2);
	expect(4 * t12).toBeLessThanOrEqual(7.5);
	expect(5 * t12).toBeGreaterThanOrEqual(7);
	// a kidney failure that lengthens the half-life to 4.25 days: 4.5 half-lives ≈ 19 days
	const anuric = bodyOf(digoxin, { clearance: 1.75 / 4.25 });
	expect(halfLifeAt(anuric) / 24).toBeCloseTo(4.25, 6);
	expect((4.5 * halfLifeAt(anuric)) / 24).toBeCloseTo(19, 0);
});

test('a loading dose of digoxin reaches the plateau at once', () => {
	const b = bodyOf(digoxin);
	const tEnd = 14 * 24;
	const plain = repeated({ amount: 250, interval: 24, form: 'tablet', until: tEnd });
	const loaded = [{ t: 0, form: 'tablet' as const, amount: 750 }, ...plain.slice(1)];
	const sp = simulate(b, plain, tEnd, 3000);
	const sl = simulate(b, loaded, tEnd, 3000);
	const plateau = levelAt(sp, tEnd - 1e-3);
	// one day in: without loading about a third of the way, with it already near the plateau
	expect(levelAt(sp, 24 - 1e-3) / plateau).toBeLessThan(0.4);
	expect(levelAt(sl, 24 - 1e-3) / plateau).toBeGreaterThan(0.85);
	expect(levelAt(sl, 24 - 1e-3) / plateau).toBeLessThan(1.25);
	// and both end at the same level
	expect(levelAt(sl, tEnd - 1e-3) / plateau).toBeCloseTo(1, 2);
});

test('theophylline every 6 hours: the trough is about 60% of the peak (label)', () => {
	// "on a dosage regimen with 6-hour intervals, the expected mean trough concentration is
	// approximately 60% of the mean peak concentration, assuming a mean theophylline half-life of
	// 8 hours"
	const b = { ...bodyOf(theophylline), CL: (Math.LN2 * theophylline.V) / 8 };
	const doses = repeated({ amount: 200, interval: 6, form: 'injection', until: 96 });
	const s = simulate(b, doses, 96, 4000);
	const late = range(s, 72, 96);
	expect(late.min / late.max).toBeCloseTo(0.6, 1);
});

test('lithium: 600 mg twice a day sits in the acute range; halving the clearance doubles it', () => {
	expect(LITHIUM_MEQ_PER_300MG).toBeCloseTo(8.12, 2);
	const t12 = halfLife(lithium);
	expect(t12).toBeGreaterThanOrEqual(18);
	expect(t12).toBeLessThanOrEqual(36);
	const normal = steadyAverage(bodyOf(lithium), lithium.dose, 12, 'tablet');
	expect(normal).toBeGreaterThan(0.8);
	expect(normal).toBeLessThan(1.2);
	const kidney = bodyOf(lithium, { clearance: 0.5 });
	const failing = steadyAverage(kidney, lithium.dose, 12, 'tablet');
	expect(failing / normal).toBeCloseTo(2, 6);
	expect(failing).toBeGreaterThan(lithium.toxic ?? Infinity);
	// and it takes twice as long to get there
	expect(halfLifeAt(kidney)).toBeCloseTo(2 * t12, 6);
});

test('vancomycin: the label’s clearance and volume give its 4–6 hour half-life', () => {
	const t12 = halfLife(vancomycin);
	expect(t12).toBeGreaterThanOrEqual(4);
	expect(t12).toBeLessThanOrEqual(6);
	// 1 g over 60 minutes every 12 h: the label measured about 8 mcg/mL 11 hours after the end
	// of the infusion (the later, single-exponential part of the curve)
	const doses = repeated({ amount: 1000, interval: 12, form: 'injection', until: 96, duration: 1 });
	const s = simulate(bodyOf(vancomycin), doses, 96, 4000);
	const trough = levelAt(s, 84 - 1e-3);
	expect(trough).toBeGreaterThan(5);
	expect(trough).toBeLessThan(11);
});

test('phenytoin: a saturable elimination breaks both rules', () => {
	const b = bodyOf(phenytoin);
	const lin = bodyOf(phenytoin, { saturable: false });
	const css = (body: typeof b, daily: number) => steadyAverage(body, daily, 24, 'tablet');
	// 300 → 400 mg a day: a third more drug, more than twice the level (and inside the label's
	// 10–20 mcg/mL at 400), while a linear drug would rise by a third
	expect(css(b, 400) / css(b, 300)).toBeGreaterThan(2);
	expect(css(b, 400)).toBeGreaterThan(10);
	expect(css(b, 400)).toBeLessThan(20);
	expect(css(lin, 400) / css(lin, 300)).toBeCloseTo(4 / 3, 6);
	// 500 mg a day: far above the range; an intake at or above Vmax never settles
	expect(css(b, 500)).toBeGreaterThan(40);
	expect(css(b, (phenytoin.saturable!.Vmax * 24) / phenytoin.F)).toBe(Infinity);
	// the half-life grows with the level: in the label's 7–42 h around the range
	expect(halfLifeAt(b, 10)).toBeGreaterThan(7);
	expect(halfLifeAt(b, 20)).toBeLessThan(42);
	expect(halfLifeAt(b, 20)).toBeGreaterThan(halfLifeAt(b, 5));
	// the integrator settles on Km·R / (Vmax − R)
	const tEnd = 60 * 24;
	const doses = repeated({ amount: 400, interval: 24, form: 'tablet', until: tEnd });
	const s = simulate(b, doses, tEnd, 6000);
	const day = range(s, tEnd - 24, tEnd);
	expect(day.min).toBeLessThan(css(b, 400));
	expect(day.max).toBeGreaterThan(css(b, 400));
	// and the higher dose takes longer to settle, unlike a linear drug
	const doses5 = repeated({ amount: 500, interval: 24, form: 'tablet', until: tEnd });
	const s5 = simulate(b, doses5, tEnd, 6000);
	const t4 = timeToShare(s, doses, day.min, 0.9);
	const t5 = timeToShare(s5, doses5, range(s5, tEnd - 24, tEnd).min, 0.9);
	expect(t5).toBeGreaterThan(1.5 * t4);
});
