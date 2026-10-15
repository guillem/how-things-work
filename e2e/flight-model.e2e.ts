// Checks the flight model behind the explainer against known results: exact ideal flow
// round a Joukowski section, thin-airfoil theory, the measured NACA 0012, the standard
// atmosphere and the Cessna 172S handbook. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	DEG,
	THIN_SLOPE,
	flow,
	integratedForce,
	liftCoefficient,
	measuredDrag,
	measuredLift,
	measuredSlope,
	naca4ZeroLift,
	pressureCells,
	section,
	streamline,
	surfacePressure,
	trailingFlowAngle,
	transit,
	zeroLiftAngle
} from '../src/routes/flight/aero';
import { LADSON } from '../src/routes/flight/naca0012';
import {
	ALPHA_L0,
	ASPECT,
	C172,
	CD0,
	CHORD,
	CL_MAX,
	FT,
	GLIDE_RATIO,
	KT,
	MIN_DRAG_SPEED,
	OSWALD,
	RHO0,
	WEIGHT,
	WING_SLOPE,
	angleFor,
	clNeeded,
	dynamicPressure,
	atmosphere,
	density,
	drag,
	lift,
	stallSpeed,
	steady
} from '../src/routes/flight/plane';
import { US76 } from '../src/routes/rockets/us76';

const close = (a: number, b: number, rel: number) =>
	expect(Math.abs(a - b)).toBeLessThan(rel * Math.abs(b));

test('the section has the thickness and camber asked for, and a sharp trailing edge', () => {
	for (const [t, c] of [
		[0.12, 0],
		[0.12, 0.02],
		[0.06, 0.05],
		[0.18, 0.03]
	]) {
		const s = section(t, c);
		close(s.thickness, t, 0.01);
		if (c) close(s.camber, c, 0.01);
		else expect(s.camber).toBeLessThan(1e-6);
		expect(s.te).toEqual([2, 0]);
	}
});

test('ideal flow: Kutta–Joukowski lift from the surface pressure, and no drag (d’Alembert)', () => {
	for (const [t, c, a] of [
		[0.12, 0, 5],
		[0.12, 0.02, 8],
		[0.06, 0.04, -2]
	]) {
		const f = flow(section(t, c), a * DEG);
		const F = integratedForce(f);
		close(F.cl, f.cl, 0.005);
		expect(Math.abs(F.cd)).toBeLessThan(0.002);
	}
});

test('the Kutta condition: the air leaves the trailing edge smoothly, with equal pressure above and below', () => {
	const f = flow(section(0.12, 0.02), 6 * DEG);
	const pts = surfacePressure(f, 400);
	// the points next to the trailing edge on either side
	close(pts[0].cp, pts[pts.length - 1].cp, 0.05);
	// and leaves it heading downwards
	expect(trailingFlowAngle(f)).toBeLessThan(0);
});

test('thin-airfoil theory: lift slope 2π per radian, 0.11 per degree', () => {
	expect(THIN_SLOPE * DEG).toBeCloseTo(0.1097, 4);
	// a very thin flat section: c_l = 2π sin α exactly
	const flat = section(0.002, 0);
	close(liftCoefficient(flat, 6 * DEG), 2 * Math.PI * Math.sin(6 * DEG), 0.003);
});

test('thickness raises the ideal slope: a 12% section about 10% above 2π', () => {
	const s = section(0.12, 0);
	const slope = (liftCoefficient(s, 2 * DEG) - liftCoefficient(s, -2 * DEG)) / (4 * DEG);
	expect(slope / THIN_SLOPE).toBeGreaterThan(1.08);
	expect(slope / THIN_SLOPE).toBeLessThan(1.11);
	expect(slope * DEG).toBeCloseTo(0.12, 2);
});

test('camber makes lift at zero angle; a symmetric section makes none', () => {
	expect(liftCoefficient(section(0.12, 0), 0)).toBeCloseTo(0, 10);
	const cambered = section(0.12, 0.02);
	expect(liftCoefficient(cambered, 0)).toBeGreaterThan(0.25);
	expect(zeroLiftAngle(cambered) / DEG).toBeCloseTo(-2.3, 1);
	expect(liftCoefficient(cambered, zeroLiftAngle(cambered))).toBeCloseTo(0, 10);
	// thin-airfoil theory for the NACA 2412 (2% camber at 40% of the chord)
	expect(naca4ZeroLift(0.02, 0.4) / DEG).toBeCloseTo(-2.08, 2);
});

