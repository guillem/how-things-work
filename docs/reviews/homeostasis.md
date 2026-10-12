<!-- batch msgbatch_01LGjXyQnqK5NGi93Qq53u3f, claude-opus-5-5, submitted 2026-10-12T07:08:43.743Z, ~$0.84 in tokens + 15 web searches -->
# Review: homeostasis

## Verdict
The page is ready after the fixes below. I re-ran the model in Node, and almost every number the narrative quotes matches it: the 2-hour value of 120 mg/dL, type 1 crossing 126 mg/dL below 25% of normal production, the 10–15 mg/dL dip on a fasting run, 40%/40% giving a fasting glucose of 134, the 17 units a day of background insulin, and the soar-then-crash when the dose is injected an hour late. Two fixes matter most. The definition of "pancreas" is wrong: it describes the islets instead. And on the dosing step the text tells the reader to compare the glucagon chart with the healthy faint curve, but that healthy curve never shows glucagon rising to rescue a low.

## Factual errors
- **high**, steps.ts:145, the `dfn` for "pancreas". It reads "A small part of the pancreas made of clusters of hormone-producing cells, the islets of Langerhans". That describes the islets, and it defines the pancreas as a part of itself. Fix: `data-def="An organ behind the stomach. Most of it makes digestive juices; scattered through it are tiny clusters of hormone-producing cells, the islets of Langerhans."`
- **medium**, steps.ts:193, the `dfn` for type 1 diabetes: "It usually starts in childhood or early adulthood." Recent epidemiology shows that about half of type 1 cases, or more, are diagnosed in adults. Fix: "It can start at any age; about half of cases begin in adulthood." Sources: https://dom-pubs.onlinelibrary.wiley.com/doi/full/10.1111/dom.16402 and https://www.thelancet.com/journals/landia/article/PIIS2213-8587(17)30362-5/fulltext
- **low**, steps.ts:131: the brain "cannot store any" glucose. The brain does store glycogen, at low concentration and mostly in astrocytes, and it uses that store during hypoglycaemia. Fix: "it can store only a tiny amount". Source: https://www.researchgate.net/publication/6178552_Astrocyte_glycogen_and_brain_energy_metabolism
- **low**, steps.ts:135: "well under an hour". 4 g ÷ (120 g/day) is about 48 minutes, which is not "well" under. Fix: "would last it only about 50 minutes if nothing topped it up."
- **low** (moderate confidence), steps.ts:227: the line "lose their glucagon response … within a few years" is attributed to Gerich et al. 1973. That paper showed the defect exists. I could not confirm that it established the timescale. Fix: drop "within a few years", or cite a study of time since diagnosis for it.

## Model issues
- **medium**, model.ts:116–121, the healthy meal response. With the 75 g drink, glucose peaks at 193 mg/dL at 41 min, is 159 at 60 min, and insulin peaks at 138 µU/mL. The 2-hour value passes, but a 1-hour value of 159 is at or above the IDF 2024 1-hour cut-off for intermediate hyperglycaemia (≥155 mg/dL). So the "healthy" adult would be flagged as at risk, and the insulin peak is high for normal glucose tolerance.
  - I swept the Hill parameters. Getting the 1-hour value under 155 needs peak insulin of about 150–190 µU/mL, so the limit comes from the model's structure (insulin acting too slowly at Topp's SI), not from the β-cell calibration.
  - Fix: say so in the meal step's note: "In this model a healthy adult's glucose peaks near 190 mg/dL; in real people it usually peaks lower and earlier." Also add a test that pins the peak, so that any recalibration is checked (e.g. `expect(extremes(s,0,360).hi.g).toBeLessThan(200)`).
  - Source: https://idf.org/news/idf-position-statement-1-hour-pg-test/ and https://www.sciencedirect.com/science/article/abs/pii/S0168822724007666
