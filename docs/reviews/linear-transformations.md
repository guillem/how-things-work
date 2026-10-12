<!-- batch msgbatch_01KVdrkijDgMqYk6t9gq8uub, claude-opus-5-5, submitted 2026-10-12T01:05:27.464Z, ~$0.62 in tokens + 4 web searches -->
# Review: linear-transformations

## Verdict
The page is ready once a few small fixes are made. I recomputed every number the narrative quotes and found no factual errors in the main text: the 30° rotation columns, both determinant examples, the eigenvalues and eigenvectors, both matrix products, the box proof of ad − bc and the power-method lengths. The model is correct and its tests check real properties. The most important fix is on the "follow" step. Its v slider still says "Or drag the tip of v", but v has no handle in that scene. The second fix is that the same step uses "a linear transformation keeps scaling and adding intact" as its key argument, and that idea only appears in the optional "Go deeper" note of the step before.

## Factual errors
- **low**, steps.ts:189 (matrix note): "it uses 4 × 4 matrices so that the same multiplication can also shift objects and add perspective." Shifting is done by the multiplication alone. Perspective also needs the division by the fourth coordinate (w) that comes after the multiplication. Replace with: "it uses 4 × 4 matrices so that the same multiplication can also shift objects and, followed by a division by the fourth coordinate, add perspective." Source: MDN, WebGL model view projection (https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection), and Angel, §5.4.1 (https://www.cs.unm.edu/~angel/AW/chap05c.pdf).

All other checked claims are correct.

## Model issues
- **low**, TransformScene.svelte:230: `K = Math.min(30, …)` caps the moved grid at ±30 lines. When a matrix is close to singular, the grid only covers a band 30·s_min wide in the squashed direction. For example, with s_min = 0.1 the band is ±3 units, so the edges of the clipped square go blank even though the transformation still fills the plane. This shows during the tween into "Flatten" and when the reader drags close to det 0. Fix: `const K = Math.min(150, Math.ceil(7.4 / Math.max(smin, 0.05)));`. At most about 600 segments, which is still cheap.
- **low**, TransformScene.svelte:279–285 `dir()`: it divides by the smaller component. A nearly horizontal eigenvector such as (0.9999, 0.014) is shown as "(70.71, 1)". Fix: when `Math.min(|x|,|y|) / Math.max(|x|,|y|) < 0.2`, divide by the larger component instead, giving "(1, 0.01)".
- **low**, TransformScene.svelte:149 and doc comment line 21: the comment says "flip" moves in "from the square grid", but `introFrom` is the previous matrix whenever the scene is already mounted. If the reader left the determinant step with a negative determinant, the intro goes from one flipped matrix to another. The determinant never crosses 0, so the promised "squashed flat … opens out again — mirrored" never happens. Fix:
  ```ts
  const flipBad = step.hints?.phase === 'flip' && det(shown.current) <= 0;
  introFrom = mounted && !flipBad ? shown.current : I2;
  ```
  (`det` needs adding to the import list.)

The tests are sound: linearity, columns as images of the basis, det(AB) = det A · det B, areas via the shoelace formula, all four eigen cases, and convergence of the power method.

## Narrative and scene mismatches
- **medium**, steps.ts:14 (used by the "follow" step, steps.ts:170): the `vx` help text "Or drag the tip of v (or focus it and use the arrow keys)" is wrong in TransformScene, where v is drawn but has no handle. Fix: add `const vxFollow: Control = { ...vx, help: 'Here v is set with the sliders; drag î and ĵ on the stage.' };` and use `controls: [vxFollow, vy]` at line 170.
- **low**, steps.ts:160: "Watch the grid move at the start" only happens when the scene opens fresh (a deep link, or arriving from "basis"). Coming back from "follow", `introFrom` is the current matrix and nothing moves. Either reword to "When you arrive from the previous chapter, the grid moves…", or in phase `drag` always start the intro from `I2` when the shown matrix equals the default.
- **low**, TransformScene.svelte:1019: the compose panel always shows "det: 1 × 1 = 1", because both R and S have determinant 1. So the graphic cannot show the claim at steps.ts:291 that determinants multiply. Add to steps.ts:291: "(here both are 1: a rotation and a shear keep areas, so the product does too; try it in the last step with any two matrices)". Better still, show it with a non-unit example.
- **low**, TransformScene.svelte:406: the verdict names the limit direction as "(2, 1)", but the table above lists directions as angles, so the reader cannot match them. Fix: `` `heading for ${dir(big.vector)} (${num(angleOf(big.vector), 1)}°), the` ``.
- **low**, TransformScene.svelte:777 and 786: with a negative vy the panel reads "+ −1·ĵ" and "+ −1·(…)". Fix: build the sign like PlaneScene does: `` `${vy < 0 ? '−' : '+'} ${n2(Math.abs(vy))}·` ``.
- **low**, PlaneScene.svelte:250: "s·v = (−1 × −2, …)" puts negative factors without brackets. TransformScene brackets them with `f()`. Fix: wrap negatives in brackets, e.g. `const fb = (n: number) => (n < 0 ? `(${num(n)})` : num(n));`, and use `fb(s)`, `fb(vx)`, `fb(vy)`.

## Catalogue requirements
Everything checks out:
- Dragging î and ĵ moves the grid, the F and the matrix together.
- The area and eigenvector toggles exist and are both available together on the last step.
- The takeaway can be seen: the matrix columns are coloured like î and ĵ, and the readouts give where each one lands.
- Related `pagerank` is tied in naturally on the "repeat" step.

## Clarity
- **medium**, steps.ts:172: "A linear transformation keeps scaling and adding intact" is the whole argument for the step. But the body of "transform" defines linearity only through grid lines; scaling and adding appear only in the optional note (line 162). Add to the body at line 159, after the three rules: "Equivalently, it respects scaling and adding: transforming s·v gives s times the transformed v, and transforming v + w gives the sum of the transformed v and w."
- **low**, steps.ts:276 (power method definition): "the eigenvector with the biggest eigenvalue" should be "the eigenvalue biggest in size". With eigenvalues −3 and 2, the method finds −3. Replace with: "Finding the eigenvector whose eigenvalue is biggest in size (ignoring its sign) by applying the matrix over and over to a starting vector." Source: TU Delft Interactive Linear Algebra, §9.3 (https://interactivetextbooks.tudelft.nl/linear-algebra/Chapter9/PowerMethod.html).
- **low**, steps.ts:276: "Any starting vector is a mix of the two eigenvectors … the first part soon swamps the second" fails for a start exactly along (1, −1). Replace "Any starting vector" with "Almost any starting vector" and add "(one lying exactly along (1, −1) would stay there)".
- **low**, steps.ts:249: the symbol I in "M − λI" is never introduced; the identity matrix is defined at line 206 only in words. Replace "M − λI" with "M − λI (I is the identity matrix)" on first use.
- **low**, steps.ts:249: "A quadratic can have two, one or no real solutions — which is the next step" leaves out the fourth case the next step shows (all directions). Append: "and when there is one repeated solution, the matrix has either one eigen-direction or, if it scales everything equally, all of them."

## Sources consulted
- MDN, WebGL model view projection (homogeneous coordinates, perspective divide): https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection
- E. Angel, *Interactive Computer Graphics*, §5.4.1 Perspective Projections: https://www.cs.unm.edu/~angel/AW/chap05c.pdf
- TU Delft Interactive Linear Algebra, §9.3 The power method: https://interactivetextbooks.tudelft.nl/linear-algebra/Chapter9/PowerMethod.html
- Ermann, Frahm & Shepelyansky, "Google matrix analysis of directed networks" (PageRank as the eigenvector with λ = 1, found by power iteration; confirms steps.ts:277): https://arxiv.org/pdf/1409.0428
- I recomputed by hand the arithmetic for both determinant examples, the characteristic polynomial and eigenvectors of (2 1; 0.5 1.5), the products SR and RS, the F area (2.25), and the lengths of the iterates M^k(−1, 1.5).
