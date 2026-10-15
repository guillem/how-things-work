// Checks the solar-cell model against the reference spectrum, the published Shockley–Queisser
// limit and the numbers the page quotes. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	GAAS_GAP,
	Q,
	GAPS,
	SUN_FLUX,
	SUN_POWER,
	bestGap,
	blackbodyAbove,
	cell,
	cellCurrent,
	kelvin,
	monoCurrent,
	photonEnergy,
	photonsAbove,
	powerAbove,
	spectrumCeiling,
	split,
	wavelength
} from '../src/routes/solar-cells/model';
import { RECORDS } from '../src/routes/solar-cells/records';

const SI = GAPS.Si.gap;
const mA = (aPerM2: number) => aPerM2 / 10; // A/m² → mA/cm²
const record = (key: string) => {
	const r = RECORDS.find((x) => x.key === key);
	if (!r) throw new Error(key);
	return r;
};

test('standard sunlight (AM1.5G) delivers 1000 W/m² in about 4.3 × 10²¹ photons per m² per second', () => {
	// ASTM G173-03 global tilt integrates to 1000.4 W/m².
	expect(SUN_POWER).toBeCloseTo(1000.4, 0);
	expect(SUN_FLUX).toBeGreaterThan(4.2e21);
	expect(SUN_FLUX).toBeLessThan(4.4e21);
	// The average photon carries 1.45 eV, and more than half the power is outside 400–700 nm.
	expect(SUN_POWER / SUN_FLUX / Q).toBeCloseTo(1.45, 2);
	const visible = powerAbove(photonEnergy(700)) - powerAbove(photonEnergy(400));
	expect(visible / SUN_POWER).toBeLessThan(0.5);
});

test('photon energy: 1240 eV·nm / wavelength; silicon absorbs out to 1107 nm', () => {
	expect(photonEnergy(1240)).toBeCloseTo(1, 3);
	expect(photonEnergy(400)).toBeCloseTo(3.1, 2);
	expect(photonEnergy(700)).toBeCloseTo(1.77, 2);
	expect(wavelength(SI)).toBeCloseTo(1107, 0);
});

test('one electron per photon: a watt of red light makes more current than a watt of blue', () => {
	// 1000 W/m² of 600 nm light: 48 mA/cm²; of 400 nm light: 32 mA/cm²; 1200 nm: none in silicon.
	expect(mA(monoCurrent(600, 1000, SI))).toBeCloseTo(48.4, 1);
	expect(mA(monoCurrent(400, 1000, SI))).toBeCloseTo(32.3, 1);
	expect(monoCurrent(1200, 1000, SI)).toBe(0);
	// Current is proportional to the light's power.
	expect(monoCurrent(600, 500, SI)).toBeCloseTo(monoCurrent(600, 1000, SI) / 2, 9);
});

test('silicon absorbs about two-thirds of the sun’s photons; a 2 eV gap only a fifth', () => {
	expect(photonsAbove(SI) / SUN_FLUX).toBeCloseTo(0.635, 2);
	expect(photonsAbove(2) / SUN_FLUX).toBeCloseTo(0.21, 2);
	expect(photonsAbove(0.3)).toBeCloseTo(SUN_FLUX, -18);
});

test('the two spectrum losses alone leave a ceiling of 49% (silicon’s gap), above 40% over a wide range', () => {
	expect(spectrumCeiling(SI)).toBeCloseTo(0.49, 2);
	for (const g of [0.7, 1.0, 1.34, 1.6]) expect(spectrumCeiling(g)).toBeGreaterThan(0.4);
	// Silicon: 19% passes through, 32% becomes heat.
	const s = split(SI);
	expect(s.below).toBeCloseTo(0.19, 2);
	expect(s.heat).toBeCloseTo(0.32, 2);
});

test('Shockley–Queisser: 33.7% at 1.34 eV for AM1.5G at 300 K (Rühle 2016)', () => {
	const best = bestGap();
	expect(best.gap).toBeCloseTo(1.34, 2);
	expect(best.efficiency).toBeCloseTo(0.337, 3);
	// A broad plateau: within a percentage point from 1.1 to 1.4 eV.
	for (const g of [1.12, 1.2, 1.3, 1.4]) expect(cell(g).efficiency).toBeGreaterThan(0.327);
	const c = cell(1.34);
	expect(mA(c.jsc)).toBeCloseTo(35.0, 0);
	expect(c.voc).toBeCloseTo(1.08, 2);
	expect(c.ff).toBeCloseTo(0.89, 2);
});

test('the ideal silicon cell: 43.8 mA/cm², 0.88 V, fill factor 0.87, 33.4%', () => {
	const c = cell(SI);
	expect(mA(c.jsc)).toBeCloseTo(43.8, 1);
	expect(c.voc).toBeCloseTo(0.88, 2);
	expect(c.vmp).toBeCloseTo(0.79, 2);
	expect(mA(c.jmp)).toBeCloseTo(42.4, 1);
	expect(c.ff).toBeCloseTo(0.87, 2);
	expect(c.efficiency).toBeCloseTo(0.334, 3);
	// Its voltage is 0.24 V short of the gap.
	expect(SI - c.voc).toBeCloseTo(0.24, 2);
});

