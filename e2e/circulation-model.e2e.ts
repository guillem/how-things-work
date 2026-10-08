// Checks the circulation model behind the heart-circulation explainer against
// textbook resting values and the numbers quoted in the narrative. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BLOOD,
	LA,
	LV,
	NORMAL,
	SA,
	bodyResistance,
	ecgWaves,
	simulate,
	steadyBeat,
	summarize,
	timing,
	valveEvents,
	venousSaturation
} from '../src/routes/heart-circulation/circulation';

const at = (s: Partial<typeof NORMAL>) => steadyBeat({ ...NORMAL, ...s });

test('resting heart at 75 beats a minute: textbook pressures and volumes', () => {
	const { summary: m, beat } = at({});
	expect(beat.beats).toBeLessThan(120); // reached a steady rhythm
	// Blood pressure about 120/80 mmHg.
	expect(m.aorta.sys).toBeGreaterThan(115);
	expect(m.aorta.sys).toBeLessThan(130);
	expect(m.aorta.dia).toBeGreaterThan(70);
	expect(m.aorta.dia).toBeLessThan(85);
	// Lung artery about 25/10: roughly a fifth of the body's pressure.
	expect(m.lungArtery.sys).toBeGreaterThan(18);
	expect(m.lungArtery.sys).toBeLessThan(30);
	expect(m.lungArtery.dia).toBeGreaterThan(7);
	expect(m.lungArtery.dia).toBeLessThan(14);
	expect(m.lungArtery.sys / m.aorta.sys).toBeGreaterThan(0.15);
	expect(m.lungArtery.sys / m.aorta.sys).toBeLessThan(0.25);
	// Left ventricle fills to ~120–130 mL, squeezes out ~75 mL (about 60%).
	expect(m.edv).toBeGreaterThan(115);
	expect(m.edv).toBeLessThan(135);
	expect(m.stroke).toBeGreaterThan(70);
	expect(m.stroke).toBeLessThan(80);
	expect(m.ef).toBeGreaterThan(0.55);
	expect(m.ef).toBeLessThan(0.65);
	// About 5½ litres a minute.
	expect(m.output).toBeGreaterThan(5.2);
	expect(m.output).toBeLessThan(6);
	// Atria: a few mmHg.
	expect(m.laMean).toBeGreaterThan(5);
	expect(m.laMean).toBeLessThan(12);
	expect(m.raMean).toBeGreaterThan(2);
	expect(m.raMean).toBeLessThan(8);
	// Blood comes back about three-quarters saturated with oxygen.
	expect(m.venousO2).toBeGreaterThan(0.72);
	expect(m.venousO2).toBeLessThan(0.78);
});

test('two pumps in series: each side sends out the same volume per beat', () => {
	for (const s of [{}, { hr: 40 }, { hr: 150 }, { width: 0.8 }, { leak: 0.4 }]) {
		const { summary: m } = at(s);
		expect(Math.abs(m.stroke - m.strokeRight)).toBeLessThan(0.2);
	}
});

test('blood is neither made nor lost, and healthy valves never let it back', () => {
	const beat = simulate(NORMAL);
	const total = (i: number) => beat.v.reduce((s, v) => s + v[i], 0);
	for (const i of [0, 100, 200, beat.t.length - 1]) expect(total(i)).toBeCloseTo(BLOOD, 6);
	for (const k of ['tricuspid', 'pulmonary', 'mitral', 'aortic'] as const)
		expect(Math.min(...beat.flow[k])).toBeGreaterThanOrEqual(0);
	// A valve opens only when the pressure behind it is higher.
	const { open, close } = valveEvents(beat, 'aortic');
	expect(open).toHaveLength(1);
	expect(close).toHaveLength(1);
	const i = Math.round(open[0] / 0.002);
	expect(beat.p[LV][i]).toBeGreaterThan(beat.p[SA][i]);
	const j = Math.round(close[0] / 0.002) + 3;
	expect(beat.p[LV][j]).toBeLessThan(beat.p[SA][j]);
	// While the ventricle squeezes, the mitral valve is shut: LV pressure above LA.
	const k = Math.round((open[0] + close[0]) / 2 / 0.002);
	expect(beat.p[LV][k]).toBeGreaterThan(beat.p[LA][k]);
	expect(beat.flow.mitral[k]).toBe(0);
});

