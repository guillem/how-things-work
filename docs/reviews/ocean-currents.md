<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.97 in tokens + 12 web searches -->
# Review: ocean-currents

## Verdict
The page is ready after the fixes below. The physics is sound. I checked the Stommel solution, the two-box model, Jin's recharge oscillator and the reduced-gravity tilt against their equations and constants, and the numbers the text quotes match what the model computes: about 20 Sv, a 46× western speed-up, 1.63× and 0.85× thresholds, 1.39 PW, 146 m, 0.6 m and a cycle of about 3.2 years. The most important fix: with the Bjerknes feedback switched off, the scene still labels an "El Niño" and shows drought and floods far away, which contradicts the text. Next, the takeaway's "a shift in either changes weather far away" is never shown for the gyres or the overturning.

## Factual errors
- **medium** — steps.ts:216, "about 200 metres down in the west but only about 50 in the east". Observations put the western thermocline shallower than that. NOAA JetStream says the warm layer in the west is a deep 450-foot (150 meter) warm layer in the west that pushes the thermocline down while it rises in the east, and that the eastern one is The shallow 90-foot (30 meter) eastern thermocline. The model gives 193 m and 47 m. Fix: "roughly 150–200 metres down in the west but only about 50 or less in the east". Source: https://www.noaa.gov/jetstream/tropical/enso/enso-patterns
- **low** — steps.ts:160, "about 31 sverdrups through the Straits of Florida". The cable record gives a time mean of 31.7 Sv, and the ship sections give 32.3 Sv. The NOAA summary says the FC has a. mean transport of about 32 Sv. Fix: "about 32 sverdrups" (and "about 30" at line 158 can stay). Sources: https://www.nature.com/articles/s41467-024-51879-5, https://www.aoml.noaa.gov/phod/docs/Volkov_etal_Inferring_Florida_Current_volume_transport_from_satellite_altimetry_JGR2020.pdf
- **low** — steps.ts:159, "run at up to 2 m/s". The Gulf Stream reaches a maximum velocity of about 250 cm s^−1. Fix: "up to about 2.5 m/s". Source: https://www.sciencedirect.com/topics/earth-and-planetary-sciences/gulf-stream
- **low** — steps.ts:175, "The model is Henry Stommel's of 1961". Stommel restored both temperature and salinity toward fixed values. The version used here (fixed temperatures, a fixed freshwater flux) came later: the mixed boundary conditions were introduced by Bryan (1986a). Fix: "The model is a version of Henry Stommel's 1961 two-box model in which the far north receives a fixed flow of fresh water instead of being nudged towards a fixed salinity." Source: https://tellusjournal.org/articles/10.16993/tellus.4175
- **low** — steps.ts:173, salinity definition: "in grams per kilogram (practical salinity units, psu)". Practical salinity has no units; it is only approximately g/kg. Fix: "roughly the grams of salt in a kilogram of sea water (measured on the practical salinity scale, often written psu)".

Everything else checks out: Nansen's 20–40° (20 to 40 degrees to the right of the prevailing wind direction), RAPID's 17 Sv and 1.2 PW (17.2 Sv and heat transport of 1.25 PW), Jin's scales and parameters, the IPCC statement, the half-metre sea-level difference, Schmitz & Richardson's 13 Sv, and 70–150 Sv downstream.

## Model issues
- **medium** — PacificScene.svelte:208, 266–272; e2e/ocean-model.e2e.ts:246–248. With the feedback at 0 and the default 30% lull, the model's anomaly peaks at **+1.08 °C** and stays above 0.5 °C for about 4.4 months. The scene therefore shows "El Niño" plus "drought, bushfires" and "floods". That contradicts steps.ts:229 ("only warms the sea a little, briefly") and the page's own definition ("for several months"). The test only checks `< peak/2`. Fix: base the label on persistence, as NOAA's index does. For example, keep a 3-month running mean of `run.T` and set `ensoState` to El Niño/La Niña only where |mean| > 0.5 °C has lasted at least 5 months. Show `farAway` only in that case, and add the test `expect(Math.max(...off)).toBeLessThan(1.2)` together with a check that the persistence-based label never fires when μ = 0.
- **low** — ocean.ts:358–360 and OverturnScene.svelte:474. The straight-line equation of state is fitted at 10 °C. It puts tropical water (25 °C, 35.5) at 1024.77 kg/m³, but real sea water at that temperature and salinity is about 1023.7, so the shown density difference (2.71) is too small by about a quarter. The simplification is stated, but the two-decimal readout suggests more precision than the model has. Fix: show `rho.toFixed(1)` and add "(straight-line approximation)" under the box readouts.
- **low** — PacificScene.svelte:127, 262. With weaken 0.45 and feedback at or above 1, the wind anomaly goes beyond reversing the trades (they reach −10% to −27%), but `Math.max(0, …)` shows "0%". Fix: when `pic.trades < 0`, show the value "westerly" with the sub "trades reversed".
- **low** — ocean.ts:318 `sverdrupTransport` is exported but never used or tested, so the stated Sverdrup interior balance (ocean.ts:17–18) is never checked. Fix: add a test comparing `−psiAt(g, 600e3, y).psi` with `sverdrupTransport(WINDS, lat) × (width − 600 km)/width` within 5% for several latitudes, or remove the function.

