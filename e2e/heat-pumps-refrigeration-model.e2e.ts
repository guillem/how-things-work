// The vapour-compression model on NIST refrigerant properties.
import { expect, test } from '@playwright/test';
import { cycle, satAtP, satAtT } from '../src/routes/heat-pumps-refrigeration/model';

const C = (c: number) => c + 273.15;

test('the data: saturation pressures at 0 °C of R-134a, propane and CO2', () => {
	expect(satAtT('r134a', C(0)).p).toBeCloseTo(0.2928, 3);
	expect(satAtT('propane', C(0)).p).toBeCloseTo(0.4745, 3);
	expect(satAtT('co2', C(0)).p).toBeCloseTo(3.485, 2);
	// R-134a in its usual reference state: saturated liquid at 0 °C has h = 200 kJ/kg.
	expect(satAtT('r134a', C(0)).hf).toBeCloseTo(200, 0);
});

test('the textbook R-134a refrigerator between 0.14 and 0.8 MPa has a COP of about 3.97', () => {
	// Çengel and Boles, Thermodynamics, example 11-1: an ideal cycle, saturated vapour into the
	// compressor at 0.14 MPa and saturated liquid out of the condenser at 0.8 MPa.
	const c = cycle({
		fluid: 'r134a',
		tEvap: satAtP('r134a', 0.14).T,
		high: { tCond: satAtP('r134a', 0.8).T }
	});
	expect(c.copCooling).toBeGreaterThan(3.9);
	expect(c.copCooling).toBeLessThan(4.05);
	// A heat pump on the same cycle delivers its work plus what it took in: COP one higher.
	expect(c.copHeating).toBeCloseTo(c.copCooling + 1, 9);
});

test('the COP never beats Carnot, and falls as the temperature lift grows', () => {
	for (const fluid of ['r134a', 'propane'] as const) {
		let prev = Infinity;
		for (const tc of [30, 40, 50, 60]) {
			const c = cycle({ fluid, tEvap: C(0), high: { tCond: C(tc) }, eta: 0.75 });
			expect(c.copHeating).toBeLessThan(c.carnotHeating);
			expect(c.copHeating).toBeLessThan(prev);
			prev = c.copHeating;
		}
	}
});

test('a worse compressor lowers the COP; subcooling raises it', () => {
	const base = { fluid: 'r134a' as const, tEvap: C(-5), high: { tCond: C(45) } };
	expect(cycle({ ...base, eta: 0.6 }).copHeating).toBeLessThan(
		cycle({ ...base, eta: 0.9 }).copHeating
	);
	expect(cycle({ ...base, subcool: 8 }).copCooling).toBeGreaterThan(cycle(base).copCooling);
});

test('CO2 above its critical point: the gas cooler has a best pressure', () => {
	const cop = (p: number) =>
		cycle({ fluid: 'co2', tEvap: C(0), high: { p, tOut: C(35) }, eta: 0.75 }).copHeating;
	const ps = [7.5, 8, 8.5, 9, 9.5, 10, 11, 12];
	const best = ps.reduce((b, p) => (cop(p) > cop(b) ? p : b), ps[0]);
	expect(best).toBeGreaterThan(7.5);
	expect(best).toBeLessThan(12);
	expect(cycle({ fluid: 'co2', tEvap: C(0), high: { p: 9, tOut: C(35) } }).transcritical).toBe(
		true
	);
});

test('the expansion valve flashes some liquid to vapour', () => {
	const c = cycle({ fluid: 'r134a', tEvap: C(0), high: { tCond: C(40) } });
	expect(c.quality).toBeGreaterThan(0.15);
	expect(c.quality).toBeLessThan(0.4);
});

test('settings that do not make the boiling cycle are flagged, never shown as odd numbers', () => {
	// Subcooled below the evaporating temperature: the valve's outlet would be below the dome.
	const sub = cycle({ fluid: 'r134a', tEvap: C(15), high: { tCond: C(25) }, subcool: 15 });
	expect(sub.valid).toBe(false);
	expect(sub.quality).toBeNaN();
	// CO2 cooled only to 45 °C at 7.5 MPa: the valve's outlet is beyond the vapour side of the dome.
	const co2 = cycle({ fluid: 'co2', tEvap: C(15), high: { p: 7.5, tOut: C(45) } });
	expect(co2.valid).toBe(false);
	// Off the tables: a 50% compressor squeezing CO2 to 12 MPa from -30 °C.
	const off = cycle({
		fluid: 'co2',
		tEvap: C(-30),
		high: { p: 12, tOut: C(35) },
		eta: 0.5,
		superheat: 15
	});
	expect(off.valid).toBe(false);
});

test('every valid setting stays below its Carnot reference, superheat and subcooling included', () => {
	for (const fluid of ['r134a', 'propane'] as const)
		for (const te of [-30, -10, 0, 15])
			for (const tc of [25, 40, 70])
				for (const sc of [0, 5, 15])
					for (const sh of [0, 15]) {
						const c = cycle({
							fluid,
							tEvap: C(te),
							high: { tCond: C(tc) },
							eta: 1,
							superheat: sh,
							subcool: sc
						});
						if (c.valid) expect(c.copHeating).toBeLessThan(c.carnotHeating);
					}
});
