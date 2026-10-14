// Checks the carbon-chemistry and polymer models behind the carbon-polymers explainer against
// PubChem's names and formulas, NIST's measured data and textbook limiting cases. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	allBuilds,
	bondSums,
	family,
	formula,
	graph,
	key,
	molarMass,
	name,
	parse,
	refusal,
	VALENCE,
	type Build
} from '../src/routes/carbon-polymers/molecule';
import { capacity } from '../src/routes/chemical-bonds/model';
import { COMPOUNDS, BUILDS, EXTRAS } from '../src/routes/carbon-polymers/compounds';
import { DRAWN, layout, structureFormula } from '../src/routes/carbon-polymers/structures';
import { alkane3d, angle, distance } from '../src/routes/carbon-polymers/chain3d';
import {
	CENTRES,
	alignTwo,
	apply,
	bestFit,
	det,
	landsOn,
	mirror,
	rs
} from '../src/routes/carbon-polymers/chirality';
import {
	BROADHURST_FROM,
	PE_LIMIT,
	RUBBER,
	alkaneBoiling,
	alkaneMelting,
	broadhurst,
	gelPoint,
	shearModulus,
	stateAt,
	strandMass,
	stress,
	toC,
	youngs
} from '../src/routes/carbon-polymers/polymer';

const B = (n: number, opts: Partial<Build> = {}): Build => ({
	n,
	ring: false,
	aromatic: false,
	feature: null,
	at: 1,
	...opts
});
const data = (b: Build) => COMPOUNDS[BUILDS[key(b)]];
const extra = (label: string) => COMPOUNDS[EXTRAS[label]];

// Names PubChem gives as the traditional (retained) IUPAC name; the page shows both.
const RETAINED: Record<string, string> = {
	methanal: 'formaldehyde',
	ethanal: 'acetaldehyde',
	'methanoic acid': 'formic acid',
	'ethanoic acid': 'acetic acid',
	ethyne: 'acetylene'
};

test('every molecule the builder can make is named as PubChem names it, with its formula', () => {
	const all = allBuilds();
	expect(all.length).toBeGreaterThan(150);
	for (const b of all) {
		const c = data(b);
		expect(c, key(b)).toBeDefined();
		expect(RETAINED[name(b)] ?? name(b), key(b)).toBe(c.iupac);
		expect(formula(b, true), key(b)).toBe(c.formula);
	}
});

test('every atom keeps its valence: C 4, N 3, O 2, H and Cl 1 (as in chemical bonds)', () => {
	for (const el of ['C', 'N', 'O', 'H', 'Cl'] as const) expect(VALENCE[el]).toBe(capacity(el));
	for (const b of allBuilds()) {
		const g = graph(b);
		bondSums(g).forEach((s, i) => expect(s, `${key(b)} atom ${i}`).toBe(VALENCE[g.atoms[i].el]));
	}
});

test('the flat drawings have the same formulas as the molecules', () => {
	for (const b of allBuilds())
		expect(structureFormula(layout(b), true), key(b)).toBe(formula(b, true));
	expect(structureFormula(DRAWN.ibuprofen, true)).toBe(extra('ibuprofen').formula);
	expect(structureFormula(DRAWN.glucose, true)).toBe(extra('glucose').formula);
	expect(structureFormula(DRAWN.alanine, true)).toBe(extra('alanine').formula);
	expect(structureFormula(DRAWN.ethanol, true)).toBe('C2H6O');
	expect(structureFormula(DRAWN['dimethyl ether'], true)).toBe('C2H6O');
	expect(structureFormula(DRAWN.isobutane, true)).toBe('C4H10');
});

test('impossible molecules are refused', () => {
	expect(refusal(B(4, { feature: 'COOH', at: 2 }))).toMatch(/end of a chain/);
	expect(refusal(B(6, { ring: true, feature: 'triple', at: 1 }))).toMatch(/straight/);
	expect(refusal(B(6, { ring: true, aromatic: true, feature: 'CO', at: 1 }))).toMatch(
		/one hydrogen/
	);
	expect(refusal(B(2, { ring: true }))).toMatch(/three carbons/);
	expect(refusal(B(1, { feature: 'double', at: 1 }))).toMatch(/two carbons/);
	// A refused state in a saved URL falls back.
	expect(parse('4|COOH@2', B(3))).toEqual(B(3));
	expect(parse('5|OH@4', B(3))).toEqual(B(5, { feature: 'OH', at: 4 }));
});

test('the same group at either end is the same molecule, named from the nearer end', () => {
	expect(name(B(5, { feature: 'OH', at: 4 }))).toBe('pentan-2-ol');
	expect(name(B(6, { feature: 'double', at: 5 }))).toBe('hex-1-ene');
	expect(key(B(6, { feature: 'Cl', at: 6 }))).toBe(key(B(6, { feature: 'Cl', at: 1 })));
	expect(family(B(3, { feature: 'CO', at: 1 }))).toBe('aldehyde');
	expect(family(B(3, { feature: 'CO', at: 2 }))).toBe('ketone');
});

