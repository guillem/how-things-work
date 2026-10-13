<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.37 in tokens + 5 web searches -->
# Review: primes-modular-arithmetic

## Verdict
The page can ship once the small fixes below are made. I recomputed every number it quotes and all are correct: the 25 primes; strike counts of 49/32/19/13 multiples with 49/16/6/3 new; the powers of 2 on 13 hours; 3 on 13 cycling 1, 3, 9; 2 on 12 getting stuck at 4, 8; 2⁷⁷ ≡ 61 (mod 101) with ladder values 2, 4, 16, 54, 88, 68, 79; 9 multiplications against 76; 78 tries; 4,094 multiplications; 10⁶¹⁶. The model is exact integer arithmetic, and the tests check real number-theory properties. There are no high-severity problems. The most important fix is a wording slip in the multiply step: it says "on a prime clock you can always divide", which needs "by anything except 0".

## Factual errors
- **low**, steps.ts:191: "so on a prime clock you can always divide" leaves out division by 0, and nothing divides by 0. The same paragraph says "shares no factor with the number of hours", but every number shares the factor 1. Fix: "A multiplier shuffles the clock exactly when it shares no factor other than 1 with the number of hours. … every multiplier shuffles, so on a prime clock you can divide by any hour except 0."
- **low**, steps.ts:154: "None of Eratosthenes' own writing survives" goes too far. Fragments of his works survive, though nothing he wrote about the sieve does. Fix: "None of Eratosthenes' own account of the sieve survives: we know the method from Nicomachus of Gerasa, who described it about 300 years later." Source: https://www.encyclopedia.com/people/literature-and-arts/classical-literature-biographies/eratosthenes (fragments only remain). Nicomachus as the source of the account, Book I ch. 13: https://mathworld.wolfram.com/SieveofEratosthenes.html
- **low**, PowerScene.svelte:318–319: "With a 617-digit prime" sits next to "at most 4,094 multiplications". The 4,094 figure assumes a 2048-bit exponent, but 617-digit numbers range from 10⁶¹⁶ (2,047 bits) to almost 10⁶¹⁷ (2,050 bits). For the largest of them the bound is 4,098. Fix: `'With a 2048-bit (617-digit) prime instead of 101:'`. The note at steps.ts:217 already says "2048-bit (617-digit)", so this fix also makes the two consistent.

## Model issues
None found. `sieve`, `timesMap`, `powerWalk`, `fastPower` and `discreteLog` implement the textbook definitions. The tests check them against independent facts:
- the primes from OEIS and π(2000) = 303;
- multipliers shuffle the clock exactly when gcd(a, m) = 1;
- Fermat's little theorem, and that every order divides p − 1;
- `fastPower` agrees with `slowPower` for x = 1…1000;
- every narrative number is checked.

## Narrative and scene mismatches
- **low**, ClockScene.svelte:561–562: "powers can get stuck or collapse; on a prime clock they never do". The same scene contradicts this: on a prime clock with a base that is a multiple of it (e.g. base 13 or 26 on 13 hours) it shows "every power lands on 0", which is a collapse. Fix line 562: `` `or collapse; on a prime clock (base not a multiple of ${m}) they always return to 1.` `` If the line is too long, use `'or collapse; on a prime clock, unless the base is a multiple of it, they return to 1.'`

## Catalogue requirements
All requirements are met:
- The sieve can be stepped on a grid.
- The clock face offers add, multiply and powers, with an adjustable number of hours.
- Prime and non-prime moduli are compared through the multiplier chips and the powers verdicts.
- The takeaway is visible in the graphic: on the 101-hour clock, "78 tries" stands beside "9 multiplications".
- The model states the simplification of starting at 2p rather than p², and states that trial is not the best known attack.

## Clarity
- **low**, steps.ts:177: the symbol ≡ is used without being read aloud for a level-1 reader. Fix: "We write 9 + 5 ≡ 2 (mod 12), read '9 + 5 lands on the same hour as 2 on a 12-hour clock', where m = 12 is the modulus."
- **low**, steps.ts:215 against PowerScene.svelte:103/107: the scene shows "x = 77 = 1001101₂" and a "bit" column, but the body never mentions binary; only the "Go deeper" note explains it, and binary is not a prerequisite. Fix: add to the body after "77 = 64 + 8 + 4 + 1": "(the bit column in the drawing: 77 written in binary is 1001101, and each 1 picks a square)."

## Sources consulted
- https://mathworld.wolfram.com/SieveofEratosthenes.html (Nicomachus' account of the sieve, *Introduction to Arithmetic* I.13)
- http://staff.um.edu.mt/jmus1/Nicomachus.pdf (Nicomachus, *Introduction to Arithmetic*)
- https://www.encyclopedia.com/people/literature-and-arts/classical-literature-biographies/eratosthenes (only fragments of Eratosthenes' works remain)
- https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5146500 and https://ieeexplore.ieee.org/document/646120/ (Diffie and Hellman, "New Directions in Cryptography", Nov. 1976)
- https://arxiv.org/pdf/1905.09084 (Shor's algorithm computes discrete logarithms)
- My own Python recomputation: 2⁷⁷ mod 101 = 61, the powers of 2 mod 13, the squaring ladder mod 101, the discrete log of 61 = 77, and bit lengths of 10⁶¹⁶ and 10⁶¹⁷ of 2,047 and 2,050.
