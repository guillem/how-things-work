// Checks the heat-engine model behind the explainer against the laws of thermodynamics,
// textbook results and the numbers the narrative quotes. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	CP,
	CV,
	GAMMA,
	P_ATM,
	R_AIR,
	boxCycle,
	carnot,
	carnotAround,
	carnotDemo,
	carnotLimit,
	clausius,
	diesel,
	enclosedWork,
	engineAt,
	ledger,
	loop,
	otto,
	ottoEfficiency,
	pushAtConstantPressure,
	reservoirEntropy,
	type Cycle
} from '../src/routes/heat-engines/engine';
import {
	T_BOIL,
	boilerSaturation,
	boilingPoint,
	combined,
	rankine,
	saturationAt,
	superheated
} from '../src/routes/heat-engines/steam';
import { EIA_HEAT_RATE, fromHeatRate } from '../src/routes/heat-engines/real-data';

const grid = <T>(xs: number[], f: (x: number) => T[]) => xs.flatMap(f);
/** Every cycle the sliders can make (the narrative's ranges). */
const cycles: Cycle[] = [
	...grid([6, 8, 10, 12, 14], (r) =>
		grid([250, 300, 400], (tc) => [1500, 2200, 3000].map((th) => otto(r, tc, th)))
	),
	...grid([12, 16, 20, 24], (r) =>
		grid([250, 300, 400], (tc) => [1500, 2200, 3000].map((th) => diesel(r, tc, th)))
	)
];

test('air: cp − cv = R and cp/cv = γ = 1.4 (cp ≈ 1.005 kJ/(kg·K))', () => {
	expect(CP - CV).toBeCloseTo(R_AIR, 9);
	expect(CP / CV).toBeCloseTo(GAMMA, 12);
	expect(CP).toBeCloseTo(1004.5, 1);
});

test('first law: the area enclosed on the P–V chart is the heat in minus the heat out', () => {
	for (const c of [...cycles, carnot(6e-4, 300, 900, 5e-4, 0.2)]) {
		expect(enclosedWork(loop(c, 2000)) / c.work).toBeCloseTo(1, 4);
		expect(c.work).toBeCloseTo(c.qIn - c.qOut, 9);
	}
});

test('second law: no cycle beats 1 − Tc/Th, and the surroundings never lose entropy', () => {
	for (const c of cycles) {
		expect(c.valid).toBe(true);
		expect(c.efficiency).toBeLessThan(carnotLimit(c.tMax, c.tMin));
		expect(reservoirEntropy(c)).toBeGreaterThan(0);
		// The gas itself comes back to the same state: ∮ δQ/T over a reversible cycle is zero.
		expect(Math.abs(clausius(c)) / (c.qIn / c.tMax)).toBeLessThan(1e-4);
	}
	const c = carnot(6e-4, 300, 1200, 5e-4, 0.3);
	expect(c.efficiency).toBeCloseTo(carnotLimit(1200, 300), 12);
	expect(reservoirEntropy(c)).toBeCloseTo(0, 12);
});

test('Otto: efficiency 1 − r^(1−γ), whatever the temperatures; 60% at r = 10', () => {
	expect(ottoEfficiency(10)).toBeCloseTo(0.602, 3);
	expect(ottoEfficiency(8)).toBeCloseTo(0.565, 3);
	expect(ottoEfficiency(13)).toBeCloseTo(0.642, 3);
	for (const th of [1500, 2500, 3000]) expect(otto(10, 300, th).efficiency).toBeCloseTo(0.602, 3);
	// It equals a Carnot engine between the intake air and the end of compression.
	const c = otto(10, 300, 2500);
	expect(c.efficiency).toBeCloseTo(carnotLimit(c.states[1].T, c.states[0].T), 12);
	expect(ottoEfficiency(1.000001)).toBeCloseTo(0, 5);
});

test('Otto at r = 10, 300 K → 2500 K, 0.5 L: 754 K and 25 bar after compression, about 490 J per cycle', () => {
	const c = otto(10, 300, 2500);
	expect(c.states[1].T).toBeCloseTo(754, 0);
	expect(c.states[1].P / 1e5).toBeCloseTo(25.5, 1);
	expect(c.states[2].P / 1e5).toBeCloseTo(84, 0);
	expect(c.qIn).toBeCloseTo(819, 0);
	expect(c.work).toBeCloseTo(493, 0);
	expect(c.qOut).toBeCloseTo(326, 0);
	expect(c.states[3].T).toBeCloseTo(995, 0);
	// A hotter flame gives a bigger loop (more work) at the same efficiency.
	expect(otto(10, 300, 3000).work).toBeGreaterThan(c.work);
});

test('no room for heat when the compression already reaches the hot temperature', () => {
	const c = otto(14, 400, 1100);
	expect(c.valid).toBe(false);
	expect(c.qIn).toBe(0);
	expect(c.work).toBeCloseTo(0, 9);
});

