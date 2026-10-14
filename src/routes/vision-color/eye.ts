/**
 * The optics of the eye: the Gullstrand–Emsley simplified schematic eye, traced with
 * paraxial (small-angle) optics.
 *
 * Reference: Bennett, A. G. & Rabbetts, R. B., "Clinical Visual Optics" (Gullstrand–Emsley
 * simplified schematic eye): a single-surface cornea of radius 7.8 mm, aqueous and vitreous of
 * index 4/3, a lens of index 1.416. Relaxed: the lens's front face 3.6 mm behind the cornea,
 * radii +10 mm and −6 mm, 3.6 mm thick; eye power +60.48 D, axial length 23.89 mm.
 * Accommodated: the front face at 3.2 mm, radii +5 mm and −5 mm, 4.0 mm thick; +69.72 D.
 * Between the two the lens's curvatures, thickness and position are interpolated linearly in
 * the "shape" parameter (0 relaxed, 1 fully rounded); its back face stays 7.2 mm behind the
 * cornea in both.
 *
 * Distances are in millimetres along the axis from the corneal apex (negative in front of the
 * eye); powers and vergences in dioptres (1/m). A paraxial ray is (y, nu): its height in mm and
 * its angle times the index of the medium it is in. Glasses are a thin lens 12 mm in front of the
 * cornea (the usual vertex distance).
 */

export const N_AIR = 1;
export const N_WATER = 1.333;
/** Aqueous and vitreous humour. */
export const N_HUMOUR = 4 / 3;
export const N_LENS = 1.416;
export const R_CORNEA = 7.8;
/** The lens's back face, mm behind the cornea (the same relaxed and accommodated). */
export const LENS_BACK = 7.2;
/** Glasses sit this far in front of the cornea, mm. */
export const VERTEX = 12;
/** Pupil diameter used for the rays and the blur, mm (a pupil in ordinary indoor light). */
export const PUPIL = 5;

export interface Surface {
	/** Position on the axis, mm from the corneal apex. */
	z: number;
	/** Radius of curvature, mm (positive: centre behind the surface). */
	r: number;
	/** Index in front of and behind the surface. */
	n1: number;
	n2: number;
	/** Power, D. */
	power: number;
}

export interface Lens {
	front: number;
	thickness: number;
	r1: number;
	r2: number;
}

/** The crystalline lens for a shape 0 (relaxed) … 1 (fully rounded). */
export function lensFor(shape: number): Lens {
	const a = Math.min(1, Math.max(0, shape));
	const c1 = 1 / 10 + a * (1 / 5 - 1 / 10);
	const c2 = -1 / 6 + a * (-1 / 5 + 1 / 6);
	const thickness = 3.6 + 0.4 * a;
	return { front: LENS_BACK - thickness, thickness, r1: 1 / c1, r2: 1 / c2 };
}

const surface = (z: number, r: number, n1: number, n2: number): Surface => ({
	z,
	r,
	n1,
	n2,
	power: (n2 - n1) / (r / 1000)
});

/** The eye's three refracting surfaces for a lens shape, in air or under water. */
export function surfaces(shape: number, outside = N_AIR): Surface[] {
	const l = lensFor(shape);
	return [
		surface(0, R_CORNEA, outside, N_HUMOUR),
		surface(l.front, l.r1, N_HUMOUR, N_LENS),
		surface(LENS_BACK, l.r2, N_LENS, N_HUMOUR)
	];
}

/** A paraxial ray: height y (mm) and reduced angle nu (index × angle in radians) at z. */
export interface Ray {
	z: number;
	y: number;
	nu: number;
	n: number;
}

function move(ray: Ray, z: number): Ray {
	return { ...ray, z, y: ray.y + ((z - ray.z) / ray.n) * ray.nu };
}
/** Refraction at a surface of power F (D): nu' = nu − y·F, with y converted to metres. */
function bend(ray: Ray, power: number, n2: number): Ray {
	return { ...ray, n: n2, nu: ray.nu - (ray.y / 1000) * power };
}

