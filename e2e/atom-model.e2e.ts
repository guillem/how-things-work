// Checks the atom model and element data behind the atoms-periodic-table explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ELEMENTS,
	ORDER,
	cell,
	cloud,
	element,
	identify,
	isException,
	madelung,
	outerShell,
	parseConfig,
	radius90For1s,
	shellCounts
} from '../src/routes/atoms-periodic-table/atom';

test('the data: 118 elements in order, with known values', () => {
	expect(ELEMENTS).toHaveLength(118);
	ELEMENTS.forEach((e, i) => expect(e.z).toBe(i + 1));
	expect(element(6).symbol).toBe('C');
	expect(element(1).ionization).toBeCloseTo(13.598, 2); // hydrogen, NIST
	expect(element(9).electronegativity).toBeCloseTo(3.98, 2); // fluorine, the highest
	expect(element(26).stable).toEqual([54, 56, 57, 58]);
	expect(element(43).stable).toEqual([]); // technetium: no stable isotope
});

test('Madelung order: 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p', () => {
	expect(ORDER.map((s) => s.label).join(' ')).toBe(
		'1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p'
	);
	expect([...madelung(26)].map(([k, v]) => `${k}${v}`).join(' ')).toBe(
		'1s2 2s2 2p6 3s2 3p6 4s2 3d6'
	);
});

test('configurations: the rule matches most elements; chromium and copper are exceptions', () => {
	expect(isException(24)).toBe(true);
	expect(isException(29)).toBe(true);
	expect(isException(26)).toBe(false);
	const exceptions = ELEMENTS.filter((e) => e.z <= 103 && isException(e.z)).length;
	expect(exceptions).toBeGreaterThan(15);
	expect(exceptions).toBeLessThan(25);
	// Electron counts in the data add up to Z.
	for (const e of ELEMENTS)
		expect([...parseConfig(e.config).values()].reduce((a, b) => a + b, 0)).toBe(e.z);
});

test('outer electrons: groups share them; noble gases have full shells', () => {
	for (const z of [3, 11, 19, 37]) expect(outerShell(z).electrons).toBe(1); // alkali metals
	for (const z of [9, 17, 35]) expect(outerShell(z).electrons).toBe(7); // halogens
	for (const z of [10, 18, 36]) expect(outerShell(z).electrons).toBe(8);
	expect(shellCounts(11)).toEqual([2, 8, 1]);
});

test('table layout: rows and columns', () => {
	expect(cell(1)).toEqual({ row: 1, col: 1 });
	expect(cell(2)).toEqual({ row: 1, col: 18 });
	expect(cell(26)).toEqual({ row: 4, col: 8 });
	expect(cell(58)).toEqual({ row: 9, col: 4 });
	expect(cell(92)).toEqual({ row: 10, col: 6 });
	const seen = new Set(ELEMENTS.map((e) => `${cell(e.z).row},${cell(e.z).col}`));
	expect(seen.size).toBe(118); // no two elements share a cell
});

test('building an atom: identity, charge, stability', () => {
	expect(identify({ protons: 6, neutrons: 6, electrons: 6 })).toMatchObject({
		massNumber: 12,
		charge: 0,
		stable: true
	});
	expect(identify({ protons: 6, neutrons: 8, electrons: 6 }).stable).toBe(false); // carbon-14
	expect(identify({ protons: 11, neutrons: 12, electrons: 10 }).charge).toBe(1); // Na⁺
});

test('orbital clouds: 90% of the 1s electron lies within ~2.7 Bohr radii; p has two lobes', () => {
	expect(radius90For1s()).toBeCloseTo(2.66, 2);
	const s = cloud('1s', 4000, 3);
	const inside = s.filter((p) => Math.hypot(p.x, p.y, p.z) < radius90For1s()).length / s.length;
	expect(inside).toBeGreaterThan(0.87);
	expect(inside).toBeLessThan(0.93);
	const p = cloud('2p', 2000, 5);
	expect(p.filter((q) => q.sign > 0).length / p.length).toBeCloseTo(0.5, 1);
	expect(p.every((q) => Math.sign(q.z) === q.sign || q.z === 0)).toBe(true);
});
