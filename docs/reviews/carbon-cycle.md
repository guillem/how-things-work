<!-- batch msgbatch_01BV1p6aUAsiFtzFKbfs3u11, claude-opus-5-5, submitted 2026-10-14T08:43:27.540Z, ~$1.14 in tokens + 12 web searches -->
# Review: carbon-cycle

## Verdict

The page is ready once the fixes below are made. The data are well sourced and I checked them against the publications: the Global Carbon Budget 2025 decade means and totals, the gross flows in IPCC AR6 Fig. 5.12, and the Joos et al. pulse response. The seawater chemistry is implemented correctly. I re-ran the model in Node, and every number the narrative quotes for a run comes out as stated: peak 535.1 ppm, 389.5 ppm after 1,000 years, 370.9 ppm a century after stopping, 628.6 ppm with no plant response, and pulse shares of 0.591, 0.389 and 0.250. Fix these first:
- **A reversed fact:** the GCB says climate change cut the land sink *more* than the ocean sink, not less.
- **The plant-response slider:** "plants do not respond" is mostly measuring plants giving back the carbon they gained since 1750.
- **The closing "locked" view:** its numbers do not add up to the fossil carbon it says they hold.

## Factual errors

- **High**, steps.ts:236 (sinks notes). The text says the GCB "attributes a smaller negative effect on the land sink." It is the reverse. GCB 2025 says climate change and variability reduced the land and ocean sinks "by 25 % and 7.1 % respectively" over 2015–2024. In absolute terms that is about 0.8 GtC/yr for land against about 0.2 for the ocean. **Fix:** "…reduced the ocean sink by about 7% over 2015–2024, compared with what rising CO₂ alone would give, and the land sink by about a quarter (0.8 GtC a year), through heat and drought in the tropics and faster soil respiration." Sources: https://essd.copernicus.org/articles/18/3211/2026/ and https://essd.copernicus.org/preprints/essd-2025-659/essd-2025-659-manuscript-version3.pdf
- **Medium**, steps.ts:118. "Each of these flows is ten times what people emit or more." The ocean flows (54 and 55 GtC/yr) are only about 5× the 11.2 GtC/yr people emit. **Fix:** "Each of these flows is five to ten times what people emit…"
- **Medium**, steps.ts:132. "the deep ocean could hold almost all the carbon we add" contradicts the pulse step and the page's own note, both of which say 20–35% stays in the air after the ocean has caught up (Archer et al. 2009). **Fix:** "So the deep ocean could eventually take up most of the carbon we add, about three-quarters of it, but it can only take it in slowly." Source: Archer et al., Annu. Rev. Earth Planet. Sci. 37, 117 (2009), https://doi.org/10.1146/annurev.earth.031208.100206. Joos et al. 2013 agree: 59 ± 12% is in the ocean after 1,000 years, https://ui.adsabs.harvard.edu/abs/2013ACP....13.2793J/abstract
- **Low**, steps.ts:206. The model's pH drop from 8.176 to 8.041 means 10^0.135 = 1.37×, so "about a third more hydrogen ions" understates it. **Fix:** "…which means nearly 40% more hydrogen ions."
- **Low**, steps.ts:120 (fast notes). The text says the pre-industrial imbalances "are carbon that rivers carry from the land to the sea." That works for the ocean side (0.8 GtC/yr from rivers minus 0.2 buried leaves 0.6 outgassed). It does not work for the land side: the land gains 1.9 GtC/yr but rivers deliver only 0.8. **Fix:** "…are closed by the slow flows: rivers carry carbon from the land towards the sea (some of it escapes from rivers and lakes on the way), and the ocean breathes it back out." I am moderately confident of this one, because I could not open AR6 Fig. 5.12 to check its freshwater terms.

## Model issues

- **Medium**, carbon.ts:244 and scenario.ts:41 (plant slider). The slider scales β in `NPP·β·ln(C/C₀)`. That reaches back to 1750 levels: at 0%, the extra growth that today's 423 ppm already supports disappears at once, and about 120 of the 155 GtC gained since 1750 returns to the air by 2074 (land sink falls from 155 to 35 GtC). I re-ran it with fertilisation frozen at its 2024 strength (plants that simply stop responding to *further* CO₂). The peak is then **561 ppm**, not 629. So about two-thirds of the "630 instead of 535" comes from plants handing back past gains. Choose one fix:
  - **(a) Change the model** so the slider acts only above today's CO₂. Add `fertBase?: number` to `Params`, set it to `ppmOf(today())` in `setup()`, and in `fluxes`:
    ```ts
    const base = p.fertBase ?? PPM0;
    const growth = NATURAL.npp * (0.27 * Math.log(base / PPM0) + p.beta * Math.log(ppm / base));
    ```
    Then change steps.ts:234 to "peaks at about 560 ppm instead of 535, and the land no longer makes up for the clearing", and update e2e:113.
  - **(b) Keep the model and say what it does.** Change steps.ts:234 to: "Turn the plants' response to 0%: plants lose even the extra growth today's CO₂ gives them, so much of the carbon they have gathered since 1750 goes back to the air. CO₂ peaks at about 630 ppm instead of 535." Change the help text at steps.ts:54 to: "0%: plants grow as they did before industry, whatever the CO₂."
