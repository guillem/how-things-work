// Checks the models behind the ocean-currents explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BASIN,
	BASIN_HEIGHT,
	BETA,
	BOX,
	F_TODAY,
	FRICTION,
	JIN,
	MEAN_TILT,
	MU_TODAY,
	PACIFIC,
	RHO,
	SV,
	TRADES,
	WESTERLIES,
	collapseThreshold,
	coriolis,
	density,
	dSdt,
	ekmanTransport,
	ensoEigen,
	equilibria,
	flowAt,
	gyreExtremes,
	gyreStreamlines,
	heatTransport,
	latOf,
	overturning,
	pacificPicture,
	psiAt,
	restartThreshold,
	runEnso,
	runOverturning,
	seaLevelTilt,
	steadyPacific,
	stommel,
	stressAt,
	thermoclineTilt,
	westEastSpeeds,
	windStress
} from '../src/routes/ocean-currents/ocean';

const WINDS = { trades: TRADES, westerlies: WESTERLIES };
const yOf = (lat: number) => ((lat - BASIN.lat0) / (BASIN.lat1 - BASIN.lat0)) * BASIN_HEIGHT;

test('wind stress and Ekman transport: to the right of the wind, converging near 30°N', () => {
	// bulk formula: 7 m/s → 1.2 × 1.3e-3 × 49 ≈ 0.076 N/m²
	expect(windStress(7)).toBeCloseTo(0.0764, 4);
	expect(stressAt(WINDS, 15)).toBeLessThan(0); // trades blow westward
	expect(stressAt(WINDS, 45)).toBeGreaterThan(0); // westerlies eastward
	// Ekman transport τ/(ρf), 90° to the right: northward under the trades, southward under the westerlies
	expect(ekmanTransport(WINDS, 15)).toBeCloseTo(-stressAt(WINDS, 15) / (RHO * coriolis(15)), 10);
	expect(ekmanTransport(WINDS, 15)).toBeGreaterThan(1);
	expect(ekmanTransport(WINDS, 45)).toBeLessThan(-1);
	// the sign change (convergence: water piles up) is near 30°N
	let cross = 0;
	for (let lat = 16; lat < 50; lat += 0.1) {
		if (ekmanTransport(WINDS, lat) > 0 && ekmanTransport(WINDS, lat + 0.1) <= 0) cross = lat;
	}
	expect(cross).toBeGreaterThan(27);
	expect(cross).toBeLessThan(32);
	expect(coriolis(45)).toBeCloseTo(1.031e-4, 6);
});

test("Stommel's gyre satisfies r∇²ψ + βψₓ = curl τ/ρ and vanishes on the coasts", () => {
	const g = stommel(WINDS);
	const h = 2e3;
	for (const [x, lat] of [
		[50e3, 30],
		[300e3, 40],
		[3000e3, 25],
		[5000e3, 55]
	]) {
		const y = yOf(lat);
		const p = (dx: number, dy: number) => psiAt(g, x + dx, y + dy).psi;
		const lap = (p(h, 0) + p(-h, 0) + p(0, h) + p(0, -h) - 4 * p(0, 0)) / (h * h);
		const px = (p(h, 0) - p(-h, 0)) / (2 * h);
		const dl = 0.01;
		const curl =
			-((stressAt(WINDS, lat + dl) - stressAt(WINDS, lat - dl)) / (2 * dl)) /
			((Math.PI / 180) * 6.371e6) /
			RHO;
		const lhs = FRICTION * lap + BETA * px;
		expect(Math.abs(lhs - curl)).toBeLessThan(0.03 * Math.abs(curl) + 1e-12);
	}
	for (let lat = 16; lat < 65; lat += 7) {
		expect(Math.abs(psiAt(g, 0, yOf(lat)).psi)).toBeLessThan(0.01 * SV);
		expect(Math.abs(psiAt(g, BASIN.width, yOf(lat)).psi)).toBeLessThan(0.01 * SV);
	}
	for (let x = 0; x <= BASIN.width; x += 1e6) {
		expect(Math.abs(psiAt(g, x, 0).psi)).toBeLessThan(0.01 * SV);
		expect(Math.abs(psiAt(g, x, BASIN_HEIGHT).psi)).toBeLessThan(0.01 * SV);
	}
});

