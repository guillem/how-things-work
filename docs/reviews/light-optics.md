<!-- batch msgbatch_01APf4SozkwS5Pcp2iSpMF6P, claude-opus-5-5, submitted 2026-10-12T02:19:31.594Z, ~$1.26 in tokens + 9 web searches -->
# Review: light-optics

## Verdict
The page is ready once the fixes below are made. The model is sound: the Sellmeier coefficients match their sources, Snell's law, Fresnel reflection and total internal reflection are implemented correctly, and almost every number in the text can be reproduced. I ported `optics.ts` to Node and checked them, including 25.0°, 4.3%, 43.3°, 3.5%, f = 82 mm, n = 1.776/1.842, and 42.3°/40.6° for the rainbow. The most important fix is in the **image step**. The object is drawn 64 units tall and the fan of rays spans almost the whole lens, so the traced rays come out very aberrated. They do not meet at the image arrow drawn from the thin-lens equation. At several object distances they even converge to a real image while the card says "virtual". The page's main claim there, "every point of the object gets its own image point", is not what the reader sees.

## Factual errors
- **medium**, steps.ts:319: "René Descartes worked out the 42° in 1637 by tracing thousands of rays by hand." The "thousands (10,000) of rays" story is a known myth. Descartes worked out a table for a limited set of entry heights. Fix: "René Descartes worked out the 42° in 1637: using the law of refraction, he calculated the paths of rays entering a drop at a series of heights and found where they bunch together." Source: F. E. Barmore, "Descartes, the Rainbow and the Mythical 10 000 Calculations", Meteorological Optics 1983, https://opg.optica.org/abstract.cfm?uri=MO-1983-ThB3
- **low**, optics.ts:6–8: "[air] moves no angle in this explainer by more than 0.02°" is not true. Using n_air = 1.0003 moves the rainbow angle from 42.29° to 42.35° (0.06°). It also moves the outgoing ray at 41° inside crown glass (n = 1.52) from 85.7° to 85.5°. Fix: "…which moves the angles quoted on the page by less than 0.1°, except rays leaving just short of the critical angle, which skim the surface." (Computed from the model.)

Everything else checks out against sources or the model: Ibn Sahl in Baghdad around 984, Newton in 1666, 99% of intercontinental traffic on undersea cables, and SMF-28 at 8.2 µm core, 125 µm cladding, NA 0.14 and ≤0.18 dB/km.

## Model issues
- **high**, LensScene.svelte:90–99 and 101–122 (image phase). The object is 64 units tall (`OBJ`) and the fan runs from −50 to +50. That is most of the 70-unit aperture, at angles up to about 45°. The traced rays therefore suffer heavy off-axis aberration, and the lens is also 15 mm thick. Traced against the thin-lens image that the scene draws:
  - At u = 90 (45 mm, inside f), the drawn virtual image tip is at −142. The dashed back-extensions reach that plane anywhere from −170 to −70, and the two outermost rays actually *converge* (they cross at x ≈ +5000).
  - From u = 140 to 160, the card says "virtual" while the outer rays cross behind the lens at about 500–650.
  - At u = 327 (2f), the card says ×1.00, but the fan reaches the image plane over heights 53–79, and the outer pair cross at v ≈ 259 instead of 327.
  
  Fix: use a smaller object and a narrower fan, and make the lens thinner.
  ```ts
  const H_IMAGE = 50;
  const OBJ = 40;
  … [-20, -10, 0, 10, 20].map((h) => …)
  ```
  With these values the fan lands within ±1 unit of the drawn image at 2f and at u = 250, and within about 10 units at u = 90. Close to the focus the thin-lens prediction still drifts by about 3%, because the lens's true focus is about 84 mm instead of 82. Either compute v from the lens's principal planes, or add a line to the note (see below). Also add an e2e test that traces the scene's own lens and object and checks that the rays cross within a few units of `imageDistance`.
- **medium**, LensScene.svelte:43–48 and steps.ts:273 (focus phase). The aperture is fixed at H = 100 for every radius, so a small R makes a very thick lens: 38 mm at R = 150. The traced focus then lies 17% beyond the thin-lens f for crown glass with R = 150, 29% for n = 2.42 with R = 200, and 55% for n = 2.42 with R = 150. For n ≥ 2 and R ≤ 250, the edge rays are also totally reflected inside the lens. The note says "can differ by a few per cent", and the "F" dots sit far from where the rays cross. Fix: either show the thick-lens value,
  ```ts
  1/f = (n − 1)[2/R − (n − 1)d/(n R²)]
  ```
  and place F from the principal planes, or reword the note: "The formula is for a thin lens. This lens is thick, so rays near the axis cross further out than f: a few per cent for gently curved faces, but up to half as far again for the most curved faces in diamond-like glass, where the outermost rays are even trapped inside the lens by total internal reflection."
