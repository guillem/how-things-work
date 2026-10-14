/**
 * Coordinates: x to the right of the picture, y DOWN the picture (for the body,
 * towards the patient's back), angles from +x towards +y.
 *
 * The physics behind the medical-imaging explainer, in plain TypeScript.
 *
 * X-rays: Beer–Lambert attenuation I = I₀·e^(−μx) with μ = (μ/ρ)·ρ from the NIST
 * tables (`tissues.ts`), interpolated log–log between tabulated energies. The
 * beam is treated as monochromatic (one energy), so there is no beam hardening,
 * and scattered photons are counted as removed from the beam.
 *
 * CT: a parallel-beam scanner. Phantoms are sums of uniform ellipses (2-D) or
 * ellipsoids and elliptic cylinders (3-D), so every projection (line integral of
 * μ) is exact and analytic. The slice is rebuilt by filtered back-projection
 * with the Ram–Lak (ramp) kernel, as in Kak & Slaney, "Principles of
 * Computerized Tomographic Imaging" (IEEE Press 1988, SIAM 2001), ch. 3:
 *   q_θ = τ · (p_θ ⊛ h),  h(0) = 1/(4τ²), h(odd n) = −1/(n²π²τ²), h(even n) = 0,
 *   f(x, y) ≈ (π/K) Σ_k q_θk(x cos θk + y sin θk),  θk = kπ/K.
 * Photon noise: a detector bin that expects N = N₀·e^(−p) photons measures the
 * line integral with a standard deviation of 1/√N (Poisson counting).
 *
 * Ultrasound: pulse-echo along one line through layers; impedance Z = ρc,
 * pressure reflection r = (Z₂ − Z₁)/(Z₂ + Z₁), intensity transmission 1 − r²,
 * amplitude attenuation α = α₀·f^b (IT'IS), and depth shown = 1540 m/s · t / 2.
 *
 * MRI: the Larmor frequency f = (γ/2π)·B with the CODATA 2018 proton value
 * 42.577 478 461 MHz/T, and the spin-echo signal S = PD·(1 − e^(−TR/T1))·e^(−TE/T2)
 * with T1, T2 at 1.5 T from IT'IS and equal proton density PD for every tissue.
 */
import { ENERGIES_KEV, TISSUE, XRAY, type Tissue, type XrayMaterial } from './tissues';

// ======================================================================================
// X-ray attenuation
// ======================================================================================

/** Linear attenuation coefficient μ (1/cm) of a material at an energy (keV, 20–150). */
export function mu(material: XrayMaterial, keV: number): number {
	const m = XRAY[material];
	const E = ENERGIES_KEV;
	const e = Math.min(E[E.length - 1], Math.max(E[0], keV));
	let i = 0;
	while (i < E.length - 2 && e > E[i + 1]) i++;
	const u = Math.log(e / E[i]) / Math.log(E[i + 1] / E[i]);
	const lr = Math.log(m.muRho[i]) * (1 - u) + Math.log(m.muRho[i + 1]) * u;
	return Math.exp(lr) * m.density;
}

/** Fraction of the photons that cross x cm of a material with coefficient μ. */
export const transmitted = (muPerCm: number, xCm: number) => Math.exp(-muPerCm * xCm);

/** Thickness (cm) that lets half the photons through. */
export const halfValueLayer = (muPerCm: number) => Math.LN2 / muPerCm;

/** CT number in Hounsfield units: water 0, air about −1000. */
export const hounsfield = (muPerCm: number, muWater: number) =>
	(1000 * (muPerCm - muWater)) / muWater;

/** The effective energy this page's CT scanner works at, keV. */
export const CT_KEV = 60;

// ======================================================================================
// Phantoms
// ======================================================================================

/** A uniform ellipse that adds `value` to everything inside it. */
export interface Ellipse {
	x0: number;
	y0: number;
	/** Semi-axis along the rotated x direction. */
	a: number;
	b: number;
	/** Rotation of the a axis from +x towards +y, radians. */
	phi: number;
	value: number;
}