/**
 * Traces a paraxial ray through glasses (power `glasses`, 0 for none) and the eye, to the plane
 * `zEnd`. Returns the ray at each surface it crosses, in order.
 */
export function traceRay(
	start: Ray,
	shape: number,
	glasses: number,
	zEnd: number,
	outside = N_AIR
): Ray[] {
	const out: Ray[] = [start];
	let ray = start;
	if (glasses !== 0 && ray.z < -VERTEX) {
		ray = bend(move(ray, -VERTEX), glasses, ray.n);
		out.push(ray);
	}
	for (const s of surfaces(shape, outside)) {
		if (s.z <= ray.z) continue;
		ray = bend(move(ray, s.z), s.power, s.n2);
		out.push(ray);
	}
	out.push(move(ray, zEnd));
	return out;
}

type Matrix = [number, number, number, number]; // [A, B, C, D] acting on (y [m], nu)
const mul = (a: Matrix, b: Matrix): Matrix => [
	a[0] * b[0] + a[1] * b[2],
	a[0] * b[1] + a[1] * b[3],
	a[2] * b[0] + a[3] * b[2],
	a[2] * b[1] + a[3] * b[3]
];

/** Ray-transfer matrix of the eye from just in front of the cornea to just behind the lens. */
function eyeMatrix(shape: number, outside = N_AIR): Matrix {
	let m: Matrix = [1, 0, 0, 1];
	let z = 0;
	let n = outside;
	for (const s of surfaces(shape, outside)) {
		m = mul([1, (s.z - z) / 1000 / n, 0, 1], m);
		m = mul([1, 0, -s.power, 1], m);
		z = s.z;
		n = s.n2;
	}
	return m;
}

/** Equivalent power of the whole eye, D (Gullstrand–Emsley: 60.48 relaxed, 69.72 rounded). */
export function eyePower(shape: number, outside = N_AIR): number {
	return -eyeMatrix(shape, outside)[2];
}

/** Equivalent power of the crystalline lens on its own, in the humour around it, D. */
export function lensPower(shape: number): number {
	const [, f, b] = surfaces(shape);
	const l = lensFor(shape);
	return f.power + b.power - ((l.thickness / 1000) * f.power * b.power) / N_LENS;
}

/** Power of the cornea, D (≈ 0 under water: water and the eye's humour have the same index). */
export function corneaPower(outside = N_AIR): number {
	return surfaces(0, outside)[0].power;
}

/**
 * Where the eye forms the image of a point whose light arrives at the cornea with vergence
 * `v` (D; 0 for a distant object, −1/d for an object d metres away): mm from the cornea.
 * Infinity if the light leaves the lens parallel.
 */
export function imageZ(v: number, shape: number, outside = N_AIR): number {
	const [A, B, C, D] = eyeMatrix(shape, outside);
	// A ray 1 mm from the axis at the cornea, in light of vergence v: nu = −v·y.
	const y = 0.001;
	const nu = -v * y;
	const y2 = A * y + B * nu;
	const nu2 = C * y + D * nu;
	if (Math.abs(nu2) < 1e-12) return Infinity;
	return LENS_BACK - (y2 / nu2) * N_HUMOUR * 1000;
}

/** Axial length (cornea to retina, mm) of an eye that focuses distant objects when relaxed. */
export const NORMAL_LENGTH = imageZ(0, 0);

/** Vergence at the cornea (D) that a lens of this shape focuses on a retina `length` mm away. */
export function focusedVergence(length: number, shape: number, outside = N_AIR): number {
	const [A, B, C, D] = eyeMatrix(shape, outside);
	const k = ((length - LENS_BACK) / 1000) * (1 / N_HUMOUR);
	// Behind the lens: y_r = y2 + k·nu2 = 0 → (A + kC)·y + (B + kD)·nu = 0, with nu = −v·y.
	return (A + k * C) / (B + k * D);
}