- **low**, e2e/light-optics-model.e2e.ts:102–104. The Fresnel test only checks normal incidence and the critical angle. Add a Brewster-angle check, which tests the angle dependence: at θ = atan(n), `rp` = 0, so
  ```ts
  expect(reflectance(1, 1.5, toDeg(Math.atan(1.5)))).toBeCloseTo(0.0740, 3)
  ```

## Narrative and scene mismatches
- **medium**, LensScene.svelte:299–311. "The rays come out parallel: no image" is shown whenever a virtual image is off stage. With integer u and f = 163.46 units, u = 163 gives v ≈ −28,900 units (×354): a distant virtual image, not parallel rays. Fix: `'Object almost at the focus: the image is very far away'`.
- **medium**, steps.ts:288 (note). "Spherical aberration makes the traced rays cross in a small blur" understates what the scene shows. For an off-axis point and wide cones the blur is large, and most of it is off-axis aberration. After the geometry fix above, change it to: "Real spherical lenses don't focus perfectly, especially for points off the axis and wide cones of light, so the traced rays cross in a small blur near the drawn image; cameras close down the aperture to sharpen it."
- **low**, steps.ts:285: "Far away, its image forms close to the focus and small." At the farthest setting (u = 220 mm ≈ 2.7f) the image is at 130 mm ≈ 1.6f, ×0.59. Fix: "Far away, its image forms between f and 2f, smaller than the object; the further away the object, the closer the image gets to the focus."
- **low**, steps.ts:4–7 vs 239–240. The header says every quoted number is computed by optics.ts. The critical angles 48.8° and 41.1° come from the rounded slider indices 1.33 and 1.52, which is what the scene shows. The model's Sellmeier values give 48.6° and 41.2°, and those are what the e2e test asserts. Fix the comment: "critical angles are for the rounded indices on the slider".

## Catalogue requirements
All met. The bench has a draggable and turnable lamp, mirror, lens and prism, with material and colour controls. Bending, focusing, total internal reflection and dispersion each have a step. The takeaway is visible on its own, because the pulses slow and bunch up in glass in every ray scene.

## Clarity
- **low**, steps.ts:254: "meets the side wall at a grazing angle, far beyond the critical angle". At the 60° entry setting the wall angle is 53.6° against 43.3°, which is hardly grazing. Fix: "meets the side wall at a slanting angle, well beyond the critical angle (between 54° and 90° here, against 43°)".
- **low**, steps.ts:255: "meets the outside of the bend at a steeper angle" is ambiguous, since steeper to the wall means smaller from the normal. Fix: "meets the outside of the bend more nearly head-on, at an angle from the normal smaller than the critical one."

## Sources consulted
- Barmore, Descartes and the 10,000-ray myth: https://opg.optica.org/abstract.cfm?uri=MO-1983-ThB3
- Snell's law (Ibn Sahl, Baghdad, 984): https://en.wikipedia.org/wiki/Snell%27s_law
- Corning SMF-28 Ultra product information (core 8.2 µm, cladding 125 µm, NA 0.14, ≤0.18 dB/km at 1550 nm): https://www.corning.com/media/worldwide/coc/documents/Fiber/product-information-sheets/PI-1424-AEN.pdf
- Newton's prism experiments from 1666 (Cambridge University Library): https://wwwe.lib.cam.ac.uk/CUL/exhibitions/Footprints_of_the_Lion/work.pdf
- ITU, submarine cables carry about 99% of traffic: https://www.itu.int/en/mediacentre/backgrounders/Pages/submarine-cable-resilience.aspx
- Numerical checks: I ported `optics.ts` and the scene geometry to Node and traced them for all the numbers above. That covers the Sellmeier indices against the SCHOTT, Malitson, Daimon & Masumura and Peter values, the critical angles, Fresnel reflection, the rainbow angles, the fibre delivery across the bend and entry ranges, and the lens focus and image positions.
