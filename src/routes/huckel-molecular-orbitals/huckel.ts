/**
 * The simple Hückel model of a planar π system.
 *
 * Each atom of the conjugated skeleton contributes one p orbital, perpendicular to the plane.
 * The Hamiltonian in that basis has the Coulomb integral α on the diagonal, the resonance
 * integral β between bonded neighbours and zero elsewhere: H = α·1 + β·A, where A is the
 * skeleton's adjacency matrix. Its eigenvalues are therefore E = α + xβ, with x the eigenvalues
 * of A, and its eigenvectors are the molecular orbitals as coefficients on the atoms. β is
 * negative, so the orbital with the largest x is the lowest in energy.
 *
 * Energies here are the x's: "α + xβ" in the text. Overlap is neglected, every bond has the same
 * β (no bond alternation), and the electrons don't repel each other: that is the model.
 */

export interface Molecule {
	/** Atoms in the conjugated skeleton. */
	n: number;
	/** Closed into a ring (n ≥ 3) or an open chain. */
	ring: boolean;
	/** π electrons. */
	electrons: number;
}

export interface Orbital {
	/** Energy is α + x·β; larger x is lower (β < 0). */
	x: number;
	/** Coefficient on each atom (normalised). */
	c: number[];
	/** Electrons in it: 0, 1 or 2. */
	occ: number;
	/** Index of its degenerate level (orbitals with the same x share one). */
	level: number;
	/**
	 * Nodal planes across the skeleton: sign changes along a chain, or half the sign changes
	 * around a ring (each plane cuts a ring twice). Atoms with a zero coefficient sit on a node.
	 */
	nodes: number;
}

export interface Solution {
	mol: Molecule;
	/** Orbitals from the lowest energy (largest x) up. */
	orbitals: Orbital[];
	/** Bonds as atom pairs. */
	bonds: [number, number][];
	/** Total π energy as the coefficient of β (the α part is electrons·α). */
	energy: number;
	/** π bond order of each bond (Coulson): Σ occ·c_r·c_s. */
	bondOrders: number[];
	/** Highest orbital with an electron, lowest empty one (indices), or -1. */
	homo: number;
	lumo: number;
	/** x(HOMO) − x(LUMO) in units of |β|. */
	gap: number;
	/** Every level either full or empty. */
	closedShell: boolean;
	/** Singly occupied orbitals. */
	unpaired: number;
	/** E_π − E of the same electrons in isolated double bonds (and lone pairs at α), in β. */
	delocalisation: number;
}

const DEGENERATE = 1e-6;

export function bondsOf(n: number, ring: boolean): [number, number][] {
	const b: [number, number][] = [];
	for (let i = 0; i + 1 < n; i++) b.push([i, i + 1]);
	if (ring && n >= 3) b.push([n - 1, 0]);
	return b;
}

/** Eigen-decomposition of a real symmetric matrix by cyclic Jacobi rotations. */
export function eigenSymmetric(m: number[][]): { values: number[]; vectors: number[][] } {
	const n = m.length;
	const a = m.map((r) => [...r]);
	const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
	for (let sweep = 0; sweep < 100; sweep++) {
		let off = 0;
		for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
		if (off < 1e-24) break;
		for (let p = 0; p < n; p++) {
			for (let q = p + 1; q < n; q++) {
				if (Math.abs(a[p][q]) < 1e-300) continue;
				const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
				const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
				const c = 1 / Math.sqrt(t * t + 1);
				const s = t * c;
				for (let k = 0; k < n; k++) {
					const akp = a[k][p];
					const akq = a[k][q];
					a[k][p] = c * akp - s * akq;
					a[k][q] = s * akp + c * akq;
				}
				for (let k = 0; k < n; k++) {
					const apk = a[p][k];
					const aqk = a[q][k];
					a[p][k] = c * apk - s * aqk;
					a[q][k] = s * apk + c * aqk;
				}
				for (let k = 0; k < n; k++) {
					const vkp = v[k][p];
					const vkq = v[k][q];
					v[k][p] = c * vkp - s * vkq;
					v[k][q] = s * vkp + c * vkq;
				}
			}
		}
	}
	return {
		values: a.map((r, i) => r[i]),
		vectors: Array.from({ length: n }, (_, j) => v.map((r) => r[j]))
	};
}

/** The Hückel matrix in units of β, with α taken as the zero: the adjacency matrix. */
export function huckelMatrix(n: number, ring: boolean): number[][] {
	const m = Array.from({ length: n }, () => Array<number>(n).fill(0));
	for (const [i, j] of bondsOf(n, ring)) {
		m[i][j] = 1;
		m[j][i] = 1;
	}
	return m;
}

/** Makes the first largest coefficient positive, so lobes don't flip sign between redraws. */
function fixSign(c: number[]): number[] {
	let best = 0;
	for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) > Math.abs(c[best]) + 1e-9) best = i;
	return c[best] < 0 ? c.map((v) => -v) : c;
}

