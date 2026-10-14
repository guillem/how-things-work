<!-- batch msgbatch_01W6KxiGZE7M9zKVS1vB3Lq2, claude-opus-5-5, submitted 2026-10-14T13:05:29.203Z, ~$1.16 in tokens + 8 web searches -->
# Review: vision-color

## Verdict
The page is ready after the fixes below. The eye model is right. I recomputed the Gullstrand–Emsley numbers independently and got 60.48 D relaxed, 69.72 D accommodated, a 23.90 mm eye, a 42.7 D cornea and a 21.75 D lens. I also got −3.00 D for the 25.0 mm eye and +4.00 D for the 22.46 mm eye, near points of 11.6, 24.1 and 13.1 cm, and a 34.5 cm far point. The colour model uses the real CVRL cone data and the correct CIE 170-2 and sRGB matrices. I re-derived its quoted numbers too: the sodium match is 0.32% off, the 490 nm laser can get no closer than 5.4%, and the sun and bulb are both reachable. **The most important fix is the colour-blindness note.** It says everyone with red–green deficiency has only two kinds of cone, which is wrong for about three-quarters of them. The second fix is the red–green opponent channel: it reads blue and violet light as strongly "greenish", which the note waves away as "a little".

## Factual errors
- **high** — steps.ts:277 (one-cone notes). The note says that because a pigment is "missing or shifted", people "have two working kinds of cone instead of three". That is only true when the pigment is missing (dichromacy, about 2.4% of men). Most red–green deficient men (about 6.3%) are anomalous trichromats: they still have three kinds of cone, but one is shifted. **Fix:** "About 8% of men and 0.5% of women of European descent have red–green colour deficiency. In about a quarter of these men one of the L or M pigments is missing, leaving only two working kinds of cone; in the rest it is shifted towards the other, so their L and M signals differ less than usual. Either way, some pairs of colours that differ for everyone else look the same to them." Source: https://www.webexhibits.org/causesofcolor/2C.html (incidence table).
- **medium** — steps.ts:320 (opponent notes). The note says 475 nm "still reads a little green here". The model gives redGreen = −0.36 at 475 nm, which the scene labels "greenish". The channel's most-green point is actually blue light at about 460 nm (−0.375), greener than 520 nm green light (−0.23). Violet (400–440 nm) also reads greenish, though it looks reddish-blue. The real red–green hue axis is not the plain L-against-M axis; S cones also feed into it. See Model issues for the fix. Sources: https://labs.psych.unr.edu/websterlab/files/WebsterJOSA2000b.pdf, https://www.researchgate.net/publication/7673450_The_cone_inputs_to_the_unique-hue_mechanism
- **low** — steps.ts:277. The principle of univariance is credited to "William Rushton, 1972". It was first stated by Naka & Rushton (1966); Rushton's 1972 paper is the later, best-known statement. **Fix:** "(Naka and Rushton, 1966; Rushton, 1972)". I'm moderately confident here. The Brown University note in Sources cites Naka & Rushton (1966) for univariance.
- **low** — steps.ts:290 and colour.ts:227. "A sodium street lamp, whose light is a single wavelength" is only true of low-pressure sodium lamps. Most sodium street lamps are high-pressure, which give a broad spectrum. **Fix:** "a low-pressure sodium street lamp", and in the label: `'Low-pressure sodium lamp (589 nm)'`.
- **low** — steps.ts:189. "The brain learns to read it the right way up" repeats a popular myth. The brain never needs to flip anything. **Fix:** "The brain doesn't need to turn it over: it simply makes sense of where things land on the retina."

