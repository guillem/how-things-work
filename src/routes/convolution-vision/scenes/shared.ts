/**
 * What the scenes share: the trained network, the chosen digit (a real MNIST test digit or the
 * reader's drawing), the editable filter, and pixel images drawn as data URLs.
 */
import type { ParamValue, Params } from '#lib/explainer/index.ts';
import {
	SIDE,
	decodeBytes,
	decodeWeights,
	drawAsIs,
	prepare,
	type Pt,
	type Stroke
} from '../cnn';
import { PRESETS, type PresetId } from '../filters';
import { SAMPLES, WEIGHTS } from '../mnist-cnn';

export const WT = decodeWeights(WEIGHTS);

/** Numbers with up to `d` decimals, a real minus sign, no "-0". */
export const fmt = (v: number, d = 2) => {
	const s = v.toFixed(d);
	return Number(s) === 0 ? (0).toFixed(d) : s.replace('-', '−');
};
export const int = (v: number) => Math.round(v).toLocaleString('en-US');
export const textWidth = (text: string, size: number) => text.length * size * 0.56;

// ---------------------------------------------------------------------------- digits

const pixelCache = new Map<number, Float32Array>();
export function samplePixels(i: number): Float32Array {
	let p = pixelCache.get(i);
	if (!p) pixelCache.set(i, (p = Float32Array.from(decodeBytes(SAMPLES[i].pixels), (v) => v / 255)));
	return p;
}

/**
 * The reader's drawing, kept in the page (it never leaves the browser). Each stroke remembers the
 * value of the Clear button when it was drawn, so pressing Clear hides every earlier stroke
 * without the scene having to react to it. `params.drawn` counts changes, so that the scenes
 * recompute.
 */
const strokes: { clear: number; pts: Stroke }[] = [];
let version = 0;

const clearOf = (params: Params) => Number(params.clear ?? 0);
export const drawing = (params: Params): Stroke[] => {
	void params.drawn; // depend on the counter
	const c = clearOf(params);
	return strokes.filter((s) => s.clear === c).map((s) => s.pts);
};

/** Starts a stroke at p (pad units 0–1). `fresh` drops what was drawn before. */
export function beginStroke(params: Params, setParam: Set, p: Pt, fresh: boolean) {
	if (fresh) strokes.length = 0;
	strokes.push({ clear: clearOf(params), pts: [p] });
	setParam('drawn', ++version);
}
export function extendStroke(setParam: Set, p: Pt) {
	const s = strokes[strokes.length - 1];
	if (!s) return;
	const q = s.pts[s.pts.length - 1];
	if (Math.hypot(p.x - q.x, p.y - q.y) < 0.008) return;
	s.pts.push(p);
	setParam('drawn', ++version);
}
type Set = (id: string, value: ParamValue) => void;

export interface Input {
	img: Float32Array;
	/** index in SAMPLES, or -1 for the drawing */
	sample: number;
	/** the true digit, for a test digit */
	label: number | null;
	empty: boolean;
}

const BLANK = new Float32Array(SIDE * SIDE);

/** The digit chosen with the select `id` ('digit' or 'wrong'); drawings centred unless told not. */
export function inputOf(params: Params, id = 'digit'): Input {
	const v = params[id];
	if (v === 'drawn') {
		const st = drawing(params);
		const img = params.centre === false ? drawAsIs(st) : prepare(st);
		return { img: img ?? BLANK, sample: -1, label: null, empty: img === null };
	}
	const i = Number(v);
	const sample = Number.isInteger(i) && i >= 0 && i < SAMPLES.length ? i : 1;
	return { img: samplePixels(sample), sample, label: SAMPLES[sample].label, empty: false };
}

// ---------------------------------------------------------------------------- the filter

export const presetOf = (params: Params): PresetId => {
	const p = params.preset;
	return typeof p === 'string' && p in PRESETS ? (p as PresetId) : 'vertical';
};

/**
 * The editable filter: the chosen preset, with the reader's edits. Edits are stored in
 * `params.kernel` as "preset|reset count|nine values"; they only count for that preset and
 * until the Reset button is pressed again.
 */
