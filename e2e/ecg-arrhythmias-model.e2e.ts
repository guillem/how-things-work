// Checks the heart sheet against what a real ECG shows: Einthoven's law (II = I + III); a normal
// beat with its PR interval and QRS width inside the clinical normal ranges and its QRS and T
// wave both upright in lead II (inverted T when every cell recovers alike); the degrees of AV
// block; an early beat that a healthy sheet answers with one wide beat but a slowed, scarred
// sheet with a sustained fast rhythm, which a shock ends so that the sinus node takes over; and
// a flat line that a shock does not restart. Runs the page's own scenarios, in Node.
import { expect, test } from '@playwright/test';
import { ECG_EVERY_MS, Heart, leadOf } from '../src/routes/ecg-arrhythmias/model';
import {
	AUTO_SHOCK_MS,
	FLAT_SHOCK_MS,
	Run,
	atrialRate,
	intervals,
	setup,
	ventricularRate
} from '../src/routes/ecg-arrhythmias/scenarios';

test.describe.configure({ mode: 'parallel' });

/** A step's run, advanced to `ms`. */
function run(step: string, ms: number, params: Record<string, number | boolean> = {}) {
	const r = new Run(setup(step, params));
	r.advanceTo(ms);
	return r;
}

/** Lead II between two times (ms). */
function window(h: Heart, from: number, to: number) {
	const out: number[] = [];
	for (let k = Math.ceil(from / ECG_EVERY_MS); k < to / ECG_EVERY_MS && k < h.samples; k++)
		out.push(h.lead('II', k));
	return out;
}
/** The last beat whose QRS and T wave are complete. */
const lastBeat = (h: Heart) => h.beats.filter((b) => b.onset + 500 < h.time).at(-1)!;
/** A rate within 2 beats a minute. */
const near = (rate: number, expected: number) => expect(Math.abs(rate - expected)).toBeLessThan(2);
const peak = (xs: number[]) => xs.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);

test('Einthoven’s law: lead II equals lead I plus lead III at every instant', () => {
	const h = run('wave', 1800).heart;
	let checked = 0;
	for (let k = 0; k < h.samples; k++) {
		const i = h.lead('I', k);
		const ii = h.lead('II', k);
		const iii = h.lead('III', k);
		expect(Math.abs(ii - (i + iii))).toBeLessThan(1e-6 + 1e-4 * Math.abs(ii));
		checked++;
	}
	expect(checked).toBeGreaterThan(500);
	// a dipole along lead II's axis (+60°) reads in full in II and half as much in I and in III
	expect(leadOf('II', 0.5, Math.sqrt(3) / 2)).toBeCloseTo(2 * leadOf('I', 0.5, Math.sqrt(3) / 2));
});

test('a normal beat: one QRS per P, PR and QRS within the normal ranges, QRS and T upright in II', () => {
	const h = run('wave', 2700).heart;
	near(atrialRate(h), 75);
	near(ventricularRate(h), 75);
	const iv = intervals(h)!;
	// clinical normal ranges: PR 120–200 ms, QRS under 120 ms
	expect(iv.pr).toBeGreaterThanOrEqual(120);
	expect(iv.pr).toBeLessThanOrEqual(200);
	expect(iv.qrs).toBeLessThan(120);
	const b = lastBeat(h);
	const p = peak(window(h, b.onset - iv.pr!, b.onset - 40));
	const qrs = peak(window(h, b.onset, b.onset + 80));
	const t = peak(window(h, b.onset + 120, b.onset + 480));
	expect(p).toBeGreaterThan(0.03);
	expect(p).toBeLessThan(0.3 * qrs);
	expect(qrs).toBeGreaterThan(0.5);
	expect(t).toBeGreaterThan(0.1);
	expect(t).toBeLessThan(qrs);
	// a normal axis: QRS positive in lead I as well
	expect(
		peak(Array.from({ length: 40 }, (_, k) => h.lead('I', Math.round(b.onset / ECG_EVERY_MS) + k)))
	).toBeGreaterThan(0.2);
});