test('lower pressure above the wing than below it', () => {
	const f = flow(section(0.12, 0.02), 4 * DEG);
	const pts = surfacePressure(f, 200);
	const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
	const top = mean(pts.filter((p) => p.upper).map((p) => p.cp));
	const bottom = mean(pts.filter((p) => !p.upper).map((p) => p.cp));
	expect(top).toBeLessThan(-0.3);
	expect(bottom).toBeGreaterThan(top + 0.3);
	// the field: the lowest pressure lies above the section
	const cells = pressureCells(f);
	const lowest = cells.reduce((a, b) => (b.cp < a.cp ? b : a));
	expect(lowest.quad[0][1]).toBeGreaterThan(0);
});

test('no equal transit time: the air over the top reaches the trailing edge first', () => {
	for (const [t, c, a] of [
		[0.12, 0, 4],
		[0.12, 0.02, 0],
		[0.12, 0.02, 8],
		[0.06, 0.05, 2]
	]) {
		const r = transit(flow(section(t, c), a * DEG));
		expect(r.tTop).toBeLessThan(r.tBottom * 0.95);
	}
	// with no lift the two arrive together
	const r = transit(flow(section(0.12, 0), 0));
	close(r.tTop, r.tBottom, 0.002);
	// and they never meet again: behind the wing the top parcel stays ahead
	const f = flow(section(0.12, 0.02), 5 * DEG);
	const top = streamline(f, 0.12);
	const bottom = streamline(f, -0.12);
	const k = Math.min(top.pts.length, bottom.pts.length) - 1;
	expect(top.pts[k][0]).toBeGreaterThan(bottom.pts[k][0] + 1);
});

test('the measured NACA 0012: slope a little under 2π, stall at 17°', () => {
	for (const run of LADSON) {
		const lin = run.rows.filter((r) => r[0] >= -4.5 && r[0] <= 10.5);
		const n = lin.length;
		const mx = lin.reduce((s, r) => s + r[0], 0) / n;
		const my = lin.reduce((s, r) => s + r[1], 0) / n;
		const slope =
			lin.reduce((s, r) => s + (r[0] - mx) * (r[1] - my), 0) /
			lin.reduce((s, r) => s + (r[0] - mx) ** 2, 0);
		expect(slope).toBeGreaterThan(0.1);
		expect(slope).toBeLessThan(THIN_SLOPE * DEG);
		const max = run.rows.reduce((a, b) => (b[1] > a[1] ? b : a));
		expect(max[0]).toBeGreaterThan(17);
		expect(max[0]).toBeLessThan(17.3);
		expect(max[1]).toBeGreaterThan(1.6);
		// a degree further and the lift has fallen by about a third
		const after = run.rows[run.rows.indexOf(max) + 1];
		expect(after[1] / max[1]).toBeLessThan(0.75);
		// and the drag has jumped more than sixfold
		expect(after[2] / max[2]).toBeGreaterThan(6);
	}
	expect(LADSON[0].rows.find((r) => r[0] === 17.13)?.[1]).toBe(1.6116);
	// the smallest section drag, under 0.01
	expect(Math.min(...LADSON[0].rows.map((r) => r[2]))).toBe(0.008);
});

test('the standard atmosphere matches the US 1976 tables, and thins with height', () => {
	expect(RHO0).toBeCloseTo(1.225, 4);
	for (const [km, p, rho] of US76.filter((r) => r[0] > 0 && r[0] <= 10)) {
		close(atmosphere(km * 1000).p, p, 0.001);
		close(atmosphere(km * 1000).rho, rho, 0.001);
	}
	expect(density(10000 * FT)).toBeCloseTo(0.905, 3);
	expect(density(10000 * FT) / RHO0).toBeCloseTo(0.74, 2);
});

