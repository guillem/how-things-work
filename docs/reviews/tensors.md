<!-- batch msgbatch_017hL5Evcpu2H2rKrF7BLEhi, claude-opus-5-5, submitted 2026-10-15T04:42:11.927Z, ~$0.85 in tokens + 7 web searches -->
# Review: tensors

## Verdict
The page is ready after the fixes below. I checked every number in the physics chapter: (4, 3) N has length 5 N, trace 100 MPa, determinant 700 MPa², principal stresses 92.4 and 7.6 MPa at 22.5°, Rᵀ and Rᵀ σ R, the 180° behaviour, the matrix–vector result (1, 4, 2), the einsum strings and the reshape and transpose offsets. All are correct, and the tests check real properties (Mohr's-circle formulas, invariants, traction t = σn giving the same arrow in any axes). The most important fix is the description of the colour channels. I decoded the 48 × 36 × 3 array in `macaw.ts`, and it contradicts what the text tells the reader to look for. In the green layer the leaves are only mid-grey (mean green value 100); the yellow feathers (mean 192) and the pale patches are the brightest parts. So "with 0, 1, 0 the leaves [glow]" is not what the graphic shows.

## Factual errors
- **high**, steps.ts:235. "the leaves behind it in the green one, its tail in the blue one" does not match the photo's data. The 234 leaf pixels (green the largest channel) average green = 100 (maximum 203). The 116 yellow-feather pixels average green = 192. Only 1 % of the 100 brightest green-channel pixels are leaf. The 100 brightest blue-channel pixels are near-white (mean RGB ≈ 188, 187, 204), not a blue tail. I am confident about green; about blue, I cannot confirm from the array that any blue tail is visible. Replacement: "Watch the picture come apart into its three <dfn …>channels</dfn>: the red feathers are bright in the red layer and nearly black in the other two, the yellow feathers are bright in both red and green, and the pale patches are bright in all three. The leaves behind the bird are only mid-grey, even in the green layer."
- **medium**, steps.ts:371, FrameScene.svelte:814, 833–834. "there is no rule, and its numbers stay put" contradicts the page itself. A scalar is a physics tensor whose rule *is* "stays put", so three numbers that stay put look like three scalars obeying a rule. The real point is that the pixel's axis is not a direction in space, so turning the axes does not mix its numbers the way it mixed F's.
  - steps.ts:371: "The colour of a pixel, (red, green, blue), is an array with one axis too, but that axis lists colours, not directions in space. Turning the axes does not mix its numbers the way it mixed F's, so it is not a vector in the physicist's sense, just three separate numbers. Every physics tensor can be stored as an array, but not every array is a physics tensor."
  - Scene lines 833–834: "its axis is colour, not a direction in space:" / "turning the axes doesn't mix its numbers".
  - Readout note at 814: "not a vector of space: turning the axes doesn't mix its numbers".

Everything else checks out:
- The photo is 750 × 1002 and is a Scarlet Macaw at Combe Martin. Commons describes it as "Scarlet Macaw ( Ara macao ) at Combe Martin Wildlife and Dinosaur Park, North Devon, England", and it lists the original file (750 × 1,002 pixels.
- "Physicists used the word first": the word tensor in its current meaning was introduced by Woldemar Voigt in 1898.
- Structural steel yielding at about 250 MPa: ASTM A36 has a yield strength of 250 MPa (36 ksi).
- BT.601 weights: EY′ = 0.299 ER′ + 0.587 EG′ + 0.114 EB′, applied to the gamma-encoded signals, as the note says.
- t = σn and the symmetry of σ: the Cauchy stress tensor is a rank-2 symmetric tensor that transforms a surface's normal vector into the traction vector on that surface.
- "shapes not aligned" is NumPy's `np.dot` error message.
- The FrameScene pixel (212, 23, 22) really is img[24, 22].

## Model issues
- The array operations and the 2D transformation rules are correct, including edge cases: empty shapes, transpose permutations, the principal-angle wrap-around, and weights above 1 clipped only in the picture.
- **low**, e2e/tensors-model.e2e.ts:56. Two things are not tested: the hard-coded `PIXEL = [212, 23, 22]` (FrameScene.svelte:234) and the channel claims the narrative makes. Add:
  ```ts
  expect([0, 1, 2].map((c) => get(img, [24, 22, c]))).toEqual([212, 23, 22]);
  // yellow feathers outshine the leaves in the green channel (the grey step's 0, 1, 0)
  const px = Array.from({ length: 48 * 36 }, (_, p) => [0, 1, 2].map((c) => img.data[p * 3 + c]));
  const mean = (a: number[][]) => a.reduce((s, v) => s + v[1], 0) / a.length;
  const leaf = px.filter(([r, g, b]) => g > r && g > b && g > 40);
  const yellow = px.filter(([r, g, b]) => r > 200 && g > 150 && b < 150);
  expect(mean(yellow)).toBeGreaterThan(mean(leaf));
  ```

## Narrative and scene mismatches
- **high**, steps.ts:296. "with 0, 1, 0 the leaves do [glow]": in the grey picture the leaves come out mid-grey (≈100/255), while the yellow feathers and the pale patches are the brightest parts. Replacement: "With 1, 0, 0 the grey picture is just the red channel, and the red parrot glows. With 0, 1, 0 the red feathers go dark and the yellow ones stay bright, while the leaves are only mid-grey: their green values are smaller than you might think."
- **medium**, steps.ts:27–34. The slider labels "Length of axis 0 (layers)", "axis 1 (rows)" and "axis 2 (columns)" are wrong as soon as the reader lowers "Number of axes". With 2 axes, the scene (correctly) labels rows as axis 0 and columns as axis 1. Fix: `len('n0', 'Number of layers', 2)`, `len('n1', 'Number of rows', 3)`, `len('n2', 'Number of columns', 4, …)`.
- **low**, MatVecScene.svelte:43–44, 49. The doc comment promises that under reduced motion the frame "shows row 0 worked out and every result", but the code does not do this:
  - If `t` keeps running (as the other scenes assume), the chips still fly.
  - If `t` is frozen, u = 0, so the products and the "= 1" are hidden.
  
  Fix:
  ```ts
  const active = $derived(reduced ? 0 : Math.min(2, Math.floor(tc / PERIOD)));
  const u = $derived(reduced ? 0.85 : tc >= 3 * PERIOD ? 1 : (tc - active * PERIOD) / PERIOD);
  ```
- Otherwise every number the text quotes appears in the scenes and readouts: 7, (4,), (2, 3, 4) = 24, 5184, the slice shapes, numbers 0–107, the 1728-number layers, (1, 4, 2), 100 MPa, 700 MPa², 22.5°, 92.4 and 7.6.

## Catalogue requirements
- The interaction is built as written: grow from scalar to block, the photo as a (48, 36, 3) block (a fixed real photo rather than an upload), slicing along any axis, reshape/transpose, and the matrix–vector product with "kept" and "combined" axes coloured.
- The takeaway is visible in the graphic.
- The pitfall is handled well: the page rests on the array view, and the physics chapter shows the transformation rule.
- No `Needs` field; the photo is real, public-domain data and its source is documented.

## Clarity
- **low**, steps.ts:352 and 369. "one factor of R for each of its two axes" uses *axes* for the tensor's array axes right after "turned axes" meant coordinate axes. The notes already say "index", so use it in the text too: "with one factor of R for each of its two indices (its two array axes)". Do the same at 369: "one factor of R per index".
- **low**, steps.ts:355. "the largest and smallest anywhere at that point" → "the largest and smallest normal stresses on any cut through that point".
- **low**, steps.ts:339. "the material on the far side pulls on the cut" → "the material on the side n points to pulls on the cut". That is how the sign convention of t = σn is defined.
- **low**, steps.ts:315. "A neural network is built from little else" leaves out the nonlinear functions that the neural-networks page depends on. Use "is built mostly from these operations, plus simple nonlinear functions, applied to tensors with millions of numbers…".
- **low**, steps.ts:297 (note). The photo is sRGB, which uses the BT.709 primaries, so the matched luma weights are 0.2126/0.7152/0.0722. BT.709's blue luma coefficient is just 0.0722, compared to 0.114 for BT.601. Add: "Strictly, sRGB pictures use the primaries of BT.709, whose weights are 0.2126, 0.7152 and 0.0722; the 601 weights remain the common default."

## Sources consulted
- https://commons.wikimedia.org/wiki/File:Parrot.red.macaw.1.arp.750pix.jpg
- https://en.wikipedia.org/wiki/File:Parrot.red.macaw.1.arp.750pix.jpg
- https://static.hlt.bme.hu/semantics/external/pages/tenzorszorzatok/en.wikipedia.org/wiki/Woldemar_Voigt.html
- https://arxiv.org/pdf/2106.08090 (Lim, "Tensors in computations")
- https://shop.machinemfg.com/comprehensive-guide-to-astm-a36-steel-properties-and-uses/ ; https://en.wikipedia.org/wiki/A36_steel
- https://glenwing.github.io/docs/ITU-R-BT.601-6.pdf (Rec. ITU-R BT.601-6)
- https://www.sciencedirect.com/topics/computer-science/luma-coefficient
- https://arxiv.org/pdf/1610.04347 (Tensor Calculus, §5.5 stress tensor)
- https://github.com/numpy/numpy/issues/11737 (the "shapes not aligned" message)
- I also decoded `MACAW_RGB_BASE64` directly: 5184 bytes; img[24, 22] = (212, 23, 22); channel statistics as quoted above.
