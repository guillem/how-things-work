<!-- batch msgbatch_01W6KxiGZE7M9zKVS1vB3Lq2, claude-opus-5-5, submitted 2026-10-14T13:05:29.203Z, ~$1.08 in tokens + 8 web searches -->
# Review: greenhouse-effect

## Verdict
The page is ready once the fixes below are made. I re-ran the model independently in Python from the data in `scenarios-data.ts`, and it does what the page says:
- a bare planet settles at 255.1 K;
- a layer absorbing 77% gives 288 K;
- climate sensitivity comes out at 1.16, 1.89, 2.27 and 3.0 °C as feedbacks are switched on;
- the transient climate response (TCR) is 1.83 °C;
- warming for 2011–2020 is +1.088 °C in the model against +1.090 °C measured;
- 2081–2100 warming is 2.66 °C under SSP2‑4.5 and 4.43 °C under SSP5‑8.5.

The one fix that matters most is the carbon budget on the last step. The page takes the IPCC's 500 Gt (from 2020) and subtracts the 205 Gt emitted since, which tells the reader that roughly 300 Gt are left. The latest assessment says about 130 Gt from the start of 2025. Second, the "bare planet" thought experiment needs its reflectivity assumption stated.

## Factual errors
- **High**, steps.ts:271 and BudgetScene.svelte:139–153: the step says the 1.5 °C budget was 500 Gt from 2020 and 205 Gt have been emitted since, so the reader concludes about 295 Gt remain. The 2025 update of the IPCC-based Indicators of Global Climate Change puts the central remaining budget for 1.5 °C at 130 GtCO₂ from the start of 2025, a little over three years of current emissions.
  - Fix for the body: "<p>So the warming we end up with is set by how much CO₂ we emit in total. In 2021 the IPCC estimated that, for an even chance of keeping it to 1.5 °C, the world could emit only about 500 more billion tonnes from the start of 2020. About 205 of those were emitted by the end of 2024, and the latest update puts what is left at only about <strong>130 billion tonnes</strong> from the start of 2025: some three years of today's emissions.</p>"
  - Add to the notes: "Updated budget: Forster et al., Indicators of Global Climate Change 2024, Earth System Science Data (2025)."
  - Change the scene label to: `text="AR6: 500 more from 2020 for an even chance of 1.5 °C"`.
  - Sources: https://www.eurekalert.org/news-releases/1087578, https://climate.leeds.ac.uk/news/scientists-find-three-years-left-of-remaining-carbon-budget-for-1-5c/
- **Medium**, steps.ts:124 (and 136): "Imagine an Earth with no air at all … It settles … at 255 K." The 255 K keeps today's 29% albedo, but the page's own note (line 112) says 75 of the 100 reflected W/m² come from clouds and air. An Earth with truly no air would be darker. With a Moon-like albedo of about 0.12, the model gives 269.6 K (about −4 °C).
  - Fix for the body: "Imagine an Earth whose air lets all infrared through, but which still reflects the same 29% of sunlight."
  - Add to the notes: "Most of that 29% is reflected by clouds and air. A truly airless Earth would be darker, reflecting about 12% like the Moon, and would settle near 270 K (−4 °C). The usual comparison, 255 K, keeps today's reflectivity and removes only the absorption of infrared."
- **Medium**, steps.ts:150: "CO₂'s strongest band is at about 15 micrometres" is imprecise. The 4.3 µm band absorbs at least as strongly. The 15 µm band is the one that matters for climate, because it sits where Earth emits and it dominates CO₂'s forcing.
  - Fix: "CO₂'s most important band for the climate is at about 15 micrometres, close to where the Earth glows most brightly."
  - Sources: Zhong & Haigh 2013, https://courses.seas.harvard.edu/climate/eli/Courses/global-change-debates/Sources/CO2-saturation/more/Zhong-Haigh-2013.pdf; https://www.osti.gov/servlets/purl/1864725
