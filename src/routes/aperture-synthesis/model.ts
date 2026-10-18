/**
 * The model behind the aperture-synthesis page.
 *
 * - Geometry: a baseline between two dishes, measured on the ground (east, north, up), is turned
 *   into equatorial components (X towards the meridian on the equator, Y east, Z towards the
 *   celestial pole) with the site's latitude, and then into (u, v, w) in wavelengths for a source
 *   at hour angle H and declination δ (Thompson, Moran & Swenson, Interferometry and Synthesis
 *   in Radio Astronomy, 3rd ed., 2017, eqs. 4.1 and 4.15). As the Earth turns, H grows and each
 *   baseline traces an ellipse in the uv plane: u² + ((v − (Z/λ) cos δ) / sin δ)² = (X² + Y²)/λ²
 *   (their eq. 4.3).
 * - Imaging: the sky is an N × N grid of brightness (Jy per pixel) covering FOV. Its 2-D Fourier
 *   transform holds the visibilities on a grid of cells Δu = 1/FOV apart. Every sample a baseline
 *   takes, and its mirror image (−u, −v), marks its cell; with uniform weighting each sampled cell
 *   counts once. The dirty beam is the inverse transform of that sampling, the dirty image the
 *   inverse transform of the sampled visibilities, both divided by the number of cells, so the
 *   beam peaks at 1 and the dirty image is exactly the sky convolved with the beam (Jy/beam).
 * - CLEAN (Högbom 1974): find the brightest pixel of what is left, subtract a fraction (the loop
 *   gain) of the beam centred there, note the component, repeat. The restored image is the
 *   components convolved with a Gaussian "clean beam" fitted to the dirty beam's main lobe, plus
 *   what is left.
 *
 * Angles in radians, lengths in metres, u and v in wavelengths unless a name says otherwise.
 */
import { dft2 } from '../mri-k-space/model';

// ======================================================================================
// The instrument
// ======================================================================================

/** Wavelength: 21 cm, the line of neutral hydrogen (1.42 GHz), m. */
export const LAMBDA = 0.21;
/** Diameter of every dish (the VLA's), m. */
export const DISH = 25;
/** Latitude of the Very Large Array, 34°04′43.5″ N (NRAO). */
export const LAT = ((34 + 4 / 60 + 43.497 / 3600) * Math.PI) / 180;
/** The VLA's dishes don't point lower than 8° above the horizon. */
export const MIN_ELEVATION = (8 * Math.PI) / 180;

/** Pixels across the images, and cells across the uv plane. */
export const N = 128;
export const ARCMIN = Math.PI / (180 * 60);
export const ARCSEC = ARCMIN / 60;
/** Field of view of the images: 32′, about the 25 m dishes' primary beam at 21 cm. */
export const FOV = 32 * ARCMIN;
/** One pixel of the images, rad (15″). */
export const PIX = FOV / N;
/** One cell of the uv grid, wavelengths. */
export const DU = 1 / FOV;
/** The longest baseline the grid can hold (|u| and |v| up to N/2 − 1 cells), m. */
export const MAX_BASELINE = (N / 2 - 1) * DU * LAMBDA;

/** Sidereal rotation rate of the Earth, rad/s. */
export const OMEGA_EARTH = 7.2921159e-5;
/** One hour of hour angle, rad. */
export const HOUR = Math.PI / 12;

// ======================================================================================
// Geometry: baselines and the uv plane
// ======================================================================================

export interface Dish {
	/** East, north and up of the array's centre, m. */
	e: number;
	n: number;
	u?: number;
}

export interface Equatorial {
	X: number;
	Y: number;
	Z: number;
}

/** A ground baseline (east, north, up) in equatorial components at latitude `lat` (TMS 4.15). */
export function toEquatorial(e: number, n: number, up: number, lat = LAT): Equatorial {
	const sl = Math.sin(lat);
	const cl = Math.cos(lat);
	return { X: -sl * n + cl * up, Y: e, Z: cl * n + sl * up };
}

/** (u, v, w) in wavelengths of an equatorial baseline, for hour angle H and declination δ (TMS 4.1). */
export function uvw(b: Equatorial, H: number, dec: number, lambda = LAMBDA) {
	const sH = Math.sin(H);
	const cH = Math.cos(H);
	const sd = Math.sin(dec);
	const cd = Math.cos(dec);
	return {
		u: (sH * b.X + cH * b.Y) / lambda,
		v: (-sd * cH * b.X + sd * sH * b.Y + cd * b.Z) / lambda,
		w: (cd * cH * b.X - cd * sH * b.Y + sd * b.Z) / lambda
	};
}