export interface Phantom {
	/** Half the width of the square field of view, in the phantom's units. */
	fov: number;
	ellipses: Ellipse[];
	/** Unit of length, for readouts ('cm' or '' for the dimensionless head). */
	unit: string;
}

/** Value of a phantom at a point (sum of the ellipses that contain it). */
export function phantomAt(p: Phantom, x: number, y: number): number {
	let v = 0;
	for (const e of p.ellipses) {
		const dx = x - e.x0;
		const dy = y - e.y0;
		const c = Math.cos(e.phi);
		const s = Math.sin(e.phi);
		const u = (dx * c + dy * s) / e.a;
		const w = (-dx * s + dy * c) / e.b;
		if (u * u + w * w <= 1) v += e.value;
	}
	return v;
}

/**
 * Line integral of a phantom along the ray at angle θ and offset s: the ray is
 * the set of points with x cos θ + y sin θ = s.
 */
export function projection(p: Phantom, theta: number, s: number): number {
	const ct = Math.cos(theta);
	const st = Math.sin(theta);
	let sum = 0;
	for (const e of p.ellipses) {
		const sp = s - (e.x0 * ct + e.y0 * st);
		const ca = Math.cos(theta - e.phi);
		const sa = Math.sin(theta - e.phi);
		const a2 = e.a * e.a * ca * ca + e.b * e.b * sa * sa;
		if (sp * sp < a2) sum += (2 * e.value * e.a * e.b * Math.sqrt(a2 - sp * sp)) / a2;
	}
	return sum;
}

/**
 * The Shepp–Logan head phantom: L. A. Shepp and B. F. Logan, "The Fourier
 * reconstruction of a head section", IEEE Trans. Nucl. Sci. NS-21, 21–43
 * (1974), with the original (not the "modified", higher-contrast) values, as
 * listed in Kak & Slaney, Table 3.1, with y flipped because this page's y points
 * down the picture. Ten ellipses in a unit square; the skull
 * is 2.0, the brain 1.02 and the small features differ by 0.01–0.02.
 */
export const SHEPP_LOGAN: Phantom = {
	fov: 1,
	unit: '',
	ellipses: (
		[
			[0, 0, 0.92, 0.69, 90, 2.0],
			[0, -0.0184, 0.874, 0.6624, 90, -0.98],
			[0.22, 0, 0.31, 0.11, 72, -0.02],
			[-0.22, 0, 0.41, 0.16, 108, -0.02],
			[0, 0.35, 0.25, 0.21, 90, 0.01],
			[0, 0.1, 0.046, 0.046, 0, 0.01],
			[0, -0.1, 0.046, 0.046, 0, 0.01],
			[-0.08, -0.605, 0.046, 0.023, 0, 0.01],
			[0, -0.605, 0.023, 0.023, 0, 0.01],
			[0.06, -0.605, 0.046, 0.023, 90, 0.01]
		] as const
	).map(([x0, y0, a, b, deg, value]) => ({ x0, y0: -y0, a, b, phi: (-deg * Math.PI) / 180, value }))
};

// ---- the simple body -----------------------------------------------------------------

/** Material names used by the body (μ from the NIST tables). */
export type BodyMaterial = Exclude<XrayMaterial, 'air'> | 'air';

/**
 * One part of the body: an ellipsoid (semi-axes a, b, c, centre z0) or, when c
 * is Infinity, an elliptic cylinder from z0 − h to z0 + h. Axes are aligned
 * with x (patient's left, to the right of the picture), y (towards the back,
 * down in the picture) and z (towards the feet). A part replaces its parent's
 * material: parts never overlap their siblings and stay inside their parent.
 */
export interface BodyPart {
	id: string;
	name: string;
	material: BodyMaterial;
	parent: string | null;
	x0: number;
	y0: number;
	z0: number;
	a: number;
	b: number;
	c: number;
	/** Half-height of a cylinder (c = Infinity). */
	h?: number;
}

const TORSO_H = 20;