- **Low**, steps.ts:233 and climate.ts:117: "Added up they give −1.16". The four values the page lists (−3.22, +1.30, +0.35, +0.42) add up to −1.15. Table 7.10's net value of −1.16 also includes a biogeophysical and non‑CO₂ biogeochemical term (about −0.01; I am moderately confident of that figure).
  - Fix: "Added up they give −1.15 (−1.16 in the table, which also counts small biogeophysical and non-CO₂ biogeochemical feedbacks), a sensitivity of 3.4 °C."
  - Source: https://www.ipcc.ch/report/ar6/wg1/figures/technical-summary/figure-ts-17/
- **Low**, PlanetScene.svelte:580: "103 warm air out". 82 of the 103 W/m² is evaporation (latent heat), which the note at line 139 gets right.
  - Fix: `text="≈ 398 infrared + 103 evaporation and warm air"`.
- **Low**, steps.ts:149–150: "Molecules with three atoms or more" implies a rule that is wrong as stated, since a diatomic molecule made of two different atoms (CO, NO) also absorbs infrared.
  - Fix: "Molecules made of different atoms, especially those with three or more, can bend and stretch in ways that infrared can shake."

All the other numbers check out against their cited sources: 1,361 W/m²; the 340/100/80/160/398/342/239/82/21 flows of AR6 Fig. 7.2; the 0.79 W/m² imbalance; 3.93 W/m² and 3.71 W/m² (Myhre); 278.3 ppm; Table 7.10 values and ranges; ECS 3 [2.5–4, 2–5]; every SPM.1 value; TCRE 0.45 [0.27–0.63]; 2,390 ± 240 Gt; the 500/400/1,350/1,150 budgets; Wood (1909), Phil. Mag. 17, 319; the gas fractions; and 2,400 air molecules per CO₂ molecule (1/423 ppm ≈ 2,364). The 205 Gt for 2020–2024 is consistent with Global Carbon Budget 2025, which gives about 42.2 Gt/yr in 2024.

## Model issues
- **Low**, climate.ts:153–158: `budget()` puts the whole cloud feedback (+0.42) on the infrared side. In AR6, much of it is shortwave: fewer tropical and mid-latitude low clouds reflect less sunlight. The ice step's wording ("This one works on the sunlight side") then implies that clouds act only on infrared.
  - Fix: either add to the sensitivity notes "On the stage the cloud feedback is drawn on the infrared side; in reality much of it acts on reflected sunlight", or split it, e.g. `const sw = (f.ice ? FEEDBACK.ice : 0) * dT + (f.clouds ? CLOUD_SW : 0) * dT`, with the value of `CLOUD_SW` taken from the components in AR6 §7.4.2.4. (I am moderately confident about the size of the split.)
- **Low**, steps.ts:165 notes / LayerScene: the "real" step quotes 398 W/m² from a 288 K surface, but σ·(288 K)⁴ = 390, and the layer scene shows 390 at 77%. A careful reader will see the jump.
  - Fix, in the layer notes: "The model's 390 W/m² is σ(288 K)⁴; the measured 398 is a little higher because the surface temperature varies from place to place and season to season, and the average of T⁴ is larger than (average T)⁴."
- **Low**, e2e tests: the tests check real properties well (Stefan–Boltzmann scaling, closed budgets, TCR, SPM.1, TCRE, the published concentrations), but not the sensitivities the narrative quotes.
  - Fix: add `expect(sensitivity({ ...NO_FEEDBACKS, water: true })).toBeCloseTo(1.9, 1); expect(sensitivity({ water: true, ice: true, clouds: false })).toBeCloseTo(2.3, 1);`.

Otherwise the model is sound:
- the radiation physics, the layer model and the logarithmic forcing are textbook;
- the two-layer ocean matches Geoffroy et al. (2013) with efficacy;
- Euler integration with a step of 0.1 yr is stable, since the fastest time constant is about 3.9 yr;
- the data arrays have the right lengths (265 years of history, 86 of scenarios, GMST 1850–2020).

