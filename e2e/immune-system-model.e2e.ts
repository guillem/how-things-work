// Checks the within-host flu model against what Cao et al. (Front. Immunol.
// 2016) report for it, the human flu data it is compared with on the page,
// and the textbook primary/secondary response (definition of done #5 in
// docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	CAO,
	HUMAN_FLU,
	antibody,
	at,
	clearedDay,
	effectors,
	healthy,
	peak,
	simulate
} from '../src/routes/immune-system/model';

const primary = simulate({ days: 40 });

test('a first flu infection grows for two days and is cleared after about nine', () => {
	const v = peak(primary, (s) => s.V);
	// Exponential growth first: a thousand-fold rise within the first two days.
	expect(v.t).toBeLessThanOrEqual(2);
	expect(v.v).toBeGreaterThan(1000 * CAO.V0);
	// Cleared (below 1 EID₅₀/mL) on day 9, as the page says; human flu is gone by day 7–8.
	expect(clearedDay(primary)).toBeCloseTo(9, 0);
	expect(clearedDay(primary)!).toBeGreaterThanOrEqual(HUMAN_FLU.goneByDay);
	// The innate response protects the lining: most of it stays healthy.
	expect(Math.min(...primary.map(healthy))).toBeGreaterThan(0.8);
});

test('the innate response holds the virus in check but cannot clear it', () => {
	const innateOnly = simulate({ days: 40, tcells: false, bcells: false });
	// Identical to the full response until the adaptive one arrives…
	expect(at(innateOnly, 3).V / at(primary, 3).V).toBeCloseTo(1, 2);
	// …then the virus stays near its plateau for as long as you look.
	expect(clearedDay(innateOnly)).toBeNull();
	expect(at(innateOnly, 40).V).toBeGreaterThan(1e6);
	expect(Math.min(...innateOnly.map(healthy))).toBeGreaterThan(0.8);
});

test('without the innate response the virus destroys the airway lining', () => {
	const noInnate = simulate({ days: 40, innate: false });
	expect(peak(noInnate, (s) => s.V).v).toBeGreaterThan(100 * peak(primary, (s) => s.V).v);
	expect(Math.min(...noInnate.map(healthy))).toBeLessThan(0.05);
});

test('killer T cells and antibodies arrive after about a week', () => {
	// Nothing adaptive in the first five days.
	expect(effectors(at(primary, 5))).toBeLessThan(1);
	// 100 matching naive T cells become tens of thousands of effectors, peaking on day 7–8.
	const e = peak(primary, effectors);
	expect(e.v).toBeGreaterThan(1e4);
	expect(e.v).toBeLessThan(1e5);
	expect(e.t).toBeGreaterThan(7);
	expect(e.t).toBeLessThan(8.5);
	// IgM-like antibody peaks before the long-lived IgG-like antibody; the total near day 12.
	expect(peak(primary, (s) => s.AS).t).toBeLessThan(peak(primary, (s) => s.AL).t);
	expect(peak(primary, antibody).t).toBeGreaterThan(10);
	expect(peak(primary, antibody).t).toBeLessThan(14);
	// Most effector T cells die once the virus is gone.
	expect(effectors(at(primary, 20))).toBeLessThan(0.01 * e.v);
});

test('without killer T cells the virus is cleared later', () => {
	// Cao et al.: CD8⁺ T cells speed clearance; antibodies finish it.
	expect(clearedDay(simulate({ days: 40, tcells: false }))!).toBeGreaterThan(
		clearedDay(primary)! + 3
	);
});

test('a second infection after antibodies have faded is met faster and harder', () => {
	const day = 180;
	const s = simulate({ days: day + 40, reinfectAt: day });
	// Leftover antibodies are too few to stop it: the virus grows again.
	expect(peak(s, (x) => x.V, day, day + 30).v).toBeGreaterThan(10 * CAO.V0);
	// Cleared in about five days instead of nine.
	const cleared = clearedDay(s, day)! - day;
	expect(cleared).toBeLessThan(clearedDay(primary)! - 3);
	// Memory cells: a far bigger T cell response…
	const e1 = peak(primary, effectors);
	const e2 = peak(s, effectors, day, day + 30);
	expect(e2.v).toBeGreaterThan(100 * e1.v);
	// …and more antibody, sooner.
	const a1 = peak(primary, antibody);
	const a2 = peak(s, antibody, day, day + 30);
	expect(a2.v).toBeGreaterThan(10 * a1.v);
	expect(a2.t - day).toBeLessThan(a1.t - 2);
});

test('soon after the first infection, leftover antibodies stop the virus growing at all', () => {
	const day = 30;
	const s = simulate({ days: day + 30, reinfectAt: day });
	expect(peak(s, (x) => x.V, day + 0.1, day + 30).v).toBeLessThan(CAO.V0);
	expect(Math.min(...s.filter((x) => x.t >= day).map(healthy))).toBeGreaterThan(0.99);
});

test('once cleared, the infection does not come back by itself', () => {
	const year = simulate({ days: 365 });
	expect(year.filter((x) => x.t > 10).every((x) => x.V === 0)).toBe(true);
});

test('the solver stays finite for every setting the page offers', () => {
	for (const reinfectAt of [20, 60, 120, 240, 365]) {
		for (const innate of [true, false]) {
			for (const adaptive of [true, false]) {
				const s = simulate({
					days: reinfectAt + 30,
					reinfectAt,
					innate,
					tcells: adaptive,
					bcells: adaptive
				});
				const ok = s.every((x) => Object.values(x).every((v) => Number.isFinite(v) && v >= 0));
				expect(ok).toBe(true);
				expect(peak(s, (x) => x.V).v).toBeLessThan(1e10);
			}
		}
	}
});