test('Diesel: below Otto at the same ratio, the same as Otto as the burn shrinks to nothing', () => {
	for (const r of [12, 18, 24]) {
		expect(diesel(r, 300, 2200).efficiency).toBeLessThan(ottoEfficiency(r));
	}
	const t2 = 300 * Math.pow(18, GAMMA - 1);
	expect(diesel(18, 300, t2 * 1.0001).efficiency).toBeCloseTo(ottoEfficiency(18), 4);
	// Compressing more (22 against a petrol engine's 10) more than makes up for it.
	expect(diesel(22, 300, 2500).efficiency).toBeGreaterThan(ottoEfficiency(10));
	expect(diesel(22, 300, 2500).efficiency).toBeCloseTo(0.643, 3);
	expect(diesel(18, 300, 2500).states[1].T).toBeCloseTo(953, 0);
	// Unlike Otto's, its efficiency falls as the burn gets longer (hotter).
	expect(diesel(18, 300, 2000).efficiency).toBeGreaterThan(diesel(18, 300, 2500).efficiency);
});

test('Carnot with the Otto engine’s entropy range: 88% at 300/2500 K, but 1,700 bar and a 4,000-fold squeeze', () => {
	const o = otto(10, 300, 2500);
	const c = carnotAround(o);
	expect(c.efficiency).toBeCloseTo(0.88, 12);
	expect(c.states[0]).toEqual(o.states[0]);
	expect(c.work).toBeGreaterThan(2 * o.work);
	expect(c.states[1].P / 1e5).toBeCloseTo(1693, -1);
	expect(c.states[3].V / c.states[1].V).toBeCloseTo(4019, -1);
});

test('the perfect engine, 0.59 g of air from 1 atm: 50% at 600/300 K; reaching 2,500 K takes a 200-fold squeeze and 1,700 bar', () => {
	const c = carnotDemo(600, 300);
	expect(c.efficiency).toBeCloseTo(0.5, 12);
	expect(c.states[0].P).toBeCloseTo(P_ATM, 6);
	expect(c.states[2].V / c.states[1].V).toBeCloseTo(2, 12);
	const hot = carnotDemo(2500, 300);
	expect(hot.states[0].V / hot.states[1].V).toBeCloseTo(200.5, 1);
	expect(hot.states[1].P / 1e5).toBeCloseTo(1693, -1);
});

test('entropy ledger: turning more than 1 − Tc/Th of the heat into work would lower the total entropy', () => {
	expect(ledger(1000, 0.5, 600, 300).dsTotal).toBeCloseTo(0, 12);
	expect(ledger(1000, 0.5, 600, 300).allowed).toBe(true);
	expect(ledger(1000, 0.51, 600, 300).allowed).toBe(false);
	expect(ledger(1000, 0.3, 600, 300).dsTotal).toBeCloseTo(-1000 / 600 + 700 / 300, 12);
	expect(ledger(1000, 1, 3000, 250).allowed).toBe(false);
	expect(carnotLimit(300, 300)).toBe(0);
});

test('heating half a litre of air at constant pressure: 100 J in, 29 J of work', () => {
	const p = pushAtConstantPressure(100);
	expect(p.work).toBeCloseTo((100 * R_AIR) / CP, 9);
	expect(p.work).toBeCloseTo(28.6, 1);
	expect(p.dT).toBeCloseTo(169, 0);
	expect(p.m * 1000).toBeCloseTo(0.588, 3);
});

test('box cycle: 101 J out, 51 J back, 51 J net from 481 J of heat; pushed back hot it nets nothing', () => {
	const b = boxCycle('cold');
	expect(b.workOut).toBeCloseTo(101, 0);
	expect(b.workIn).toBeCloseTo(51, 0);
	expect(b.net).toBeCloseTo(2 * P_ATM * 0.5e-3 - P_ATM * 0.5e-3, 9);
	expect(b.qIn).toBeCloseTo(481, 0);
	expect(b.net / b.qIn).toBeCloseTo(0.105, 3);
	expect(boxCycle('same').net).toBe(0);
});

test('the engine’s strokes follow the crank: intake down, compression up, power down, exhaust up', () => {
	const c = otto(10, 300, 2500);
	const at = (u: number) => engineAt(c, u);
	expect(at(0).stroke).toBe('intake');
	expect(at(0).x).toBeCloseTo(0, 9);
	expect(at(0.2).x).toBeGreaterThan(at(0.1).x);
	expect(at(0.3).stroke).toBe('compression');
	expect(at(0.3).gas.P).toBeGreaterThan(P_ATM);
	expect(at(0.47).stroke).toBe('combustion');
	expect(at(0.6).stroke).toBe('power');
	expect(at(0.95).stroke).toBe('exhaust');
	// At the end of the compression stroke the gas is at state 2; at the top of the power stroke, state 3.
	expect(at(0.4399).gas.P / c.states[1].P).toBeCloseTo(1, 2);
	expect(at(0.5).gas.P / c.states[2].P).toBeCloseTo(1, 6);
	// The piston moves faster near the top than near the bottom (the connecting rod's angle).
	expect(at(0.05).x).toBeGreaterThan(0.5 * (1 - Math.cos((Math.PI * 0.05) / 0.22)));
});

