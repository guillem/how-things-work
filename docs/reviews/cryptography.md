<!-- batch msgbatch_01YMk1ioZ9GYz6mtQ3M1u6qt, claude-opus-5-5, submitted 2026-10-12T02:18:49.249Z, ~$0.70 in tokens + 12 web searches -->
# Review: cryptography

## Verdict
The page is ready after the fixes below. I recomputed every number the narrative quotes and they are all correct: 2²⁹ mod 101 = 59, 2⁶⁴ mod 101 = 79, both keys = 37 (= 2⁵⁶), dlog(59) = 29 so Eve needs 30 tries, 52 trial divisions, 17 × 2753 = 15 × 3120 + 1, 617 digits, 10³⁰⁸, 4,094 multiplications, and "noon"/"moon" differ in 134 bits. The SHA-256 code and the historical records are also correct. The most important fix is about Eve. Step 1 defines her as a listener who cannot change anything. The signature chapter then has her rewriting messages, and the Diffie–Hellman chapter never says the exchange only protects against an Eve who listens. A Level-2 reader could leave thinking unauthenticated Diffie–Hellman is enough against someone who can tamper with messages.

## Factual errors
- **medium**, steps.ts:84. The definition of eavesdropper ("…but cannot change the people at either end") is garbled, and it contradicts steps.ts:221/235 and RsaScene.svelte:509–521, where Eve changes the message. Fix: `data-def="Someone who can read every message on the channel. Later on this page, Eve will also try to change messages on the way."`
- **low**, steps.ts:97. "AES … encrypts almost all internet traffic" overstates it. TLS 1.3 (RFC 8446 §9.1) also defines ChaCha20-Poly1305, which is widely deployed, and the standard says it should not be disabled. Fix: "AES, standardised in 2001, encrypts most internet traffic today." Source: https://www.rfc-editor.org/rfc/rfc8446#section-9.1
- **low**, steps.ts:172. "the record is a 240-digit prime, broken in 2019": a prime isn't "broken". Fix: "the record is a discrete logarithm modulo a 240-digit prime, computed in 2019…". Wikipedia records that this record for integers modulo prime numbers, set in December 2019, is a discrete logarithm computation modulo a prime with 240 digits. Source: https://en.wikipedia.org/wiki/Discrete_logarithm_records
- **low**, steps.ts:223 (note). Euler's argument is stated only "for x sharing no factor with n". About 3.5% of hashes mod 3233 are multiples of 53 or 61 (1 − 3120/3233 ≈ 0.035), so a careful reader may think those messages can't be signed. The identity in fact holds for them too, by the Chinese remainder theorem. Fix: append "(it also holds for the few x that do share a factor, by a slightly longer argument)."
- **low**, crypto.ts:18–19 and 296 (code comment, not shown to the reader). The current Wikipedia article no longer uses d = 2753. Its worked example now uses Carmichael's λ: "yielding d=413, as 1=(17×413)mod780". The pair d = 2753 with φ = 3120 is the older, also valid, version, matching how φ(N)=3120 … yielding d=2753 appears in other references. Fix the comment: "the classic textbook example using φ(n) = 3120 (older editions of the Wikipedia article; it now uses λ(n) = 780, d = 413)." Source: https://handwiki.org/wiki/RSA_(cryptosystem)

Everything else checks out:
- RSA-250, 829 bits, February 2020, about 2,700–2,900 core-years.
- The 795-bit DLP-240 record, about 3,100 core-years.
- Williamson in 1974, Cocks in 1973, both declassified in 1997.
- FIPS 180-2 dated August 2002; FIPS 180-4 from 2015.
- NIST: 2048-bit keys give 112 bits of security, acceptable through 2030.
- Shannon's proof published in 1949; post-quantum standards published in 2024.

