/**
 * Cryptography on small numbers: a one-time-pad XOR, the paint-mixing picture of a key
 * exchange, Diffie–Hellman on the 101-hour clock, SHA-256 (the real thing), the avalanche
 * effect, and a toy RSA signature.
 *
 * Simplifications, stated on the page:
 * - Paint: a paint is a colour, and a mixture is a set of equal-weight parts of base paints.
 *   The colour of a mixture is the weighted geometric mean of its paints' reflectance in each
 *   of the red, green and blue channels (in linear light). That is a crude subtractive model
 *   (real pigments need Kubelka–Munk theory), but it has the one property the story needs:
 *   the colour depends only on the proportions, not on the order of mixing.
 * - Diffie–Hellman uses the prerequisite's clock: p = 101, g = 2 (a primitive root mod 101,
 *   checked in the tests). Real groups use primes of 2048 bits or more (RFC 3526 group 14;
 *   NIST SP 800-57 Part 1 Rev. 5, Table 2: 2048-bit finite-field and RSA keys give about
 *   112 bits of security).
 * - SHA-256 is implemented exactly as in FIPS 180-4 (August 2015) and checked against its
 *   published examples and Node's own implementation.
 * - RSA: the classic textbook example p = 61, q = 53 (n = 3233, e = 17, d = 2753, using
 *   φ(n) = 3120, as in older editions of the Wikipedia article on RSA; it now uses
 *   λ(n) = 780, d = 413). The message's SHA-256 digest is reduced mod n and signed
 *   directly ("textbook RSA"); real signatures use 2048-bit or larger n and a padding scheme
 *   such as RSA-PSS (RFC 8017).
 * - All products stay below 2⁵³, so plain JavaScript numbers are exact.
 */
import { discreteLog, fastPower, gcd, mod } from '../primes-modular-arithmetic/modular';

// ---------------------------------------------------------------- bytes and bits

const encoder = new TextEncoder();
/** UTF-8 bytes of a string. */
export const utf8 = (s: string) => encoder.encode(s);

/** "01001000" for 72. */
export const bits8 = (b: number) => b.toString(2).padStart(8, '0');

/** Lower-case hex of a byte array. */
export const toHex = (bytes: Uint8Array) =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** The 8·n bits of a byte array, most significant bit of byte 0 first. */
export function toBits(bytes: Uint8Array): number[] {
	const out: number[] = [];
	for (const b of bytes) for (let i = 7; i >= 0; i--) out.push((b >> i) & 1);
	return out;
}

/** Number of bit positions where two equal-length byte arrays differ. */
export function bitDistance(a: Uint8Array, b: Uint8Array): number {
	let n = 0;
	for (let i = 0; i < a.length; i++) {
		let x = a[i] ^ b[i];
		while (x) {
			n += x & 1;
			x >>= 1;
		}
	}
	return n;
}

/** Byte-wise XOR of two arrays of the same length. */
export const xorBytes = (a: Uint8Array, b: Uint8Array) => a.map((v, i) => v ^ b[i]);

/**
 * A seeded stream of random-looking key bytes, standing in for a one-time pad (in practice a
 * cipher such as AES turns a short shared key into such a stream). Deterministic so that the
 * drawing is reproducible.
 */
export function padBytes(length: number, seed = 1): Uint8Array {
	let s = seed >>> 0 || 1;
	const out = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		// xorshift32
		s ^= s << 13;
		s >>>= 0;
		s ^= s >>> 17;
		s ^= s << 5;
		s >>>= 0;
		out[i] = s & 0xff;
	}
	return out;
}

// ---------------------------------------------------------------- SHA-256 (FIPS 180-4)

