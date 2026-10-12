/**
 * The Fourier model behind the fourier-transform explainer. Plain TypeScript,
 * no Svelte and no `#lib` imports, so the Node model tests can load it.
 *
 * Two kinds of signal:
 *
 *  - A **waveform**: one period of a real signal, sampled at N equally spaced
 *    times u = j/N (u in periods, 0 ≤ u < 1). Its discrete Fourier transform
 *    (DFT) gives, for every whole frequency n (n cycles per period), the
 *    amplitude A_n and phase φ_n of a sine wave, so that
 *        x(u) = A_0 + Σ_{n≥1} A_n · sin(2π n u + φ_n).
 *    With every frequency up to N/2 the sum reproduces the samples exactly.
 *
 *  - A **closed curve**: N points z_j = x_j + i y_j of the plane (y up), read as
 *    one complex signal. Its DFT gives a complex coefficient c_k for each
 *    frequency k, negative ones included, and
 *        z(u) = Σ_k c_k · e^{2πi k u}:
 *    a chain of circles, the k-th of radius |c_k| turning k times per period
 *    (anticlockwise for k > 0, clockwise for k < 0), starting at angle arg c_k.
 *
 * The DFT is the plain O(N²) sum: N is at most a few thousand in the tests and
 * a few hundred on the page.
 */

export interface Complex {
	re: number;
	im: number;
}

const TAU = 2 * Math.PI;

// ---- the discrete Fourier transform -------------------------------------------------

/**
 * DFT of complex samples: X_k = Σ_j z_j e^{−2πi jk/N}, k = 0 … N−1. A real
 * signal is passed as complex samples with im = 0 (see `waveSpectrum`).
 */
export function dft(z: readonly Complex[]): Complex[] {
	const N = z.length;
	// Twiddle table: cos and sin of 2π m/N, so the inner loop needs no trig calls.
	const cos = new Float64Array(N);
	const sin = new Float64Array(N);
	for (let m = 0; m < N; m++) {
		cos[m] = Math.cos((TAU * m) / N);
		sin[m] = Math.sin((TAU * m) / N);
	}
	const out: Complex[] = [];
	for (let k = 0; k < N; k++) {
		let re = 0;
		let im = 0;
		for (let j = 0, m = 0; j < N; j++, m = (m + k) % N) {
			// z_j · e^{−iθ} with θ = 2π jk/N
			re += z[j].re * cos[m] + z[j].im * sin[m];
			im += z[j].im * cos[m] - z[j].re * sin[m];
		}
		out.push({ re, im });
	}
	return out;
}

/** Inverse DFT: z_j = (1/N) Σ_k X_k e^{2πi jk/N}. `idft(dft(z))` gives z back. */
export function idft(X: readonly Complex[]): Complex[] {
	const N = X.length;
	// The inverse is the forward transform of the conjugates, conjugated and divided by N.
	const conj = dft(X.map((x) => ({ re: x.re, im: -x.im })));
	return conj.map((x) => ({ re: x.re / N, im: -x.im / N }));
}

// ---- waveforms ------------------------------------------------------------------------

/** One sine-wave ingredient of a waveform: A · sin(2π n u + φ). */
export interface Harmonic {
	/** Frequency, in cycles per period (0 is the constant average). */
	n: number;
	/** Amplitude A ≥ 0 (for n = 0: the average, which may be negative). */
	amp: number;
	/** Phase φ in radians. */
	phase: number;
}

/**
 * The spectrum of a sampled waveform: one harmonic for each frequency
 * n = 0 … N/2 (rounded down). Amplitudes are in the units of the samples.
 */
export function waveSpectrum(samples: readonly number[]): Harmonic[] {
	const N = samples.length;
	const X = dft(samples.map((re) => ({ re, im: 0 })));
	const out: Harmonic[] = [{ n: 0, amp: X[0].re / N, phase: 0 }];
	for (let n = 1; n <= Math.floor(N / 2); n++) {
		// A real signal has X_{N−n} = conj(X_n): the two together make one real
		// cosine of amplitude 2|X_n|/N, except at the Nyquist frequency N/2,
		// which has no partner. cos(θ + arg) = sin(θ + arg + π/2).
		const nyquist = 2 * n === N;
		const mag = Math.hypot(X[n].re, X[n].im);
		const amp = ((nyquist ? 1 : 2) * mag) / N;
		const phase = amp < 1e-12 ? 0 : Math.atan2(X[n].im, X[n].re) + Math.PI / 2;
		out.push({ n, amp, phase });
	}
	return out;
}

