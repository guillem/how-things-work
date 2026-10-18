// Checks the ocean-acidification page's seawater carbonate solver against the published
// intercomparison of CO2SYS, seacarb, mocsy and the other packages (Orr, Epitalon & Gattuso 2015,
// Biogeosciences 12, 1483): its check values of every equilibrium constant at 25 °C and S 35
// (Table 12), the dissolved carbon of its standard water (AT 2300 µmol/kg with pCO₂ 400 µatm at
// 18 °C gives CT 2058.185), and its sensitivities of each output to a 1% change of AT or CT
// (Table 11). Then the page's claims: pre-industrial and year-2000 pH match the reconstruction
// quoted on the acids-bases page; pH never falls to 7; added CO₂ consumes carbonate ion; cold
// water reaches aragonite undersaturation first and calcite later; the Revelle factor grows as the
// water fills, so each extra 100 ppm puts less carbon in. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	constants,
	fractions,
	fromAir,
	fromDIC,
	fromPCO2,
	ppmAtOmega,
	revelle
} from '../src/routes/ocean-acidification/model';

const pK = (k: number) => -Math.log10(k);
const STD = { T: 18, S: 35, AT: 2300 };

test('equilibrium constants match the CO2SYS check values at 25 °C, S 35', () => {
	const k = constants(25, 35);
	// Orr et al. 2015, Table 12: the values of CO2SYS-MATLAB, seacarb, mocsy, swco2 and csys
	expect(pK(k.K0)).toBeCloseTo(1.54681, 5);
	expect(pK(k.K1)).toBeCloseTo(5.84715, 5);
	expect(pK(k.K2)).toBeCloseTo(8.96595, 5);
	expect(pK(k.KB)).toBeCloseTo(8.59747, 5);
	// the packages agree on 13.2204 (Millero 1995); the Guide's 13.217 is from a different fit
	expect(pK(k.KW)).toBeCloseTo(13.2204, 4);
	expect(pK(k.KS)).toBeCloseTo(0.9987, 4);
	expect(pK(k.KF)).toBeCloseTo(2.6261, 4);
	expect(pK(k.Kcal)).toBeCloseTo(6.3693, 4);
	expect(pK(k.Kar)).toBeCloseTo(6.1883, 4);
});

test('the standard surface water holds the dissolved carbon the packages compute', () => {
	// Orr et al. 2015, sect. 2.5 and 4.1: AT 2300 µmol/kg, pCO₂ 400 µatm, 18 °C, S 35, no
	// nutrients → CT 2058.185 µmol/kg (seacarb)
	const s = fromPCO2(400, STD);
	expect(s.dic).toBeCloseTo(2058.185, 1);
	// and back: that carbon gives 400 µatm
	expect(fromDIC(2058.185, STD).pCO2).toBeCloseTo(400, 1);
});

test('a 1% change of carbon or alkalinity moves everything as Orr et al. report', () => {
	// Table 11: per cent change of each output for +1% of CT or AT, at the standard conditions
	const base = fromDIC(2058.185, STD);
	const moreC = fromDIC(2058.185 * 1.01, STD);
	const moreA = fromDIC(2058.185, { ...STD, AT: 2300 * 1.01 });
	const pct = (a: number, b: number) => 100 * (b / a - 1);
	const rows: [keyof typeof base, number, number][] = [
		['co2', 11.7, -9.5],
		['hco3', 1.7, -0.7],
		['co3', -7.4, 8.8],
		['h', 9.8, -8.8],
		['pCO2', 11.7, -9.5],
		['omegaAr', -7.4, 8.8]
	];
	for (const [key, dC, dA] of rows) {
		expect(Math.abs(pct(base[key] as number, moreC[key] as number) - dC)).toBeLessThan(0.06);
		expect(Math.abs(pct(base[key] as number, moreA[key] as number) - dA)).toBeLessThan(0.06);
	}
});

test('pre-industrial and year-2000 pH match the reconstructed global mean', () => {
	// Jiang et al. 2019 (Sci. Rep. 9, 18624): surface mean pH 8.17 around 1770 and 8.07 in 2000,
	// when the air held about 278 and 369 ppm; the model's average water is at 18 °C
	expect(fromAir(278, STD).pH).toBeCloseTo(8.17, 1);
	expect(Math.abs(fromAir(278, STD).pH - 8.17)).toBeLessThan(0.025);
	expect(Math.abs(fromAir(369, STD).pH - 8.07)).toBeLessThan(0.025);
});