/** Vergence at the cornea of light from a point `d` metres in front of the cornea, after glasses. */
export function arrivingVergence(objectVergence: number, glasses: number): number {
	if (glasses === 0) return objectVergence;
	// The object's vergence is given at the cornea: its distance from the glasses is d − 12 mm.
	const d = objectVergence === 0 ? Infinity : -1 / objectVergence; // metres
	const atGlasses = Number.isFinite(d) ? -1 / (d - VERTEX / 1000) : 0;
	const after = atGlasses + glasses;
	// Then 12 mm of air to the cornea.
	return after / (1 - (VERTEX / 1000) * after);
}

/**
 * Defocus, D: the vergence arriving at the cornea minus the vergence the eye focuses on its
 * retina. Positive: the light comes to a focus in front of the retina (short sight's blur);
 * negative: behind it.
 */
export function defocus(
	objectVergence: number,
	shape: number,
	length: number,
	glasses = 0,
	outside = N_AIR
): number {
	return arrivingVergence(objectVergence, glasses) - focusedVergence(length, shape, outside);
}

/** Angular diameter of the blur disc, radians: pupil diameter × defocus (small-angle). */
export function blurAngle(d: number, pupil = PUPIL): number {
	return (pupil / 1000) * Math.abs(d);
}

/**
 * Glasses (D, at the 12 mm vertex distance) that focus a distant object on the retina of a
 * relaxed eye `length` mm long.
 */
export function prescription(length: number): number {
	const far = focusedVergence(length, 0); // vergence at the cornea of the far point
	// The far point is −1/far metres in front of the cornea; glasses must image infinity there.
	if (Math.abs(far) < 1e-12) return 0;
	const fromGlasses = -1 / far - VERTEX / 1000;
	return -1 / fromGlasses;
}

/** Axial length (mm) of an eye whose glasses prescription is `rx` dioptres. */
export function lengthFor(rx: number): number {
	let lo = 18;
	let hi = 32;
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		// prescription falls as the eye gets longer
		if (prescription(mid) > rx) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** The three eyes of the page: normal, short-sighted (−3.00 D), long-sighted (+4.00 D). */
export const EYES = {
	normal: { label: 'Normal eye', length: NORMAL_LENGTH, rx: 0 },
	short: { label: 'Short-sighted eye', length: lengthFor(-3), rx: -3 },
	long: { label: 'Long-sighted eye', length: lengthFor(4), rx: 4 }
} as const;
export type EyeKind = keyof typeof EYES;

/** Nearest point (cm from the cornea) that the eye can focus with its lens fully rounded. */
export function nearPoint(length: number, glasses = 0): number {
	const v = focusedVergence(length, 1);
	// Find the object vergence whose arriving vergence (after glasses) equals v.
	let lo = -40;
	let hi = 10;
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		if (arrivingVergence(mid, glasses) > v) hi = mid;
		else lo = mid;
	}
	const obj = (lo + hi) / 2;
	return obj >= 0 ? Infinity : -100 / obj;
}

/**
 * The lens shape (0…1) that focuses an object of vergence `objectVergence` on the retina, or
 * the nearest the lens can manage (0 or 1) if none can.
 */
export function bestShape(objectVergence: number, length: number, glasses = 0): number {
	const target = arrivingVergence(objectVergence, glasses);
	// focusedVergence falls monotonically as the shape rounds.
	if (focusedVergence(length, 0) <= target) return 0;
	if (focusedVergence(length, 1) >= target) return 1;
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 50; i++) {
		const mid = (lo + hi) / 2;
		if (focusedVergence(length, mid) > target) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** Within this defocus (D) the image counts as sharp (the eye's depth of focus, about ±0.3 D). */
export const SHARP = 0.3;