test('the Cessna 172S: weight, wing, and the lift coefficient at the stall', () => {
	expect(WEIGHT / 1000).toBeCloseTo(11.34, 2);
	expect(C172.area).toBeCloseTo(16.17, 2);
	expect(ASPECT).toBeCloseTo(7.5, 1);
	expect(CHORD).toBeCloseTo(1.47, 2);
	// 53 KCAS at 2550 lb: the wing's maximum C_L
	expect(CL_MAX).toBeCloseTo(1.54, 2);
	// at 10 000 ft the same stall is a faster true airspeed
	expect(stallSpeed(10000 * FT) / KT).toBeCloseTo(61.7, 1);
	// lift = weight: at the stall, ½ρV²·S·C_Lmax carries the weight exactly
	close(lift(RHO0, 53 * KT, C172.area, CL_MAX), WEIGHT, 1e-9);
	// twice the speed, four times the lift
	close(lift(RHO0, 106 * KT, C172.area, 1), 4 * lift(RHO0, 53 * KT, C172.area, 1), 1e-9);
});

test('the drag polar fitted to the handbook glide', () => {
	expect(GLIDE_RATIO).toBeCloseTo(9.05, 2);
	expect(CD0).toBeCloseTo(0.051, 3);
	expect(OSWALD).toBeCloseTo(0.71, 2);
	expect(MIN_DRAG_SPEED / KT).toBeCloseTo(68.4, 1);
	const best = drag(RHO0, MIN_DRAG_SPEED);
	close(best.parasite, best.induced, 1e-9);
	close(WEIGHT / best.total, GLIDE_RATIO, 1e-9);
	// least drag in the middle: slower costs induced drag, faster parasite drag
	expect(drag(RHO0, 55 * KT).total).toBeGreaterThan(best.total);
	expect(drag(RHO0, 100 * KT).total).toBeGreaterThan(best.total);
	expect(drag(RHO0, 55 * KT).induced).toBeGreaterThan(drag(RHO0, 55 * KT).parasite);
	expect(drag(RHO0, 100 * KT).total).toBeCloseTo(1632, -1);
});

test('the wing: a shallower lift slope than its section, and angle of attack at the stall', () => {
	expect(ALPHA_L0 / DEG).toBeCloseTo(-2.08, 2);
	expect(WING_SLOPE * DEG).toBeCloseTo(0.087, 3);
});

test('thrust equal to drag holds level flight; more climbs, less descends', () => {
	const v = 100 * KT;
	const d = drag(RHO0, v).total;
	const level = steady(v, 0, d);
	expect(Math.abs(level.climb)).toBeLessThan(1e-6);
	expect(level.lift).toBeCloseTo(WEIGHT, 6);
	// rate of climb = excess thrust × speed / weight (small angles)
	const up = steady(v, 0, d + 500);
	close(up.climb, (500 * v) / WEIGHT, 0.01);
	expect(steady(v, 0, d - 500).climb).toBeLessThan(0);
	// too slow to carry the weight
	expect(steady(50 * KT, 0, 1500).stalled).toBe(true);
	expect(steady(55 * KT, 0, 1500).stalled).toBe(false);
	expect(steady(55 * KT, 10000 * FT, 1500).stalled).toBe(true);
});

test('the numbers the narrative quotes', () => {
	// measured slope of the NACA 0012, a little under 2π (0.110 per degree)
	expect(measuredSlope()).toBeCloseTo(0.107, 3);
	// the readouts interpolate the 80-grit run, mirrored for negative angles
	expect(measuredLift(17.13)).toBeCloseTo(1.61, 2);
	expect(measuredLift(-5)).toBeCloseTo(-measuredLift(5), 10);
	expect(measuredDrag(0)).toBeLessThan(0.0085);
	// ½ρV² at 100 kt at sea level
	expect(dynamicPressure(RHO0, 100 * KT)).toBeCloseTo(1621, 0);
	// lift coefficient needed at 100 and 60 kt, and the angle of attack at 100 kt
	expect(clNeeded(RHO0, 100 * KT)).toBeCloseTo(0.43, 2);
	expect(clNeeded(RHO0, 60 * KT)).toBeCloseTo(1.2, 1);
	expect(angleFor(clNeeded(RHO0, 100 * KT)) / DEG).toBeCloseTo(2.9, 1);
	// the least drag, about a ninth of the weight
	expect(drag(RHO0, MIN_DRAG_SPEED).total).toBeCloseTo(1253, -1);
	// air leaves the trailing edge of the 2%-cambered section 8° down at 5°
	expect(trailingFlowAngle(flow(section(0.12, 0.02), 5 * DEG)) / DEG).toBeCloseTo(-8, 0);
});