/**
 * The waveform rebuilt at time u (in periods) from the average and the first
 * `terms` frequencies (n = 1 … terms). `terms` larger than the spectrum uses it all.
 */
export function partialSum(spectrum: readonly Harmonic[], terms: number, u: number): number {
	let v = 0;
	for (const h of spectrum) {
		if (h.n > terms) break;
		v += h.n === 0 ? h.amp : h.amp * Math.sin(TAU * h.n * u + h.phase);
	}
	return v;
}

/** `partialSum` at `count` equally spaced times over one period (u = i/count). */
export function partialSamples(
	spectrum: readonly Harmonic[],
	terms: number,
	count: number
): number[] {
	return Array.from({ length: count }, (_, i) => partialSum(spectrum, terms, i / count));
}

/** Root-mean-square difference between two equally long lists of samples. */
export function rmsError(a: readonly number[], b: readonly number[]): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
	return Math.sqrt(s / a.length);
}

/**
 * The highest value of the rebuilt waveform, searched on a fine grid
 * (`count` points per period) rather than only at the samples: with many
 * terms the overshoot peak is narrower than the sample spacing.
 */
export function peak(spectrum: readonly Harmonic[], terms: number, count = 8192): number {
	let best = -Infinity;
	for (let i = 0; i < count; i++) best = Math.max(best, partialSum(spectrum, terms, i / count));
	return best;
}

// ---- preset waveforms -----------------------------------------------------------------

export type WaveShape = 'square' | 'sawtooth' | 'triangle' | 'pulse';

/** Fraction of the period a pulse is high. */
export const PULSE_WIDTH = 0.2;

/**
 * The preset waveforms, one period, values between −1 and 1. At a jump the
 * value is the midpoint of the two sides (0 for the square wave), the value a
 * Fourier series converges to there; it also keeps the square wave exactly odd,
 * so its spectrum is made of pure sines.
 */
export function shapeValue(shape: WaveShape, u: number): number {
	const v = u - Math.floor(u);
	switch (shape) {
		case 'square':
			return v === 0 || v === 0.5 ? 0 : v < 0.5 ? 1 : -1;
		case 'sawtooth':
			// Rises steadily from −1 to 1, then drops back.
			return v === 0 ? 0 : 2 * v - 1;
		case 'triangle':
			// 0 → 1 at a quarter period → −1 at three quarters → 0.
			return v < 0.25 ? 4 * v : v < 0.75 ? 2 - 4 * v : 4 * v - 4;
		case 'pulse': {
			if (v === 0 || v === PULSE_WIDTH) return 0;
			return v < PULSE_WIDTH ? 1 : -1;
		}
	}
}

/** N samples of a preset waveform at u = j/N. */
export function shapeSamples(shape: WaveShape, N: number): number[] {
	return Array.from({ length: N }, (_, j) => shapeValue(shape, j / N));
}

/**
 * A waveform drawn by hand: a stroke of points (u, y) with u in periods
 * (anything outside 0…1 is wrapped). Strokes may go backwards or cover only
 * part of the period. The period is split into N bins; each bin takes the
 * mean height of the points that fell in it, and empty bins are filled by
 * straight lines between their filled neighbours, across the end of the
 * period where needed (the waveform repeats). Returns null when the stroke
 * covers too little of the period to make a waveform (fewer than 2 bins).
 */