- **medium** (moderate confidence), model.ts:318, the exercise insulin term. `ie` is removed at a fixed rate, whatever the insulin level. At 65% effort its steady value (A6·57/A7 ≈ 1.58 µU/mL/min) is larger than the whole fasting secretion (1.38). The results:
  - On a fasting run, insulin falls 10 → 2.5 µU/mL by 40 min (−75%).
  - On a run starting 60 min after the meal, insulin hits 0 and glucose falls to 71.9 mg/dL in a healthy body.
  - The comment's own justification ("mostly the pancreas secreting less") implies the cut cannot exceed secretion. Minimal fix: `const cut = Math.min(sec, Math.min(1, sc.production) * s.ie); const di = sec - cut + sc.basal + injected - KE * s.i;` Better: refit the cut so a 45-minute moderate run lowers insulin by roughly half.
  - I could not check the numeric values of a6 and a7 against Roy & Parker. The equation structure dIe/dt = a6·PVO2max − a7·Ie is confirmed: https://pmc.ncbi.nlm.nih.gov/articles/PMC2732993/
- **low**, model.ts:110–111, comment. It says Topp's own β-cell response "lets glucose stay above 250 mg/dL for two hours". Re-running with n = 2 and K = 141 gives about 87 minutes above 250 (2-hour value 271). Fix: "stay above 250 mg/dL for an hour and a half, and leaves it near 270 at two hours".
- **low**, model.ts:33–44 and 77–81. The header says the changes are "all stated on the page", but two are not. Swapping Topp's insulin clearance for Hovorka's appears nowhere in steps.ts. The missing stress hormones matter too, because adrenaline is a major defence against hypoglycaemia and during exercise. Fix: add to the meal step's "The model" note: "Insulin is cleared at the rate Hovorka et al. measured; adrenaline, cortisol and growth hormone, which also defend against low glucose and act during exercise, are left out."
- **low**, e2e tests. These narrative claims are not tested: production below about 25% gives a fasting value of 126 or more; a fasting run dips 10–15 mg/dL; a dose injected 60 min after the meal soars, then goes below 70; the type 1 peak is above 400. Add tests for them so the text cannot drift from the model.

## Narrative and scene mismatches
- **medium**, steps.ts:223 with scenario.ts:89. "In type 1 diabetes glucagon does not rise to rescue it either: compare the glucagon chart with the healthy faint curve." The ghost is a healthy person eating the same meal with no injection. They never go low, so their glucagon only dips to ×0.5 after the meal (and rises during the run if the run toggle is on). The comparison therefore never shows a rescue.
  - Fix in scenario.ts: give the healthy ghost the same injection, `ghost: { ...dosingMeal, ...dosingRun, dose: num('dose'), doseAt: num('doseAt') }`, with `ghostLabel: 'healthy, same injection'`. In the model test, 8 U pushes healthy glucagon above ×2.
  - Or reword: "…glucagon does not rise to rescue it either: its line stays flat even when glucose drops below 70, where a working pancreas would raise it two- to threefold."
