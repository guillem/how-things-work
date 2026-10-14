// Checks the gravitational-wave model behind the explainer against known results:
// the quadrupole formula, the leading-order inspiral, fits to numerical relativity,
// and the chirp mass read off the real GW150914 data. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	AU,
	G,
	GM_EARTH,
	GW150914,
	HULSE_TAYLOR,
	M_SUN,
	MPC,
	PROTON_RADIUS,
	armDifference,
	chirpMass,
	chirpMassFrom,
	chirpRate,
	cycles,
	finalMass,
	finalSpin,
	fitChirpMass,
	frequencyAt,
	gwFrequency,
	inspiral,
	iscoFrequency,
	massesFor,
	minTotalMass,
	periodDecay,
	radiatedMass,
	radiatedPower,
	ringdown,
	separation,
	strain,
	timeToMerger
} from '../src/routes/gravitational-waves/gw';
import {
	combined,
	hanfordAligned,
	livingston,
	measuredTrack
} from '../src/routes/gravitational-waves/signal';

test('the Earth radiates about 200 W of gravitational waves as it orbits the Sun', () => {
	const p = radiatedPower(M_SUN, GM_EARTH / G, AU, 0.0167);
	expect(p).toBeGreaterThan(190);
	expect(p).toBeLessThan(205);
});

test('the Hulse–Taylor pulsar’s orbit shrinks at the rate general relativity predicts', () => {
	const { pulsar, companion, period, e, predicted } = HULSE_TAYLOR;
	const pdot = periodDecay(pulsar, companion, period, e);
	expect(pdot / predicted).toBeCloseTo(1, 3); // Weisberg & Huang 2016: −2.40263 × 10⁻¹²
	// about 76 µs shorter every year
	expect(-pdot * 365.25 * 86400 * 1e6).toBeCloseTo(75.8, 0);
});

test('the gravitational-wave frequency is twice the orbital frequency', () => {
	const a = separation(65, 100);
	const orbital = Math.sqrt((65 * M_SUN * G) / a ** 3) / (2 * Math.PI);
	expect(gwFrequency(65, a) / orbital).toBeCloseTo(2, 10);
});

test('the chirp mass alone sets the inspiral: same chirp mass, same frequency track', () => {
	const [a1, a2] = massesFor(28, 1);
	const [b1, b2] = massesFor(28, 0.3);
	expect(chirpMass(a1, a2)).toBeCloseTo(28, 10);
	expect(chirpMass(b1, b2)).toBeCloseTo(28, 10);
	for (const tau of [1, 0.1, 0.01]) {
		expect(frequencyAt(tau, chirpMass(a1, a2))).toBeCloseTo(frequencyAt(tau, chirpMass(b1, b2)), 8);
	}
	expect(minTotalMass(28)).toBeCloseTo(a1 + a2, 8);
});

test('df/dt grows as f^(11/3), and inverting it recovers the chirp mass', () => {
	expect(chirpRate(200, 30) / chirpRate(100, 30)).toBeCloseTo(2 ** (11 / 3), 8);
	expect(chirpMassFrom(120, chirpRate(120, 30))).toBeCloseTo(30, 8);
	// consistent with f(τ): df/dt = −df/dτ
	const tau = 0.05;
	const d = 1e-6;
	const fdot = (frequencyAt(tau - d, 30) - frequencyAt(tau + d, 30)) / (2 * d);
	expect(fdot / chirpRate(frequencyAt(tau, 30), 30)).toBeCloseTo(1, 5);
});

test('GW150914: about 0.17 s and 10 cycles from 35 Hz to the end, at leading order', () => {
	// the paper: "over 0.2 s, the signal increases in frequency and amplitude in about 8 cycles from 35 to 150 Hz"
	expect(timeToMerger(35, GW150914.chirpMassDetector)).toBeCloseTo(0.17, 2);
	expect(cycles(35, 150, GW150914.chirpMassDetector)).toBeGreaterThan(7);
	expect(cycles(35, 150, GW150914.chirpMassDetector)).toBeLessThan(10);
});

test('GW170817: two neutron stars sweep up from 24 Hz for about 100 s, thousands of cycles', () => {
	// detector-frame chirp mass 1.188 M☉ (Abbott et al. 2017, PRL 119, 161101): "~100 s"
	expect(timeToMerger(24, 1.188)).toBeGreaterThan(95);
	expect(timeToMerger(24, 1.188)).toBeLessThan(105);
	expect(cycles(24, 2000, 1.188)).toBeGreaterThan(3000);
});

