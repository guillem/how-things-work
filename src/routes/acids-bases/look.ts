/** Shared formatting and drawing helpers for the acids and bases scenes. */

/** Small deterministic pseudo-random generator (mulberry32), for fixed dot spots. */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let x = a;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

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
	return String(Math.round(n))
		.split('')
		.map((c) => SUP[c] ?? c)
		.join('');
}

/** Groups digits with thin spaces: 60221 → "60 221". */
function group(n: number): string {
	return Math.round(n)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * A count of ions in words a reader can picture: "60", "6 000", "600 million",
 * "0.06", and powers of ten for the tiny averages ("6 × 10⁻⁷").
 */
export function fmtCount(n: number): string {
	// Two significant figures: the counts are averages, and 60, 600, 6 000 read best.
	if (n >= 1e9) return `${Number((n / 1e9).toPrecision(2))} billion`;
	if (n >= 1e6) return `${Number((n / 1e6).toPrecision(2))} million`;
	if (n >= 10) return group(Number(n.toPrecision(2)));
	if (n >= 1) return n.toFixed(0);
	if (n >= 0.001) return Number(n.toPrecision(1)).toString();
	if (n <= 0) return '0';
	const e = Math.floor(Math.log10(n));
	const m = Math.round(n / 10 ** e);
	return `${m} × 10${superscript(e)}`;
}

/** "10 000 times", "50 times", for comparing H⁺ counts. */
export function fmtTimes(f: number): string {
	if (f >= 1e6) return `${fmtCount(Number(f.toPrecision(2)))}`;
	if (f >= 10) return group(Number(f.toPrecision(2)));
	return Number(f.toPrecision(2)).toString();
}

/** Volume in mL with two decimals, as a burette is read. */
export const ml = (v: number) => `${v.toFixed(2)} mL`;
