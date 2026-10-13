<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.47 in tokens + 5 web searches -->
# Review: complex-numbers

## Verdict
The page is ready after a few small fixes. The arithmetic, the history dates and the numbers quoted in the text are all correct (I recomputed (1 + iπ/10)¹⁰ ≈ −1.593 + 0.156i and (1 + iπ/100)¹⁰⁰ ≈ −1.051 + 0.001i). The model really does compute e^(iθ) from the power series and from compounding rather than from cos and sin, and the catalogue's interaction and takeaway are both built. The most important fix is in the product scene: the length readout "|zw| = |z| × |w| = …" is worked out from the slider values, not from the model's product, and it shows "=" for values that are rounded (for example "1.05 × 1.05 = 1.10"). So the readout assumes the rule the page is trying to show, and it sometimes states a false equality.

## Factual errors
Everything else checks out: Cardano 1545, Bombelli 1572, Descartes 1637, Wessel 1799 (presented 1797), Argand 1806, Cotes 1714, Euler 1748, and all the worked examples.

## Model issues
- **medium**, ProductScene.svelte:174 and :371. `lenText` and the zw row's `len: zLen * wLen, ang: sum` simply assert "lengths multiply, angles add". They are never measured from `zw = mul(z, w)`. The point itself is placed correctly (it comes from `mul`), but the numbers repeat the claim instead of checking it. Also, multiplying two lengths with 0.05 steps gives up to four decimals, so `num(…)` rounds and the "=" is false (1.05 × 1.05 = 1.1025 is shown as "= 1.10"; 1.45 × 1.35 = 1.9575 as "= 1.96"). This also contradicts the header comment at lines 17–18, which says the readouts are exact. Fix:
  ```ts
  const zwLen = $derived(abs(zw));            // measured from the product
  const zwAng = $derived(Math.round(reduce(arg(zw))));
  const lenText = $derived(`${num(zLen)} × ${num(wLen)} = ${short(zwLen, 4)}`);
  ```
  In the zw row, use `len: zwLen, ang: zwAng`, and print the length there with `short(row.len, 4)`. The "angles add" line (`angText`) and `turnsNote` can stay, because `turnsNote` already reconciles `sum` with the reduced angle. Change the header comment to say the products can have four decimals. Import `arg` and `short`.
- **low**, EulerScene.svelte:84. The fallback is `params.n ?? 6`, but the control's default is 3 (steps.ts:73). Make them match: `params.n ?? 3`.

The model is otherwise sound. The series converges for every θ used, the tests check real properties (Euler's formula against cos/sin, the error shrinking as n grows, |end| ≈ e^(θ²/2n), the quoted numbers), and the edge cases at z = 0 and n = 1 are handled.

## Narrative and scene mismatches
- **low**, steps.ts:201 against EulerScene.svelte:518. The text says 100 steps end "at −1.05", but the readout shows "−1.05 + 0.00i". Either change the text to "at −1.05 + 0.00i", or let `parts()` drop a zero imaginary part.

Otherwise the defaults match the worked examples (2 + i, i·(2 + i) = −1 + 2i, 1.40 × 1.25 at 20° + 45°), and the behaviour the text promises when you drag is what the scenes do.

## Catalogue requirements
- The interaction is built as written: you drag two points and the product shows angles adding and lengths multiplying, and the θ slider moves e^(iθ) with its parts drawn as cosine and sine curves. The takeaway is visible in the triangle copy, the readouts and the identity summary. There is no pitfall or Needs field for this topic, and the Related link to chaos-fractals is acknowledged in the notes.

## Clarity
- **low**, steps.ts:200. "A point just above 1" can be read as "a number slightly bigger than 1". Replace with "a point a short way straight up from 1 on the plane".
- **low**, steps.ts:188. The polar step showed φ in degrees, but z = |z| · e^(iφ) only works with φ in radians (the page's own note at line 189 makes this point for θ). Add the words: "z = |z| · e<sup>iφ</sup> (φ in radians)."

## Sources consulted
- https://cs.lmu.edu/~ray/notes/mandelbrotset/ (definition of the Mandelbrot set)
- https://www.mathwords.com/m/mandelbrot_set.htm (definition of the Mandelbrot set)
- https://en.wikipedia.org/wiki/Euler%27s_formula and https://proofwiki.org/wiki/Mathematician:Roger_Cotes (Cotes 1714, ln(cos θ + i sin θ) = iθ)
- https://en.wikipedia.org/wiki/Jean-Robert_Argand and https://arxiv.org/pdf/1504.04405 (Wessel 1797/1799, Argand 1806, Gauss)
- https://5010.mathed.usu.edu/Fall2015/TLarsen/History.html (Descartes 1637, "imaginary" meant as a put-down)
- My own recomputation in Python of (1 + iπ/n)ⁿ for n = 10 and 100, and of the length products.