## Model issues
- **medium** — colour.ts:275–285 (`opponent`). The red–green channel is pure L − a·M, which produces the problem above.
  - **Option A (minimal):** keep the model and fix the note at steps.ts:320: "…the real circuits of the retina and brain are more complicated, but follow the same plan. The red–green channel here is the plain L-against-M comparison that cells in the retina make, and it is not quite the red–green we see: blue and violet light read clearly greenish on it, although violet looks reddish-blue and the blue near 475 nm looks neither. Later stages in the brain add some of the S signal to arrive at the hues we name."
  - **Option B:** add an S input, chosen so that both white and unique blue (475 nm) are neutral:
    ```ts
    const U = cones(475);
    const C_RG = (U[1]*EQUAL_ENERGY[0] - U[0]*EQUAL_ENERGY[1]) / (U[2]*EQUAL_ENERGY[1] - U[1]*EQUAL_ENERGY[2]); // ≈ 0.340
    const A_RG = (EQUAL_ENERGY[0] + C_RG*EQUAL_ENERGY[2]) / EQUAL_ENERGY[1];                                     // ≈ 1.432
    // redGreen: (c[0] + C_RG*c[2] - A_RG*c[1]) / (c[0] + C_RG*c[2] + A_RG*c[1])
    ```
    I checked this: 400 nm gives +0.74 (violet reads reddish), 475 nm gives 0, 500–520 nm about −0.30, 578 nm −0.004 (close to unique yellow), 650 nm +0.76. All existing tests still pass. Option B also needs an S→red–green "+" wire in PipelineScene, a re-check of the afterimage predictions, and the body text at steps.ts:318 changed to "One weighs L against M (with a little S)". Drop "already in the retina" for this channel.
- **low** — colour.ts:247–264 (`bestMatch`). The comment promises a coarse-then-fine search, but the code brute-forces 101³ ≈ 1 million mixtures, and MatchScene computes `best` in the match phase too, where it isn't used. **Fix:** fix the comment, and compute it only when `screens` is true, or precompute it for the four fixed `TARGETS`.
- **low** — colour.ts:12–14, 121–134. The comment says out-of-range colours are "clipped to the nearest one it can show". In fact negative channels are set to zero, which is not the nearest colour. **Fix:** "negative channels are set to zero".
- **low** — PipelineScene.svelte:50–60 and colour.ts:278. Brightness is L + M with equal weights. Luminance is about 2L + M for these normalised curves; the model already has ȳ = 0.690·L + 0.348·M in `LMS_TO_XYZ[1]`. **Fix:** use `LMS_TO_XYZ[1][0]*c[0] + LMS_TO_XYZ[1][1]*c[1]` for `bright`, and change the title to "brightness: mostly L, some M". Alternatively, state the simplification on the page.
- **low** — e2e tests.
  - Several numbers quoted in the text are untested, though steps.ts:4–6 says every quoted number is checked. Missing: 21.8 D (lens), 9.2 D, 2.7 D/mm, the sodium 0.3% (only tested as < 0.5%) and 5% for the 490 nm laser.
  - The afterimage test uses strength 0.6 and test colours, but the scene uses 0.3 and different RGB values (AfterimageScene:28–30: [225,205,0] and [205,40,205]; the test uses [230,200,0] and [200,40,200]). At 0.3, the post-cyan prediction is only redGreen = +0.025. The swatch, rgb(136,108,109), is visibly pinkish, but under the pipeline's ±0.1 threshold it would count as "neither".
  - **Fix:** add assertions on `lensPower(0)` ≈ 21.8, `eyePower(1) − eyePower(0)` ≈ 9.2, the sodium 0.3%, and the afterimage hue direction at the scene's exact `STRENGTH` and RGB values.

## Narrative and scene mismatches
- **medium** — ConesScene.svelte:394–404. With "all three kinds" selected, the verdict always says "two different colours". If the right lamp is set to 600 nm × 1.00, the two patches are identical and the readout is wrong. **Fix:**
  ```ts
  const sameNm = $derived(nmB === NM_A);
  const identical = $derived(sameNm && Math.abs(powerB - 1) <= 0.02);
  // value / text when all:
  identical ? 'the same' : sameNm ? 'same colour, different brightness' : 'two different colours'
  ```
