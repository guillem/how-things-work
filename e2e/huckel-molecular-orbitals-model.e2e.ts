// Checks the Hückel page's model against textbook results: ethene's α ± β; butadiene's
// ±1.618β and ±0.618β with its 0.472β delocalisation and unequal bond orders; benzene's
// 2, 1, 1, −1, −1, −2 ladder, 2β delocalisation and six equal bonds; cyclobutadiene's
// half-filled degenerate pair; the delocalisation energies of the cyclopentadienyl anion and the
// tropylium cation; Hückel's 4n + 2 rule over rings and charges; the polyene gap closing; and
// the cyanine series' measured absorption maxima predicted from one fitted β.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	CYANINE_MEASURED,
	cyanineNm,
	ringClosure,
	solve
} from '../src/routes/huckel-molecular-orbitals/huckel';

const xs = (n: number, ring: boolean, electrons = n) =>
	solve({ n, ring, electrons }).orbitals.map((o) => o.x);

test('ethene: a bonding orbital at α + β holding both electrons, an empty one at α − β', () => {
	const s = solve({ n: 2, ring: false, electrons: 2 });
	expect(s.orbitals.map((o) => o.x)).toEqual([expect.closeTo(1, 9), expect.closeTo(-1, 9)]);
	expect(s.orbitals.map((o) => o.occ)).toEqual([2, 0]);
	expect(s.energy).toBeCloseTo(2, 9); // the π bond: 2α + 2β
	expect(s.bondOrders[0]).toBeCloseTo(1, 9);
});

test('butadiene: ±1.618β and ±0.618β, 0.472β of delocalisation, a long middle bond', () => {
	const g = (1 + Math.sqrt(5)) / 2;
	expect(xs(4, false)).toEqual([g, g - 1, 1 - g, -g].map((v) => expect.closeTo(v, 9)));
	const s = solve({ n: 4, ring: false, electrons: 4 });
	expect(s.delocalisation).toBeCloseTo(0.472, 3);
	expect(s.bondOrders.map((b) => +b.toFixed(3))).toEqual([0.894, 0.447, 0.894]);
	// One more node in each orbital up the ladder.
	expect(s.orbitals.map((o) => o.nodes)).toEqual([0, 1, 2, 3]);
});

test('benzene: 2, 1, 1, −1, −1, −2; 2β of delocalisation; six identical bonds', () => {
	expect(xs(6, true)).toEqual([2, 1, 1, -1, -1, -2].map((v) => expect.closeTo(v, 9)));
	const s = solve({ n: 6, ring: true, electrons: 6 });
	expect(s.delocalisation).toBeCloseTo(2, 9);
	expect(s.closedShell).toBe(true);
	for (const b of s.bondOrders) expect(b).toBeCloseTo(2 / 3, 9); // no alternation
	// The degenerate pair's orbitals each have one nodal plane; the top one has three.
	expect(s.orbitals.map((o) => o.nodes)).toEqual([0, 1, 1, 2, 2, 3]);
	// Closing hexatriene into the ring lowers the π energy by about 1β.
	expect(ringClosure(6, 6)).toBeCloseTo(1.012, 3);
});

test('cyclobutadiene: two electrons alone in a degenerate pair at α, no delocalisation', () => {
	const s = solve({ n: 4, ring: true, electrons: 4 });
	expect(s.orbitals.map((o) => o.x)).toEqual([2, 0, 0, -2].map((v) => expect.closeTo(v, 9)));
	expect(s.orbitals.map((o) => o.occ)).toEqual([2, 1, 1, 0]);
	expect(s.unpaired).toBe(2);
	expect(s.closedShell).toBe(false);
	expect(s.gap).toBe(0);
	expect(s.delocalisation).toBeCloseTo(0, 9);
	// Closing butadiene into the ring raises its π energy.
	expect(ringClosure(4, 4)).toBeCloseTo(-0.472, 3);
});

test('charged rings: the cyclopentadienyl anion and tropylium cation', () => {
	expect(solve({ n: 5, ring: true, electrons: 6 }).delocalisation).toBeCloseTo(2.47, 2);
	expect(solve({ n: 7, ring: true, electrons: 6 }).delocalisation).toBeCloseTo(2.99, 2);
	expect(solve({ n: 3, ring: true, electrons: 2 }).delocalisation).toBeCloseTo(2, 9);
});

test("Hückel's rule: a ring's shell is closed exactly when it holds 4n + 2 π electrons", () => {
	for (let n = 3; n <= 12; n++) {
		for (let charge = -2; charge <= 2; charge++) {
			const electrons = n - charge;
			const s = solve({ n, ring: true, electrons });
			expect(s.closedShell, `${n} atoms, ${electrons} electrons`).toBe(electrons % 4 === 2);
			// 4n electrons leave two electrons alone in a degenerate pair.
			if (electrons % 4 === 0) expect(s.unpaired, `${n} atoms, ${electrons} e`).toBe(2);
		}
	}
});

test('a ring of N atoms has its levels at 2cos(2πk/N): the Frost circle', () => {
	for (const n of [3, 5, 7, 8, 10]) {
		const expected = Array.from({ length: n }, (_, k) => 2 * Math.cos((2 * Math.PI * k) / n)).sort(
			(a, b) => b - a
		);
		expect(xs(n, true)).toEqual(expected.map((v) => expect.closeTo(v, 9)));
	}
});

test('polyenes: every orbital stays inside α ± 2β and the HOMO-LUMO gap shrinks with length', () => {
	let last = Infinity;
	for (let n = 2; n <= 20; n += 2) {
		const s = solve({ n, ring: false, electrons: n });
		for (const o of s.orbitals) expect(Math.abs(o.x)).toBeLessThan(2);
		expect(s.gap).toBeLessThan(last);
		last = s.gap;
	}
	expect(last).toBeLessThan(0.3);
});

test('cyanines: β fitted on the 3-carbon dye predicts the 5- and 7-carbon dyes within 3%', () => {
	const [first, ...rest] = CYANINE_MEASURED;
	expect(cyanineNm(first.carbons)).toBeCloseTo(first.nm, 6);
	for (const d of rest) expect(Math.abs(cyanineNm(d.carbons) / d.nm - 1)).toBeLessThan(0.03);
	// About 100 nm redder per added CH=CH, as measured.
	for (let k = 3; k <= 11; k += 2) {
		const step = cyanineNm(k + 2) - cyanineNm(k);
		expect(step).toBeGreaterThan(85);
		expect(step).toBeLessThan(105);
	}
});

test('the electrons are conserved and orbitals normalised', () => {
	for (const ring of [false, true]) {
		for (let n = 3; n <= 9; n++) {
			for (let e = 0; e <= 2 * n; e++) {
				const s = solve({ n, ring, electrons: e });
				expect(s.orbitals.reduce((t, o) => t + o.occ, 0)).toBe(e);
				for (const o of s.orbitals) expect(o.c.reduce((t, c) => t + c * c, 0)).toBeCloseTo(1, 9);
			}
		}
	}
});
