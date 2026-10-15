// Checks the cosmology behind the big-bang explainer: the Friedmann equation with the Planck 2018
// parameters, integrated numerically, against Planck's own derived numbers, textbook limiting
// cases and measurements. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	AGE,
	GYR_S,
	HORIZON,
	HUBBLE_DISTANCE,
	OMEGA_GAMMA,
	OMEGA_M,
	OMEGA_R,
	PLANCK,
	T0,
	acceleration,
	comovingMpc,
	composition,
	distances,
	heliumMassFraction,
	hubble,
	neutronsPerProton,
	pairsLeft,
	peakWavelength,
	redshiftSeen,
	reionized,
	scaleAt,
	T_ACC,
	T_DARK_ENERGY,
	T_FREEZE_S,
	T_NUC_S,
	temperature,
	timeAt
} from '../src/routes/big-bang/cosmology';

const Z_STAR = PLANCK.zStar;
const aStar = 1 / (1 + Z_STAR);
const tempAtSeconds = (s: number) => temperature(scaleAt(s / GYR_S));

test('photons today: Ω_γ h² ≈ 2.47 × 10⁻⁵ from the 2.7255 K background', () => {
	const h = PLANCK.H0 / 100;
	expect(OMEGA_GAMMA * h * h).toBeCloseTo(2.47e-5, 7);
});

test('the age of the universe is 13.8 billion years, as Planck finds', () => {
	expect(AGE).toBeGreaterThan(PLANCK.age - 0.03);
	expect(AGE).toBeLessThan(PLANCK.age + 0.03);
	expect(timeAt(1)).toBeCloseTo(AGE, 6);
});

test('the CMB was released at z ≈ 1090, about 370,000 years in, at about 2,970 K', () => {
	const years = timeAt(aStar) * 1e9;
	expect(years).toBeGreaterThan(360_000);
	expect(years).toBeLessThan(385_000);
	expect(temperature(aStar)).toBeCloseTo(T0 * (1 + Z_STAR), 3);
	expect(Math.round(temperature(aStar) / 10) * 10).toBe(2970);
});

test('the distance to the CMB matches Planck’s r*/θ* (13,870 Mpc, 45 billion light years)', () => {
	const planck = PLANCK.rStar / PLANCK.thetaStar;
	expect(Math.abs(comovingMpc(Z_STAR) / planck - 1)).toBeLessThan(0.003);
	expect(distances(Z_STAR).comoving).toBeCloseTo(45.2, 0);
});

test('matter overtook radiation at z ≈ 3,400, about 50,000 years in', () => {
	const zEq = OMEGA_M / OMEGA_R - 1;
	expect(Math.abs(zEq / PLANCK.zEq - 1)).toBeLessThan(0.01);
	const c = composition(1 / (1 + zEq));
	expect(c.matter).toBeCloseTo(c.radiation, 6);
	const years = timeAt(1 / (1 + zEq)) * 1e9;
	expect(years).toBeGreaterThan(45_000);
	expect(years).toBeLessThan(55_000);
});

test('temperature: 10 billion K after one second, a billion K after three minutes', () => {
	expect(tempAtSeconds(1) / 1e10).toBeCloseTo(1, 1);
	expect(tempAtSeconds(180) / 1e9).toBeCloseTo(1, 1);
	// After the e± annihilation the photons simply cool as 1/a.
	const a = 1e-6;
	expect(temperature(a)).toBeCloseTo(T0 / a, 0);
	// Before it, they are cooler than T0/a by (4/11)^⅓: the pairs later heat them.
	expect(temperature(1e-11) * 1e-11).toBeCloseTo(T0 * (4 / 11) ** (1 / 3), 2);
	expect(pairsLeft(1e11)).toBeCloseTo(1, 2);
	expect(pairsLeft(1e8)).toBeLessThan(1e-10);
});

test('limiting cases: a ∝ t^½ with radiation, t^⅔ with matter, Hubble’s law up close', () => {
	// radiation era (after the pairs are gone): doubling a quadruples t
	expect(timeAt(2e-7) / timeAt(1e-7)).toBeCloseTo(4, 2);
	// matter era: a × 2 → t × 2^1.5 (radiation and dark energy take ~1%)
	expect(timeAt(0.08) / timeAt(0.04)).toBeCloseTo(2 ** 1.5, 1);
	// small z: distance = cz / H0
	const z = 0.001;
	const czH = (299792.458 * z) / PLANCK.H0;
	expect(comovingMpc(z) / czH).toBeCloseTo(1, 3);
	expect(hubble(1)).toBe(PLANCK.H0);
});

