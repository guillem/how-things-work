<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.70 in tokens + 8 web searches -->
# Review: chaos-fractals

## Verdict
The page is ready after two small fixes. I re-ran the model in Python and the main numbers hold up. The pendulum equations match the standard ones and energy is conserved to about 5×10⁻⁹ over 40 s, even at 170°. The twins separate after 7.6 s at 0.001° and 11.95 s at 0.000001°, so "about four seconds longer" is right (the true figure is 4.3 s). The cascade constants, the escape test and the cardioid/bulb shortcuts are all correct. The most important fix is the "A tiny copy of the set" view in `TOUR`. It is centred on the copy's nucleus, which sits near its cusp, so the left part of the copy (its main side bulb, the smaller bulbs and the antenna) falls outside the frame. The same cropped view is used for the "tiny copy" inset.

## Factual errors
- **medium**, steps.ts:126. Saying "the same for every map with a single smooth hump" is too broad. Feigenbaum's δ is universal only for one-hump maps whose top is quadratic; a flatter top (for example x⁴) gives a different constant. **Fix:** "…it is the same for every map with a single rounded (quadratic) hump like this one…". Source: https://www.complexityexplorer.org/explore/glossary/122-feigenbaum-s-constants and https://en.wikipedia.org/wiki/Feigenbaum_constants
- **low**, chaos.ts:6–7 (code comment only). It cites "Taylor, Classical Mechanics, §11" for the full equations. Taylor's §11.4 covers only small oscillations of the double pendulum. The full nonlinear equations implemented here (I checked them term by term) are the ones in myPhysicsLab. **Fix:** "The equations of motion are the standard ones (derived e.g. at myphysicslab.com/pendulum/double-pendulum-en.html)". Sources: https://henry.pha.jhu.edu/chapters.html and https://www.myphysicslab.com/pendulum/double-pendulum-en.html

Everything else checks out:
- Lorenz in 1961, the restart from numbers rounded to three decimal places, and the 1972 AAAS talk title.
- May 1976.
- The doubling points 3, 3.449, 3.544 and 3.5699.
- The period-3 window opening at 1+√8 ≈ 3.828.
- Feigenbaum's constant 4.669 (1975).
- Mandelbrot's computer pictures in 1980 and the set's fame in the mid-1980s.

## Model issues
- **medium**, chaos.ts:263. The view `{ x: -1.7549, width: 0.04 }` spans −1.775 to −1.735. The copy of the set runs from its cusp at −1.75 to its tip near −1.79, with its main side bulb at about −1.769 to −1.778. I rendered the view: that bulb is cut by the left edge and the rest of the copy is missing. Meanwhile the right ~40% of the frame shows only the main set's filaments. The inset (MandelbrotScene.svelte:350) uses the same view. **Fix:** `{ id: 'minibrot', label: 'A tiny copy of the set', x: -1.768, y: 0, width: 0.05 }`. I checked this view: the whole copy fits, antenna included. Sources: https://en.wikipedia.org/wiki/Mandelbrot_set (the real-axis period-3 copy near −1.75) and https://www.aimsciences.org//article/doi/10.3934/dcds.2021075 (the window runs from r ≈ 3.828 to 3.857, which corresponds to c from −1.75 to ≈ −1.79).
- **low**, e2e/chaos-model.e2e.ts:17–21. The energy test allows a drift of 10⁻³. The notes promise "better than a millionth" and the readout promises "unchanged to 7 digits". The actual drift is about 5×10⁻⁹, so the test would not catch a regression of the claim that is actually shown to readers. **Fix:**
  ```ts
  for (const a of [10, 120, 170]) {
    const run = swing(a, a, 40);
    const e0 = energy(run[0]);
    for (const s of run) expect(Math.abs(energy(s) - e0)).toBeLessThan(1e-7 * e0);
  }
  ```

Everything else in the model is correct: the double-pendulum derivatives (equal masses and lengths), RK4, energy, the logistic period and Lyapunov logic, the cardioid and bulb tests, and the smooth escape count.

## Narrative and scene mismatches
- **low**, LogisticScene.svelte:414–416. "right at the split: it settles, but very slowly" appears for any r from 2.951 to 3.000. At r = 2.96 the map is not right at the split. **Fix:** change the text to `'close to the split: it settles, but very slowly'`.

Otherwise the text matches the graphic. The scene shows a growth factor of ×2.8 per second at 0.001°, a separation time of 7.6 s and a gap of 4.3 s for the 0.000001° nudge. The energy readout stays constant to 7 digits, and the cobweb, the cascade marks and the zoom of the 3-window all match the text.

## Catalogue requirements
All met. The twin pendulums diverge with visible trails and a log-scale separation plot. The slider runs through the cascade, and there is free zoom down to the limit of double precision. The takeaway is visible without reading the text.

## Clarity
- **low**, LogisticScene.svelte:696. The cascade readout shows "Lyapunov exponent …", a term the narrative never introduces. **Fix:** add to the cascade notes (steps.ts:126): "The readout's Lyapunov exponent measures how fast two nearby starts separate: positive means they drift apart exponentially (chaos), negative means they converge (order)."
- **low**, steps.ts:137. The text says z "stays close by", but the panel says "|z| passes 2: off to infinity" without explaining the 2. **Fix:** "…Either *z* stays close by for ever, or it shoots off towards infinity (once its distance from 0 passes 2, it is certain to escape)."

## Sources consulted
- https://www.myphysicslab.com/pendulum/double-pendulum-en.html (double-pendulum equations of motion)
- https://henry.pha.jhu.edu/chapters.html (Taylor, Classical Mechanics, table of contents)
- https://barrypopik.com/blog/does_the_flap_of_a_butterflys_wings_in_brazil_set_off_a_tornado_in_texas (Lorenz's 1972 talk title)
- https://www.complexityexplorer.org/explore/glossary/122-feigenbaum-s-constants and https://en.wikipedia.org/wiki/Feigenbaum_constants (universality needs a quadratic maximum)
- https://en.wikipedia.org/wiki/Mandelbrot_set and https://www.scientificamerican.com/article/mandelbrot-set-1990-horgan/ (history of the set)
- https://www.aimsciences.org//article/doi/10.3934/dcds.2021075 (period-3 window from 1+√8 to ≈ 3.857)
- My own numerical re-runs of chaos.ts in Python: energy drift, separation times and growth factors, the share of r in [3.57, 4] with a positive Lyapunov exponent (90%, which supports "for most growth rates"), orbit step counts for the tour points (22 and 5, as commented), and renders of the copy-of-the-set views.
