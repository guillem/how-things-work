<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.48 in tokens + 7 web searches -->
# Review: error-correction

## Verdict
The page is ready once a few small fixes are made. The Hamming model is correct. I checked every number the narrative quotes against the model: the 1011 → 0110011 encoding, the flip at position 5 failing checks 1 and 4, the double flip at 3 and 5 giving three wrong data bits, 66%/91% at 5% noise, 92%/99.6% at 1%, and the +75% cost. All of them match, and the tests check real properties of the code (minimum distance 3, and that it is a perfect code). **The most important fix** is the note that says the equal-flip-chance simplification only makes the real gain "somewhat smaller". On a power-limited radio link like the probe's, it removes most of the gain shown. A close second: the repair step tells the reader to "click any other single bit to move the error", but clicking adds a second flip instead.

## Factual errors
- **medium**, steps.ts:139 (and the header comment in hamming.ts:30–34): "with a fixed power budget each coded bit would be a little noisier, so the real gain is somewhat smaller." This understates the effect. If the energy per data bit is fixed (BPSK, hard decisions), each coded bit gets 4/7 of the energy, a loss of 2.43 dB. The DSP Log source makes the same point: comparing against uncoded Eb/N0 brings in another 2.43 dB. I computed the effect myself (my own calculation, high confidence under that standard model):
  - If the uncoded flip chance is 5%, the coded bits flip about 10.7% of the time. Letters then arrive intact 69% of the time with the code against 66% without, not 91%.
  - At 1% noise it is 94% against 92%, not 99.6%.
  
  The equal-flip-chance assumption is exact for storage, where each stored bit faces the same risk, but this page uses a radio link from a probe. Suggested replacement: "And both messages face the same flip chance per bit, as in a memory chip where every stored bit faces the same risk. On a radio link with a fixed power budget, each coded bit gets only 4/7 of the energy and flips noticeably more often; at the noise levels shown here that wipes out most of the gain, which is why radio links use much stronger codes than this one." Make the same change in the comment at hamming.ts:32–34. Source: https://dsplog.com/2012/03/15/hamming-code-soft-hard-decode/
- **low**, steps.ts:85: "In 1950 Richard Hamming, at Bell Labs, used…". The work began in 1947: "It was an event in 1947 that prompted Hamming to undertake his most famous piece of work." The paper appeared in April 1950 in the Bell System Technical Journal. Fix: "In the late 1940s Richard Hamming, at Bell Labs, used <em>several</em> parity checks that overlap (he published the idea in 1950)." Sources: https://amturing.acm.org/info/hamming_1000652.cfm, https://onlinelibrary.wiley.com/doi/10.1002/j.1538-7305.1950.tb00463.x
- **low**, steps.ts:87: "so they simply stopped." According to the accounts, the machine caught an error in its own self-checking circuits, dropped the work and moved on. The machine was the Model V relay computer, and Hamming only got time on it at weekends. Fix: "…so they abandoned his job and moved on to the next one, and he came back on Monday to nothing." Sources: https://www.thinkbrg.com/insights/publications/nervous-system-the-great-fixer-of-information-coding-errors/, https://quantumzeitgeist.com/richard-hamming/

The other claims check out: ECC memory with 8 check bits per 64 data bits (72, 64); Reed–Solomon in CDs, DVDs and QR codes (CDs, DVDs and Blu-ray Discs… They are also used in QR codes); Shannon 1948; and the (15, 11) and (31, 26) block sizes.

## Model issues
- No issues found. Encoding, the syndrome (XOR of the positions of the 1s), decoding, SECDED, the binary symmetric channel with fixed dice, and the odds formulas are all correct, and the limiting cases are tested. The only problem is the power-budget comment, covered above.

## Narrative and scene mismatches
- **medium**, steps.ts:99: "Click any other single bit, data or check, to move the error." In CodeScene, `toggleFlip` adds a flip, so the bit at position 5 stays flipped. The reader ends up with a double error and a wrong "repair", which is the opposite of what this step teaches. The "Flip a random bit" button on this step (and on `address`) does the same, because it always picks an unflipped bit. Fix the text to: "Click the flipped bit to undo it (or press <em>Undo all flips</em>), then click any other single bit, data or check, to put the error there." Also, for the `repair` and `address` steps, either use `controls: [clearFlips]`, or make the random button move the flip in those phases: in the `flipRandom` effect, when `phase === 'repair' || phase === 'address'`, call `setParam(flipKey, flipAt(n, pick))` instead of `toggleFlip(pick)`.
- **low**, CodeScene.svelte:598–612 against steps.ts:111: the text has the reader write the bits in the order "check 4, check 2, check 1". The panel, however, lists the checks top to bottom as 1, 2, 4 with their "→ 0 / → 1", so the binary number has to be read bottom-up. Line 622 does say "Checks 4 2 1 → 101", which makes this minor. Fix: in the `address` phase, iterate `[4, 2, 1]` in the panel list.

## Catalogue requirements
- All met: the reader encodes a message, flips single bits to see them located and repaired, flips two to see the code fail, and compares noisy-channel survival with and without coding. The takeaway is visible in the repaired and failed marks and in the curves.

## Clarity
- **low**, steps.ts:85: "Put the four data bits where three circles cross". Only bit 7 sits where all three circles cross; the other three data bits sit where two circles overlap. Fix: "Put the four data bits in the overlaps of three circles".
- **low**, steps.ts:125: "Computer memory with ECC" uses the acronym without expanding it. Fix: "Computer memory with error-correcting code (ECC) does exactly this…".

## Sources consulted
- https://onlinelibrary.wiley.com/doi/10.1002/j.1538-7305.1950.tb00463.x (Hamming, BSTJ 29(2), April 1950)
- https://amturing.acm.org/info/hamming_1000652.cfm (ACM Turing Award page: the 1947 origin)
- https://www.thinkbrg.com/insights/publications/nervous-system-the-great-fixer-of-information-coding-errors/ (the Model V weekend runs)
- https://quantumzeitgeist.com/richard-hamming/ (secondary: the machine dropped the job and moved on)
- https://simple.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction (Reed–Solomon in CDs, DVDs and QR codes)
- https://dsplog.com/2012/03/15/hamming-code-soft-hard-decode/ (the 2.43 dB rate penalty of the (7, 4) code)
- My own calculation (BPSK, hard decisions, Eb fixed): uncoded p = 1%, 5%, 10% gives coded flip chances of 3.9%, 10.7%, 16.6%, and letters intact coded/uncoded of 94/92%, 69/66%, 45/43%.
