/** Number formatting for the readouts. */

const minus = (x: number) => (x < 0 ? '−' : '');

/** A force: "850 N", "2.07 kN", "11.3 kN". */
export function fmtForce(n: number) {
	const a = Math.abs(n);
	if (a < 1000) return `${minus(n)}${a.toFixed(0)} N`;
	return `${minus(n)}${(a / 1000).toFixed(a < 10000 ? 2 : 1)} kN`;
}

/** A pressure: "850 Pa", "−2.1 kPa". */
export function fmtPa(n: number) {
	const a = Math.abs(n);
	if (a < 1000) return `${minus(n)}${a.toFixed(0)} Pa`;
	return `${minus(n)}${(a / 1000).toFixed(a < 10000 ? 2 : 1)} kPa`;
}

/** A decimal with a true minus sign, and none for a value that rounds to zero. */
export function signed(x: number, d = 2) {
	const s = Math.abs(x).toFixed(d);
	return `${Number(s) === 0 ? '' : minus(x)}${s}`;
}

/** Degrees with a true minus sign. */
export const deg = (x: number, d = 1) => `${signed(x, d)}°`;
