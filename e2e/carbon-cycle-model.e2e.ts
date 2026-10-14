// Checks the carbon-cycle box model against the Global Carbon Budget 2025, the
// Joos et al. (2013) pulse-response multi-model mean and seawater chemistry
// (definition of done #5 in docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	DEFAULTS,
	PPM0,
	ZERO,
	dicFor,
	future,
	history,
	pHOf,
	ppmOf,
	pulse,
	revelle,
	seawaterPH,
	stepYear,
	today,
	totals
} from '../src/routes/carbon-cycle/carbon';
import { BUDGET, CUMULATIVE, PPM_2024 } from '../src/routes/carbon-cycle/data';

test('seawater in balance with pre-industrial air has the pH and buffer factor of real surface water', () => {
	const dic = dicFor(PPM0);
	// Surface-ocean DIC ~2000 µmol/kg, pH ~8.2 before industrialisation (AR6 ch. 5),
	// Revelle factor between 8 and 13 in today's ocean (IPCC AR4 WG1 §7.3.4.2).
	expect(dic * 1e6).toBeGreaterThan(1900);
	expect(dic * 1e6).toBeLessThan(2100);
	expect(seawaterPH(dic)).toBeCloseTo(8.18, 1);
	expect(revelle(dic)).toBeGreaterThan(8.5);
	expect(revelle(dic)).toBeLessThan(11);
	// More dissolved carbon makes the water harder to fill: the factor rises.
	expect(revelle(dicFor(560))).toBeGreaterThan(revelle(dic) + 1);
});

test('with nothing added, the cycle stays in balance', () => {
	let s = ZERO;
	for (let i = 0; i < 500; i++) s = stepYear(s, 0, 0);
	for (const v of Object.values(s as unknown as Record<string, number>))
		expect(Math.abs(v)).toBeLessThan(1e-9);
});

test('the model takes up what the Global Carbon Budget 2025 says the ocean and land took up', () => {
	const h = history();
	const decade = h.filter((y) => y.year >= 2015);
	const mean = (k: 'ocean' | 'land') => decade.reduce((a, y) => a + y[k], 0) / decade.length;
	// GCB 2025 Table 7, 2015–2024: ocean 3.2 ± 0.4, land 2.4 ± 0.8 GtC/yr.
	expect(Math.abs(mean('ocean') - BUDGET.ocean)).toBeLessThan(0.4);
	expect(Math.abs(mean('land') - BUDGET.land)).toBeLessThan(0.8);
	// Table 8, 1850–2024: ocean 200 ± 40, land 175 ± 50 GtC.
	const since1850 = h.filter((y) => y.year >= 1850);
	const sum = (k: 'ocean' | 'land') => since1850.reduce((a, y) => a + y[k], 0);
	expect(Math.abs(sum('ocean') - CUMULATIVE.ocean)).toBeLessThan(40);
	expect(Math.abs(sum('land') - CUMULATIVE.land)).toBeLessThan(50);
	// The atmosphere follows the record: 422.8 ppm in 2024.
	expect(ppmOf(today())).toBeCloseTo(PPM_2024, 0);
	// Surface ocean pH has fallen by about 0.1 since pre-industrial times.
	const drop = seawaterPH(dicFor(PPM0)) - pHOf(today());
	expect(drop).toBeGreaterThan(0.08);
	expect(drop).toBeLessThan(0.16);
});

test('carbon is conserved: everything burnt or cleared ends up in air, ocean or land', () => {
	const run = future(12, 2, 150, 600);
	const start = totals(run[0]);
	const kept = (t: ReturnType<typeof totals>) => t.air + t.ocean + t.land;
	for (const s of [run[50], run[150], run[600]]) {
		const t = totals(s);
		// Land counts cleared carbon as lost, so what the boxes gained is what was burnt.
		expect(kept(t) - kept(start)).toBeCloseTo(t.burnt - start.burnt, 6);
	}
	expect(totals(run[600]).burnt - start.burnt).toBeCloseTo(12 * 150, 6);
});