test('one electrical clock: P, then QRS, then the ventricles push, then T', () => {
	const T = timing(75);
	expect(T.rr).toBeCloseTo(0.8, 10);
	expect(T.pr).toBeGreaterThan(0.12); // normal PR 0.12–0.20 s
	expect(T.pr).toBeLessThan(0.2);
	expect(T.qt).toBeCloseTo(0.4 * Math.sqrt(0.8), 10); // Bazett
	const beat = simulate(NORMAL);
	const waves = ecgWaves(T);
	// The tallest ECG spike is the R wave.
	let iMax = 0;
	for (let i = 0; i < beat.ecg.length; i++) if (beat.ecg[i] > beat.ecg[iMax]) iMax = i;
	expect(beat.t[iMax]).toBeCloseTo(waves.r, 2);
	// The aortic valve opens a little after the R wave, and shuts near the end of T.
	const { open, close } = valveEvents(beat, 'aortic');
	expect(open[0] - waves.r).toBeGreaterThan(0.03);
	expect(open[0] - waves.r).toBeLessThan(0.12);
	expect(close[0]).toBeGreaterThan(waves.t - 0.05);
	expect(close[0]).toBeLessThan(T.pr + T.qt + 0.05);
	// The atria squeeze before the ventricles.
	const atria = beat.atria.findIndex((a) => a > 0.5);
	const ventricles = beat.ventricles.findIndex((a) => a > 0.5);
	expect(atria).toBeLessThan(ventricles);
});

test('heart rate: twice as fast does not pump twice as much', () => {
	const slow = at({ hr: 40 }).summary;
	const rest = at({}).summary;
	const fast = at({ hr: 150 }).summary;
	// Output = rate × stroke volume.
	expect(rest.output).toBeCloseTo((75 * rest.stroke) / 1000, 10);
	expect(fast.stroke).toBeLessThan(0.7 * rest.stroke); // less time to fill
	expect(fast.stroke).toBeGreaterThan(40);
	expect(fast.stroke).toBeLessThan(52);
	expect(fast.output / rest.output).toBeGreaterThan(1.15);
	expect(fast.output / rest.output).toBeLessThan(1.4);
	expect(slow.stroke).toBeGreaterThan(rest.stroke);
	expect(slow.output).toBeLessThan(rest.output);
	// Less flow → the body takes more oxygen from each litre.
	expect(slow.venousO2).toBeLessThan(rest.venousO2);
});

test('narrowed arteries: resistance ∝ 1/r⁴, the pressure rises, the heart empties less', () => {
	expect(bodyResistance(0.5) / bodyResistance(1)).toBeCloseTo(16, 10);
	expect(bodyResistance(0.9) / bodyResistance(1)).toBeCloseTo(1.524, 3); // "up by half"
	expect(bodyResistance(0.8) / bodyResistance(1)).toBeCloseTo(2.441, 3);
	const rest = at({}).summary;
	const narrow = at({ width: 0.9 }).summary;
	expect(rest.aorta.mean).toBeGreaterThan(95);
	expect(rest.aorta.mean).toBeLessThan(105); // "about 100"
	expect(narrow.aorta.mean).toBeGreaterThan(128);
	expect(narrow.aorta.mean).toBeLessThan(142); // "about 135"
	expect(narrow.esv).toBeGreaterThan(rest.esv + 8);
	expect(narrow.stroke).toBeLessThan(rest.stroke);
	expect(at({ width: 0.8 }).summary.output).toBeLessThan(0.85 * rest.output);
});

test('a leaking mitral valve: blood goes back to the lungs side, less goes forward', () => {
	const rest = at({}).summary;
	const mr = at({ valve: 'mitral', leak: 0.4 }).summary;
	expect(rest.backflow).toBe(0);
	expect(mr.backflow).toBeGreaterThan(40);
	expect(mr.backflow).toBeLessThan(60); // "about 50 mL"
	expect(mr.ejected).toBeCloseTo(mr.stroke + mr.backflow, 0);
	expect(mr.stroke).toBeLessThan(rest.stroke);
	expect(mr.edv).toBeGreaterThan(rest.edv + 15); // the ventricle swells
	expect(mr.laMean).toBeGreaterThan(rest.laMean + 1.5); // pressure backs up
	// Bigger hole, more backflow.
	expect(at({ valve: 'mitral', leak: 0.2 }).summary.backflow).toBeLessThan(mr.backflow);
});

test('a leaking aortic valve: the pressure between beats collapses', () => {
	const rest = at({}).summary;
	const ar = at({ valve: 'aortic', leak: 0.4 }).summary;
	expect(ar.backflow).toBeGreaterThan(60);
	expect(ar.aorta.dia).toBeGreaterThan(28);
	expect(ar.aorta.dia).toBeLessThan(42); // "about 35"
	expect(ar.aorta.sys).toBeGreaterThan(rest.aorta.sys); // wide pulse pressure
	expect(ar.edv).toBeGreaterThan(rest.edv + 50);
	expect(ar.stroke).toBeLessThan(rest.stroke);
});

test("Fick's principle: lower output, more oxygen taken from each litre", () => {
	expect(venousSaturation(5)).toBeCloseTo(0.98 - 250 / (5 * 201), 10);
	expect(venousSaturation(2.5)).toBeLessThan(venousSaturation(5));
	const m = summarize(simulate(NORMAL));
	expect(m.venousO2).toBeCloseTo(venousSaturation(m.output), 10);
});
