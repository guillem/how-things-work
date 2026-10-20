// The combined-cycle model: a gas turbine on NASA polynomials and a heat-recovery steam
// generator on NIST steam properties.
import { expect, test } from '@playwright/test';
import {
	AIR,
	cpSpecies,
	gasTurbine,
	LHV_MASS,
	plant,
	satAtP,
	satAtT,
	steamProps,
	T_COND
} from '../src/routes/gas-turbines-combined-cycle/model';

const base = { ratio: 18, tit: 1650, pHigh: 12, pinch: 10, levels: 3 };

test('the gas data: air’s cp at 300 K is 1.005 kJ/(kg K), methane’s heating value 50.0 MJ/kg', () => {
	const cpMolar = Object.entries(AIR).reduce((a, [sp, n]) => a + (n ?? 0) * cpSpecies(sp, 300), 0);
	expect(cpMolar / 28.965e-3).toBeCloseTo(1.005, 2);
	expect(LHV_MASS).toBeCloseTo(50.0, 1);
});

test('the steam data: water boils at 100 °C at 0.1 MPa and at 324.7 °C at 12 MPa', () => {
	expect(satAtP(0.1)[0] - 273.15).toBeCloseTo(99.6, 1);
	expect(satAtP(12)[0] - 273.15).toBeCloseTo(324.7, 0);
	// Superheated steam at 10 MPa, 500 °C: h = 3375 kJ/kg (IAPWS).
	expect(steamProps(773.15, 10, 1).h).toBeCloseTo(3375, -1);
});

test('the gas turbine: about 40% efficient, with an exhaust near 600 °C', () => {
	const gt = gasTurbine(18, 1650);
	expect(gt.efficiency).toBeGreaterThan(0.36);
	expect(gt.efficiency).toBeLessThan(0.44);
	expect(gt.t4 - 273.15).toBeGreaterThan(530);
	expect(gt.t4 - 273.15).toBeLessThan(680);
});

test('a higher pressure ratio cools the exhaust, and the plant’s best ratio is below the gas turbine’s own', () => {
	const ratios = Array.from({ length: 36 }, (_, i) => 5 + i);
	const best = (f: (r: number) => number) =>
		ratios.reduce((b, r) => (f(r) > f(b) ? r : b), ratios[0]);
	const gtBest = best((r) => gasTurbine(r, 1650).efficiency);
	const ccBest = best((r) => plant({ ...base, ratio: r }).efficiency);
	expect(ccBest).toBeLessThan(gtBest);
	expect(gasTurbine(30, 1650).t4).toBeLessThan(gasTurbine(10, 1650).t4);
});

test('three pressure levels and a small pinch take the plant past 55%', () => {
	const p = plant(base);
	expect(p.efficiency).toBeGreaterThan(0.55);
	expect(p.efficiency).toBeGreaterThan(p.gt.efficiency + 0.15);
});

test('each added level and each smaller pinch lowers the stack temperature and raises the efficiency', () => {
	const one = plant({ ...base, levels: 1 });
	const two = plant({ ...base, levels: 2 });
	const three = plant(base);
	expect(two.stack).toBeLessThan(one.stack);
	expect(three.stack).toBeLessThan(two.stack);
	expect(two.efficiency).toBeGreaterThan(one.efficiency);
	expect(three.efficiency).toBeGreaterThan(two.efficiency);
	const wide = plant({ ...base, pinch: 30 });
	expect(wide.stack).toBeGreaterThan(three.stack);
	expect(wide.efficiency).toBeLessThan(three.efficiency);
});

test('heat only flows downhill: the gas is hotter than the water at both ends of every section', () => {
	for (const levels of [1, 2, 3])
		for (const pinch of [5, 10, 30])
			for (const pHigh of [4, 8, 16]) {
				const p = plant({ ...base, levels, pinch, pHigh });
				for (const s of p.sections) {
					expect(s.gasIn).toBeGreaterThan(s.waterOut);
					expect(s.gasOut).toBeGreaterThan(s.waterIn);
				}
			}
});

test('energy balance: the heat the gas gives up equals what the water and steam take on', () => {
	for (const levels of [1, 2, 3]) {
		const p = plant({ ...base, levels });
		const gasSide = p.sections.reduce((a, s) => a + (s.q1 - s.q0), 0);
		const feed = satAtT(T_COND)[2];
		const waterSide = p.levels.reduce(
			(a, l) => a + l.steam * (steamProps(l.tSteam, l.p, 1).h - feed),
			0
		);
		// The pumps' small heating of the condensate is the only difference.
		expect(Math.abs(gasSide - waterSide) / gasSide).toBeLessThan(0.01);
	}
});