test('the innermost stable orbit: 4400 Hz divided by the total mass in suns', () => {
	expect(iscoFrequency(1)).toBeCloseTo(4397, 0);
	expect(iscoFrequency(65)).toBeCloseTo(67.6, 1);
	// and it lies 6 GM/c² apart, where the orbital speed is c/√6
	const ins = inspiral(36, 29);
	expect(ins.separation(0) / (6 * 65 * 1476.6)).toBeCloseTo(1, 3);
	expect(ins.frequency(-1)).toBeLessThan(ins.frequency(-0.1));
	expect(ins.frequency(0)).toBeCloseTo(ins.fIsco, 8);
});

test('at 75 Hz orbital frequency, 70 suns are only 350 km apart: only black holes fit', () => {
	const a = separation(70, 150);
	expect(a / 1000).toBeCloseTo(347, 0);
	// two black holes of 35 suns have horizons 103 km across each: they nearly touch
	expect(a).toBeLessThan(4 * 2 * 35 * 1476.6);
});

test('the strain falls as 1/distance; GW150914 face-on and overhead would reach ~2×10⁻²¹', () => {
	expect(strain(100, 30, 100 * MPC) / strain(100, 30, 200 * MPC)).toBeCloseTo(2, 10);
	const h = strain(150, GW150914.chirpMassDetector, GW150914.distance * MPC);
	expect(h).toBeGreaterThan(2e-21);
	expect(h).toBeLessThan(2.6e-21);
	// the measured peak, 1.0 × 10⁻²¹, is smaller: the source was tilted and not overhead
	expect(GW150914.peakStrain).toBeLessThan(h);
});

test('the remnant of 36 + 29 suns: about 62 suns, spin 0.68, 3 suns radiated, ringing at 250 Hz', () => {
	expect(finalMass(36, 29)).toBeCloseTo(62, 0);
	expect(radiatedMass(36, 29)).toBeGreaterThan(2.5);
	expect(radiatedMass(36, 29)).toBeLessThan(3.5);
	expect(finalSpin(36, 29)).toBeGreaterThan(0.6);
	expect(finalSpin(36, 29)).toBeLessThan(0.72);
	// as seen at Earth (redshift 0.09): about 250 Hz, damped in 4 ms
	const r = ringdown(finalMass(36, 29) * (1 + GW150914.z), finalSpin(36, 29));
	expect(r.f).toBeGreaterThan(240);
	expect(r.f).toBeLessThan(265);
	expect(r.tau * 1000).toBeCloseTo(4, 0);
	// a test particle falling into a big hole radiates only the ISCO binding energy, 5.7% of its mass
	expect(radiatedMass(1000, 0.001) / 0.001).toBeCloseTo(1 - Math.sqrt(8 / 9), 2);
});

test('a strain of 10⁻²¹ changes 4 km arms by 4 × 10⁻¹⁸ m, about 1/400 of a proton', () => {
	const dl = armDifference(1e-21);
	expect(dl).toBeCloseTo(4e-18, 19);
	const protons = dl / (2 * PROTON_RADIUS);
	expect(1 / protons).toBeGreaterThan(400);
	expect(1 / protons).toBeLessThan(440);
});

test('in the real data, Hanford shifted by 6.9 ms and flipped lines up with Livingston', () => {
	const corr = (a: readonly number[], b: readonly number[]) => {
		let ab = 0;
		let aa = 0;
		let bb = 0;
		for (let i = 0; i < a.length; i++) {
			if (Number.isNaN(a[i]) || Number.isNaN(b[i])) continue;
			ab += a[i] * b[i];
			aa += a[i] ** 2;
			bb += b[i] ** 2;
		}
		return ab / Math.sqrt(aa * bb);
	};
	expect(corr(livingston, hanfordAligned)).toBeGreaterThan(0.6);
	expect(combined.length).toBe(livingston.length);
});

test('the frequency read off the data climbs from ~45 to ~140 Hz; leading order fits a chirp mass of ~36 suns', () => {
	expect(measuredTrack.length).toBeGreaterThanOrEqual(6);
	expect(measuredTrack[0].f).toBeLessThan(60);
	expect(measuredTrack[measuredTrack.length - 1].f).toBeGreaterThan(120);
	const fit = fitChirpMass(measuredTrack);
	// leading order runs high: the full analysis gives 30 (detector frame)
	expect(fit.mc).toBeGreaterThan(30);
	expect(fit.mc).toBeLessThan(40);
	expect(fit.rms).toBeLessThan(0.15);
});
