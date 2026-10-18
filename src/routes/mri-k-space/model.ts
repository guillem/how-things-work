/**
 * The physics behind the MRI k-space page.
 *
 * - k-space: the signal the coil records while the gradients have wound the spins up by
 *   (kx, ky) turns per centimetre is the slice's 2-D Fourier transform at (kx, ky). The head is a
 *   sum of ellipses (phantom.ts), whose transforms are known exactly (a Bessel function), so every
 *   sample is the exact value a perfect scanner would record, with no pixels involved.
 * - Reconstruction: the inverse discrete Fourier transform of the samples. With samples Δk = 1/FOV
 *   apart it gives the image repeated every FOV (whatever sticks out wraps round), blurred by
 *   the k-space it lacks.
 * - Bloch: spins precess, lose their transverse magnetisation with T2 and recover with T1; a slice
 *   is selected by a radio pulse in a gradient, and a 180° pulse refocuses an echo.
 *
 * Lengths in centimetres, k in cycles per centimetre, times in seconds unless a name says ms.
 */
import type { Ellipse } from './phantom';

/** Proton gyromagnetic ratio γ/2π, Hz per tesla (CODATA 2022). */
export const GAMMA_HZ_T = 42.577478461e6;

// ======================================================================================
// Bessel J1 and the Fourier transform of an ellipse
// ======================================================================================

/**
 * Bessel function J₁(x), from the polynomial approximations of Abramowitz and Stegun, Handbook
 * of Mathematical Functions, 9.4.4 (|x| ≤ 3, error < 1.3e-8) and 9.4.6 (|x| ≥ 3, < 1.1e-8 × √x).
 */
export function besselJ1(x: number): number {
	const ax = Math.abs(x);
	if (ax <= 3) {
		const y = (x / 3) * (x / 3);
		return (
			x *
			(0.5 +
				y *
					(-0.56249985 +
						y *
							(0.21093573 +
								y * (-0.03954289 + y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))))
		);
	}
	const z = 3 / ax;
	const f =
		0.79788456 +
		z *
			(0.00000156 +
				z *
					(0.01659667 + z * (0.00017105 + z * (-0.00249511 + z * (0.00113653 + z * -0.00020033)))));
	const th =
		ax -
		2.35619449 +
		z *
			(0.12499612 +
				z *
					(0.0000565 + z * (-0.00637879 + z * (0.00074348 + z * (0.00079824 + z * -0.00029166)))));
	const v = (f * Math.cos(th)) / Math.sqrt(ax);
	return x < 0 ? -v : v;
}

/**
 * Fourier transform F(k) = ∫ f(r) e^(−2πi k·r) d²r of one ellipse of value v, at (kx, ky): an
 * ellipse is a stretched disc, and a disc of radius 1 transforms to J₁(2π|k|)/|k|.
 */
export function ellipseFT(e: Ellipse, kx: number, ky: number): [number, number] {
	const c = Math.cos(e.phi);
	const s = Math.sin(e.phi);
	const ku = (kx * c + ky * s) * e.a;
	const kw = (-kx * s + ky * c) * e.b;
	const q = Math.hypot(ku, kw);
	const mag = e.value * e.a * e.b * (q < 1e-9 ? Math.PI : besselJ1(2 * Math.PI * q) / q);
	const ph = -2 * Math.PI * (kx * e.x0 + ky * e.y0);
	return [mag * Math.cos(ph), mag * Math.sin(ph)];
}

/** Fourier transform of a sum of ellipses at (kx, ky). */
export function objectFT(es: readonly Ellipse[], kx: number, ky: number): [number, number] {
	let re = 0;
	let im = 0;
	for (const e of es) {
		const [r, i] = ellipseFT(e, kx, ky);
		re += r;
		im += i;
	}
	return [re, im];
}

// ======================================================================================
// k-space and the discrete Fourier transform
// ======================================================================================

/**
 * A sampled k-space: `ny` lines (one per echo) of `nx` samples. Line r has ky = (r − ⌊ny/2⌋)/fovY,
 * sample c has kx = (c − ⌊nx/2⌋)/fovX, row-major in `re`/`im`.
 */
