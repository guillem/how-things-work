// Checks the elliptic-curve model against what is known to be true: the points of a curve over
// F_p form a group (O is the identity, every point has an inverse, addition is associative and
// commutative); Hasse's theorem bounds the number of points, |N − (p + 1)| ≤ 2√p; the toy curve
// y² = x³ + 7 over F₉₇ has 79 points, a prime; double-and-add gives the same point as repeated
// addition; the over-the-reals rule puts the third point on the curve; secp256k1's generator
// (SEC 2 v2 §2.4.1) is on the curve and n·G = O, and Node's own crypto agrees on 1·G; X25519
// reproduces RFC 7748's test vectors (§5.2 and §6.1) and Node's crypto, and ℓ times the base
// point is O. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import * as crypto from 'node:crypto';
import {
	BASE_U,
	L25519,
	P25519,
	RFC7748_DH,
	SECP256K1,
	TOY,
	TOY_G,
	TOY_N,
	add,
	bruteForceLog,
	count,
	equal,
	hasse,
	isOnCurve,
	ladder,
	linePoints,
	multiples,
	multiply,
	neg,
	points,
	realAdd,
	realPoint,
	x25519 as x25519hex,
	type Curve,
	type Point
} from '../src/routes/elliptic-curve-cryptography/ecc';

const isPrime = (n: number) => {
	if (n < 2) return false;
	for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
	return true;
};
const all = (c: Curve): Point[] => [null, ...points(c)];

test('the points of small curves form a group: identity, inverses, commutativity, associativity', () => {
	for (const c of [
		{ p: 13n, a: 0n, b: 7n },
		{ p: 43n, a: 0n, b: 7n },
		{ p: 23n, a: 1n, b: 1n }
	]) {
		const P = all(c);
		for (const a of P) {
			expect(isOnCurve(c, a)).toBe(true);
			expect(equal(add(c, a, null), a)).toBe(true);
			expect(add(c, a, neg(c, a))).toBeNull();
			for (const b of P) {
				const s = add(c, a, b);
				expect(isOnCurve(c, s)).toBe(true);
				expect(equal(s, add(c, b, a))).toBe(true);
				let broken = 0;
				for (const d of P) if (!equal(add(c, add(c, a, b), d), add(c, a, add(c, b, d)))) broken++;
				expect(broken).toBe(0);
			}
		}
	}
});

test('associativity holds on the toy curve over F₉₇ for a spread of triples', () => {
	const P = all(TOY);
	let broken = 0;
	for (let i = 0; i < P.length; i += 2)
		for (let j = 1; j < P.length; j += 3)
			for (let k = 2; k < P.length; k += 4)
				if (!equal(add(TOY, add(TOY, P[i], P[j]), P[k]), add(TOY, P[i], add(TOY, P[j], P[k]))))
					broken++;
	expect(broken).toBe(0);
});

test("Hasse's theorem: every curve's point count is within 2√p of p + 1", () => {
	for (let p = 5; p < 300; p++) {
		if (!isPrime(p)) continue;
		for (const [a, b] of [
			[0, 7],
			[2, 3],
			[-3, 5]
		]) {
			const c = { p: BigInt(p), a: BigInt(a), b: BigInt(b) };
			if ((4 * a ** 3 + 27 * b ** 2) % p === 0) continue; // singular
			const n = count(c);
			const { lo, hi } = hasse(p);
			expect(n).toBeGreaterThanOrEqual(lo);
			expect(n).toBeLessThanOrEqual(hi);
		}
	}
});

test('y² = x³ + 7 over F₉₇ has 79 points, a prime, so every point but O generates them all', () => {
	expect(count(TOY)).toBe(TOY_N);
	expect(isPrime(TOY_N)).toBe(true);
	for (const P of points(TOY)) expect(multiples(TOY, P)).toHaveLength(TOY_N - 1);
	expect(multiply(TOY, BigInt(TOY_N), TOY_G).result).toBeNull();
});

test('double-and-add reaches the same point as adding G again and again, in about 2 log₂ k steps', () => {
	const walk = multiples(TOY, TOY_G);
	for (let k = 1; k < TOY_N; k++) {
		const { result, ops } = multiply(TOY, BigInt(k), TOY_G);
		expect(equal(result, walk[k - 1])).toBe(true);
		expect(ops.length).toBeLessThanOrEqual(2 * Math.floor(Math.log2(k)));
		expect(ops.at(-1)?.multiple ?? 1n).toBe(BigInt(k));
	}
	// Eve, trying G, 2G, 3G, …, needs k tries.
	expect(bruteForceLog(TOY, TOY_G, walk[52]).k).toBe(53);
});

