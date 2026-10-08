// Checks the number theory behind the primes & modular arithmetic explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	addOnClock,
	digitsOfPowerOfTwo,
	discreteLog,
	divisors,
	factorText,
	factorize,
	fastCostMax,
	fastPower,
	gcd,
	isPrime,
	isPrimitiveRoot,
	mod,
	multiplyHops,
	order,
	powerWalk,
	shufflers,
	sieve,
	slowPower,
	struckAfter,
	timesMap
} from '../src/routes/primes-modular-arithmetic/modular';

// Primes below 100 (OEIS A000040).
const PRIMES_100 = [
	2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97
];

test('divisors, primality and factorisation', () => {
	expect(divisors(60)).toEqual([1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60]);
	expect(divisors(1)).toEqual([1]);
	expect(divisors(49)).toEqual([1, 7, 49]);
	expect(divisors(12)).toEqual([1, 2, 3, 4, 6, 12]);
	expect(divisors(13)).toEqual([1, 13]);
	expect(isPrime(13)).toBe(true);
	expect(isPrime(1)).toBe(false); // 1 is neither prime nor composite
	expect(isPrime(2)).toBe(true);
	expect(isPrime(91)).toBe(false); // 7 × 13
	expect(factorize(60)).toEqual([
		[2, 2],
		[3, 1],
		[5, 1]
	]);
	expect(factorText(60)).toBe('2² × 3 × 5');
	expect(factorText(97)).toBe('97');
	expect(factorText(64)).toBe('2⁶');
	// Every number is the product of its factorisation.
	for (let n = 2; n <= 1000; n++)
		expect(factorize(n).reduce((acc, [p, e]) => acc * p ** e, 1)).toBe(n);
});

test('sieve of Eratosthenes up to 100', () => {
	const s = sieve(100);
	expect(s.primes).toEqual(PRIMES_100);
	expect(s.primes.length).toBe(25);
	// Stages for 2, 3, 5 and 7 only: the next prime, 11, has 11² = 121 > 100.
	expect(s.stages.map((st) => st.prime)).toEqual([2, 3, 5, 7]);
	expect(s.stopPrime).toBe(11);
	expect(s.stopPrime ** 2).toBe(121);
	// Multiples struck, and how many are new at each stage.
	expect(s.stages.map((st) => st.multiples.length)).toEqual([49, 32, 19, 13]);
	expect(s.stages.map((st) => st.fresh.length)).toEqual([49, 16, 6, 3]);
	expect(s.stages[3].fresh).toEqual([49, 77, 91]);
	// Each stage's first new strike is the prime's own square.
	for (const st of s.stages) expect(st.fresh[0]).toBe(st.prime ** 2);
	// 74 composites + 25 primes + the number 1 = 100.
	expect(s.stages.reduce((n, st) => n + st.fresh.length, 0)).toBe(74);
	// Striking with 11 would add nothing new.
	for (let k = 22; k <= 100; k += 11) expect(s.struckBy[k]).toBeGreaterThan(0);
	// The first prime to strike a number is its smallest prime factor.
	for (let k = 2; k <= 100; k++) if (s.struckBy[k]) expect(s.struckBy[k]).toBe(factorize(k)[0][0]);
	// Partial states.
	const after1 = struckAfter(s, 1);
	expect(after1.filter((v) => v === 2).length).toBe(49);
	expect(after1[9]).toBe(0);
	expect(struckAfter(s, 4)).toEqual(s.struckBy);
	// Agrees with trial division far beyond 100.
	const big = sieve(2000);
	for (let k = 2; k <= 2000; k++) expect(big.primes.includes(k)).toBe(isPrime(k));
	expect(big.primes.length).toBe(303); // π(2000) = 303
});

test('adding and multiplying on a clock', () => {
	expect(mod(-3, 12)).toBe(9);
	expect(addOnClock(9, 5, 12)).toEqual({ total: 14, laps: 1, result: 2 });
	expect(addOnClock(20, 20, 7).result).toBe(40 % 7);
	expect(multiplyHops(5, 7, 12)).toEqual([0, 5, 10, 3, 8, 1, 6, 11]);
	const wrong: string[] = [];
	for (let m = 2; m <= 31; m++)
		for (let a = 0; a <= 30; a++)
			for (let b = 0; b <= 30; b++) {
				if (addOnClock(a, b, m).result !== (a + b) % m) wrong.push(`${a}+${b} mod ${m}`);
				if (multiplyHops(a, b, m).at(-1) !== (a * b) % m) wrong.push(`${a}×${b} mod ${m}`);
			}
	expect(wrong).toEqual([]);
});

