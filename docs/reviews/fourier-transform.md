<!-- batch msgbatch_01KVdrkijDgMqYk6t9gq8uub, claude-opus-5-5, submitted 2026-10-12T01:05:27.464Z, ~$0.63 in tokens + 5 web searches -->
# Review: fourier-transform

## Verdict
The page is ready after the small fixes below. The model is a correct DFT. Its square, sawtooth, triangle and pulse spectra match the analytic series. The winding construction is the real transform, and the tests check real properties: linearity, odd-only harmonics, a falling error and the Gibbs limit. The most important fix is in the "Go deeper" note of the `wind` step. It says the length of the centre of mass "gives the amplitude", but the step's own text and the readout both say the amplitude is twice that length. The other fixes are an operation count that is too low by a factor of about 10 (FFT note), a slightly misstated piece of Gibbs history, and two wording problems.

## Factual errors
- **medium**, steps.ts:267: "a million samples take a few million operations rather than a trillion". N log₂N for N = 10⁶ is about 2 × 10⁷, so it is tens of millions, not a few million. Fix: "a million samples take some twenty million operations rather than a trillion". (This is arithmetic: 10⁶ × log₂10⁶ ≈ 1.99 × 10⁷.)
- **medium**, steps.ts:164: "asked about it in *Nature* and Josiah Willard Gibbs answered" suggests that Michelson asked about the overshoot and that Gibbs's answer explained it. In fact, the controversy began with a letter from Michelson to the editor of *Nature* in the fall of 1898, about how Fourier series of discontinuous functions behave at the jump. Gibbs's first reply did not report the overshoot: later that year he published a correction to that note in which the overshoot was described. Gibbs (1899) noted a correction on April 27, 1899. Fix: "it became famous in 1898–99, when Albert Michelson, whose mechanical harmonic analyser added up to 80 sine waves, questioned in *Nature* how a Fourier series behaves at a jump; Josiah Willard Gibbs replied, and in a correction of 1899 described the overshoot." The other facts in the note check out: Wilbraham 1848; the 80-component analyser (Stratton built in 1898 a harmonic analyzer having 80 components); and the Gibbs constant ((1/π)Si(π) − ½ = 0.08949).
- **low**, steps.ts:162: "slowly settling to 8.9%". The limit is 8.95%. Computed for this sum, the overshoot is 9.42% with frequencies up to 5 Hz, 9.01% up to 15 Hz and 8.96% up to 49 Hz, so the readout shows "9.0%" at the slider's maximum and never "8.9%". Fix: "slowly settling towards 8.95%".

Everything else checks out: the square series and 4/π; the sawtooth 2/(πn) with all phases at 180°; the triangle 8/(π²n²) with phases alternating; the missing 5th, 10th and 15th pulse harmonics and its average of −0.6; the 3 Hz removal making the top bulge upward; Cooley–Tukey 1965; Ptolemy c. 150 AD; JPEG and MP3 using cousins of the transform (DCT and MDCT).

## Model issues
- **low**, e2e/fourier-transform-model.e2e.ts: the note at steps.ts:177 claims specific phases: 0 for every square-wave circle, 180° for every sawtooth circle, and alternating 0°/180° for the triangle. The tests check only the square wave. Add:
  ```ts
  test('sawtooth phases are all π; triangle phases alternate 0, π', () => {
    const saw = waveSpectrum(shapeSamples('sawtooth', 1024));
    const tri = waveSpectrum(shapeSamples('triangle', 1024));
    const wrap = (p: number) => Math.atan2(Math.sin(p), Math.cos(p));
    for (const n of [1, 2, 3, 4]) expect(Math.abs(wrap(saw[n].phase))).toBeCloseTo(Math.PI, 9);
    for (const [n, p] of [[1, 0], [3, Math.PI], [5, 0], [7, Math.PI]] as const)
      expect(Math.abs(wrap(tri[n].phase))).toBeCloseTo(p, 9);
  });
  ```

Otherwise the model is sound: the DFT signs and normalisation are right, the Nyquist term has no partner, the phase offset (arg + π/2) is right for the sine convention, the winding uses e^{−2πiku}, epicycle frequencies run from −N/2 to N/2−1, and the stroke resampling is correct.

