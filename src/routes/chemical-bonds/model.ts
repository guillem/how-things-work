/**
 * Chemical bonds: the model behind the explainer.
 *
 * Element data (group, electronegativity, covalent radius, mass) comes from the
 * atoms-periodic-table explainer's mendeleev extract (`../atoms-periodic-table/elements.ts`);
 * nothing is retyped here.
 *
 * - Valence electrons: the group number for groups 1–2, the group number minus 10 for
 *   groups 13–18 (main-group elements only).
 * - Bonding capacity (how many bonds an atom forms to complete its shell): its valence
 *   electrons if it has four or fewer, otherwise the electrons it lacks for an octet
 *   (8 − valence). H 1, C 4, N 3, O 2, F 1, Cl 1. Hydrogen's full shell holds 2.
 * - Molecules are "star" molecules: one centre atom and terminal atoms around it. A
 *   terminal atom bonds with its whole capacity (O makes a double bond, N a triple
 *   bond), so the bond order is the terminal atom's capacity.
 * - Bond type from the electronegativity difference ΔEN (Pauling scale). The bands are
 *   the general guide of OpenStax Chemistry 2e, §7.2, Figure 7.8 ("just a general guide,
 *   with many exceptions"): pure covalent below 0.4, polar covalent 0.4–1.8, ionic above
 *   1.8. Hydrogen fluoride (ΔEN 1.78) is polar covalent.
 * - Shape: VSEPR. Bonds (single or multiple) and lone pairs on the centre are electron
 *   domains that repel each other and spread as far apart as they can: 2 → linear (180°),
 *   3 → trigonal planar (120°), 4 → tetrahedral (109.47° = arccos(−1/3)). The shape is
 *   named after the atoms only. `relax()` shows that the arrangements follow from
 *   repulsion alone: points on a sphere pushing each other apart (the Thomson problem)
 *   settle into exactly these geometries (and, for 5 and 6, the trigonal bipyramid and
 *   the octahedron).
 * - Measured bond angles are from NIST CCCBDB, "Experimental bond angles"
 *   (https://cccbdb.nist.gov/expangle2x.asp, accessed 2026-10-12); angles fixed by
 *   symmetry (180°, 120°, 109.47°) need no table. Where a molecule has no measured value
 *   here, it is drawn at the VSEPR ideal and labelled as such.
 * - Polarity: each bond contributes a vector towards its more electronegative atom,
 *   proportional to ΔEN (qualitative, not a computed dipole moment). The molecule is
 *   polar if these do not cancel, or if lone pairs sit on one side of a molecule of three
 *   or more atoms (bent, pyramidal), since lone pairs are themselves lopsided charge.
 *   The "charge" of each atom used for the charge map is the same qualitative guide: the
 *   sum of the ΔEN of its bonds, signed.
 */
import { ELEMENTS, type Element } from '../atoms-periodic-table/atom';

// ------------------------------------------------------------------ atoms

/** The elements the explainer works with. */
export const SYMBOLS = ['H', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Cl'] as const;
export type Sym = (typeof SYMBOLS)[number];

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));

export function data(sym: Sym): Element {
	const e = BY_SYMBOL.get(sym);
	if (!e) throw new Error(`unknown element ${sym}`);
	return e;
}

/** Electrons in the outer shell (main-group elements). */
export function valence(sym: Sym): number {
	const g = data(sym).group ?? 0;
	return g <= 2 ? g : g - 10;
}

/** Electrons that fill the outer shell: 2 for hydrogen, 8 otherwise. */
export const fullShell = (sym: Sym) => (sym === 'H' ? 2 : 8);

/** How many bonds the atom forms to fill its outer shell (its unpaired electrons). */
export function capacity(sym: Sym): number {
	const v = valence(sym);
	return sym === 'H' ? 1 : v <= 4 ? v : 8 - v;
}

/** Lone pairs the atom keeps once its bonds are made. */
export const lonePairs = (sym: Sym) => (valence(sym) - capacity(sym)) / 2;

export const electronegativity = (sym: Sym) => data(sym).electronegativity ?? 0;

// ------------------------------------------------------------------ bonds

export type BondKind = 'nonpolar' | 'polar' | 'ionic';