/** Elevation of a source at hour angle H and declination δ, seen from latitude `lat`. */
export function elevation(H: number, dec: number, lat = LAT): number {
	return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
}

/**
 * Hour angles of an observation `hours` long, centred on the source's transit, every `stepMin`
 * minutes, keeping only those with the source at least MIN_ELEVATION up. Zero hours is a single
 * snapshot at transit (if the source is up then).
 */
export function hourAngles(hours: number, dec: number, stepMin = 5, lat = LAT): number[] {
	const n = Math.max(0, Math.round((hours * 60) / stepMin));
	const out: number[] = [];
	for (let i = 0; i <= n; i++) {
		const H = n === 0 ? 0 : (-hours / 2 + (i * hours) / n) * HOUR;
		if (elevation(H, dec, lat) >= MIN_ELEVATION) out.push(H);
	}
	return out;
}

export interface Track {
	/** The two dishes (indices). */
	a: number;
	b: number;
	/** The baseline's (u, v) at each hour angle, wavelengths; the mirror (−u, −v) is implied. */
	u: Float64Array;
	v: Float64Array;
}

/** The uv tracks of every pair of dishes over the given hour angles. */
export function tracks(
	dishes: readonly Dish[],
	dec: number,
	H: readonly number[],
	lat = LAT
): Track[] {
	const out: Track[] = [];
	for (let a = 0; a < dishes.length; a++) {
		for (let b = a + 1; b < dishes.length; b++) {
			const p = dishes[a];
			const q = dishes[b];
			const L = toEquatorial(q.e - p.e, q.n - p.n, (q.u ?? 0) - (p.u ?? 0), lat);
			const u = new Float64Array(H.length);
			const v = new Float64Array(H.length);
			H.forEach((h, i) => {
				const s = uvw(L, h, dec);
				u[i] = s.u;
				v[i] = s.v;
			});
			out.push({ a, b, u, v });
		}
	}
	return out;
}

/** Number of pairs among n dishes. */
export const pairs = (n: number) => (n * (n - 1)) / 2;

// ======================================================================================
// Gridding
// ======================================================================================

/** Index of uv cell (iu, iv), centred: iu, iv in [−N/2, N/2). Rows are v, columns u. */
export const cell = (iu: number, iv: number) => (iv + N / 2) * N + (iu + N / 2);

export interface Sampling {
	/** Weight of each uv cell (1 if sampled, 0 if not: uniform weighting). */
	w: Float64Array;
	/** Cells sampled, mirror images included. */
	cells: number;
	/** Samples taken (one per baseline and hour angle, mirror images not counted). */
	samples: number;
	/** Samples of baselines too long for the grid, left out. */
	outside: number;
	/** Shortest and longest sampled distance from the centre, wavelengths (0 if nothing). */
	uvMin: number;
	uvMax: number;
}

/** Grids the tracks onto the uv cells, each sample with its mirror image. */
export function grid(ts: readonly Track[]): Sampling {
	const w = new Float64Array(N * N);
	let samples = 0;
	let outside = 0;
	let uvMin = Infinity;
	let uvMax = 0;
	const lim = N / 2 - 1;
	for (const t of ts) {
		for (let i = 0; i < t.u.length; i++) {
			samples++;
			const iu = Math.round(t.u[i] / DU);
			const iv = Math.round(t.v[i] / DU);
			if (Math.abs(iu) > lim || Math.abs(iv) > lim) {
				outside++;
				continue;
			}
			w[cell(iu, iv)] = 1;
			w[cell(-iu, -iv)] = 1;
			const r = Math.hypot(t.u[i], t.v[i]);
			uvMin = Math.min(uvMin, r);
			uvMax = Math.max(uvMax, r);
		}
	}
	let cells = 0;
	for (const x of w) cells += x;
	return { w, cells, samples, outside, uvMin: cells ? uvMin : 0, uvMax };
}

/**
 * What one filled dish of diameter D samples: every pair of points on its surface is a baseline,
 * so it covers the uv plane out to D/λ, weighted by how many pairs share each spacing (the
 * overlap of two discs of diameter D whose centres are that spacing apart, relative to a whole
 * disc). Its inverse transform is the dish's Airy pattern.
 */