export interface KSpace {
	nx: number;
	ny: number;
	fovX: number;
	fovY: number;
	re: Float64Array;
	im: Float64Array;
}

/** A complex image of `ny` rows of `nx` pixels; pixel (r, c) sits at ((c − ⌊nx/2⌋)·fovX/nx, (r − ⌊ny/2⌋)·fovY/ny). */
export interface Image {
	nx: number;
	ny: number;
	fovX: number;
	fovY: number;
	re: Float64Array;
	im: Float64Array;
}

export const kxOf = (k: { nx: number; fovX: number }, c: number) =>
	(c - Math.floor(k.nx / 2)) / k.fovX;
export const kyOf = (k: { ny: number; fovY: number }, r: number) =>
	(r - Math.floor(k.ny / 2)) / k.fovY;
export const xOf = (im: { nx: number; fovX: number }, c: number) =>
	((c - Math.floor(im.nx / 2)) * im.fovX) / im.nx;
export const yOf = (im: { ny: number; fovY: number }, r: number) =>
	((r - Math.floor(im.ny / 2)) * im.fovY) / im.ny;

/** Records the k-space of a sum of ellipses on an nx × ny grid covering fovX × fovY cm. */
export function acquire(
	es: readonly Ellipse[],
	nx: number,
	ny: number,
	fovX: number,
	fovY: number
): KSpace {
	const re = new Float64Array(nx * ny);
	const im = new Float64Array(nx * ny);
	const k = { nx, ny, fovX, fovY, re, im };
	for (let r = 0; r < ny; r++) {
		const ky = kyOf(k, r);
		for (let c = 0; c < nx; c++) {
			const [a, b] = objectFT(es, kxOf(k, c), ky);
			re[r * nx + c] = a;
			im[r * nx + c] = b;
		}
	}
	return k;
}

const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;

/** In-place radix-2 FFT, e^(sign·2πi jm/n). */
function fft(re: Float64Array, im: Float64Array, sign: 1 | -1) {
	const n = re.length;
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) {
			[re[i], re[j]] = [re[j], re[i]];
			[im[i], im[j]] = [im[j], im[i]];
		}
	}
	for (let len = 2; len <= n; len <<= 1) {
		const ang = (sign * 2 * Math.PI) / len;
		const wr = Math.cos(ang);
		const wi = Math.sin(ang);
		for (let i = 0; i < n; i += len) {
			let cr = 1;
			let ci = 0;
			for (let j = 0; j < len / 2; j++) {
				const a = i + j;
				const b = a + len / 2;
				const tr = re[b] * cr - im[b] * ci;
				const ti = re[b] * ci + im[b] * cr;
				re[b] = re[a] - tr;
				im[b] = im[a] - ti;
				re[a] += tr;
				im[a] += ti;
				const t = cr * wr - ci * wi;
				ci = cr * wi + ci * wr;
				cr = t;
			}
		}
	}
}

/**
 * Centred discrete Fourier transform of one line: out[j] = Σₘ in[m] e^(sign·2πi (m−⌊n/2⌋)(j−⌊n/2⌋)/n),
 * unscaled. An FFT when n is a power of two, the plain sum otherwise.
 */
function dftCentred(re: Float64Array, im: Float64Array, sign: 1 | -1) {
	const n = re.length;
	const h = Math.floor(n / 2);
	if (isPow2(n)) {
		// e^(i s 2π (m−h)(j−h)/n) = e^(i s 2π mj/n) (−1)^m (−1)^j (−1)^h for n = 2h
		for (let m = 0; m < n; m++) {
			if (m & 1) {
				re[m] = -re[m];
				im[m] = -im[m];
			}
		}
		fft(re, im, sign);
		for (let j = 0; j < n; j++) {
			if ((j + h) & 1) {
				re[j] = -re[j];
				im[j] = -im[j];
			}
		}
		return;
	}
	const ir = Float64Array.from(re);
	const ii = Float64Array.from(im);
	for (let j = 0; j < n; j++) {
		let sr = 0;
		let si = 0;
		for (let m = 0; m < n; m++) {
			const a = (sign * 2 * Math.PI * (((m - h) * (j - h)) % n)) / n;
			const c = Math.cos(a);
			const s = Math.sin(a);
			sr += ir[m] * c - ii[m] * s;
			si += ir[m] * s + ii[m] * c;
		}
		re[j] = sr;
		im[j] = si;
	}
}

