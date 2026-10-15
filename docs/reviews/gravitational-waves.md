<!-- batch msgbatch_0172H7i3U1VbEghDdtw1y5JA, claude-opus-5-5, submitted 2026-10-15T04:42:15.103Z, ~$0.90 in tokens + 12 web searches -->
# Review: gravitational-waves

## Verdict
The page is ready after the fixes below. The physics is sound. The quadrupole power, the Peters eccentricity factor, the Hulse–Taylor decay, the leading-order chirp, the strain formula, the ISCO frequency, the Barausse remnant-mass fit and the Berti–Cardoso–Will ringdown fits all match their references. The numbers I checked by hand also agree: the Earth radiates about 196 W, the eccentricity factor is 11.85, the pulsar's period shrinks by 75.8 µs a year, 36 + 29 suns gives 61.9 suns and spin 0.686, and h is about 1.25 × 10⁻²¹ at the ISCO from 410 Mpc. The GW150914 and GW170817 facts are right, and the real GWOSC data is used. **The most important fix is the definition of strain.** The text says h is "the fraction by which a distance changes", but the ring is labelled h = 0.5 and visibly changes by ±25%, and the notes and model use the correct ±h/2 per axis. The other fixes are a wrong citation for the spin fit, a wrong comparison with ripple-tank waves, and a mismatch in the measuring step between the text and the readout.

## Factual errors
- **medium**, steps.ts:184: "Their strength falls as 1/distance, like the ripples in a tank spreading out." This is wrong for ripples. A circular ripple spreads its energy around a circle, so its amplitude falls as 1/√r, not 1/r. Gravitational waves spread over a sphere, so their amplitude does fall as 1/r. Fix: "Their strength (the amplitude) falls as 1/distance, as for sound or light spreading out over a sphere; <a href="../waves-interference/">ripples in a tank</a>, spreading over a circle, fade more slowly, as 1/√distance." Source: https://www.vaia.com/en-us/textbooks/physics/physics-for-scientists-and-engineers-6-edition/chapter-16/problem-35-a-two-dimensional-water-wave-spreads-in-circular-/
- **medium**, steps.ts:258, gw.ts:15 and gw.ts:199: the spin fit is credited to the wrong paper. The coefficients −3.5171 and 2.5763 are not those of Rezzolla et al., ApJ 674, L29 (2008). That paper gives t₂ = −3.454 ± 0.132, and t₃ = 2.353 ± 0.548. The values in the code are the refit by Barausse & Rezzolla (2009), which states that because of the larger data set used, the values (3) are slightly different from those in Rezzolla et al. The result barely changes (0.6865 against 0.6869 for equal masses); only the reference is wrong. Fix: in steps.ts, "spin from E. Barausse and L. Rezzolla (ApJ 704, L40, 2009)". Make the same change in the gw.ts header and in the docstring at line 199. Sources: https://iopscience.iop.org/article/10.1086/528935, https://arxiv.org/pdf/0904.2577
- **low**, steps.ts:273: "they arrive 9% lower in frequency". With z = 0.09 the received frequency is f/1.09, which is about 8% lower. The heavier-looking mass is the one that goes up by the full 9%. Fix: "they arrive lower in frequency by a factor 1.09 (about 8%), as if the source were 9% heavier."

## Model issues
- **medium**, RingScene.svelte:50–51: with "cross" and the arms shown, the readouts show the x and y arms growing by up to +3%, while the caption and the notes say neither arm changes. The code measures the full length, √(1 + k²), and the drawn h = 0.5 makes the second-order term visible. Fix: measure the change along each arm only (first order in h): `const xChange = $derived(xArm.x / R - 1); const yChange = $derived(yArm.y / R - 1);`. Plus polarisation still gives ±25%.
- **low**, e2e/gravitational-waves-model.e2e.ts:115: the comment says the horizons are "103 km across each", but 2GM/c² for 35 suns (103 km) is the radius; the horizon is 207 km across. Fix the comment: "horizons of radius 103 km (207 km across)".
- **low**, e2e test at line 168: the text states "The best fit is about 36 suns", but the test accepts anything from 30 to 40. Pin the quoted number with `expect(fit.mc).toBeCloseTo(36, 0)`, or quote whatever the fit actually returns.

The rest of the model checks out: the formulas, constants and units are right, and the limiting cases are tested (the test-particle limit gives 1 − √(8/9), and the ringdown seen at Earth is about 250 Hz with τ about 4 ms).