export function dishSampling(D: number): Sampling {
	const w = new Float64Array(N * N);
	const R = D / LAMBDA;
	let cells = 0;
	let uvMax = 0;
	for (let iv = -N / 2; iv < N / 2; iv++) {
		for (let iu = -N / 2; iu < N / 2; iu++) {
			const q = (Math.hypot(iu, iv) * DU) / R;
			if (q >= 1) continue;
			w[cell(iu, iv)] = (2 / Math.PI) * (Math.acos(q) - q * Math.sqrt(1 - q * q));
			cells++;
			uvMax = Math.max(uvMax, q * R);
		}
	}
	return { w, cells, samples: 0, outside: 0, uvMin: 0, uvMax };
}

// ======================================================================================
// Images
// ======================================================================================

/** Index of image pixel (x, y), centred: x (towards +l, east) and y (+m, north) in [−N/2, N/2). */
export const pixel = (x: number, y: number) => (y + N / 2) * N + (x + N / 2);

export interface Visibilities {
	re: Float64Array;
	im: Float64Array;
}

/** The sky's visibilities on the uv grid: V(u, v) = Σ I(l, m) e^(−2πi(ul + vm)). */
export function visibilities(sky: Float64Array): Visibilities {
	return dft2(sky, new Float64Array(N * N), N, N, -1);
}

/** Sum of an array. */
export function total(a: ArrayLike<number>): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i];
	return s;
}

/** The dirty beam: the inverse transform of the sampling, peak 1. */
export function dirtyBeam(s: Sampling): Float64Array {
	const sum = total(s.w);
	const out = dft2(s.w, new Float64Array(N * N), N, N, 1).re;
	if (sum > 0) for (let i = 0; i < out.length; i++) out[i] /= sum;
	return out;
}

/** The dirty image: the inverse transform of the sampled visibilities (Jy/beam). */
export function dirtyImage(V: Visibilities, s: Sampling): Float64Array {
	const sum = total(s.w);
	const re = new Float64Array(N * N);
	const im = new Float64Array(N * N);
	for (let i = 0; i < re.length; i++) {
		re[i] = V.re[i] * s.w[i];
		im[i] = V.im[i] * s.w[i];
	}
	const out = dft2(re, im, N, N, 1).re;
	if (sum > 0) for (let i = 0; i < out.length; i++) out[i] /= sum;
	return out;
}

/** Circular convolution of two images (the second centred on pixel (0, 0)), by the FFT. */
export function convolve(a: Float64Array, kernel: Float64Array): Float64Array {
	const z = new Float64Array(N * N);
	const A = dft2(a, z, N, N, -1);
	const K = dft2(kernel, z, N, N, -1);
	const re = new Float64Array(N * N);
	const im = new Float64Array(N * N);
	for (let i = 0; i < re.length; i++) {
		re[i] = A.re[i] * K.re[i] - A.im[i] * K.im[i];
		im[i] = A.re[i] * K.im[i] + A.im[i] * K.re[i];
	}
	const out = dft2(re, im, N, N, 1).re;
	for (let i = 0; i < out.length; i++) out[i] /= N * N;
	return out;
}

// ======================================================================================
// The clean beam
// ======================================================================================

export interface Gaussian {
	/** Inverse covariance in pixels: exp(−½ (a x² + 2b xy + c y²)). */
	a: number;
	b: number;
	c: number;
	/** Full widths at half maximum along the major and minor axes, rad. */
	major: number;
	minor: number;
}

/**
 * The Gaussian with the dirty beam's curvature at its peak. Near its peak the beam is
 * 1 − 2π² ⟨(u l + v m)²⟩, the average over the sampled cells, so a Gaussian of inverse
 * covariance 4π² ⟨u u ᵀ⟩ has the same main lobe.
 */
export function cleanBeam(s: Sampling): Gaussian {
	let suu = 0;
	let suv = 0;
	let svv = 0;
	let sw = 0;
	for (let iv = -N / 2; iv < N / 2; iv++) {
		for (let iu = -N / 2; iu < N / 2; iu++) {
			const w = s.w[cell(iu, iv)];
			if (!w) continue;
			suu += w * iu * iu;
			suv += w * iu * iv;
			svv += w * iv * iv;
			sw += w;
		}
	}
	const k = (4 * Math.PI * Math.PI) / (N * N) / (sw || 1);
	const a = k * suu;
	const b = k * suv;
	const c = k * svv;
	// eigenvalues of [[a, b], [b, c]]: the smaller one is the major axis
	const m = (a + c) / 2;
	const d = Math.sqrt(((a - c) / 2) ** 2 + b * b);
	const fw = (lam: number) =>
		lam > 0 ? 2 * Math.sqrt(2 * Math.LN2) * (1 / Math.sqrt(lam)) * PIX : Infinity;
	return { a, b, c, major: fw(m - d), minor: fw(m + d) };
}