/** A simple torso, in centimetres. */
export const BODY: BodyPart[] = [
	{
		id: 'fat',
		name: 'fat under the skin',
		material: 'fat',
		parent: null,
		x0: 0,
		y0: 0,
		z0: 0,
		a: 16,
		b: 11,
		c: Infinity,
		h: TORSO_H
	},
	{
		id: 'muscle',
		name: 'muscle and organs',
		material: 'soft',
		parent: 'fat',
		x0: 0,
		y0: 0,
		z0: 0,
		a: 14.8,
		b: 9.8,
		c: Infinity,
		h: TORSO_H
	},
	{
		id: 'lungR',
		name: 'right lung',
		material: 'lung',
		parent: 'muscle',
		x0: -7.4,
		y0: 0.2,
		z0: -5,
		a: 4.4,
		b: 6.4,
		c: 11
	},
	{
		id: 'lungL',
		name: 'left lung',
		material: 'lung',
		parent: 'muscle',
		x0: 8.4,
		y0: 0.6,
		z0: -5,
		a: 3.8,
		b: 6.2,
		c: 11
	},
	{
		id: 'heart',
		name: 'heart',
		material: 'soft',
		parent: 'muscle',
		x0: 0.8,
		y0: -3.4,
		z0: 2,
		a: 3.6,
		b: 3.4,
		c: 5
	},
	{
		id: 'spine',
		name: 'spine',
		material: 'bone',
		parent: 'muscle',
		x0: 0,
		y0: 5.6,
		z0: 0,
		a: 2.2,
		b: 2.0,
		c: Infinity,
		h: TORSO_H
	},
	{
		id: 'marrow',
		name: 'marrow',
		material: 'soft',
		parent: 'spine',
		x0: 0,
		y0: 5.6,
		z0: 0,
		a: 1.4,
		b: 1.2,
		c: Infinity,
		h: TORSO_H
	},
	{
		id: 'sternum',
		name: 'breastbone',
		material: 'bone',
		parent: 'muscle',
		x0: 0,
		y0: -8.4,
		z0: -4,
		a: 1.6,
		b: 0.6,
		c: Infinity,
		h: 12
	},
	{
		id: 'liver',
		name: 'liver',
		material: 'soft',
		parent: 'muscle',
		x0: -6,
		y0: -1,
		z0: 14,
		a: 7.6,
		b: 6,
		c: 7
	},
	{
		id: 'cyst',
		name: 'cyst (fluid)',
		material: 'water',
		parent: 'liver',
		x0: -7,
		y0: -1.5,
		z0: 13,
		a: 1.5,
		b: 1.5,
		c: 1.5
	},
	{
		id: 'nodule',
		name: 'nodule',
		material: 'soft',
		parent: 'lungL',
		x0: 6.4,
		y0: 3.4,
		z0: 0,
		a: 0.8,
		b: 0.8,
		c: 0.8
	}
];

/** The body's extent along z, cm (head end negative). */
export const BODY_Z: readonly [number, number] = [-TORSO_H, TORSO_H];
export const BODY_FOV = 18;

/** Cross-section of a body part at height z: scale of its semi-axes (0 = absent). */
export function partScale(p: BodyPart, z: number): number {
	if (p.c === Infinity) return Math.abs(z - p.z0) <= (p.h ?? TORSO_H) ? 1 : 0;
	const u = (z - p.z0) / p.c;
	return u * u < 1 ? Math.sqrt(1 - u * u) : 0;
}

const partById = new Map(BODY.map((p) => [p.id, p]));

/** μ difference that a part adds to its parent, 1/cm. */
function partDelta(p: BodyPart, keV: number): number {
	const parent = p.parent ? partById.get(p.parent) : undefined;
	return mu(p.material, keV) - mu(parent ? parent.material : 'air', keV);
}

