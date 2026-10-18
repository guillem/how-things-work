/**
 * Sounds for the cochlea page and the cochlear implant's processing, in plain TypeScript (no
 * Web Audio here, so the Node tests can check them; `scenes/sound.ts` plays the results).
 *
 * Vowels: a source–filter synthesis. The voice's source is a train of glottal pulses at a
 * fundamental f₀, whose harmonics fall by about 6 dB per octave once the lips' radiation is
 * included; the vocal tract filters them through resonances, the formants. The formant
 * frequencies are Peterson & Barney's (1952) averages for men; the bandwidths are typical
 * values. Built here as a sum of the harmonics (additive synthesis), so the spectrum the page
 * draws is exactly the sound it plays.
 *
 * The implant: a noise vocoder, the standard simulation of what a cochlear-implant user hears
 * (Shannon et al. 1995, Science 270:303). The sound is split into N bands spaced evenly along
 * the cochlea (by Greenwood's map) from 200 Hz to 7 kHz; each band's envelope (rectified and
 * smoothed below 160 Hz) is what its electrode would carry; the simulation modulates noise
 * filtered into the same band with that envelope and adds the bands up. Everything within a
 * band, harmonics and formant peaks alike, is replaced by noise that only keeps the band's
 * loudness over time.
 */
import { LENGTH_MM, cfAt, placeOf } from './model.ts';

/** Sample rate of the page's sounds, Hz. */
export const RATE = 22050;

// ------------------------------------------------------------------------------- vowels
export type VowelId = 'ah' | 'ee' | 'oo';

export interface Vowel {
	id: VowelId;
	/** As in the word… */
	word: string;
	/** Formant frequencies F1, F2, F3, Hz (Peterson & Barney 1952, men's averages). */
	formants: [number, number, number];
}

export const VOWELS: Record<VowelId, Vowel> = {
	ah: { id: 'ah', word: 'father', formants: [730, 1090, 2440] },
	ee: { id: 'ee', word: 'heed', formants: [270, 2290, 3010] },
	oo: { id: 'oo', word: 'who’d', formants: [300, 870, 2240] }
};

/** The synthetic voice's fundamental frequency, Hz (a typical man's speaking pitch). */
export const F0 = 120;
/** Formant bandwidths, Hz (typical values for F1–F3). */
const BANDWIDTHS = [80, 100, 140];
/** The highest harmonic synthesized, Hz. */
const TOP = 5000;

/** Gain of one two-pole resonance (a formant) at frequency f, 1 at 0 Hz. */
function resonance(f: number, fc: number, bw: number): number {
	// |H| for a resonator with poles at fc ± i·bw/2 (in Hz), normalised to 1 at f = 0
	const a = fc * fc + (bw / 2) * (bw / 2);
	const p = Math.hypot(f - fc, bw / 2) * Math.hypot(f + fc, bw / 2);
	return a / p;
}

/** The vowel's harmonics: frequency and relative amplitude (the largest is 1). */
export function vowelHarmonics(v: Vowel, f0 = F0): { f: number; a: number }[] {
	const out: { f: number; a: number }[] = [];
	for (let k = 1; k * f0 <= TOP; k++) {
		const f = k * f0;
		let a = 1 / k;
		v.formants.forEach((fc, i) => (a *= resonance(f, fc, BANDWIDTHS[i])));
		out.push({ f, a });
	}
	const top = Math.max(...out.map((h) => h.a));
	return out.map((h) => ({ f: h.f, a: h.a / top }));
}

/** Fades a sound in and out over `ramp` seconds (no clicks). */
function fade(x: Float32Array, ramp = 0.04): Float32Array {
	const n = Math.round(ramp * RATE);
	for (let i = 0; i < n && i < x.length; i++) {
		const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
		x[i] *= g;
		x[x.length - 1 - i] *= g;
	}
	return x;
}

/** Scales a sound to a given RMS. */
function toRms(x: Float32Array, target: number): Float32Array {
	const r = rms(x);
	if (r > 0) for (let i = 0; i < x.length; i++) x[i] *= target / r;
	return x;
}

export function rms(x: ArrayLike<number>): number {
	let s = 0;
	for (let i = 0; i < x.length; i++) s += x[i] * x[i];
	return Math.sqrt(s / Math.max(1, x.length));
}

/** RMS of every sound the page plays (full scale is 1): quiet, well below clipping. */
export const LEVEL_RMS = 0.05;

/**
 * The vowel as a sound: `seconds` long, with a slight, slow wobble of the pitch (±1 %) so that it
 * sounds less like a buzzer.
 */
export function vowelSound(v: Vowel, seconds = 1.2): Float32Array {
	const n = Math.round(seconds * RATE);
	const x = new Float32Array(n);
	const hs = vowelHarmonics(v);
	const phases = hs.map((_, k) => (k * k * 0.37) % (2 * Math.PI));
	let phase = 0;
	for (let i = 0; i < n; i++) {
		const t = i / RATE;
		const f0 = F0 * (1 + 0.01 * Math.sin(2 * Math.PI * 4.5 * t));
		phase += (2 * Math.PI * f0) / RATE;
		let s = 0;
		for (let k = 0; k < hs.length; k++) s += hs[k].a * Math.sin((k + 1) * phase + phases[k]);
		x[i] = s;
	}
	return fade(toRms(x, LEVEL_RMS));
}

// ------------------------------------------------------------------------------- filters
/** A biquad section's coefficients (b0, b1, b2, a1, a2), a0 normalised to 1. */
type Biquad = [number, number, number, number, number];

