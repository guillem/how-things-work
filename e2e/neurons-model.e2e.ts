// Checks the neuron models against the published results they come from
// (definition of done #5 in docs/TOPICS.md): Hodgkin & Huxley (1952),
// Hodgkin & Katz (1949) and Hursh (1939). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	REST,
	SQUID_AXON,
	at,
	cable,
	firingRate,
	peak,
	pulse,
	simulate,
	spikeTimes,
	squidCable,
	threshold,
	velocity
} from '../src/routes/neurons/hh';
import {
	P_PEAK,
	P_REST,
	ghk,
	ghkCurrent,
	ionsToCharge,
	nernstOf,
	SQUID
} from '../src/routes/neurons/ions';
import { circuit, fires, receive } from '../src/routes/neurons/inputs';
import {
	myelinatedSpeed,
	unmyelinatedDiameterFor,
	unmyelinatedSpeed
} from '../src/routes/neurons/fibres';

const lowest = (s: { V: number }[]) => Math.min(...s.map((p) => p.V));

test('left alone, the membrane rests at its resting potential', () => {
	const s = simulate({ tEnd: 100 });
	expect(Math.abs(s[s.length - 1].V - REST)).toBeLessThan(0.05);
});

test('a strong enough kick fires a spike that overshoots zero, then undershoots the rest', () => {
	const th = threshold(0.5);
	const s = simulate({ tEnd: 25, current: pulse(2 * th, 1, 0.5) });
	const p = peak(s);
	// HH's membrane action potential: about 100 mV from rest, peaking near +40 to +50 mV …
	expect(p.V - REST).toBeGreaterThan(95);
	expect(p.V - REST).toBeLessThan(115);
	// … and a dip below rest, towards the potassium reversal potential (rest − 12 mV).
	expect(lowest(s)).toBeLessThan(REST - 8);
	expect(lowest(s)).toBeGreaterThan(REST - 12);
});

test('the spike is all-or-nothing: none below threshold, the same size well above it', () => {
	const th = threshold(0.5);
	const below = simulate({ tEnd: 25, current: pulse(0.9 * th, 1, 0.5) });
	expect(spikeTimes(below)).toHaveLength(0);
	expect(peak(below).V - REST).toBeLessThan(10);
	const twice = peak(simulate({ tEnd: 25, current: pulse(2 * th, 1, 0.5) })).V;
	const fivefold = peak(simulate({ tEnd: 25, current: pulse(5 * th, 1, 0.5) })).V;
	expect(Math.abs(fivefold - twice)).toBeLessThan(3);
});

test('short pulses need a fixed charge, long ones a minimum current (strength–duration)', () => {
	const t05 = threshold(0.5);
	const t1 = threshold(1);
	const t5 = threshold(5);
	expect(t05).toBeGreaterThan(t1);
	expect(t1).toBeGreaterThan(t5);
	// Charge for 0.5 and 1 ms pulses within 10% of each other (≈ 7 nC/cm²).
	expect(Math.abs(t05 * 0.5 - t1) / t1).toBeLessThan(0.1);
});

test('blocking the sodium channels (TTX) abolishes the spike; blocking potassium (TEA) prolongs it', () => {
	const th = threshold(0.5);
	const ttx = simulate({ tEnd: 25, current: pulse(5 * th, 1, 0.5), block: { na: 0 } });
	expect(spikeTimes(ttx)).toHaveLength(0);
	// A blocked membrane still rests at the resting potential until the pulse comes.
	expect(Math.abs(at(ttx, 0.95).V - REST)).toBeLessThan(0.5);
	const width = (s: ReturnType<typeof simulate>) => s.filter((p) => p.V > -20).length;
	const normal = simulate({ tEnd: 40, current: pulse(2 * th, 1, 0.5) });
	// The scene's TEA blocks 90% of the potassium channels, as the real drug does at high dose.
	const tea = simulate({ tEnd: 40, current: pulse(2 * th, 1, 0.5), block: { k: 0.1 } });
	expect(Math.abs(at(tea, 0.95).V - REST)).toBeLessThan(0.5);
	expect(spikeTimes(tea)).toHaveLength(1);
	// "it lasts about twice as long", then the cell returns to rest.
	expect(width(tea)).toBeGreaterThan(1.8 * width(normal));
	expect(width(tea)).toBeLessThan(2.5 * width(normal));
	expect(Math.abs(at(tea, 40).V - REST)).toBeLessThan(0.5);
	// Even with no potassium block at all the cell does not fire on its own.
	expect(spikeTimes(simulate({ tEnd: 40, block: { k: 0 } }))).toHaveLength(0);
});