/** The body's slice at height z as a 2-D phantom of μ (1/cm) at an energy. */
export function bodySlice(z: number, keV = CT_KEV): Phantom {
	const ellipses: Ellipse[] = [];
	for (const p of BODY) {
		const s = partScale(p, z);
		if (s <= 0) continue;
		ellipses.push({ x0: p.x0, y0: p.y0, a: p.a * s, b: p.b * s, phi: 0, value: partDelta(p, keV) });
	}
	// The air around the body is ~0 (μ of air ≈ 0.0002/cm), so it is left out.
	return { fov: BODY_FOV, unit: 'cm', ellipses };
}

/** Which part of the body a point of a slice lies in (the innermost one). */
export function bodyPartAt(x: number, y: number, z: number): BodyPart | null {
	let found: BodyPart | null = null;
	let depth = -1;
	for (const p of BODY) {
		const s = partScale(p, z);
		if (s <= 0) continue;
		const u = (x - p.x0) / (p.a * s);
		const w = (y - p.y0) / (p.b * s);
		if (u * u + w * w > 1) continue;
		let d = 0;
		for (let q = p; q.parent; q = partById.get(q.parent) as BodyPart) d++;
		if (d > depth) {
			depth = d;
			found = p;
		}
	}
	return found;
}

/**
 * A plain X-ray (front to back, along y) of the body: the line integral of μ
 * through the body at (x, z), cm·(1/cm), i.e. the p in I = I₀·e^(−p).
 */
export function radiographAt(x: number, z: number, keV = CT_KEV): number {
	let sum = 0;
	for (const p of BODY) {
		const s = partScale(p, z);
		if (s <= 0) continue;
		const a = p.a * s;
		const u = (x - p.x0) / a;
		if (u * u >= 1) continue;
		sum += 2 * p.b * s * Math.sqrt(1 - u * u) * partDelta(p, keV);
	}
	return sum;
}

/** A single small dot, to see how one point spreads when it is back-projected. */
export const POINT: Phantom = {
	fov: BODY_FOV,
	unit: 'cm',
	ellipses: [{ x0: 4, y0: -3, a: 0.5, b: 0.5, phi: 0, value: 1 }]
};

// ======================================================================================
// CT: sinogram and reconstruction
// ======================================================================================

/** Detector bins and image pixels across the field of view. */
export const CT_N = 128;

export interface Sinogram {
	/** Number of angles K, at θk = kπ/K. */
	angles: number;
	/** Bins per projection. */
	bins: number;
	/** Bin spacing (phantom units). */
	tau: number;
	/** Field of view half-width. */
	fov: number;
	/** angles × bins line integrals, row k = angle k. */
	data: Float64Array;
}

/** Offset of detector bin j from the centre. */
export const binOffset = (j: number, bins: number, tau: number) => (j + 0.5 - bins / 2) * tau;

/**
 * Small deterministic pseudo-random normal numbers (Box–Muller on a hashed
 * integer), so a noisy scan looks the same every time it is drawn.
 */
