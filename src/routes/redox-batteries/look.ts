/** Shared formatting for the redox and batteries scenes. */

const SUP: Record<string, string> = {
	'-': '⁻',
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹'
};
/** An integer written in superscript digits: −7 → ⁻⁷. */
export function superscript(n: number): string {
	return String(Math.round(n) === 0 ? 0 : Math.round(n))
		.split('')
		.map((c) => SUP[c] ?? c)
		.join('');
}

/** A voltage: "1.104 V". */
export const fmtV = (v: number, digits = 2) => `${(Math.abs(v) < 5e-4 ? 0 : v).toFixed(digits)} V`;

/**
 * A concentration in mol/L: "1.00 mol/L", "0.010 mol/L", and powers of ten below 0.001
 * ("2 × 10⁻³⁷ mol/L"). `logC` gives the exponent when the value itself underflows.
 */
export function fmtConc(c: number, logC?: number, unit = true): string {
	const u = unit ? ' mol/L' : '';
	const lg = logC ?? Math.log10(Math.max(c, 1e-300));
	if (lg >= -3 - 1e-9) {
		const s = c >= 0.1 ? c.toFixed(2) : Number(c.toPrecision(2)).toString();
		return `${s}${u}`;
	}
	let e = Math.floor(lg);
	let mm = Math.round(10 ** (lg - e));
	if (mm === 10) {
		mm = 1;
		e += 1;
	}
	return mm === 1 ? `10${superscript(e)}${u}` : `${mm} × 10${superscript(e)}${u}`;
}