export function waveFromStroke(
	stroke: readonly { u: number; y: number }[],
	N: number
): number[] | null {
	const sum = new Float64Array(N);
	const cnt = new Uint32Array(N);
	for (const p of stroke) {
		if (!Number.isFinite(p.u) || !Number.isFinite(p.y)) continue;
		const v = p.u - Math.floor(p.u);
		const j = Math.min(N - 1, Math.floor(v * N));
		sum[j] += p.y;
		cnt[j]++;
	}
	const filled: number[] = [];
	for (let j = 0; j < N; j++) if (cnt[j]) filled.push(j);
	if (filled.length < 2) return null;
	const out = new Array<number>(N);
	for (const j of filled) out[j] = sum[j] / cnt[j];
	for (let f = 0; f < filled.length; f++) {
		const a = filled[f];
		const b = filled[(f + 1) % filled.length];
		const gap = (b - a + N) % N || N;
		for (let s = 1; s < gap; s++) {
			out[(a + s) % N] = out[a] + ((out[b] - out[a]) * s) / gap;
		}
	}
	return out;
}

// ---- winding: how the transform measures one frequency --------------------------------

/**
 * Wrap the waveform round a circle at `k` turns per period: the sample at
 * time u is placed at distance x(u) from the centre, at angle −2π k u
 * (clockwise, the e^{−2πiku} of the transform). Returns the points and their
 * centre of mass, (1/N) Σ x_j e^{−2πi k j/N}. For a whole k ≥ 1, twice the
 * distance of that centre from the origin is the amplitude A_k of frequency k;
 * for k = 0 it is the average. `k` need not be whole.
 */
export function wind(
	samples: readonly number[],
	k: number
): { points: Complex[]; centre: Complex } {
	const N = samples.length;
	const points: Complex[] = [];
	let re = 0;
	let im = 0;
	for (let j = 0; j < N; j++) {
		const a = (-TAU * k * j) / N;
		const p = { re: samples[j] * Math.cos(a), im: samples[j] * Math.sin(a) };
		points.push(p);
		re += p.re;
		im += p.im;
	}
	return { points, centre: { re: re / N, im: im / N } };
}

/** The strength the winding finds at frequency k: 2 × |centre| (k > 0), the average's size at k = 0. */
export function strengthAt(samples: readonly number[], k: number): number {
	const { centre } = wind(samples, k);
	return (Math.abs(k) < 1e-9 ? 1 : 2) * Math.hypot(centre.re, centre.im);
}

// ---- closed curves ---------------------------------------------------------------------

/** One rotating circle of a closed curve: radius |c|, k turns per period, starting angle arg c. */
export interface Epicycle {
	k: number;
	c: Complex;
	radius: number;
}

/**
 * The circles of a closed curve given by N points (y up), largest first after
 * the k = 0 term (the curve's centre, which does not turn). Frequencies are
 * taken in −N/2 … N/2 − 1, the lowest frequencies that fit the samples.
 */
export function curveCircles(points: readonly Complex[]): Epicycle[] {
	const N = points.length;
	const X = dft(points);
	const all: Epicycle[] = X.map((x, i) => {
		const k = i < N / 2 ? i : i - N;
		const c = { re: x.re / N, im: x.im / N };
		return { k, c, radius: Math.hypot(c.re, c.im) };
	});
	const centre = all[0];
	const rest = all.slice(1).sort((a, b) => b.radius - a.radius || Math.abs(a.k) - Math.abs(b.k));
	return [centre, ...rest];
}

/**
 * Centres of the chain of circles at time u (in periods), using the centre
 * term and the first `count` circles. Returns count + 1 points: the curve's
 * centre (where the first circle is centred), the centre of each following
 * circle, and finally the pen.
 */
export function chain(circles: readonly Epicycle[], count: number, u: number): Complex[] {
	const out: Complex[] = [];
	let re = 0;
	let im = 0;
	out.push({ re, im });
	const n = Math.min(circles.length, count + 1);
	for (let i = 0; i < n; i++) {
		const { k, c } = circles[i];
		const a = TAU * k * u;
		const ca = Math.cos(a);
		const sa = Math.sin(a);
		re += c.re * ca - c.im * sa;
		im += c.re * sa + c.im * ca;
		out.push({ re, im });
	}
	// The first entry (0, 0) is the origin; drop it so the chain starts at the curve's centre.
	return out.slice(1);
}