## Narrative and scene mismatches
- **medium**, steps.ts:209: "a complex number whose length gives the amplitude and whose angle gives the phase" contradicts the body (steps.ts:207: "twice its distance from the middle is the amplitude") and the readout ("strength of k Hz = 2 × …"). It also leaves out that, with the page's sine convention, the angle is the phase minus 90° (fourier.ts:96). Fix: "…a complex number whose length is half the amplitude (for k ≥ 1; at 0 Hz it is the average itself) and whose angle gives the phase (as a quarter turn behind, because the page measures phase on sine waves)."
- **low**, steps.ts:208: "at those whole numbers it equals the bars of the spectrum". At 0 Hz the strength plot shows |average| (0.6 for the pulse), while the bar is −0.6. Fix: "…it equals the bars of the spectrum (at 0 Hz, the size of the average)."
- **low**, steps.ts:250–251: the text says the curve is traced "once a second" and that circles turn "*k* times per second", but EpicycleScene.svelte:27 takes 12 s per trip and the scene never says it is slowed down. The phasor scene does say so (PhasorScene.svelte:233). Fix: add a muted label in EpicycleScene, e.g. `{@render txt(40, 610, \`Slowed down: one trip round the curve takes ${PERIOD} s here.\`, 12, { muted: true })}`, or change the text to "once per trip".
- **low**, SumScene.svelte:153 and :168: with frequencies up to 3 or 4 Hz, the highest point of the sum (1.20, a 10% overshoot) is at u = 0.375. That is just left of the inset's u0 = 0.38, so the scene reports "Too few frequencies for a peak at the jump yet" while the curve visibly overshoots. The code comment ("with 1 or 2 frequencies it is the hump at 0.25 s") is also wrong for 3 Hz. Fix: set `u0: 0.36` in `IN`, and change the comment to "with 1 or 2 Hz only, the highest point is the hump at 0.25 s".

## Catalogue requirements
All requirements are met:
- Drawing a waveform and drawing a closed curve both work.
- The rebuild works from sine waves (`terms`) and from rotating circles (`circles`), one frequency or circle at a time.
- The bar chart is editable and rebuilds the signal through the inverse transform.
- The takeaway is visible in the `draw-wave` and `draw-curve` graphics.
- There is no Pitfall or Needs field to satisfy.

## Clarity
- **medium**, steps.ts:222: "pull every bar but the first down to zero". The first bar on the chart is 0 Hz, and keeping only that bar leaves a flat line, not a sine wave. Fix: "pull every bar except the 1 Hz one down to zero, and a pure sine wave is left;".
- **low**, steps.ts:174 and :206: the in-text cross-references use titles the catalogue does not have. "*Sine, cosine and the unit circle*" should be "*Trigonometry & the unit circle*", and "*Complex numbers*" should be "*Complex numbers & Euler's formula*".
- **low**, steps.ts:176: for the pulse and many drawings, the chain starts off the middle line at the 0 Hz average, but the text never says so. Add after "…from the right starting angles": "(plus a fixed offset, the 0 Hz average, where the chain starts)."

## Sources consulted
- History of the Gibbs phenomenon (Herman, UNCW): https://people.uncw.edu/hermanr/mat463/Gibbs_Phenomenon.pdf
- Henri Poincaré Papers, on the Michelson correspondence: https://henripoincarepapers.univ-nantes.fr/chp/text/michelson.html
- ProofWiki, Gibbs phenomenon (historical note): https://proofwiki.org/wiki/Gibbs_Phenomenon
- Britannica, S. W. Stratton (the 80-component analyser): https://www.britannica.com/biography/S-W-Stratton
- Science Museum Group, Michelson 80-element harmonic analyser: https://collection.sciencemuseumgroup.org.uk/objects/co60126/michelson-80-element-harmonic-analyser
- Wikipedia, Henry Wilbraham: https://en.wikipedia.org/wiki/Henry_Wilbraham
- Numerical checks I ran: Si(π)/π − ½ = 0.08949; partial-sum overshoots for frequencies up to 3, 5, 7, 15, 25 and 49 Hz; and 10⁶·log₂10⁶ ≈ 2.0 × 10⁷.
