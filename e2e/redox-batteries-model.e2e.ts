// Checks the electrochemistry model against textbook laws, published cell figures and the
// numbers the narrative quotes (definition of done #5 in docs/TOPICS.md). Runs in Node.
import { expect, test } from '@playwright/test';
import {
	DANIELL_E0,
	FARADAY,
	M50,
	NERNST_SLOPE,
	THERMAL_V,
	cellVoltage,
	daniellAt,
	daniellVoltage,
	freeEnergy,
	lithiumGrams,
	lithiumMoles,
	log10K,
	meanVoltage,
	pairFigures,
	pairing,
	theoreticalCapacity,
	usableCapacity
} from '../src/routes/redox-batteries/model';
import { MATERIALS, material } from '../src/routes/redox-batteries/electrodes';

const nmc = material('nmc', 'cathode');
const lco = material('lco', 'cathode');
const lfp = material('lfp', 'cathode');
const graphite = material('graphite', 'anode');
const silicon = material('silicon', 'anode');
const li = material('limetal', 'anode');

test('the constants: F = 96 485 C/mol, RT/F = 25.7 mV, 59.2 mV per decade', () => {
	expect(FARADAY).toBeCloseTo(96485.332, 2);
	expect(THERMAL_V * 1000).toBeCloseTo(25.69, 2);
	expect(NERNST_SLOPE * 1000).toBeCloseTo(59.16, 2);
	// One mole of electrons is 26.8 Ah.
	expect(FARADAY / 3600).toBeCloseTo(26.8, 1);
});

test('the Daniell cell gives 1.10 V, whichever electrode is named first', () => {
	expect(DANIELL_E0).toBeCloseTo(1.1037, 4);
	const p = pairing('cu', 'zn');
	expect(p.anode.id).toBe('zn');
	expect(p.cathode.id).toBe('cu');
	expect(p.voltage).toBeCloseTo(1.1037, 4);
	expect(pairing('zn', 'cu').voltage).toBeCloseTo(1.1037, 4);
	// The same metal twice: no voltage at all.
	expect(pairing('cu', 'cu').voltage).toBe(0);
	// Lithium against copper: 3.38 V; magnesium against silver: 3.16 V.
	expect(pairing('li', 'cu').voltage).toBeCloseTo(3.382, 3);
	// ΔG° = −nFE°: about −213 kJ per mole of zinc.
	expect(freeEnergy(2, DANIELL_E0)).toBeCloseTo(-213, 0);
});

test('Nernst: a tenfold change of Q shifts a two-electron cell by 29.6 mV', () => {
	expect(daniellVoltage(1, 1)).toBeCloseTo(1.1037, 4);
	const step = daniellVoltage(1, 0.1) - daniellVoltage(1, 1);
	expect(step * 1000).toBeCloseTo(-29.58, 1);
	// Dilute copper, concentrated zinc: lower; the other way round: higher.
	expect(daniellVoltage(1, 0.001)).toBeCloseTo(1.015, 3);
	expect(daniellVoltage(0.001, 1)).toBeCloseTo(1.192, 3);
});

test('a running Daniell cell stays near 1.1 V, then dies at equilibrium (K ≈ 10³⁷)', () => {
	expect(log10K(DANIELL_E0, 2)).toBeCloseTo(37.3, 1);
	const start = daniellAt(0);
	expect(start.voltage).toBeCloseTo(1.1037, 4);
	expect(start.ah).toBe(0);
	const half = daniellAt(0.5);
	// Half the copper gone: 1.5 mol/L Zn²⁺, 0.5 Cu²⁺ — only 14 mV lower.
	expect(half.zn).toBeCloseTo(1.5, 6);
	expect(half.voltage).toBeCloseTo(1.0896, 3);
	expect(daniellAt(0.99).voltage).toBeGreaterThan(1.03);
	const end = daniellAt(1);
	expect(end.voltage).toBeCloseTo(0, 6);
	// Faraday: 0.1 mol of Cu²⁺ takes 0.2 mol of electrons, 5.36 Ah.
	expect(end.electrons).toBeCloseTo(0.2, 6);
	expect(end.ah).toBeCloseTo(5.36, 2);
	expect(end.logCu).toBeLessThan(-36);
	// The voltage only ever falls as the cell runs.
	let last = Infinity;
	for (let u = 0; u <= 1; u += 0.01) {
		const v = daniellAt(u).voltage;
		expect(v).toBeLessThanOrEqual(last + 1e-12);
		last = v;
	}
});

