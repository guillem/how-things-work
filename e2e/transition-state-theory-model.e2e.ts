// Checks the surfaces, trajectories and rates behind the transition-state-theory explainer:
// the passes against the published surfaces, the molecules' vibrations against spectroscopy,
// the reaction energy against measured bond energies, energy conservation, Polanyi's rules for
// early and late barriers, the time spent at the pass, Eyring's k_BT/h and Arrhenius behaviour,
// and the isotope effect against Persky's measurement. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	KB,
	MASS,
	SURFACES,
	morseLevel,
	morseOmega,
	saddleOf,
	wavenumber
} from '../src/routes/transition-state-theory/leps';
import {
	REACTIONS,
	barrier,
	fire,
	probability
} from '../src/routes/transition-state-theory/trajectory';
import {
	crossingFrequency,
	effectiveBarrier,
	eyring,
	isotopeRatio,
	minimumPath
} from '../src/routes/transition-state-theory/rate';

const KCAL = 23.0605; // kcal/mol per eV
const muOf = (a: number, b: number) => (a * b) / (a + b);

test.describe('the surfaces', () => {
	test('H + H₂: a symmetric pass 9.8 kcal/mol high at 0.93 Å, as in the accurate ab initio surface', () => {
		// Liu and Siegbahn; Truhlar and Horowitz (LSTH, 1978): 9.80 kcal/mol at r = 1.757 bohr
		const sd = saddleOf(SURFACES.h3);
		expect(barrier(REACTIONS['h-h2']) * KCAL).toBeCloseTo(9.8, 0);
		expect(sd.r1).toBeCloseTo(sd.r2, 4);
		// the Sato parameter was fitted to the height, not the place: the place is a check
		expect(Math.abs(sd.r1 - 0.93)).toBeLessThan(0.01);
	});

	test('F + H₂: an early pass about 1 kcal/mol high, with the H–H bond barely stretched', () => {
		// Muckerman's surface V: collinear barrier 1.06 kcal/mol, F–H 1.54 Å, H–H 0.76 Å
		const sd = saddleOf(SURFACES.fh2);
		expect(barrier(REACTIONS['f-h2']) * KCAL).toBeCloseTo(1.06, 1);
		expect(sd.r1).toBeCloseTo(1.54, 1);
		expect(sd.r2 - SURFACES.fh2.yz.re).toBeLessThan(0.03);
		// seen from H + HF the same pass is late: the H–F bond is stretched by 0.6 Å
		expect(sd.r1 - SURFACES.fh2.xy.re).toBeGreaterThan(0.5);
	});

	test('the molecules vibrate at their measured frequencies', () => {
		// Huber & Herzberg: ωₑ(H₂) 4401, ωₑ(D₂) 3116, ωₑ(HF) 4138 cm⁻¹
		const hh = SURFACES.h3.yz,
			hf = SURFACES.fh2.xy;
		expect(wavenumber(morseOmega(hh, MASS.H / 2))).toBeCloseTo(4401, -1.5);
		expect(wavenumber(morseOmega(hh, MASS.D / 2))).toBeCloseTo(3116, -1.5);
		expect(wavenumber(morseOmega(hf, muOf(MASS.H, MASS.F)))).toBeCloseTo(4138, -1.5);
	});

	test('F + H₂ releases the measured difference of the bond energies of HF and H₂', () => {
		// D₀(HF) = 5.869 eV, D₀(H₂) = 4.478 eV: the reaction gives out 1.39 eV (32 kcal/mol)
		const hh = SURFACES.fh2.yz,
			hf = SURFACES.fh2.xy;
		const d0HF = hf.D - morseLevel(hf, muOf(MASS.H, MASS.F), 0);
		const d0HH = hh.D - morseLevel(hh, MASS.H / 2, 0);
		expect(d0HF).toBeCloseTo(5.869, 1);
		expect(d0HH).toBeCloseTo(4.478, 1);
		expect(d0HF - d0HH).toBeCloseTo(1.391, 1);
	});

	test('the path of least energy climbs to the pass and nowhere higher', () => {
		for (const s of [SURFACES.h3, SURFACES.fh2]) {
			const path = minimumPath(s);
			const top = Math.max(...path.map((p) => p.v));
			expect(top).toBeCloseTo(saddleOf(s).v, 4);
			// it runs from one valley (long r₁) to the other (long r₂)
			expect(path[0].r1).toBeGreaterThan(3);
			expect(path[path.length - 1].r2).toBeGreaterThan(3);
		}
	});
});

