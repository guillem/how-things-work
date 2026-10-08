/**
 * Atoms: element data (from the mendeleev database — see elements.ts and
 * MENDELEEV-LICENSE.txt), the order in which electrons fill subshells, where
 * each element sits in the periodic table, and hydrogen-like orbital shapes.
 *
 * - The filling order is the Madelung (n + ℓ) rule: subshells fill in order of
 *   n + ℓ, and of n for equal n + ℓ: 1s 2s 2p 3s 3p 4s 3d 4p … About twenty
 *   elements (chromium, copper…) deviate slightly; the page uses each
 *   element's measured ground-state configuration from the data and points out
 *   where it differs from the rule.
 * - Orbital shapes are the exact probability densities |ψ|² of the hydrogen
 *   atom's orbitals (for other atoms they are approximations of the same
 *   shapes), shown as clouds of points sampled from |ψ|².
 */
import data from './elements';
import { rng } from '#lib/draw/math.ts';

export interface Element {
	z: number;
	symbol: string;
	name: string;
	/** Ground-state electron configuration as written in the data, e.g. "[Ar] 3d5 4s". */
	config: string;
	period: number;
	/** Group 1–18, or null for the lanthanides and actinides (f-block). */
	group: number | null;
	block: 's' | 'p' | 'd' | 'f';
	mass: number | null;
	/** Covalent radius (pm). */
	radius: number | null;
	/** First ionization energy (eV). */
	ionization: number | null;
	/** Pauling electronegativity. */
	electronegativity: number | null;
	/** Mass numbers of the stable isotopes found in nature. */
	stable: number[];
}

export const ELEMENTS = data.elements as Element[];
export const SOURCES = data.fields as Record<string, string>;
export const element = (z: number) => ELEMENTS[z - 1];

// ------------------------------------------------------------ subshells

export interface Subshell {
	n: number;
	l: number;
	/** e.g. "3d". */
	label: string;
	/** Electrons it can hold: 2(2ℓ + 1). */
	capacity: number;
}

const L = 'spdf';

/** Subshells in Madelung filling order, enough for element 118. */
export const ORDER: Subshell[] = (() => {
	const out: Subshell[] = [];
	for (let s = 1; s <= 8; s++)
		for (let n = Math.ceil(s / 2); n <= s; n++) {
			const l = s - n;
			if (l >= n || l > 3) continue;
			out.push({ n, l, label: `${n}${L[l]}`, capacity: 2 * (2 * l + 1) });
		}
	return out.filter((sh) => sh.n <= 7);
})();

/** Electrons per subshell after filling `count` electrons by the Madelung rule. */
export function madelung(count: number): Map<string, number> {
	const occ = new Map<string, number>();
	let left = count;
	for (const sh of ORDER) {
		if (left <= 0) break;
		const k = Math.min(sh.capacity, left);
		occ.set(sh.label, k);
		left -= k;
	}
	return occ;
}

const NOBLE: Record<string, number> = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };

/** Electrons per subshell from a configuration string (expanding "[Ne]" etc.). */
export function parseConfig(config: string): Map<string, number> {
	const occ = new Map<string, number>();
	for (const part of config.trim().split(/\s+/)) {
		const core = /^\[(\w+)\]$/.exec(part);
		if (core) {
			for (const [k, v] of madelungCore(NOBLE[core[1]])) occ.set(k, v);
			continue;
		}
		const m = /^(\d)([spdf])(\d*)$/.exec(part);
		if (m) occ.set(`${m[1]}${m[2]}`, m[3] ? +m[3] : 1);
	}
	return occ;
}

/** Noble-gas cores fill exactly by the Madelung rule. */
const madelungCore = (count: number) => madelung(count);

/** Does the element's measured configuration differ from the Madelung rule? */
export function isException(z: number) {
	const a = madelung(z);
	const b = parseConfig(element(z).config);
	const keys = new Set([...a.keys(), ...b.keys()]);
	for (const k of keys) if ((a.get(k) ?? 0) !== (b.get(k) ?? 0)) return true;
	return false;
}

/** Electrons in the outermost shell (highest n present): what sets an element's chemistry. */
export function outerShell(z: number) {
	const occ = parseConfig(element(z).config);
	const nMax = Math.max(...[...occ.keys()].map((k) => +k[0]));
	let count = 0;
	for (const [k, v] of occ) if (+k[0] === nMax) count += v;
	return { n: nMax, electrons: count };
}

/** Electrons per shell n (1, 2, 3…), for the shell diagram. */
export function shellCounts(z: number) {
	const occ = parseConfig(element(z).config);
	const out: number[] = [];
	for (const [k, v] of occ) out[+k[0] - 1] = (out[+k[0] - 1] ?? 0) + v;
	return Array.from(out, (v) => v ?? 0);
}

// ------------------------------------------------------------ the table's layout

