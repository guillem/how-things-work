// Checks the bonding, shape and polarity model behind the chemical-bonds explainer against
// real molecules. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BOILING,
	analyse,
	angleBetween,
	bond,
	capacity,
	lonePairs,
	molarMass,
	pairAngles,
	parse,
	refusal,
	relax,
	valence,
	type Molecule,
	type Sym
} from '../src/routes/chemical-bonds/model';

const mol = (centre: Sym, ...ligands: Sym[]): Molecule => ({ centre, ligands });
const H2O = mol('O', 'H', 'H');
const NH3 = mol('N', 'H', 'H', 'H');
const CH4 = mol('C', 'H', 'H', 'H', 'H');
const CO2 = mol('C', 'O', 'O');

/** Angle between the first two ligands of the given elements, as drawn. */
function drawnAngle(m: Molecule, a: Sym, b: Sym): number {
	const r = analyse(m);
	const bonds = r.domains.filter((d) => d.kind === 'bond');
	const da = bonds.find((d) => m.ligands[d.ligand!] === a)!;
	const db = bonds.find((d) => d !== da && m.ligands[d.ligand!] === b)!;
	return angleBetween(da.dir, db.dir);
}

test('outer electrons and the bonds each atom makes: H 1, C 4, N 3, O 2, Cl 1', () => {
	expect((['H', 'C', 'N', 'O', 'F', 'Cl', 'Na'] as Sym[]).map(valence)).toEqual([
		1, 4, 5, 6, 7, 7, 1
	]);
	expect((['H', 'C', 'N', 'O', 'F', 'Cl'] as Sym[]).map(capacity)).toEqual([1, 4, 3, 2, 1, 1]);
	expect((['C', 'N', 'O', 'F'] as Sym[]).map(lonePairs)).toEqual([0, 1, 2, 3]);
});

test('bond types from electronegativity: H–H pure, HF and HCl polar, NaCl ionic', () => {
	expect(bond('H', 'H').kind).toBe('nonpolar');
	expect(bond('C', 'H').kind).toBe('nonpolar'); // ΔEN 0.35
	expect(bond('H', 'Cl').kind).toBe('polar');
	expect(bond('H', 'F').kind).toBe('polar'); // ΔEN 1.78, still covalent
	expect(bond('H', 'F').pulls).toBe('F');
	expect(bond('Na', 'Cl').kind).toBe('ionic');
	expect(bond('Na', 'Cl').dEN).toBeCloseTo(2.23, 2);
});

test('building: octets are completed, and atoms that do not fit are refused', () => {
	expect(analyse(CH4).complete).toBe(true);
	expect(analyse(CH4).centreElectrons).toBe(8);
	expect(analyse(mol('C', 'H', 'H')).complete).toBe(false);
	expect(analyse(mol('C', 'H', 'H')).open).toBe(2);
	expect(refusal(mol('C', 'H', 'H', 'H'), 'O')).toContain('needs 2 bonds');
	expect(refusal(H2O, 'H')).toContain('no unpaired electrons');
	// CO2 uses two double bonds, HCN a triple bond, N2 a triple bond.
	expect(analyse(CO2).orders).toEqual([2, 2]);
	expect(analyse(mol('C', 'H', 'N')).orders).toEqual([1, 3]);
	expect(analyse(mol('N', 'N')).orders).toEqual([3]);
	// A saved molecule string survives a round trip, dropping atoms that do not fit.
	expect(parse('C:O,O', CH4)).toEqual(CO2);
	expect(parse('O:H,H,H', CH4)).toEqual(H2O);
});

test('names of familiar molecules', () => {
	expect(analyse(H2O).formula).toBe('H₂O');
	expect(analyse(H2O).name).toBe('water');
	expect(analyse(NH3).formula).toBe('NH₃');
	expect(analyse(mol('C', 'Cl', 'H', 'H', 'H')).formula).toBe('CH₃Cl');
	expect(analyse(mol('H', 'Cl')).name).toBe('hydrogen chloride');
	expect(analyse(mol('C', 'H', 'H', 'O')).name).toBe('formaldehyde');
});

