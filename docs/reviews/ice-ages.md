<!-- batch msgbatch_017hL5Evcpu2H2rKrF7BLEhi, claude-opus-5-5, submitted 2026-10-15T04:42:11.927Z, ~$1.10 in tokens + 12 web searches -->
# Review: ice-ages

## Verdict
The page is ready once the fixes below are made. The model is sound. It uses the standard daily-mean insolation formula, the real La2004 orbit, the real EPICA and Bereiter data, and a correct normalised Hann-window spectrum. I recomputed today's 65° N solstice value (478 W/m²), the +33 W/m² from moving the closest pass to June, and the eccentricity figures, and they match. The AR6 and AR4 forcing numbers, the 2025 CO₂ value and the Ganopolski result all check out. The most important fix: the page says the 65° N June-solstice daily value is "the measure Milankovitch chose". It isn't. Milankovitch used caloric summer half-year insolation, which depends much more on the tilt. The rest is small precision fixes.

## Factual errors
- **medium** — steps.ts:151 ("The number on the stage is the measure Milankovitch chose"), steps.ts:195 ("Milankovitch's 65° N solstice value is the classic choice") and milankovitch.ts:30 ("The latitude Milankovitch picked"). Milankovitch's own measure was the *caloric summer half-year* insolation. Köppen & Wegener (1924) published his values for 55°, 60° and 65° N. The 65° N mid-June/July daily value is a later convention, popularised by Berger. This matters here because the step's own note (Huybers 2006) says summer-long totals are tilt-dominated, and the half-year measure is one of those.
  Fix for line 151: "The number on the stage is the classic modern measure, following Milankovitch's focus on northern summers: the sunshine reaching the top of the atmosphere at **65° N** on the day of the June solstice, averaged over 24 hours. (Milankovitch himself used the total over the half-year of summer, which leans more on the tilt.)"
  Fix for line 195: "…the 65° N mid-June value is the classic choice in modern work, and the one used to date many marine records."
  Fix for line 30: "The latitude most often used since Milankovitch: where the great northern ice sheets grew."
  Source: https://cp.copernicus.org/articles/17/1727/2021/ (Berger 2021). Berger says Milankovitch "referred only to his tables providing the long-term variations in the caloric summer and winter half-year insolation."
- **low** — steps.ts:138. "EDC3 is uncertain by up to a few thousand years in the oldest part." Parrenin et al. give "a maximum uncertainty of 6 kyr back to 800 kyr."
  Fix: "EDC3 is uncertain by up to about 6,000 years in the oldest part."
  Source: https://cp.copernicus.org/articles/3/485/2007/cp-3-485-2007.pdf
- **low** — steps.ts:121. "drilled 3.2 km down". The EDC core reached 3,270 m.
  Fix: "drilled almost 3.3 km down".
  Source: https://www.cambridge.org/core/journals/annals-of-glaciology/article/epica-dome-c-2-drilling-operations-performances-difficulties-results/C96155F72EBDBD1AA88532A41F83BF2D
- **low** — steps.ts:165. "the Earth is 3.4% closer to the Sun in early January than in early July". (1+e)/(1−e) = 1.034 means aphelion is 3.4% *further* than perihelion. Perihelion is 1 − (1−e)/(1+e) = 3.3% *closer*.
  Fix: "the Earth is about 3% closer to the Sun in early January than in early July".
- **low** — steps.ts:152. "about 40 W/m², roughly 8%". With today's e and ϖ, tilt 22.1° gives 456.6 and 24.5° gives 495.8 W/m². That is 39 W/m², or 8.6%.
  Fix: "about 40 W/m², roughly 9%". In the test (e2e:229), use `toBeCloseTo(0.086, 2)`.
- **low** — steps.ts:124. "the poles swing about twice as much as the planet as a whole". The page's own numbers (Antarctica about −9 °C, globe −5 to −7 °C) give a ratio of about 1.3–1.8.
  Fix: "the poles swing about one and a half to two times as much as the planet as a whole".
- **low** — steps.ts:282. "the carbon people have already emitted, or soon will, is enough". Ganopolski et al. give 1,000–1,500 GtC. Cumulative emissions to date are roughly 700 GtC, so "already" overstates it. I'm moderately confident of the cumulative figure.
  Fix: "…find that a total of 1,000–1,500 billion tonnes of carbon, not far beyond what people have emitted so far, would postpone the next ice age by at least 100,000 years."
  Source: https://ui.adsabs.harvard.edu/abs/2016EGUGA..1813850G/abstract
