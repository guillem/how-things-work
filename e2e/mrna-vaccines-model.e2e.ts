// Checks the vaccine model against its sources: the translation half-life of
// mRNA in lipid nanoparticles (Pardi et al. 2015), the two-dose antibody
// level of the BioNTech/Pfizer phase 1 trial (Walsh et al. 2020), the real
// spike sequences, and the textbook behaviour a vaccine relies on (a first,
// harmless meeting that leaves memory). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import { SEQUENCE } from '../src/routes/mrna-vaccines/data';
import {
	CAO,
	MEMORY,
	clearedDay,
	peak as peakOf,
	simulate as infect
} from '../src/routes/immune-system/model';
import {
	DOSE,
	INTERVAL,
	MRNA,
	WALSH,
	antibody,
	at,
	effectors,
	fitDose,
	infectionAntibodyPeak,
	infectionOutcome,
	mrnaLeft,
	peak,
	simulate,
	twoDoseRatio
} from '../src/routes/mrna-vaccines/model';
import { codonToAmino } from '../src/routes/dna-to-protein/genetics';

const one = simulate({ doses: [0], infectAt: null, days: 60 });
const two = simulate({ doses: [0, INTERVAL], infectAt: null, days: 400 });
const yardstick = infectionAntibodyPeak();

test('cells stop translating the vaccine mRNA within days', () => {
	// Pardi et al. 2015: protein production halves every 20.6 h after an intramuscular injection.
	expect(mrnaLeft([0], MRNA.halfLifeHours / 24)).toBeCloseTo(0.5, 6);
	// Most of it is gone within a few days, and almost all of it by the 8 days expression was seen.
	expect(mrnaLeft([0], 3)).toBeLessThan(0.1);
	expect(mrnaLeft([0], MRNA.detectableDays)).toBeLessThan(0.01);
	// Nothing is left of a dose by the time the next one is given.
	expect(at(two, INTERVAL - 0.05).A).toBe(0);
});

test('the spike builds up after the injection before it fades', () => {
	// None at the moment of injection: the cells have not made any yet.
	expect(at(one, 0).A).toBe(0);
	// It peaks after the first day (about a day and a half, as the page says), then falls.
	const top = one.reduce((best, s) => (s.A > best.v ? { t: s.t, v: s.A } : best), { t: 0, v: 0 });
	expect(top.t).toBeGreaterThan(1);
	expect(top.t).toBeLessThan(2);
	// Within a week it is down to a small fraction of that peak.
	expect(at(one, 7).A).toBeLessThan(0.1 * top.v);
});

test('the dose is fitted to the antibody of two doses in the phase 1 trial', () => {
	const r = twoDoseRatio();
	expect(r).toBeGreaterThan(WALSH.low);
	expect(r).toBeLessThan(WALSH.high);
	expect(r).toBeCloseTo(WALSH.target, 1);
	expect(fitDose() / DOSE).toBeCloseTo(1, 1);
});

test('the vaccine raises antibodies without any illness', () => {
	// No virus, no infected cell, the airway lining untouched.
	for (const s of two) {
		expect(s.V).toBe(0);
		expect(s.I).toBe(0);
		expect(s.T).toBeCloseTo(CAO.T0, -2);
	}
	// Plasma cells release antibodies from about day 4 (the page and its readout).
	const firstDay = one.find((s) => antibody(s) > 1)!.t;
	expect(Math.round(firstDay)).toBe(4);
	expect(antibody(at(one, 8))).toBeGreaterThan(0.05 * yardstick);
});

