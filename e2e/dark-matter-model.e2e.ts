// Checks the dark-matter models against the real world: Newton's gravity
// (Earth's orbital speed), SPARC's measured rotation curves (no amount of
// stars fits them; a halo does), Planck's cosmic budget, and the Bullet
// Cluster's published masses and positions. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	GALAXIES,
	ML_DISK_DEFAULT,
	ML_MAX,
	ML_MIN,
	RATIO_MAX,
	bestHalo,
	bestVisibleOnly,
	speedAt,
	cosmicBudget,
	curve,
	fit,
	galaxy,
	haloMass,
	haloSpeed,
	keplerSpeed,
	periodGyr,
	visibleMass
} from '../src/routes/dark-matter/galaxies';
import {
	BRADAC,
	CLOWE,
	DARK_NEEDED,
	POSITIONS,
	blobs,
	kappaGrid,
	kpcPerArcsec,
	lookbackGyr,
	lensedShape,
	massInCircle,
	massInField,
	peak
} from '../src/routes/dark-matter/lensing';

const AU_KPC = 1.495978707e8 / 3.0856775814913e16;

test('Newton’s gravity in galaxy units: the Earth orbits the Sun at 29.8 km/s', () => {
	expect(keplerSpeed(1, AU_KPC)).toBeCloseTo(29.78, 1);
	// Kepler's fall-off: four times further out, half the speed.
	expect(keplerSpeed(1e10, 40) / keplerSpeed(1e10, 10)).toBeCloseTo(0.5, 10);
});

test('NGC 3198 stays flat at ~150 km/s out to 44 kpc, where its visible mass alone would give 57', () => {
	const g = galaxy('NGC3198');
	expect(g.rLast).toBeCloseTo(44.08, 2);
	const outer = g.points.filter((p) => p.r > 10);
	for (const p of outer) expect(Math.abs(p.v - 150)).toBeLessThan(10);
	const m = visibleMass(g, ML_DISK_DEFAULT).total;
	expect(m / 1e10).toBeCloseTo(3.36, 1);
	expect(keplerSpeed(m, g.rLast)).toBeCloseTo(57, 0);
	// An outer star takes about 1.8 billion years to go round once.
	expect(periodGyr(g.rLast, 149)).toBeCloseTo(1.82, 1);
});

test('no amount of stars fits any of the four galaxies without a halo', () => {
	for (const info of GALAXIES) {
		const g = galaxy(info.id);
		for (let ml = 0.1; ml <= 5; ml += 0.05) {
			expect(fit(g, ml, null).reduced, `${info.name} at Υ = ${ml.toFixed(2)}`).toBeGreaterThan(30);
		}
		// With SPARC's standard Υ the visible matter falls short at the last point.
		const last = curve(g, ML_DISK_DEFAULT, null).at(-1)!;
		expect(last.total).toBeLessThan(0.7 * g.points.at(-1)!.v);
	}
});

test('a dark halo of roughly five to eight times the visible mass fits each galaxy', () => {
	const ratios: Record<string, number> = {};
	for (const info of GALAXIES) {
		const g = galaxy(info.id);
		const h = bestHalo(g, ML_DISK_DEFAULT);
		const f = fit(g, ML_DISK_DEFAULT, h);
		// SPARC's error bars are random errors only, so the best fits are not at χ²/dof = 1.
		expect(f.reduced, info.name).toBeLessThan(info.id === 'NGC2403' ? 20 : 3);
		expect(f.rmsKms, info.name).toBeLessThan(7);
		ratios[info.id] = h.ratio;
		expect(h.ratio, info.name).toBeGreaterThan(4);
		expect(h.ratio, info.name).toBeLessThan(10);
		// The halo's mass inside the last point is exactly the ratio × the visible mass.
		expect(
			haloMass(g, h, ML_DISK_DEFAULT, g.rLast) / visibleMass(g, ML_DISK_DEFAULT).total
		).toBeCloseTo(h.ratio, 6);
	}
	expect(ratios.NGC3198).toBeCloseTo(5.6, 0);
});