test("Faraday's law gives the textbook theoretical capacities", () => {
	expect(theoreticalCapacity(li)).toBeCloseTo(3862, -1);
	expect(theoreticalCapacity(graphite)).toBeCloseTo(372, 0);
	expect(theoreticalCapacity(lco)).toBeCloseTo(274, 0);
	expect(theoreticalCapacity(lfp)).toBeCloseTo(170, 0);
	expect(theoreticalCapacity(nmc)).toBeCloseTo(275.5, 0);
	expect(theoreticalCapacity(silicon)).toBeCloseTo(3579, -1);
	// LiCoO₂ gives up only about half its lithium: ~130 mAh/g, against Manthiram's "~140".
	expect(usableCapacity(lco)).toBeGreaterThan(125);
	expect(usableCapacity(lco)).toBeLessThan(140);
});

test('every electrode curve is finite and one-way over the window it is used in', () => {
	for (const m of MATERIALS) {
		let last = m.side === 'cathode' ? -Infinity : Infinity;
		for (let i = 0; i <= 200; i++) {
			const soc = i / 200;
			const s = m.empty + (m.full - m.empty) * soc;
			const u = m.ocp(s);
			expect(Number.isFinite(u), `${m.id} at ${soc}`).toBe(true);
			expect(u).toBeGreaterThanOrEqual(0);
			expect(u).toBeLessThan(4.6);
			// Charging raises the cathode's potential and lowers the anode's.
			if (m.side === 'cathode') expect(u, `${m.id} at ${soc}`).toBeGreaterThanOrEqual(last - 1e-3);
			else expect(u, `${m.id} at ${soc}`).toBeLessThanOrEqual(last + 1e-3);
			last = u;
		}
	}
});

test('the LG M50 cell runs from 2.5 V empty to 4.2 V full, about 3.7 V on average', () => {
	expect(cellVoltage(nmc, graphite, 0)).toBeCloseTo(M50.vMin, 1);
	expect(cellVoltage(nmc, graphite, 1)).toBeCloseTo(M50.vMax, 1);
	const mean = meanVoltage(nmc, graphite);
	expect(mean).toBeGreaterThan(3.6);
	expect(mean).toBeLessThan(3.8);
	// 5 Ah moves 0.187 mol of lithium ions, 1.3 g of lithium.
	expect(lithiumMoles(M50.capacityAh)).toBeCloseTo(0.1866, 4);
	expect(lithiumGrams(M50.capacityAh)).toBeCloseTo(1.3, 1);
	// About 270 Wh per kg of the whole cell, at open circuit.
	const whPerKg = (M50.capacityAh * mean) / (M50.massG / 1000);
	expect(whPerKg).toBeGreaterThan(250);
	expect(whPerKg).toBeLessThan(290);
});

test('swapping materials changes voltage and capacity the way the page says', () => {
	const base = pairFigures(nmc, graphite);
	const iron = pairFigures(lfp, graphite);
	const metal = pairFigures(nmc, li);
	const si = pairFigures(nmc, silicon);
	// LiFePO₄ is about half a volt lower than NMC: the 3.2 V of LFP cells.
	expect(base.meanV - iron.meanV).toBeGreaterThan(0.4);
	expect(iron.meanV).toBeCloseTo(3.2, 1);
	// Lithium metal raises the voltage (~0.1–0.2 V) and the energy.
	expect(metal.meanV).toBeGreaterThan(base.meanV);
	expect(metal.specificEnergy).toBeGreaterThan(base.specificEnergy * 1.4);
	// Silicon stores ten times more per gram than graphite, but its potential is higher.
	expect(si.qAnode / base.qAnode).toBeGreaterThan(9);
	expect(si.meanV).toBeLessThan(base.meanV);
	// The cathode is the heavy part: even with graphite it outweighs the anode.
	expect(base.gCathode).toBeGreaterThan(base.gAnode);
	// Active materials alone: several hundred Wh/kg (a whole cell gets about half).
	expect(base.specificEnergy).toBeGreaterThan(400);
	expect(base.specificEnergy).toBeLessThan(600);
});
