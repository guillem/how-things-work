/**
 * The model behind "Why music has twelve notes": pitches as frequencies,
 * intervals as ratios measured in cents, the roughness of two sounds (the
 * Plomp–Levelt curve in Sethares' parametric form), beats between nearly
 * matching harmonics, and equal divisions of the octave.
 *
 * Pure TypeScript, no DOM; checked in Node by `e2e/musical-scales-ratios-model.e2e.ts`.
 */

/** Concert pitch: A4 = 440 Hz (ISO 16). */
export const A4 = 440;
/** Middle C in twelve-tone equal temperament from A4 = 440 Hz: 261.63 Hz. */
export const C4 = A4 * 2 ** (-9 / 12);

/** Cents in an interval of frequency ratio r: 1200 per octave, 100 per equal-tempered semitone. */
export const cents = (r: number) => 1200 * Math.log2(r);
/** Frequency ratio of an interval of c cents. */
export const ratioOf = (c: number) => 2 ** (c / 1200);

/** Pure (just) fifth 3:2 and major third 5:4, in cents. */
export const PURE_FIFTH = cents(3 / 2);
export const PURE_THIRD = cents(5 / 4);

export interface Interval {
	/** Semitones above the lower note, 0 to 12. */
	semis: number;
	name: string;
	short: string;
	/** The pure ratio used for this interval when the pair is tuned pure. */
	p: number;
	q: number;
}

/**
 * The thirteen intervals within an octave, with the simple ratio each one
 * approximates (five-limit just intonation; the tritone has no simple ratio,
 * 45:32 is the usual five-limit choice, and the minor seventh is taken as 9:5,
 * though 16:9 is also used).
 */
export const INTERVALS: Interval[] = [
	{ semis: 0, name: 'unison', short: 'P1', p: 1, q: 1 },
	{ semis: 1, name: 'minor second', short: 'm2', p: 16, q: 15 },
	{ semis: 2, name: 'major second', short: 'M2', p: 9, q: 8 },
	{ semis: 3, name: 'minor third', short: 'm3', p: 6, q: 5 },
	{ semis: 4, name: 'major third', short: 'M3', p: 5, q: 4 },
	{ semis: 5, name: 'perfect fourth', short: 'P4', p: 4, q: 3 },
	{ semis: 6, name: 'tritone', short: 'TT', p: 45, q: 32 },
	{ semis: 7, name: 'perfect fifth', short: 'P5', p: 3, q: 2 },
	{ semis: 8, name: 'minor sixth', short: 'm6', p: 8, q: 5 },
	{ semis: 9, name: 'major sixth', short: 'M6', p: 5, q: 3 },
	{ semis: 10, name: 'minor seventh', short: 'm7', p: 9, q: 5 },
	{ semis: 11, name: 'major seventh', short: 'M7', p: 15, q: 8 },
	{ semis: 12, name: 'octave', short: 'P8', p: 2, q: 1 }
];

/** Note names of the keyboard drawn on the page, C4 to C5. */
export const KEY_NAMES = [
	'C4',
	'C♯4',
	'D4',
	'E♭4',
	'E4',
	'F4',
	'F♯4',
	'G4',
	'A♭4',
	'A4',
	'B♭4',
	'B4',
	'C5'
];

/** Frequency of key k (0 = C4 … 12 = C5) in equal temperament. */
export const etFrequency = (k: number) => C4 * 2 ** (k / 12);

export type Tuning = 'equal' | 'pure';

/**
 * The two frequencies of a pair of keys. The lower key always sounds at its
 * equal-tempered pitch; with `pure` tuning the upper one is moved to the
 * interval's simple ratio above it (as a singer or violinist would tune it).
 */
export function pairFrequencies(a: number, b: number, tuning: Tuning): [number, number] {
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	const f1 = etFrequency(lo);
	if (tuning === 'equal') return [f1, etFrequency(hi)];
	const iv = INTERVALS[hi - lo];
	return [f1, (f1 * iv.p) / iv.q];
}

// ------------------------------------------------------------------- roughness

/**
 * Roughness of two pure tones: Sethares' fit (Tuning, Timbre, Spectrum, Scale,
 * 2nd ed. 2005, and its `dissmeasure` code) to Plomp & Levelt's 1965
 * measurements. Zero at unison, rising to a peak when the tones are about a
 * quarter of a critical band apart, then fading. A pair counts with the
 * smaller of its two amplitudes.
 */
export function pairRoughness(f1: number, f2: number, a1 = 1, a2 = 1): number {
	const B1 = 3.51;
	const B2 = 5.75;
	const DSTAR = 0.24;
	const S1 = 0.0207;
	const S2 = 18.96;
	const fmin = Math.min(f1, f2);
	const s = DSTAR / (S1 * fmin + S2);
	const d = Math.abs(f2 - f1);
	return 5 * Math.min(a1, a2) * (Math.exp(-B1 * s * d) - Math.exp(-B2 * s * d));
}

export interface Partial {
	f: number;
	a: number;
}

export type Timbre = 'sine' | 'rich';

/** Number of harmonics in the "rich" timbre. */
export const RICH_PARTIALS = 6;

/**
 * The partials of a note: a pure sine is just the fundamental; the rich tone
 * has six harmonics whose amplitudes fall by 0.88 each (the timbre Sethares
 * uses for his dissonance curves; a rough stand-in for a bowed or blown note).
 */
export function partials(f: number, timbre: Timbre): Partial[] {
	if (timbre === 'sine') return [{ f, a: 1 }];
	return Array.from({ length: RICH_PARTIALS }, (_, i) => ({ f: f * (i + 1), a: 0.88 ** i }));
}

