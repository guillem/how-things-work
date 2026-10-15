/** Geometry of the CRISPR array strip (`ArrayStrip.svelte`), shared by the scenes. */
export interface StripSpacer {
	key: string;
	label?: string;
	color: string;
	/** Drawn as an empty dashed slot (a removed spacer). */
	ghost?: boolean;
	opacity?: number;
}

/** Widths of the parts of a strip at scale 1. */
export const STRIP = { leader: 64, repeat: 20, spacer: 56, h: 28 };

/** Total width of a strip with `n` spacers at scale `s` (`grow` of the first one). */
export const stripWidth = (n: number, s = 1, leader = true, grow = 1) =>
	((leader ? STRIP.leader : 0) +
		STRIP.repeat +
		Math.max(0, n - 1) * (STRIP.spacer + STRIP.repeat) +
		(n > 0 ? grow * (STRIP.spacer + STRIP.repeat) : 0)) *
	s;

/** x of the centre of spacer `i` in a strip starting at `x`. */
export const spacerX = (x: number, i: number, s = 1, leader = true, grow = 1) => {
	const first = (leader ? STRIP.leader : 0) + STRIP.repeat;
	if (i === 0) return x + (first + (grow * STRIP.spacer) / 2) * s;
	return (
		x +
		(first +
			grow * (STRIP.spacer + STRIP.repeat) +
			(i - 1) * (STRIP.spacer + STRIP.repeat) +
			STRIP.spacer / 2) *
			s
	);
};
