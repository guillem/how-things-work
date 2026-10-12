<!-- batch msgbatch_01BvqqPtzxfWhJdRYCvdSWHi, claude-opus-5-5, submitted 2026-10-12T06:58:04.959Z, ~$0.49 in tokens + 6 web searches -->
# Review: calculus

## Verdict
The page is ready after the fixes below. The maths, the constants and the numbers the text quotes all check out: 5.906, 8.865, 9, 2.86 (= 9/π), 11.025 m, the chord slopes 3, 2.5, 2.1 and 2.01, and the spline and Simpson code. The interaction matches the catalogue entry. The most important fix is in the "converge" step. The page offers a curve picker there, but its rule "double the rectangles and the error halves" is false for two of the five curves. For the thrown ball, the left-sum error drops to a quarter at each doubling. For the wave, the error is exactly 0 at every n. The readout ("error ÷ 4.0", "error = 0.00") then contradicts the text.

## Factual errors
- **medium**, steps.ts:230. "Gravity takes away 9.8 m/s of its **speed** every second" is wrong after the top: on the way down the ball's speed *increases*. Only the upward velocity drops by 9.8 m/s each second. The equation also ignores air resistance, and the page doesn't say so, although the catalogue asks for simplifications to be stated. Fix: "Ignoring air resistance, gravity takes 9.8 m/s off its upward velocity every second (once that reaches zero, the ball falls ever faster), so its height after <i>t</i> seconds is …"
- **medium**, steps.ts:224 (title "Speed and distance"). The scene shows velocity (signed) and height gained. The area under velocity is displacement, not distance: at t = 3 s it is 0 m, while the ball has travelled 22.05 m. Fix the title: "Velocity and height".
- **low**, steps.ts:230. "invented … in the late 17th century, largely to describe motion" fits Newton (fluxions, 1665–66) but not Leibniz, who worked from tangents and sums of areas (∫ in 1675, published 1684). Fix: "Calculus was developed independently by Isaac Newton (from the 1660s) and Gottfried Leibniz (from the 1670s); Newton built his version to describe motion." Sources: https://en.wikipedia.org/wiki/Method_of_Fluxions, https://amsi.org.au/ESA_Senior_Years/SeniorTopic3/3b/3b_4history_2.html
- **low**, steps.ts:141. "Position changing over time has a speed". The derivative of position is velocity; speed is its size. Fix: "has a velocity".
- Checked and correct: Riemann's dates (1826–1866), ∫ as a long s for *summa*, and standard gravity 9.80665 m/s² from the 3rd CGPM in 1901.

## Model issues
- None found. The spline system, the Thomas solve, the formulas for the spline and its derivative, the Riemann sums, Simpson's rule (whose panels line up with the 0.6 knot spacing, so it is exact on the spline) and every preset derivative are correct. The tests check real properties: the convergence orders, the fundamental theorem in both directions, and the numbers the text quotes.
- **low**, e2e/calculus-model.e2e.ts. Nothing tests the error ratio for the ball or the wave, which is how the problem described below went unnoticed. Add a test such as `expect(err_ball(100,'left')/err_ball(200,'left')).toBeCloseTo(4,1)` once the narrative covers that case.

## Narrative and scene mismatches
- **high**, steps.ts:166 against AreaScene.svelte:304. "Double the rectangles and the error halves" is stated as a general rule, on a step that offers the curve picker. I computed the left-sum errors:

  | Curve | Ratio per doubling of n |
  |---|---|
  | x² | 1.91 → 2.0 |
  | Cubic | 2.0 |
  | Ball | 4.0 |
  | Wave | error is exactly 0 for every n, because it is a full period |

  The left/right error is about (b−a)/(2n)·(f(b) − f(a)), so it halves only when the curve ends at a different height from where it started. Fix: "Under <i>x</i>², the gap shrinks in a regular way: <strong>double the rectangles and the error halves</strong>. … (On a curve that ends at the same height it started, like the thrown ball, the slivers on the way up and on the way down cancel, and the error drops much faster.)" Source: https://www.math.uh.edu/~jiwenhe/Math1432/lectures/lecture11_handout.pdf
- **medium**, steps.ts:89 against SlopeScene.svelte:108–110, 331. On the first step (h = 1), the text says "further right the chord gets steeper". But once x passes 2, the chord switches to the point on the *left*. The slope readout then jumps from 5.00 to 3.02 and climbs back only to 5 at x = 3. The note "chord to a point on the left" appears only in the secant phase. Fix: change line 331 to `{#if phase === 'secant' || back}` and render the text as `back ? 'chord to a point on the left' : …`. Also add to the body: "(near the right end, the chord goes to the point one step to the left)".
- **medium**, steps.ts:154, 165, 192 (and 102). The curve choice and the point x are shared params. The "your-curve" step asks the reader to drag knots, which switches `curve` to 'custom'. The area chapter then opens on the custom curve while its text quotes x² values (5.9, 8.87, 9). I am fairly confident of this, assuming the framework keeps params across steps, as the "shared with the slider" comments suggest. Fix: start the rectangles step with "Pick <i>x</i>² again if you changed the curve." Alternatively, have the step reset `curve` to the default.
- **low**, steps.ts:128. "Where the top curve is steepest, the slope curve peaks" is only half true. Where the curve falls most steeply (the cubic and the wave at x = 1.5), the slope curve has its *lowest* point. Fix: "where the top curve is steepest, uphill or downhill, the slope curve reaches its highest or lowest value."
- **low**, steps.ts:180. "Its rectangles have negative heights": the integral step draws no rectangles. Fix: "its rectangles (one step back) have negative heights".

## Catalogue requirements
- All met. The tangent, a slope curve on an editable spline, the n slider with convergence, and the running area with its slope equal to f (shown by the tangent on A and the two readouts) are all built. Related `newtons-laws` is linked. There is no pitfall to avoid and no external data is needed. The one gap is that the air-resistance simplification is not stated (see Factual errors).

## Clarity
- **low**, steps.ts:128. "A cosine" hides the change of scale. The preset 3 sin(2πx/3) has slope 2π cos(2πx/3), with amplitude about 6.3 rather than 3, and the reader sees this in the slope plot. Fix: "a cosine (taller here, because this wave is squeezed to fit one period into 0–3)."
- **low**, steps.ts:207. "Find a function whose derivative is the curve" leaves out the subtraction F(b) − F(a). It works here only because A(0) = 0. Fix: "…find a function F whose derivative is the curve; the area from a to b is then F(b) − F(a). For x², F = x³ ÷ 3, so ∫₀³ x² dx = 3³ ÷ 3 − 0 = 9."

## Sources consulted
- https://mathshistory.st-andrews.ac.uk/Biographies/Riemann/ and https://www.britannica.com/biography/Bernhard-Riemann (Riemann's dates)
- https://www.math.hawaii.edu/~tom/history/calculus.html (∫ as a long s for "summa")
- https://www.oxfordreference.com/display/10.1093/acref/9780198832102.001.0001/acref-9780198832102-e-9559 (standard gravity, 3rd CGPM 1901)
- https://en.wikipedia.org/wiki/Method_of_Fluxions and https://amsi.org.au/ESA_Senior_Years/SeniorTopic3/3b/3b_4history_2.html (Newton 1665–66, Leibniz published 1684)
- https://www.math.uh.edu/~jiwenhe/Math1432/lectures/lecture11_handout.pdf and https://www.math.drexel.edu/~tolya/notes_riemann_sums.pdf (error estimates for left, right and midpoint sums)
- My own calculation of the Riemann sums for all presets (the error ratios in the table above) and of the chord slopes for x near 2.
