/**
 * UPC-A barcodes (the GS1 12-digit code on products in North America and elsewhere): 95 narrow
 * "modules", each dark or light. A start mark (101), six left digits of 7 modules, a middle mark
 * (01010), six right digits and an end mark (101). Each digit is two bars and two gaps whose
 * widths add up to 7 modules. Left digits use the L codes (odd number of dark modules), right
 * digits the R codes (the L codes with dark and light swapped, so an even number), which is how a
 * scanner tells which way round it read. The 12th digit is a check digit.
 */

/** L codes for the left half, by digit (1 = dark module). */
export const L_CODES = [
	'0001101',
	'0011001',
	'0010011',
	'0111101',
	'0100011',
	'0110001',
	'0101111',
	'0111011',
	'0110111',
	'0001011'
];
/** R codes for the right half: the L codes with dark and light swapped. */
export const R_CODES = L_CODES.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''));
export const START = '101';
export const MIDDLE = '01010';
export const END = '101';

/** The check digit of the first 11 digits: 3 x (odd positions) + (even positions), up to a multiple of 10. */
export function checkDigit(first11: readonly number[]) {
	const sum = first11.reduce((a, d, i) => a + (i % 2 === 0 ? 3 * d : d), 0);
	return (10 - (sum % 10)) % 10;
}

export const isValid = (digits: readonly number[]) =>
	digits.length === 12 && checkDigit(digits.slice(0, 11)) === digits[11];

/** The 95 modules of a 12-digit code, as a string of 0s and 1s. */
export function encode(digits: readonly number[]): string {
	return (
		START +
		digits
			.slice(0, 6)
			.map((d) => L_CODES[d])
			.join('') +
		MIDDLE +
		digits
			.slice(6)
			.map((d) => R_CODES[d])
			.join('') +
		END
	);
}

/** Runs of equal modules: [dark?, width in modules]. */
export function runs(modules: string): [boolean, number][] {
	const out: [boolean, number][] = [];
	for (const m of modules) {
		const dark = m === '1';
		if (out.length && out[out.length - 1][0] === dark) out[out.length - 1][1]++;
		else out.push([dark, 1]);
	}
	return out;
}

/**
 * What a scanner sees sweeping across the code: how long each stripe stays under the line, in
 * whatever units of time. A slower sweep or a slanted one stretches every stripe by the same
 * factor; reading it upside down reverses the order.
 */
export function sweep(modules: string, { stretch = 1, reversed = false } = {}) {
	const r = runs(modules).map(([dark, w]) => [dark, w * stretch] as [boolean, number]);
	return reversed ? r.reverse() : r;
}

export interface Reading {
	digits: number[] | null;
	reversed: boolean;
	valid: boolean;
	/** Why the reading failed, if it did. */
	problem?: string;
}

/**
 * Reads a sweep: the 95 modules span the whole thing, so one module is the total length over 95
 * (only proportions matter); each run is rounded to whole modules, the guards are checked, each
 * group of 7 modules is looked up, and the parity of the left groups says which way round it was.
 */
export function read(sweepRuns: readonly [boolean, number][]): Reading {
	const total = sweepRuns.reduce((a, [, w]) => a + w, 0);
	const unit = total / 95;
	const modules = sweepRuns
		.map(([dark, w]) => (dark ? '1' : '0').repeat(Math.max(1, Math.round(w / unit))))
		.join('');
	if (modules.length !== 95)
		return { digits: null, reversed: false, valid: false, problem: 'stripe widths do not add up' };
	const tryRead = (m: string) => {
		if (m.slice(0, 3) !== START || m.slice(45, 50) !== MIDDLE || m.slice(92) !== END) return null;
		const digits: number[] = [];
		for (let k = 0; k < 6; k++) digits.push(L_CODES.indexOf(m.slice(3 + 7 * k, 10 + 7 * k)));
		for (let k = 0; k < 6; k++) digits.push(R_CODES.indexOf(m.slice(50 + 7 * k, 57 + 7 * k)));
		return digits;
	};
	let reversed = false;
	let digits = tryRead(modules);
	// Upside down, the left groups read backwards don't match any L code; read the string reversed.
	if (!digits || digits.includes(-1)) {
		const back = [...modules].reverse().join('');
		const d2 = tryRead(back);
		if (d2 && !d2.includes(-1)) {
			digits = d2;
			reversed = true;
		}
	}
	if (!digits)
		return {
			digits: null,
			reversed,
			valid: false,
			problem: 'the start, middle or end mark is wrong'
		};
	if (digits.includes(-1))
		return { digits, reversed, valid: false, problem: 'a group of stripes is not a digit' };
	return {
		digits,
		reversed,
		valid: isValid(digits),
		problem: isValid(digits) ? undefined : 'the check digit does not match'
	};
}

/** Smudge: the k-th stripe (counting runs from the left) made one module wider, its neighbour narrower. */
export function smudge(modules: string, k: number): string {
	const r = runs(modules);
	if (k < 0 || k + 1 >= r.length || r[k + 1][1] < 2) return modules;
	r[k][1] += 1;
	r[k + 1][1] -= 1;
	return r.map(([dark, w]) => (dark ? '1' : '0').repeat(w)).join('');
}

/**
 * A misprint: in the given digit group (0-11), one bar printed one column to the side, if that
 * turns the group into another valid digit. Returns the new modules and the digit it now reads,
 * or null when no such move exists. (A single smudged edge never does this: the codes are chosen
 * so that one shifted edge never makes another digit, so smudges are caught by the patterns
 * alone; a whole bar out of place can make another digit, and only the check digit catches it.)
 */
export function misprint(
	modules: string,
	group: number
): { modules: string; reads: number } | null {
	const at = group < 6 ? 3 + 7 * group : 50 + 7 * (group - 6);
	const codes = group < 6 ? L_CODES : R_CODES;
	const code = modules.slice(at, at + 7);
	const dark = group < 6 ? '1' : '0';
	for (let i = 0; i < 7; i++) {
		if (code[i] !== dark || (i > 0 && code[i - 1] === dark)) continue;
		let j = i;
		while (j < 7 && code[j] === dark) j++;
		// The bar covers columns i..j-1; move it one column left or right.
		for (const d of [-1, 1]) {
			const lo = i + d;
			const hi = j + d;
			if (lo < 0 || hi > 7) continue;
			const cells = [...code].map((c) => (c === dark ? (dark === '1' ? '0' : '1') : c));
			for (let k = 0; k < 7; k++) if (code[k] === dark && (k < i || k >= j)) cells[k] = dark;
			for (let k = lo; k < hi; k++) cells[k] = dark;
			const moved = cells.join('');
			const reads = codes.indexOf(moved);
			if (reads >= 0 && moved !== code)
				return { modules: modules.slice(0, at) + moved + modules.slice(at + 7), reads };
		}
	}
	return null;
}