test('VSEPR shapes of known molecules', () => {
	expect(analyse(CH4).shape).toBe('tetrahedral');
	expect(analyse(NH3).shape).toBe('trigonal pyramidal');
	expect(analyse(H2O).shape).toBe('bent');
	expect(analyse(CO2).shape).toBe('linear');
	expect(analyse(mol('C', 'H', 'N')).shape).toBe('linear');
	expect(analyse(mol('C', 'H', 'H', 'O')).shape).toBe('trigonal planar');
	expect(analyse(mol('H', 'Cl')).shape).toBe('linear');
});

test('bond angles: measured where known (CCCBDB), exact where symmetry fixes them', () => {
	expect(analyse(CH4).measured[0].degrees).toBeCloseTo(109.47, 2);
	expect(analyse(CO2).measured[0].degrees).toBe(180);
	expect(analyse(H2O).measured[0].degrees).toBeCloseTo(104.5, 1);
	expect(analyse(NH3).measured[0].degrees).toBeCloseTo(106.7, 1);
	// Lone pairs squeeze the bonds: CH4 > NH3 > H2O.
	expect(analyse(H2O).measured[0].degrees).toBeLessThan(analyse(NH3).measured[0].degrees);
	// The drawn 3D shape has the quoted angles.
	expect(drawnAngle(H2O, 'H', 'H')).toBeCloseTo(104.48, 1);
	expect(drawnAngle(NH3, 'H', 'H')).toBeCloseTo(106.67, 1);
	expect(drawnAngle(CH4, 'H', 'H')).toBeCloseTo(109.47, 1);
	expect(drawnAngle(CO2, 'O', 'O')).toBeCloseTo(180, 1);
	expect(drawnAngle(mol('C', 'H', 'H', 'O'), 'H', 'H')).toBeCloseTo(116.13, 1);
	expect(drawnAngle(mol('O', 'H', 'Cl'), 'H', 'Cl')).toBeCloseTo(102.45, 1);
	const ch2cl2 = mol('C', 'H', 'Cl', 'H', 'Cl');
	expect(drawnAngle(ch2cl2, 'H', 'H')).toBeCloseTo(112.1, 1);
	expect(drawnAngle(ch2cl2, 'Cl', 'Cl')).toBeCloseTo(112.2, 1);
});

test('polarity: water, ammonia, HCl, HCN, CH3Cl are polar; CO2, CH4, CCl4, N2, Cl2 are not', () => {
	const polar = [H2O, NH3, mol('N', 'F', 'F', 'F'), mol('H', 'Cl'), mol('C', 'H', 'N')];
	polar.push(mol('C', 'Cl', 'H', 'H', 'H'));
	for (const m of polar) expect(analyse(m).polar, analyse(m).formula).toBe(true);
	const not = [CO2, CH4, mol('C', 'Cl', 'Cl', 'Cl', 'Cl'), mol('N', 'N'), mol('Cl', 'Cl')];
	for (const m of not) expect(analyse(m).polar, analyse(m).formula).toBe(false);
	expect(analyse(CO2).polarity).toContain('cancel');
	expect(analyse(mol('Cl', 'Cl')).polarity).toContain('share equally');
	// In water the oxygen end is negative, the hydrogens positive.
	const w = analyse(H2O);
	expect(w.charges[0]).toBeLessThan(0);
	expect(w.charges[1]).toBeGreaterThan(0);
});

test('repulsion alone spreads 2–6 electron pairs into the VSEPR geometries', () => {
	const settled = (n: number) => pairAngles(relax(n).at(-1)!);
	expect(settled(2)).toEqual([180]);
	expect(settled(3)).toEqual([120]);
	expect(settled(4)).toEqual([109.5]);
	expect(settled(5)).toEqual([90, 120, 180]); // trigonal bipyramid
	expect(settled(6)).toEqual([90, 180]); // octahedron
});

test('similar masses, very different boiling points: water boils highest', () => {
	for (const b of BOILING) expect(molarMass(b.molecule)).toBeGreaterThan(15);
	for (const b of BOILING) expect(molarMass(b.molecule)).toBeLessThan(21);
	const water = BOILING.find((b) => analyse(b.molecule).name === 'water')!;
	const methane = BOILING.find((b) => analyse(b.molecule).name === 'methane')!;
	expect(water.kelvin - 273.15).toBeCloseTo(100, 0);
	expect(methane.kelvin - 273.15).toBeLessThan(-150);
});