export function gauss(i: number): number {
	const h = (n: number) => {
		let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
		x ^= x >>> 13;
		x = Math.imul(x, 0xc2b2ae35);
		x ^= x >>> 16;
		return ((x >>> 0) + 0.5) / 4294967296;
	};
	const u1 = h(2 * i + 1);
	const u2 = h(2 * i + 2);
	return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Measures every projection of a phantom, each detector bin averaging the
 * line integrals across its width. With `photons` (N₀, photons sent per
 * detector bin per angle), each line integral gets the Poisson counting noise of
 * the N₀·e^(−p) photons that arrive, σ = 1/√(N₀·e^(−p)).
 */
export function scan(p: Phantom, angles: number, photons?: number, bins = 2 * CT_N): Sinogram {
	const tau = (2 * p.fov) / bins;
	const data = new Float64Array(angles * bins);
	for (let k = 0; k < angles; k++) {
		const th = (k * Math.PI) / angles;
		for (let j = 0; j < bins; j++) {
			// Each detector element is a bin wide and averages what falls on it.
			const s0 = binOffset(j, bins, tau);
			let v = 0;
			for (let q = 0; q < 4; q++) v += projection(p, th, s0 + ((q + 0.5) / 4 - 0.5) * tau) / 4;
			if (photons) {
				const n = photons * Math.exp(-v);
				v += gauss(k * 4099 + j) / Math.sqrt(Math.max(n, 1));
			}
			data[k * bins + j] = v;
		}
	}
	return { angles, bins, tau, fov: p.fov, data };
}

/** The Ram–Lak (ramp) kernel h(n) for bin spacing τ, n = −(bins−1)…bins−1. */
export function rampKernel(bins: number, tau: number): Float64Array {
	const h = new Float64Array(2 * bins - 1);
	for (let n = -(bins - 1); n <= bins - 1; n++) {
		const i = n + bins - 1;
		if (n === 0) h[i] = 1 / (4 * tau * tau);
		else if (n % 2 !== 0) h[i] = -1 / (n * n * Math.PI * Math.PI * tau * tau);
	}
	return h;
}

/** Filters one projection with the ramp kernel: q = τ·(p ⊛ h), zero-padded. */
export function filterProjection(p: ArrayLike<number>, tau: number, kernel?: Float64Array) {
	const n = p.length;
	const h = kernel ?? rampKernel(n, tau);
	const q = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		let s = 0;
		for (let j = 0; j < n; j++) s += p[j] * h[i - j + n - 1];
		q[i] = s * tau;
	}
	return q;
}

/** The whole sinogram, every row filtered (or a copy when `filtered` is false). */
export function filterSinogram(s: Sinogram): Sinogram {
	const h = rampKernel(s.bins, s.tau);
	const data = new Float64Array(s.data.length);
	for (let k = 0; k < s.angles; k++) {
		const row = s.data.subarray(k * s.bins, (k + 1) * s.bins);
		data.set(filterProjection(row, s.tau, h), k * s.bins);
	}
	return { ...s, data };
}

/**
 * Adds the back-projections of rows `from`…`to − 1` of a sinogram into an N × N
 * image (row 0 at the top, y pointing down the picture). Each row is smeared
 * back along its rays, weighted by π/K, so after all K rows of a filtered
 * sinogram the image holds the reconstructed values.
 */
export function backProject(s: Sinogram, image: Float64Array, n: number, from: number, to: number) {
	const px = (2 * s.fov) / n;
	const w = Math.PI / s.angles;
	const half = s.bins / 2;
	for (let k = from; k < to; k++) {
		const th = (k * Math.PI) / s.angles;
		const ct = Math.cos(th);
		const st = Math.sin(th);
		const row = k * s.bins;
		for (let r = 0; r < n; r++) {
			const y = -s.fov + (r + 0.5) * px; // phantom y (down the picture) at this row
			const base = y * st;
			for (let c = 0; c < n; c++) {
				const x = -s.fov + (c + 0.5) * px;
				// fractional bin index of offset x cos θ + y sin θ
				const f = (x * ct + base) / s.tau + half - 0.5;
				const j = Math.floor(f);
				if (j < 0 || j >= s.bins - 1) continue;
				const u = f - j;
				image[r * n + c] += w * (s.data[row + j] * (1 - u) + s.data[row + j + 1] * u);
			}
		}
	}
}

/** Reconstructs a slice from all rows of a sinogram (filtered or not). */
export function reconstruct(s: Sinogram, filtered: boolean, n = CT_N): Float64Array {
	const img = new Float64Array(n * n);
	backProject(filtered ? filterSinogram(s) : s, img, n, 0, s.angles);
	return img;
}

/**
 * The true slice on the same N × N grid (row 0 at the top), averaged over 3 × 3
 * points per pixel so edges are fair to the reconstruction.
 */
export function truth(p: Phantom, n = CT_N): Float64Array {
	const img = new Float64Array(n * n);
	const px = (2 * p.fov) / n;
	for (let r = 0; r < n; r++)
		for (let c = 0; c < n; c++) {
			let v = 0;
			for (let i = 0; i < 3; i++)
				for (let j = 0; j < 3; j++)
					v += phantomAt(p, -p.fov + (c + (j + 0.5) / 3) * px, -p.fov + (r + (i + 0.5) / 3) * px);
			img[r * n + c] = v / 9;
		}
	return img;
}