Otherwise the model is correct: the Stommel modes and boundary conditions, the box-model equilibria and thresholds, and the Jin equations all hold.

## Narrative and scene mismatches
- **medium** — steps.ts:201, "over the next few centuries it winds down". In the model, reversal takes about 245 years at 2.5×, about 490 at 2×, and about 1,500 at 1.7×. A reader who pushes just past 1.6× sees almost nothing within the 1,000-year plot. Restarting at 0.8× takes about 665 years. Fix: "…over centuries (the closer you are to the tipping point, the slower) it winds down…", and in the restart sentence add "…below about 0.85 times today's, and even then it takes centuries."
- **low** — steps.ts:157, "the gyre becomes symmetric, with gentle currents on both sides". The card then jumps from 20 Sv to **52.5 Sv**, which surprises the reader; only the notes explain it. Fix: append "— and, without the squeeze, it actually turns more water, about 50 Sv in the model, but spread across the whole basin."
- **low** — steps.ts:156, "more than forty times faster". This holds for the default winds (46×), but the ratio falls to about 35× when either wind is set to zero. Fix: "with the starting winds, more than forty times faster…".
- **low** — steps.ts:215 says "about half a metre", while the scene readout shows "0.60 m" (and the notes say 0.6). Fix: "about half a metre (0.6 m in the model)".
- **low** — steps.ts:80–85 and ocean.ts:540. "How much the trades weaken, for six months" is applied as a half-sine, so 30% is the peak and the six-month average is about 19%. Fix the label: "How much the trades weaken at most, over six months".
- **low** (unsure, depends on the framework) — steps.ts:226. `duration: 36` is shorter than the 48 s replay of the 8-year run (one time unit per second). If `duration` limits playback, the last two years, including the La Niña recovery, are never shown. Fix: `duration: 50`.

## Catalogue requirements
- **medium** — The takeaway says "…and a shift in either changes weather far away". The graphic shows far-away weather only for El Niño, which is a coupled equatorial ocean–atmosphere mode, not a shift in the gyres or the overturning. The closing sentence at steps.ts:231 implies otherwise. Fixes:
  1. In OverturnScene, when `q < 0.5 * SV` in the tipping phase, add a label over the far north such as "less heat for the North Atlantic: colder winters around it", tied to the existing PW readout.
  2. Reword steps.ts:231: "**The ocean moves heat around the planet: fast and shallow in the wind-driven gyres, slow and deep in the density-driven overturning. Shifts in the winds or in the overturning, like the El Niño you just set off or a stalled Atlantic overturning, change the weather far away.**"
- **low** — The gyre scene never shows heat being moved (it has only warm/cold labels). Optional: add a card cell such as "warm water carried north: ≈ X Sv". The overturn scene already shows PW.
- The interaction is built as written (winds → gyres; polar temperature and fresh water → overturning; weakened trades → El Niño). There is no Pitfall or Needs field to check.

## Clarity
- **low** — steps.ts:186. "petawatts" appears in the body before it is explained (only the card defines it). Fix: "about 1.2 petawatts (1.2 million billion watts) of heat north".
- **low** — PacificScene.svelte:489, "depths to scale, sea level exaggerated". The depths are to scale only with each other; the vertical is stretched about 18,000× against the width. Fix: "along the equator · depths to scale with each other (about 20,000× stretched), sea level exaggerated more".

## Sources consulted
- https://www.aoml.noaa.gov/phod/docs/2010_DSRI_Meinen_etal_LongTermFC.pdf (Florida Current, cable since 1982, mean 32.1 Sv)
- https://www.nature.com/articles/s41467-024-51879-5 (Florida Current 1982–2023 means)
- https://www.aoml.noaa.gov/phod/docs/Volkov_etal_Inferring_Florida_Current_volume_transport_from_satellite_altimetry_JGR2020.pdf
- https://journals.ametsoc.org/view/journals/atsc/54/7/1520-0469_1997_054_0811_aeorpf_2.0.co_2.xml (Jin 1997: scales and parameters confirmed)
- https://www.aoml.noaa.gov/phod/docs/McCarthy_etal_ProgOcean_2015.pdf and https://www.sciencedirect.com/science/article/abs/pii/S0079661114001694 (RAPID 17.2 Sv, 1.25 PW)
- https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-9/ (AMOC very likely to decline; medium confidence of no abrupt collapse before 2100)
- https://www.pmel.noaa.gov/elnino/what-is-el-nino/ (½ m sea-level difference)
- https://www.noaa.gov/jetstream/tropical/enso/enso-patterns (thermocline depths)
- https://oceanmotion.org/html/background/ocean-in-motion.htm (Nansen's 20–40°)
- https://www.sciencedirect.com/topics/earth-and-planetary-sciences/gulf-stream (Gulf Stream width and speed)
- https://tellusjournal.org/articles/10.16993/tellus.4175 (history of Stommel 1961 and mixed boundary conditions)
- I also ran the model in Node to get the gyre transports with and without β, the speed ratios for several wind settings, collapse and restart times, and the ENSO peaks.
