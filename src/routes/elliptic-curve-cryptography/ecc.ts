/**
 * Elliptic curves, from the picture to the real standards.
 *
 * - Over the real numbers: y² = x³ + 7, the equation of Bitcoin's curve secp256k1, with the
 *   chord-and-tangent rule in floating point. For intuition only (said on the page).
 * - Over a finite field F_p: the same rule in exact BigInt arithmetic, for any short
 *   Weierstrass curve y² = x³ + ax + b. The page's toy curve is y² = x³ + 7 over F₉₇, which has
 *   79 points (a prime, so every point other than O generates them all).
 * - Double-and-add scalar multiplication with a trace of its operations, and Eve's brute-force
 *   discrete logarithm.
 * - The real standards: secp256k1 from SEC 2 v2 (Certicom Research, 2010, §2.4.1) and X25519
 *   from RFC 7748 (Langley, Hamburg & Turner, 2016, §4.1 and §5), checked against the RFC's test
 *   vectors and Node's own crypto in the tests.
 * - Key sizes at equal security from NIST SP 800-57 Part 1 Rev. 5 (2020), Table 2.
 */

// ---------------------------------------------------------------- over the reals

export interface RPoint {
	x: number;
	y: number;
}

/** The real curve y² = x³ + 7: the point with height y (there is exactly one for every y). */
export const realPoint = (y: number): RPoint => ({ x: Math.cbrt(y * y - 7), y });

/** x where the curve crosses the x-axis, −∛7: the one point of order 2. */
export const REAL_ROOT = -Math.cbrt(7);

export type RealSum =
	{ kind: 'chord' | 'tangent'; slope: number; third: RPoint; sum: RPoint } | { kind: 'vertical' };

/**
 * P + Q on y² = x³ + 7 over the reals by the chord-and-tangent rule: the line through P and Q
 * (the tangent when they coincide) meets the curve in a third point; its mirror image in the
 * x-axis is the sum. A vertical line (Q = −P, or doubling the point on the x-axis) meets the
 * curve "at infinity", O.
 */
export function realAdd(P: RPoint, Q: RPoint): RealSum {
	const same = Math.abs(P.x - Q.x) < 1e-9 && Math.abs(P.y - Q.y) < 1e-9;
	if (same) {
		if (Math.abs(P.y) < 1e-9) return { kind: 'vertical' };
		const slope = (3 * P.x * P.x) / (2 * P.y);
		const x = slope * slope - 2 * P.x;
		const y = P.y + slope * (x - P.x);
		return { kind: 'tangent', slope, third: { x, y }, sum: { x, y: -y } };
	}
	if (Math.abs(P.x - Q.x) < 1e-9) return { kind: 'vertical' };
	const slope = (Q.y - P.y) / (Q.x - P.x);
	const x = slope * slope - P.x - Q.x;
	const y = P.y + slope * (x - P.x);
	return { kind: 'chord', slope, third: { x, y }, sum: { x, y: -y } };
}

// ---------------------------------------------------------------- over a finite field

/** y² = x³ + ax + b over F_p (p an odd prime, 4a³ + 27b² ≠ 0 mod p). */
export interface Curve {
	p: bigint;
	a: bigint;
	b: bigint;
}

/** A point with coordinates in F_p, or null for the point at infinity O. */
export type Point = { x: bigint; y: bigint } | null;

export const mod = (v: bigint, m: bigint) => ((v % m) + m) % m;

/** v^e mod m by square-and-multiply. */
export function powMod(v: bigint, e: bigint, m: bigint): bigint {
	let result = 1n;
	let base = mod(v, m);
	while (e > 0n) {
		if (e & 1n) result = (result * base) % m;
		base = (base * base) % m;
		e >>= 1n;
	}
	return result;
}

/** 1/v mod m (m prime, v ≠ 0), by the extended Euclidean algorithm. */
export function inverse(v: bigint, m: bigint): bigint {
	let [r0, r1] = [mod(v, m), m];
	let [s0, s1] = [1n, 0n];
	while (r1 !== 0n) {
		const q = r0 / r1;
		[r0, r1] = [r1, r0 - q * r1];
		[s0, s1] = [s1, s0 - q * s1];
	}
	if (r0 !== 1n) throw new Error('not invertible');
	return mod(s0, m);
}

export const isOnCurve = (c: Curve, P: Point) =>
	P === null || mod(P.y * P.y - (P.x * P.x * P.x + c.a * P.x + c.b), c.p) === 0n;

export const neg = (c: Curve, P: Point): Point =>
	P === null ? null : { x: P.x, y: mod(-P.y, c.p) };

export const equal = (P: Point, Q: Point) =>
	P === null || Q === null ? P === Q : P.x === Q.x && P.y === Q.y;

/**
 * The slope of the line through P and Q (the tangent if P = Q), or null when the line is
 * vertical (Q = −P), which is when the sum is O. Neither point may be O.
 */