- **Low**, carbon.ts:349–355. `observedAir` scales the *whole* growth series by 308/312, including the post-1959 years that come from air samples (the comment calls them "air samples"). The 4 GtC mismatch is between the 590 and 898 GtC stock figures and the ice-core part of the series. **Fix:** apply `k` only to the years before 1959, computing it as `(AIR_2024 − PRE.atmosphere − Σpost1959) / Σpre1959`.
- **Low**, e2e/carbon-cycle-model.e2e.ts:104–120. Several quoted numbers are untested: pH 8.18 → 8.04, 2015–2024 ocean uptake of 3.1 (only a comment), the land total since 1850 of about 145 (steps.ts:207), and +308/+208/+155 (steps.ts:262). **Fix:** add, for example, `expect(mean('ocean')).toBeCloseTo(3.1, 1)`, `expect(sum('land')).toBeCloseTo(145, -1)`, `expect(pHOf(today())).toBeCloseTo(8.04, 2)`, and the three totals.

Everything else holds:
- The equilibrium constants (Lueker 2000, Weiss 1974, Dickson 1990, Millero 1995, Uppström) match the published formulas.
- The derived values are realistic: DIC₀ = 1,986 µmol/kg, pH₀ = 8.18, Revelle factor = 9.5.
- The water fluxes are as the comments say: about 196 Sv into the thermocline and 24.7 Sv into the deep ocean.
- Carbon is conserved in emission-driven runs.
- The model stays stable at the extreme inputs (20 + 2.5 GtC/yr for 150 years peaks at 1,310 ppm, inside the bisection bounds).
- The 100 GtC pulse ends at air 25%, ocean 59%, land 16% after 1,000 years. That is exactly Joos et al.'s 25 / 59 / 16%.

## Narrative and scene mismatches

- **Medium**, steps.ts:260–262 and CycleScene "locked" readouts. The step says the stage "shows the carbon added to the fast loop since 1750", and the note says the 500 GtC burnt and 280 GtC cleared are "shared between" air, ocean and land. The readouts show burnt 499, air +308, ocean +208, land −122 net. That sums to **394, not 499**. The history run follows the measured air, so carbon is not conserved there: about 105 GtC is the model's own budget imbalance. A reader who adds up the labels will notice. **Fix for the note:** "In the model, 499 GtC of fossil carbon has been burnt since 1750 and 278 GtC released by clearing. The air holds +308 GtC (the measured rise), the ocean +208, and the land a net −122 (+155 from CO₂ fertilisation, −278 cleared): 394 GtC in all. The other ~105 GtC is the model's version of the budget imbalance: following the measured air, its sinks take up less than the emissions imply, mostly the land between 1950 and 1980." Also delete "regrowth and": the cleared figure is already net of regrowth (carbon.ts:26–29).
- **Medium**, steps.ts:206. "Its plants take up a little less than the budget's estimate before about 1950." In the model the gap is *largest after* 1950:

  | Period | Model land uptake (GtC/yr) | GCB (GtC/yr) |
  |---|---|---|
  | 1850–1900 | 0.24 | 0.34 |
  | 1900–1950 | 0.52 | 0.61 |
  | 1950–1980 | 0.71 | 1.12 |
  | 2000–2015 | 2.00 | 2.36 |

  **Fix:** "Its plants take up less than the budget's estimate through most of the twentieth century (about a third less in 1950–1980), but it matches both sinks over 2015–2024: 3.1 GtC a year into the ocean and 2.4 into plants." Make the same change in the note at steps.ts:207: "Its land uptake is lower than the GCB's until about 2010…"
