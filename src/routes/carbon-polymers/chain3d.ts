/**
 * 3D coordinates of a straight-chain alkane CₙH₂ₙ₊₂ in its stretched-out (all-anti) shape,
 * built from measured geometries (NIST CCCBDB, `geometry.ts`): methane for n = 1, ethane for
 * n = 2, and propane's bond lengths and angles for every longer chain (C–C 1.526 Å,
 * C–C–C 112.4°, H–C–H 106.1° on a CH₂ and 107.3° on a CH₃, C–H 1.09 Å). The carbons zigzag in
 * one plane; each CH₂'s two hydrogens sit above and below that plane. Longer chains use
 * propane's values throughout: a simplification (butane's measured C–C–C angle is 113.8°).
 * Coordinates in Å, centred on the middle of the chain, z up, the chain along x.
 */
import { GEOMETRY } from './geometry.ts';

export type P3 = [number, number, number];
interface Atom3 {
	el: 'C' | 'H';
	pos: P3;
}
interface Mol3 {
	atoms: Atom3[];
	bonds: [number, number][];
}

const get = (mol: string, atoms: string, kind: 'length' | 'angle', nth = 0) => {
	const list = GEOMETRY[mol].coords.filter((c) => c.atoms === atoms && c.kind === kind);
	const c = list[nth];
	if (!c) throw new Error(`no ${atoms} ${kind} for ${mol}`);
	return c.value;
};

export const MEASURED = {
	methane: { CH: get('methane', 'CH', 'length') },
	ethane: {
		CC: get('ethane', 'CC', 'length'),
		CH: get('ethane', 'CH', 'length'),
		HCC: get('ethane', 'HCC', 'angle')
	},
	propane: {
		CC: get('propane', 'CC', 'length'),
		CCC: get('propane', 'CCC', 'angle'),
		/** On the middle CH₂ (CCCBDB "center C") and the end CH₃. */
		CH2: get('propane', 'CH', 'length', 0), // 1.096
		CH3: get('propane', 'CH', 'length', 1), // 1.089
		HCH2: get('propane', 'HCH', 'angle', 0), // 106.1
		HCH3: get('propane', 'HCH', 'angle', 1) // 107.3
	}
};

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: P3, b: P3): P3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: P3, k: number): P3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: P3) => Math.hypot(...a);
const unit = (a: P3) => mul(a, 1 / (len(a) || 1));
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: P3, b: P3): P3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];

/** Directions of three bonds making angle `beta` with an axis `-u` (a methyl round its C–C). */
function umbrella(u: P3, beta: number, first: P3): P3[] {
	// u: unit vector from the carbon towards its neighbour; hydrogens point back, at beta from u.
	const e1 = unit(sub(first, mul(u, dot(first, u))));
	const e2 = cross(u, e1);
	return [0, 1, 2].map((k) => {
		const phi = (k * 2 * Math.PI) / 3;
		const side = add(mul(e1, Math.cos(phi)), mul(e2, Math.sin(phi)));
		return add(mul(u, Math.cos(beta)), mul(side, Math.sin(beta)));
	});
}

export function alkane3d(n: number): Mol3 {
	const atoms: Atom3[] = [];
	const bonds: [number, number][] = [];
	const C = (pos: P3) => atoms.push({ el: 'C', pos }) - 1;
	const H = (from: number, dir: P3, l: number) => {
		const i = atoms.push({ el: 'H', pos: add(atoms[from].pos, mul(unit(dir), l)) }) - 1;
		bonds.push([from, i]);
	};
	if (n === 1) {
		const c = C([0, 0, 0]);
		const s = 1 / Math.sqrt(3);
		for (const d of [
			[s, s, s],
			[-s, -s, s],
			[-s, s, -s],
			[s, -s, -s]
		] as P3[])
			H(c, d, MEASURED.methane.CH);
		return { atoms, bonds };
	}
	const geo =
		n === 2
			? {
					CC: MEASURED.ethane.CC,
					CCC: 180,
					CH3: MEASURED.ethane.CH,
					CH2: 0,
					HCC: MEASURED.ethane.HCC
				}
			: {
					CC: MEASURED.propane.CC,
					CCC: MEASURED.propane.CCC,
					CH3: MEASURED.propane.CH3,
					CH2: MEASURED.propane.CH2,
					HCC: 0
				};
	// Carbons: a zigzag in the xz plane.
	const half = rad(geo.CCC) / 2;
	const dx = geo.CC * Math.sin(half);
	const dz = geo.CC * Math.cos(half);
	for (let i = 0; i < n; i++) C([(i - (n - 1) / 2) * dx, i % 2 ? dz / 2 : -dz / 2, 0]);
	for (let i = 0; i + 1 < n; i++) bonds.push([i, i + 1]);
	// Swap y/z so the zigzag lies in the xz plane (z up): built in xy above for clarity.
	for (const a of atoms) a.pos = [a.pos[0], 0, a.pos[1]];
	const out = (i: number): P3 => {
		// Away from the neighbours, in the chain's plane.
		const p = atoms[i].pos;
		const nb = [i - 1, i + 1].filter((j) => j >= 0 && j < n).map((j) => unit(sub(atoms[j].pos, p)));
		return unit(
			mul(
				nb.reduce((s, v) => add(s, v), [0, 0, 0] as P3),
				-1
			)
		);
	};
	for (let i = 0; i < n; i++) {
		const end = i === 0 || i === n - 1;
		if (!end) {
			// CH₂: two hydrogens in the plane perpendicular to the chain plane, through the bisector.
			const half2 = rad(MEASURED.propane.HCH2) / 2;
			for (const s of [1, -1])
				H(i, add(mul(out(i), Math.cos(half2)), [0, s * Math.sin(half2), 0]), geo.CH2);
			continue;
		}
		// CH₃: an umbrella of three round the C–C bond, one hydrogen in the chain plane (anti).
		const j = i === 0 ? 1 : i - 1;
		const u = unit(sub(atoms[i].pos, atoms[j].pos)); // from the neighbour out through this carbon
		let beta: number;
		if (n === 2) beta = Math.PI - rad(geo.HCC);
		else {
			// From propane's H–C–H on the methyl: cos(HCH) = cos²β' + sin²β'·cos120°, β' from −u.
			const cosH = Math.cos(rad(MEASURED.propane.HCH3));
			const cb = Math.sqrt((1 + 2 * cosH) / 3);
			beta = Math.acos(cb);
		}
		// In-plane reference: the zigzag continued (anti to the next carbon along).
		// Staggered: the in-plane hydrogen points away from the next carbon along (anti).
		const ref: P3 = n > 2 ? out(j) : i === 0 ? [0, 0, 1] : [0, 0, -1];
		const dirs = umbrella(u, beta, ref);
		for (const d of dirs) H(i, d, geo.CH3);
	}
	return { atoms, bonds };
}

export const distance = (a: P3, b: P3) => len(sub(a, b));
export function angle(a: P3, centre: P3, b: P3) {
	const u = unit(sub(a, centre));
	const v = unit(sub(b, centre));
	return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
}
