// Checks the semiconductor model against measured silicon and the laws the page quotes.
// Runs in Node.
import { expect, test } from '@playwright/test';
import {
	GAPS,
	INTRINSIC,
	JUNCTION_DOPING,
	KT,
	NI_SI,
	N_SI,
	RHO_COPPER,
	amps,
	bandStep,
	builtIn,
	carriers,
	chainLevels,
	conductivity,
	crossing,
	depletionWidth,
	diodeCurrent,
	I_SAT,
	patchCarriers,
	role,
	valence
} from '../src/routes/semiconductors/model';

test('silicon has 5 × 10²² atoms per cm³, and only ~1 in 5 trillion has lost an electron to heat', () => {
	expect(N_SI).toBeGreaterThan(4.9e22);
	expect(N_SI).toBeLessThan(5.1e22);
	const perFree = N_SI / NI_SI;
	expect(perFree).toBeGreaterThan(4e12);
	expect(perFree).toBeLessThan(6e12);
});

test('thermal energy at room temperature is ~0.026 eV, far below every gap', () => {
	expect(KT).toBeCloseTo(0.0259, 4);
	// Diamond's gap shuts out thermal crossing by more than 30 orders of magnitude relative to silicon.
	expect(crossing(GAPS.C.gap) / crossing(GAPS.Si.gap)).toBeLessThan(1e-30);
	expect(crossing(GAPS.Ge.gap)).toBeGreaterThan(crossing(GAPS.Si.gap));
});

test('pure silicon has a resistivity of a few hundred thousand Ω·cm, ~10¹¹ times copper', () => {
	expect(INTRINSIC.rho).toBeGreaterThan(2e5);
	expect(INTRINSIC.rho).toBeLessThan(5e5);
	expect(INTRINSIC.rho / RHO_COPPER).toBeGreaterThan(1e11);
});

test('dopants: phosphorus and arsenic give an electron, boron takes one (from the element data)', () => {
	expect(valence('Si')).toBe(4);
	expect(valence('P')).toBe(5);
	expect(valence('As')).toBe(5);
	expect(valence('B')).toBe(3);
	expect(role('P')).toBe('donor');
	expect(role('As')).toBe('donor');
	expect(role('B')).toBe('acceptor');
});

test('a donor and an acceptor cancel: compensation', () => {
	expect(patchCarriers(['Si', 'P', 'P', 'Si'])).toMatchObject({ electrons: 2, holes: 0 });
	expect(patchCarriers(['B', 'Si'])).toMatchObject({ electrons: 0, holes: 1 });
	expect(patchCarriers(['P', 'B', 'P'])).toMatchObject({ electrons: 1, holes: 0 });
	expect(patchCarriers(['P', 'B'])).toMatchObject({ electrons: 0, holes: 0 });
});

test('mass-action law: n·p = nᵢ² whatever the doping, and n ≈ N_D in n-type', () => {
	for (const [nd, na] of [
		[0, 0],
		[1e15, 0],
		[0, 1e17],
		[3e16, 1e16]
	]) {
		const { n, p } = carriers(nd, na);
		expect((n * p) / (NI_SI * NI_SI)).toBeCloseTo(1, 6);
	}
	const { n, p } = carriers(1e16, 0);
	expect(n / 1e16).toBeCloseTo(1, 6);
	expect(p).toBeLessThan(1e4);
});

test('resistivity against doping matches measured silicon (Irvin curves)', () => {
	// Approximate values read from the classic measured curves (Irvin 1962, reproduced in Sze & Ng): n-type 10¹⁶ cm⁻³
	// ≈ 0.5 Ω·cm, p-type ≈ 1.4–1.5 Ω·cm; 10¹⁵ cm⁻³: ≈ 4.5 and ≈ 13–14 Ω·cm.
	expect(conductivity(1e16, 0).rho).toBeGreaterThan(0.45);
	expect(conductivity(1e16, 0).rho).toBeLessThan(0.6);
	expect(conductivity(0, 1e16).rho).toBeGreaterThan(1.3);
	expect(conductivity(0, 1e16).rho).toBeLessThan(1.6);
	expect(conductivity(1e15, 0).rho).toBeGreaterThan(4);
	expect(conductivity(1e15, 0).rho).toBeLessThan(5);
	expect(conductivity(0, 1e15).rho).toBeGreaterThan(12);
	expect(conductivity(0, 1e15).rho).toBeLessThan(15);
});

