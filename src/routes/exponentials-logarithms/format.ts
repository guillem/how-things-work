/** Number formats shared by the narrative's controls and the scenes. */

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

/** "10⁶", "10⁻³": a power of ten in superscript. */
export const pow10 = (e: number) =>
	`10${String(e)
		.split('')
		.map((c) => SUP[c] ?? c)
		.join('')}`;

/** A minus sign rather than a hyphen. */
const minus = (s: string) => s.replace('-', '−');

/**
 * A count or amount for a reader: 3 significant figures below 1,000, whole numbers with
 * separators up to ten million, and "4.7 × 10²¹" beyond (or for tiny values).
 */
export function fmt(v: number): string {
	if (!Number.isFinite(v)) return '∞';
	const a = Math.abs(v);
	if (a === 0) return '0';
	if (a >= 1e7 || a < 1e-3) {
		const e = Math.floor(Math.log10(a));
		const m = v / 10 ** e;
		return `${minus(m.toFixed(1))} × ${pow10(e)}`;
	}
	if (a >= 1000) return minus(Math.round(v).toLocaleString('en-US'));
	return minus(Number(v.toPrecision(3)).toLocaleString('en-US', { maximumFractionDigits: 3 }));
}

/** A length given in millimetres, in the unit a reader would use (mm, cm, m, km). */
export function length(mm: number): string {
	if (mm < 10) return `${fmt(mm)} mm`;
	if (mm < 1000) return `${fmt(mm / 10)} cm`;
	if (mm < 1e6) return `${fmt(mm / 1000)} m`;
	return `${fmt(mm / 1e6)} km`;
}

/** A growth factor as "×1.05". */
export const times = (f: number) => `×${Number(f.toFixed(2))}`;