test('multiplying on a 12-hour clock versus a prime clock', () => {
	const t3 = timesMap(3, 12);
	expect(t3.reached).toEqual([0, 3, 6, 9]);
	expect(t3.shuffles).toBe(false);
	expect(t3.zeroPartner).toBe(4); // 3 × 4 = 12 ≡ 0
	expect(t3.inverse).toBeNull();
	const t5 = timesMap(5, 12);
	expect(t5.shuffles).toBe(true);
	expect(t5.inverse).toBe(5); // 5 × 5 = 25 ≡ 1
	expect(shufflers(12)).toEqual([1, 5, 7, 11]);
	// A multiplier shuffles exactly when it shares no factor with m.
	for (let m = 2; m <= 31; m++)
		for (let a = 1; a < m; a++) {
			const t = timesMap(a, m);
			expect(t.shuffles).toBe(gcd(a, m) === 1);
			expect(t.inverse !== null).toBe(t.shuffles);
			expect(t.zeroPartner !== null).toBe(!t.shuffles);
		}
	// On a prime clock every nonzero multiplier shuffles; on any other, some don't.
	for (let m = 2; m <= 31; m++) expect(shufflers(m).length === m - 1).toBe(isPrime(m));
});

test('powers on a clock', () => {
	const w = powerWalk(2, 13);
	expect(w.seq).toEqual([1, 2, 4, 8, 3, 6, 12, 11, 9, 5, 10, 7, 1]);
	expect(w.cycleLength).toBe(12);
	expect(w.visited).toBe(12);
	expect(isPrimitiveRoot(2, 13)).toBe(true);
	expect(powerWalk(3, 13).seq).toEqual([1, 3, 9, 1]);
	// On 12 hours, powers of 2 never come back to 1.
	const w12 = powerWalk(2, 12);
	expect(w12.seq).toEqual([1, 2, 4, 8, 4]);
	expect(w12.returnsToOne).toBe(false);
	expect(order(2, 12)).toBeNull();
	// Fermat's little theorem: a^(p−1) ≡ 1 (mod p) for p prime and a not a multiple of p,
	// so every cycle length divides p − 1.
	for (let p = 2; p <= 31; p++) {
		if (!isPrime(p)) continue;
		for (let a = 1; a < p; a++) {
			expect(slowPower(a, p - 1, p)).toBe(1);
			expect((p - 1) % (order(a, p) ?? 0)).toBe(0);
		}
	}
	// 2 is a primitive root of 101: its powers visit all 100 nonzero hours.
	expect(isPrimitiveRoot(2, 101)).toBe(true);
	expect(new Set(powerWalk(2, 101).seq).size).toBe(100);
});

test('square-and-multiply', () => {
	const f = fastPower(2, 77, 101);
	expect(f.result).toBe(61);
	expect(slowPower(2, 77, 101)).toBe(61);
	expect(f.rungs.length).toBe(7); // 77 = 1001101 in binary
	expect(f.squarings).toBe(6);
	expect(f.multiplications).toBe(3);
	expect(f.total).toBe(9);
	expect(f.naive).toBe(76);
	expect(f.rungs.map((r) => r.value)).toEqual([2, 4, 16, 54, 88, 68, 79]);
	for (let x = 1; x <= 1000; x++) {
		const g = fastPower(2, x, 101);
		expect(g.result).toBe(slowPower(2, x, 101));
		expect(g.total).toBeLessThanOrEqual(fastCostMax(10));
	}
	expect(fastPower(2, 1000, 101).total).toBe(14);
	// A 2048-bit exponent: at most 4094 multiplications. 2^2048 has 617 digits.
	expect(fastCostMax(2048)).toBe(4094);
	expect(digitsOfPowerOfTwo(2048)).toBe(617);
	expect(digitsOfPowerOfTwo(10)).toBe(4); // 1024
	// Any 2048-bit exponent is at least 2^2047, which has 617 digits: more than 10^616.
	expect(digitsOfPowerOfTwo(2047)).toBe(617);
	// A 600-digit exponent has at most 1994 bits: a few thousand multiplications.
	const bits600 = Math.ceil(600 * Math.log2(10));
	expect(bits600).toBe(1994);
	expect(fastCostMax(bits600)).toBe(3986);
	// 3 × 5 = 15 ≡ 3 on 12 hours (the multiply step's example).
	expect(multiplyHops(3, 5, 12).at(-1)).toBe(3);
});

test('reversing a power by trial', () => {
	expect(discreteLog(2, 61, 101)).toEqual({ x: 77, tries: 78 });
	expect(discreteLog(2, 1, 101)).toEqual({ x: 0, tries: 1 });
	for (let y = 1; y <= 100; y++) {
		const r = discreteLog(2, y, 101);
		expect(r.x).not.toBeNull();
		expect(slowPower(2, r.x!, 101)).toBe(y);
	}
	expect(discreteLog(2, 0, 101).x).toBeNull();
	// On 12 hours, 2ˣ is never 3.
	expect(discreteLog(2, 3, 12).x).toBeNull();
});
