/**
 * The moths' own wing colours (fixed, not theme colours): `u` 0 is the palest
 * wing, 1 the darkest. A gamma below 1 darkens the middle shades, so that a
 * moth halfway along the scale already looks mid-grey to the eye.
 */
const PALE = [239, 233, 216];
const DARK = [31, 29, 27];

export function wingColour(u: number): string {
	const v = Math.pow(Math.min(1, Math.max(0, u)), 0.75);
	return `rgb(${PALE.map((p, i) => Math.round(p + (DARK[i] - p) * v)).join(',')})`;
}