test('a line through two points mod p meets the curve exactly at P, Q and R (with tangents and O)', () => {
	// For every pair, the line's grid points on the curve are exactly {P, Q, R}, where R = −(P + Q)
	// may coincide with P or Q (the line is tangent there) or be O (a vertical line).
	const pts = points(TOY);
	const key = (q: { x: bigint; y: bigint }) => `${q.x},${q.y}`;
	const onCurve = new Set(pts.map(key));
	let wrong = 0;
	let tangents = 0;
	for (const P of pts)
		for (const Q of pts) {
			const hits = new Set(
				linePoints(TOY, P, Q)
					.pts.map((q) => `${q.x},${q.y}`)
					.filter((k) => onCurve.has(k))
			);
			const R = neg(TOY, add(TOY, P, Q));
			const want = new Set([key(P), key(Q), ...(R ? [key(R)] : [])]);
			if (hits.size !== want.size || [...want].some((k) => !hits.has(k))) wrong++;
			if (key(P) !== key(Q) && R && (key(R) === key(P) || key(R) === key(Q))) tangents++;
		}
	expect(wrong).toBe(0);
	expect(tangents).toBeGreaterThan(0);
	// the reviewer's example: the line through (1, 28) and (68, 16) is tangent at (1, 28)
	const R = neg(TOY, add(TOY, { x: 1n, y: 28n }, { x: 68n, y: 16n }));
	expect(R).toEqual({ x: 1n, y: 28n });
});

test('over the reals, the chord and the tangent meet the curve again', () => {
	for (const [y1, y2] of [
		[3, -4],
		[1.5, 2.5],
		[-5, 0.2]
	]) {
		const r = realAdd(realPoint(y1), realPoint(y2));
		expect(r.kind).toBe('chord');
		if (r.kind === 'vertical') continue;
		expect(r.third.y ** 2).toBeCloseTo(r.third.x ** 3 + 7, 6);
	}
	const t = realAdd(realPoint(3), realPoint(3));
	expect(t.kind).toBe('tangent');
	if (t.kind !== 'vertical') expect(t.sum.y ** 2).toBeCloseTo(t.sum.x ** 3 + 7, 6);
	expect(realAdd(realPoint(3), realPoint(-3)).kind).toBe('vertical');
	expect(realAdd(realPoint(0), realPoint(0)).kind).toBe('vertical'); // the point of order 2
});

test('secp256k1 (SEC 2): G is on the curve, n·G = O, and Node agrees on G', () => {
	const { curve, G, n } = SECP256K1;
	expect(curve.p).toBe(2n ** 256n - 2n ** 32n - 977n);
	expect(isOnCurve(curve, G)).toBe(true);
	expect(multiply(curve, n, G).result).toBeNull();
	expect(equal(multiply(curve, n - 1n, G).result, neg(curve, G))).toBe(true);
	expect(n.toString(2)).toHaveLength(256);

	const ecdh = crypto.createECDH('secp256k1');
	const one = Buffer.alloc(32);
	one[31] = 1;
	ecdh.setPrivateKey(one);
	const hex = (v: bigint) => v.toString(16).padStart(64, '0');
	expect(ecdh.getPublicKey('hex')).toBe('04' + hex(G.x) + hex(G.y));

	// and a 256-bit secret's public key matches Node's
	const k = 0xc0ffee12_3456789a_bcdef013_579bdf24_68ace011_22334455_66778899_aabbccddn;
	const secret = Buffer.from(hex(k), 'hex');
	ecdh.setPrivateKey(secret);
	const pub = multiply(curve, k, G).result;
	expect(ecdh.getPublicKey('hex')).toBe('04' + hex(pub?.x ?? 0n) + hex(pub?.y ?? 0n));
});

test('X25519 reproduces RFC 7748: the §5.2 vector, the §6.1 key exchange and Node', () => {
	// §5.2, first test vector
	expect(
		x25519hex(
			'a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4',
			'e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c'
		)
	).toBe('c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552');

	const v = RFC7748_DH;
	expect(x25519hex(v.alicePrivate, BASE_U)).toBe(v.alicePublic);
	expect(x25519hex(v.bobPrivate, BASE_U)).toBe(v.bobPublic);
	expect(x25519hex(v.alicePrivate, v.bobPublic)).toBe(v.shared);
	expect(x25519hex(v.bobPrivate, v.alicePublic)).toBe(v.shared);

	const key = (h: string) =>
		crypto.createPrivateKey({
			key: Buffer.concat([
				Buffer.from('302e020100300506032b656e04220420', 'hex'),
				Buffer.from(h, 'hex')
			]),
			format: 'der',
			type: 'pkcs8'
		});
	const a = key(v.alicePrivate);
	const b = key(v.bobPrivate);
	const raw = (k: crypto.KeyObject) =>
		crypto.createPublicKey(k).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
	expect(raw(a)).toBe(v.alicePublic);
	expect(
		crypto.diffieHellman({ privateKey: a, publicKey: crypto.createPublicKey(b) }).toString('hex')
	).toBe(v.shared);
});

test('Curve25519: ℓ times the base point is the point at infinity, and ℓ has 253 bits', () => {
	expect(P25519.toString(2)).toHaveLength(255);
	expect(L25519.toString(2)).toHaveLength(253);
	expect(ladder(L25519, 9n, 253).Z).toBe(0n);
	expect(ladder(L25519 - 1n, 9n, 253).Z).not.toBe(0n);
});