test('the four slices of sunlight add up to all of it, and the voltage slice is real', () => {
	for (const g of [0.5, 0.9, SI, 1.34, 2, 3]) {
		const s = split(g);
		expect(s.below + s.heat + s.voltage + s.output).toBeCloseTo(1, 9);
		for (const v of Object.values(s)) expect(v).toBeGreaterThan(0);
	}
	// At the best gap: 30% passes through, 23% heat, 13% voltage, 34% output.
	const s = split(1.34);
	expect(s.below).toBeCloseTo(0.3, 2);
	expect(s.heat).toBeCloseTo(0.23, 2);
	expect(s.voltage).toBeCloseTo(0.13, 2);
});

test('the I–V curve: Jsc at 0 V, no current at Voc, best power where d(VJ)/dV = 0', () => {
	const c = cell(SI);
	expect(cellCurrent(0, SI)).toBeCloseTo(c.jsc, 9);
	expect(Math.abs(cellCurrent(c.voc, SI))).toBeLessThan(1e-6 * c.jsc);
	const p = (v: number) => v * cellCurrent(v, SI);
	expect(p(c.vmp)).toBeCloseTo(c.pmax, 6);
	expect(p(c.vmp - 0.01)).toBeLessThan(c.pmax);
	expect(p(c.vmp + 0.01)).toBeLessThan(c.pmax);
});

test('the voltage is set by the cell’s glow: Voc = (kT/q) ln(Jsc/J₀ + 1), and rises 60 mV per tenfold light', () => {
	const v1 = cell(SI).voc;
	expect(cell(SI, { suns: 10 }).voc - v1).toBeCloseTo(0.0595, 4);
	expect(v1 - cell(SI, { suns: 0.1 }).voc).toBeCloseTo(0.0595, 4);
	// Current scales with the light; even 1000 suns leave Voc below the gap.
	expect(cell(SI, { suns: 0.5 }).jsc).toBeCloseTo(cell(SI).jsc / 2, 9);
	const concentrated = cell(SI, { suns: 1000 });
	expect(concentrated.voc).toBeCloseTo(1.06, 2);
	expect(concentrated.voc).toBeLessThan(SI);
	// Concentrated light raises the limit: 41% for silicon at 1000 suns.
	expect(concentrated.efficiency).toBeCloseTo(0.41, 2);
	// A warm cell's glow above the gap is tiny compared with sunlight: about 10⁻¹⁵ of it.
	const glow = blackbodyAbove(SI) / photonsAbove(SI);
	expect(glow).toBeGreaterThan(1e-15);
	expect(glow).toBeLessThan(1e-14);
});

test('heat: the ideal silicon cell loses 0.9 mV and 0.15% of its power per °C', () => {
	const c25 = cell(SI, { T: kelvin(25) });
	const c50 = cell(SI, { T: kelvin(50) });
	expect((c50.voc - c25.voc) / 25).toBeCloseTo(-0.0009, 4);
	expect((c50.pmax / c25.pmax - 1) / 25).toBeCloseTo(-0.0015, 4);
	expect(c25.efficiency).toBeCloseTo(0.335, 3);
	expect(c50.efficiency).toBeCloseTo(0.322, 3);
	// Colder is better.
	expect(cell(SI, { T: kelvin(0) }).efficiency).toBeGreaterThan(c25.efficiency);
});

test('records (NLR chart): every single-junction cell is below the limit, tandems are above it', () => {
	expect(record('si').efficiency).toBe(28.1);
	expect(record('gaas').efficiency).toBe(29.1);
	expect(record('si').efficiency / 100).toBeLessThan(cell(SI).efficiency);
	expect(record('gaas').efficiency / 100).toBeLessThan(cell(GAAS_GAP).efficiency);
	const limit = bestGap().efficiency * 100;
	for (const key of ['si', 'gaas', 'perovskite', 'cigs', 'cdte'])
		expect(record(key).efficiency).toBeLessThan(limit);
	for (const key of ['perovskiteSi', 'threeJunction', 'concentrator'])
		expect(record(key).efficiency).toBeGreaterThan(limit);
	// Units normalised: the silicon record's voltage is 0.75 V, its current close to the ideal 43.8.
	expect(record('si').voc).toBeCloseTo(0.75, 2);
	expect(record('si').jsc).toBeGreaterThan(0.97 * mA(cell(SI).jsc));
	// GaAs comes within 3% of the ideal voltage for its gap.
	expect((record('gaas').voc ?? 0) / cell(GAAS_GAP).voc).toBeGreaterThan(0.97);
});
