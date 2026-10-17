/**
 * Pictures of the photograph's tensor operations for the image scene, as BMP data URLs (one
 * `<image>` each instead of thousands of shapes). Everything is computed from the real array
 * with the operations of `tensor.ts`.
 */
import {
	contractLast,
	macaw,
	meanOver,
	reshape,
	rgbBmpUrl,
	slice,
	tintedBmpUrl,
	transpose,
	type Tensor
} from './tensor';

export const photo = macaw();
export const H = photo.shape[0];
export const W = photo.shape[1];

/** Pure red, green and blue: what each channel's number controls. */
export const TINTS = [
	[255, 0, 0],
	[0, 255, 0],
	[0, 0, 255]
] as const;

let colour: string | null = null;
export const colourUrl = () => (colour ??= rgbBmpUrl(W, H, photo.data));

const tinted: (string | null)[] = [null, null, null];
/** Channel c drawn in its own colour (0 = black, 255 = full red, green or blue). */
export const tintUrl = (c: number) =>
	(tinted[c] ??= tintedBmpUrl(W, H, slice(photo, 2, c).data, TINTS[c]));

const greys: (string | null)[] = [null, null, null];
/** Channel c as a matrix of numbers, drawn in grey (0 black, 255 white). */
export const channelGreyUrl = (c: number) =>
	(greys[c] ??= tintedBmpUrl(W, H, slice(photo, 2, c).data));

/**
 * An (n, 3) matrix of pixel values (one row per pixel) drawn as an image 3 cells wide and n
 * tall, each column in its channel's colour.
 */
function pixelsUrl(m: Tensor): string {
	const n = m.shape[0];
	const rgb = new Float64Array(n * 3 * 3);
	for (let p = 0; p < n; p++)
		for (let c = 0; c < 3; c++) {
			const v = m.data[p * 3 + c] / 255;
			for (let k = 0; k < 3; k++) rgb[(p * 3 + c) * 3 + k] = v * TINTS[c][k];
		}
	return rgbBmpUrl(3, n, rgb);
}

/** The colours of an (n, 3) matrix as a strip of n swatches, `across` or down. */
function swatchesUrl(m: Tensor, across: boolean): string {
	const n = m.shape[0];
	return across ? rgbBmpUrl(n, 1, m.data) : rgbBmpUrl(1, n, m.data);
}

export type SliceAxis = 'height' | 'width' | 'channel';
const AXIS_INDEX: Record<SliceAxis, number> = { height: 0, width: 1, channel: 2 };

/** The slice and its picture. */
export function sliceOf(axis: SliceAxis, i: number) {
	const s = slice(photo, AXIS_INDEX[axis], i);
	return { tensor: s, href: axis === 'channel' ? channelGreyUrl(i) : pixelsUrl(s) };
}

/** The photo reshaped to (3, 48, 36): layer k is numbers 1728·k … 1728·k + 1727, read as grey. */
const reshaped = reshape(photo, [3, H, W]);
/** The photo transposed to channels first: layer k is channel k. */
export const transposed = transpose(photo, [2, 0, 1]);

const reshapedUrls: (string | null)[] = [null, null, null];
export const reshapedUrl = (k: number) =>
	(reshapedUrls[k] ??= tintedBmpUrl(W, H, reshaped.data.subarray(k * H * W, (k + 1) * H * W)));

/** The stored list of 5184 numbers as one long strip (each number in its channel's colour). */
let flat: string | null = null;
export const flatUrl = () => (flat ??= pixelsUrlRow());
function pixelsUrlRow(): string {
	const n = photo.data.length;
	const rgb = new Float64Array(n * 3);
	for (let o = 0; o < n; o++) {
		const c = o % 3;
		for (let k = 0; k < 3; k++) rgb[o * 3 + k] = (photo.data[o] / 255) * TINTS[c][k];
	}
	return rgbBmpUrl(n, 1, rgb);
}

/** The pixel list (1728, 3), and its picture. */
const pixelList = reshape(photo, [H * W, 3]);
let pixelListPic: string | null = null;
export const pixelListUrl = () => (pixelListPic ??= pixelsUrl(pixelList));

/** Grey from weights on the channel axis (values clamped to 0–255 for the picture). */
export function greyOf(weights: readonly [number, number, number]) {
	const g = contractLast(photo, [...weights]);
	return { tensor: g, href: tintedBmpUrl(W, H, g.data) };
}

export type Combine = 'c' | 'h' | 'w' | 'hw' | 'hwc';
const AXES: Record<Combine, number[]> = { c: [2], h: [0], w: [1], hw: [0, 1], hwc: [0, 1, 2] };
const means = new Map<Combine, { tensor: Tensor; href: string }>();
/** Averages over the chosen axes, with a picture of the result. */
export function averageOf(kind: Combine) {
	const hit = means.get(kind);
	if (hit) return hit;
	const m = meanOver(photo, AXES[kind]);
	const href =
		kind === 'c'
			? tintedBmpUrl(W, H, m.data)
			: kind === 'h'
				? swatchesUrl(m, true)
				: kind === 'w'
					? swatchesUrl(m, false)
					: kind === 'hw'
						? rgbBmpUrl(1, 1, m.data)
						: rgbBmpUrl(1, 1, [m.data[0], m.data[0], m.data[0]]);
	const out = { tensor: m, href };
	means.set(kind, out);
	return out;
}
