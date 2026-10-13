<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.59 in tokens + 7 web searches -->
# Review: binary

## Verdict
The page is ready after a few small fixes. The model matches the reference behaviour. Unsigned, two's complement, ASCII/Latin-1, the 3-3-2, 5-6-5 and 8-8-8-8 colour formats, IEEE 754 half and single precision (including subnormals, infinity, NaN and the half-precision rounding) and the ripple-carry adder with both kinds of overflow are all correct. Every number quoted in the narrative is right: 65, −56/200, 0x41, 0.15625 = 1.25 × 2⁻³, 0.100000001490116…, 300 − 256 = 44, 2,147,483,647. The main fix is in the "Same bits, different meanings" step. Its text promises "a wildly different fraction", but at the step's default 8-bit width the float card only says "no 8-bit float".

## Factual errors
- **low** — steps.ts:172. The 3-bit red, 3-bit green, 2-bit blue split is right for the MSX2. But the MSX2 stored the bits in green-red-blue order (GGGRRRBB), while the graphic splits them as RRRGGGBB. A reader could take the graphic as the MSX2 layout. Fix: "…some computers (such as the MSX2) used 3 bits for green, 3 for red and 2 for blue (the eye is least sensitive to blue): only 256 colours. Here the bits are drawn in the order red, green, blue." Source: https://github.com/Konamiman/MSX2-Technical-Handbook/blob/master/md/Chapter4a.md
- **low** — steps.ts:221. "The carry out of the leftmost column has nowhere to go and is lost" simplifies what processors do. They keep that carry in a carry flag, which is how overflow gets detected and how wider numbers are added. The CPU topic builds on this page, so it is worth one clause: "…has nowhere to go in the byte and is dropped from the result (the processor notes it in a 'carry flag'), leaving 300 − 256 = **44**."

## Model issues
- **low** — binary.ts:92–100. Code 173 (Latin-1 soft hyphen) has `kind: 'latin1'`, and `String.fromCharCode(173)` draws nothing in most fonts, so the keycap comes out blank. Fix: add `if (byte === 173) return { text: 'SHY', kind: 'control' };` before the last return.
- **low** — e2e/binary-model.e2e.ts. The half-precision encoder `float16Bits` is checked at only a few points. Two cheap tests would check it properly:
  - a round trip over all 65,536 patterns: `for (let p = 0; p < 65536; p++) { const f = float(toBits(p,16))!; if (f.kind !== 'nan') expect(bitString(float16Bits(f.value))).toBe(bitString(toBits(p,16))); }`
  - ties to even: `expect(hex(float16Bits(1 + 2**-11))).toBe('3C00'); expect(hex(float16Bits(65520))).toBe('7C00'); expect(hex(float16Bits(65519))).toBe('7BFF');`

## Narrative and scene mismatches
- **medium** — steps.ts:196 and ByteScene.svelte:1583. The 'same' step uses the `width` control, which defaults to 8 bits. At that width the float card shows "no 8-bit float", so "a wildly different fraction" (and "every one of them changes") does not happen on screen. Fix: change the body to "Flip any bit and every reading changes, in completely different ways: a small change in the number can be a different letter and a very different colour. Choose 16 or 32 bits to see it as a fraction too, where the change can be enormous."
- **low** — steps.ts:221 and AdderScene.svelte:629–681. The text compares overflow to "a car's odometer rolling over from 999999 to 000000", but the graphic shows a 3-digit odometer going 999 → 000. Fix: "Like an odometer rolling over from 999 to 000, the count has wrapped round…"
- **low** — steps.ts:159. "So the byte that meant 65 a moment ago now means 'A'". The step just before is "Negative numbers" (1100 1000 = −56), so 65 was two steps back. Fix: "So 0100 0001, the byte that read as 65 two steps ago, now means 'A'."
- **low** — ByteScene.svelte:523. The label "accented letters (é = 233)" covers codes 160–255, but 160–191 are mostly symbols (£ © ° ½), and 215 and 247 are × and ÷. Fix: `{ at: 208, text: 'symbols, accented letters (é = 233)' }`.
- **low** — ByteScene.svelte:411. At 16 or 32 bits on the text and colour steps, the accessible name ("Bit worth 32768") gives the place value in the whole word, not in the byte or channel the reader is looking at. Fix: reuse the `placeLabels` value, e.g. `return \`Bit worth ${placeLabels[i].text.replace('^', ' to the power ')}\`;` for phases other than float and signed.

## Catalogue requirements
- All requirements are met. You can flip bits of 8-, 16- and 32-bit words and read them as unsigned, signed, text, colour and float. The adder animates the carries and both kinds of overflow. The takeaway is visible in the 'all' cards. The entry has no Needs or Pitfall.

## Clarity
- **medium** — ByteScene.svelte:633. The float header says "sign × significand × 2 to the power of the exponent". "Significand" is never explained in the body (steps.ts:183), which only says "fraction (the digits)", and this is a level-1 page. Fix the header: `'sign × 1.fraction × 2 to the power of the exponent'`. Or add to the body: "…and 23 bits the **fraction**: the binary digits after the point in a number 1.something, called the significand."
- **low** — steps.ts:210. "Full adders" is not explained, and logic gates come after this topic. Fix: "…a chain of tiny circuits called full adders, one per column, each adding two bits and a carry; …"
- **low** — steps.ts:222. "Read the same bytes as signed numbers and other sums overflow: 100 + 100…" The default bytes (200 and 100) read as −56 + 100 = 44, which does *not* overflow, so the reader has to move the sliders. Fix: "Switch to signed and the same bytes read −56 + 100 = 44, now correct. Other sums overflow instead: set 100 + 100…"

## Sources consulted
- MSX2 Technical Handbook, ch. 4 (SCREEN 8: one byte gives the intensity of 3 bits for green, 3 bits for ...): https://github.com/Konamiman/MSX2-Technical-Handbook/blob/master/md/Chapter4a.md
- ASCII history (The first edition of the standard was published in 1963, contemporaneously with the introduction of the Teletype Model 33. It later underwent a major revision in 1967): https://en.wikipedia.org/wiki/ASCII. Lowercase added in 1967: https://ldapwiki.com/wiki/Wiki.jsp?page=ASCII
- Unicode 16.0 total (bringing the total number of encoded characters in Unicode 16.0 to 154,998): http://blog.unicode.org/2024/05/unicode-160-beta-review-open.html
- Value of 0.1f (it is actually 0.100000001490116119384765625): https://randomascii.wordpress.com/2013/02/07/float-precision-revisited-nine-digit-float-portability/
- Gangnam Style counter (In December 2014, the video to the song "Gangnam Style", by South Korean artist PSY became the first clip on YouTube to garner so many views that the website's hit counter was unable to keep up.): https://www.guinnessworldrecords.com/world-records/381953-first-youtube-video-to-require-a-64-bit-counter, plus https://phys.org/news/2014-12-gangnam-style-youtube-limits.html
- 8-bit floats outside IEEE 754 (IEEE P3109 was approved for the IEEE P3109 working group to develop an official 8-bit float standard in February 2023, followed by the OCP formats): https://uwplse.org/2025/02/17/Small-Floats.html
- IEEE 754-2019 (binary16/binary32 field sizes, biases 15/127, reserved exponents); checked against the model and the tests' comparison with `Math.fround`.