- **low** — steps.ts:249, citation. The −1 W/m² each for dust and vegetation and the "approximately −8 W/m²" total are both in AR4 Chapter 6, in the same LGM forcing passage as −2.8 and −3.2. I could not confirm that §9.2.1.3 is the right section (low confidence).
  Fix: cite "(AR4 WG1 §6.4.1.2)" for all four numbers.
  Source: https://archive.ipcc.ch/pdf/assessment-report/ar4/wg1/ar4-wg1-chapter6.pdf

Verified as correct: the AR6 "orbital forcing … negligible" wording and the 5–7 °C very likely range; AR4's −2.8 and −3.2 W/m²; 425.62 ppm for 2025; Ganopolski's "another 50,000 years"; Jouzel's corrections for seawater isotopes and ice-sheet elevation; and the Hays/Imbrie/Shackleton, Huybers, Abe-Ouchi and Lisiecki & Raymo citations.

## Model issues
- **low** — e2e/ice-ages-model.e2e.ts:47–69 and steps.ts:153. The Berger & Loutre check is done at 60° N, but the page displays 65° N. The note says "within 1.5% … over the last 800,000 years", but only 13 dates are tested. insol91 also tabulates 65° N.
  Fix: add 65° N June rows from the same file to the test, or change the note to "agrees within 1.5% with … at sampled dates".
- **low** — OrbitScene.svelte:507. The gauge clamps at 580 W/m², but the sliders can reach about 590 W/m² (tilt 25°, e 0.06, perihelion at the June solstice). The dot then sticks at the end without saying so.
  Fix: `const gx = scale([400, 600], [GL, GR]);`

Everything else is correct: the insolation formula and its polar-day/night handling, the distance, declination and Kepler timing (`perihelionDay`/`periForDay`), 1/√(1−e²), the spectrum normalisation and the AR6 CO₂ forcing. The limiting-case tests are good real-world checks.

## Narrative and scene mismatches
- **low** — steps.ts:248. "Two changes did the growing: ice, and greenhouse gases." The bar chart on the same stage has a third bar, dust and vegetation, at −2 W/m², a quarter of the total.
  Fix: "Two changes did most of the growing: ice, and greenhouse gases (with dust and vegetation adding a less certain share)."

Everything else matches: the numbers the text quotes (9 °C, the peak dates and gaps, 439/478/549, 0.02 W/m², nine and 37, 0.002 at 26 kyr, 54 kyr, two-thirds) are what the scenes compute and the tests assert.

## Catalogue requirements
Met. The tilt, wobble direction (set as the date of closest approach) and stretch controls drive 65° N summer sunshine. The cycles play forward against 800 kyr of EPICA temperature. The ice and CO₂ amplifiers are shown with real data. The Needs (La2004 and EPICA) are met with real datasets.

## Clarity
- **low** — Scene labels use "ka" and "kyr" without explaining them: FutureScene.svelte:102 ("200 ka", "+50 kyr") and SpectrumScene.svelte:148 ("800 ka"). The narrative never introduces them, and W/m² and ppm are also unexplained.
  Fix: use "200,000 yr ago" / "+50,000 yr" in the labels. At first use, write "W/m² (watts per square metre)" (steps.ts:151) and "ppm (parts per million)" (steps.ts:270).

## Sources consulted
- IPCC AR6 WG1 Ch. 7: https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-7/
- IPCC AR4 WG1 Ch. 6: https://archive.ipcc.ch/pdf/assessment-report/ar4/wg1/ar4-wg1-chapter6.pdf
- IPCC AR4 WG1 Ch. 9: https://www.ipcc.ch/site/assets/uploads/2018/02/ar4-wg1-chapter9-1.pdf
- Berger (2021), Milankovitch, the father of paleoclimate modeling: https://cp.copernicus.org/articles/17/1727/2021/
- Parrenin et al. (2007), EDC3: https://cp.copernicus.org/articles/3/485/2007/cp-3-485-2007.pdf
- Jouzel & Masson-Delmotte (2007), PANGAEA dataset: https://doi.pangaea.de/10.1594/PANGAEA.683655
- EPICA Dome C drilling: https://www.cambridge.org/core/journals/annals-of-glaciology/article/epica-dome-c-2-drilling-operations-performances-difficulties-results/C96155F72EBDBD1AA88532A41F83BF2D
- NOAA GML, 2025 global mean CO₂ (via climate.gov): https://www.climate.gov/news-features/understanding-climate/climate-change-atmospheric-carbon-dioxide
- Ganopolski et al. (2016): https://www.nature.com/articles/nature16494 and https://ui.adsabs.harvard.edu/abs/2016EGUGA..1813850G/abstract
- My own recomputation of the insolation formula with today's orbit (e = 0.0167, ε = 23.44°, ϖ = 102.9°).