## Narrative and scene mismatches
- **Medium**, steps.ts:217 vs ClimateScene.svelte:283–301: "watch the sunlight absorbed grow as the ice shrinks." At 2.3 °C the ice feedback adds only 0.35 × 2.3 ≈ 0.8 W/m². That is 0.5 scene units on the panel bar and 0.2 on the band, so nothing visibly grows; only the number moves from 240.2 to 241.0. The ice rectangle does shrink visibly.
  - Fix, either in the text: "watch the ice shrink, and the sunlight absorbed creep up (by less than 1 W/m², so read the number)."
  - Or in the code, a magnified readout next to the bar:
    ```svelte
    {#if fb.ice}<Label x={PX + 96} y={80} text="+{(b.sunlight - absorbedSunlight()).toFixed(2)} W/m² from melting ice" anchor="start" size={11} color="var(--gh-warm)" />{/if}
    ```
    with `absorbedSunlight` imported from `../climate`.
- **Low**, steps.ts:269: "By 2020 the world had emitted about 2,400 billion tonnes", while the 2020 dot on the chart sits at about 2,335 Gt (the data's 2,294 to 2019 plus 2020's emissions).
  - Fix: "By 2020 the world had emitted about 2,400 billion tonnes (a little less in the data drawn here)."
- **Low**, steps.ts:258: "the same emissions give less warming". The runs are driven by concentrations, so what stays the same is the CO₂ in the air.
  - Fix: "Switch a feedback off and the same rise in CO₂ gives less warming."

Every other number the text quotes matches what the model computes: 1.2, 1.9, 2.3 and 3 °C; 1.09 against 1.09; 2.7 and 4.4; and "close to one line, a little above" (about 0.49–0.54 °C per 1,000 Gt against the IPCC's 0.45).

## Catalogue requirements
Everything is met:
- **Interaction:** sunlight in and infrared out with adjustable CO₂, the temperature settling at balance, the water-vapour and ice toggles, and the scenarios to 2100 are all built.
- **Takeaway:** visible in the flow bars and the imbalance meter.
- **Needs:** real data (Gidden, Meinshausen, AR6 forcing, SPM.1).
- **Pitfall:** avoided, in the molecules scene ("Not reflected") and the glass step.

## Clarity
- **Low**, steps.ts:232 and 269: the IPCC's "likely" and "very likely" are used without saying what they mean.
  - Fix: "It is <em>likely</em> (two chances in three) between 2.5 and 4 °C, and <em>very likely</em> (nine in ten) between 2 and 5."
- **Low**, steps.ts:123–124: "absolute temperature" and "255 K" appear in the body, but kelvin is only explained in the notes.
  - Fix: "…at <strong>255 K</strong> (kelvin, counted from absolute zero, −273 °C), which is <strong>−18 °C</strong>."
- **Low**, steps.ts:190: "ppm" is never spelled out in a body.
  - Fix: "from 280 to 560 parts per million (ppm) does as much as from 560 to 1,120."

## Sources consulted
- IPCC AR6 WG1 Chapter 7, including Fig. 7.2, Table 7.10 and §7.2.2: https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter_07.pdf
- Fig. 7.2 page: https://www.ipcc.ch/report/ar6/wg1/figures/chapter-7/figure-7-2/
- AR6 Technical Summary Fig. TS.17 (what the net feedback includes): https://www.ipcc.ch/report/ar6/wg1/figures/technical-summary/figure-ts-17/
- Zhong & Haigh 2013, Weather: https://courses.seas.harvard.edu/climate/eli/Courses/global-change-debates/Sources/CO2-saturation/more/Zhong-Haigh-2013.pdf
- CO₂ band contributions to forcing: https://www.osti.gov/servlets/purl/1864725
- Indicators of Global Climate Change 2024 (remaining budget 130 GtCO₂ from 2025): https://www.eurekalert.org/news-releases/1087578 and https://climate.leeds.ac.uk/news/scientists-find-three-years-left-of-remaining-carbon-budget-for-1-5c/
- Global Carbon Budget 2025: https://essd.copernicus.org/articles/18/3211/2026/ and https://www.carbonbrief.org/analysis-fossil-fuel-co2-emissions-to-set-new-record-in-2025-as-land-sink-recovers
- Wood (1909) transcript: http://www.wmconnolley.org.uk/sci/wood_rw.1909.html
- Pratt's careful repeat of Wood's experiment: http://clim.stanford.edu/WoodExpt/
- My own re-run in Python of `climate.ts` on the HISTORY, SSP2‑4.5 and SSP5‑8.5 data and the GMST series.