test('the gas in the cylinder cools smoothly as the exhaust valve opens, and leaves still hot (about 700 K)', () => {
	for (const c of [otto(10, 300, 2500), diesel(18, 300, 2500)]) {
		const n = 4000;
		let prev = engineAt(c, 0).gas.T;
		for (let k = 1; k < n; k++) {
			const T = engineAt(c, k / n).gas.T;
			expect(Math.abs(T - prev)).toBeLessThan(50);
			prev = T;
		}
	}
	const c = otto(10, 300, 2500);
	const out = engineAt(c, 0.95);
	expect(out.stroke).toBe('exhaust');
	expect(out.gas.T).toBeGreaterThan(650);
	expect(out.gas.T).toBeLessThan(750);
});

test('steam data (NIST): water boils at 100 °C at 1 atm and at 46 °C at 10 kPa; 342 °C at 15 MPa', () => {
	expect(boilingPoint(0.101325)).toBeCloseTo(373.12, 1);
	expect(boilingPoint(0.01)).toBeCloseTo(318.96, 1);
	expect(T_BOIL - 273.15).toBeCloseTo(342.16, 1);
	const s = saturationAt(373.15);
	expect(s.hg - s.hf).toBeCloseTo(2256.4, 0); // latent heat of vaporisation
	expect(superheated(873.15).h).toBeCloseTo(3583.1, 0);
});

test('ideal Rankine cycle, 15 MPa and 600 °C to a 10 kPa condenser: 43% (Çengel’s example), steam 80% dry', () => {
	const k = rankine(873.15, boilingPoint(0.01));
	expect(k.efficiency).toBeCloseTo(0.43, 2);
	expect(k.x4).toBeCloseTo(0.804, 2);
	expect(k.wPump).toBeCloseTo(15.1, 1);
	expect(k.work).toBeCloseTo(k.qIn - k.qOut, 9);
	expect(k.carnot).toBeCloseTo(0.635, 2);
	expect(k.efficiency).toBeLessThan(k.carnot);
	// Most of the heat goes in while the water boils, well below the steam's top temperature.
	expect(k.tMeanIn).toBeLessThan(600);
	expect(k.efficiency).toBeCloseTo(1 - k.tCond / k.tMeanIn, 2);
	// Hotter steam and a colder condenser both help; neither breaks the Carnot limit.
	for (const ts of [650, 750, 900]) {
		for (const tc of [290, 320, 370]) {
			const r = rankine(ts, tc);
			expect(r.efficiency).toBeLessThan(r.carnot);
			expect(r.efficiency).toBeGreaterThan(0);
		}
	}
	expect(rankine(900, 300).efficiency).toBeGreaterThan(rankine(700, 300).efficiency);
	expect(rankine(800, 300).efficiency).toBeGreaterThan(rankine(800, 360).efficiency);
});

test('combined cycle: a 41% gas turbine plus a steam cycle on its exhaust reaches about 62%', () => {
	expect(combined(0.41, 0.36)).toBeCloseTo(0.622, 3);
	expect(combined(0.41, 0)).toBe(0.41);
});

test('real efficiencies from EIA heat rates: coal 34%, nuclear 33%, gas turbines 31%, combined cycle 45%', () => {
	expect(fromHeatRate(EIA_HEAT_RATE.coalSteam)).toBeCloseTo(0.341, 3);
	expect(fromHeatRate(EIA_HEAT_RATE.nuclear)).toBeCloseTo(0.327, 3);
	expect(fromHeatRate(EIA_HEAT_RATE.gasTurbine)).toBeCloseTo(0.31, 3);
	expect(fromHeatRate(EIA_HEAT_RATE.combinedCycle)).toBeCloseTo(0.452, 3);
});

test('in the 150-bar boiler, warming the water takes more heat than boiling it or superheating the steam', () => {
	const k = rankine(873.15, boilingPoint(0.01));
	const b = boilerSaturation();
	const warm = (b.hf - k.h2) / k.qIn;
	const boil = (b.hg - b.hf) / k.qIn;
	const superheat = (k.h3 - b.hg) / k.qIn;
	expect(warm + boil + superheat).toBeCloseTo(1, 9);
	expect(warm).toBeCloseTo(0.42, 2);
	expect(boil).toBeCloseTo(0.3, 2);
	expect(superheat).toBeCloseTo(0.29, 2);
	// On average the heat goes in at about 290 °C.
	expect(k.tMeanIn - 273.15).toBeCloseTo(287, 0);
});
