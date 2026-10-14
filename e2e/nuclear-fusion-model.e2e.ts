// Checks the fusion model behind the explainer against published values: reaction energies
// from atomic masses, the Bosch–Hale reactivities, the Lawson criterion. Runs in Node.
import { expect, test } from '@playwright/test';
import { curve, nuclides } from '../src/routes/nuclear-fusion/binding';
import {
	E_ALPHA,
	E_NEUTRON,
	DT_MASS_FRACTION,
	Q_DD_N,
	Q_DD_P,
	Q_DHE3,
	Q_DT,
	Q_FISSION,
	Q_LI6,
	barrier,
	bestIgnition,
	burnTemperature,
	classicalTemperature,
	coast,
	crossSectionDT,
	energyPerKg,
	gamowEnergy,
	fusionPeak,
	gamowPeak,
	idealIgnitionTemperature,
	kelvin,
	maxwell,
	powers,
	reactivity,
	reactivityFromCrossSection,
	tripleFor,
	tunnelling
} from '../src/routes/nuclear-fusion/model';

const near = (value: number, target: number, rel: number) =>
	expect(Math.abs(value / target - 1)).toBeLessThan(rel);

test('binding energy per nucleon: steep rise from deuterium to helium-4, peak at nickel-62', () => {
	expect(nuclides['H-2'].bindingPerNucleon / 1000).toBeCloseTo(1.11, 2);
	expect(nuclides['H-3'].bindingPerNucleon / 1000).toBeCloseTo(2.83, 2);
	expect(nuclides['He-4'].bindingPerNucleon / 1000).toBeCloseTo(7.07, 2);
	expect(nuclides['U-235'].bindingPerNucleon / 1000).toBeCloseTo(7.59, 2);
	const top = curve.reduce((a, b) => (b[2] > a[2] ? b : a));
	expect([top[0], top[1]]).toEqual([62, 28]); // nickel-62, just ahead of iron-58 and iron-56
	expect(nuclides['Fe-56'].bindingPerNucleon / 1000).toBeCloseTo(8.79, 2);
});

test('D + T → ⁴He + n releases 17.6 MeV: 3.5 MeV to the alpha, 14.1 MeV to the neutron', () => {
	expect(Q_DT / 1000).toBeCloseTo(17.59, 2);
	expect(E_ALPHA / 1000).toBeCloseTo(3.54, 2);
	expect(E_NEUTRON / 1000).toBeCloseTo(14.05, 2);
	expect(E_NEUTRON / Q_DT).toBeCloseTo(0.8, 2);
	// 0.38% of the fuel's mass becomes energy (the Sun's chain manages 0.7%).
	expect(DT_MASS_FRACTION * 100).toBeCloseTo(0.375, 3);
	// The other reactions on the page.
	expect(Q_DD_N / 1000).toBeCloseTo(3.27, 2);
	expect(Q_DD_P / 1000).toBeCloseTo(4.03, 2);
	expect(Q_DHE3 / 1000).toBeCloseTo(18.35, 2);
	expect(Q_LI6 / 1000).toBeCloseTo(4.78, 2);
});

test('per kilogram, D–T fusion gives 4 times as much as uranium fission and 6 million times methane', () => {
	expect(Q_FISSION / 1000).toBeCloseTo(199, 0); // the usual round figure is 200 MeV
	near(energyPerKg.fusion, 3.4e14, 0.01);
	near(energyPerKg.fission, 8.2e13, 0.01);
	near(energyPerKg.methane, 5.55e7, 0.01);
	expect(energyPerKg.fusion / energyPerKg.fission).toBeCloseTo(4.1, 1);
	near(energyPerKg.fusion / energyPerKg.methane, 6.1e6, 0.02);
});

test('the Coulomb barrier is about 0.44 MeV; climbing it on average would take 3.4 billion K', () => {
	expect(barrier() / 1000).toBeCloseTo(0.44, 2);
	near(kelvin(classicalTemperature()), 3.4e9, 0.02);
	// 10 keV is 116 million kelvin, the Sun's core (16 million K) is 1.4 keV.
	near(kelvin(10), 1.16e8, 0.01);
	expect(1.6e7 / kelvin(1)).toBeCloseTo(1.38, 2);
});

test('tunnelling: the Gamow energy matches Bosch–Hale; at 10 keV most fusions come from 35 keV pairs', () => {
	near(Math.sqrt(gamowEnergy()), 34.3827, 0.001);
	// The textbook Gamow peak (no resonance) and the real one, from the D–T cross section.
	expect(gamowPeak(10)).toBeCloseTo(30.9, 1);
	expect(fusionPeak(10)).toBeGreaterThan(33);
	expect(fusionPeak(10)).toBeLessThan(37);
	// A pair with the average energy (15 keV) has a 1-in-7,000 chance per collision of
	// getting through; one at 35 keV, about 1 in 350.
	expect(1 / tunnelling(15)).toBeGreaterThan(6500);
	expect(1 / tunnelling(15)).toBeLessThan(7500);
	expect(1 / tunnelling(35)).toBeGreaterThan(300);
	expect(1 / tunnelling(35)).toBeLessThan(400);
	// Pairs with 35 keV or more are a small minority: about 1 in 14 at 10 keV.
	let tail = 0;
	for (let e = 35; e < 400; e += 0.01) tail += maxwell(e, 10) * 0.01;
	expect(1 / tail).toBeGreaterThan(12);
	expect(1 / tail).toBeLessThan(16);
});

