/**
 * One pattern of bits, read in several ways.
 *
 * Bits are stored most significant first (bits[0] is the leftmost, worth the
 * most). Widths are 8, 16 or 32 bits. All readings are the standard ones:
 * unsigned binary; two's complement for signed whole numbers; one character
 * per byte (ASCII, extended to Latin-1 above 127); colours as RGB 3-3-2
 * (8 bits), RGB 5-6-5 (16 bits) and RGBA 8-8-8-8 (32 bits); IEEE 754 floating
 * point in half (16-bit) and single (32-bit) precision.
 */

export type Width = 8 | 16 | 32;
export type Bits = number[]; // 0 or 1, most significant first

export const WIDTHS: Width[] = [8, 16, 32];

/** The bits of a whole number (taken modulo 2^width). */
export function toBits(value: number, width: Width): Bits {
	const v = ((Math.trunc(value) % 2 ** width) + 2 ** width) % 2 ** width;
	return Array.from({ length: width }, (_, i) => Math.floor(v / 2 ** (width - 1 - i)) % 2);
}

/** Unsigned value: each bit times its place value (1, 2, 4, …), added up. */
export const unsigned = (bits: Bits) => bits.reduce((v, b) => v * 2 + b, 0);

/** Place value of bit i (counted from the left) in a word of this width. */
export const placeValue = (i: number, width: number) => 2 ** (width - 1 - i);

/** Two's complement: the leftmost bit is worth −2^(width−1) instead of +2^(width−1). */
export const signed = (bits: Bits) => unsigned(bits) - (bits[0] ? 2 ** bits.length : 0);

/** The bits as hexadecimal digits, 4 bits per digit. */
export const hex = (bits: Bits) =>
	Array.from({ length: bits.length / 4 }, (_, k) =>
		unsigned(bits.slice(4 * k, 4 * k + 4))
			.toString(16)
			.toUpperCase()
	).join('');

/** Splits a word into bytes (most significant first). */
export const bytes = (bits: Bits) =>
	Array.from({ length: bits.length / 8 }, (_, k) => unsigned(bits.slice(8 * k, 8 * k + 8)));

// ------------------------------------------------------------ text

const CONTROL = [
	'NUL',
	'SOH',
	'STX',
	'ETX',
	'EOT',
	'ENQ',
	'ACK',
	'BEL',
	'BS',
	'TAB',
	'LF',
	'VT',
	'FF',
	'CR',
	'SO',
	'SI',
	'DLE',
	'DC1',
	'DC2',
	'DC3',
	'DC4',
	'NAK',
	'SYN',
	'ETB',
	'CAN',
	'EM',
	'SUB',
	'ESC',
	'FS',
	'GS',
	'RS',
	'US'
];

export interface CharReading {
	/** What to show: the character, or the name of a control code ("LF"). */
	text: string;
	kind: 'printable' | 'space' | 'control' | 'latin1';
}

/**
 * A byte as a character: ASCII for 0–127 (codes below 32 and 127 are control
 * codes with names, not visible characters), Latin-1 for 128–255 (128–159 are
 * control codes too).
 */
export function char(byte: number): CharReading {
	if (byte < 32) return { text: CONTROL[byte], kind: 'control' };
	if (byte === 32) return { text: 'space', kind: 'space' };
	if (byte === 127) return { text: 'DEL', kind: 'control' };
	if (byte < 127) return { text: String.fromCharCode(byte), kind: 'printable' };
	if (byte < 160) return { text: `C1 ${byte.toString(16).toUpperCase()}`, kind: 'control' };
	if (byte === 160) return { text: 'nbsp', kind: 'space' };
	return { text: String.fromCharCode(byte), kind: 'latin1' };
}

// ------------------------------------------------------------ colour

export interface Colour {
	r: number;
	g: number;
	b: number;
	/** 0–1 */
	a: number;
	/** How the bits are split, e.g. [3, 3, 2] for R, G, B (and A). */
	split: number[];
	css: string;
}

/** Scales an n-bit channel to 0–255 (all ones → 255). */
const channel = (bits: Bits) => Math.round((unsigned(bits) * 255) / (2 ** bits.length - 1));

/**
 * The bits as a colour: 8 bits = RGB 3-3-2, 16 bits = RGB 5-6-5 (green gets
 * the extra bit, as the eye is most sensitive to it), 32 bits = RGBA 8-8-8-8.
 */
export function colour(bits: Bits): Colour {
	const split = bits.length === 8 ? [3, 3, 2] : bits.length === 16 ? [5, 6, 5] : [8, 8, 8, 8];
	const parts: number[] = [];
	let at = 0;
	for (const n of split) {
		parts.push(channel(bits.slice(at, at + n)));
		at += n;
	}
	const [r, g, b, alpha = 255] = parts;
	const a = alpha / 255;
	return { r, g, b, a, split, css: `rgb(${r} ${g} ${b} / ${+a.toFixed(3)})` };
}

// ------------------------------------------------------------ floating point

export interface FloatReading {
	sign: number;
	/** Exponent field as stored, and with the bias removed. */
	exponentBits: number;
	exponent: number;
	/** Fraction field as stored (the bits after the binary point). */
	fractionBits: number;
	/** 1.fraction for normal numbers, 0.fraction for subnormal ones. */
	significand: number;
	value: number;
	kind: 'zero' | 'subnormal' | 'normal' | 'infinity' | 'nan';
	/** Field sizes: [sign, exponent, fraction]. */
	split: [number, number, number];
}

