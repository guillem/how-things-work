/** What the scenes share: the message and its presets, how symbols are shown, the test images. */
import type { Params } from '#lib/explainer/index.ts';
import { SIZE, bmpDataUrl, lumaOf, makeImage, type Grey, type ImageId } from '../compression';

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

/** A test image, or the reader's own picture ('own'). */
export type PictureId = ImageId | 'own';

const images = new Map<ImageId, Grey>();
/** The reader's own picture, once loaded (it never leaves the browser). */
let own: Grey | null = null;
let ownCount = 0;

/**
 * The chosen picture (test images are made once per visit). 'own' falls back to the landscape
 * until a picture is loaded (`missing` is then true), e.g. after a reload.
 */
export function imageOf(params: Params): { id: PictureId; img: Grey; missing: boolean } {
	const v = params.image;
	// Read the load counter, so that a second picture replaces the first on the stage.
	if (v === 'own' && own && params.own === ownCount) return { id: 'own', img: own, missing: false };
	const id: ImageId = v === 'drawing' || v === 'noise' ? v : 'landscape';
	let img = images.get(id);
	if (!img) images.set(id, (img = makeImage(id)));
	return { id, img, missing: v === 'own' };
}

/**
 * Decodes a picture file in the browser: the largest centred square, scaled to 96 × 96 (over
 * white, for transparent pictures) and turned to grey. Returns the value to store in
 * `params.own` (with `params.image = 'own'`), or throws if the file is not a picture.
 */
export async function loadPicture(file: Blob): Promise<number> {
	const bitmap = await createImageBitmap(file);
	const side = Math.min(bitmap.width, bitmap.height);
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx || side === 0) throw new Error('cannot draw the picture');
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, SIZE, SIZE);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(
		bitmap,
		(bitmap.width - side) / 2,
		(bitmap.height - side) / 2,
		side,
		side,
		0,
		0,
		SIZE,
		SIZE
	);
	bitmap.close();
	own = lumaOf(SIZE, SIZE, ctx.getImageData(0, 0, SIZE, SIZE).data);
	return ++ownCount;
}

/** A block worth looking at first in each image: the sun's edge, the ring, anywhere. */
const FIRST_BLOCK: Record<PictureId, number> = { landscape: 19, drawing: 26, noise: 65, own: 65 };

/** The picked block of an image (each image remembers its own, in `params['block-' + id]`). */
export function blockOf(params: Params, id: PictureId): { index: number; bx: number; by: number } {
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