/**
 * A degenerate pair comes out of the diagonalisation in an arbitrary rotation. Turn it so that
 * the second orbital has a node through atom 0 and the first is symmetric about the axis
 * through atom 0: the pair as textbooks draw it, and the same every time.
 */
function alignPair(u: number[], v: number[]): [number[], number[]] {
	const th = Math.atan2(v[0], u[0]);
	const c = Math.cos(th);
	const s = Math.sin(th);
	const a = u.map((ui, i) => c * ui + s * v[i]);
	const b = u.map((ui, i) => -s * ui + c * v[i]);
	return [a, b.map((x) => (Math.abs(x) < 1e-12 ? 0 : x))];
}

/** Puts the electrons in: lowest level first, spread one per orbital over a degenerate level. */
function fill(levels: number[][], electrons: number, count: number): number[] {
	const occ = Array<number>(count).fill(0);
	let left = electrons;
	for (const lv of levels) {
		const g = lv.length;
		const here = Math.min(left, 2 * g);
		left -= here;
		lv.forEach((k, i) => (occ[k] = here >= g + i + 1 ? 2 : here > i ? 1 : 0));
	}
	return occ;
}

function nodesOf(c: number[], ring: boolean): number {
	const signs = c.filter((v) => Math.abs(v) > 1e-9).map(Math.sign);
	let changes = 0;
	for (let i = 1; i < signs.length; i++) if (signs[i] !== signs[i - 1]) changes++;
	if (!ring) return changes;
	if (signs.length > 1 && signs[0] !== signs[signs.length - 1]) changes++;
	return changes / 2;
}

const maxMatching = (n: number) => Math.floor(n / 2);

/** Solves the π system: orbitals, occupations, energy and the derived numbers. */
export function solve(mol: Molecule): Solution {
	const { n, ring } = mol;
	const electrons = Math.max(0, Math.min(2 * n, Math.round(mol.electrons)));
	const bonds = bondsOf(n, ring);
	const { values, vectors } = eigenSymmetric(huckelMatrix(n, ring));
	const order = values.map((_, i) => i).sort((i, j) => values[j] - values[i]);
	const xs = order.map((i) => values[i]);
	const cs = order.map((i) => vectors[i]);

	// Group degenerate orbitals into levels, align pairs, fix signs.
	const levels: number[][] = [];
	for (let k = 0; k < xs.length; k++) {
		const last = levels[levels.length - 1];
		if (last && Math.abs(xs[last[0]] - xs[k]) < DEGENERATE) last.push(k);
		else levels.push([k]);
	}
	for (const lv of levels) {
		if (lv.length === 2) [cs[lv[0]], cs[lv[1]]] = alignPair(cs[lv[0]], cs[lv[1]]);
		for (const k of lv) cs[k] = fixSign(cs[k]);
	}
	const occ = fill(levels, electrons, n);
	const levelOf = Array<number>(n).fill(0);
	levels.forEach((lv, li) => lv.forEach((k) => (levelOf[k] = li)));

	const orbitals: Orbital[] = xs.map((x, k) => ({
		x,
		c: cs[k],
		occ: occ[k],
		level: levelOf[k],
		nodes: nodesOf(cs[k], ring)
	}));

	const energy = orbitals.reduce((s, o) => s + o.occ * o.x, 0);
	const bondOrders = bonds.map(([i, j]) =>
		orbitals.reduce((s, o) => s + o.occ * o.c[i] * o.c[j], 0)
	);
	let homo = -1;
	let lumo = -1;
	for (let k = 0; k < n; k++) if (occ[k] > 0) homo = k;
	for (let k = n - 1; k >= 0; k--) if (occ[k] === 0) lumo = k;
	const gap = homo >= 0 && lumo >= 0 ? orbitals[homo].x - orbitals[lumo].x : Number.NaN;
	const closedShell = levels.every((lv) => {
		const e = lv.reduce((s, k) => s + occ[k], 0);
		return e === 0 || e === 2 * lv.length;
	});
	// The reference: as many isolated double bonds (2 sites, 2 electrons each) as the electrons
	// and the sites allow, with the other electrons alone or in pairs on the remaining sites.
	const doubles = Math.max(
		0,
		Math.min(maxMatching(n), Math.floor(electrons / 2), n - Math.ceil(electrons / 2))
	);
	return {
		mol: { n, ring, electrons },
		orbitals,
		bonds,
		energy,
		bondOrders,
		homo,
		lumo,
		gap,
		closedShell,
		unpaired: occ.filter((o) => o === 1).length,
		delocalisation: energy - 2 * doubles
	};
}

/**
 * What closing the chain into a ring does to the π energy, with the same atoms and electrons:
 * E(ring) − E(chain) in units of β (positive: the ring is lower in energy, as β < 0).
 */
