/** Number formatting for the readouts. */

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** An integer as a superscript: −21 → ⁻²¹. */
export const sup = (n: number) =>
	String(n)
		.split('')
		.map((c) => (c === '-' ? '⁻' : SUP[Number(c)]))
		.join('');

/** Scientific notation with unicode: 1.8 × 10⁴⁸ (plain digits for 0.01–9999). */
export function sci(v: number, digits = 2) {
	if (v === 0 || !Number.isFinite(v)) return String(v);
	const a = Math.abs(v);
	if (a >= 0.01 && a < 1e4) return String(Number(v.toPrecision(digits)));
	let e = Math.floor(Math.log10(a));
	let m = v / 10 ** e;
	if (Math.abs(Number(m.toPrecision(digits))) >= 10) {
		e += 1;
		m /= 10;
	}
	return `${m.toPrecision(digits)} × 10${sup(e)}`;
}

/** A whole number with thin-space thousands: 12 345. */
export const whole = (v: number) => Math.round(v).toLocaleString('en').replace(/,/g, ' ');