/** Centred 2-D DFT of an nx × ny array, unscaled (sign −1 forward, +1 inverse). Returns new arrays. */
export function dft2(
	re: ArrayLike<number>,
	im: ArrayLike<number>,
	nx: number,
	ny: number,
	sign: 1 | -1
): { re: Float64Array; im: Float64Array } {
	const or = Float64Array.from(re);
	const oi = Float64Array.from(im);
	const rr = new Float64Array(nx);
	const ri = new Float64Array(nx);
	for (let r = 0; r < ny; r++) {
		for (let c = 0; c < nx; c++) {
			rr[c] = or[r * nx + c];
			ri[c] = oi[r * nx + c];
		}
		dftCentred(rr, ri, sign);
		for (let c = 0; c < nx; c++) {
			or[r * nx + c] = rr[c];
			oi[r * nx + c] = ri[c];
		}
	}
	const cr = new Float64Array(ny);
	const ci = new Float64Array(ny);
	for (let c = 0; c < nx; c++) {
		for (let r = 0; r < ny; r++) {
			cr[r] = or[r * nx + c];
			ci[r] = oi[r * nx + c];
		}
		dftCentred(cr, ci, sign);
		for (let r = 0; r < ny; r++) {
			or[r * nx + c] = cr[r];
			oi[r * nx + c] = ci[r];
		}
	}
	return { re: or, im: oi };
}

/**
 * The image a scanner computes from its k-space: f(x, y) ≈ Σ F(kx, ky) e^(2πi(kx x + ky y)) Δkx Δky,
 * with Δk = 1/FOV. A uniform region of value v comes out as v.
 */
export function reconstruct(k: KSpace): Image {
	const { re, im } = dft2(k.re, k.im, k.nx, k.ny, 1);
	const s = 1 / (k.fovX * k.fovY);
	for (let i = 0; i < re.length; i++) {
		re[i] *= s;
		im[i] *= s;
	}
	return { nx: k.nx, ny: k.ny, fovX: k.fovX, fovY: k.fovY, re, im };
}

/** Magnitude of a complex image (what a scanner shows). */
export function magnitude(img: { re: ArrayLike<number>; im: ArrayLike<number> }): Float64Array {
	const out = new Float64Array(img.re.length);
	for (let i = 0; i < out.length; i++) out[i] = Math.hypot(img.re[i], img.im[i]);
	return out;
}

/** Value of an image at the pixel nearest (x, y) cm. */
export function pixelAt(img: Image, values: ArrayLike<number>, x: number, y: number): number {
	const c = Math.round((x * img.nx) / img.fovX) + Math.floor(img.nx / 2);
	const r = Math.round((y * img.ny) / img.fovY) + Math.floor(img.ny / 2);
	const cc = ((c % img.nx) + img.nx) % img.nx;
	const rr = ((r % img.ny) + img.ny) % img.ny;
	return values[rr * img.nx + cc];
}

// ======================================================================================
// Editing k-space
// ======================================================================================

/** A copy of k-space with only the samples where `keep(line offset m, sample offset n)` is true. */
export function keepWhere(k: KSpace, keep: (m: number, n: number) => boolean): KSpace {
	const re = new Float64Array(k.re.length);
	const im = new Float64Array(k.im.length);
	const hy = Math.floor(k.ny / 2);
	const hx = Math.floor(k.nx / 2);
	for (let r = 0; r < k.ny; r++) {
		for (let c = 0; c < k.nx; c++) {
			if (!keep(r - hy, c - hx)) continue;
			re[r * k.nx + c] = k.re[r * k.nx + c];
			im[r * k.nx + c] = k.im[r * k.nx + c];
		}
	}
	return { ...k, re, im };
}

/** Is the sample (m, n) within `radius` of the centre, as a fraction of the half-width of k-space? */
export function inCentre(k: KSpace, m: number, n: number, radius: number): boolean {
	const u = n / (k.nx / 2);
	const v = m / (k.ny / 2);
	return u * u + v * v <= radius * radius;
}