## Model issues
- **low**, crypto.ts:222–232. In the paint model, mixing is a weighted average in log space, so Eve can compute the shared colour exactly from what she saw. In log space, shared = (2·M_A + 2·M_B − C)/3. That is not something she can pour, but it is easy arithmetic. The note (steps.ts:135) already admits that real paint could be analysed, so this only needs one sentence. Fix: append to the note: "In this drawing's model, Eve could even compute the shared colour by arithmetic on the three colours she saw; paint is only a picture of the idea."
- **low**, HashScene.svelte:60. `prefixSearch` runs synchronously on the main thread every time a key is pressed in the search step. At 4 digits that is about 65,000 SHA-256 calls on average (up to 2²⁰), which can make typing stutter. Fix: debounce the input or memoise on `(hex, k)`. If `found` is ever null, show "not found within 1,048,576 tries" rather than "found one".
- **low**, e2e/cryptography-model.e2e.ts. The tests check real properties: NIST test vectors, agreement with Node's SHA-256, the avalanche effect, the 16ᵏ search cost, the textbook Diffie–Hellman example and the RSA identity. Nothing pins the numbers the narrative quotes, so a change to the defaults would silently make the text wrong. Add:
  ```ts
  test('numbers quoted in the narrative', () => {
  	const k = diffieHellman(29, 64);
  	expect([k.A, k.B, k.aliceKey]).toEqual([59, 79, 37]);
  	expect(eveSearch(59).tries).toBe(30);
  	expect(trialFactor(RSA.n).tries).toBe(52);
  	expect(RSA.e * RSA.d).toBe(15 * RSA.phi + 1);
  });
  ```

## Narrative and scene mismatches
- **medium**, steps.ts:159 and 171. The text hard-codes 79²⁹ = 37, 59⁶⁴ = 37, "2ᵃ mod 101 = 59" and "30 tries". Both steps have sliders, and the scene updates when they move, so the text and the graphic then disagree. Fix:
  - 159: "With a = 29 and b = 64, Alice raises Bob's number to her secret…"
  - 171: "With a = 29, Eve knows 2ᵃ mod 101 = 59 … Here that takes her 30 tries (the counter shows the count for the slider's value)…"
- **low**, steps.ts:121. "Alice sends orange, Bob sends a green" is true only for the default paints. With violet, Bob's mixture renders as tan (#b87149). Fix: "With red and blue, Alice sends orange and Bob sends a green."
- **low**, steps.ts:197 and HashScene.svelte:271–273. "The count of differing bits always hovers around 128" fails when the two boxes are identical (0 bits). Fix: "…as long as the two texts differ, the count hovers around 128."
- **low**, HashScene.svelte:50–56. `charDiff` compares characters by position, so inserting one character reports "14 characters apart". Fix: compute the Levenshtein distance, or label it "characters in different positions".

## Catalogue requirements
All met:
- The paint exchange, then modular arithmetic on small numbers, with Eve seeing everything.
- One-character edits that change the hash.
- Signing and verifying with a tamper box.
- A Summary scene that shows the takeaway visually.
- Links to both prerequisites (binary, primes-modular-arithmetic) in the body.

## Clarity
- **medium**, steps.ts:160 ("Alice and Bob now share a key they never sent") and steps.ts:246. Nothing says this works only against an Eve who listens. A non-authenticated Diffie-Hellman exchange is susceptible to active attackers, i.e., attackers who are capable of intercepting the ECDHE values and substitute them with their own values. This is exactly the link between the two halves of the page. Fix: append to dh-shared: "This beats an Eve who only listens. An Eve who can also change messages could run one exchange with Alice and another with Bob, posing as each to the other. Stopping her needs a way to prove who sent a number: the signatures of the last chapter." Then start the sign chapter (steps.ts:221) with: "Now give Eve more power: she can change messages on the way." Source: https://arxiv.org/pdf/1510.08007

## Sources consulted
- https://en.wikipedia.org/wiki/Discrete_logarithm_records
- https://caramba.loria.fr/dlp240-rsa240.txt
- https://csrc.nist.gov/csrc/media/presentations/2024/crclub-2024-03-20/images-media/crypto-club-20240320-Emmanuel-Thome--IF-DLog-NFS.pdf
- https://en.wikipedia.org/wiki/Malcolm_J._Williamson
- https://en.wikipedia.org/wiki/RSA_(cryptosystem), https://handwiki.org/wiki/RSA_(cryptosystem)
- https://en.wikipedia.org/wiki/Clifford_Cocks
- https://csrc.nist.gov/files/pubs/fips/180-2/final/docs/fips180-2.pdf
- https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-131Ar2.pdf (NIST SP 800-57 key-size status)
- https://www.rfc-editor.org/rfc/rfc8446#section-9.1
- https://arxiv.org/pdf/1510.08007
- I also recomputed the page's numbers myself (modular powers, discrete log, avalanche bit count, one-time-pad bytes, paint colours, square-and-multiply counts, digit counts) with Python's `hashlib` and `pow`.