/** Bond between two atoms, classified by their electronegativity difference. */
export function bond(a: Sym, b: Sym) {
	const d = electronegativity(b) - electronegativity(a);
	const dEN = Math.abs(d);
	const kind: BondKind = dEN < 0.4 ? 'nonpolar' : dEN <= 1.8 ? 'polar' : 'ionic';
	/** The atom that pulls the shared electrons harder (null if neither). */
	const pulls: Sym | null = d > 0 ? b : d < 0 ? a : null;
	return { dEN, kind, pulls };
}

// ------------------------------------------------------------------ molecules

/** Elements that can sit in the middle of a built molecule, and at its ends. */
export const CENTRES: Sym[] = ['C', 'N', 'O', 'F', 'Cl', 'H'];
export const TERMINALS: Sym[] = ['H', 'O', 'N', 'F', 'Cl'];

export interface Molecule {
	centre: Sym;
	ligands: Sym[];
}

/** "C:HHOO" ⇄ { centre: 'C', ligands: ['H','H','O','O'] }. */
export function serialize(m: Molecule): string {
	return `${m.centre}:${m.ligands.join(',')}`;
}
export function parse(s: string | undefined | null, fallback: Molecule): Molecule {
	if (!s) return fallback;
	const [c, rest = ''] = s.split(':');
	const isSym = (x: string): x is Sym => (SYMBOLS as readonly string[]).includes(x);
	if (!isSym(c) || !CENTRES.includes(c)) return fallback;
	const ligands = rest
		.split(',')
		.filter((x) => x !== '')
		.filter(isSym);
	const m = { centre: c, ligands: [] as Sym[] };
	for (const l of ligands) if (canAdd(m, l)) m.ligands.push(l);
	return m;
}

/** Bonds still open on the centre (its unpaired electrons). */
export function openBonds(m: Molecule): number {
	return capacity(m.centre) - m.ligands.reduce((s, l) => s + capacity(l), 0);
}

/** Why `sym` can't be added, or null if it can. */
export function refusal(m: Molecule, sym: Sym): string | null {
	if (!TERMINALS.includes(sym)) return `${sym} can't be added here`;
	const open = openBonds(m);
	const need = capacity(sym);
	if (open <= 0) return `${m.centre} has no unpaired electrons left`;
	if (need > open) return `${sym} needs ${need} bonds; ${m.centre} has only ${open} left`;
	return null;
}
export const canAdd = (m: Molecule, sym: Sym) => refusal(m, sym) === null;

// Formula in the usual order (Hill order for carbon compounds; otherwise H first for
// acids, centre first for the rest), with subscripts.
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => (n > 1 ? [...String(n)].map((d) => SUB[+d]).join('') : '');
export function formula(m: Molecule): string {
	const counts = new Map<Sym, number>();
	const add = (s: Sym) => counts.set(s, (counts.get(s) ?? 0) + 1);
	add(m.centre);
	m.ligands.forEach(add);
	let order: Sym[];
	if (counts.has('C')) order = ['C', 'H', 'Cl', 'F', 'N', 'O'];
	else if (m.ligands.length === 1 && (m.centre === 'H' || m.ligands[0] === 'H'))
		order = ['H', 'F', 'Cl', 'O', 'N'];
	else if (m.centre === 'O' && m.ligands.includes('H') && m.ligands.length === 2)
		order = ['H', 'O', 'Cl', 'F', 'N']; // HOCl, H2O
	else order = [m.centre, ...SYMBOLS.filter((s) => s !== m.centre)];
	return order
		.filter((s) => counts.has(s))
		.map((s) => s + sub(counts.get(s)!))
		.join('');
}