- **medium**, PlotScene.svelte:162–169 and BodyScene. With the default sliders, the type 1 and type 2 steps show "Fasting: 100 mg/dL" with the subtitle "normal (under 100)", which contradicts itself. The healthy baseline (Topp's 100 mg/dL) sits exactly on the ADA cut-off for impaired fasting glucose (100–125). The BodyScene, meanwhile, shows 90.
  - Fix (preferred): calibrate the healthy fasting state to 90 mg/dL by setting `R0 = 0.9 * 864 / DAY` and stating it in the header. The insulin of 10 µU/mL is kept, and the ADA labels and the body scene then agree.
  - Fix (minimal): change the subtitle to `fast < 100.5 ? 'normal (up to 100)' : …` and say in the type 1 note that this adult sits at the top of the normal range.
- **low**, steps.ts:227: "with its peak effect about an hour after the injection". In the model, plasma insulin peaks at 63 min and its action (the remote compartment) at 95 min. Fix: "plasma insulin peaks about an hour after the injection, and its effect on glucose about half an hour later."
- **low**, steps.ts:164: "Within about two hours glucose is back under 140 mg/dL, and insulin and glucagon return to their starting levels." At 2 h insulin is still 23 µU/mL (2.3× fasting) and glucagon is ×0.7. Both return only by about 4 h. Fix: "…back under 140 mg/dL; by about four hours insulin and glucagon are back at their starting levels."
- **low**, steps.ts:210: "Now turn production up to 200%. With twice the insulin, glucose looks almost normal again." That holds at 40–50% sensitivity. At the slider's 10%, fasting is 123 and the 2-hour value 178. Fix: "With sensitivity at 40%, turn production up to 200%…"
- **low**, steps.ts:181: the claim that Ahlborg found glucose "nearly level for the first 40 minutes" sits beside a model run in which fasting glucose falls 13 mg/dL by 30 min. Ahlborg's exercise was also milder than the 65% default. Fix: "…glucose stayed nearly level for the first 40 minutes of mild exercise…"
- **low**, steps.ts:194: "At 0%, glucose after a meal climbs above 400 mg/dL". The model peaks at 615 and is still 450 at 6 h. The statement is true but undersells what the chart shows. Fix: "…climbs past 600 mg/dL and is still above 400 six hours later."
- **low**, PlotScene.svelte:643: with a 0 g meal on the run step, the x-axis still reads "time after the meal". Fix: `xLabel={sc.carbs > 0 ? 'time after the meal' : 'time'}`.

## Catalogue requirements
- Everything is met. Meal and run plot glucose, insulin and glucagon over hours; production and sensitivity sliders model type 1 and type 2; insulin can be dosed by hand; the broken-loop takeaway is visible in LoopsScene. The only gap is the simplifications listed under Model issues that are not yet stated on the page.

## Clarity
- **low**, steps.ts:145: "The thermostat is the pancreas" comes before any thermostat has been mentioned; the analogy only arrives at line 150. Fix: "The control centre is the pancreas."
- **low**, PlotScene.svelte:430 and 616: "µU/mL" is never explained for a level-1 reader. Fix: add a `dfn` when insulin first appears in the meal step: "insulin is measured in micro-units per millilitre (µU/mL); about 10 is normal after a night's fast."

## Sources consulted
- Topp et al. 2000 model and parameters (BioModels BIOMD0000000341): https://www.ebi.ac.uk/biomodels/BIOMD0000000341
- Roy & Parker 2006 (IFAC/ADCHEM): https://www.sciencedirect.com/science/article/pii/S1474667016353757
- Roy & Parker 2007 (Journal of Diabetes Science and Technology): https://doi.org/10.1177/193229680700100305
- Roy & Parker equation structure, restated: https://pmc.ncbi.nlm.nih.gov/articles/PMC2732993/
- Roy & Parker parameters fitted to data from healthy individuals: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0248280
- Schwartz et al. 1987 glycaemic thresholds (systematic review): https://pmc.ncbi.nlm.nih.gov/articles/PMC9477942/
- IDF 2024 1-hour glucose position statement: https://idf.org/news/idf-position-statement-1-hour-pg-test/ and https://www.sciencedirect.com/science/article/abs/pii/S0168822724007666
- Brain glycogen in astrocytes: https://www.researchgate.net/publication/6178552_Astrocyte_glycogen_and_brain_energy_metabolism
- Type 1 diabetes diagnosed in adults: https://dom-pubs.onlinelibrary.wiley.com/doi/full/10.1111/dom.16402 and https://www.thelancet.com/journals/landia/article/PIIS2213-8587(17)30362-5/fulltext
- My own re-run of `model.ts` in Node 22: every simulated value quoted above comes from that run.
- Not re-checked online (the search quota ran out), but they agree with what I know: the ADA thresholds, the CDC 5–10% and 90–95% shares, Hovorka 2004 constants, Wasserman's 4 g, Stryer's 120 g a day, and the Gerich 1973 citation.