test('distances: light-travel < then·(1+z) = now, and the observable universe is 46 Gly', () => {
	for (const z of [0.1, 1, 3, 14.18, Z_STAR]) {
		const d = distances(z);
		expect(d.lightTravel).toBeLessThan(d.comoving);
		expect(d.then * (1 + z)).toBeCloseTo(d.comoving, 6);
	}
	// JADES-GS-z14-0 at z = 14.18: light travelled 13.5 Gyr, the galaxy is now ~34 Gly away.
	const far = distances(14.18);
	expect(far.lightTravel).toBeCloseTo(13.5, 1);
	expect(far.comoving).toBeCloseTo(33.7, 0);
	// it was 2.2 Gly from us when its light left, about 290 million years in
	expect(far.then).toBeCloseTo(2.2, 1);
	expect(far.emitted * 1000).toBeCloseTo(290, -1);
	// the CMB's light set off 41 million light years from here
	expect(distances(Z_STAR).then * 1000).toBeCloseTo(41.5, 0);
	expect(HORIZON).toBeGreaterThan(45.5);
	expect(HORIZON).toBeLessThan(47);
	expect(HUBBLE_DISTANCE).toBeCloseTo(14.5, 1);
});

test('the redshift of a galaxy’s light gives back its distance', () => {
	for (const z of [0.05, 0.5, 2]) {
		expect(redshiftSeen(distances(z).comoving, 1)).toBeCloseTo(z, 3);
	}
	// light from beyond the horizon has not arrived yet
	expect(redshiftSeen(HORIZON + 1, 1)).toBe(Infinity);
});

test('the expansion started to speed up at z ≈ 0.63, about 6 billion years ago', () => {
	// With radiation negligible, ä = 0 where Ω_m a⁻³ = 2 Ω_Λ.
	const aAcc = (OMEGA_M / (2 * (1 - OMEGA_M))) ** (1 / 3);
	expect(acceleration(aAcc * 0.98)).toBeLessThan(0);
	expect(acceleration(aAcc * 1.02)).toBeGreaterThan(0);
	expect(1 / aAcc - 1).toBeCloseTo(0.63, 1);
	expect(AGE - timeAt(aAcc)).toBeCloseTo(6.1, 0);
	// the narrative: speeding up from 7.7 billion years, dark energy the largest share from 10.3
	expect(T_ACC).toBeCloseTo(7.7, 1);
	expect(T_DARK_ENERGY).toBeCloseTo(10.3, 1);
	// and light from z = 1 set off 7.95 billion years ago
	expect(AGE - timeAt(0.5)).toBeCloseTo(7.95, 2);
});

test('helium: neutrons freeze out at ~1 in 5, decay to ~1 in 7, ~25% of the mass (measured 24.5%)', () => {
	expect(T_FREEZE_S).toBeGreaterThan(0.5);
	expect(T_FREEZE_S).toBeLessThan(2);
	expect(T_NUC_S / 60).toBeGreaterThan(3);
	expect(T_NUC_S / 60).toBeLessThan(6);
	expect(1 / neutronsPerProton(T_FREEZE_S)).toBeCloseTo(5, 0);
	expect(1 / neutronsPerProton(T_NUC_S)).toBeCloseTo(7, 0);
	// later, bound in helium, the neutrons stop decaying
	expect(neutronsPerProton(1e6)).toBe(neutronsPerProton(T_NUC_S));
	// measured in pristine gas: 0.2449 ± 0.0040 (Aver et al. 2015, quoted in Planck 2018 VI)
	const Y = heliumMassFraction();
	expect(Math.abs(Y - 0.245)).toBeLessThan(0.001); // the page quotes 24.5%
});

test('the CMB’s light was stretched 1,091 times: from near-infrared to 1 mm microwaves', () => {
	expect(peakWavelength(T0) * 1e3).toBeCloseTo(1.063, 2);
	expect(peakWavelength(temperature(aStar)) * 1e9).toBeCloseTo(975, -1);
	expect(peakWavelength(T0) / peakWavelength(temperature(aStar))).toBeCloseTo(1 + Z_STAR, 3);
});

test('reionization: half the hydrogen ionized again at z = 7.67, about 670 million years in', () => {
	expect(reionized(PLANCK.zRe)).toBeCloseTo(0.5, 6);
	expect(reionized(20)).toBeLessThan(0.01);
	expect(reionized(5)).toBeGreaterThan(0.99);
	expect(timeAt(1 / (1 + PLANCK.zRe)) * 1000).toBeCloseTo(672, -1);
});
