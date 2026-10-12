/**
 * What the scenes share: the sampling rates, the reader's drawings (stored in
 * params as packed numbers) and path builders. Built on the model in `fourier.ts`.
 */
import {
	closedCurve,
	curvePoints,
	shapeSamples,
	unpack,
	type Complex,
	type CurveShape,
	type Harmonic,
	type WaveShape
} from './fourier';

/** Samples per period of a waveform (a multiple of 5 and 4, so the presets' corners fall on samples). */
export const N_WAVE = 400;
/** Points of a closed curve. */
export const N_CURVE = 200;
/** How many bars the spectrum charts show (1 … BARS Hz, plus 0 Hz). */
export const BARS = 16;

export const WAVE_SHAPES: readonly WaveShape[] = ['square', 'sawtooth', 'triangle', 'pulse'];
export const CURVE_SHAPES: readonly CurveShape[] = ['heart', 'star', 'square'];

export const WAVE_NAMES: Record<string, string> = {
	square: 'square wave',
	sawtooth: 'sawtooth',
	triangle: 'triangle wave',
	pulse: 'pulse',
	drawn: 'your drawing'
};

/** "the square wave", "your drawing": the waveform's name after a verb or preposition. */
export function theWave(shape: string): string {
	return shape === 'drawn' ? 'your drawing' : `the ${WAVE_NAMES[shape] ?? shape}`;
}

/**
 * The samples of the chosen waveform: a preset, or the reader's drawing from
 * `params['ft:wave']`. Null for "Your drawing" before anything has been drawn.
 */
export function waveSource(shape: string, drawn: string): number[] | null {
	if (shape === 'drawn') return unpack(drawn, N_WAVE);
	const s = (WAVE_SHAPES as readonly string[]).includes(shape) ? (shape as WaveShape) : 'square';
	return shapeSamples(s, N_WAVE);
}

/** The points of the chosen closed curve (y up, about −1 … 1), or null for an empty drawing. */
export function curveSource(name: string, drawn: string): Complex[] | null {
	if (name === 'drawn') {
		const v = unpack(drawn, 2 * N_CURVE);
		if (!v) return null;
		return Array.from({ length: N_CURVE }, (_, j) => ({ re: v[2 * j], im: v[2 * j + 1] }));
	}
	const s = (CURVE_SHAPES as readonly string[]).includes(name) ? (name as CurveShape) : 'heart';
	return curvePoints(s, N_CURVE);
}

/**
 * A drawn loop (y up) scaled into the −1 … 1 box the presets use, centred,
 * keeping its proportions, and resampled evenly; null if it is too small.
 */
export function normaliseLoop(stroke: Complex[]): Complex[] | null {
	const pts = closedCurve(stroke, N_CURVE, 0.05);
	if (!pts) return null;
	let x0 = Infinity,
		x1 = -Infinity,
		y0 = Infinity,
		y1 = -Infinity;
	for (const p of pts) {
		x0 = Math.min(x0, p.re);
		x1 = Math.max(x1, p.re);
		y0 = Math.min(y0, p.im);
		y1 = Math.max(y1, p.im);
	}
	const size = Math.max(x1 - x0, y1 - y0);
	if (!(size > 0.05)) return null;
	const cx = (x0 + x1) / 2;
	const cy = (y0 + y1) / 2;
	return pts.map((p) => ({ re: (2 * (p.re - cx)) / size, im: (2 * (p.im - cy)) / size }));
}

/**
 * Spectrum with the amplitudes of 0 … BARS Hz replaced by `bars` (the edited
 * chart) and everything above dropped. Phases are kept; a frequency the
 * waveform did not contain gets phase 0 (a plain sine wave).
 */
export function editedSpectrum(base: readonly Harmonic[], bars: readonly number[]): Harmonic[] {
	return bars.map((amp, n) => ({ n, amp, phase: base[n]?.phase ?? 0 }));
}

/** SVG path of y = f(u) over one period, drawn from x0 to x1 around the middle line cy, U px per unit. */
export function wavePath(
	f: (u: number) => number,
	x0: number,
	x1: number,
	cy: number,
	U: number,
	count = 400
): string {
	let d = '';
	for (let i = 0; i <= count; i++) {
		const u = i / count;
		d += `${i ? 'L' : 'M'}${(x0 + (x1 - x0) * u).toFixed(1)} ${(cy - U * f(u)).toFixed(1)}`;
	}
	return d;
}

/**
 * Path of a sampled waveform (one sample per step), as steps between samples
 * would mislead: straight lines from sample to sample, closed back to the
 * first sample at the end of the period.
 */
export function samplesPath(
	samples: readonly number[],
	x0: number,
	x1: number,
	cy: number,
	U: number
): string {
	const N = samples.length;
	let d = '';
	for (let j = 0; j <= N; j++) {
		const v = samples[j % N];
		d += `${j ? 'L' : 'M'}${(x0 + ((x1 - x0) * j) / N).toFixed(1)} ${(cy - U * v).toFixed(1)}`;
	}
	return d;
}

/** "1", "⅓", "1/7": the amplitude of a square-wave ingredient before the 4/π factor. */
export function oneOver(n: number): string {
	const frac: Record<number, string> = { 1: '1', 2: '½', 3: '⅓', 4: '¼', 5: '⅕' };
	return frac[n] ?? `1/${n}`;
}