## Narrative and scene mismatches
- **high**, steps.ts:197 (also the `dfn` in the same paragraph), RingScene.svelte:163 and ChirpScene.svelte:445: the definition of strain contradicts the graphic. The text says "The fraction by which a distance changes is the strain, h = ΔL/L." The ring caption says "strain drawn h = 0.5", but the arm readouts show ±25%. The note at line 199 and the ΔL = h·L in the to-scale step use the correct convention: each axis changes by h/2, and the two arms differ by h·L.
  - Body fix: "The size of the wave is its <dfn …>strain</dfn> h: along one axis distances grow by the fraction h/2 while along the other they shrink by h/2, so two perpendicular arms of length L differ by ΔL = h·L."
  - `dfn` fix: "The size of a gravitational wave: it changes distances along one axis by the fraction +h/2 and along the perpendicular axis by −h/2, so two perpendicular arms differ by h·L. Dimensionless; waves reaching Earth have h ≈ 10⁻²¹."
  - Ring caption fix: "strain drawn h = 0.5 (each axis ±25%); a real one is about 10⁻²¹".
  - ChirpScene row label fix: `'Difference between two 4 km arms'`.
- **medium**, steps.ts:328: at the fitted chirp mass of about 36, the "So, at 150 Hz" readout shows "≥ 83 suns, 367 km apart". The text says "about 70 suns … about 350 km", which uses the full analysis's 30. Fix: "Take the full analysis's 30 suns: the total mass is at least 2.3 times the chirp mass, about 70 suns. Near 150 Hz the orbit turned 75 times a second, so the two bodies were then only about 350 km apart. (Set the slider to 30 to see these numbers; at 36 they come out a little larger.)"
- **medium**, steps.ts:330, with steps.ts:255: the page says the model's chirp stops at the ISCO, about 68 Hz for 65 suns, because "no circular orbit survives" beyond it. Yet the fit uses points up to 160 Hz and says only "later ones belong to the merger". The Keplerian 350 km separation at 150 Hz is also inside the 580 km ISCO. A level-3 reader will notice. Fix: add to the notes "Most of these points lie above the ISCO frequency of a 70-sun pair (about 63 Hz): the Newtonian formula is being pushed into the plunge, which is one reason it runs high; the 350 km separation is likewise a Keplerian estimate, not a stable orbit."
- **low**, ChirpScene.svelte:13: the docstring says the frequency track uses a log scale; the code (`lf`, and the comment at line 659) uses a linear one. Change the docstring to "(linear scale)".

## Catalogue requirements
Met. The reader sets the masses, ripples spread out, the frequency and amplitude climb into a chirp that can be heard, the interferometer arms stretch and squeeze, and the change is shown to scale against a proton. The takeaway is visible in the scale scene and in the summary readouts. The prerequisites (black-holes, waves-interference) are linked.

## Clarity
- **low**, steps.ts:182: "Einstein predicted them in 1916, as an accelerating electric charge sends out light" reads as if the charge were the reason for the prediction. Fix: "…in 1916: they are to mass what light is to electric charge, which radiates when it accelerates."
- **low**, steps.ts:255: "at 6GM/c² for the total mass M" gives the test-particle value without saying so. Fix: add "(strictly the value for a small body orbiting a mass M; for two comparable black holes it is an estimate)".

## Sources consulted
- Rezzolla et al. 2008, ApJ 674, L29 (aligned-spin fit coefficients): https://iopscience.iop.org/article/10.1086/528935
- Barausse & Rezzolla 2009, ApJ 704, L40 (t₂ = −3.5171, t₃ = 2.5763): https://arxiv.org/pdf/0904.2577
- Barausse, Morozova & Rezzolla 2012: https://arxiv.org/abs/1206.3803
- Weisberg & Huang 2016 (masses 1.438 and 1.390, ratio 0.9983 ± 0.0016): https://ui.adsabs.harvard.edu/abs/2016ApJ...829...55W/abstract
- GWOSC GW150914 page (6.9 ms, 203 000 years, 09:50:45 UTC): https://gwosc.org/events/GW150914/
- GW150914 properties paper (detector-frame chirp mass 30.2, source frame 28.1): https://arxiv.org/pdf/1602.03840
- Physics Today on LIGO (20 W to 100 kW): https://physicstoday.aip.org/news/ligo-detects-gravitational-waves
- LIGO system design (test masses 34 cm, 40 kg): https://dcc.ligo.org/public/0005/T010075/002/SysDesign.pdf
- Amplitude of circular ripples falls as 1/√r: https://www.vaia.com/en-us/textbooks/physics/physics-for-scientists-and-engineers-6-edition/chapter-16/problem-35-a-two-dimensional-water-wave-spreads-in-circular-/