/**
 * IEEE 754 binary floating point: 16 bits = half precision (1 sign, 5
 * exponent, 10 fraction bits, bias 15), 32 bits = single (1, 8, 23, bias 127).
 * Not defined for 8 bits.
 */
export function float(bits: Bits): FloatReading | null {
	const split: [number, number, number] | null =
		bits.length === 16 ? [1, 5, 10] : bits.length === 32 ? [1, 8, 23] : null;
	if (!split) return null;
	const [, eBits, fBits] = split;
	const bias = 2 ** (eBits - 1) - 1;
	const sign = bits[0];
	const exponentBits = unsigned(bits.slice(1, 1 + eBits));
	const fractionBits = unsigned(bits.slice(1 + eBits));
	const frac = fractionBits / 2 ** fBits;
	const s = sign ? -1 : 1;
	const maxE = 2 ** eBits - 1;
	if (exponentBits === maxE)
		return {
			sign,
			exponentBits,
			exponent: exponentBits - bias,
			fractionBits,
			significand: 1 + frac,
			value: fractionBits ? NaN : s * Infinity,
			kind: fractionBits ? 'nan' : 'infinity',
			split
		};
	if (exponentBits === 0)
		return {
			sign,
			exponentBits,
			exponent: 1 - bias,
			fractionBits,
			significand: frac,
			value: s * frac * 2 ** (1 - bias),
			kind: fractionBits ? 'subnormal' : 'zero',
			split
		};
	return {
		sign,
		exponentBits,
		exponent: exponentBits - bias,
		fractionBits,
		significand: 1 + frac,
		value: s * (1 + frac) * 2 ** (exponentBits - bias),
		kind: 'normal',
		split
	};
}

/** The bits of the 32-bit float nearest to x (as the computer stores it). */
export function float32Bits(x: number): Bits {
	const view = new DataView(new ArrayBuffer(4));
	view.setFloat32(0, x);
	return toBits(view.getUint32(0), 32);
}

/** The 16-bit (half-precision) float nearest to x, rounding to nearest, ties to even. */
export function float16Bits(x: number): Bits {
	// Search the 65 536 patterns' ordering: build from sign/exponent/fraction directly.
	if (Number.isNaN(x)) return toBits(0x7e00, 16);
	const sign = x < 0 || Object.is(x, -0) ? 1 : 0;
	let a = Math.abs(x);
	if (a >= 65520) return toBits((sign << 15) | 0x7c00, 16); // rounds to infinity
	if (a < 2 ** -24 / 2) return toBits(sign << 15, 16);
	let e = Math.floor(Math.log2(a));
	if (2 ** e > a) e--; // guard against log2 rounding
	let exponentBits: number;
	let fraction: number;
	if (e < -14) {
		exponentBits = 0;
		fraction = roundEven(a / 2 ** -24);
	} else {
		exponentBits = e + 15;
		fraction = roundEven((a / 2 ** e - 1) * 1024);
		if (fraction === 1024) {
			fraction = 0;
			exponentBits++;
		}
		if (exponentBits >= 31) return toBits((sign << 15) | 0x7c00, 16);
	}
	if (exponentBits === 0 && fraction === 1024) {
		exponentBits = 1;
		fraction = 0;
	}
	a = (sign << 15) | (exponentBits << 10) | fraction;
	return toBits(a, 16);
}

function roundEven(v: number) {
	const f = Math.floor(v);
	const d = v - f;
	if (d > 0.5) return f + 1;
	if (d < 0.5) return f;
	return f % 2 === 0 ? f : f + 1;
}

// ------------------------------------------------------------ adding

export interface Sum {
	/** Result bits (width bits; the carry out of the top is lost). */
	bits: Bits;
	/** carries[i] = carry INTO column i (from the column to its right); carries[width] = 0. */
	carries: number[];
	/** The carry out of the leftmost column (lost: unsigned overflow). */
	carryOut: number;
	/** Unsigned overflow: the true sum doesn't fit (it wrapped round past 2^width − 1). */
	unsignedOverflow: boolean;
	/** Signed overflow: both inputs have the same sign and the result's sign differs. */
	signedOverflow: boolean;
}

/** Adds two words column by column from the right, as on paper. */
export function add(a: Bits, b: Bits): Sum {
	const w = a.length;
	const bits = new Array(w).fill(0);
	const carries = new Array(w + 1).fill(0);
	let carry = 0;
	for (let i = w - 1; i >= 0; i--) {
		carries[i] = carry;
		const s = a[i] + b[i] + carry;
		bits[i] = s % 2;
		carry = s >= 2 ? 1 : 0;
	}
	// carries[i] = carry into column i; the carry into the rightmost column is 0.
	carries[w] = 0;
	return {
		bits,
		carries,
		carryOut: carry,
		unsignedOverflow: carry === 1,
		signedOverflow: a[0] === b[0] && bits[0] !== a[0]
	};
}

/** Text form for params: the bits as a string of 0s and 1s. */
export const bitString = (bits: Bits) => bits.join('');

export function parseBits(s: unknown, width?: Width): Bits | null {
	if (typeof s !== 'string' || !/^[01]+$/.test(s)) return null;
	if (![8, 16, 32].includes(s.length)) return null;
	if (width && s.length !== width) return null;
	return [...s].map(Number);
}

/** Resizes a pattern to another width, keeping its unsigned value where it fits (low bits). */
export const resize = (bits: Bits, width: Width) => toBits(unsigned(bits), width);
