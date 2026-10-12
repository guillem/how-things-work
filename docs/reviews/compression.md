<!-- batch msgbatch_01BvqqPtzxfWhJdRYCvdSWHi, claude-opus-5-5, submitted 2026-10-12T06:58:04.959Z, ~$0.56 in tokens + 12 web searches -->
# Review: compression

## Verdict
The page is ready once the fixes below are made. I re-ran the model independently and the numbers the narrative quotes are right: 296, 148 and 114 bits; H ≈ 3.012 bits per symbol; n·H ≈ 111.4 bits; "s" = 01 and "b" = 10100; the hills at quality 50 come out 12.9 times smaller; noise at quality 100 comes out 1.05 times larger. The equations behind them (Annex K table, libjpeg scaling, zigzag order, DCT, DC/AC entropy coding) are also correct. **The most important fix** is the QualityScene caption for quality 90 and above. It says "almost every coefficient kept", but the model keeps only 24% of the landscape's coefficients at 90, and 48% even at 100. Beyond that, the page offers no real or loaded photograph (a catalogue requirement), and a few statements need tightening.

## Factual errors
- **low**, steps.ts:85 (surprise notes): the Morse example mixes two eras. Q = – – · – is International Morse, which grew out of Gerke's 1848 revision. Friedrich Gerke simplified Vail's code to produce the code adopted in Europe. The 1840s American code wrote Q differently (··–·). Fix: "Morse code, designed in the late 1830s, already followed this rule: E, the commonest letter in English, is a single dot and T a single dash, while rare letters are long (Q is – – · – in today's International Morse)." Sources: https://en.wikipedia.org/wiki/Morse_code, https://morsecode.world/american/morse.html
- **low**, steps.ts:142 (size notes): "on a message this short the table would take more space than it saves" overstates it. A canonical table for 11 symbols takes about 11 × (8 + 3) ≈ 121 bits. 114 + 121 ≈ 235 bits, which is still well below the 296-bit UTF-8 bar, and about equal to the fixed code plus its own alphabet. Fix: "…on a message this short the table would eat up most of the saving; real files are long enough for it not to matter." I'm moderately confident; the exact figure depends on how the table is coded. Source: https://en.wikipedia.org/wiki/Canonical_Huffman_code

Everything else checks out:
- Shannon 1951: Shannon showed in that the entropy of printed English should be bounded. between 0.6 and 1.3 bits/letter over 100-letter long sequences.
- Huffman's 1951 term paper for Fano's course: In 1951, David A. Huffman and his MIT information theory classmates were given the choice of a term paper or a final exam. The professor, Robert M. Fano, assigned a term paper on the problem of finding the most efficient binary code.
- JPEG in 1992: The text of CCITT Recommendation T.81 was approved on 18th September 1992.
- The libjpeg quality scaling: Qualities 1..50 are converted to scaling percentage 5000/Q.
- Also correct: the K.1 table, its maximum step of 121, the CLRS test case, and the 0.34-bit entropy of "aaaaaaaaaaaaaaab".

## Model issues
- **low**, compression.ts:356–361 (`jpegBits`): the comment's claim that the 16-bit length limit "never binds" checks out. Over qualities 10, 50, 90 and 100 on all three images, the longest Huffman code was 13 bits. The model also leaves out JPEG's reserved all-ones code word, which costs at most about a bit per rare symbol. Fix: add "and the reserved all-ones code word" to the list of ignored details. No code change is needed.
- **low**, MessageInput.svelte:44 vs shared.ts:20: `maxlength={MAX_LENGTH}` counts UTF-16 units, while `messageOf` and the counter count code points. With emoji, the box fills at 20 symbols while the counter reads "20 of 40 characters". Fix: drop `maxlength` and rely on `messageOf`'s truncation, or truncate in `oninput` with `[...v].slice(0, MAX_LENGTH).join('')`.
- Otherwise the model is sound: the DCT and IDCT with C(0) = 1/√2, the level shift, zigzag order, size categories, ZRL/EOB handling, DC prediction starting from 0, libjpeg's rounding and clamp to 1–255, the PSNR formula, and Huffman's tie-breaking and single-symbol cases. The tests check real properties: the Kraft equality, H ≤ L < H + 1, round trips, the CLRS textbook case, monotonicity in quality, and the Annex K identity.

