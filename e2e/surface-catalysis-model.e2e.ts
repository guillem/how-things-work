// Checks the surface-catalysis page's model, the Ziff–Gulari–Barshad lattice: its two dead ends
// at the published transition points (oxygen below y₁ ≈ 0.387, CO above y₂ ≈ 0.526), the mass
// balance of every CO₂ made, the absorbing poisoned states and the way CO desorption lets a
// poisoned surface recover and softens the jump; and the mean-field rate equations of the same
// moves, which miss the oxygen dead end and put the CO collapse too late (Dickman's site
// approximation, about 0.56). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import { CO, O, Surface, Y1, Y2, meanField, steady } from '../src/routes/surface-catalysis/zgb';
import { at, curve, peak } from '../src/routes/surface-catalysis/curves';

test('without desorption the lattice works only between two dead ends', () => {
	// too little CO: oxygen covers every site and the surface stops
	const lean = new Surface(64, 64, 3);
	for (let t = 0; t < 1500 && !lean.dead(); t++) lean.mcs(0.33, 0);
	expect(lean.dead()).toBe(true);
	expect(lean.coverage().o).toBe(1);
	// too much CO: CO covers every site
	const rich = new Surface(64, 64, 4);
	for (let t = 0; t < 1500 && !rich.dead(); t++) rich.mcs(0.58, 0);
	expect(rich.dead()).toBe(true);
	expect(rich.coverage().co).toBe(1);
	// in between it keeps turning gas into CO₂
	const mid = steady(64, 0.47, 0, 5, 300, 300);
	expect(mid.rate).toBeGreaterThan(0.12);
});

test('the shipped curves put the dead ends at the published y₁ and y₂', () => {
	const c = curve(0);
	const live = c.y.filter((_, i) => c.rate[i] > 0.005);
	// oxygen poisoning sets in continuously just below y₁ = 0.3874 (Voigt and Ziff 1997)
	expect(Math.abs(live[0] - Y1)).toBeLessThan(0.01);
	expect(at(c, 'rate', Y1 + 0.02)).toBeLessThan(0.06);
	// CO poisoning is abrupt, at y₂ = 0.5256 (Ziff and Brosilow 1992): the rate peaks just below
	// and falls to zero within one grid step
	const top = peak(c, 'rate');
	expect(Math.abs(top.y - Y2)).toBeLessThan(0.01);
	expect(top.value).toBeGreaterThan(0.24);
	expect(at(c, 'rate', top.y + 0.005)).toBeLessThan(0.01);
	expect(at(c, 'co', 0.6)).toBe(1);
	expect(at(c, 'o', 0.3)).toBe(1);
});

test('every CO₂ uses one CO and one O atom: the mass balance holds exactly', () => {
	const s = new Surface(32, 32, 9);
	for (let t = 0; t < 400; t++) s.mcs(0.5, 0.02);
	const cov = s.coverage();
	const onCO = Math.round(cov.co * s.n);
	const onO = Math.round(cov.o * s.n);
	expect(s.co2).toBeGreaterThan(10000);
	expect(s.coIn - s.coOut - s.co2).toBe(onCO);
	expect(2 * s.o2In - s.co2).toBe(onO);
});

test('a poisoned surface stays dead without desorption, and recovers with it', () => {
	for (const species of [CO, O]) {
		const s = new Surface(32, 32, 11);
		s.fill(species);
		for (let t = 0; t < 100; t++) s.mcs(0.45, 0);
		expect(s.co2).toBe(0);
	}
	const hot = new Surface(64, 64, 12);
	hot.fill(CO);
	for (let t = 0; t < 400; t++) hot.mcs(0.5, 0.1);
	const before = hot.co2;
	for (let t = 0; t < 100; t++) hot.mcs(0.5, 0.1);
	expect((hot.co2 - before) / (hot.n * 100)).toBeGreaterThan(0.15);
	expect(hot.coverage().co).toBeLessThan(0.1);
});

test('desorption softens the jump: above k ≈ 0.04 the rate falls continuously', () => {
	const steepest = (k: number) => {
		const c = curve(k);
		let d = 0;
		for (let i = 1; i < c.y.length; i++) d = Math.max(d, c.rate[i - 1] - c.rate[i]);
		return d;
	};
	expect(steepest(0)).toBeGreaterThan(0.25);
	expect(steepest(0.2)).toBeLessThan(0.04);
	// past the peak a hot surface still works, partly covered by CO
	const hot = curve(0.2);
	expect(at(hot, 'rate', 0.65)).toBeGreaterThan(0.08);
	expect(at(hot, 'co', 0.65)).toBeLessThan(0.7);
	// and the CO-rich side never fully poisons once CO can leave
	expect(at(curve(0.05), 'co', 0.7)).toBeLessThan(1);
});

test('mean field misses the oxygen dead end and puts the CO collapse late, near 0.56', () => {
	// random mixing: an O always finds CO eventually, so the surface never dies of oxygen
	expect(meanField(0.1, 0).rate).toBeGreaterThan(0.005);
	expect(meanField(0.3, 0).rate).toBeGreaterThan(0.05);
	// the abrupt CO collapse, but at Dickman's site-approximation y₂ ≈ 0.561, not 0.526
	expect(meanField(0.555, 0).rate).toBeGreaterThan(0.3);
	expect(meanField(0.57, 0).rate).toBeLessThan(0.01);
	expect(meanField(0.57, 0).co).toBeGreaterThan(0.95);
});