/** Common names of the molecules a reader is likely to build. */
const NAMES: Record<string, string> = {
	H2: 'hydrogen',
	HF: 'hydrogen fluoride',
	HCl: 'hydrogen chloride',
	F2: 'fluorine',
	Cl2: 'chlorine',
	ClF: 'chlorine monofluoride',
	O2: 'oxygen',
	N2: 'nitrogen',
	H2O: 'water',
	NH3: 'ammonia',
	CH4: 'methane',
	CO2: 'carbon dioxide',
	HCN: 'hydrogen cyanide',
	CH2O: 'formaldehyde',
	CCl4: 'carbon tetrachloride',
	CF4: 'tetrafluoromethane',
	CH3Cl: 'chloromethane',
	CH2Cl2: 'dichloromethane',
	CHCl3: 'chloroform',
	CH3F: 'fluoromethane',
	CH2F2: 'difluoromethane',
	NF3: 'nitrogen trifluoride',
	NCl3: 'nitrogen trichloride',
	OF2: 'oxygen difluoride',
	Cl2O: 'dichlorine monoxide',
	HOCl: 'hypochlorous acid',
	H2O2: 'hydrogen peroxide'
};
const plain = (f: string) => [...f].map((c) => (SUB.includes(c) ? SUB.indexOf(c) : c)).join('');
export const commonName = (m: Molecule) => NAMES[plain(formula(m))] ?? null;

// ------------------------------------------------------------------ shape

export type Shape =
	'single atom' | 'linear' | 'bent' | 'trigonal planar' | 'trigonal pyramidal' | 'tetrahedral';

/** Ideal angle between electron domains for 2, 3 and 4 domains (degrees). */
export const TETRAHEDRAL = (Math.acos(-1 / 3) * 180) / Math.PI;
export const IDEAL: Record<number, number> = { 2: 180, 3: 120, 4: TETRAHEDRAL };

export function shapeOf(bonded: number, lone: number): Shape {
	if (bonded === 0) return 'single atom';
	if (bonded === 1) return 'linear';
	const sn = bonded + lone;
	if (sn === 2) return 'linear';
	if (sn === 3) return lone === 0 ? 'trigonal planar' : 'bent';
	if (lone === 0) return 'tetrahedral';
	return lone === 1 ? 'trigonal pyramidal' : 'bent';
}

/** Angle measured for a molecule, between two of its outer atoms. */
export interface Measured {
	between: [Sym, Sym];
	degrees: number;
}

// NIST CCCBDB, "Experimental bond angles" (cccbdb.nist.gov/expangle2x.asp, accessed
// 2026-10-12). Keys are `centre:ligands` with the ligands sorted. Angles fixed by symmetry
// (CO2, HCN 180°; CH4, CF4, CCl4 109.47°) are not listed: they follow from the shape.
const MEASURED: Record<string, Measured[]> = {
	'O:H,H': [{ between: ['H', 'H'], degrees: 104.48 }], // H2O (equilibrium)
	'N:H,H,H': [{ between: ['H', 'H'], degrees: 106.67 }], // NH3
	'N:F,F,F': [{ between: ['F', 'F'], degrees: 102.37 }], // NF3
	'N:Cl,Cl,Cl': [{ between: ['Cl', 'Cl'], degrees: 107.78 }], // NCl3
	'O:F,F': [{ between: ['F', 'F'], degrees: 103.1 }], // OF2
	'O:Cl,Cl': [{ between: ['Cl', 'Cl'], degrees: 110.88 }], // Cl2O
	'O:Cl,H': [{ between: ['H', 'Cl'], degrees: 102.45 }], // HOCl
	'C:H,H,O': [{ between: ['H', 'H'], degrees: 116.13 }], // formaldehyde
	'C:Cl,H,H,H': [{ between: ['H', 'H'], degrees: 110.75 }], // CH3Cl
	'C:Cl,Cl,H,H': [
		{ between: ['H', 'H'], degrees: 112.1 },
		{ between: ['Cl', 'Cl'], degrees: 112.2 }
	], // CH2Cl2
	'C:Cl,Cl,Cl,H': [{ between: ['Cl', 'Cl'], degrees: 110.92 }], // CHCl3
	'C:F,H,H,H': [{ between: ['H', 'H'], degrees: 110.2 }], // CH3F
	'C:F,F,H,H': [{ between: ['H', 'H'], degrees: 112.8 }] // CH2F2
};

const key = (m: Molecule) => `${m.centre}:${[...m.ligands].sort().join(',')}`;

export type Vec = [number, number, number];

export interface Domain {
	kind: 'bond' | 'lone' | 'single';
	/** Index into `ligands` for a bond. */
	ligand?: number;
	/** Unit vector from the centre. */
	dir: Vec;
}