/** Where the pen of `count` circles is at time u. */
export function pen(circles: readonly Epicycle[], count: number, u: number): Complex {
	const c = chain(circles, count, u);
	return c[c.length - 1];
}

/**
 * Resample a hand-drawn closed stroke to N points equally spaced along its
 * length, closing it with a straight line from the last point back to the
 * first. Returns null for a stroke too short to be a curve.
 */
export function closedCurve(
	stroke: readonly Complex[],
	N: number,
	minLength = 1e-6
): Complex[] | null {
	const pts = stroke.filter((p) => Number.isFinite(p.re) && Number.isFinite(p.im));
	if (pts.length < 3) return null;
	const loop = [...pts, pts[0]];
	const cum = [0];
	for (let i = 1; i < loop.length; i++) {
		cum.push(cum[i - 1] + Math.hypot(loop[i].re - loop[i - 1].re, loop[i].im - loop[i - 1].im));
	}
	const total = cum[cum.length - 1];
	if (!(total > minLength)) return null;
	const out: Complex[] = [];
	let seg = 1;
	for (let j = 0; j < N; j++) {
		const s = (total * j) / N;
		while (seg < loop.length - 1 && cum[seg] < s) seg++;
		const a = loop[seg - 1];
		const b = loop[seg];
		const len = cum[seg] - cum[seg - 1];
		const f = len > 0 ? (s - cum[seg - 1]) / len : 0;
		out.push({ re: a.re + (b.re - a.re) * f, im: a.im + (b.im - a.im) * f });
	}
	return out;
}

// ---- preset curves ---------------------------------------------------------------------

export type CurveShape = 'heart' | 'star' | 'square';

/** N points of a preset closed curve, y up, roughly within −1 … 1, traced anticlockwise. */
export function curvePoints(shape: CurveShape, N: number): Complex[] {
	if (shape === 'heart') {
		// The classic heart curve x = 16 sin³s, y = 13 cos s − 5 cos 2s − 2 cos 3s − cos 4s,
		// sampled evenly in s (it is not traced at constant speed, which is fine).
		return Array.from({ length: N }, (_, j) => {
			const s = (TAU * j) / N;
			const x = 16 * Math.sin(s) ** 3;
			const y = 13 * Math.cos(s) - 5 * Math.cos(2 * s) - 2 * Math.cos(3 * s) - Math.cos(4 * s);
			// s runs clockwise on this curve; −x makes it anticlockwise.
			return { re: -x / 17, im: (y + 2.5) / 17 };
		});
	}
	const corners: Complex[] =
		shape === 'square'
			? [
					{ re: 0.8, im: -0.8 },
					{ re: 0.8, im: 0.8 },
					{ re: -0.8, im: 0.8 },
					{ re: -0.8, im: -0.8 }
				]
			: Array.from({ length: 10 }, (_, i) => {
					// A five-pointed star: points at radius 1, inner corners at 0.42.
					const a = Math.PI / 2 + (TAU * i) / 10;
					const r = i % 2 ? 0.42 : 1;
					return { re: r * Math.cos(a), im: r * Math.sin(a) - 0.06 };
				});
	return closedCurve(corners, N) ?? [];
}

// ---- small helpers for the scenes -----------------------------------------------------

/** A number with a real minus sign and `d` decimals. */
export function num(v: number, d = 2): string {
	const s = v.toFixed(d);
	return (Number(s) === 0 ? (0).toFixed(d) : s).replace('-', '−');
}

/** Pack numbers for a built-state param (`ft:wave`, …): fixed decimals, comma-separated. */
export function pack(values: readonly number[], d = 3): string {
	return values.map((v) => Number(v.toFixed(d))).join(',');
}

/** The inverse of `pack`; null if the text is empty or not a list of `length` numbers. */
export function unpack(text: string, length?: number): number[] | null {
	if (!text) return null;
	const v = text.split(',').map(Number);
	if (v.some((x) => !Number.isFinite(x))) return null;
	if (length !== undefined && v.length !== length) return null;
	return v;
}