test('“Find the best halo” always lands inside the halo-mass control, for any galaxy and Υ', () => {
	// The button writes its result into the slider, so the search may not go beyond it.
	for (const info of GALAXIES) {
		for (const ml of [ML_MIN, 0.3, ML_DISK_DEFAULT, ML_MAX]) {
			const h = bestHalo(galaxy(info.id), ml);
			expect(h.ratio, `${info.name} at Υ = ${ml}`).toBeLessThanOrEqual(RATIO_MAX);
		}
	}
});

test('a halo of zero mass scores the same as no halo', () => {
	const g = galaxy('NGC3198');
	expect(fit(g, ML_DISK_DEFAULT, { ratio: 0, core: 4 }).reduced).toBeCloseTo(
		fit(g, ML_DISK_DEFAULT, null).reduced,
		6
	);
});

test('the halo flattens the curve: solid-body rotation in its core, a constant speed far out', () => {
	const g = galaxy('NGC3198');
	const h = { ratio: 5, core: 2 };
	const v = (r: number) => haloSpeed(g, h, ML_DISK_DEFAULT, r);
	expect(v(0.04) / v(0.02)).toBeCloseTo(2, 2);
	expect(v(400) / v(200)).toBeCloseTo(1, 1);
});

test('Planck 2018: dark matter outweighs ordinary matter 5.4 to 1', () => {
	const b = cosmicBudget();
	expect(b.ratio).toBeCloseTo(5.36, 2);
	expect(b.ordinary).toBeCloseTo(0.049, 3);
	expect(b.dark).toBeCloseTo(0.264, 2);
	expect(b.ordinary + b.dark + b.darkEnergy).toBeCloseTo(1, 2);
});

test('the Bullet Cluster at z = 0.296: 4.413 kpc per arcsecond, galaxies 720 kpc apart, gas left behind', () => {
	expect(kpcPerArcsec()).toBeCloseTo(4.413, 3);
	const p = POSITIONS;
	expect(Math.hypot(p.subBCG.x - p.mainBCG.x, p.subBCG.y - p.mainBCG.y)).toBeCloseTo(720, -1);
	// The bullet's gas trails its galaxies by 0.73′ ≈ 190 kpc (Bradač et al. 2006, Table 3).
	expect(p.subBCG.x - p.subGas.x).toBeGreaterThan(170);
	expect(p.subBCG.x - p.subGas.x).toBeLessThan(210);
	// Both gas clouds sit between the two groups of galaxies.
	expect(p.mainGas.x).toBeGreaterThan(p.mainBCG.x);
	expect(p.subGas.x).toBeLessThan(p.subBCG.x);
});

test('the blob model reproduces the published masses, and Clowe’s gas mass at the main galaxies', () => {
	const bs = blobs(DARK_NEEDED);
	const p = POSITIONS;
	const gas = bs.filter((b) => b.kind === 'gas');
	expect(massInField(bs) / BRADAC.fieldTotal).toBeCloseTo(1, 2);
	expect(massInField(gas) / BRADAC.fieldGas).toBeCloseTo(1, 2);
	expect(massInCircle(bs, p.mainBCG.x, p.mainBCG.y, 250) / BRADAC.main250).toBeCloseTo(1, 1);
	expect(massInCircle(bs, p.subBCG.x, p.subBCG.y, 250) / BRADAC.sub250).toBeCloseTo(1, 1);
	// Not used to build the model: the gas within 100 kpc of the main galaxies,
	// 5.5 ± 0.6 × 10¹² M☉ in Clowe et al. Table 2.
	const atBCG = massInCircle(gas, p.mainBCG.x, p.mainBCG.y, 100);
	expect(Math.abs(atBCG - CLOWE.mainBCG.gas) / CLOWE.mainBCG.gas).toBeLessThan(0.2);
	// Dark ÷ visible in the field: about 5.3.
	expect(DARK_NEEDED / (BRADAC.fieldTotal - DARK_NEEDED)).toBeCloseTo(5.3, 1);
});

test('lensing by the visible matter alone peaks on the gas; the measured mass peaks on the galaxies', () => {
	const box = { x0: -800, x1: 800, y0: -450, y1: 450 };
	const p = POSITIONS;
	const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
		Math.hypot(a.x - b.x, a.y - b.y);
	const vis = peak(kappaGrid(blobs(0), box));
	expect(Math.min(d(vis, p.mainGas), d(vis, p.subGas))).toBeLessThan(
		Math.min(d(vis, p.mainBCG), d(vis, p.subBCG))
	);
	expect(vis.kappa).toBeLessThan(0.15);
	const all = peak(kappaGrid(blobs(DARK_NEEDED), box));
	expect(d(all, p.mainBCG)).toBeLessThan(40);
	expect(all.kappa).toBeGreaterThan(0.5);
});