test('molar masses from the atomic weights', () => {
	expect(molarMass(B(1))).toBeCloseTo(16.04, 2);
	expect(molarMass(B(2, { feature: 'OH' }))).toBeCloseTo(46.07, 2);
	expect(molarMass(B(6, { ring: true, aromatic: true }))).toBeCloseTo(78.11, 2);
});

test('boiling points (NIST): longer chains boil higher, and an –OH raises it a lot', () => {
	const tb = (b: Build) => data(b).tb!;
	for (let n = 1; n < 8; n++) expect(tb(B(n + 1))).toBeGreaterThan(tb(B(n)));
	expect(toC(tb(B(1)))).toBeCloseTo(-162, 0); // methane
	expect(toC(tb(B(8)))).toBeCloseTo(126, 0); // octane
	// Ethane −89 °C, ethanol 78 °C: one oxygen, hydrogen bonds.
	expect(toC(tb(B(2)))).toBeCloseTo(-89, 0);
	expect(toC(tb(B(2, { feature: 'OH' })))).toBeCloseTo(78, 0);
	// Acetic acid (vinegar) 118 °C.
	expect(toC(tb(B(2, { feature: 'COOH' })))).toBeCloseTo(118, 0);
});

test('isomers: the same atoms arranged differently boil at very different temperatures', () => {
	const eth = extra('ethanol');
	const ether = extra('dimethyl ether');
	expect(eth.formula).toBe(ether.formula);
	expect(toC(eth.tb!)).toBeCloseTo(78, 0);
	expect(toC(ether.tb!)).toBeCloseTo(-25, 0);
	expect(toC(extra('butane').tb!)).toBeCloseTo(0, 0);
	expect(toC(extra('isobutane').tb!)).toBeCloseTo(-11, 0);
	expect(toC(data(B(3, { feature: 'OH', at: 1 })).tb!)).toBeCloseTo(97, 0);
	expect(toC(data(B(3, { feature: 'OH', at: 2 })).tb!)).toBeCloseTo(82, 0);
});

test('at 25 °C the alkanes run from gas (C1–C4) to liquid (C5–C17) to wax (C18 on)', () => {
	const st = (n: number) => stateAt(alkaneBoiling(n), alkaneMelting(n)?.k);
	for (let n = 1; n <= 4; n++) expect(st(n), `C${n}`).toBe('gas');
	for (let n = 5; n <= 16; n++) expect(st(n), `C${n}`).toBe('liquid');
	expect(alkaneMelting(17)!.k).toBeLessThan(298.15);
	for (const n of [18, 20, 30, 100, 10000]) expect(alkaneMelting(n)!.k).toBeGreaterThan(298.15);
});

test('Broadhurst: melting points of long chains climb towards polyethylene, 141 °C', () => {
	// The fit joins the measured melting points where it takes over.
	expect(broadhurst(43)).toBeCloseTo(alkaneMelting(43)!.k, 0);
	expect(alkaneMelting(BROADHURST_FROM + 1)!.measured).toBe(false);
	expect(toC(PE_LIMIT)).toBeCloseTo(141.15, 2);
	expect(toC(broadhurst(1e6))).toBeCloseTo(141.15, 1);
	expect(broadhurst(1000)).toBeLessThan(PE_LIMIT);
});

test('measured geometry: zigzag chains with C–C 1.53 Å and C–C–C 112°', () => {
	const m = alkane3d(5);
	const C = m.atoms.filter((a) => a.el === 'C').map((a) => a.pos);
	expect(distance(C[0], C[1])).toBeCloseTo(1.526, 3);
	expect(angle(C[0], C[1], C[2])).toBeCloseTo(112.4, 1);
	// Every C–H bond 1.09 Å; every carbon has four neighbours.
	for (const [a, b] of m.bonds) {
		const [p, q] = [m.atoms[a], m.atoms[b]];
		if (q.el === 'H') expect(distance(p.pos, q.pos)).toBeCloseTo(1.09, 1);
	}
	m.atoms.forEach((a, i) => {
		if (a.el === 'C') expect(m.bonds.filter((b) => b.includes(i)).length).toBe(4);
	});
	expect(m.atoms.filter((a) => a.el === 'H').length).toBe(12);
	// Methane: a perfect tetrahedron.
	const ch4 = alkane3d(1);
	expect(angle(ch4.atoms[1].pos, ch4.atoms[0].pos, ch4.atoms[2].pos)).toBeCloseTo(109.47, 2);
	// Ethane: H–C–C 110.9°.
	const e = alkane3d(2);
	const h = e.bonds.find(([a, b]) => a === 0 && e.atoms[b].el === 'H')!;
	expect(angle(e.atoms[h[1]].pos, e.atoms[0].pos, e.atoms[1].pos)).toBeCloseTo(110.91, 1);
});