export function slope(c: Curve, P: { x: bigint; y: bigint }, Q: { x: bigint; y: bigint }) {
	if (P.x === Q.x) {
		if (mod(P.y + Q.y, c.p) === 0n) return null;
		return mod((3n * P.x * P.x + c.a) * inverse(2n * P.y, c.p), c.p);
	}
	return mod((Q.y - P.y) * inverse(Q.x - P.x, c.p), c.p);
}

/** P + Q by the same chord-and-tangent formulas, with every division done mod p. */
export function add(c: Curve, P: Point, Q: Point): Point {
	if (P === null) return Q;
	if (Q === null) return P;
	const l = slope(c, P, Q);
	if (l === null) return null;
	const x = mod(l * l - P.x - Q.x, c.p);
	return { x, y: mod(l * (P.x - x) - P.y, c.p) };
}

export type Op = { op: 'double' | 'add'; result: Point; multiple: bigint };

/**
 * k·P by double-and-add, reading k's bits from the top: start from P for the leading 1, then
 * for each further bit double, and add P when the bit is 1. Returns the result and every
 * operation with the multiple of P it reaches.
 */
export function multiply(c: Curve, k: bigint, P: Point): { result: Point; ops: Op[] } {
	if (k <= 0n || P === null) return { result: null, ops: [] };
	const bits = k.toString(2);
	let acc: Point = P;
	let m = 1n;
	const ops: Op[] = [];
	for (const bit of bits.slice(1)) {
		acc = add(c, acc, acc);
		m *= 2n;
		ops.push({ op: 'double', result: acc, multiple: m });
		if (bit === '1') {
			acc = add(c, acc, P);
			m += 1n;
			ops.push({ op: 'add', result: acc, multiple: m });
		}
	}
	return { result: acc, ops };
}

/** Every affine point of a small curve, sorted by x then y (p small enough to loop over). */
export function points(c: Curve): { x: bigint; y: bigint }[] {
	const p = Number(c.p);
	const roots = new Map<number, number[]>();
	for (let y = 0; y < p; y++) {
		const s = (y * y) % p;
		roots.set(s, [...(roots.get(s) ?? []), y]);
	}
	const a = Number(mod(c.a, c.p));
	const b = Number(mod(c.b, c.p));
	const out: { x: bigint; y: bigint }[] = [];
	for (let x = 0; x < p; x++) {
		const r = (((((x * x) % p) * x) % p) + a * x + b) % p;
		for (const y of roots.get(r) ?? []) out.push({ x: BigInt(x), y: BigInt(y) });
	}
	return out;
}

/** The number of points of a small curve, O included. */
export const count = (c: Curve) => points(c).length + 1;

/** G, 2G, 3G, … up to the first multiple that is O: the multiples in the order k gives them. */
export function multiples(c: Curve, G: Point): Point[] {
	const out: Point[] = [];
	let P = G;
	while (P !== null && out.length < 100_000) {
		out.push(P);
		P = add(c, P, G);
	}
	return out;
}

/** Eve's attack: try G, 2G, 3G, … until one is Q. Returns k and the number of tries. */
export function bruteForceLog(c: Curve, G: Point, Q: Point): { k: number | null; tries: number } {
	let P = G;
	for (let k = 1; k < 100_000; k++) {
		if (equal(P, Q)) return { k, tries: k };
		if (P === null) return { k: null, tries: k };
		P = add(c, P, G);
	}
	return { k: null, tries: 100_000 };
}

// ---------------------------------------------------------------- the page's toy curve

/** y² = x³ + 7 over F₉₇: the equation of secp256k1 on a field small enough to draw. */
export const TOY: Curve = { p: 97n, a: 0n, b: 7n };
/** Its generator, the point with the smallest x. Every point but O has order 79. */
export const TOY_G = points(TOY)[0];
/** The number of points, O included: 79, a prime. */
export const TOY_N = 79;

/** Fields the finite-field step offers, all for y² = x³ + 7. */
export const FIELDS = [13, 43, 97, 163];

/**
 * The "line" through P and Q over F_p: the p points (x, λx + c mod p), or the p points with
 * x = P.x when the line is vertical.
 */
export function linePoints(c: Curve, P: { x: bigint; y: bigint }, Q: { x: bigint; y: bigint }) {
	const l = slope(c, P, Q);
	const p = Number(c.p);
	if (l === null)
		return { slope: null, pts: Array.from({ length: p }, (_, y) => ({ x: Number(P.x), y })) };
	const k = mod(P.y - l * P.x, c.p);
	return {
		slope: l,
		intercept: k,
		pts: Array.from({ length: p }, (_, x) => ({ x, y: Number(mod(l * BigInt(x) + k, c.p)) }))
	};
}

/** The bounds Hasse's theorem puts on the number of points: |N − (p + 1)| ≤ 2√p. */
export const hasse = (p: number) => ({
	lo: p + 1 - 2 * Math.sqrt(p),
	hi: p + 1 + 2 * Math.sqrt(p)
});

// ---------------------------------------------------------------- secp256k1 (SEC 2 v2, §2.4.1)

const big = (hex: string) => BigInt('0x' + hex.replace(/\s+/g, ''));