/** RBJ low-pass or high-pass section with quality factor `q`. */
function section(kind: 'low' | 'high', fc: number, q: number): Biquad {
	const w = (2 * Math.PI * fc) / RATE;
	const alpha = Math.sin(w) / (2 * q);
	const a0 = 1 + alpha;
	const c = Math.cos(w);
	const b =
		kind === 'low' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
	return [b[0] / a0, b[1] / a0, b[2] / a0, (-2 * c) / a0, (1 - alpha) / a0];
}

/** Quality factors of the two sections of a fourth-order Butterworth filter. */
const BUTTERWORTH_4 = [0.5412, 1.3066];

/** Second-order Butterworth low-pass. */
function lowpass(fc: number): Biquad {
	return section('low', fc, Math.SQRT1_2);
}

function run(x: Float32Array, [b0, b1, b2, a1, a2]: Biquad): Float32Array {
	const y = new Float32Array(x.length);
	let x1 = 0,
		x2 = 0,
		y1 = 0,
		y2 = 0;
	for (let i = 0; i < x.length; i++) {
		const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
		x2 = x1;
		x1 = x[i];
		y2 = y1;
		y1 = v;
		y[i] = v;
	}
	return y;
}

/**
 * A band filter between `lo` and `hi` Hz: a fourth-order Butterworth high-pass at `lo` and a
 * fourth-order Butterworth low-pass at `hi` (24 dB per octave on each side).
 */
function bandFilter(x: Float32Array, lo: number, hi: number): Float32Array {
	let y = x;
	for (const q of BUTTERWORTH_4) y = run(y, section('high', lo, q));
	for (const q of BUTTERWORTH_4) y = run(y, section('low', hi, q));
	return y;
}

// ------------------------------------------------------------------------------- the implant
/** The processor's frequency range, Hz. */
export const BAND_LO = 200;
export const BAND_HI = 7000;

/**
 * Edges of `n` analysis bands from BAND_LO to BAND_HI, equally spaced along the cochlea by
 * Greenwood's map (n + 1 frequencies, ascending).
 */
export function bandEdges(n: number): number[] {
	const x0 = placeOf(BAND_LO);
	const x1 = placeOf(BAND_HI);
	return Array.from({ length: n + 1 }, (_, i) => cfAt(x0 + ((x1 - x0) * i) / n));
}

/**
 * The electrode array: the deepest contact sits `INSERTION_MM` from the base, the shallowest at
 * `ARRAY_START_MM`; contacts are evenly spaced between them. Real arrays reach 20–25 mm into a
 * 33–35 mm cochlea, so they never reach the apex, where the lowest frequencies are sorted.
 */
export const INSERTION_MM = 24;
export const ARRAY_START_MM = 6;

/** Electrode places (mm from the base), for `n` bands: band 0 (lowest) on the deepest contact. */
export function electrodePlaces(n: number): number[] {
	if (n === 1) return [(INSERTION_MM + ARRAY_START_MM) / 2];
	return Array.from(
		{ length: n },
		(_, i) => INSERTION_MM - ((INSERTION_MM - ARRAY_START_MM) * i) / (n - 1)
	);
}

/** RMS level of each band of a sound, for `n` bands (lowest first). */
export function bandLevels(x: Float32Array, n: number): number[] {
	const e = bandEdges(n);
	return Array.from({ length: n }, (_, i) => rms(bandFilter(x, e[i], e[i + 1])));
}

/** The envelope of a band signal: full-wave rectified, then low-passed at 160 Hz (twice). */
function envelope(x: Float32Array): Float32Array {
	const r = Float32Array.from(x, Math.abs);
	return run(run(r, lowpass(160)), lowpass(160));
}

/** Deterministic white noise (a small linear congruential generator), so tests repeat. */
function noise(n: number, seed = 12345): Float32Array {
	let s = seed >>> 0;
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		out[i] = s / 2 ** 31 - 1;
	}
	return out;
}

/**
 * What an implant with `n` channels passes on, as a noise-vocoded sound: in each band, noise
 * filtered into that band, modulated by the band's envelope and scaled to the band's RMS. Returns
 * the sound (at the page's RMS) and the RMS each electrode carries.
 */
export function vocode(x: Float32Array, n: number): { sound: Float32Array; levels: number[] } {
	const e = bandEdges(n);
	const out = new Float32Array(x.length);
	const levels: number[] = [];
	const carrier = noise(x.length);
	for (let i = 0; i < n; i++) {
		const band = bandFilter(x, e[i], e[i + 1]);
		const level = rms(band);
		levels.push(level);
		const env = envelope(band);
		const mod = bandFilter(carrier, e[i], e[i + 1]);
		for (let k = 0; k < x.length; k++) mod[k] *= env[k];
		// rescale this band to the input band's RMS, then add it in
		const r = rms(mod);
		if (r > 0) for (let k = 0; k < x.length; k++) out[k] += (mod[k] * level) / r;
	}
	return { sound: fade(toRms(out, LEVEL_RMS)), levels };
}

/** The band of each frequency (index), or −1 outside the processor's range. */
export function bandOf(f: number, n: number): number {
	const e = bandEdges(n);
	for (let i = 0; i < n; i++) if (f >= e[i] && f < e[i + 1]) return i;
	return -1;
}

/** The fraction of the membrane's length an electrode array of the page covers. */
export const COVERAGE = (INSERTION_MM - ARRAY_START_MM) / LENGTH_MM;