/** Total roughness of two notes: the sum over every pair of their partials. */
export function roughness(f1: number, f2: number, timbre: Timbre): number {
	let r = 0;
	for (const p of partials(f1, timbre))
		for (const q of partials(f2, timbre)) r += pairRoughness(p.f, q.f, p.a, q.a);
	return r;
}

/** Roughness against the interval in cents above `base`, sampled every `stepC` cents. */
export function roughnessCurve(
	base: number,
	timbre: Timbre,
	maxC = 1250,
	stepC = 2
): { c: number; r: number }[] {
	const out: { c: number; r: number }[] = [];
	for (let c = 0; c <= maxC + 1e-9; c += stepC)
		out.push({ c, r: roughness(base, base * ratioOf(c), timbre) });
	return out;
}

/** Local minima of a sampled curve (interior points lower than both neighbours). */
export function valleys(curve: { c: number; r: number }[]): number[] {
	const out: number[] = [];
	for (let i = 1; i < curve.length - 1; i++)
		if (curve[i].r < curve[i - 1].r && curve[i].r <= curve[i + 1].r) out.push(curve[i].c);
	return out;
}

/**
 * The largest roughness of two notes within the octave above `base` for a
 * timbre, used to scale the roughness meter (0 = smooth, 1 = the roughest
 * interval in the octave).
 */
export function roughnessScale(base: number, timbre: Timbre): number {
	return Math.max(...roughnessCurve(base, timbre, 1200, 5).map((p) => p.r));
}

// ------------------------------------------------------------------------ beats

export interface Beat {
	/** Harmonic numbers of the lower and upper note. */
	m: number;
	n: number;
	f1: number;
	f2: number;
	/** Beats per second: the difference of the two frequencies. */
	rate: number;
}

/**
 * The nearly matching harmonics of two notes: every pair (m·f1, n·f2), m and n
 * up to `upTo`, whose frequencies differ by less than `within` Hz but are not
 * identical. Each such pair beats `rate` times a second. Sorted slowest first.
 */
export function beats(f1: number, f2: number, upTo = RICH_PARTIALS, within = 40): Beat[] {
	const out: Beat[] = [];
	for (let m = 1; m <= upTo; m++)
		for (let n = 1; n <= upTo; n++) {
			const rate = Math.abs(m * f1 - n * f2);
			if (rate < within && rate > 1e-6) out.push({ m, n, f1: m * f1, f2: n * f2, rate });
		}
	return out.sort((x, y) => x.rate - y.rate);
}

/**
 * How the waves of two notes line up: for a ratio f2/f1 within `tolCents` of
 * p/q (in lowest terms, q ≤ `maxQ`), the sum repeats after q cycles of the
 * lower note (and p of the upper one). Returns the simplest such fraction, or
 * null when none is that close.
 */
export function lineUp(
	f1: number,
	f2: number,
	tolCents = 0.01,
	maxQ = 32
): { p: number; q: number } | null {
	const r = f2 / f1;
	for (let q = 1; q <= maxQ; q++) {
		const p = Math.round(r * q);
		if (p < 1) continue;
		if (gcd(p, q) !== 1) continue;
		if (Math.abs(cents(r / (p / q))) <= tolCents) return { p, q };
	}
	return null;
}

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

// --------------------------------------------------------- dividing the octave

export interface Approx {
	/** Steps of the n-step ladder nearest the target. */
	k: number;
	/** Cents of that step. */
	c: number;
	/** How far that step misses the pure interval, in cents (+ = sharp). */
	err: number;
}

/** The step of an n-step equal division of the octave nearest an interval of `target` cents. */
export function nearestStep(n: number, target: number): Approx {
	const k = Math.round((target * n) / 1200);
	const c = (k * 1200) / n;
	return { k, c, err: c - target };
}

export const fifthIn = (n: number) => nearestStep(n, PURE_FIFTH);
export const thirdIn = (n: number) => nearestStep(n, PURE_THIRD);

/** The ladders the page offers on its divider. */
export const LADDERS = [5, 7, 12, 19, 31, 53] as const;

/** Every n from 1 to `max` whose fifth is within `tol` cents of 3:2. */
export const closeFifths = (tol: number, max = 60) =>
	Array.from({ length: max }, (_, i) => i + 1).filter((n) => Math.abs(fifthIn(n).err) < tol);

/**
 * Convergents of the continued fraction of x: the best rational
 * approximations, each closer than any fraction with a smaller denominator.
 */
export function convergents(x: number, count: number): { p: number; q: number }[] {
	const out: { p: number; q: number }[] = [];
	let [p0, q0, p1, q1] = [0, 1, 1, 0];
	let y = x;
	for (let i = 0; i < count; i++) {
		const a = Math.floor(y);
		[p0, q0, p1, q1] = [p1, q1, a * p1 + p0, a * q1 + q0];
		out.push({ p: p1, q: q1 });
		const frac = y - a;
		if (frac < 1e-12) break;
		y = 1 / frac;
	}
	return out;
}

// ------------------------------------------------------------- chain of fifths

/** Names of the notes reached by stacking pure fifths upwards from C. */
export const FIFTH_NAMES = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯', 'B♯'];

/** Where the k-th pure fifth above C lands within the octave, in cents (0 to 1200). */
export const fifthChain = (k: number) => (((k * PURE_FIFTH) % 1200) + 1200) % 1200;

/** Twelve pure fifths overshoot seven octaves by the Pythagorean comma, in cents. */
export const PYTHAGOREAN_COMMA = cents((3 / 2) ** 12 / 2 ** 7);

/** Name of the nearest equal-tempered note of an interval in cents above C. */
export const nearestName = (c: number) => KEY_NAMES[Math.round(c / 100) % 12].replace('4', '');
