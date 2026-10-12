// Checks the cryptography behind the cryptography explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { isPrimitiveRoot } from '../src/routes/primes-modular-arithmetic/modular';
import {
	DH,
	RSA,
	bitDistance,
	colourDistance,
	diffieHellman,
	eveSearch,
	hashToNumber,
	inverse,
	mixHex,
	mixRgb,
	paintExchange,
	prefixSearch,
	sameMixture,
	sha256,
	sha256Hex,
	sign,
	trialFactor,
	verify,
	xorBytes,
	padBytes,
	utf8
} from '../src/routes/cryptography/crypto';

test.describe('SHA-256', () => {
	// FIPS 180-4 example values (NIST CSRC "Examples with intermediate values", SHA256.pdf
	// and SHA2_Additional.pdf).
	test('matches the NIST examples', () => {
		expect(sha256Hex('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
		expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
		expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
			'248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
		);
	});

	test('one million "a"s (the NIST long-message example)', () => {
		expect(sha256Hex(new Uint8Array(1_000_000).fill(0x61))).toBe(
			'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
		);
	});

	test('agrees with Node across padding boundaries and non-ASCII text', () => {
		const texts = [55, 56, 63, 64, 65, 119, 120].map((n) => 'x'.repeat(n));
		texts.push('Meet me at noon', 'Héllo, wörld — ☕', '日本語');
		for (const s of texts)
			expect(sha256Hex(s), s).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
	});

	test('changing one character flips about half of the 256 bits (avalanche)', () => {
		const base = 'Meet me at noon';
		const dists: number[] = [];
		for (let i = 0; i < base.length; i++)
			for (const c of 'abcxyz.!') {
				if (base[i] === c) continue;
				const edited = base.slice(0, i) + c + base.slice(i + 1);
				dists.push(bitDistance(sha256(base), sha256(edited)));
			}
		const mean = dists.reduce((s, d) => s + d, 0) / dists.length;
		expect(mean).toBeGreaterThan(124);
		expect(mean).toBeLessThan(132);
		// Never just a few bits: the closest pair still differs in dozens of places.
		expect(Math.min(...dists)).toBeGreaterThan(90);
	});

	test('the narrative example: "noon" → "moon" changes the digest completely', () => {
		const d = bitDistance(sha256('Meet me at noon'), sha256('Meet me at moon'));
		expect(d).toBeGreaterThan(100);
		expect(d).toBeLessThan(156);
	});

	test('matching each extra hex digit of a target hash takes about 16 times more tries', () => {
		// Over several targets, the average number of tries for k digits is close to 16^k.
		for (const k of [1, 2]) {
			let sum = 0;
			const N = 40;
			for (let j = 0; j < N; j++) sum += prefixSearch(sha256Hex(`target ${j}`), k)!.tries;
			expect(sum / N).toBeGreaterThan(16 ** k / 2);
			expect(sum / N).toBeLessThan(16 ** k * 2);
		}
		const found = prefixSearch(sha256Hex('Meet me at noon'), 3)!;
		expect(sha256Hex(found.text).slice(0, 3)).toBe(sha256Hex('Meet me at noon').slice(0, 3));
	});
});

test('a one-time pad: XOR with the key scrambles, XOR again unscrambles', () => {
	const msg = utf8('HI');
	const key = padBytes(2, 7);
	const cipher = xorBytes(msg, key);
	expect(Array.from(cipher)).not.toEqual(Array.from(msg));
	expect(new TextDecoder().decode(xorBytes(cipher, key))).toBe('HI');
});

test.describe('paint mixing', () => {
	test('Alice and Bob end with the same colour, whatever secrets they pick', () => {
		const ids = ['red', 'blue', 'teal', 'violet'] as const;
		for (const a of ids)
			for (const b of ids) {
				const x = paintExchange('yellow', a, b);
				expect(sameMixture(x.aliceFinal, x.bobFinal)).toBe(true);
				expect(mixHex(x.aliceFinal)).toBe(mixHex(x.bobFinal));
			}
	});

	test("Eve's mix of the two public mixtures is a different colour", () => {
		const x = paintExchange('yellow', 'red', 'blue');
		expect(sameMixture(x.eve, x.aliceFinal)).toBe(false);
		expect(colourDistance(x.eve, x.aliceFinal)).toBeGreaterThan(0.03);
	});

	test('yellow and blue paint make green', () => {
		const [r, g, b] = mixRgb({ yellow: 1, blue: 1 });
		expect(g).toBeGreaterThan(r);
		expect(g).toBeGreaterThan(b);
	});
});

test.describe('Diffie–Hellman on the 101-hour clock', () => {
	test('2 is a primitive root mod 101, so every key from 1 to 100 is possible', () => {
		expect(isPrimitiveRoot(DH.g, DH.p)).toBe(true);
	});

	test('both sides derive the same key for every pair of secrets', () => {
		for (let a = 2; a <= 99; a++)
			for (let b = 2; b <= 99; b++) {
				const k = diffieHellman(a, b);
				expect(k.aliceKey).toBe(k.bobKey);
			}
	});

	test('the textbook example p = 23, g = 5, a = 4, b = 3 gives the shared key 18', () => {
		// Wikipedia, "Diffie–Hellman key exchange", cryptographic explanation.
		const k = diffieHellman(4, 3, 23, 5);
		expect([k.A, k.B, k.aliceKey, k.bobKey]).toEqual([4, 10, 18, 18]);
	});

	test('Eve recovers the secret by trying exponents, at this tiny size', () => {
		const { A } = diffieHellman(77, 30);
		const found = eveSearch(A);
		expect(found.x).toBe(77);
		expect(found.tries).toBe(78);
	});
});

test.describe('RSA signatures', () => {
	test('the textbook key is consistent: n = pq, e·d ≡ 1 mod (p−1)(q−1)', () => {
		expect(RSA.p * RSA.q).toBe(RSA.n);
		expect(inverse(RSA.e, (RSA.p - 1) * (RSA.q - 1))).toBe(RSA.d);
		expect(trialFactor(RSA.n)).toMatchObject({ p: 53, q: 61 });
	});

	test('a signed message verifies with the public key', () => {
		for (const m of ['Meet me at noon', 'Pay Bob 10 €', '', 'x'.repeat(200)]) {
			const s = sign(m);
			expect(verify(m, s).ok).toBe(true);
		}
	});

	test('a tampered message or a forged signature fails', () => {
		const s = sign('Pay Bob 10 €');
		expect(verify('Pay Bob 90 €', s).ok).toBe(false);
		expect(verify('Pay Eve 10 €', s).ok).toBe(false);
		expect(verify('Pay Bob 10 €', (s + 1) % RSA.n).ok).toBe(false);
		// Signing really needs d: raising the hash to the public e does not give a valid signature.
		const h = hashToNumber('Pay Bob 10 €');
		expect(verify('Pay Bob 10 €', h).ok).toBe(false);
	});
});