/**
 * Root-mean-square difference between a reconstruction and the true slice,
 * over the pixels inside the scanned circle, as a fraction of the RMS of the
 * true slice there.
 */
export function relativeError(recon: ArrayLike<number>, ref: ArrayLike<number>, n = CT_N): number {
	let d2 = 0;
	let r2 = 0;
	for (let r = 0; r < n; r++)
		for (let c = 0; c < n; c++) {
			const x = (c + 0.5) / n - 0.5;
			const y = (r + 0.5) / n - 0.5;
			if (x * x + y * y > 0.25) continue;
			const i = r * n + c;
			d2 += (recon[i] - ref[i]) ** 2;
			r2 += ref[i] ** 2;
		}
	return Math.sqrt(d2 / r2);
}

/**
 * The same difference after scaling the reconstruction by the single factor
 * that brings it closest to the true slice, so a blurred image whose numbers
 * are not to scale (plain back-projection) is judged on its shape alone.
 */
export function fittedError(recon: ArrayLike<number>, ref: ArrayLike<number>, n = CT_N): number {
	let rr = 0;
	let rt = 0;
	for (let r = 0; r < n; r++)
		for (let c = 0; c < n; c++) {
			const x = (c + 0.5) / n - 0.5;
			const y = (r + 0.5) / n - 0.5;
			if (x * x + y * y > 0.25) continue;
			const i = r * n + c;
			rr += recon[i] * recon[i];
			rt += recon[i] * ref[i];
		}
	const k = rr > 0 ? rt / rr : 0;
	return relativeError(
		Array.from(recon, (v) => v * k),
		ref,
		n
	);
}

/** Value of an N × N image at phantom coordinates (x, y down), nearest pixel. */
export function imageAt(img: ArrayLike<number>, fov: number, x: number, y: number, n = CT_N) {
	const c = Math.floor(((x + fov) / (2 * fov)) * n);
	const r = Math.floor(((y + fov) / (2 * fov)) * n);
	if (c < 0 || r < 0 || c >= n || r >= n) return 0;
	return img[r * n + c];
}

/** Mean of an image over a disc (phantom units), for a probe. */
export function discMean(
	img: ArrayLike<number>,
	fov: number,
	x: number,
	y: number,
	rad: number,
	n = CT_N
) {
	const px = (2 * fov) / n;
	let s = 0;
	let m = 0;
	for (let dy = -rad; dy <= rad; dy += px / 2)
		for (let dx = -rad; dx <= rad; dx += px / 2) {
			if (dx * dx + dy * dy > rad * rad) continue;
			s += imageAt(img, fov, x + dx, y + dy, n);
			m++;
		}
	return m ? s / m : 0;
}

// ---- radiation dose ------------------------------------------------------------------

/**
 * Typical adult effective doses, mSv, from RadiologyInfo.org (ACR and RSNA),
 * "Radiation Dose from X-Ray and CT Exams",
 * https://www.radiologyinfo.org/en/info/safety-xray (last reviewed 15 Apr 2025).
 */
export const DOSES_MSV = {
	chestXray: 0.1,
	ctHead: 1.6,
	ctLungScreening: 1.5,
	ctChest: 6.1,
	ctAbdomenPelvis: 7.7,
	backgroundPerYear: 3
} as const;

/** Days of natural background radiation (3 mSv a year) that equal a dose. */
export const backgroundDays = (mSv: number) => (mSv / DOSES_MSV.backgroundPerYear) * 365.25;

// ======================================================================================
// Ultrasound
// ======================================================================================

/** The speed every scanner assumes, m/s (Radiopaedia, "Propagation speed"). */
export const C_ASSUMED = 1540;

