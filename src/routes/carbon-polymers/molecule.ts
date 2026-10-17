/**
 * Carbon chains, rings and functional groups: the molecule builder's model.
 *
 * What the reader can build (the whole state space, listed by `allBuilds()`):
 * - an unbranched skeleton of 1–8 carbon atoms, open (a chain) or closed (a ring of 3–8);
 *   a six-membered ring can be aromatic (benzene);
 * - at most ONE feature on it: a C=C double bond, a C≡C triple bond (chains only), or one
 *   functional group on one carbon: –OH (alcohol), =O (aldehyde at the end of a chain,
 *   ketone elsewhere), –COOH (carboxylic acid: the end carbon becomes the acid carbon),
 *   –NH₂ (amine) or –Cl (chloroalkane). Benzene can carry –OH, –NH₂ or –Cl.
 * Real molecules carry many features at once; one at a time keeps every reachable molecule
 * correctly named and backed by measured data (see `compounds.ts`).
 *
 * Valence rules (the bonding capacities of the chemical-bonds explainer): C makes 4 bonds,
 * N 3, O 2, H and Cl 1. Every carbon bond not used by the skeleton or the feature is filled
 * with hydrogen. Aromatic ring bonds count 1.5 each (six electrons shared round the ring).
 *
 * Names follow the IUPAC 2013 recommendations as PubChem writes them (lowest locants; the
 * zigzag drawing of an internal double bond is the trans isomer, so it is named (E)-); the
 * test checks every reachable state against PubChem's computed IUPAC name. This file imports
 * nothing, so the data script (scripts/data/carbon-polymers/build.mjs) can run it in Node.
 */

export type El = 'C' | 'H' | 'O' | 'N' | 'Cl';

/** Bonds each element makes (same as `capacity()` in ../chemical-bonds/model.ts). */
export const VALENCE: Record<El, number> = { C: 4, N: 3, O: 2, H: 1, Cl: 1 };

/**
 * IUPAC standard atomic weights (abridged, 2021): C 12.011, H 1.008, N 14.007, O 15.999,
 * Cl 35.45 (https://iupac.qmul.ac.uk/AtWt/).
 */
export const MASS: Record<El, number> = { C: 12.011, H: 1.008, N: 14.007, O: 15.999, Cl: 35.45 };

export type Feature = 'double' | 'triple' | 'OH' | 'CO' | 'COOH' | 'NH2' | 'Cl';
export const FEATURES: Feature[] = ['double', 'triple', 'OH', 'CO', 'COOH', 'NH2', 'Cl'];
export const isBondFeature = (f: Feature | null) => f === 'double' || f === 'triple';

export interface Build {
	/** Carbons in the skeleton, 1–8. */
	n: number;
	ring: boolean;
	/** Benzene (a six-membered ring only). */
	aromatic: boolean;
	feature: Feature | null;
	/** 1-based carbon carrying the group, or the first carbon of the multiple bond. */
	at: number;
}

export const MAX_CARBONS = 8;

// ------------------------------------------------------------------ validity

/** Why the build is impossible, or null if it is a real molecule. */
export function refusal(b: Build): string | null {
	if (!Number.isInteger(b.n) || b.n < 1 || b.n > MAX_CARBONS)
		return `This builder makes 1 to ${MAX_CARBONS} carbons`;
	if (b.ring && b.n < 3) return 'A ring needs at least three carbons';
	if (b.aromatic && !(b.ring && b.n === 6)) return 'Only a ring of six carbons can be benzene';
	const f = b.feature;
	if (!f) return null;
	if (!Number.isInteger(b.at) || b.at < 1 || b.at > b.n) return 'There is no carbon there';
	if (isBondFeature(f)) {
		if (b.n < 2) return 'A carbon–carbon bond needs two carbons';
		if (b.aromatic) return "Benzene's ring already shares its extra electrons all round";
		if (!b.ring && b.at > b.n - 1) return 'There is no carbon–carbon bond there';
		if (f === 'triple' && b.ring)
			return b.n < 8
				? 'A triple bond is straight (180°): it would bend a ring this small too far'
				: 'Cyclooctyne exists, but is too strained for this builder';
		return null;
	}
	if (b.aromatic && (f === 'CO' || f === 'COOH'))
		return 'Each benzene carbon has only one hydrogen to swap';
	if (f === 'COOH') {
		if (b.ring) return 'The –COOH carbon has to be at the end of a chain';
		if (b.at !== 1 && b.at !== b.n) return 'The –COOH carbon has to be at the end of a chain';
	}
	return null;
}
const valid = (b: Build) => refusal(b) === null;