test('a pulse of CO₂ leaves the air on the timescales of the Joos et al. (2013) models', () => {
	const joos = (t: number) =>
		0.2173 +
		0.224 * Math.exp(-t / 394.4) +
		0.2824 * Math.exp(-t / 36.54) +
		0.2763 * Math.exp(-t / 4.304);
	const f = pulse(100, 1000);
	for (const year of [20, 100, 1000]) expect(Math.abs(f[year] - joos(year))).toBeLessThan(0.06);
	// After a thousand years about a quarter is still in the air.
	expect(f[1000]).toBeGreaterThan(0.18);
	expect(f[1000]).toBeLessThan(0.3);
	// A bigger pulse stays longer: the ocean's buffer fills up.
	expect(pulse(1000, 1000)[1000]).toBeGreaterThan(f[1000]);
});

test('if emissions stopped today, CO₂ would fall but stay far above pre-industrial for millennia', () => {
	const run = future(0, 0, 0, 1000);
	expect(ppmOf(run[100])).toBeLessThan(ppmOf(run[0]) - 30);
	expect(ppmOf(run[1000])).toBeGreaterThan(PPM0 + 40);
	// The ocean keeps absorbing long after the emissions stop.
	expect(totals(run[1000]).ocean).toBeGreaterThan(totals(run[0]).ocean * 1.8);
});

test('weaker sinks leave more carbon in the air', () => {
	const base = future(9.8, 1.4, 100, 100)[100];
	const noPlants = future(9.8, 1.4, 100, 100, { ...DEFAULTS, beta: 0 })[100];
	expect(ppmOf(noPlants)).toBeGreaterThan(ppmOf(base) + 50);
});

test('the numbers the narrative quotes', () => {
	const peak = (run: ReturnType<typeof future>) => Math.max(...run.map(ppmOf));
	// "Run the clock": today's emissions for 50 years.
	const fifty = future(9.8, 1.4, 50, 1000);
	expect(peak(fifty)).toBeCloseTo(535, -1);
	expect(ppmOf(fifty[1000])).toBeCloseTo(390, -1);
	// Stopping now: about 370 ppm within a century.
	expect(ppmOf(future(0, 0, 0, 100)[100])).toBeCloseTo(370, -1);
	// Plants that do not respond to CO₂: a peak of about 630 ppm.
	expect(peak(future(9.8, 1.4, 50, 100, { ...DEFAULTS, beta: 0 }))).toBeCloseTo(630, -1);
	// A 100 GtC burst: about 60% after 20 years, 40% after 100, a quarter after 1,000.
	const f = pulse(100, 1000);
	expect(f[20]).toBeCloseTo(0.6, 1);
	expect(f[100]).toBeCloseTo(0.4, 1);
	expect(f[1000]).toBeCloseTo(0.25, 1);
	// Stopping now, a thousand years on: about 330 ppm.
	expect(ppmOf(future(0, 0, 0, 1000)[1000])).toBeCloseTo(330, -1);
	// The model's history: 3.2 and 2.4 GtC/yr into ocean and plants in 2015–2024,
	// about 140 GtC into plants since 1850 and a surface pH from 8.18 to 8.04.
	const h = history();
	const decade = h.filter((y) => y.year >= 2015);
	const mean = (k: 'ocean' | 'land') => decade.reduce((a, y) => a + y[k], 0) / decade.length;
	expect(mean('ocean')).toBeCloseTo(3.2, 1);
	expect(mean('land')).toBeCloseTo(2.4, 1);
	const land1850 = h.filter((y) => y.year >= 1850).reduce((a, y) => a + y.land, 0);
	expect(land1850).toBeCloseTo(140, -1);
	expect(seawaterPH(dicFor(PPM0))).toBeCloseTo(8.18, 2);
	expect(pHOf(today())).toBeCloseTo(8.04, 2);
	// "Unlocking the slow loop": what the fast loop holds in 2024, GtC.
	const t = totals(today());
	expect(t.burnt).toBeCloseTo(499, 0);
	expect(today().cleared).toBeCloseTo(278, 0);
	expect(t.air).toBeCloseTo(308, 0);
	expect(t.ocean).toBeCloseTo(206, 0);
	expect(t.landSink).toBeCloseTo(154, 0);
	expect(t.land).toBeCloseTo(-123, 0);
});