export const centreOnly = (k: KSpace, radius: number) =>
	keepWhere(k, (m, n) => inCentre(k, m, n, radius));
export const edgesOnly = (k: KSpace, radius: number) =>
	keepWhere(k, (m, n) => !inCentre(k, m, n, radius));

/** Keeps one line in every `r` (the line through the centre among them), as a faster scan would. */
export const everyNthLine = (k: KSpace, r: number) => keepWhere(k, (m) => ((m % r) + r) % r === 0);

/** The centre (within `radius`) of one k-space and the edges of another of the same size. */
export function swapCentre(centreFrom: KSpace, edgesFrom: KSpace, radius: number): KSpace {
	const a = centreOnly(centreFrom, radius);
	const b = edgesOnly(edgesFrom, radius);
	const re = a.re.map((v, i) => v + b.re[i]);
	const im = a.im.map((v, i) => v + b.im[i]);
	return { ...centreFrom, re, im };
}

export type FillOrder = 'linear' | 'centre';

/** Line indices (rows) in the order a scan records them: top to bottom, or from the centre out. */
export function lineOrder(ny: number, order: FillOrder): number[] {
	const rows = Array.from({ length: ny }, (_, r) => r);
	if (order === 'linear') return rows;
	const h = Math.floor(ny / 2);
	return rows.sort((a, b) => Math.abs(a - h) - Math.abs(b - h) || a - b);
}

/** k-space with only the first `count` lines recorded. */
export function firstLines(k: KSpace, count: number, order: FillOrder): KSpace {
	const rows = new Set(lineOrder(k.ny, order).slice(0, count));
	const hy = Math.floor(k.ny / 2);
	return keepWhere(k, (m) => rows.has(m + hy));
}

/** A k-space holding one sample of value 1 at line offset m, sample offset n: a single wave. */
export function singleSample(k: KSpace, m: number, n: number): KSpace {
	const re = new Float64Array(k.re.length);
	const im = new Float64Array(k.im.length);
	re[(m + Math.floor(k.ny / 2)) * k.nx + n + Math.floor(k.nx / 2)] = 1;
	return { ...k, re, im };
}

// ======================================================================================
// The scan's numbers
// ======================================================================================

/**
 * Gradient area (mT/m · ms) that winds the spins up by k cycles per centimetre: k = γ ∫G dt.
 */
export const gradientAreaFor = (kPerCm: number) => (kPerCm * 100) / GAMMA_HZ_T / 1e-6;

/** Time to record a whole image, one line per repetition: lines × TR, seconds. */
export const scanSeconds = (lines: number, trMs: number) => (lines * trMs) / 1000;

// ======================================================================================
// Bloch equations
// ======================================================================================

export type Vec3 = [number, number, number];

/** Rotates M about the axis (ux, uy, uz) (not necessarily unit) by `angle` radians, right-handed. */
export function rotate(M: Vec3, axis: Vec3, angle: number): Vec3 {
	const n = Math.hypot(axis[0], axis[1], axis[2]);
	if (n === 0 || angle === 0) return [...M];
	const [x, y, z] = [axis[0] / n, axis[1] / n, axis[2] / n];
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const d = (x * M[0] + y * M[1] + z * M[2]) * (1 - c);
	return [
		M[0] * c + (y * M[2] - z * M[1]) * s + x * d,
		M[1] * c + (z * M[0] - x * M[2]) * s + y * d,
		M[2] * c + (x * M[1] - y * M[0]) * s + z * d
	];
}

/**
 * Free precession for `dt` s of a spin `df` Hz off the scanner's frequency, in the frame turning
 * at that frequency, with relaxation: Mxy shrinks by e^(−dt/T2), Mz recovers towards 1 with T1.
 * The exact solution of the Bloch equations without a radio pulse.
 */
export function freePrecess(M: Vec3, dt: number, df: number, T1: number, T2: number): Vec3 {
	const r = rotate(M, [0, 0, 1], 2 * Math.PI * df * dt);
	const e2 = Math.exp(-dt / T2);
	const e1 = Math.exp(-dt / T1);
	return [r[0] * e2, r[1] * e2, 1 + (r[2] - 1) * e1];
}