/** Acoustic impedance ρc of a tissue, in MRayl (10⁶ kg/(m²·s)). */
export function impedance(t: Tissue | 'water'): number {
	const p = t === 'water' ? WATER : TISSUE[t];
	return ((p.density ?? 0) * (p.speed ?? 0)) / 1e6;
}

/** Water, for the coupling gel: IT'IS "Water". */
const WATER = { density: 994.04, speed: 1482.3, alpha0: 0.025328436, alphaPower: 1 };

/** Fraction of the sound intensity reflected where tissue a meets tissue b. */
export function reflected(za: number, zb: number): number {
	const r = (zb - za) / (zb + za);
	return r * r;
}

export interface Layer {
	tissue: Tissue | 'water';
	/** Thickness, cm. */
	d: number;
}

/** Layers under the probe, from the skin down: a line through the belly. */
export const US_LAYERS: Layer[] = [
	{ tissue: 'skin', d: 0.2 },
	{ tissue: 'subcutaneousFat', d: 1.6 },
	{ tissue: 'muscle', d: 1.4 },
	{ tissue: 'liver', d: 4.2 },
	{ tissue: 'blood', d: 1.2 },
	{ tissue: 'liver', d: 2.6 },
	{ tissue: 'bone', d: 1.0 }
];

export interface Echo {
	/** Depth of the boundary, cm (true). */
	depth: number;
	/** Round-trip time, μs. */
	time: number;
	/** Depth the scanner draws it at (1540 m/s), cm. */
	shown: number;
	/** Echo strength relative to the outgoing pulse, dB (≤ 0). */
	dB: number;
	/** Fraction of the intensity reflected at this boundary. */
	R: number;
	from: Tissue | 'water' | 'air';
	to: Tissue | 'water' | 'air';
}

function props(t: Tissue | 'water' | 'air') {
	if (t === 'water') return WATER;
	return TISSUE[t] as { density: number; speed: number; alpha0: number; alphaPower: number };
}

/**
 * The echoes a pulse of frequency f (MHz) sends back from every boundary.
 * Depths are measured from the face of the probe (taken as water-like). With
 * gel, 1 mm of it couples the probe to the skin; without, a 0.1 mm film of air
 * sits between them.
 */
export function echoes(fMHz: number, gel = true, layers = US_LAYERS): Echo[] {
	const stack: { tissue: Tissue | 'water' | 'air'; d: number }[] = [
		...(gel
			? [{ tissue: 'water' as const, d: 0.1 }]
			: [
					{ tissue: 'water' as const, d: 0 },
					{ tissue: 'air' as const, d: 0.01 }
				]),
		...layers
	];
	const out: Echo[] = [];
	let depth = 0; // cm from the probe face
	let time = 0; // one way, s
	let amp = 1; // pressure amplitude kept on the way down and back so far
	for (let i = 0; i < stack.length - 1; i++) {
		const a = props(stack[i].tissue);
		const dm = stack[i].d / 100;
		depth += stack[i].d;
		time += dm / a.speed;
		amp *= Math.exp(-2 * a.alpha0 * Math.pow(fMHz, a.alphaPower) * dm);
		const b = props(stack[i + 1].tissue);
		const R = reflected(a.density * a.speed, b.density * b.speed);
		out.push({
			depth,
			time: 2 * time * 1e6,
			shown: C_ASSUMED * time * 100,
			dB: 20 * Math.log10(Math.max(amp * Math.sqrt(R), 1e-30)),
			R,
			from: stack[i].tissue,
			to: stack[i + 1].tissue
		});
		// Pressure transmitted down and back up through this boundary: 1 − R.
		amp *= 1 - R;
	}
	return out;
}

/** Wavelength in soft tissue at 1540 m/s, mm. */
export const wavelengthMm = (fMHz: number) => (C_ASSUMED / (fMHz * 1e6)) * 1000;

// ======================================================================================
// MRI
// ======================================================================================

/** Proton gyromagnetic ratio γ/2π, MHz/T (CODATA 2018). */
export const GAMMA_MHZ_T = 42.577478461;