- **low** — steps.ts:275. "Almost any colour can be matched this way, just by adjusting the brightness" overclaims for this scene. With the brightness capped at ×3, the M-only eye can match the 600 nm lamp only for right-lamp wavelengths of about 459–621 nm, roughly half the 400–680 nm slider. **Fix:** "Any colour from blue to orange-red can be matched this way, just by adjusting the brightness; near the ends of the spectrum this cone is so insensitive that even the brightest setting here isn't enough."
- **low** — steps.ts:219 with EyeScene.svelte:248/617. "Fully rounded, this lens adds 9.2 D" is the rise in the whole eye's power; the lens's own power rises by 10.5 D (21.75 → 32.29 D). The focus note then compares this with Hofstetter's amplitudes (15 D, 6.5 D), but those are near-point measures (1 ÷ near point), and on that measure this eye has 8.6 D. **Fix:** in the body, "Fully rounded, the lens raises the eye's power by 9.2 D…". In the note, after the Hofstetter sentence, add "(measured as 1 ÷ the near point in metres; on that measure this model eye has about 8.6 D, typical of someone about 33)". In the scene label, change `lens ${signed(accommodation, 1)} D` to `eye ${signed(accommodation, 1)} D`.
- **low** — steps.ts:304. "The best mix is always paler than the target" can't be seen on screen. The 490 nm target is drawn with its negative red clipped, so it shows as rgb(0,237,223) and the best mix as rgb(0,219,231): bluer, not paler. **Fix:** add "(your screen can't show the target's true colour either, so here you see the difference mainly in the bars)".
- **low** — steps.ts:292 (match notes). "The two patches here are the right colours relative to each other" overstates it. Clipping can make two different out-of-range colours look the same. **Fix:** "so equal lights always get equal pixels, but colours outside the screen's range are pushed inside it and small differences between them may not show."

## Catalogue requirements
Everything in the entry is built: lens shape, near and far objects, glasses, RGB matching with cone responses, and illusions. The takeaway shows in the graphics (the camera-like image, metamers from three numbers, illusions). The cone-sensitivity data requirement is met with real CVRL data, and its source is documented. Nothing to fix.

## Clarity
- **low** — steps.ts:262. "L peaks in the yellow-green", but dragging the line to 570 nm shows "570 nm looks yellow" (`colourName`). **Fix:** "Notice that L peaks in the yellow, not the red…".
- **low** — steps.ts:187. "Filled with clear jelly": the front chamber holds a watery fluid, not jelly. **Fix:** "filled with clear fluid and jelly".

## Sources consulted
- My own reimplementation of eye.ts and colour.ts, using the page's CVRL table, to check every quoted number.
- Colour-deficiency incidence: https://www.webexhibits.org/causesofcolor/2C.html ; https://en.wikipedia.org/wiki/Congenital_red%E2%80%93green_color_blindness
- Curcio et al. 1990 (4.6 million cones, 92 million rods), confirmed: https://ui.adsabs.harvard.edu/abs/1990JComN.292..497C ; https://www.academia.edu/13350811/Human_photoreceptor_topography
- Hofstetter 18.5 − 0.30 × age, confirmed: https://en.wikipedia.org/wiki/Amplitude_of_accommodation
- Univariance: https://en.wikipedia.org/wiki/Principle_of_univariance ; https://foundationsofvision.stanford.edu/chapter-4-wavelength-encoding/ ; https://bpb-us-w2.wpmucdn.com/sites.brown.edu/dist/5/444/files/2023/02/VisionRes78.pdf (cites Naka & Rushton 1966)
- BT.2020 monochromatic primaries 467, 532 and 630 nm, confirmed: https://en.wikipedia.org/wiki/Rec._2020 ; https://sid.org/Portals/sid/BA%20Chapter/PDF%20and%20Images/160324%20BASID%20John%20Ho.pdf
- Unique hues vs the L−M axis: https://labs.psych.unr.edu/websterlab/files/WebsterJOSA2000b.pdf ; https://www.researchgate.net/publication/7673450_The_cone_inputs_to_the_unique-hue_mechanism
- L:M ratio of 1.1:1 to 16.5:1 (Hofer 2005), consistent with the page: https://www.princeton.edu/~bdsinger/pubs/Hofer-2005-jov.pdf
- Gullstrand–Emsley parameters: Bennett & Rabbetts, *Clinical Visual Optics*. The parameters in eye.ts reproduce the published powers and length exactly.