test('a shear stretches a round galaxy across the line to the lens', () => {
	// Pure shear g = 0.2 along x (γ₁ < 0: lens to the left or right) → axis ratio 0.8/1.2, long axis vertical.
	const s = lensedShape({ x: 0, y: 0 }, { kappa: 0, g1: -0.2, g2: 0 });
	expect(s.q).toBeCloseTo(0.8 / 1.2, 6);
	expect(Math.abs(Math.cos(s.angle))).toBeLessThan(1e-6);
});

test('the numbers the narrative quotes', () => {
	const g = galaxy('NGC3198');
	const m = visibleMass(g, ML_DISK_DEFAULT);
	// 19 billion Suns of stars and 14 billion of gas, 45 million light years away.
	expect(m.stars / 1e9).toBeCloseTo(19, 0);
	expect(m.gas / 1e9).toBeCloseTo(14.5, 0);
	expect(g.distance * 3.2616).toBeCloseTo(45, 0);
	// The visible matter's speed peaks at about 100 km/s near 7 kpc.
	const vis = curve(g, ML_DISK_DEFAULT, null);
	const top = vis.reduce((a, b) => (b.total > a.total ? b : a));
	expect(top.total).toBeCloseTo(100, -1);
	expect(top.r).toBeGreaterThan(6);
	expect(top.r).toBeLessThan(8);
	// At the edge the visible matter gives 65 km/s; the stars there take 4.2 Gyr per turn.
	expect(speedAt(g, g.rLast, 'visible')).toBeCloseTo(65, 0);
	expect(periodGyr(g.rLast, 65)).toBeCloseTo(4.2, 1);
	// (149/57)² ≈ 7 times the visible mass.
	expect((149 / keplerSpeed(m.total, g.rLast)) ** 2).toBeCloseTo(6.8, 1);
	// Within the slider's range (Υ ≤ 1.2) the visible matter alone never beats χ²/dof ≈ 245.
	const bv = bestVisibleOnly(g);
	expect(bv.chi2 / (g.points.length - 1)).toBeCloseTo(245, -1);
	// NGC 2403's best halo misses by about 6 km/s on average, though χ² per point stays near 15.
	const g2403 = galaxy('NGC2403');
	const f2403 = fit(g2403, ML_DISK_DEFAULT, bestHalo(g2403, ML_DISK_DEFAULT));
	expect(f2403.rmsKms).toBeCloseTo(6, 0);
	expect(f2403.reduced).toBeCloseTo(15, -1);
	// The Hubble field of the Bullet Cluster, 1300 × 830 kpc, is 4.2 × 2.7 million light years.
	const MLY_PER_KPC = 3.2616e-3;
	expect(BRADAC.fieldKpc[0] * MLY_PER_KPC).toBeCloseTo(4.2, 1);
	expect(BRADAC.fieldKpc[1] * MLY_PER_KPC).toBeCloseTo(2.7, 1);
	// NGC 2403 has about a quarter of NGC 3198's stars.
	expect(visibleMass(galaxy('NGC2403'), 0.5).stars / m.stars).toBeCloseTo(0.26, 1);
	// The four halos weigh 5½–8 times their galaxies' visible matter.
	const ratios = GALAXIES.map((i) => bestHalo(galaxy(i.id), ML_DISK_DEFAULT).ratio);
	expect(Math.min(...ratios)).toBeGreaterThan(5.4);
	expect(Math.max(...ratios)).toBeLessThan(8.4);
	// The Bullet Cluster's light set out 3.4 billion years ago; its gas sits ~200 kpc from its galaxies.
	expect(lookbackGyr(0.296)).toBeCloseTo(3.4, 1);
	const p = POSITIONS;
	for (const [gas, gal] of [
		[p.mainGas, p.mainBCG],
		[p.subGas, p.subBCG]
	]) {
		const d = Math.hypot(gas.x - gal.x, gas.y - gal.y);
		expect(d).toBeGreaterThan(180);
		expect(d).toBeLessThan(220);
	}
});