export function ringClosure(n: number, electrons: number): number {
	return solve({ n, ring: true, electrons }).energy - solve({ n, ring: false, electrons }).energy;
}

// ------------------------------------------------------------------ named molecules

export interface Preset extends Molecule {
	id: string;
	name: string;
	formula: string;
}

export const PRESETS: Preset[] = [
	{ id: 'ethene', name: 'ethene', formula: 'C₂H₄', n: 2, ring: false, electrons: 2 },
	{ id: 'allyl', name: 'allyl cation', formula: 'C₃H₅⁺', n: 3, ring: false, electrons: 2 },
	{ id: 'butadiene', name: 'butadiene', formula: 'C₄H₆', n: 4, ring: false, electrons: 4 },
	{ id: 'hexatriene', name: 'hexatriene', formula: 'C₆H₈', n: 6, ring: false, electrons: 6 },
	{ id: 'octatetraene', name: 'octatetraene', formula: 'C₈H₁₀', n: 8, ring: false, electrons: 8 },
	{
		id: 'cyclopropenyl',
		name: 'cyclopropenyl cation',
		formula: 'C₃H₃⁺',
		n: 3,
		ring: true,
		electrons: 2
	},
	{ id: 'cyclobutadiene', name: 'cyclobutadiene', formula: 'C₄H₄', n: 4, ring: true, electrons: 4 },
	{
		id: 'cyclopentadienyl-anion',
		name: 'cyclopentadienyl anion',
		formula: 'C₅H₅⁻',
		n: 5,
		ring: true,
		electrons: 6
	},
	{
		id: 'cyclopentadienyl-cation',
		name: 'cyclopentadienyl cation',
		formula: 'C₅H₅⁺',
		n: 5,
		ring: true,
		electrons: 4
	},
	{ id: 'benzene', name: 'benzene', formula: 'C₆H₆', n: 6, ring: true, electrons: 6 },
	{ id: 'tropylium', name: 'tropylium cation', formula: 'C₇H₇⁺', n: 7, ring: true, electrons: 6 },
	{
		id: 'cyclooctatetraene',
		name: 'cyclooctatetraene (if flat)',
		formula: 'C₈H₈',
		n: 8,
		ring: true,
		electrons: 8
	},
	{
		id: 'cot-dianion',
		name: 'cyclooctatetraene dianion',
		formula: 'C₈H₈²⁻',
		n: 8,
		ring: true,
		electrons: 10
	}
];

/** The name of an all-carbon CₙHₘ π system, if it is one of the named ones. */
export function presetFor(mol: Molecule): Preset | undefined {
	return PRESETS.find((p) => p.n === mol.n && p.ring === mol.ring && p.electrons === mol.electrons);
}

// ------------------------------------------------------------------ cyanine dyes

/** Planck's constant times the speed of light, in eV·nm. */
export const HC_EV_NM = 1239.84198;

/**
 * Measured absorption maxima of the streptocyanines R₂N–(CH)ₖ–NR₂⁺ (R = CH₃), by the number k
 * of carbons in the chain: W. T. Simpson, J. Chem. Phys. 16, 1124 (1948), as quoted in
 * Chemistry LibreTexts, "Quantum States of Atoms and Molecules", §4.2 Cyanine Dyes.
 */
export const CYANINE_MEASURED: { carbons: number; nm: number }[] = [
	{ carbons: 3, nm: 309 },
	{ carbons: 5, nm: 409 },
	{ carbons: 7, nm: 512 }
];

/**
 * A cyanine as a Hückel chain: the two nitrogens and the k carbons between them make k + 2
 * sites, with k + 3 π electrons (each carbon gives one, the amine nitrogen two and the iminium
 * nitrogen one). By resonance the two ends are alike and every bond is the same: the model's
 * own assumption, which is why it suits cyanines. The nitrogens are treated as carbons (one α).
 */
export const cyanine = (carbons: number): Molecule => ({
	n: carbons + 2,
	ring: false,
	electrons: carbons + 3
});

/** HOMO → LUMO gap of the cyanine with k carbons, in units of |β|. */
export const cyanineGap = (carbons: number) => solve(cyanine(carbons)).gap;

/**
 * The one empirical number of the page: |β| chosen so that the shortest dye of the series
 * (3 carbons, 309 nm) comes out right. The other dyes are then predictions.
 */
export const BETA_EV = HC_EV_NM / CYANINE_MEASURED[0].nm / cyanineGap(CYANINE_MEASURED[0].carbons);

/** Predicted absorption maximum (nm) of the cyanine with k carbons. */
export const cyanineNm = (carbons: number) => HC_EV_NM / (cyanineGap(carbons) * BETA_EV);

/** Measured λmax of the cyanine with k carbons, if the series has it. */
export const measuredNm = (carbons: number) =>
	CYANINE_MEASURED.find((d) => d.carbons === carbons)?.nm ?? null;
