/**
 * Mirror images: can a molecule be turned until it sits exactly on its mirror image?
 *
 * Molecules are a centre carbon and four labelled groups, with measured positions (CCCBDB
 * Cartesian coordinates, `geometry.ts`) or, for alanine, ideal tetrahedral directions at
 * measured bond lengths. The mirror image reflects x → −x. Turning is a proper rotation
 * (determinant +1): a reflection is not something a real molecule can do by moving.
 *
 * - `bestFit` finds the rotation that brings one set of labelled points as close as possible
 *   to another (least squares), by Horn's quaternion method (B. K. P. Horn, "Closed-form
 *   solution of absolute orientation using unit quaternions", J. Opt. Soc. Am. A 4, 629
 *   (1987)), which only ever returns proper rotations. For a molecule and its mirror image
 *   the leftover mismatch is zero exactly when the molecule is achiral.
 * - `alignTwo` turns the copy so that two chosen groups point exactly where they point in the
 *   original: the textbook test. For a chiral centre the other two groups then sit in each
 *   other's places.
 */
import { CHFCLBR, CH2FCL } from './geometry.ts';

export type V3 = [number, number, number];
export type M3 = [V3, V3, V3];

interface Group {
	/** Label drawn on the ball ("H", "F", "CH₃", …). */
	label: string;
	/** The atom that bonds to the centre (sets the colour). */
	el: string;
	/** Position relative to the centre carbon (Å). */
	pos: V3;
}
interface Centre {
	id: string;
	name: string;
	formula: string;
	groups: Group[];
	/** Where the geometry comes from. */
	source: string;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => {
	const l = norm(a) || 1;
	return [a[0] / l, a[1] / l, a[2] / l];
};
export const apply = (m: M3, v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
export const mul = (a: M3, b: M3): M3 =>
	[0, 1, 2].map((i) =>
		[0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j])
	) as M3;
const transpose = (m: M3): M3 => [
	[m[0][0], m[1][0], m[2][0]],
	[m[0][1], m[1][1], m[2][1]],
	[m[0][2], m[1][2], m[2][2]]
];
export const IDENTITY: M3 = [
	[1, 0, 0],
	[0, 1, 0],
	[0, 0, 1]
];
export const det = (m: M3) => dot(m[0], cross(m[1], m[2]));

/** Rotation by `angle` (radians) about the unit axis `k` (Rodrigues). */
export function axisAngle(k: V3, angle: number): M3 {
	const [x, y, z] = unit(k);
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const C = 1 - c;
	return [
		[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
		[y * x * C + z * s, c + y * y * C, y * z * C - x * s],
		[z * x * C - y * s, z * y * C + x * s, c + z * z * C]
	];
}

// ------------------------------------------------------------------ quaternions

export type Quat = [number, number, number, number]; // w, x, y, z

export function quatToMatrix(q: Quat): M3 {
	const l = Math.hypot(...q) || 1;
	const [w, x, y, z] = q.map((c) => c / l);
	return [
		[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
		[2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
		[2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]
	];
}

export function matrixToQuat(m: M3): Quat {
	const tr = m[0][0] + m[1][1] + m[2][2];
	let q: Quat;
	if (tr > 0) {
		const s = Math.sqrt(tr + 1) * 2;
		q = [s / 4, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s];
	} else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
		const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
		q = [(m[2][1] - m[1][2]) / s, s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s];
	} else if (m[1][1] > m[2][2]) {
		const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
		q = [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s];
	} else {
		const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
		q = [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4];
	}
	const l = Math.hypot(...q);
	return q.map((c) => c / l) as Quat;
}

/** Spherical interpolation between two rotations (shortest way). */
export function slerp(a: Quat, b: Quat, u: number): Quat {
	let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
	const bb = (d < 0 ? b.map((c) => -c) : b) as Quat;
	d = Math.abs(d);
	if (d > 0.9995) {
		const q = a.map((c, i) => c + (bb[i] - c) * u) as Quat;
		const l = Math.hypot(...q);
		return q.map((c) => c / l) as Quat;
	}
	const th = Math.acos(d);
	const s = Math.sin(th);
	const wa = Math.sin((1 - u) * th) / s;
	const wb = Math.sin(u * th) / s;
	return a.map((c, i) => wa * c + wb * bb[i]) as Quat;
}

/** Largest eigenvector of a symmetric 4×4 matrix (cyclic Jacobi). */
function topEigenvector(A: number[][]): number[] {
	const a = A.map((r) => [...r]);
	const v: number[][] = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 1 : 0)));
	for (let sweep = 0; sweep < 60; sweep++) {
		let off = 0;
		for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += a[p][q] * a[p][q];
		if (off < 1e-22) break;
		for (let p = 0; p < 4; p++)
			for (let q = p + 1; q < 4; q++) {
				if (Math.abs(a[p][q]) < 1e-30) continue;
				const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
				const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
				const c = 1 / Math.sqrt(t * t + 1);
				const s = t * c;
				for (let k = 0; k < 4; k++) {
					const akp = a[k][p];
					const akq = a[k][q];
					a[k][p] = c * akp - s * akq;
					a[k][q] = s * akp + c * akq;
				}
				for (let k = 0; k < 4; k++) {
					const apk = a[p][k];
					const aqk = a[q][k];
					a[p][k] = c * apk - s * aqk;
					a[q][k] = s * apk + c * aqk;
				}
				for (let k = 0; k < 4; k++) {
					const vkp = v[k][p];
					const vkq = v[k][q];
					v[k][p] = c * vkp - s * vkq;
					v[k][q] = s * vkp + c * vkq;
				}
			}
	}
	let best = 0;
	for (let i = 1; i < 4; i++) if (a[i][i] > a[best][best]) best = i;
	return v.map((row) => row[best]);
}