/**
 * Offsets (Hz) of n spins spread like the field in a real voxel: the quantiles of a Lorentzian of
 * half-width `width` Hz. Their sum decays as e^(−2π·width·t) (the T2* decay), on top of T2.
 */
export function lorentzSpread(n: number, width: number): number[] {
	return Array.from({ length: n }, (_, i) => width * Math.tan(Math.PI * ((i + 0.5) / n - 0.5)));
}

/**
 * Magnetisation of each spin at time t after a 90° pulse that tipped it onto +y, with a 180° pulse
 * about y at time `tau` when `refocus` is on: the spins that ran ahead are put behind, so they all
 * meet again on +y at 2·tau, the echo.
 */
export function spinEchoState(
	offsets: readonly number[],
	t: number,
	tau: number,
	refocus: boolean,
	T1: number,
	T2: number
): Vec3[] {
	return offsets.map((df) => {
		const start: Vec3 = [0, 1, 0];
		if (!refocus || t <= tau) return freePrecess(start, t, df, T1, T2);
		const before = freePrecess(start, tau, df, T1, T2);
		const flipped = rotate(before, [0, 1, 0], Math.PI);
		return freePrecess(flipped, t - tau, df, T1, T2);
	});
}

/** The coil's signal: the length of the spins' average transverse magnetisation. */
export function netSignal(ms: readonly Vec3[]): number {
	let x = 0;
	let y = 0;
	for (const m of ms) {
		x += m[0];
		y += m[1];
	}
	return Math.hypot(x, y) / ms.length;
}

// ======================================================================================
// Selecting a slice
// ======================================================================================

/** The slice-selective pulse: a sinc with 4 lobes' worth of bandwidth, 4 ms long, Hamming window. */
export const PULSE = { durationMs: 4, timeBandwidth: 4, samples: 400 } as const;

/** Frequency band the pulse tips, Hz. */
export const pulseBandwidthHz = () => PULSE.timeBandwidth / (PULSE.durationMs / 1000);

/** Slice thickness the pulse selects with a gradient of G mT/m: bandwidth / (γ G), mm. */
export const sliceThicknessMm = (GmTm: number) =>
	(pulseBandwidthHz() / (GAMMA_HZ_T * GmTm * 1e-3)) * 1000;

/** Where the slice sits for a pulse `offsetHz` off the centre frequency, mm. */
export const slicePositionMm = (GmTm: number, offsetHz: number) =>
	(offsetHz / (GAMMA_HZ_T * GmTm * 1e-3)) * 1000;

/** The pulse's shape B1(t), normalised so that its area tips spins on resonance by 90°. */
function pulseShape(): Float64Array {
	const n = PULSE.samples;
	const w = new Float64Array(n);
	const half = PULSE.timeBandwidth / 2;
	for (let i = 0; i < n; i++) {
		const u = (i + 0.5) / n - 0.5; // −0.5…0.5
		const x = 2 * half * u;
		const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
		w[i] = sinc * (0.54 + 0.46 * Math.cos(2 * Math.PI * u));
	}
	const dt = PULSE.durationMs / 1000 / n;
	const area = w.reduce((a, b) => a + b, 0) * dt;
	const scale = Math.PI / 2 / area; // rad/s per unit of shape
	return w.map((v) => v * scale);
}
let shape: Float64Array | null = null;

/**
 * How far the pulse tips the protons at height z (mm) in a gradient of G mT/m, the pulse sent
 * `offsetHz` off the centre frequency: |Mxy| after the pulse, from the Bloch equations (relaxation
 * is negligible in 4 ms).
 */
export function tipAt(zMm: number, GmTm: number, offsetHz: number): number {
	shape ??= pulseShape();
	const dt = PULSE.durationMs / 1000 / PULSE.samples;
	const dw = 2 * Math.PI * (GAMMA_HZ_T * GmTm * 1e-3 * zMm * 1e-3 - offsetHz); // rad/s
	let M: Vec3 = [0, 0, 1];
	for (let i = 0; i < shape.length; i++) {
		const w1 = shape[i];
		M = rotate(M, [w1, 0, dw], Math.hypot(w1, dw) * dt);
	}
	return Math.hypot(M[0], M[1]);
}