test('reactivities match the Bosch–Hale table (UWFDM-1268, table 6)', () => {
	// T (keV): [D–T, D(d,n)³He, D(d,p)T, ³He(d,p)⁴He] in cm³/s.
	const table: [number, number, number, number, number][] = [
		[1, 6.86e-21, 9.93e-23, 1.02e-22, 3.05e-26],
		[2, 2.98e-19, 3.11e-21, 3.15e-21, 1.4e-23],
		[5, 1.37e-17, 9.13e-20, 9.02e-20, 6.36e-21],
		[10, 1.14e-16, 6.02e-19, 5.78e-19, 2.12e-19],
		[20, 4.33e-16, 2.6e-18, 2.4e-18, 3.48e-18],
		[50, 8.65e-16, 1.13e-17, 9.84e-18, 5.55e-17],
		[100, 8.45e-16, 2.68e-17, 2.24e-17, 1.72e-16]
	];
	for (const [t, dt, ddn, ddp, dhe3] of table) {
		near(reactivity(t) * 1e6, dt, 0.006);
		near(reactivity(t, 'DDn') * 1e6, ddn, 0.006);
		near(reactivity(t, 'DDp') * 1e6, ddp, 0.006);
		near(reactivity(t, 'DHe3') * 1e6, dhe3, 0.006);
	}
});

test('D–T: cross section peaks at 5 barns near 65 keV; reactivity peaks near 65 keV, 100× D–D at 10 keV', () => {
	let best = 0;
	let at = 0;
	for (let e = 1; e < 500; e += 0.5) {
		const s = crossSectionDT(e);
		if (s > best) [best, at] = [s, e];
	}
	expect(best / 1e-28).toBeGreaterThan(4.9);
	expect(best / 1e-28).toBeLessThan(5.2);
	expect(at).toBeGreaterThan(60);
	expect(at).toBeLessThan(70);
	let peak = 0;
	let tPeak = 0;
	for (let t = 1; t <= 100; t += 0.5) {
		const r = reactivity(t);
		if (r > peak) [peak, tPeak] = [r, t];
	}
	expect(tPeak).toBeGreaterThan(60);
	expect(tPeak).toBeLessThan(70);
	const dd = reactivity(10, 'DDn') + reactivity(10, 'DDp');
	expect(reactivity(10) / dd).toBeGreaterThan(90);
	expect(reactivity(10) / dd).toBeLessThan(110);
	// Averaging the cross section over the thermal distribution gives the same reactivity.
	for (const t of [2, 5, 10, 20, 50]) near(reactivityFromCrossSection(t), reactivity(t), 0.01);
});

test('Lawson: ignition needs n T τ_E ≈ 3 × 10²¹ keV s m⁻³ at best, near 14 keV; never below 4.3 keV', () => {
	const best = bestIgnition();
	expect(best.t).toBeGreaterThan(13);
	expect(best.t).toBeLessThan(15.5);
	expect(best.triple).toBeGreaterThan(2.7e21);
	expect(best.triple).toBeLessThan(3.2e21);
	expect(idealIgnitionTemperature()).toBeCloseTo(4.3, 1);
	expect(tripleFor(4)).toBe(Infinity);
	// Gain 1 needs about a sixth of the ignition triple product at 10 keV, gain 10 two-thirds.
	expect(tripleFor(10, 1) / tripleFor(10)).toBeCloseTo(0.15, 2);
	expect(tripleFor(10, 10) / tripleFor(10)).toBeCloseTo(0.64, 2);
});

test('a plasma at 10 keV, 10²⁰ m⁻³, τ_E = 1 s: 0.8 MW/m³ of fusion, gain 2.4, cools once heating stops', () => {
	const p = powers({ t: 10, n: 1e20, tau: 1 });
	expect(p.fusion / 1e6).toBeCloseTo(0.8, 2);
	expect(p.q).toBeCloseTo(2.4, 1);
	expect(p.alpha / p.fusion).toBeCloseTo(0.2, 2);
	const run = coast({ t: 10, n: 1e20, tau: 1 });
	expect(run.outcome).toBe('cools');
	expect(run.final).toBeLessThan(1);
});

test('above the Lawson line the plasma heats itself to a steady burn; below it, it fizzles', () => {
	// 15 keV, 10²⁰ m⁻³, 2 s: n T τ_E = 3 × 10²¹, just above the line.
	const hot = coast({ t: 15, n: 1e20, tau: 2 });
	expect(powers({ t: 15, n: 1e20, tau: 2 }).q).toBe(Infinity);
	expect(hot.outcome).toBe('ignites');
	const burn = burnTemperature(1e20, 2);
	expect(burn).not.toBeNull();
	near(hot.final, burn ?? 0, 0.06); // nearly settled after 8 confinement times
	expect(burn).toBeGreaterThan(40);
	// Same density and confinement but 10 keV: below the line, it cools.
	expect(coast({ t: 10, n: 1e20, tau: 2 }).outcome).toBe('cools');
	// Below the ideal ignition temperature even superb confinement cannot ignite it.
	expect(coast({ t: 4, n: 1e21, tau: 10 }).outcome).toBe('cools');
});