test.describe('trajectories', () => {
	test('Newton’s laws keep the total energy constant', () => {
		const tr = fire(REACTIONS['h-h2'], { trans: 0.6, v: 1, phase: 0.4 });
		expect(tr.drift).toBeLessThan(1e-3);
	});

	test('H + H₂: too little energy turns back, enough crosses', () => {
		// effective barrier ≈ 0.28 eV of translation with the molecule at its zero-point energy
		expect(probability(REACTIONS['h-h2'], { trans: 0.2, v: 0 })).toBe(0);
		expect(probability(REACTIONS['h-h2'], { trans: 0.45, v: 0 })).toBeGreaterThan(0.8);
	});

	test('an early pass is crossed by translation, not by vibration (F + H₂)', () => {
		const r = REACTIONS['f-h2'];
		expect(probability(r, { trans: 0.1, v: 0 })).toBeGreaterThan(0.6);
		// three quanta of vibration (1.4 eV more than the pass) and no translation: nothing
		expect(probability(r, { trans: 0, v: 3 })).toBe(0);
	});

	test('a late pass is crossed by vibration, not by translation (H + HF)', () => {
		const r = REACTIONS['h-hf'];
		// 2 eV of translation, well above the 1.42 eV pass, never makes it
		expect(barrier(r)).toBeCloseTo(1.42, 1);
		expect(probability(r, { trans: 2, v: 0 })).toBe(0);
		expect(probability(r, { trans: 1.6, v: 0 })).toBe(0);
		// three quanta of HF vibration and a little translation often do
		expect(probability(r, { trans: 0.2, v: 3 })).toBeGreaterThan(0.3);
	});

	test('the pass is crossed in about one vibration, not lingered at', () => {
		const tr = fire(REACTIONS['h-h2'], { trans: 0.5, v: 0, phase: 0.3 });
		expect(tr.reacted).toBe(true);
		const period = (2 * Math.PI) / morseOmega(SURFACES.h3.yz, MASS.H / 2); // 7.6 fs
		expect(tr.nearPass).toBeLessThan(2 * period);
	});
});

test.describe('rates', () => {
	test('k_BT/h is about 6.2 × 10¹² per second at room temperature', () => {
		expect(crossingFrequency(298.15) / 1e12).toBeCloseTo(6.21, 2);
	});

	test('the rate is Arrhenius-like: ln k against 1/T is a line of slope −(E₀ + k_BT)', () => {
		const r = REACTIONS['h-h2'];
		const e0 = effectiveBarrier(r);
		const [t1, t2] = [400, 420];
		const ea = (-KB * Math.log(eyring(r, t2) / eyring(r, t1))) / (1 / t2 - 1 / t1);
		expect(ea).toBeCloseTo(e0 + KB * 410, 3);
		// and it climbs steeply: from 300 to 600 K, hundreds of times faster
		expect(eyring(r, 600) / eyring(r, 300)).toBeGreaterThan(100);
	});

	test('F + H₂: the activation energy comes out near the measured 0.9 kcal/mol', () => {
		// Stevens, Brune & Anderson (1989): k = 1.2 × 10⁻¹⁰ exp(−470 K/T) between 240 and 373 K
		const r = REACTIONS['f-h2'];
		const [t1, t2] = [250, 370];
		const ea = (-KB * Math.log(eyring(r, t2) / eyring(r, t1))) / (1 / t2 - 1 / t1);
		expect(Math.abs(ea * KCAL - 470 * KB * KCAL)).toBeLessThan(0.3);
	});

	test('deuterium: lower zero-point energies, a higher effective barrier, a slower rate', () => {
		for (const r of [REACTIONS['h-h2'], REACTIONS['f-h2']]) {
			expect(effectiveBarrier(r, true)).toBeGreaterThan(effectiveBarrier(r));
			expect(isotopeRatio(r, 300)).toBeGreaterThan(1);
			// the effect fades as the temperature climbs
			expect(isotopeRatio(r, 1000)).toBeLessThan(isotopeRatio(r, 300));
		}
		// H + H₂ against D + D₂: the H₂ bond is broken at the pass, so most of its zero-point
		// energy is lost there, and the effect is large
		expect(isotopeRatio(REACTIONS['h-h2'], 298)).toBeGreaterThan(3);
	});

	test('F + H₂ against F + D₂: zero-point energies give part of the measured isotope effect', () => {
		// Persky (1973): k(F + H₂)/k(F + D₂) = 1.04 exp(370 cal/mol / RT), 1.94 at 298 K
		const measured = 1.94;
		const model = isotopeRatio(REACTIONS['f-h2'], 298);
		expect(model).toBeGreaterThan(1.2);
		expect(model).toBeLessThan(measured);
	});

	test('the zero-point energies of the molecules', () => {
		// ½ħω minus the anharmonic correction: H₂ 0.27 eV, D₂ 0.19 eV
		expect(morseLevel(SURFACES.h3.yz, MASS.H / 2, 0)).toBeCloseTo(0.27, 2);
		expect(morseLevel(SURFACES.h3.yz, MASS.D / 2, 0)).toBeCloseTo(0.191, 2);
	});
});