/** The same molecule with the lowest locant (chains read from the nearer end; rings from it). */
export function canonical(b: Build): Build {
	if (!b.feature) return { ...b, at: 1 };
	if (b.ring) return { ...b, at: 1 };
	const at = isBondFeature(b.feature) ? Math.min(b.at, b.n - b.at) : Math.min(b.at, b.n + 1 - b.at);
	return { ...b, at };
}

/** "6r" "6a" "4|OH@2" … — one string per molecule (canonical). */
export function key(b: Build): string {
	const c = canonical(b);
	const skel = `${c.n}${c.aromatic ? 'a' : c.ring ? 'r' : ''}`;
	return c.feature ? `${skel}|${c.feature}@${c.at}` : skel;
}

/** Serialised builder state (not canonical: keeps where the reader put the feature). */
export function serialize(b: Build): string {
	const skel = `${b.n}${b.aromatic ? 'a' : b.ring ? 'r' : ''}`;
	return b.feature ? `${skel}|${b.feature}@${b.at}` : skel;
}
export function parse(s: string | null | undefined, fallback: Build): Build {
	if (!s) return fallback;
	const m = /^(\d)(a|r)?(?:\|(double|triple|OH|CO|COOH|NH2|Cl)@(\d))?$/.exec(s);
	if (!m) return fallback;
	const b: Build = {
		n: +m[1],
		ring: m[2] === 'r' || m[2] === 'a',
		aromatic: m[2] === 'a',
		feature: (m[3] as Feature | undefined) ?? null,
		at: m[4] ? +m[4] : 1
	};
	return valid(b) ? b : fallback;
}

/** Every distinct molecule the builder can make (canonical forms, no duplicates). */
export function allBuilds(): Build[] {
	const out = new Map<string, Build>();
	for (let n = 1; n <= MAX_CARBONS; n++)
		for (const ring of [false, true])
			for (const aromatic of [false, true])
				for (const feature of [null, ...FEATURES])
					for (let at = 1; at <= (feature ? n : 1); at++) {
						const b: Build = { n, ring, aromatic, feature, at };
						if (valid(b)) out.set(key(b), canonical(b));
					}
	return [...out.values()];
}

// ------------------------------------------------------------------ the graph

interface Atom {
	el: El;
	/** The skeleton carbon this atom is (1-based), or the carbon it hangs from. */
	carbon: number;
	/** Part of the functional group (or the multiple bond's carbons). */
	group?: boolean;
}
interface Bond {
	a: number;
	b: number;
	/** 1, 2, 3, or 1.5 for an aromatic ring bond. */
	order: number;
}
interface Graph {
	atoms: Atom[];
	bonds: Bond[];
}

/** All atoms, hydrogens included: skeleton carbons first (index i-1 = carbon i). */
export function graph(b: Build): Graph {
	const atoms: Atom[] = [];
	const bonds: Bond[] = [];
	for (let i = 1; i <= b.n; i++) atoms.push({ el: 'C', carbon: i });
	const link = (x: number, y: number, order = 1) => bonds.push({ a: x, b: y, order });
	const add = (el: El, carbon: number, to: number, order = 1) => {
		atoms.push({ el, carbon, group: true });
		link(to, atoms.length - 1, order);
		return atoms.length - 1;
	};
	const chainBonds = b.ring ? b.n : b.n - 1;
	for (let k = 0; k < chainBonds; k++) {
		const x = k;
		const y = (k + 1) % b.n;
		let order = b.aromatic ? 1.5 : 1;
		if (isBondFeature(b.feature) && k === b.at - 1) order = b.feature === 'double' ? 2 : 3;
		link(x, y, order);
	}
	const c = b.at - 1;
	switch (b.feature) {
		case 'OH': {
			const o = add('O', b.at, c);
			add('H', b.at, o);
			break;
		}
		case 'CO':
			add('O', b.at, c, 2);
			break;
		case 'COOH': {
			add('O', b.at, c, 2);
			const o = add('O', b.at, c);
			add('H', b.at, o);
			break;
		}
		case 'NH2': {
			const nAt = add('N', b.at, c);
			add('H', b.at, nAt);
			add('H', b.at, nAt);
			break;
		}
		case 'Cl':
			add('Cl', b.at, c);
			break;
		default:
			break;
	}
	if (isBondFeature(b.feature)) {
		atoms[b.at - 1].group = true;
		atoms[b.at % b.n].group = true;
	}
	// Fill every carbon's remaining bonds with hydrogen.
	for (let i = 0; i < b.n; i++) {
		const used = bonds.filter((bd) => bd.a === i || bd.b === i).reduce((s, bd) => s + bd.order, 0);
		for (let h = 0; h < VALENCE.C - used; h++) {
			atoms.push({ el: 'H', carbon: i + 1 });
			link(i, atoms.length - 1);
		}
	}
	return { atoms, bonds };
}