test('a clockwise warm gyre of about 20 Sv and an anticlockwise one north of it', () => {
	const g = stommel(WINDS);
	const { max, min } = gyreExtremes(g);
	expect(max.psi / SV).toBeGreaterThan(18);
	expect(max.psi / SV).toBeLessThan(22);
	expect(latOf(max.y)).toBeGreaterThan(28);
	expect(latOf(max.y)).toBeLessThan(38);
	expect(min.psi).toBeLessThan(-5 * SV);
	expect(latOf(min.y)).toBeGreaterThan(45);
	// clockwise: northward in the west, southward in the interior
	expect(flowAt(g, 50e3, max.y).v).toBeGreaterThan(0);
	expect(flowAt(g, 3000e3, max.y).v).toBeLessThan(0);
	// the border between the gyres lies under the strongest westerlies (45°N)
	let border = 0;
	for (let lat = 35; lat < 60; lat += 0.25) {
		if (psiAt(g, 1000e3, yOf(lat)).psi > 0 && psiAt(g, 1000e3, yOf(lat + 0.25)).psi <= 0)
			border = lat;
	}
	expect(Math.abs(border - 45)).toBeLessThan(2);
	// linear in the wind stress
	const doubled = stommel({ trades: TRADES * Math.SQRT2, westerlies: WESTERLIES * Math.SQRT2 });
	expect(gyreExtremes(doubled).max.psi / max.psi).toBeCloseTo(2, 2);
	// no wind, no gyre
	expect(gyreExtremes(stommel({ trades: 0, westerlies: 0 })).max.psi).toBe(0);
});

test('western intensification comes from β: > 40× faster in the west, symmetric without it', () => {
	const g = stommel(WINDS);
	const { max } = gyreExtremes(g);
	expect(max.x).toBeLessThan(600e3);
	const s = westEastSpeeds(g, max.y);
	expect(s.ratio).toBeGreaterThan(40);
	// the boundary current decays eastwards over about r/β = 100 km
	expect(FRICTION / BETA).toBeCloseTo(1e5, 0);
	const flat = stommel(WINDS, false);
	const m0 = gyreExtremes(flat).max;
	expect(Math.abs(m0.x - BASIN.width / 2)).toBeLessThan(250e3);
	for (const x of [500e3, 1500e3, 2500e3]) {
		const a = psiAt(flat, x, m0.y).psi;
		const b = psiAt(flat, BASIN.width - x, m0.y).psi;
		expect(Math.abs(a - b)).toBeLessThan(1e-6 * Math.abs(a) + 1);
	}
	expect(westEastSpeeds(flat, m0.y).ratio).toBeLessThan(1.1);
});

test('streamlines are closed lines of constant ψ', () => {
	const g = stommel(WINDS);
	const { max, min } = gyreExtremes(g);
	for (const centre of [max, min]) {
		for (const s of gyreStreamlines(g, centre)) {
			for (let i = 0; i < s.x.length; i += 7) {
				expect(Math.abs(psiAt(g, s.x[i], s.y[i]).psi - s.level)).toBeLessThan(
					0.03 * Math.abs(centre.psi)
				);
			}
			expect(s.x.length).toBeGreaterThan(20);
			expect(s.time.at(-1)!).toBeGreaterThan(0);
		}
	}
});

test('box model: calibrated to 17 Sv and 1.4 PW today, colder or saltier north sinks harder', () => {
	const eq = equilibria(BOX.Tpole0, 1);
	expect(eq[0].stable).toBe(true);
	expect(eq[0].q / SV).toBeCloseTo(17, 6);
	expect(eq[0].dS).toBeCloseTo(1, 6);
	expect(dSdt(1, BOX.Tpole0, 1)).toBeCloseTo(0, 15);
	expect(heatTransport(BOX.Tpole0, eq[0].q) / 1e15).toBeCloseTo(1.39, 2);
	// polar water (5 °C, 34.5) is denser than tropical (25 °C, 35.5)
	expect(density(5, 34.5)).toBeGreaterThan(density(25, 35.5) + 2);
	expect(density(11, 35) - density(10, 35)).toBeCloseTo(-0.175, 3);
	expect(density(10, 36) - density(10, 35)).toBeCloseTo(0.78, 2);
	// warmer north → weaker; fresher north (bigger salinity contrast) → weaker
	expect(overturning(8, 1)).toBeLessThan(overturning(5, 1));
	expect(overturning(5, 1.5)).toBeLessThan(overturning(5, 1));
	expect(equilibria(-2, 1)[0].q).toBeGreaterThan(eq[0].q);
	expect(F_TODAY / SV).toBeCloseTo(0.6, 6);
});

