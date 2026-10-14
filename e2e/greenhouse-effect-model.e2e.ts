// Checks the greenhouse-effect energy-balance model against physics and the
// IPCC AR6 WG1 assessment (definition of done #5 in docs/TOPICS.md). Node only.
import { expect, test } from '@playwright/test';
import {
	ALL_FEEDBACKS,
	F2X,
	NO_FEEDBACKS,
	OBSERVED_2011_2020,
	PERIODS,
	PPM_PRE,
	SCENARIOS,
	SPM1,
	TCRE,
	absorptionFor,
	bareTemperature,
	budget,
	co2Forcing,
	emission,
	equilibriumWarming,
	layerFlows,
	layerSurfaceTemperature,
	periodMean,
	scenarioRun,
	sensitivity,
	stepOcean,
	lambda,
	transientResponse
} from '../src/routes/greenhouse-effect/climate';

test('a bare Earth would settle at 255 K, −18 °C', () => {
	expect(bareTemperature()).toBeGreaterThan(254);
	expect(bareTemperature()).toBeLessThan(256);
	// A darker planet absorbs more and is warmer; a white one is colder.
	expect(bareTemperature(0)).toBeCloseTo(278.3, 0);
	expect(bareTemperature(0.9)).toBeLessThan(160);
	// Stefan–Boltzmann: double the absolute temperature, sixteen times the glow.
	expect(emission(600) / emission(300)).toBeCloseTo(16, 6);
});

test('a layer absorbing about 77% of the infrared gives the real 288 K surface', () => {
	expect(layerSurfaceTemperature(0)).toBeCloseTo(bareTemperature(), 9);
	const eps = absorptionFor(288);
	expect(eps).toBeGreaterThan(0.75);
	expect(eps).toBeLessThan(0.79);
	expect(layerSurfaceTemperature(eps)).toBeCloseTo(288, 6);
	// Even a layer that absorbs everything only reaches 2^¼ × 255 K ≈ 303 K.
	expect(layerSurfaceTemperature(1)).toBeCloseTo(bareTemperature() * 2 ** 0.25, 9);
	// The budget closes at the top and the layer emits half of what it absorbs each way.
	const f = layerFlows(eps);
	expect(f.out).toBeCloseTo(f.sunlight, 6);
	expect(f.up + f.down).toBeCloseTo(f.absorbed, 9);
	// The surface gets sunlight plus the layer's downward half (AR6 Fig. 7.2: 398 up, 342 down).
	expect(f.surface).toBeCloseTo(f.sunlight + f.down, 6);
	expect(f.surface).toBeGreaterThan(385);
});

test('doubling CO₂ forces 3.93 W/m², whatever the starting level', () => {
	expect(co2Forcing(2 * PPM_PRE)).toBeCloseTo(F2X, 9);
	expect(co2Forcing(1120) - co2Forcing(560)).toBeCloseTo(F2X, 9);
	// Today's 420 ppm: a little over 2 W/m² (AR6: 2.16 for 2019's 410 ppm).
	expect(co2Forcing(410)).toBeGreaterThan(2.1);
	expect(co2Forcing(410)).toBeLessThan(2.25);
});

test('without feedbacks doubled CO₂ warms about 1.2 °C; with them, AR6’s 3 °C', () => {
	expect(sensitivity(NO_FEEDBACKS)).toBeGreaterThan(1.1);
	expect(sensitivity(NO_FEEDBACKS)).toBeLessThan(1.3);
	expect(sensitivity(ALL_FEEDBACKS)).toBeCloseTo(3, 9);
	// Each amplifying feedback switched on adds warming; water vapour the most.
	const only = (k: 'water' | 'ice' | 'clouds') => sensitivity({ ...NO_FEEDBACKS, [k]: true });
	expect(only('water')).toBeGreaterThan(only('clouds'));
	expect(only('clouds')).toBeGreaterThan(only('ice'));
	expect(only('ice')).toBeGreaterThan(sensitivity(NO_FEEDBACKS));
	// The net feedback stays negative: the planet always settles.
	expect(lambda(ALL_FEEDBACKS)).toBeLessThan(0);
});