test('just after a spike the membrane is refractory', () => {
	const th = threshold(0.5);
	const pair = (gap: number) =>
		spikeTimes(
			simulate({
				tEnd: 50,
				current: (t) => pulse(2 * th, 1, 0.5)(t) + pulse(2 * th, 1 + gap, 0.5)(t)
			})
		).length;
	expect(pair(5)).toBe(1);
	expect(pair(25)).toBe(2);
});

test('a steady current is coded as a firing rate that rises with the current', () => {
	// HH's membrane fires repetitively only above ≈ 6.3 µA/cm², and starts at about 50 per second.
	expect(firingRate(5)).toBe(0);
	const onset = firingRate(7);
	expect(onset).toBeGreaterThan(40);
	expect(onset).toBeLessThan(70);
	expect(firingRate(30)).toBeGreaterThan(1.4 * onset);
	// "above about 75 µA/cm² here the model stops firing altogether".
	expect(firingRate(70)).toBeGreaterThan(100);
	expect(firingRate(80)).toBe(0);
});

test('the propagated spike travels along the squid axon at HH’s computed 18.8 m/s', () => {
	// The grid the page uses: 0.5 mm compartments.
	const v = velocity(cable(squidCable({ dx: 0.05, dt: 0.0025 })));
	expect(Math.abs(v - SQUID_AXON.computed)).toBeLessThan(0.8);
	// … within about 15% of the 21.2 m/s they measured on the same fibre.
	expect(Math.abs(v - SQUID_AXON.measured) / SQUID_AXON.measured).toBeLessThan(0.15);
	// Not an artefact of the grid: halving the compartments changes it by under 2%.
	const fine = velocity(cable(squidCable({ dx: 0.025, dt: 0.0006, length: 6, tEnd: 5 })));
	expect(Math.abs(fine - v) / fine).toBeLessThan(0.02);
});

test('a thinner unmyelinated axon is slower: speed goes as the square root of the radius', () => {
	const big = velocity(cable(squidCable()));
	const small = velocity(
		cable(squidCable({ radius: SQUID_AXON.radius / 4, length: 4, dx: 0.02, dt: 0.002, tEnd: 7 }))
	);
	expect(Math.abs(small / big - 0.5)).toBeLessThan(0.03);
});

test('a warmer axon conducts faster', () => {
	const cold = velocity(cable(squidCable({ T: 6.3, tEnd: 12, length: 6 })));
	const warm = velocity(cable(squidCable()));
	expect(warm).toBeGreaterThan(1.5 * cold);
});

test('Goldman–Hodgkin–Katz: −59 mV at rest, a 97 mV action potential (Hodgkin & Katz 1949)', () => {
	const rest = ghk(P_REST, SQUID, 19);
	const top = ghk(P_PEAK, SQUID, 19);
	expect(rest).toBeCloseTo(-59, 0);
	expect(top - rest).toBeGreaterThan(96);
	expect(top - rest).toBeLessThan(98.5);
	// Each permeability alone gives that ion's Nernst potential.
	expect(ghk({ K: 1, Na: 0, Cl: 0 }, SQUID, 19)).toBeCloseTo(nernstOf('K', SQUID, 19), 6);
	expect(ghk({ K: 0, Na: 1, Cl: 0 }, SQUID, 19)).toBeCloseTo(nernstOf('Na', SQUID, 19), 6);
});

test('Nernst: about 58 mV per tenfold concentration ratio at room temperature', () => {
	const ten = { ...SQUID, K: { inside: 100, outside: 10 } };
	expect(nernstOf('K', ten, 19)).toBeCloseTo(-58, 0);
	expect(nernstOf('K')).toBeLessThan(-85);
	expect(nernstOf('Na')).toBeGreaterThan(40);
});