/** The clean beam as an image centred on pixel (0, 0), peak 1. */
export function gaussianImage(g: Gaussian): Float64Array {
	const out = new Float64Array(N * N);
	for (let y = -N / 2; y < N / 2; y++) {
		for (let x = -N / 2; x < N / 2; x++) {
			const q = g.a * x * x + 2 * g.b * x * y + g.c * y * y;
			if (q < 60) out[pixel(x, y)] = Math.exp(-q / 2);
		}
	}
	return out;
}

// ======================================================================================
// Högbom CLEAN
// ======================================================================================

export interface Clean {
	residual: Float64Array;
	/** Flux of the components, Jy, per pixel. */
	model: Float64Array;
	iterations: number;
	/** The brightest |residual| found at each iteration, Jy/beam. */
	peaks: number[];
	/** Where each component went, in order (pixel index). */
	where: number[];
}

export function cleanStart(dirty: Float64Array): Clean {
	return {
		residual: Float64Array.from(dirty),
		model: new Float64Array(N * N),
		iterations: 0,
		peaks: [],
		where: []
	};
}

/** Brightest |value| of an image, and where. */
export function peak(img: Float64Array): { index: number; value: number } {
	let index = 0;
	let best = -1;
	for (let i = 0; i < img.length; i++) {
		const a = Math.abs(img[i]);
		if (a > best) {
			best = a;
			index = i;
		}
	}
	return { index, value: img[index] };
}

/**
 * Runs Högbom CLEAN on `c` (in place) until it has done `upTo` iterations in all, or the
 * brightest residual falls below `threshold` (Jy/beam).
 */
export function cleanRun(
	c: Clean,
	beam: Float64Array,
	upTo: number,
	gain = 0.1,
	threshold = 0
): Clean {
	const r = c.residual;
	while (c.iterations < upTo) {
		const p = peak(r);
		if (Math.abs(p.value) <= threshold || p.value === 0) break;
		const f = gain * p.value;
		const py = Math.floor(p.index / N);
		const px = p.index % N;
		c.model[p.index] += f;
		c.peaks.push(Math.abs(p.value));
		c.where.push(p.index);
		// subtract the beam centred on (px, py): beam index (y − py + N/2, x − px + N/2), wrapped
		for (let y = 0; y < N; y++) {
			const by = (((y - py + N / 2) % N) + N) % N;
			const row = y * N;
			const brow = by * N;
			for (let x = 0; x < N; x++) {
				const bx = (((x - px + N / 2) % N) + N) % N;
				r[row + x] -= f * beam[brow + bx];
			}
		}
		c.iterations++;
	}
	return c;
}

/** The restored image: the components convolved with the clean beam, plus the residual. */
export function restore(c: Clean, g: Gaussian): Float64Array {
	const out = convolve(c.model, gaussianImage(g));
	for (let i = 0; i < out.length; i++) out[i] += c.residual[i];
	return out;
}

// ======================================================================================
// Two dishes, in one dimension
// ======================================================================================

export interface Source1D {
	/** Offset from the pointing direction, rad. */
	l: number;
	/** Flux, Jy. */
	flux: number;
}

/**
 * The complex visibility of a row of point sources at baseline u (wavelengths):
 * V(u) = Σ F e^(−2πi u l). The correlator's output for a source drifting by Δl is
 * Re[V e^(−2πi u Δl)]: fringes whose height is |V|.
 */
export function visibility1D(src: readonly Source1D[], u: number): { re: number; im: number } {
	let re = 0;
	let im = 0;
	for (const s of src) {
		re += s.flux * Math.cos(2 * Math.PI * u * s.l);
		im -= s.flux * Math.sin(2 * Math.PI * u * s.l);
	}
	return { re, im };
}

/** The correlator's output when the sky has drifted by `shift` (rad) across the fringes. */
export function correlator(src: readonly Source1D[], u: number, shift: number): number {
	let s = 0;
	for (const x of src) s += x.flux * Math.cos(2 * Math.PI * u * (x.l + shift));
	return s;
}

/** Fringe spacing on the sky of a baseline b (m): λ / b, rad. */
export const fringeSpacing = (b: number, lambda = LAMBDA) => lambda / b;

/** Rayleigh resolution of a dish of diameter D: 1.22 λ / D, rad. */
export const rayleigh = (D: number, lambda = LAMBDA) => (1.22 * lambda) / D;