test('box model: a tipping point near 1.6× today and hysteresis down to 0.85×', () => {
	expect(collapseThreshold(BOX.Tpole0)).toBeCloseTo(1.63, 2);
	expect(restartThreshold(BOX.Tpole0)).toBeCloseTo(0.85, 2);
	// two stable states in between, one outside
	const both = equilibria(BOX.Tpole0, 1).filter((e) => e.stable);
	expect(both.length).toBe(2);
	expect(both[1].q).toBeLessThan(0);
	expect(equilibria(BOX.Tpole0, 1.7).filter((e) => e.stable).length).toBe(1);
	expect(equilibria(BOX.Tpole0, 1.7)[0].q).toBeLessThan(0);
	expect(equilibria(BOX.Tpole0, 0.8).filter((e) => e.stable).length).toBe(1);
	expect(equilibria(BOX.Tpole0, 0.8)[0].q).toBeGreaterThan(0);
	// stability: dΔS/dt pushes back towards stable states, away from the unstable one
	for (const e of equilibria(BOX.Tpole0, 1)) {
		const slope = (dSdt(e.dS + 1e-4, BOX.Tpole0, 1) - dSdt(e.dS - 1e-4, BOX.Tpole0, 1)) / 2e-4;
		expect(slope < 0).toBe(e.stable);
	}
	// time runs: 2× fresh water collapses it within a thousand years …
	const collapse = runOverturning(1, BOX.Tpole0, 2, 1000);
	expect(collapse.q.at(-1)! / SV).toBeLessThan(-3);
	// … back at today's it stays collapsed …
	const stays = runOverturning(collapse.dS.at(-1)!, BOX.Tpole0, 1, 1000);
	expect(stays.q.at(-1)!).toBeLessThan(0);
	// … and at half today's it restarts
	const restart = runOverturning(collapse.dS.at(-1)!, BOX.Tpole0, 0.5, 1000);
	expect(restart.q.at(-1)! / SV).toBeGreaterThan(15);
	// unchanged at today's settings
	const today = runOverturning(1, BOX.Tpole0, 1, 500);
	expect(today.q.at(-1)! / SV).toBeCloseTo(17, 6);
});

test('Pacific mean state: a thermocline 190 m deep in the west, 50 m in the east, sea ½ m higher', () => {
	expect(thermoclineTilt(PACIFIC.trades)).toBeCloseTo(146.3, 1);
	expect(seaLevelTilt(thermoclineTilt(PACIFIC.trades))).toBeCloseTo(0.6, 1);
	const normal = pacificPicture(steadyPacific(1));
	expect(normal.westDepth).toBeCloseTo(193, 0);
	expect(normal.eastDepth).toBeCloseTo(47, 0);
	expect(normal.eastSST).toBe(PACIFIC.eastSST);
	expect(normal.trades).toBeCloseTo(1, 10);
	// no trades: a flat thermocline, a warmer east
	const calm = pacificPicture(steadyPacific(0));
	expect(calm.westDepth - calm.eastDepth).toBeCloseTo(0, 8);
	expect(calm.eastSST).toBeGreaterThan(PACIFIC.eastSST + 2);
	// stronger trades: colder east
	expect(pacificPicture(steadyPacific(1.5)).eastSST).toBeLessThan(PACIFIC.eastSST - 1);
	expect(MEAN_TILT).toBeCloseTo(0.976, 3);
});

test("Jin's recharge oscillator: neutral at μ = 2/3, a damped ~3-year cycle at today's μ", () => {
	expect(ensoEigen(2 / 3).growth).toBeCloseTo(0, 10);
	const today = ensoEigen(MU_TODAY);
	expect(today.growth).toBeLessThan(0);
	const years = (today.period * JIN.months) / 12;
	expect(years).toBeGreaterThan(3);
	expect(years).toBeLessThan(3.5);
	// a 30% lull for six months: El Niño of well over 2 °C, then La Niña
	const run = runEnso(MU_TODAY, 0.3 * MEAN_TILT);
	const T = Array.from(run.T, (v) => v * JIN.degrees);
	const peak = Math.max(...T);
	const iPeak = T.indexOf(peak);
	expect(peak).toBeGreaterThan(2);
	expect(peak).toBeLessThan(3.5);
	const after = T.slice(iPeak);
	const trough = Math.min(...after);
	expect(trough).toBeLessThan(-1);
	const iTrough = iPeak + after.indexOf(trough);
	const monthsApart = (iTrough - iPeak) * run.dt * JIN.months;
	expect(monthsApart).toBeGreaterThan(12);
	expect(monthsApart).toBeLessThan(24);
	// without the feedback: a small warming that dies as soon as the lull ends
	const off = Array.from(runEnso(0, 0.3 * MEAN_TILT).T, (v) => v * JIN.degrees);
	expect(Math.max(...off)).toBeLessThan(peak / 2);
	expect(Math.min(...off)).toBeGreaterThan(-0.5);
	// the recharge: the western thermocline shoals (heat drains) during El Niño
	expect(Math.min(...Array.from(run.h))).toBeLessThan(0);
});
