// Checks the atom model and element data behind the atoms-periodic-table explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ELEMENTS,
	ORDER,
	cell,
	cloud,
	density,
	element,
	identify,
	isException,
	isKnownIsotope,
	lastSubshell,
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

test('electronegativity: the Pauling values of the CRC Handbook (Allred 1961)', () => {
	expect(element(79).electronegativity).toBeCloseTo(2.54, 2); // gold
	expect(element(74).electronegativity).toBeCloseTo(2.36, 2); // tungsten
	expect(element(71).electronegativity).toBeCloseTo(1.27, 2); // lutetium, after thulium's 1.25
	expect(element(82).electronegativity).toBeCloseTo(2.33, 2); // lead
	expect(element(36).electronegativity).toBeCloseTo(3.0, 2); // krypton forms compounds
});

test('the last electron goes where the measured configurations say', () => {
	expect(lastSubshell(24)).toBe('3d'); // chromium: 3d⁵ 4s¹
	expect(lastSubshell(30)).toBe('4s'); // zinc completes 4s, not 3d
	expect(lastSubshell(64)).toBe('5d'); // gadolinium
	expect(lastSubshell(71)).toBe('5d'); // lutetium: 4f was full at ytterbium
	expect(lastSubshell(90)).toBe('6d'); // thorium has no 5f electrons
	expect(lastSubshell(103)).toBe('7p'); // lawrencium
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

test('a nucleus is stable, radioactive, or has never been observed (NUBASE2020)', () => {
	const nucleus = (protons: number, neutrons: number) =>
		identify({ protons, neutrons, electrons: protons }).nucleus;
	expect(nucleus(6, 6)).toBe('stable'); // carbon-12
	expect(nucleus(6, 8)).toBe('radioactive'); // carbon-14
	// Carbon's known isotopes run from carbon-8 to carbon-22; carbon-21 has never been seen.
	expect(identify({ protons: 6, neutrons: 2, electrons: 6 }).knownRange).toEqual([8, 22]);
	expect(nucleus(6, 0)).toBe('unknown');
	expect(nucleus(6, 1)).toBe('unknown'); // carbon-7: below the lightest, carbon-8
	expect(nucleus(6, 2)).toBe('radioactive');
	expect(nucleus(6, 15)).toBe('unknown'); // carbon-21
	expect(nucleus(6, 16)).toBe('radioactive'); // carbon-22
	expect(nucleus(6, 40)).toBe('unknown');
	expect(nucleus(92, 146)).toBe('radioactive'); // uranium-238
	expect(nucleus(118, 176)).toBe('radioactive'); // oganesson-294, the heaviest nucleus made
	expect(nucleus(118, 175)).toBe('unknown'); // oganesson-293: reported, but questioned
	expect(identify({ protons: 0, neutrons: 4, electrons: 0 }).nucleus).toBeNull();
	// Every stable isotope in the element data has, of course, been observed.
	for (const e of ELEMENTS) for (const a of e.stable) expect(isKnownIsotope(e.z, a)).toBe(true);
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

test("orbital nodes: hydrogen's 2s and 3p have a zero-density sphere, 3d a zero-density cone", () => {
	// Textbook nodes: 2s at r = 2 a₀, 3p at r = 6 a₀, 3d_z² where cos²θ = 1/3.
	expect(density('2s', 2, 0, 0)).toBeCloseTo(0, 12);
	expect(density('2s', 1, 0, 0)).toBeGreaterThan(0.01);
	expect(density('3p', 0, 0, 6)).toBeCloseTo(0, 12);
	expect(density('3p', 0, 0, 3)).toBeGreaterThan(0.01);
	const theta = Math.acos(1 / Math.sqrt(3));
	expect(density('3d', 5 * Math.sin(theta), 0, 5 * Math.cos(theta))).toBeCloseTo(0, 12);
	expect(density('3d', 0, 0, 5)).toBeGreaterThan(0.01);
});

test('every subshell in the measured configurations is in the filling order', () => {
	const known = new Set(ORDER.map((s) => s.label));
	for (const e of ELEMENTS)
		for (const k of parseConfig(e.config).keys()) expect(known).toContain(k);
});

test('stable isotopes: none whose decay has been observed', () => {
	// Decay observed: Kr-78 (double electron capture), Xe-124 (XENON1T, 2019), Ba-130
	// (geochemical), like Te-128/130 and Bi-209, which the data already leaves out.
	expect(element(36).stable).not.toContain(78);
	expect(element(54).stable).not.toContain(124);
	expect(element(56).stable).not.toContain(130);
	expect(element(52).stable).not.toContain(130);
	expect(element(54).stable).toContain(132);
});