/**
 * Where an element is drawn in the standard 18-column table: (row, column),
 * with the lanthanides and actinides in two separate rows 9 and 10 below
 * (lanthanum and actinium start those rows, as is common in school tables).
 */
export function cell(z: number): { row: number; col: number } {
	const e = element(z);
	if ((z >= 57 && z <= 71) || (z >= 89 && z <= 103))
		return { row: z <= 71 ? 9 : 10, col: 3 + (z <= 71 ? z - 57 : z - 89) };
	return { row: e.period, col: e.group ?? 3 };
}

// ------------------------------------------------------------ building an atom

export interface Build {
	protons: number;
	neutrons: number;
	electrons: number;
}

/** What the built atom is: element, mass number, charge, and whether that nucleus is stable. */
export function identify({ protons, neutrons, electrons }: Build) {
	const e = protons >= 1 && protons <= 118 ? element(protons) : null;
	const massNumber = protons + neutrons;
	return {
		element: e,
		massNumber,
		charge: protons - electrons,
		stable: e ? e.stable.includes(massNumber) : false,
		/** A stable mass number to suggest, closest to the current one (or null). */
		nearestStable:
			e && e.stable.length
				? e.stable.reduce((a, b) => (Math.abs(b - massNumber) < Math.abs(a - massNumber) ? b : a))
				: null
	};
}

// ------------------------------------------------------------ orbital shapes

export type OrbitalId = '1s' | '2s' | '2p' | '3p' | '3d';

/**
 * Probability density |ψ|² of a hydrogen orbital at (x, y, z) in Bohr radii
 * (unnormalised; real orbitals: 2p is 2p_z, 3p is 3p_z, 3d is 3d_z²).
 */
export function density(id: OrbitalId, x: number, y: number, z: number) {
	const r = Math.hypot(x, y, z);
	const c = r > 0 ? z / r : 0; // cos θ
	let psi: number;
	switch (id) {
		case '1s':
			psi = Math.exp(-r);
			break;
		case '2s':
			psi = (2 - r) * Math.exp(-r / 2);
			break;
		case '2p':
			psi = r * c * Math.exp(-r / 2);
			break;
		case '3p':
			psi = (6 - r) * r * c * Math.exp(-r / 3);
			break;
		case '3d':
			psi = r * r * (3 * c * c - 1) * Math.exp(-r / 3);
			break;
	}
	return psi * psi;
}

/** How far out to sample each orbital (Bohr radii). */
export const EXTENT: Record<OrbitalId, number> = {
	'1s': 5,
	'2s': 14,
	'2p': 14,
	'3p': 24,
	'3d': 24
};

/**
 * `count` points sampled from |ψ|² (rejection sampling in a cube), each with
 * the sign of ψ (+1/−1) for colouring the lobes. Reproducible from `seed`.
 */
export function cloud(id: OrbitalId, count: number, seed = 1) {
	const rand = rng(seed);
	const R = EXTENT[id];
	// The maximum density, found on a coarse grid, bounds the rejection test.
	let max = 0;
	for (let i = 0; i <= 40; i++)
		for (let j = 0; j <= 40; j++) {
			const x = -R + (2 * R * i) / 40;
			const z = -R + (2 * R * j) / 40;
			max = Math.max(max, density(id, x, 0, z));
		}
	max *= 1.2;
	const pts: { x: number; y: number; z: number; sign: number }[] = [];
	let guard = 0;
	while (pts.length < count && guard++ < count * 5000) {
		const x = (rand() * 2 - 1) * R;
		const y = (rand() * 2 - 1) * R;
		const z = (rand() * 2 - 1) * R;
		if (rand() * max < density(id, x, y, z)) {
			const sign = id === '1s' ? 1 : psiSign(id, x, y, z);
			pts.push({ x, y, z, sign });
		}
	}
	return pts;
}

function psiSign(id: OrbitalId, x: number, y: number, z: number) {
	const r = Math.hypot(x, y, z);
	const c = r > 0 ? z / r : 0;
	switch (id) {
		case '2s':
			return r < 2 ? 1 : -1;
		case '2p':
			return c >= 0 ? 1 : -1;
		case '3p':
			return (6 - r) * c >= 0 ? 1 : -1;
		case '3d':
			return 3 * c * c - 1 >= 0 ? 1 : -1;
		default:
			return 1;
	}
}

/** Radius (Bohr radii) within which there is a 90% chance of finding the 1s electron (≈ 2.66). */
export function radius90For1s() {
	// P(r < R) = 1 − e^{−2R}(1 + 2R + 2R²)
	let lo = 0;
	let hi = 10;
	for (let i = 0; i < 60; i++) {
		const m = (lo + hi) / 2;
		const p = 1 - Math.exp(-2 * m) * (1 + 2 * m + 2 * m * m);
		if (p < 0.9) lo = m;
		else hi = m;
	}
	return (lo + hi) / 2;
}