test('charging the membrane by 100 mV moves only a few millionths of the potassium inside', () => {
	const moved = ionsToCharge(100); // mol per cm² of membrane
	expect(moved).toBeCloseTo(1.04e-12, 13);
	// Potassium under 1 cm² of membrane of the squid axon: volume r/2 per area.
	const inside = 345e-6 * (SQUID_AXON.radius / 2); // mol/cm³ × cm
	expect(inside / moved).toBeGreaterThan(3e6);
});

test('one excitatory input is not enough; three together fire the cell; spreading or inhibition stops them', () => {
	const one = receive({ exc: 1, inh: 0, spread: 0 });
	expect(fires(one)).toBe(false);
	expect(peak(one).V - REST).toBeLessThan(3);
	expect(fires(receive({ exc: 2, inh: 0, spread: 0 }))).toBe(false);
	expect(fires(receive({ exc: 3, inh: 0, spread: 0 }))).toBe(true);
	expect(fires(receive({ exc: 3, inh: 0, spread: 8 }))).toBe(false);
	expect(fires(receive({ exc: 3, inh: 2, spread: 0 }))).toBe(false);
	expect(fires(receive({ exc: 4, inh: 2, spread: 0 }))).toBe(false);
	expect(fires(receive({ exc: 5, inh: 2, spread: 0 }))).toBe(true);
	// The spike, when it comes, is a full one.
	expect(peak(receive({ exc: 8, inh: 0, spread: 0 })).V).toBeGreaterThan(30);
});

test('the circuit: which cell fires depends on the pattern of inputs and the strength of a connection', () => {
	const on = (s: string) => [...s].map((c) => c === '1');
	expect(fires(circuit('A', on('110'), 0))).toBe(true);
	expect(fires(circuit('B', on('110'), 0))).toBe(false);
	expect(fires(circuit('A', on('011'), 0))).toBe(false);
	expect(fires(circuit('B', on('011'), 0))).toBe(true);
	// Input 1 inhibits B.
	expect(fires(circuit('B', on('111'), 0))).toBe(false);
	// Strengthen 3 → A and the pattern 1 + 3 now fires A.
	expect(fires(circuit('A', on('101'), 0))).toBe(false);
	expect(fires(circuit('A', on('101'), 2))).toBe(true);
	// "even one synapse": A answers 1 + 3 (and 2 + 3), but not 3 alone …
	expect(fires(circuit('A', on('101'), 1))).toBe(true);
	expect(fires(circuit('A', on('011'), 1))).toBe(true);
	expect(fires(circuit('A', on('001'), 2))).toBe(false);
	// … "three or more and input 3 alone fires A".
	expect(fires(circuit('A', on('001'), 3))).toBe(true);
});

test('myelin: about 6 m/s per µm of diameter, many times an unmyelinated fibre (Hursh 1939)', () => {
	expect(myelinatedSpeed(10)).toBe(60);
	// Unmyelinated, scaled from the squid axon: about 1 m/s at 1 µm, like human C fibres.
	expect(unmyelinatedSpeed(1)).toBeGreaterThan(0.5);
	expect(unmyelinatedSpeed(1)).toBeLessThan(2);
	expect(myelinatedSpeed(10) / unmyelinatedSpeed(10)).toBeGreaterThan(15);
	// To match a 10 µm myelinated fibre without myelin, an axon would need to be millimetres thick.
	expect(unmyelinatedDiameterFor(60)).toBeGreaterThan(3000);
});

test('at the Goldman–Hodgkin–Katz voltage the currents of the three ions cancel', () => {
	for (const P of [P_REST, P_PEAK]) {
		const V = ghk(P);
		const total = (['K', 'Na', 'Cl'] as const).reduce((s, i) => s + ghkCurrent(i, P[i], V), 0);
		const k = Math.abs(ghkCurrent('K', P.K, V));
		expect(Math.abs(total) / k).toBeLessThan(1e-9);
	}
	// At rest potassium leaks out and sodium leaks in.
	expect(ghkCurrent('K', 1, ghk(P_REST))).toBeGreaterThan(0);
	expect(ghkCurrent('Na', 0.04, ghk(P_REST))).toBeLessThan(0);
});
