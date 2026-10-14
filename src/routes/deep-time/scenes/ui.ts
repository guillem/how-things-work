/** Small helpers shared by the deep-time scenes: the timeline's geometry, ticks and colours. */
import { ticks } from '#lib/draw/index.ts';
import type { LifeGroup } from '../deeptime';

/** Left and right ends of the timeline, px. */
export const X0 = 392;
export const X1 = 902;
export const TW = X1 - X0;

/** Timeline x of `age` Ma in a window of `span` Ma ending today. */
export const xOf = (age: number, span: number) => X0 + (1 - age / span) * TW;
/** Age at timeline x. */
export const ageAtX = (x: number, span: number) => (1 - (x - X0) / TW) * span;

/** Tick ages for a window, and how to label them. */
export function axisTicks(span: number): { ticks: { age: number; text: string }[]; unit: string } {
	const yrs = span * 1e6;
	if (span >= 2) {
		return {
			ticks: ticks(0, span, 5)
				.filter((a) => a > 0)
				.map((a) => ({ age: a, text: a.toLocaleString('en-GB') })),
			unit: 'million years ago'
		};
	}
	if (yrs >= 2000) {
		return {
			ticks: ticks(0, yrs / 1000, 5)
				.filter((a) => a > 0)
				.map((a) => ({ age: a / 1000, text: a.toLocaleString('en-GB') })),
			unit: 'thousand years ago'
		};
	}
	return {
		ticks: ticks(0, yrs, 5)
			.filter((a) => a > 0)
			.map((a) => ({ age: a / 1e6, text: a.toLocaleString('en-GB') })),
		unit: 'years ago'
	};
}

/** Dark or light text for a fixed chart colour (relative luminance). */
export function inkOn(hex: string): string {
	const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	const lum = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
	return lum > 0.3 ? '#212529' : '#ffffff';
}

/** Colour token of a group of life. */
export function lifeColor(g: LifeGroup): string {
	if (g.id === 'microbes' || g.id === 'eukaryotes') return 'var(--dt-cells)';
	if (g.id === 'plants' || g.id === 'flowers') return 'var(--dt-plants)';
	if (g.id === 'hominins' || g.id === 'sapiens') return 'var(--dt-humans)';
	return 'var(--dt-animals)';
}

/** A number with thin grouping: 4,567. */
export const n0 = (v: number) => Math.round(v).toLocaleString('en-GB');
