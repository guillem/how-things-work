/**
 * Hand-made 3 × 3 filters for the first chapter, applied to a 28 × 28 grey image with the same
 * convolution as the network (`conv2d` in ./cnn.ts: zero padding, output the same size).
 *
 * Kernels (standard image-processing filters; e.g. Gonzalez & Woods, "Digital Image
 * Processing", 4th ed., ch. 3.5–3.6):
 * - box blur: nine 1s, divided by 9 (the mean of the neighbourhood);
 * - sharpen: 5 at the centre, −1 at the four sides (the image minus its Laplacian);
 * - Sobel: the vertical-edge kernel [−1 0 1; −2 0 2; −1 0 1] and its transpose for
 *   horizontal edges (Sobel & Feldman, 1968);
 * - outline: 8 at the centre, −1 all round (the 8-neighbour Laplacian).
 *
 * The editable cells are whole numbers. As in GIMP's "convolution matrix" filter, the sum is
 * divided by the kernel's total when that total is positive, so a blur keeps the brightness of
 * the image; kernels that add up to 0 (edge detectors) are not divided.
 */
import { SIDE, conv2d } from './cnn.ts';

export const KMIN = -9;
export const KMAX = 9;

export const PRESETS = {
	identity: { name: 'Identity', k: [0, 0, 0, 0, 1, 0, 0, 0, 0] },
	blur: { name: 'Blur', k: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
	sharpen: { name: 'Sharpen', k: [0, -1, 0, -1, 5, -1, 0, -1, 0] },
	vertical: { name: 'Vertical edges', k: [-1, 0, 1, -2, 0, 2, -1, 0, 1] },
	horizontal: { name: 'Horizontal edges', k: [-1, -2, -1, 0, 0, 0, 1, 2, 1] },
	outline: { name: 'Outline', k: [-1, -1, -1, -1, 8, -1, -1, -1, -1] }
} as const;
export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/** The number the sum is divided by: the kernel's total if positive, else 1. */
export const divisor = (k: readonly number[]): number => {
	const s = k.reduce((a, b) => a + b, 0);
	return s > 0 ? s : 1;
};

/** The kernel actually applied: the cells divided by `divisor`. */
export const effective = (k: readonly number[]): number[] => {
	const d = divisor(k);
	return k.map((v) => v / d);
};

/** The filtered image (values can be negative, or above 1). */
export const filter = (img: ArrayLike<number>, k: readonly number[]): Float32Array =>
	conv2d(img, 1, SIDE, SIDE, effective(k), null, 1, 3);

/** The 3 × 3 window of the image around (x, y), zeros outside. */
export function window3(img: ArrayLike<number>, x: number, y: number): number[] {
	const out: number[] = [];
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) {
			const xx = x + dx;
			const yy = y + dy;
			out.push(xx >= 0 && xx < SIDE && yy >= 0 && yy < SIDE ? img[yy * SIDE + xx] : 0);
		}
	return out;
}

/** The image moved by (dx, dy) whole pixels, paper (0) coming in at the edges. */
export function shift(img: ArrayLike<number>, dx: number, dy: number): Float32Array {
	const out = new Float32Array(SIDE * SIDE);
	for (let y = 0; y < SIDE; y++)
		for (let x = 0; x < SIDE; x++) {
			const xx = x - dx;
			const yy = y - dy;
			if (xx >= 0 && xx < SIDE && yy >= 0 && yy < SIDE) out[y * SIDE + x] = img[yy * SIDE + xx];
		}
	return out;
}

/**
 * Weights of a fully connected layer that would map every pixel to every output pixel, against
 * one filter's: why convolution shares one small kernel.
 */
export const denseWeights = (inputs: number, outputs: number) => inputs * outputs;