export function kernelOf(params: Params): number[] {
	const preset = presetOf(params);
	const v = params.kernel;
	if (typeof v === 'string') {
		const [p, r, csv] = v.split('|');
		if (p === preset && Number(r) === Number(params.reset ?? 0)) {
			const k = csv.split(',').map(Number);
			if (k.length === 9 && k.every(Number.isFinite)) return k;
		}
	}
	return [...PRESETS[preset].k];
}

export function setKernel(params: Params, setParam: Set, k: number[]) {
	setParam('kernel', `${presetOf(params)}|${Number(params.reset ?? 0)}|${k.join(',')}`);
}

// ---------------------------------------------------------------------------- pixel images

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (a: RGB, b: RGB, u: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * u) as RGB;

/**
 * Fixed colours of the pixel images (data URLs cannot read CSS variables), one set per theme,
 * matching the stage: paper = the stage background, ink = the stage ink, and the positive and
 * negative colours of `--cv-pos` / `--cv-neg` in app.css.
 */
const THEME = {
	light: { paper: hex('#ffffff'), ink: hex('#2a2926'), pos: hex('#1c7ed6'), neg: hex('#e8590c') },
	dark: { paper: hex('#0d0e10'), ink: hex('#e4e2dc'), pos: hex('#4dabf7'), neg: hex('#ff922b') }
};

const palettes = new Map<string, RGB[]>();
function palette(kind: 'grey' | 'signed', dark: boolean): RGB[] {
	const key = kind + dark;
	let p = palettes.get(key);
	if (p) return p;
	const c = THEME[dark ? 'dark' : 'light'];
	p = Array.from({ length: 256 }, (_, i) =>
		kind === 'grey'
			? mix(c.paper, c.ink, i / 255)
			: i >= 128
				? mix(c.paper, c.pos, (i - 128) / 127)
				: mix(c.paper, c.neg, (128 - i) / 128)
	);
	palettes.set(key, p);
	return p;
}

/** An 8-bit palette BMP as a data URL (top row first). */
function bmp(width: number, height: number, idx: Uint8Array, pal: RGB[]): string {
	const row = Math.ceil(width / 4) * 4;
	const offset = 14 + 40 + 256 * 4;
	const buf = new Uint8Array(offset + row * height);
	const dv = new DataView(buf.buffer);
	buf[0] = 0x42;
	buf[1] = 0x4d;
	dv.setUint32(2, buf.length, true);
	dv.setUint32(10, offset, true);
	dv.setUint32(14, 40, true);
	dv.setInt32(18, width, true);
	dv.setInt32(22, -height, true);
	dv.setUint16(26, 1, true);
	dv.setUint16(28, 8, true);
	dv.setUint32(34, row * height, true);
	dv.setUint32(46, 256, true);
	pal.forEach(([r, g, b], i) => {
		buf[54 + i * 4] = Math.round(b);
		buf[55 + i * 4] = Math.round(g);
		buf[56 + i * 4] = Math.round(r);
	});
	for (let y = 0; y < height; y++) buf.set(idx.subarray(y * width, (y + 1) * width), offset + y * row);
	let bin = '';
	for (let i = 0; i < buf.length; i += 0x8000)
		bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
	return 'data:image/bmp;base64,' + btoa(bin);
}

/** A grey image, 0 = paper, 1 = ink. */
export function greyUrl(v: ArrayLike<number>, w: number, h: number, dark: boolean): string {
	const idx = Uint8Array.from({ length: w * h }, (_, i) =>
		Math.round(255 * Math.min(1, Math.max(0, v[i])))
	);
	return bmp(w, h, idx, palette('grey', dark));
}

/** A signed map: 0 = paper, +scale = full positive colour, −scale = full negative colour. */
export function signedUrl(
	v: ArrayLike<number>,
	w: number,
	h: number,
	scale: number,
	dark: boolean,
	offset = 0
): string {
	const s = scale > 0 ? scale : 1;
	const idx = Uint8Array.from({ length: w * h }, (_, i) => {
		const u = Math.max(-1, Math.min(1, v[offset + i] / s));
		return u >= 0 ? 128 + Math.round(127 * u) : 128 - Math.round(128 * -u);
	});
	return bmp(w, h, idx, palette('signed', dark));
}

/** Largest |value| of a map (or of a slice of one). */
export function maxAbs(v: ArrayLike<number>, from = 0, to = v.length): number {
	let m = 0;
	for (let i = from; i < to; i++) m = Math.max(m, Math.abs(v[i]));
	return m;
}