export const SECP256K1 = {
	curve: {
		p: big('FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE FFFFFC2F'),
		a: 0n,
		b: 7n
	} satisfies Curve,
	G: {
		x: big('79BE667E F9DCBBAC 55A06295 CE870B07 029BFCDB 2DCE28D9 59F2815B 16F81798'),
		y: big('483ADA77 26A3C465 5DA4FBFC 0E1108A8 FD17B448 A6855419 9C47D08F FB10D4B8')
	},
	n: big('FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFE BAAEDCE6 AF48A03B BFD25E8C D0364141'),
	h: 1n
};

// ---------------------------------------------------------------- X25519 (RFC 7748)

export const P25519 = 2n ** 255n - 19n;
/** The order of the base point u = 9's subgroup, ℓ (RFC 7748 §4.1); the cofactor is 8. */
export const L25519 = 2n ** 252n + big('14def9dea2f79cd65812631a5cf5d3ed');
const A24 = 121665n; // (486662 − 2) / 4

/** Little-endian bytes (hex) to a number, as RFC 7748 §5 decodes them. */
export function decodeLE(hex: string): bigint {
	const bytes = hex.match(/../g) ?? [];
	return big(bytes.reverse().join('') || '0');
}
export function encodeLE(v: bigint): string {
	let h = '';
	for (let i = 0; i < 32; i++) {
		h += Number((v >> BigInt(8 * i)) & 0xffn)
			.toString(16)
			.padStart(2, '0');
	}
	return h;
}

/** decodeScalar25519: clear the low 3 bits and the top bit, set bit 254. */
export function clampScalar(hex: string): bigint {
	const k = decodeLE(hex);
	return (k & ~7n & ((1n << 255n) - 1n)) | (1n << 254n);
}

/**
 * The Montgomery ladder of RFC 7748 §5 on the x-coordinate (u) alone, for any scalar k:
 * returns the projective result (X : Z); Z = 0 is the point at infinity.
 */
export function ladder(k: bigint, u: bigint, bits = 255): { X: bigint; Z: bigint } {
	const p = P25519;
	const x1 = mod(u, p);
	let [x2, z2, x3, z3] = [1n, 0n, x1, 1n];
	let swap = 0n;
	for (let t = bits - 1; t >= 0; t--) {
		const kt = (k >> BigInt(t)) & 1n;
		swap ^= kt;
		if (swap) [x2, x3, z2, z3] = [x3, x2, z3, z2];
		swap = kt;
		const A = mod(x2 + z2, p);
		const AA = (A * A) % p;
		const B = mod(x2 - z2, p);
		const BB = (B * B) % p;
		const E = mod(AA - BB, p);
		const C = mod(x3 + z3, p);
		const D = mod(x3 - z3, p);
		const DA = (D * A) % p;
		const CB = (C * B) % p;
		x3 = mod((DA + CB) ** 2n, p);
		z3 = (x1 * mod((DA - CB) ** 2n, p)) % p;
		x2 = (AA * BB) % p;
		z2 = (E * mod(AA + A24 * E, p)) % p;
	}
	// the final conditional swap: only (x2 : z2) is needed afterwards
	if (swap) [x2, z2] = [x3, z3];
	return { X: x2, Z: z2 };
}

/** X25519(k, u) of RFC 7748 §5, on 32-byte little-endian hex strings. */
export function x25519(scalarHex: string, uHex: string): string {
	const k = clampScalar(scalarHex);
	const u = decodeLE(uHex) & ((1n << 255n) - 1n);
	const { X, Z } = ladder(k, u);
	return encodeLE((X * powMod(Z, P25519 - 2n, P25519)) % P25519);
}

/** The base point u = 9, as 32 little-endian bytes. */
export const BASE_U = encodeLE(9n);

/** RFC 7748 §6.1: the Diffie–Hellman test vector on Curve25519. */
export const RFC7748_DH = {
	alicePrivate: '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a',
	alicePublic: '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a',
	bobPrivate: '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb',
	bobPublic: 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f',
	shared: '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742'
};

// ---------------------------------------------------------------- key sizes

/**
 * Comparable strengths, NIST SP 800-57 Part 1 Rev. 5 (May 2020), Table 2: the bits of
 * security, the modulus of finite-field Diffie–Hellman (L) and of RSA (k), and the size of an
 * elliptic-curve group order (f, the low end of NIST's range).
 */
export const KEY_SIZES = [
	{ security: 80, modular: 1024, curve: 160 },
	{ security: 112, modular: 2048, curve: 224 },
	{ security: 128, modular: 3072, curve: 256 },
	{ security: 192, modular: 7680, curve: 384 },
	{ security: 256, modular: 15360, curve: 512 }
];

/** Bits of a number, and its hex in groups of 8 for display. */
export const bitLength = (v: bigint) => v.toString(2).length;
export const hexGroups = (v: bigint, width = 64) =>
	v
		.toString(16)
		.padStart(width, '0')
		.replace(/(.{8})(?=.)/g, '$1 ');
