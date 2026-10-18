// Checks the lac-operon model against what was measured: Ozbudak et al. (2004) saw cells switch
// on above about 30 µM TMG and off below about 3 µM, with a hundredfold gap between the two
// states, and the range moving to higher TMG when glucose is added; they never saw hysteresis
// with lactose. In glucose–lactose medium, a lac promoter that ignores CRP-cAMP still gives the
// diauxic pause (Kimata et al. 1997), while removing the repressor abolishes the glucose effect
// (Inada et al. 1996). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	MEASURED,
	culture,
	cultureSteady,
	pause,
	steadyStates,
	sweep,
	thresholds,
	type Strain
} from '../src/routes/lac-operon/model';

test("without glucose the switch has two states between about 3 and 30 µM TMG, as Ozbudak's cells did", () => {
	const th = thresholds(0);
	expect(th).not.toBeNull();
	if (!th) return;
	expect(th.off).toBeGreaterThan(MEASURED.off / 1.5);
	expect(th.off).toBeLessThan(MEASURED.off * 1.5);
	expect(th.on).toBeGreaterThan(MEASURED.on / 1.5);
	expect(th.on).toBeLessThan(MEASURED.on * 1.5);
	// Inside the range: two stable states and an unstable one between them; outside: one.
	const mid = steadyStates({ inducer: 'tmg', c: 10, glucose: 0 });
	expect(mid.map((s) => s.stable)).toEqual([true, false, true]);
	expect(steadyStates({ inducer: 'tmg', c: 1, glucose: 0 })).toHaveLength(1);
	expect(steadyStates({ inducer: 'tmg', c: 100, glucose: 0 })).toHaveLength(1);
	// Induced cells shine over a hundred times brighter than uninduced ones.
	expect(mid[2].y / mid[0].y).toBeGreaterThan(100);
});

test('the same TMG level leaves a cell off or on depending on where it came from', () => {
	const trace = sweep({ inducer: 'tmg', glucose: 0, from: 1, to: 100, hours: 200 });
	const at = (up: boolean) =>
		trace
			.filter((p) => p.up === up)
			.reduce((a, b) => (Math.abs(b.c - 10) < Math.abs(a.c - 10) ? b : a));
	expect(at(true).y).toBeLessThan(5);
	expect(at(false).y).toBeGreaterThan(50);
	// It ends where it started: off again.
	expect(trace.at(-1)!.y).toBeLessThan(5);
});

test('glucose moves the bistable range to higher TMG', () => {
	let prev = thresholds(0)!;
	for (const G of [5, 20, 100, 1000]) {
		const th = thresholds(G)!;
		expect(th.off).toBeGreaterThan(prev.off);
		expect(th.on).toBeGreaterThan(prev.on);
		prev = th;
	}
});

test('with lactose instead of TMG there is no hysteresis, at any glucose level', () => {
	for (const G of [0, 1, 10, 100, 1000]) expect(thresholds(G, 'lactose')).toBeNull();
	// But lactose still switches the operon on, gradually.
	const lo = steadyStates({ inducer: 'lactose', c: 10, glucose: 0 })[0].y;
	const hi = steadyStates({ inducer: 'lactose', c: 2000, glucose: 0 })[0].y;
	expect(lo).toBeLessThan(2);
	expect(hi).toBeGreaterThan(80);
});

test('the operon is on only with lactose and without glucose', () => {
	const mM = 1000;
	expect(cultureSteady(0, 2 * mM)).toBeGreaterThan(80);
	expect(cultureSteady(0, 0)).toBeLessThan(2);
	expect(cultureSteady(2 * mM, 0)).toBeLessThan(2);
	expect(cultureSteady(2 * mM, 2 * mM)).toBeLessThan(2);
	// Without the repressor, glucose barely lowers it (Inada et al. 1996).
	expect(cultureSteady(2 * mM, 2 * mM, 'lacI')).toBeGreaterThan(50);
});

const grow = (strain: Strain) => culture({ glucose: 1, lactose: 2, hours: 10, strain });
const whenGlucoseRunsOut = (trace: ReturnType<typeof grow>) =>
	trace.find((p) => p.glucose < 0.001)!;

test('on glucose and lactose a culture eats the glucose first, pauses, then grows on lactose', () => {
	const trace = grow('wild');
	expect(whenGlucoseRunsOut(trace).lactose).toBeGreaterThan(1.95);
	const p = pause(trace);
	expect(p).toBeGreaterThan(0.3);
	expect(p).toBeLessThan(2);
	// Both sugars are used up in the end: about 0.22 OD per mM of glucose, 0.43 per mM lactose.
	expect(trace.at(-1)!.lactose).toBeLessThan(0.01);
	expect(trace.at(-1)!.od).toBeCloseTo(0.02 + 0.22 + 2 * 0.43, 1);
});

test('a promoter that ignores CRP-cAMP still pauses; without the repressor or the permease block it does not', () => {
	// Kimata et al. 1997: lacUV5 cells still show diauxie.
	expect(pause(grow('uv5'))).toBeGreaterThan(0.3);
	// Inada et al. 1996: no repressor, no glucose effect.
	expect(pause(grow('lacI'))).toBe(0);
	// If glucose could not block the permease, both sugars would be eaten together.
	const free = grow('noexcl');
	expect(pause(free)).toBe(0);
	expect(whenGlucoseRunsOut(free).lactose).toBeLessThan(1.9);
});