/** Hydrogens on each skeleton carbon. */
export function hydrogens(b: Build): number[] {
	const g = graph(b);
	return Array.from(
		{ length: b.n },
		(_, i) =>
			g.bonds.filter(
				(bd) => (bd.a === i && g.atoms[bd.b].el === 'H') || (bd.b === i && g.atoms[bd.a].el === 'H')
			).length
	);
}

/** Bonds per atom (sum of orders): equals the element's valence for every atom. */
export function bondSums(g: Graph): number[] {
	return g.atoms.map((_, i) =>
		g.bonds.filter((bd) => bd.a === i || bd.b === i).reduce((s, bd) => s + bd.order, 0)
	);
}

function counts(g: Graph): Record<El, number> {
	const c: Record<El, number> = { C: 0, H: 0, O: 0, N: 0, Cl: 0 };
	for (const a of g.atoms) c[a.el]++;
	return c;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => (n > 1 ? [...String(n)].map((d) => SUB[+d]).join('') : '');

/** Molecular formula in Hill order (C, H, then the rest alphabetically), with subscripts. */
export function formulaOf(c: Record<El, number>, plain = false): string {
	const order: El[] = c.C ? ['C', 'H', 'Cl', 'N', 'O'] : ['Cl', 'H', 'N', 'O', 'C'];
	return order
		.filter((e) => c[e] > 0)
		.map((e) => e + (plain ? (c[e] > 1 ? String(c[e]) : '') : sub(c[e])))
		.join('');
}
export const formula = (b: Build, plain = false) => formulaOf(counts(graph(b)), plain);

/** Molar mass (g/mol) from the standard atomic weights. */
export const massOf = (c: Record<El, number>) =>
	(Object.keys(c) as El[]).reduce((s, e) => s + c[e] * MASS[e], 0);
export const molarMass = (b: Build) => massOf(counts(graph(b)));

// ------------------------------------------------------------------ names

const STEMS = ['meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct'];

type Family =
	| 'alkane'
	| 'alkene'
	| 'alkyne'
	| 'cycloalkane'
	| 'cycloalkene'
	| 'arene'
	| 'alcohol'
	| 'phenol'
	| 'aldehyde'
	| 'ketone'
	| 'carboxylic acid'
	| 'amine'
	| 'chloroalkane';

export function family(b: Build): Family {
	switch (b.feature) {
		case 'double':
			return b.ring ? 'cycloalkene' : 'alkene';
		case 'triple':
			return 'alkyne';
		case 'OH':
			return b.aromatic ? 'phenol' : 'alcohol';
		case 'CO': {
			const c = canonical(b);
			return !b.ring && (c.at === 1 || b.n === 1) ? 'aldehyde' : 'ketone';
		}
		case 'COOH':
			return 'carboxylic acid';
		case 'NH2':
			return 'amine';
		case 'Cl':
			return 'chloroalkane';
		default:
			return b.aromatic ? 'arene' : b.ring ? 'cycloalkane' : 'alkane';
	}
}

/** Systematic (IUPAC) name. */
export function name(input: Build): string {
	const b = canonical(input);
	const stem = STEMS[b.n - 1];
	const loc = b.at;
	const cyc = b.ring ? 'cyclo' : '';
	// Methane and ethane need no locant: there is only one place for the group.
	const short = !b.ring && b.n <= 2;
	if (b.aromatic) {
		if (b.feature === 'OH') return 'phenol';
		if (b.feature === 'NH2') return 'aniline';
		if (b.feature === 'Cl') return 'chlorobenzene';
		return 'benzene';
	}
	switch (b.feature) {
		case null:
			return `${cyc}${stem}ane`;
		case 'double':
		case 'triple': {
			const suffix = b.feature === 'double' ? 'ene' : 'yne';
			if (b.ring || b.n === 2) return `${cyc}${stem}${suffix}`;
			// A double bond with chain on both sides, drawn zigzag: the trans (E) isomer.
			const e = b.feature === 'double' && loc >= 2 ? '(E)-' : '';
			return `${e}${stem}-${loc}-${suffix}`;
		}
		case 'OH':
			return b.ring || short ? `${cyc}${stem}anol` : `${stem}an-${loc}-ol`;
		case 'NH2':
			return b.ring || short ? `${cyc}${stem}anamine` : `${stem}an-${loc}-amine`;
		case 'Cl':
			return b.ring || short ? `chloro${cyc}${stem}ane` : `${loc}-chloro${stem}ane`;
		case 'COOH':
			return `${stem}anoic acid`;
		case 'CO':
			if (b.ring) return `${cyc}${stem}anone`;
			if (loc === 1) return `${stem}anal`;
			return `${stem}an-${loc}-one`;
	}
}

/** Everyday names of a few of the molecules (common or traditional names). */
const COMMON: Record<string, string> = {
	'2|double@1': 'ethylene',
	'3|double@1': 'propylene',
	'2|triple@1': 'acetylene',
	'1|CO@1': 'formaldehyde',
	'2|CO@1': 'acetaldehyde',
	'3|CO@2': 'acetone',
	'1|COOH@1': 'formic acid',
	'2|COOH@1': 'acetic acid',
	'4|COOH@1': 'butyric acid',
	'1|OH@1': 'wood alcohol',
	'3|OH@2': 'isopropyl alcohol',
	'1|Cl@1': 'methyl chloride'
};
export const commonName = (b: Build) => COMMON[key(b)] ?? null;

/** Where a few of them turn up. Plain facts, no figures. */
const USES: Record<string, string> = {
	'1': 'natural gas',
	'2': 'part of natural gas',
	'3': 'bottled gas, barbecues',
	'4': 'lighters, camping gas',
	'8': 'a part of petrol',
	'7': 'a part of petrol',
	'6r': 'a solvent; a step to nylon',
	'6a': 'from crude oil; a feedstock for plastics',
	'2|double@1': 'makes polyethylene; ripens fruit',
	'3|double@1': 'makes polypropylene',
	'2|triple@1': 'welding torches',
	'1|OH@1': 'a fuel and solvent (poisonous)',
	'2|OH@1': 'alcoholic drinks, fuel',
	'3|OH@2': 'rubbing alcohol, hand gel',
	'1|CO@1': 'preserving specimens; resins',
	'3|CO@2': 'nail-polish remover',
	'1|COOH@1': 'ant stings',
	'2|COOH@1': 'vinegar',
	'4|COOH@1': 'the smell of rancid butter',
	'6a|OH@1': 'the first antiseptic; resins',
	'6a|NH2@1': 'dyes',
	'1|Cl@1': 'once a refrigerant'
};
export const uses = (b: Build) => USES[key(b)] ?? null;

// ------------------------------------------------------------------ SMILES (for the data script)

/** A SMILES string for the molecule (heavy atoms; hydrogens implicit). */
export function smiles(input: Build): string {
	const b = canonical(input);
	if (b.aromatic) {
		const g: Record<string, string> = { OH: 'O', NH2: 'N', Cl: 'Cl' };
		return b.feature ? `${g[b.feature]}c1ccccc1` : 'c1ccccc1';
	}
	const grp: Record<string, string> = {
		OH: '(O)',
		CO: '(=O)',
		COOH: '(=O)O',
		NH2: '(N)',
		Cl: '(Cl)'
	};
	// The zigzag internal double bond is trans: C/C=C/C.
	const trans = b.feature === 'double' && !b.ring && b.at >= 2;
	let s = '';
	for (let i = 1; i <= b.n; i++) {
		if (i > 1) {
			if (isBondFeature(b.feature) && b.at === i - 1) s += b.feature === 'double' ? '=' : '#';
			else if (trans && (i === b.at || i === b.at + 2)) s += '/';
		}
		s += 'C';
		if (b.ring && i === 1) s += '1';
		if (b.feature && !isBondFeature(b.feature) && b.at === i) {
			// The acid carbon is carbon 1: "C(=O)(O)CC…" (its O is a branch unless it is last).
			s += b.feature === 'COOH' ? (b.n === 1 ? '(=O)O' : '(=O)(O)') : grp[b.feature];
		}
	}
	if (b.ring) s += (isBondFeature(b.feature) && b.at === b.n ? '=' : '') + '1';
	return s;
}