test('when every cell recovers alike, the T wave turns upside down', () => {
	const h = run('leads', 2700, { gradient: false }).heart;
	const b = lastBeat(h);
	expect(peak(window(h, b.onset, b.onset + 80))).toBeGreaterThan(0.5);
	expect(peak(window(h, b.onset + 120, b.onset + 480))).toBeLessThan(-0.1);
});

test('the sinus rate sets the ventricles’ rate', () => {
	for (const rate of [50, 120]) {
		const h = run('wave', 4000, { rate }).heart;
		near(ventricularRate(h), rate);
	}
});

test('AV block: first degree lengthens PR, second drops beats, third leaves an escape rhythm', () => {
	const first = run('block', 4000, { av: 0.6 }).heart;
	expect(intervals(first)!.pr).toBeGreaterThan(200);
	near(ventricularRate(first), 75);

	const second = run('block', 5000, { av: 0.3 }).heart;
	near(atrialRate(second), 75);
	expect(ventricularRate(second)).toBeLessThan(45);
	expect(ventricularRate(second)).toBeGreaterThan(30);

	const third = run('block', 6000, { av: 0.1 }).heart;
	near(atrialRate(third), 75);
	// the junctional escape pacemaker, 1.5 s apart: 40 a minute, with a narrow QRS
	expect(third.escapes.length).toBeGreaterThanOrEqual(3);
	near(ventricularRate(third), 40);
	expect(intervals(third)!.qrs).toBeLessThan(120);
});

test('a healthy sheet answers an early beat with one wide beat, then the sinus rhythm', () => {
	const h = run('early', 3200, { coupling: 450 }).heart;
	expect(h.ectopics.length).toBeGreaterThanOrEqual(1);
	const wide = h.beats.find((b) => Math.abs(b.onset - h.ectopics[0]) < 20)!;
	expect(wide.end - wide.onset).toBeGreaterThan(120);
	// a beat later the sinus rhythm is back to normal, through the Purkinje fibres: narrow
	const next = h.beats.find((b) => b.onset > wide.onset + 1000)!;
	expect(next.end - next.onset).toBeLessThan(120);
	expect(h.sinus.some((s) => next.onset - s > 100 && next.onset - s < 250)).toBe(true);
	// too early: the tissue is still refractory and the beat goes nowhere
	const early = run('early', 3000, { coupling: 200 }).heart;
	const spot = early.beats.find((b) => Math.abs(b.onset - early.ectopics[0]) < 20);
	expect(spot ? spot.end - spot.onset : 0).toBeLessThan(20);
});

test('a slowed, scarred sheet turns the same early beat into a sustained fast rhythm', () => {
	const r = run('reentry', 8000, { coupling: 400 });
	near(atrialRate(r.heart), 75);
	expect(ventricularRate(r.heart)).toBeGreaterThan(150);
	// the healthy sheet, same beat: no loop fits
	const healthy = run('reentry', 6000, { coupling: 400, slow: false, scar: false });
	near(ventricularRate(healthy.heart), 75);
});

test('a shock ends the fast rhythm and the sinus node takes over again', () => {
	const r = run('shock', AUTO_SHOCK_MS - 10);
	expect(ventricularRate(r.heart)).toBeGreaterThan(150);
	r.advanceTo(AUTO_SHOCK_MS + 3500);
	expect(r.heart.shocks.length).toBe(1);
	near(ventricularRate(r.heart), 75);
});

test('a shock does not restart a heart with no rhythm: the line stays flat', () => {
	const h = run('flatline', FLAT_SHOCK_MS + 2000).heart;
	expect(h.shocks.length).toBe(1);
	expect(h.beats.filter((b) => b.onset > FLAT_SHOCK_MS + 50).length).toBe(0);
	// every cell fires and recovers at once: nothing but a brief blip as they recover
	const after = window(h, FLAT_SHOCK_MS + 600, FLAT_SHOCK_MS + 2000);
	expect(Math.max(...after.map(Math.abs))).toBeLessThan(0.05);
});