export interface Analysis {
	molecule: Molecule;
	formula: string;
	name: string | null;
	/** Every atom has a full outer shell. */
	complete: boolean;
	/** Unpaired electrons left on the centre. */
	open: number;
	lone: number;
	/** Bond order to each ligand. */
	orders: number[];
	/** Electron domains around the centre (bonds + lone pairs + unpaired electrons). */
	domains: Domain[];
	shape: Shape;
	/** The VSEPR angle between bonds (null for fewer than two bonds). */
	ideal: number | null;
	/** Measured angles (CCCBDB) or angles fixed by symmetry. */
	measured: Measured[];
	/** The angles in `measured` come from symmetry, not from a table. */
	bySymmetry: boolean;
	/** Electrons around the centre: shared (2 per bond) + lone pairs + unpaired. */
	centreElectrons: number;
	polar: boolean;
	/** Net polarity vector (points to the negative end; qualitative). */
	dipole: Vec;
	/** Qualitative partial charge per atom: centre first, then each ligand. */
	charges: number[];
	/** Why the molecule is or isn't polar. */
	polarity: string;
}

// ---- small vector helpers
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const addv = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const len = (a: Vec) => Math.sqrt(dot(a, a));
const unit = (a: Vec): Vec => scale(a, 1 / (len(a) || 1));
export const angleBetween = (a: Vec, b: Vec) =>
	(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Directions for `n` domains split into groups (sizes in order). The first group points
 * down (−z), the second up, as in the usual drawings. `angles[i]` is the angle within
 * group i (null: ideal).
 */
function arrange(groups: number[], angles: (number | null)[]): Vec[] {
	const n = groups.reduce((a, b) => a + b, 0);
	if (n === 1) return [[0, 0, -1]];
	if (n === 2)
		return [
			[-1, 0, 0],
			[1, 0, 0]
		];
	if (n === 3) {
		// In the xz plane. A pair at ±θ/2 from −z, the third along +z.
		const pairFirst = groups[0] === 2 ? 0 : groups[1] === 2 ? 1 : -1;
		const theta = rad((pairFirst >= 0 ? angles[pairFirst] : null) ?? 120);
		const pair: Vec[] = [
			[-Math.sin(theta / 2), 0, -Math.cos(theta / 2)],
			[Math.sin(theta / 2), 0, -Math.cos(theta / 2)]
		];
		const third: Vec = [0, 0, 1];
		if (pairFirst === 1) return [third, ...pair];
		return [...pair, third];
	}
	// n === 4
	const sizes = groups.join('+');
	if (sizes === '3+1' || sizes === '1+3') {
		const tri = sizes === '3+1' ? 0 : 1;
		const theta = rad(angles[tri] ?? TETRAHEDRAL);
		// Three vectors at polar angle α from −z, 120° apart: cos θ = cos²α + sin²α·cos 120°.
		const c = Math.sqrt((1 + 2 * Math.cos(theta)) / 3);
		const s = Math.sqrt(1 - c * c);
		const three: Vec[] = [0, 1, 2].map((k) => {
			const phi = rad(90 + 120 * k);
			return [s * Math.cos(phi), s * Math.sin(phi), -c];
		});
		return tri === 0 ? [...three, [0, 0, 1]] : [[0, 0, 1], ...three];
	}
	// 2+2, 2+1+1, 1+1+2, 1+2+1, 1+1+1+1: two pairs in perpendicular planes.
	const a = rad((groups[0] === 2 ? angles[0] : null) ?? TETRAHEDRAL);
	const secondPair = groups[0] === 2 && groups[1] === 2 ? angles[1] : null;
	const b = rad(secondPair ?? TETRAHEDRAL);
	return [
		[-Math.sin(a / 2), 0, -Math.cos(a / 2)],
		[Math.sin(a / 2), 0, -Math.cos(a / 2)],
		[0, -Math.sin(b / 2), Math.cos(b / 2)],
		[0, Math.sin(b / 2), Math.cos(b / 2)]
	];
}

export function analyse(m: Molecule): Analysis {
	const orders = m.ligands.map((l) => capacity(l));
	const open = openBonds(m);
	const lone = lonePairs(m.centre);
	const complete = m.ligands.length > 0 && open === 0;
	const sn = m.ligands.length + lone + open;
	const tableKey = key(m);
	const table = complete ? (MEASURED[tableKey] ?? []) : [];

	// Group the domains: ligands by element, then lone pairs, then unpaired electrons.
	type Item = { kind: Domain['kind']; ligand?: number; tag: string };
	const items: Item[] = [
		...m.ligands.map((l, i) => ({ kind: 'bond' as const, ligand: i, tag: l })),
		...Array.from({ length: lone }, () => ({ kind: 'lone' as const, tag: 'lone' })),
		...Array.from({ length: open }, () => ({ kind: 'single' as const, tag: 'single' }))
	];
	const tags = [...new Set(items.map((it) => it.tag))];
	// Largest group first, so the measured angle lands on the right pair.
	tags.sort(
		(x, y) => items.filter((it) => it.tag === y).length - items.filter((it) => it.tag === x).length
	);
	// A measured angle names its pair; that group goes first (the pair or the triangle).
	const named = table[0]?.between[0];
	if (named && named === table[0].between[1]) {
		tags.splice(tags.indexOf(named), 1);
		tags.unshift(named);
		// A second measured pair (CH2Cl2) goes second.
		const second = table[1]?.between[0];
		if (second) {
			tags.splice(tags.indexOf(second), 1);
			tags.splice(1, 0, second);
		}
	}
	const ordered = tags.flatMap((tg) => items.filter((it) => it.tag === tg));
	const groups = tags.map((tg) => items.filter((it) => it.tag === tg).length);
	const angles = tags.map(
		(tg) => table.find((t) => t.between[0] === tg && t.between[1] === tg)?.degrees ?? null
	);
	let dirs = sn > 0 ? arrange(groups, angles) : [];
	// HOCl: the one measured angle is between two different atoms (H and Cl). Both are
	// singletons in a bent shape with two lone pairs: place them as the first pair.
	const mixed = table.find((t) => t.between[0] !== t.between[1]);
	if (mixed && sn === 4) {
		const iH = ordered.findIndex((it) => it.tag === mixed.between[0]);
		const iCl = ordered.findIndex((it) => it.tag === mixed.between[1]);
		const lp = ordered.map((it, i) => (it.kind === 'lone' ? i : -1)).filter((i) => i >= 0);
		const reordered = [ordered[iH], ordered[iCl], ...lp.map((i) => ordered[i])];
		ordered.splice(0, ordered.length, ...reordered);
		dirs = arrange([2, 2], [mixed.degrees, null]);
	}
	const domains: Domain[] = ordered.map((it, i) => ({
		kind: it.kind,
		ligand: it.ligand,
		dir: dirs[i]
	}));

	const shape = complete ? shapeOf(m.ligands.length, lone) : 'single atom';
	const ideal = complete && m.ligands.length >= 2 ? IDEAL[sn] : null;
	let measured = table;
	let bySymmetry = false;
	const same = m.ligands.every((l) => l === m.ligands[0]);
	if (complete && !measured.length && m.ligands.length >= 2) {
		// Fixed by symmetry: linear, or all-identical with no lone pairs.
		if (shape === 'linear' || (same && lone === 0)) {
			const a = m.ligands[0];
			const b = shape === 'linear' ? m.ligands[1] : a;
			measured = [{ between: [a, b], degrees: ideal! }];
			bySymmetry = true;
		}
	}

	// Polarity (qualitative): bond vectors towards the more electronegative atom.
	const enC = electronegativity(m.centre);
	let dipole: Vec = [0, 0, 0];
	const charges = [0, ...m.ligands.map(() => 0)];
	for (const d of domains) {
		if (d.kind !== 'bond' || d.ligand === undefined) continue;
		const diff = electronegativity(m.ligands[d.ligand]) - enC;
		dipole = addv(dipole, scale(d.dir, diff));
		charges[d.ligand + 1] -= diff;
		charges[0] += diff;
	}
	const net = len(dipole);
	const anyPolarBond = m.ligands.some((l) => bond(m.centre, l).dEN > 0);
	const lopsided = lone > 0 && m.ligands.length >= 2;
	const polar = complete && (net > 0.02 || lopsided);
	let polarity: string;
	if (!complete) polarity = 'unfinished';
	else if (polar)
		polarity = lopsided
			? 'polar: the shape is lopsided, so charge is uneven'
			: 'polar: the bonds pull one way';
	else if (!anyPolarBond) polarity = 'not polar: the bonds share equally';
	else polarity = 'not polar: the polar bonds cancel out by symmetry';

	return {
		molecule: m,
		formula: formula(m),
		name: complete ? commonName(m) : null,
		complete,
		open,
		lone,
		orders,
		domains,
		shape,
		ideal,
		measured,
		bySymmetry,
		centreElectrons: valence(m.centre) + orders.reduce((a, b) => a + b, 0),
		polar,
		dipole,
		charges,
		polarity
	};
}

// ------------------------------------------------------------------ repulsion

/**
 * `n` points on a sphere pushing each other apart (Coulomb, 1/r²), from a fixed scrambled
 * start, by damped gradient steps. Returns `frames` snapshots, the last one settled.
 */
export function relax(n: number, frames = 120, stepsPerFrame = 2): Vec[][] {
	// A fixed, deliberately lopsided start (all in one hemisphere) so the spreading shows.
	let pts: Vec[] = Array.from({ length: n }, (_, i) => {
		const phi = 0.9 + i * 2.39996; // golden angle
		const z = 0.55 + 0.4 * ((i * 0.618) % 1);
		const r = Math.sqrt(1 - z * z);
		return unit([r * Math.cos(phi), r * Math.sin(phi), z]);
	});
	const out: Vec[][] = [pts.map((p) => [...p] as Vec)];
	for (let f = 1; f < frames; f++) {
		for (let s = 0; s < stepsPerFrame; s++) {
			pts = pts.map((p, i) => {
				let force: Vec = [0, 0, 0];
				pts.forEach((q, j) => {
					if (i === j) return;
					const d: Vec = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
					const r = len(d) || 1e-6;
					force = addv(force, scale(d, 1 / (r * r * r)));
				});
				// Keep only the part along the sphere, and cap the step.
				const tangent = addv(force, scale(p, -dot(force, p)));
				const t = len(tangent);
				const stepLen = Math.min(0.08, 0.15 * t);
				return unit(addv(p, scale(tangent, t ? stepLen / t : 0)));
			});
		}
		out.push(pts.map((p) => [...p] as Vec));
	}
	return out;
}

/** The distinct angles (degrees, rounded to 0.1) between every pair of points. */
export function pairAngles(pts: Vec[]): number[] {
	const set = new Set<number>();
	for (let i = 0; i < pts.length; i++)
		for (let j = i + 1; j < pts.length; j++)
			set.add(Math.round(angleBetween(pts[i], pts[j]) * 10) / 10);
	return [...set].sort((a, b) => a - b);
}

// ------------------------------------------------------------------ properties

/** Molar mass (g/mol) from the standard atomic weights in the element data. */
export const molarMass = (m: Molecule) =>
	[m.centre, ...m.ligands].reduce((s, a) => s + (data(a).mass ?? 0), 0);

/**
 * Normal boiling points (K) of four small molecules of similar mass, from the NIST
 * Chemistry WebBook (webbook.nist.gov, phase-change data, accessed 2026-10-12):
 * CH4 111 ± 2 K (average of 13 values); HF 292.7 K (Streng 1971); H2O 373.17 K
 * (average of 7 values). NH3: the WebBook gives no Tboil; 239.81 K (−33.34 °C) is the
 * value in Wikipedia's ammonia infobox, consistent with the WebBook's enthalpy of
 * vaporization measured at the boiling point, 239 K (Overstreet and Giauque 1937).
 */
export const BOILING: { molecule: Molecule; kelvin: number }[] = [
	{ molecule: { centre: 'C', ligands: ['H', 'H', 'H', 'H'] }, kelvin: 111 },
	{ molecule: { centre: 'N', ligands: ['H', 'H', 'H'] }, kelvin: 239.81 },
	{ molecule: { centre: 'O', ligands: ['H', 'H'] }, kelvin: 373.17 },
	{ molecule: { centre: 'F', ligands: ['H'] }, kelvin: 292.7 }
];
