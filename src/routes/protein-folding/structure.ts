/**
 * Geometry for comparing two 3D structures of the same protein: optimal superposition of
 * matched points (Horn's quaternion method, J. Opt. Soc. Am. A 4, 629, 1987, which gives the
 * same least-squares rotation as Kabsch's), root-mean-square deviation, principal axes, and
 * AlphaFold's confidence bands. Plain TypeScript, no dependencies; also used by
 * `scripts/data/protein-folding/build-proteins.mjs`.
 */

export type Vec3 = [number, number, number];
/** Row-major 3 × 3 rotation matrix. */
export type Mat3 = [Vec3, Vec3, Vec3];

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const apply = (m: Mat3, v: Vec3): Vec3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

export function centroid(ps: readonly Vec3[]): Vec3 {
	const c: Vec3 = [0, 0, 0];
	for (const p of ps) {
		c[0] += p[0];
		c[1] += p[1];
		c[2] += p[2];
	}
	return [c[0] / ps.length, c[1] / ps.length, c[2] / ps.length];
}

/**
 * Eigenvalues and eigenvectors of a symmetric matrix by Jacobi rotations. Returns them
 * sorted by decreasing eigenvalue; `vectors[k]` is the k-th eigenvector.
 */
export function eigenSymmetric(a: number[][]): { values: number[]; vectors: number[][] } {
	const n = a.length;
	const m = a.map((r) => r.slice());
	const v: number[][] = m.map((_, i) => m.map((__, j) => (i === j ? 1 : 0)));
	for (let sweep = 0; sweep < 100; sweep++) {
		let off = 0;
		for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += m[i][j] * m[i][j];
		if (off < 1e-22) break;
		for (let p = 0; p < n; p++) {
			for (let q = p + 1; q < n; q++) {
				if (Math.abs(m[p][q]) < 1e-300) continue;
				const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
				const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
				const c = 1 / Math.sqrt(t * t + 1);
				const s = t * c;
				for (let k = 0; k < n; k++) {
					const mkp = m[k][p];
					const mkq = m[k][q];
					m[k][p] = c * mkp - s * mkq;
					m[k][q] = s * mkp + c * mkq;
				}
				for (let k = 0; k < n; k++) {
					const mpk = m[p][k];
					const mqk = m[q][k];
					m[p][k] = c * mpk - s * mqk;
					m[q][k] = s * mpk + c * mqk;
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
	const order = m.map((_, i) => i).sort((i, j) => m[j][j] - m[i][i]);
	return { values: order.map((i) => m[i][i]), vectors: order.map((i) => v.map((row) => row[i])) };
}

export interface Superposition {
	/** Rotation to apply to the moving points after subtracting `from`. */
	rotation: Mat3;
	/** Centroid of the moving points. */
	from: Vec3;
	/** Centroid of the target points. */
	to: Vec3;
	/** Root-mean-square deviation after superposition, in the points' unit. */
	rmsd: number;
}

/**
 * The rigid motion that best superposes `moving` onto `target` (matched point by point), in
 * the least-squares sense, and the remaining RMSD.
 */
export function superpose(moving: readonly Vec3[], target: readonly Vec3[]): Superposition {
	if (moving.length !== target.length || moving.length < 3) throw new Error('need ≥ 3 pairs');
	const from = centroid(moving);
	const to = centroid(target);
	const S = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	let e0 = 0;
	for (let k = 0; k < moving.length; k++) {
		const a = sub(moving[k], from);
		const b = sub(target[k], to);
		e0 += dot(a, a) + dot(b, b);
		for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] += a[i] * b[j];
	}
	const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
	const N = [
		[xx + yy + zz, yz - zy, zx - xz, xy - yx],
		[yz - zy, xx - yy - zz, xy + yx, zx + xz],
		[zx - xz, xy + yx, -xx + yy - zz, yz + zy],
		[xy - yx, zx + xz, yz + zy, -xx - yy + zz]
	];
	const { values, vectors } = eigenSymmetric(N);
	const [q0, q1, q2, q3] = vectors[0];
	const rotation: Mat3 = [
		[q0 * q0 + q1 * q1 - q2 * q2 - q3 * q3, 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2)],
		[2 * (q1 * q2 + q0 * q3), q0 * q0 - q1 * q1 + q2 * q2 - q3 * q3, 2 * (q2 * q3 - q0 * q1)],
		[2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3]
	];
	const rmsd = Math.sqrt(Math.max(0, (e0 - 2 * values[0]) / moving.length));
	return { rotation, from, to, rmsd };
}

/** Places a point of the moving structure in the target's frame. */
export const place = (s: Superposition, p: Vec3): Vec3 =>
	add(apply(s.rotation, sub(p, s.from)), s.to);

/** Root-mean-square distance between matched points, as they are (no superposition). */
export function rmsd(a: readonly Vec3[], b: readonly Vec3[]): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += distance(a[i], b[i]) ** 2;
	return Math.sqrt(s / a.length);
}

/** Principal axes of a point cloud (longest first), as the rows of a rotation matrix. */
export function principalAxes(ps: readonly Vec3[]): Mat3 {
	const c = centroid(ps);
	const C = [
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0]
	];
	for (const p of ps) {
		const d = sub(p, c);
		for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j];
	}
	const [a, b] = eigenSymmetric(C).vectors as Vec3[];
	// right-handed: third axis = a × b
	const z: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
	return [a, b, z];
}

/**
 * AlphaFold's per-residue confidence (pLDDT, 0–100) bands, as the AlphaFold Protein
 * Structure Database colours them.
 */
export type Band = 'veryHigh' | 'high' | 'low' | 'veryLow';
export const band = (plddt: number): Band =>
	plddt > 90 ? 'veryHigh' : plddt > 70 ? 'high' : plddt > 50 ? 'low' : 'veryLow';
export const BAND_LABEL: Record<Band, string> = {
	veryHigh: 'very high (pLDDT > 90)',
	high: 'confident (90 > pLDDT > 70)',
	low: 'low (70 > pLDDT > 50)',
	veryLow: 'very low (pLDDT < 50)'
};
/** The AlphaFold DB's own colours for the four bands. */
export const BAND_COLOR: Record<Band, string> = {
	veryHigh: '#0053d6',
	high: '#65cbf3',
	low: '#ffdb13',
	veryLow: '#ff7d45'
};