test('at the new equilibrium the sunlight absorbed and the infrared escaping balance again', () => {
	const F = co2Forcing(560);
	for (const f of [NO_FEEDBACKS, ALL_FEEDBACKS, { water: true, ice: true, clouds: false }]) {
		const b0 = budget(F, 0, f);
		expect(b0.imbalance).toBeCloseTo(F, 9);
		const b = budget(F, equilibriumWarming(F, f), f);
		expect(Math.abs(b.imbalance)).toBeLessThan(1e-9);
	}
	// With the ice feedback the planet ends up absorbing more sunlight.
	const ice = { ...NO_FEEDBACKS, ice: true };
	expect(budget(F, equilibriumWarming(F, ice), ice).sunlight).toBeGreaterThan(
		budget(0, 0, ice).sunlight
	);
});

test('the ocean makes the warming slow: TCR is AR6’s 1.8 °C, and most of the rest takes centuries', () => {
	const tcr = transientResponse();
	expect(tcr).toBeGreaterThan(1.7);
	expect(tcr).toBeLessThan(1.9);
	let s = { T: 0, Td: 0 };
	const lam = lambda(ALL_FEEDBACKS);
	const at: Record<number, number> = {};
	for (let y = 1; y <= 1000; y++) {
		s = stepOcean(s, F2X, lam, 1);
		at[y] = s.T;
	}
	// Abrupt doubling: about 60% within a decade, still short of 3 °C after a century.
	expect(at[10] / 3).toBeGreaterThan(0.5);
	expect(at[10] / 3).toBeLessThan(0.75);
	expect(at[100]).toBeLessThan(2.8);
	expect(at[1000]).toBeGreaterThan(2.95);
});

test('the model gets the observed warming of 2011–2020', () => {
	const run = scenarioRun('ssp245');
	const w = periodMean(run, 2011, 2020);
	expect(w).toBeGreaterThan(OBSERVED_2011_2020[1]);
	expect(w).toBeLessThan(OBSERVED_2011_2020[2]);
	expect(Math.abs(w - OBSERVED_2011_2020[0])).toBeLessThan(0.05);
});

test('each scenario lands within 0.15 °C of AR6’s best estimates (SPM Table SPM.1)', () => {
	for (const { id } of SCENARIOS) {
		const run = scenarioRun(id);
		for (const p of ['mid', 'long'] as const) {
			const w = periodMean(run, PERIODS[p][0], PERIODS[p][1]);
			expect(Math.abs(w - SPM1[id][p][0]), `${id} ${p}: ${w.toFixed(2)}`).toBeLessThan(0.15);
		}
	}
});

test('the scenarios’ CO₂ emissions and concentrations are the published ones', () => {
	const at = (id: (typeof SCENARIOS)[number]['id'], year: number) =>
		scenarioRun(id).find((y) => y.year === year)!;
	// Meinshausen et al. (2020): 2100 concentrations.
	expect(at('ssp119', 2100).ppm).toBeCloseTo(394, -1);
	expect(at('ssp245', 2100).ppm).toBeCloseTo(603, -1);
	expect(at('ssp585', 2100).ppm).toBeCloseTo(1135, -1);
	// AR6 SPM D.1.2: 2,390 ± 240 GtCO₂ emitted 1850–2019.
	expect(Math.abs(at('ssp245', 2019).cumulative - 2390)).toBeLessThan(240);
	// SSP1-1.9 reaches net zero CO₂ around 2050 and goes negative (SPM footnote 25).
	expect(at('ssp119', 2045).emissions).toBeGreaterThan(0);
	expect(at('ssp119', 2060).emissions).toBeLessThan(0);
	expect(at('ssp585', 2080).emissions).toBeGreaterThan(120);
});

test('warming from CO₂ follows cumulative emissions at AR6’s TCRE', () => {
	for (const { id } of SCENARIOS) {
		const run = scenarioRun(id, ALL_FEEDBACKS, true);
		const y = run.find((r) => r.year === 2050)!;
		const perThousand = (y.T / y.cumulative) * 1000;
		expect(perThousand, id).toBeGreaterThan(TCRE[1]);
		expect(perThousand, id).toBeLessThan(TCRE[2]);
	}
});
