/** Helpers shared by the Shazam scenes: reading the controls, spectrogram images, numbers. */
import type { Params } from '#lib/explainer/index.ts';
import {
	BINS,
	DB_SIZE,
	DEFAULT_RECORDING,
	UNKNOWN,
	type Recording,
	type Spectrogram,
	type Version
} from '../model';

/** The tune chosen on the first chapter's steps. */
export const tuneOf = (p: Params) => clampTune(p.tune, 4);

function clampTune(v: unknown, fallback: number) {
	const n = Math.round(Number(v ?? fallback));
	return Number.isFinite(n) ? Math.max(0, Math.min(DB_SIZE - 1, n)) : fallback;
}

/** The recording the third and fourth chapters' controls describe. */
export function recordingOf(p: Params, withVersion: boolean): Recording {
	const v = withVersion ? String(p.version ?? 'original') : 'original';
	const clip = v === 'unknown' ? UNKNOWN : clampTune(p.recTune, DEFAULT_RECORDING.clip);
	const version: Version = v.startsWith('higher') ? 'higher' : v === 'cover' ? 'cover' : 'original';
	const seconds = Math.max(1, Math.min(8, Number(p.seconds ?? DEFAULT_RECORDING.seconds)));
	const start = Math.max(0, Math.min(12 - seconds, Number(p.start ?? DEFAULT_RECORDING.start)));
	return {
		clip,
		version,
		semitones: v === 'higher2' ? 2 : 1,
		start: Math.round(start * 10) / 10,
		seconds,
		snrDb: Math.round(Number(p.noise ?? DEFAULT_RECORDING.snrDb)),
		cough: p.cough !== false,
		seed: 1 + Number(p.again ?? 0)
	};
}

// ---------------------------------------------------------------------------- spectrogram image

/** Colour ramps from quiet to loud: light (paper to ink blue) and dark (night to amber). */
const RAMP_LIGHT: [number, number, number][] = [
	[251, 250, 247],
	[214, 222, 240],
	[134, 152, 214],
	[66, 76, 170],
	[31, 30, 102]
];
const RAMP_DARK: [number, number, number][] = [
	[22, 23, 26],
	[44, 40, 82],
	[118, 52, 120],
	[214, 102, 68],
	[255, 214, 102]
];

function palette(dark: boolean): Uint8Array {
	const ramp = dark ? RAMP_DARK : RAMP_LIGHT;
	const out = new Uint8Array(256 * 4);
	for (let i = 0; i < 256; i++) {
		const u = (i / 255) * (ramp.length - 1);
		const k = Math.min(ramp.length - 2, Math.floor(u));
		const f = u - k;
		const c = ramp[k].map((v, j) => Math.round(v + (ramp[k + 1][j] - v) * f));
		// BMP palettes are blue, green, red, reserved
		out[i * 4] = c[2];
		out[i * 4 + 1] = c[1];
		out[i * 4 + 2] = c[0];
	}
	return out;
}

/** Dynamic range drawn, dB below the loudest point. */
const RANGE_DB = 55;

/**
 * The spectrogram as an 8-bit BMP data URL, one pixel per frame and bin, low frequencies at
 * the bottom, so thousands of points are one `<image>`. `top` is the loudest level (dB) drawn
 * at full strength; pass the clip's own when comparing a recording with it.
 */
export function spectrogramUrl(s: Spectrogram, dark: boolean, top?: number, bins = BINS): string {
	const width = Math.max(1, s.frames);
	const height = bins;
	let max = top ?? -Infinity;
	if (top === undefined) for (const v of s.db) if (v > max) max = v;
	const row = Math.ceil(width / 4) * 4;
	const pixels = row * height;
	const offset = 14 + 40 + 256 * 4;
	const buf = new Uint8Array(offset + pixels);
	const dv = new DataView(buf.buffer);
	buf[0] = 0x42;
	buf[1] = 0x4d;
	dv.setUint32(2, buf.length, true);
	dv.setUint32(10, offset, true);
	dv.setUint32(14, 40, true);
	dv.setInt32(18, width, true);
	dv.setInt32(22, height, true); // positive: bottom row first, so bin 0 is at the bottom
	dv.setUint16(26, 1, true);
	dv.setUint16(28, 8, true);
	dv.setUint32(34, pixels, true);
	dv.setUint32(46, 256, true);
	buf.set(palette(dark), 54);
	for (let b = 0; b < height; b++)
		for (let f = 0; f < s.frames; f++) {
			const v = (s.db[f * BINS + b] - (max - RANGE_DB)) / RANGE_DB;
			buf[offset + b * row + f] = Math.round(255 * Math.max(0, Math.min(1, v)) ** 1.4);
		}
	let bin = '';
	for (let i = 0; i < buf.length; i += 0x8000)
		bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
	return 'data:image/bmp;base64,' + btoa(bin);
}

/** The loudest level of a spectrogram, dB. */
export function loudest(s: Spectrogram) {
	let max = -Infinity;
	for (const v of s.db) if (v > max) max = v;
	return max;
}

// ---------------------------------------------------------------------------- formatting

/** A number with a fixed count of decimals and a unicode minus sign. */
export const fmt = (v: number, digits = 1) => v.toFixed(digits).replace('-', '−');

/** Thousands with a comma: 12,345. */
export const thousands = (v: number) => Math.round(v).toLocaleString('en-US');

/** A signal-to-noise ratio: "+5 dB", "−3 dB", "0 dB". */
export const dB = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} dB`;

/** SVG path of dots: one tiny round-capped segment per point, all in one element. */
export const dots = (pts: { x: number; y: number }[]) =>
	pts.map((p) => `M${p.x.toFixed(1)} ${p.y.toFixed(1)}h0`).join('');
