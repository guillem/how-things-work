// Checks the laser page's rate-equation model against known results: a two-level medium can't be
// inverted by steady pumping; a four-level one inverts at any pump and a three-level one only past
// half its atoms; above threshold the inversion clamps and the output grows linearly, by one
// photon per extra pumped atom less the internal loss's share; the relaxation oscillations ring
// at the linearised frequency; and a Q-switched pulse obeys Wagner and Lengyel's energy relation.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	INTERNAL_LOSS,
	N_ATOMS,
	PHOTON_J,
	PUMP_PHOTON_J,
	TAU,
	coupling,
	energyBetween,
	indexAt,
	mediumOnly,
	peaks,
	photonLifetime,
	pulseWidth,
	pumpRate,
	qSwitchTheory,
	relaxation,
	roundTripGain,
	run,
	steadyState,
	thresholdInversion,
	thresholdPump
} from '../src/routes/lasers/laser';

const R = 0.95;
const four = { medium: 'four' as const, R };

test('a two-level medium pumped ever harder saturates at equal populations, never inverted', () => {
	let last = 0;
	for (let lw = -4; lw <= 6; lw += 0.5) {
		const W = 10 ** lw / TAU;
		const m = mediumOnly('two', W);
		expect(m.n2 / N_ATOMS).toBeLessThan(0.5);
		expect(m.n2).toBeGreaterThan(last); // more pump, more excited atoms…
		expect(roundTripGain(m.dn)).toBeLessThan(1); // …but light is still absorbed
		last = m.n2;
		// with mirrors, it never lases either: a few spontaneous photons at most
		expect(steadyState({ medium: 'two', R }, W).q).toBeLessThan(1e4);
	}
	expect(last / N_ATOMS).toBeGreaterThan(0.4999);
});

test('a four-level medium inverts at any pump; a three-level one only past half its atoms', () => {
	for (const lw of [-4, -2, 0, 2]) expect(mediumOnly('four', 10 ** lw / TAU).dn).toBeGreaterThan(0);
	expect(mediumOnly('three', 0.9 / TAU).dn).toBeLessThan(0);
	expect(mediumOnly('three', 1.1 / TAU).dn).toBeGreaterThan(0);
	// the same atoms in a three-level scheme need about N/(2·N_th) times the four-level pump
	const nth = thresholdInversion(R);
	const threeAt = (W: number) => steadyState({ medium: 'three', R }, W).q > 1e6;
	let lo = 0.5 / TAU;
	let hi = 10 / TAU;
	for (let i = 0; i < 60; i++) {
		const mid = Math.sqrt(lo * hi);
		if (threeAt(mid)) hi = mid;
		else lo = mid;
	}
	const threePump = hi * (N_ATOMS / 2) * PUMP_PHOTON_J; // half the atoms left to absorb
	const ratio = threePump / thresholdPump(R);
	expect(ratio / (N_ATOMS / (2 * nth))).toBeGreaterThan(0.9);
	expect(ratio / (N_ATOMS / (2 * nth))).toBeLessThan(1.1);
});

test('below threshold the mode holds a few photons; above it the inversion clamps', () => {
	const Pth = thresholdPump(R);
	expect(Pth).toBeGreaterThan(0.5); // about a watt for this small Nd:YAG laser
	expect(Pth).toBeLessThan(2);
	const half = steadyState(four, pumpRate(0.5 * Pth));
	expect(half.q).toBeGreaterThan(0.5);
	expect(half.q).toBeLessThan(3);
	expect(steadyState(four, pumpRate(0.9 * Pth)).q).toBeLessThan(20);
	const above = steadyState(four, pumpRate(1.5 * Pth));
	expect(above.q).toBeGreaterThan(1e9);
	const nth = thresholdInversion(R);
	for (const r of [1.1, 2, 5]) {
		const s = steadyState(four, pumpRate(r * Pth));
		expect(Math.abs(s.dn / nth - 1)).toBeLessThan(1e-3);
	}
});