/** Larmor (precession) frequency of hydrogen nuclei in a field B (T), MHz. */
export const larmorMHz = (B: number) => GAMMA_MHZ_T * B;

/**
 * Frequency spread a gradient makes across the body: G in mT/m gives this
 * many kHz per centimetre.
 */
export const kHzPerCm = (GmTm: number) => GAMMA_MHZ_T * GmTm * 1e-3 * 1e-2 * 1e3;

/** Tissues of the MRI contrast step, with their 1.5 T relaxation times (IT'IS). */
export const MRI_TISSUES = ['subcutaneousFat', 'liver', 'spleen', 'muscle', 'blood'] as const;
export type MriTissue = (typeof MRI_TISSUES)[number];

/** Spin-echo signal of a tissue (0–1, equal proton density), TR and TE in ms. */
export function spinEcho(t: MriTissue, TR: number, TE: number): number {
	const { t1, t2 } = TISSUE[t];
	return (1 - Math.exp(-TR / (t1 as number))) * Math.exp(-TE / (t2 as number));
}

/** Longitudinal recovery Mz(t)/M₀ after a 90° pulse. */
export const recovery = (t: number, T1: number) => 1 - Math.exp(-t / T1);
/** Transverse decay Mxy(t)/M₀ after a 90° pulse. */
export const decay = (t: number, T2: number) => Math.exp(-t / T2);

/**
 * MRI in a gradient: every point at position x (cm) precesses faster or slower
 * by Δf = kHzPerCm(G)·x, so the coil picks up s(t) = Σ ρ(x)·e^(2πiΔf t). The
 * signal is sampled n times, dt = 1/(2·fov·k) ms apart and centred on the echo, so its discrete
 * Fourier transform has one bin per 2·fov/n cm: the spectrum is the profile
 * ρ(x) of the object (summed across the other directions: a projection).
 */
export function gradientEcho(density: (x: number) => number, GmTm: number, n = 128, fov = 10) {
	const k = kHzPerCm(GmTm); // cycles per ms per cm
	const dt = 1 / (2 * fov * k); // ms
	const dx = 0.02;
	const xs: number[] = [];
	const rho: number[] = [];
	for (let x = -fov; x < fov; x += dx) {
		const v = density(x + dx / 2);
		if (v) {
			xs.push(x + dx / 2);
			rho.push(v * dx);
		}
	}
	const t = new Float64Array(n);
	const re = new Float64Array(n);
	const im = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		t[i] = (i - n / 2) * dt; // the echo peaks at t = 0, mid-way
		for (let j = 0; j < xs.length; j++) {
			const a = 2 * Math.PI * k * xs[j] * t[i];
			re[i] += rho[j] * Math.cos(a);
			im[i] += rho[j] * Math.sin(a);
		}
	}
	const sp = spectrum(re, im);
	const x = Array.from({ length: n }, (_, m) => ((m - n / 2) * 2 * fov) / n);
	// Each bin collects 2·fov/n cm of the object: divide to get ρ back.
	const profile = Array.from(sp, (v) => v / ((2 * fov) / n));
	return { dt, t, re, im, x, profile };
}

/**
 * The spectrum of a sampled complex signal (discrete Fourier transform,
 * magnitude, divided by n) of samples taken at times (i − n/2)·dt, for
 * frequencies −n/2…n/2−1 times 1/(n·dt).
 */
export function spectrum(re: ArrayLike<number>, im: ArrayLike<number>) {
	const n = re.length;
	const out = new Float64Array(n);
	for (let f = 0; f < n; f++) {
		const k = f - n / 2;
		let sr = 0;
		let si = 0;
		for (let i = 0; i < n; i++) {
			const a = (-2 * Math.PI * k * (i - n / 2)) / n;
			sr += re[i] * Math.cos(a) - im[i] * Math.sin(a);
			si += re[i] * Math.sin(a) + im[i] * Math.cos(a);
		}
		out[f] = Math.hypot(sr, si) / n;
	}
	return out;
}