- **Medium**, RunScene.svelte:352. "axis squeezed ×4 from here" is wrong. The left part is 464 units for 200 years (2.32 per year); the right part is 320 units for 800 years (0.40 per year). That is ×5.8. **Fix:** `text="axis squeezed ×6 from here"`, or compute it: `×{Math.round(((SPLIT - L) / 200) / ((R - SPLIT) / (HORIZON - 200)))}`.
- **Low–medium**, steps.ts:221. "CO₂ falls to about 370 ppm within a century, and then barely moves." The model goes 371 ppm (2124) → 363 (2224) → 333 (3024): another 38 ppm after the first 52. **Fix:** "…falls to about 370 ppm within a century, then only slowly, to about 335 ppm a thousand years from now."
- **Low**, steps.ts:234. "Slow the ocean's mixing to 25%: the surface water fills up and stops taking CO₂." In 2074 the ocean sink is 1.9 GtC/yr against 3.8 by default: halved, not stopped. **Fix:** "…the surface water fills up and takes in only about half as much CO₂…"
- **Low**, steps.ts:54. The help text "the model's best match to the land sink measured since 1960" is wrong on two counts. β is calibrated on 2015–2024 (carbon.ts:180–183), and the land sink is modelled, not measured. **Fix:** "100%: the value that makes the model match the Global Carbon Budget's land sink for 2015–2024."
- **Low**, SpeedsScene.svelte:45–50. The air bar is 590 ÷ 167.3 = 3.5 years but is labelled "≈ 4 years". **Fix:** `text: '≈ 3.5 years'`, or build the text from `years`.
- **Low**, SpeedsScene.svelte:171–175. The fast-loop box contains the deep-ocean row (140 years), but the readout reads "air, surface ocean, plants, soils" / "a few years to decades". **Fix:** `label="Fast loop: air, ocean, plants, soils"`, `value="a few years to centuries"`, which matches steps.ts:162.

## Catalogue requirements

- **Low**, scenario.ts:29–47 and steps.ts:217/231. The entry asks the reader to "Change the rates of burning, deforestation and uptake, then run the clock." The uptake controls sit on a separate step where the emissions are fixed at today's rates, so weaker sinks can't be combined with other emission scenarios. **Fix:** add `burning` and `years` to the `sinks` step's controls (`controls: [burning, years, plants, mixing]`), or say on the step that emissions are held at today's rates.

The rest is met:
- The reservoirs and flows are drawn to scale, and the minimum-width exception is stated.
- The takeaway shows in the speeds scene and the locked view.
- The Needs are met with the published GCB 2025 and AR6 numbers.

## Clarity

- **Low**, steps.ts:220. "ppm" is first used in the body ("535 ppm"), but it is only defined in the notes (steps.ts:222). **Fix:** move the `<dfn data-def="Parts per million…">ppm</dfn>` to its first use in the body.
- **Low**, CycleScene.svelte:852. "dashed: thinner than 1.5 units at scale, drawn wider" — "units" means nothing to a reader. **Fix:** `text="dashed: too thin to draw to scale, shown wider"`.
- **Low**, CycleScene.svelte:329–337. In the "human" view the clearing arrow (1.4 GtC/yr = 0.49 units) is drawn dashed at the minimum width, but the explanation of dashing only appears in the "slow" view. **Fix:** show the `minwidth` label in the human view too (put it in a group whose opacity is `labelOpacity(Math.max(o.slow, o.human))`).

## Sources consulted

- Friedlingstein et al., Global Carbon Budget 2025, ESSD 18, 3211–3288 (2026): https://essd.copernicus.org/articles/18/3211/2026/. Confirms:
  - 2015–2024 means: ELUC 1.4 ± 0.7, ocean sink 3.2 ± 0.4, land sink 2.4 ± 0.8 GtC/yr, zero budget imbalance;
  - 2024: 422.8 ppm, fossil 10.3 GtC, land sink 1.9 GtC;
  - 2025 projection +1.0%;
  - three bookkeeping models;
  - sink reductions from climate change of 25% (land) and 7.1% (ocean).
- GCB 2025 manuscript: https://essd.copernicus.org/preprints/essd-2025-659/essd-2025-659-manuscript-version3.pdf (climate change reduces the land sink by 0.8 ± 0.7 GtC/yr).
- Joos et al. 2013, ACP 13, 2793: https://ui.adsabs.harvard.edu/abs/2013ACP....13.2793J/abstract (100 GtC pulse at 389 ppm: 25 ± 9% in the air after 1,000 years, ocean 59 ± 12%, land 16 ± 14%). The fifteen-model ensemble is confirmed by the paper summary at https://www.academia.edu/15176495/
- IPCC AR6 WG1 Fig. 5.12: https://www.ipcc.ch/report/ar6/wg1/figures/chapter-5/figure-5-12/ (fossil resources: coal 11,490, oil 6,780, gas 365 PgC, so "about 20 times" the reserves holds).
- IPCC AR6 WG1 ch. 5: https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_FGD_Chapter05.pdf (surface pH falling 0.016–0.020 per decade in the subtropics since the 1980s).
- Archer et al. 2009, Annu. Rev. Earth Planet. Sci. 37, 117: https://doi.org/10.1146/annurev.earth.031208.100206 (I relied on what I know of its abstract and did not fetch it).
- Not verified: the GCB Fig. 2 reserve split (coal 560, oil 230, gas 115) and the individual slow-flow values in AR6 Fig. 5.12. I found nothing contradicting them.