test('above threshold every extra pumped atom adds a photon; the mirror lets out its share', () => {
	const Pth = thresholdPump(R);
	const pts = [1.5, 2, 4, 6, 8].map((r) => {
		const s = steadyState(four, pumpRate(r * Pth));
		const pumped = (r * Pth) / PUMP_PHOTON_J; // atoms raised per second
		const out = s.out / PHOTON_J; // photons leaving through the mirror per second
		return [pumped, out];
	});
	// straight line: the slope is the same between every pair of points
	const slopes = pts.slice(1).map(([x, y], i) => (y - pts[i][1]) / (x - pts[i][0]));
	for (const s of slopes) expect(Math.abs(s / slopes[0] - 1)).toBeLessThan(1e-3);
	// one photon per extra atom, of which the output mirror gets −ln R out of −ln R + L
	const share = coupling(R) / (coupling(R) + INTERNAL_LOSS);
	expect(slopes[0] / share).toBeGreaterThan(0.999);
	expect(slopes[0] / share).toBeLessThan(1.001);
	// output power extrapolates to zero at the threshold pump
	const [x1, y1] = pts[0];
	expect(Math.abs((x1 - y1 / slopes[0]) * PUMP_PHOTON_J - Pth) / Pth).toBeLessThan(1e-3);
});

test('a leakier output mirror raises the threshold, and the output peaks at an optimum', () => {
	expect(thresholdPump(0.8)).toBeGreaterThan(thresholdPump(0.95));
	expect(thresholdPump(0.95)).toBeGreaterThan(thresholdPump(0.99));
	const outAt = (r: number) => steadyState({ medium: 'four', R: r }, pumpRate(5)).out;
	const rs = Array.from({ length: 60 }, (_, i) => 0.7 + i * 0.005);
	const outs = rs.map(outAt);
	const best = outs.indexOf(Math.max(...outs));
	expect(best).toBeGreaterThan(0);
	expect(best).toBeLessThan(rs.length - 1);
	expect(outAt(0.999)).toBeLessThan(outs[best] / 2); // almost nothing gets out
});

test('switched on, the laser spikes and rings down at the relaxation frequency', () => {
	const pump = 3;
	const r = pump / thresholdPump(R);
	const tr = run({ R, pump, until: 1.6e-3 });
	// the first spike overshoots the steady output several times over
	const cw = steadyState(four, pumpRate(pump)).out;
	expect(peaks(tr)[0].out).toBeGreaterThan(5 * cw);
	// late, small oscillations: period from successive peaks against the linearised value
	const late = peaks(tr, 1.2e-3);
	const period = (late[late.length - 1].t - late[0].t) / (late.length - 1);
	const theory = relaxation(R, r);
	expect(Math.abs(period * theory.freq - 1)).toBeLessThan(0.03);
	// and they decay at r/(2τ): compare the swing of two late peaks
	const swing = (t: number) => {
		const i = indexAt(tr, t);
		return tr.out[i] - cw;
	};
	const a = late[0];
	const b = late[late.length - 1];
	const rate = Math.log(swing(a.t) / swing(b.t)) / (b.t - a.t);
	expect(Math.abs(rate / theory.decay - 1)).toBeLessThan(0.1);
	expect(Math.abs(tr.out[tr.out.length - 1] / cw - 1)).toBeLessThan(0.05);
});

test('a Q-switched pulse: kilowatts for nanoseconds, and Wagner–Lengyel’s energy', () => {
	const openAt = 600e-6;
	const tr = run({ R, pump: 5, openAt, until: openAt + 2e-6 });
	const nth = thresholdInversion(R);
	const ni = tr.n2[indexAt(tr, openAt)];
	expect(ni / nth).toBeGreaterThan(3); // stored far above threshold while the shutter was shut
	const theory = qSwitchTheory(ni, nth);
	expect(Math.abs(tr.peak.q / theory.qPeak - 1)).toBeLessThan(0.01);
	let nf = Infinity;
	for (let i = indexAt(tr, openAt); i < tr.t.length; i++) nf = Math.min(nf, tr.n2[i]);
	expect(Math.abs(nf / theory.nf - 1)).toBeLessThan(0.05);
	// every inverted atom used gives one photon; the mirror's share leaves as the pulse
	const share = coupling(R) / (coupling(R) + INTERNAL_LOSS);
	const energy = energyBetween(tr, openAt, openAt + 2e-6);
	expect(Math.abs(energy / ((ni - nf) * PHOTON_J * share) - 1)).toBeLessThan(0.02);
	// the peak is ten thousand times the continuous output, a few tens of photon lifetimes long
	expect(tr.peak.out / steadyState(four, pumpRate(5)).out).toBeGreaterThan(5000);
	const w = pulseWidth(tr);
	expect(w).toBeGreaterThan(photonLifetime(R));
	expect(w).toBeLessThan(10 * photonLifetime(R));
});