/** FIPS 180-4 §4.2.2: the first 32 bits of the fractional parts of the cube roots of the first 64 primes. */
const K = new Uint32Array([
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/** FIPS 180-4 §5.3.3: the first 32 bits of the fractional parts of the square roots of the first 8 primes. */
const H0 = [
	0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 digest (32 bytes) of a byte array or a string (UTF-8). */
export function sha256(input: Uint8Array | string): Uint8Array {
	const msg = typeof input === 'string' ? utf8(input) : input;
	// Padding (§5.1.1): a 1 bit, zeros, then the 64-bit length, to a multiple of 512 bits.
	const bitLen = msg.length * 8;
	const total = Math.ceil((msg.length + 9) / 64) * 64;
	const buf = new Uint8Array(total);
	buf.set(msg);
	buf[msg.length] = 0x80;
	const view = new DataView(buf.buffer);
	view.setUint32(total - 8, Math.floor(bitLen / 2 ** 32));
	view.setUint32(total - 4, bitLen >>> 0);

	const H = H0.slice();
	const W = new Uint32Array(64);
	for (let off = 0; off < total; off += 64) {
		for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + 4 * i);
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
			const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
			W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
		}
		let [a, b, c, d, e, f, g, h] = H;
		for (let i = 0; i < 64; i++) {
			const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
			const ch = (e & f) ^ (~e & g);
			const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
			const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
			const maj = (a & b) ^ (a & c) ^ (b & c);
			const t2 = (S0 + maj) >>> 0;
			h = g;
			g = f;
			f = e;
			e = (d + t1) >>> 0;
			d = c;
			c = b;
			b = a;
			a = (t1 + t2) >>> 0;
		}
		H[0] = (H[0] + a) >>> 0;
		H[1] = (H[1] + b) >>> 0;
		H[2] = (H[2] + c) >>> 0;
		H[3] = (H[3] + d) >>> 0;
		H[4] = (H[4] + e) >>> 0;
		H[5] = (H[5] + f) >>> 0;
		H[6] = (H[6] + g) >>> 0;
		H[7] = (H[7] + h) >>> 0;
	}
	const out = new Uint8Array(32);
	const ov = new DataView(out.buffer);
	H.forEach((v, i) => ov.setUint32(4 * i, v));
	return out;
}

/** SHA-256 as 64 hex digits. */
export const sha256Hex = (input: Uint8Array | string) => toHex(sha256(input));

/** How many texts the prefix search tries before giving up. */
export const SEARCH_LIMIT = 1 << 20;

/**
 * Brute-force "reversal" of a hash, one prefix at a time: try the texts `${base} 0`,
 * `${base} 1`, … until one's SHA-256 starts with the same `digits` hex digits as `target`.
 * Each digit matches by luck 1 time in 16, so about 16^digits tries are expected.
 */
export function prefixSearch(target: string, digits: number, base = 'try', limit = SEARCH_LIMIT) {
	const want = target.slice(0, digits);
	for (let i = 0; i < limit; i++) {
		const text = `${base} ${i}`;
		const hex = sha256Hex(text);
		if (hex.startsWith(want)) return { text, hex, tries: i + 1 };
	}
	return null;
}

/** log10 of 2^256: the number of possible SHA-256 digests is about 1.16 × 10⁷⁷. */
export const DIGESTS_LOG10 = 256 * Math.log10(2);

// ---------------------------------------------------------------- paint

/** The paints on offer. Colours are illustrative sRGB, not measured pigments. */
export const PAINTS = {
	yellow: { name: 'yellow', hex: '#f4c20d' },
	red: { name: 'red', hex: '#d6283c' },
	blue: { name: 'blue', hex: '#2a62c9' },
	teal: { name: 'teal', hex: '#109e8c' },
	violet: { name: 'violet', hex: '#8a3fb0' }
} as const;
export type PaintId = keyof typeof PAINTS;

/** A mixture: parts of each base paint (only the proportions matter). */
type Mixture = Partial<Record<PaintId, number>>;

/** Pours mixtures together, part for part. */
function pour(...mixtures: Mixture[]): Mixture {
	const out: Mixture = {};
	for (const m of mixtures)
		for (const [k, v] of Object.entries(m) as [PaintId, number][]) out[k] = (out[k] ?? 0) + v;
	return out;
}

/** Proportions of a mixture, summing to 1. */
function proportions(m: Mixture): Mixture {
	const total = Object.values(m).reduce((s, v) => s + (v ?? 0), 0);
	const out: Mixture = {};
	for (const [k, v] of Object.entries(m) as [PaintId, number][]) out[k] = v / total;
	return out;
}

/** True if two mixtures have the same proportions of every paint. */
export function sameMixture(a: Mixture, b: Mixture, eps = 1e-12) {
	const pa = proportions(a);
	const pb = proportions(b);
	const keys = new Set([...Object.keys(pa), ...Object.keys(pb)] as PaintId[]);
	for (const k of keys) if (Math.abs((pa[k] ?? 0) - (pb[k] ?? 0)) > eps) return false;
	return true;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const parseHex = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Linear-light RGB reflectance of a mixture: weighted geometric mean per channel. */
export function mixRgb(m: Mixture): [number, number, number] {
	const p = proportions(m);
	const out = [0, 0, 0];
	for (const [k, w] of Object.entries(p) as [PaintId, number][]) {
		const rgb = parseHex(PAINTS[k].hex).map(toLinear);
		// A floor stands in for the little light every real pigment reflects.
		for (let c = 0; c < 3; c++) out[c] += w * Math.log(Math.max(rgb[c], 0.01));
	}
	return out.map(Math.exp) as [number, number, number];
}

/** The mixture's colour as "#rrggbb". */
export function mixHex(m: Mixture): string {
	return (
		'#' +
		mixRgb(m)
			.map((c) =>
				Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}

/**
 * The paint exchange. Everyone knows the common paint. Alice and Bob each mix one part of
 * their secret paint into one part of the common paint and send the result. Each then mixes
 * one part of their secret into what they received: both end with equal parts of common,
 * Alice's and Bob's paint. Eve, who sees both sent mixtures, can only pour them together.
 */
export function paintExchange(common: PaintId, alice: PaintId, bob: PaintId) {
	const C: Mixture = { [common]: 1 };
	const A: Mixture = { [alice]: 1 };
	const B: Mixture = { [bob]: 1 };
	const aliceSends = pour(C, A);
	const bobSends = pour(C, B);
	// Each sent mixture is two parts; the secret added on top is one part of the same size.
	const aliceFinal = pour(bobSends, A);
	const bobFinal = pour(aliceSends, B);
	const eve = pour(aliceSends, bobSends);
	return { aliceSends, bobSends, aliceFinal, bobFinal, eve };
}

/** Distance between two colours in linear RGB (0 = identical). */
export const colourDistance = (a: Mixture, b: Mixture) => {
	const x = mixRgb(a);
	const y = mixRgb(b);
	return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

// ---------------------------------------------------------------- Diffie–Hellman

/** The public clock: p = 101 hours, base g = 2 (as in primes-modular-arithmetic). */
export const DH = { p: 101, g: 2 } as const;

/**
 * Diffie–Hellman with secrets a (Alice) and b (Bob): each publishes g^secret mod p, and
 * raises what the other published to their own secret. Both get g^(ab) mod p.
 */
export function diffieHellman(a: number, b: number, p: number = DH.p, g: number = DH.g) {
	const A = fastPower(g, a, p);
	const B = fastPower(g, b, p);
	const aliceKey = fastPower(B.result, a, p).result;
	const bobKey = fastPower(A.result, b, p).result;
	return { A: A.result, B: B.result, aliceKey, bobKey, multiplications: A.total };
}

/** Eve's attack: find Alice's secret from A by trying exponents 0, 1, 2, … */
export const eveSearch = (A: number, p: number = DH.p, g: number = DH.g) => discreteLog(g, A, p);

// ---------------------------------------------------------------- RSA

/** The classic textbook RSA key with φ(n) = 3120 (older editions of Wikipedia's "RSA (cryptosystem)"; it now uses λ(n) = 780, d = 413). */
export const RSA = { p: 61, q: 53, n: 3233, phi: 3120, e: 17, d: 2753 } as const;

/** The SHA-256 digest of a message, read as one big number and reduced mod n. */
export function hashToNumber(msg: string, n: number = RSA.n): number {
	let h = 0;
	for (const byte of sha256(msg)) h = (h * 256 + byte) % n;
	return h;
}

/** Signs: s = h^d mod n, where h is the message's hash mod n. Needs the private d. */
export const sign = (msg: string, d: number = RSA.d, n: number = RSA.n) =>
	fastPower(hashToNumber(msg, n), d, n).result;

/** Verifies with the public key: does s^e mod n give back the message's hash? */
export function verify(msg: string, s: number, e: number = RSA.e, n: number = RSA.n) {
	const recovered = fastPower(mod(s, n), e, n).result;
	const expected = hashToNumber(msg, n);
	return { recovered, expected, ok: recovered === expected };
}

/** The modular inverse of e mod m (extended Euclid), or null if gcd(e, m) ≠ 1. */
export function inverse(e: number, m: number): number | null {
	if (gcd(e, m) !== 1) return null;
	let [r0, r1, s0, s1] = [m, mod(e, m), 0, 1];
	while (r1) {
		const q = Math.floor(r0 / r1);
		[r0, r1] = [r1, r0 - q * r1];
		[s0, s1] = [s1, s0 - q * s1];
	}
	return mod(s0, m);
}

/** Factoring n by trial division: the divisors tried (2, 3, 4, …) until one divides n. */
export function trialFactor(n: number) {
	for (let k = 2; k * k <= n; k++) if (n % k === 0) return { p: k, q: n / k, tries: k - 1 };
	return { p: n, q: 1, tries: Math.floor(Math.sqrt(n)) - 1 };
}

// ---------------------------------------------------------------- real-world sizes

/**
 * Sizes quoted on the page.
 * - NIST SP 800-57 Part 1 Rev. 5 (2020), Table 2: RSA and finite-field Diffie–Hellman need
 *   2048-bit moduli for 112 bits of security, the minimum NIST accepts through 2030.
 * - The largest RSA number factored is RSA-250 (829 bits, 250 digits), in February 2020; the
 *   largest discrete logarithm computed modulo a prime of a comparable kind is 795 bits
 *   (240 digits), in December 2019 (Boudot, Gaudry, Guillevic, Heninger, Thomé, Zimmermann,
 *   CRYPTO 2020). Both took thousands of core-years.
 */
export const REAL = {
	keyBits: 2048,
	keyDigits: 617,
	rsaRecordBits: 829,
	rsaRecordDigits: 250,
	rsaRecordYear: 2020,
	dlogRecordBits: 795,
	dlogRecordDigits: 240
} as const;