/**
 * The proper rotation R that minimises Σ|R·from_i − to_i|² over labelled points (both sets
 * centred on the carbon). Returns R and the root-mean-square leftover distance (Å).
 */
export function bestFit(from: V3[], to: V3[]): { R: M3; rms: number } {
	let Sxx = 0,
		Sxy = 0,
		Sxz = 0,
		Syx = 0,
		Syy = 0,
		Syz = 0,
		Szx = 0,
		Szy = 0,
		Szz = 0;
	from.forEach((a, i) => {
		const b = to[i];
		Sxx += a[0] * b[0];
		Sxy += a[0] * b[1];
		Sxz += a[0] * b[2];
		Syx += a[1] * b[0];
		Syy += a[1] * b[1];
		Syz += a[1] * b[2];
		Szx += a[2] * b[0];
		Szy += a[2] * b[1];
		Szz += a[2] * b[2];
	});
	const N = [
		[Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
		[Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
		[Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
		[Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz]
	];
	const q = topEigenvector(N) as Quat;
	const R = quatToMatrix(q);
	return {
		R,
		rms: rmsd(
			from.map((p) => apply(R, p)),
			to
		)
	};
}

function rmsd(a: V3[], b: V3[]) {
	const s = a.reduce((acc, p, i) => acc + dot(sub(p, b[i]), sub(p, b[i])), 0);
	return Math.sqrt(s / a.length);
}

/** Rotation taking unit directions (a1, a2) onto (b1, b2) as closely as possible (a1 exact). */
function frame(u: V3, v: V3): M3 {
	const e1 = unit(u);
	const e3 = unit(cross(u, v));
	const e2 = cross(e3, e1);
	return [e1, e2, e3];
}
export function alignTwo(from: V3[], to: V3[], i: number, j: number): M3 {
	// Columns of the frames: R = Fto · Ffromᵀ.
	const Ff = transpose(frame(from[i], from[j]));
	const Ft = transpose(frame(to[i], to[j]));
	return mul(Ft, transpose(Ff));
}

/** Groups (by index) that lie within `tol` Å of the same group in the target. */
export function lined(from: V3[], to: V3[], tol = 0.3) {
	return from.map((p, i) => norm(sub(p, to[i])) < tol);
}

/** Which group of the target each moved group lands on (index, or −1), for labels. */
export function landsOn(from: V3[], to: V3[], tol = 0.3) {
	return from.map((p) => to.findIndex((q) => norm(sub(p, q)) < tol));
}

export const mirror = (v: V3): V3 => [-v[0], v[1], v[2]];

// ------------------------------------------------------------------ the molecules

function fromCartesian(
	atoms: { el: string; xyz: [number, number, number] }[],
	labels: Record<string, string> = {}
): Group[] {
	const c = atoms.find((a) => a.el === 'C');
	if (!c) throw new Error('no carbon');
	return atoms
		.filter((a) => a !== c)
		.map((a) => ({ label: labels[a.el] ?? a.el, el: a.el, pos: sub(a.xyz, c.xyz) }));
}

/** Ideal tetrahedral directions (for alanine's groups). */
const TETRA: V3[] = [
	[0, 0, 1],
	[Math.sqrt(8 / 9), 0, -1 / 3],
	[-Math.sqrt(2 / 9), Math.sqrt(2 / 3), -1 / 3],
	[-Math.sqrt(2 / 9), -Math.sqrt(2 / 3), -1 / 3]
];
const scale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];

export const CENTRES: Centre[] = [
	{
		id: 'CHFClBr',
		name: 'bromochlorofluoromethane',
		formula: 'CHBrClF',
		groups: fromCartesian(CHFCLBR),
		source: 'measured geometry (NIST CCCBDB)'
	},
	{
		id: 'alanine',
		name: 'alanine',
		formula: 'C₃H₇NO₂',
		// L-alanine, the form in proteins: (S) by the CIP rule (checked in the tests).
		groups: [
			{ label: 'H', el: 'H', pos: scale(TETRA[0], 1.09) },
			{ label: 'COOH', el: 'C', pos: scale(TETRA[1], 1.53) },
			{ label: 'NH₂', el: 'N', pos: scale(TETRA[2], 1.47) },
			{ label: 'CH₃', el: 'C', pos: scale(TETRA[3], 1.53) }
		],
		source: 'groups drawn as single balls; ideal tetrahedral angles'
	},
	{
		id: 'CH2FCl',
		name: 'chlorofluoromethane',
		formula: 'CH₂ClF',
		groups: fromCartesian(CH2FCL),
		source: 'measured geometry (NIST CCCBDB)'
	}
];

/** Chirality sense at the centre for groups listed in CIP priority (highest first): R or S. */
export function rs(groups: V3[]): 'R' | 'S' {
	// View with the lowest priority (last) pointing away: 1 → 2 → 3 clockwise is R.
	const [a, b, c, d] = groups;
	// Signed volume of (a, b, c) seen from opposite d.
	const s = dot(cross(sub(a, d), sub(b, d)), sub(c, d));
	return s < 0 ? 'R' : 'S';
}