test('one dose gives a small response; the second dose meets memory and multiplies it', () => {
	const first = peak(one, antibody).v;
	// One dose: about a seventh of an infection's antibody peak.
	expect(first / yardstick).toBeGreaterThan(1 / 8);
	expect(first / yardstick).toBeLessThan(1 / 6.5);
	// Two doses: about 2.5 times an infection's peak, almost twenty times the first dose's.
	const second = peak(two, antibody, INTERVAL).v;
	expect(second / first).toBeGreaterThan(16);
	expect(second / first).toBeLessThan(20);
	// After one dose: about 25,000 killer T cells at the peak, about nine days on.
	const e1 = peak(one, effectors);
	expect(e1.v).toBeGreaterThan(0.9 * 25_000);
	expect(e1.v).toBeLessThan(1.1 * 25_000);
	expect(Math.round(e1.t)).toBe(9);
	// The boost comes from memory: far more killer T cells answer the second dose.
	expect(peak(two, effectors, INTERVAL).v).toBeGreaterThan(50 * peak(one, effectors).v);
	// Memory T cells after one dose: 5% of the peak, about 1,300, thirteen times the 100 naive cells.
	const mem = MEMORY.share * peak(one, effectors).v;
	expect(mem).toBeGreaterThan(0.9 * 1_300);
	expect(mem).toBeLessThan(1.1 * 1_300);
	expect(Math.round(mem / CAO.Cn0)).toBe(13);
});

test('antibodies fade over months, with the model half-life of about 46 days', () => {
	const a60 = antibody(at(two, 60));
	const a106 = antibody(at(two, 106));
	expect(a106 / a60).toBeCloseTo(0.5, 1);
	// Six months after the second dose, about a tenth of the peak is left.
	expect(antibody(at(two, INTERVAL + 180)) / peak(two, antibody).v).toBeGreaterThan(0.05);
	expect(antibody(at(two, INTERVAL + 180)) / peak(two, antibody).v).toBeLessThan(0.15);
});

test('a later infection is stopped at once, or cleared far faster than without the vaccine', () => {
	const unvaccinated = infect({ days: 30 });
	expect(clearedDay(unvaccinated)).toBeCloseTo(9, 0);
	const later = (months: number, doses = [0, INTERVAL]) => {
		const day = doses[doses.length - 1] + 30 * months;
		return infectionOutcome(simulate({ doses, infectAt: day, days: day + 25 }), day);
	};
	// Within about five months of the second dose, leftover antibodies stop the virus at once.
	expect(later(1).stopped).toBe(true);
	expect(later(3).stopped).toBe(true);
	expect(later(5).stopped).toBe(true);
	// Six months on, the virus barely grows and is gone in about five days, not nine.
	const six = later(6);
	expect(six.stopped).toBe(false);
	expect(six.peakV).toBeLessThan(0.01 * peakOf(unvaccinated, (s) => s.V).v);
	expect(six.cleared!).toBeGreaterThan(4);
	expect(six.cleared!).toBeLessThan(6);
	// A year on, antibodies have faded and the virus grows, but memory still clears it sooner.
	const year = later(12);
	expect(year.peakV).toBeGreaterThan(0.1 * peakOf(unvaccinated, (s) => s.V).v);
	expect(year.cleared!).toBeLessThan(6);
	// One dose alone: no antibodies to stop it, but memory clears it in under six days.
	const single = later(6, [0]);
	expect(single.stopped).toBe(false);
	expect(single.cleared!).toBeLessThan(6);
});

test('the vaccine message codes for the virus spike with two prolines, in different letters', () => {
	expect(SEQUENCE.codons).toBe(1273);
	const prot = (codons: readonly string[]) =>
		codons.map((c) => codonToAmino(c.replace(/U/g, 'T'))).join('');
	// The same signal peptide (the first 13 amino acids of the spike), spelled differently.
	expect(prot(SEQUENCE.startVirus)).toBe('MFVFLVLLPLVSS');
	expect(prot(SEQUENCE.startVaccine)).toBe('MFVFLVLLPLVSS');
	expect(SEQUENCE.startVaccine.join('')).not.toBe(SEQUENCE.startVirus.join(''));
	// Codons 986 and 987: lysine and valine in the virus, two prolines in the vaccine.
	const i = 986 - SEQUENCE.windowFrom;
	expect(prot(SEQUENCE.windowVirus.slice(i, i + 2))).toBe('KV');
	expect(prot(SEQUENCE.windowVaccine.slice(i, i + 2))).toBe('PP');
	// Richer in G and C, and most codons changed.
	expect(SEQUENCE.gcVaccine).toBeGreaterThan(SEQUENCE.gcVirus + 0.15);
	expect(SEQUENCE.sameCodons / SEQUENCE.codons).toBeLessThan(0.3);
});
