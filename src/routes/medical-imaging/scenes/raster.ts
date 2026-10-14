/**
 * Paints a grid of numbers as a grey-scale picture for an SVG `<image>`
 * (canvas → data URL, as in black-holes and waves-interference). Values at or
 * below `lo` are black, at or above `hi` white. Medical images are shown on
 * black in both themes, as on a radiologist's screen.
 */
let canvas: HTMLCanvasElement | null = null;

export function greyImage(
	values: ArrayLike<number>,
	width: number,
	height: number,
	lo: number,
	hi: number
): string {
	if (typeof document === 'undefined') return '';
	canvas ??= document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const img = ctx.createImageData(width, height);
	const px = img.data;
	const span = hi - lo || 1;
	for (let i = 0; i < width * height; i++) {
		const g = Math.round(255 * Math.min(1, Math.max(0, (values[i] - lo) / span)));
		px[4 * i] = g;
		px[4 * i + 1] = g;
		px[4 * i + 2] = g;
		px[4 * i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return canvas.toDataURL();
}

/** Smallest and largest value of a list. */
export function range(values: ArrayLike<number>): [number, number] {
	let lo = Infinity;
	let hi = -Infinity;
	for (let i = 0; i < values.length; i++) {
		if (values[i] < lo) lo = values[i];
		if (values[i] > hi) hi = values[i];
	}
	return [lo, hi];
}