test('however much CO₂ the air holds, seawater stays basic', () => {
	for (const T of [-1.8, 5, 15, 25, 30])
		for (const ppm of [280, 560, 1000, 2000])
			expect(fromAir(ppm, { ...STD, T }).pH).toBeGreaterThan(7.3);
});

test('added CO₂ turns carbonate ion into bicarbonate', () => {
	const a = fromAir(280, STD);
	const b = fromAir(560, STD);
	expect(b.co2).toBeGreaterThan(1.9 * a.co2); // Henry's law: twice the air, twice the gas
	expect(b.hco3).toBeGreaterThan(a.hco3);
	expect(b.co3).toBeLessThan(0.7 * a.co3); // doubling the air takes away more than 30%
	// [H⁺] rises by about 80%, yet stays near a hundredth of a µmol/kg: hardly any of the new
	// acid is left as free H⁺
	expect(b.h / a.h).toBeGreaterThan(1.7);
	expect(b.hFree).toBeLessThan(0.02);
	// CO₂ + CO₃²⁻ + H₂O → 2 HCO₃⁻: bicarbonate gains about two for each carbonate ion lost
	expect(b.hco3 - a.hco3).toBeGreaterThan(1.5 * (a.co3 - b.co3));
});

test('Bjerrum crossovers sit at pK1 and pK2, and seawater is mostly bicarbonate', () => {
	const k = constants(25, 35);
	const f1 = fractions(pK(k.K1), k);
	expect(f1.co2).toBeCloseTo(f1.hco3, 2);
	const f2 = fractions(pK(k.K2), k);
	expect(f2.hco3).toBeCloseTo(f2.co3, 2);
	// seawater's pK1 and pK2 lie well below fresh water's 6.35 and 10.33
	expect(pK(k.K1)).toBeLessThan(6);
	expect(pK(k.K2)).toBeLessThan(9.1);
	const sea = fromAir(423, { ...STD, T: 25 });
	const f = fractions(sea.pH, k);
	expect(f.hco3).toBeGreaterThan(0.85);
	expect(f.co3).toBeGreaterThan(0.08);
	expect(f.co2).toBeLessThan(0.01);
	expect(f.co2 + f.hco3 + f.co3).toBeCloseTo(1, 12);
});

test('cold water runs out of carbonate first', () => {
	let last = 0;
	for (const T of [-1.8, 2, 10, 18, 25]) {
		const ppm = ppmAtOmega(1, { ...STD, T });
		expect(ppm).toBeGreaterThan(last);
		// calcite, the less soluble form, holds out longer
		expect(ppmAtOmega(1, { ...STD, T }, 'calcite')).toBeGreaterThan(1.4 * ppm);
		last = ppm;
	}
	// near freezing, aragonite undersaturation comes at roughly twice pre-industrial CO₂
	// (Orr et al. 2005, Nature 437, 681: Southern Ocean surface water near 550–600 ppm)
	const polar = ppmAtOmega(1, { ...STD, T: -1.8 });
	expect(polar).toBeGreaterThan(450);
	expect(polar).toBeLessThan(650);
	// warm tropical water stays supersaturated past 1,000 ppm
	expect(ppmAtOmega(1, { ...STD, T: 28 })).toBeGreaterThan(2000);
	// colder water holds more CO₂ gas for the same air
	expect(fromAir(423, { ...STD, T: 0 }).co2).toBeGreaterThan(
		1.7 * fromAir(423, { ...STD, T: 28 }).co2
	);
});

test('the Revelle factor rises as the ocean fills, so each 100 ppm adds less carbon', () => {
	const r280 = revelle(fromAir(280, STD).pCO2, STD);
	const r1000 = revelle(fromAir(1000, STD).pCO2, STD);
	expect(r280).toBeGreaterThan(8);
	expect(r280).toBeLessThan(11);
	expect(r1000).toBeGreaterThan(r280 + 4);
	// colder water is less well buffered
	expect(revelle(400, { ...STD, T: 0 })).toBeGreaterThan(revelle(400, { ...STD, T: 25 }));
	const gain = (a: number, b: number) => fromAir(b, STD).dic - fromAir(a, STD).dic;
	expect(gain(900, 1000)).toBeLessThan(0.6 * gain(280, 380));
	// the definition: d ln pCO₂ / d ln DIC, from two nearby states
	const a = fromAir(500, STD);
	const b = fromAir(505, STD);
	const r = Math.log(b.pCO2 / a.pCO2) / Math.log(b.dic / a.dic);
	expect(r).toBeCloseTo(revelle(fromAir(502.5, STD).pCO2, STD), 1);
});