## Narrative and scene mismatches
- **high**, QualityScene.svelte:180–181: "High quality: almost every coefficient kept, and the file grows quickly." The model keeps 24% of the landscape's coefficients at quality 90 and 48% at 100; for the drawing it is 27% and 30%. Only noise comes close (94% and 99.5%). Fix: `'High quality: small steps keep much more fine detail, and the file grows quickly.'`
- **low**, QualityScene.svelte:183: "Middle quality: …it is hard to see the difference" is shown for every image. At quality 50 the drawing scores PSNR 30.1 dB with visible ringing, and noise scores 22.8 dB. Fix: `'Middle quality: most fine detail dropped; on smooth pictures the difference is hard to see.'`
- **low**, steps.ts:116: "'s' and 'e' are joined last". The space has the same count as "e" (7) and is merged in the same step (merge 7); "s" goes in merge 8, and merges 9 and 10 join only internal nodes. Fix: "…'s', 'e' and the space are the last to be joined and stay near the top."

The other quoted numbers and behaviour match the scenes: 10 merges, 13 times smaller, 1.05 times larger, all 64 patterns giving the block back exactly, the end-of-block text, the error amplified 4 times, and the loupe.

## Catalogue requirements
- **medium**, steps.ts:3–14 and shared.ts:38: the Interaction says "**Load an image**", but the reader can only pick one of three generated images. The narrative (steps.ts:154) talks about photographs, yet none is shown. Fix: add a file input that decodes the image to grey, takes the luminance, and centre-crops and resizes it to 96 × 96 (a multiple of 8). Alternatively, include a documented public-domain photograph as a fourth option.

Everything else in the entry is met: the bits per symbol from frequency, building the Huffman tree, comparing encoded sizes, 8×8 blocks, and a quality slider that runs until the damage shows. The takeaway can be seen in the graphic. The Fourier-transform prerequisite is referenced, and the Related link to entropy is used.

## Clarity
- **medium**, steps.ts:97 and MessageScene.svelte:335: "no code that gives each symbol its own code word can average fewer than H". This is only true for codes that can be decoded unambiguously (Kraft–McMillan). Simply giving the commonest symbols 1-bit words breaks the floor but cannot be decoded. Fix: "no code that gives each symbol its own code word, and can still be decoded unambiguously, can average fewer than H bits per symbol". On the stage: "the least any decodable code of single symbols can use". Source: https://marco-dalai.unibs.it/pub/DL_TR_2008-01-51.pdf
- **medium**, steps.ts:168 and BlockScene.svelte:235: "The top-left coefficient (the DC term) is the block's average brightness", and the stage label "DC: the average". The grid actually shows values like −300, because the coefficient is 8 × (average − 128). The level shift is never explained in the body. Fix: "The top-left coefficient (the DC term) stands for the block's average brightness: JPEG first subtracts 128 from every pixel, so it is 8 × (average − 128)." Change the label to "DC: 8 × (average − 128)".

## Sources consulted
- C. E. Shannon, "Prediction and Entropy of Printed English" (1951): https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf; https://arxiv.org/pdf/0911.2284
- Huffman's history: https://www.cs.nmsu.edu/historical-projects/Projects/18920140825Huffman.pdf; https://simple.m.wikipedia.org/wiki/Huffman_coding; A. Moffat, "Huffman Coding", ACM Computing Surveys: https://dl.acm.org/doi/fullHtml/10.1145/3342555
- ITU-T T.81 (09/92): https://www.w3.org/Graphics/JPEG/itu-t81.pdf
- libjpeg `jcparam.c`: https://fuchsia.googlesource.com/third_party/libjpeg-turbo/+/refs/tags/jpeg-8b/jcparam.c; https://sourcevu.sysprogs.com/stm32/Libraries/LibJPEG/files/source/jcparam.c
- Morse code: https://en.wikipedia.org/wiki/Morse_code; https://morsecode.world/american/morse.html; https://www.electronics-notes.com/articles/history/morse-code-telegraph/morse-code-development-history.php
- Kraft–McMillan and the entropy bound: https://marco-dalai.unibs.it/pub/DL_TR_2008-01-51.pdf
- Canonical Huffman tables: https://en.wikipedia.org/wiki/Canonical_Huffman_code
- My own re-run of the model (a Python port of `makeImage`, `jpeg`, `jpegBits` and `huffman`) for all the figures quoted above.
