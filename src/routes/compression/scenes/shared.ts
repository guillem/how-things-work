/** What the scenes share: the message and its presets, how symbols are shown, the test images. */
import type { Params } from '#lib/explainer/index.ts';
import { SIZE, bmpDataUrl, makeImage, type Grey, type ImageId } from '../compression';

/** A traditional English tongue-twister: 37 characters, 11 different symbols, skewed counts. */
export const DEFAULT_MESSAGE = 'she sells sea shells by the sea shore';
export const MAX_LENGTH = 40;

export const PRESETS: { label: string; value: string }[] = [
	{ label: 'she sells…', value: DEFAULT_MESSAGE },
	{ label: 'abracadabra', value: 'abracadabra' },
	{ label: 'aaaaaaaaaaaaaaab', value: 'aaaaaaaaaaaaaaab' },
	{ label: 'abcdefghijklmnop', value: 'abcdefghijklmnop' }
];

/** The message from the text box (one param shared by every message step), at most 40 symbols. */
export function messageOf(params: Params): string {
	const v = params.msg;
	const s = typeof v === 'string' ? v : DEFAULT_MESSAGE;
	return [...s].slice(0, MAX_LENGTH).join('');
}

/** A symbol as drawn on the stage: the space as ␣ so it can be seen. */
export const show = (s: string) => (s === ' ' ? '␣' : s);

/** Numbers with up to `d` decimals, without trailing zeros. */
export const fmt = (v: number, d = 2) => String(Number(v.toFixed(d)));

/** Whole numbers with thousands separators. */
export const int = (v: number) => Math.round(v).toLocaleString('en-US');

// ---- images ----------------------------------------------------------------------------------

export const BLOCKS = SIZE / 8;

const images = new Map<ImageId, Grey>();
/** The chosen test image (made once per visit). */
export function imageOf(params: Params): { id: ImageId; img: Grey } {
	const v = params.image;
	const id: ImageId = v === 'drawing' || v === 'noise' ? v : 'landscape';
	let img = images.get(id);
	if (!img) images.set(id, (img = makeImage(id)));
	return { id, img };
}

/** A block worth looking at first in each image: the sun's edge, the ring, anywhere. */
const FIRST_BLOCK: Record<ImageId, number> = { landscape: 19, drawing: 26, noise: 65 };

/** The picked block of an image (each image remembers its own, in `params['block-' + id]`). */
export function blockOf(params: Params, id: ImageId): { index: number; bx: number; by: number } {
	const v = params[`block-${id}`];
	const index =
		typeof v === 'number' && v >= 0 && v < BLOCKS * BLOCKS ? Math.round(v) : FIRST_BLOCK[id];
	return { index, bx: index % BLOCKS, by: Math.floor(index / BLOCKS) };
}

/** A grey image of any size (e.g. one 8 × 8 block) from pixel values, as a data URL. */
export function greyUrl(width: number, height: number, values: ArrayLike<number>): string {
	const data = Uint8Array.from(values, (v) => Math.min(255, Math.max(0, Math.round(v))));
	return bmpDataUrl({ width, height, data });
}