test('one phosphorus atom per million silicon atoms: about a million times more conductive', () => {
	const ratio = conductivity(N_SI / 1e6, 0).sigma / INTRINSIC.sigma;
	expect(ratio).toBeGreaterThan(1e6);
	expect(ratio).toBeLessThan(5e6);
});

test('junction doped 10¹⁷ cm⁻³ each side: built-in voltage ~0.8 V, depletion zone ~0.15 µm', () => {
	expect(builtIn()).toBeGreaterThan(0.8);
	expect(builtIn()).toBeLessThan(0.87);
	expect(depletionWidth(0)).toBeGreaterThan(0.12);
	expect(depletionWidth(0)).toBeLessThan(0.18);
	// W ∝ √(V_bi − V): reverse voltage widens it, forward narrows it.
	expect(depletionWidth(-2) / depletionWidth(0)).toBeCloseTo(
		Math.sqrt((builtIn() + 2) / builtIn()),
		6
	);
	expect(depletionWidth(0.6)).toBeLessThan(depletionWidth(0) / 1.5);
});

test('at 10¹⁷ cm⁻³ the Fermi level stays well inside the gap (non-degenerate)', () => {
	// The junction scene draws E_F this far below the conduction band on the n side.
	expect(GAPS.Si.gap / 2 - KT * Math.log(JUNCTION_DOPING / NI_SI)).toBeGreaterThan(0.1);
});

test('boron-doped silicon is two to three times more resistive than phosphorus-doped', () => {
	for (const c of [1e15, 1e16, 1e17]) {
		const ratio = conductivity(0, c).rho / conductivity(c, 0).rho;
		expect(ratio).toBeGreaterThan(2);
		expect(ratio).toBeLessThan(3.2);
	}
});

test('band edges: the p side sits higher, and forward voltage lowers the step', () => {
	expect(bandStep(-1, 0)).toBe(1);
	expect(bandStep(1, 0)).toBe(0);
	expect(bandStep(0, 0)).toBeCloseTo(0.5, 9);
	// Monotonic across the depletion zone.
	const xs = [-0.1, -0.05, 0, 0.05, 0.1];
	const e = xs.map((x) => bandStep(x, -2));
	for (let i = 1; i < e.length; i++) expect(e[i]).toBeLessThan(e[i - 1]);
});

test('Shockley diode: forward current ×10 every ~60 mV at 300 K', () => {
	for (const v of [0.4, 0.55, 0.7]) {
		const ratio = diodeCurrent(v + 0.0595) / diodeCurrent(v);
		expect(ratio).toBeGreaterThan(9.9);
		expect(ratio).toBeLessThan(10.1);
	}
	// 0.7 V drives about half a milliampere through a small diode.
	expect(diodeCurrent(0.7)).toBeGreaterThan(3e-4);
	expect(diodeCurrent(0.7)).toBeLessThan(1e-3);
});

test('reverse current saturates at −Iₛ, whatever the voltage', () => {
	expect(diodeCurrent(0)).toBe(0);
	for (const v of [-0.3, -1, -2]) expect(diodeCurrent(v) / -I_SAT).toBeCloseTo(1, 4);
	// Forward 0.7 V against reverse 2 V: more than 10¹¹ times the current.
	expect(diodeCurrent(0.7) / Math.abs(diodeCurrent(-2))).toBeGreaterThan(1e11);
});

test('N atoms turn one level into N levels inside a band of fixed width', () => {
	for (const N of [1, 2, 8, 64]) {
		const levels = chainLevels(N, 0, 1);
		expect(levels).toHaveLength(N);
		for (const e of levels) expect(Math.abs(e)).toBeLessThan(2);
	}
	// Two atoms: a bonding and an antibonding level, symmetric about the atomic level.
	const [lo, hi] = chainLevels(2, 0, 1);
	expect(lo).toBeCloseTo(-1, 9);
	expect(hi).toBeCloseTo(1, 9);
	// Many atoms: the band fills its full width 4β.
	const many = chainLevels(64, 0, 1);
	expect(many[63] - many[0]).toBeGreaterThan(3.99);
});

test('currents are written with SI prefixes', () => {
	expect(amps(5.75e-4)).toBe('575 µA');
	expect(amps(-1e-15)).toBe('−1.00 fA');
	expect(amps(0.0275)).toBe('27.5 mA');
});