test('a carbon with four different groups cannot be turned onto its mirror image', () => {
	const chiral = CENTRES.find((c) => c.id === 'CHFClBr')!;
	const P = chiral.groups.map((g) => g.pos);
	const M = P.map(mirror);
	const fit = bestFit(M, P);
	expect(det(fit.R)).toBeCloseTo(1, 6);
	expect(fit.rms).toBeGreaterThan(0.3);
	// Line up H and F exactly: Cl and Br then sit in each other's places.
	const iH = chiral.groups.findIndex((g) => g.el === 'H');
	const iF = chiral.groups.findIndex((g) => g.el === 'F');
	const R = alignTwo(M, P, iH, iF);
	expect(det(R)).toBeCloseTo(1, 6);
	const moved = M.map((p) => apply(R, p));
	const lands = landsOn(moved, P, 0.45);
	const iCl = chiral.groups.findIndex((g) => g.el === 'Cl');
	const iBr = chiral.groups.findIndex((g) => g.el === 'Br');
	expect(lands[iH]).toBe(iH);
	expect(lands[iF]).toBe(iF);
	expect(lands[iCl]).toBe(iBr);
	expect(lands[iBr]).toBe(iCl);
	// Swap the bromine for a second hydrogen (CH₂FCl): now the mirror image fits exactly.
	const achiral = CENTRES.find((c) => c.id === 'CH2FCl')!;
	const Q = achiral.groups.map((g) => g.pos);
	// Its two hydrogens are interchangeable: try both labellings.
	const iHs = achiral.groups.map((g, i) => (g.el === 'H' ? i : -1)).filter((i) => i >= 0);
	const swapped = Q.map(mirror).map((p, i, arr) =>
		i === iHs[0] ? arr[iHs[1]] : i === iHs[1] ? arr[iHs[0]] : p
	);
	const best = Math.min(bestFit(Q.map(mirror), Q).rms, bestFit(swapped, Q).rms);
	expect(best).toBeLessThan(0.01);
});

test('alanine as drawn is L-alanine, (S), the form in proteins; its mirror image is (R)', () => {
	const ala = CENTRES.find((c) => c.id === 'alanine')!;
	const by = (l: string) => ala.groups.find((g) => g.label === l)!.pos;
	// CIP priorities: NH₂ > COOH > CH₃ > H.
	const order = ['NH₂', 'COOH', 'CH₃', 'H'].map(by);
	expect(rs(order)).toBe('S');
	expect(rs(order.map(mirror))).toBe('R');
	// Bromochlorofluoromethane: priorities Br > Cl > F > H; the mirror flips the label.
	const c = CENTRES.find((x) => x.id === 'CHFClBr')!;
	const p = ['Br', 'Cl', 'F', 'H'].map((el) => c.groups.find((g) => g.el === el)!.pos);
	expect(rs(p)).not.toBe(rs(p.map(mirror)));
});

test('rubber: stiffness grows with cross-links and with chain length (ideal network)', () => {
	// ρRT/Mc for very long chains: Mc = 5 kg/mol → 0.448 MPa.
	expect(shearModulus(1e12, 5000) / 1e6).toBeCloseTo((903.02 * 8.314462618 * 298.15) / 5 / 1e6, 4);
	expect(shearModulus(1e12, 5000) / 1e6).toBeCloseTo(0.448, 3);
	// No cross-links, or too few to tie the chains together (Mn ≤ 2Mc): no network, it flows.
	expect(shearModulus(RUBBER.chainMass, strandMass(0))).toBe(0);
	const gel = gelPoint(RUBBER.chainMass);
	expect(shearModulus(RUBBER.chainMass, strandMass(gel * 0.99))).toBe(0);
	expect(shearModulus(RUBBER.chainMass, strandMass(gel * 1.5))).toBeGreaterThan(0);
	// More cross-links: stiffer. Longer chains at the same cross-links: stiffer (fewer loose ends).
	const G = (x: number, Mn = RUBBER.chainMass) => shearModulus(Mn, strandMass(x));
	expect(G(1)).toBeGreaterThan(G(0.5));
	expect(G(0.5, 400000)).toBeGreaterThan(G(0.5, 100000));
	// One cross-link per 100 units of natural rubber: E ≈ 1.8 MPa, a rubber band.
	expect(youngs(G(1)) / 1e6).toBeGreaterThan(1);
	expect(youngs(G(1)) / 1e6).toBeLessThan(3);
	// Neo-Hookean stretch: E = 3G is the slope at λ = 1; no stress unstretched.
	expect(stress(G(1), 1)).toBe(0);
	const dl = 1e-6;
	expect(stress(G(1), 1 + dl) / dl).toBeCloseTo(youngs(G(1)), -2);
	// Natural rubber density from Wood's specific volume, 1.1074 cm³/g.
	expect(RUBBER.density).toBeCloseTo(903.0, 1);
	expect(RUBBER.unitMass).toBeCloseTo(68.12, 2);
});
