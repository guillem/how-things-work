<!-- batch msgbatch_01PSCmk2K7yX5fvTLPnXfMxz, claude-opus-5-5, submitted 2026-10-14T13:19:50.260Z, ~$1.28 in tokens + 10 web searches -->
# Review: earthquakes

## Verdict
The page is ready once the fixes below are made. The model is solid. I re-ran `earth.ts` on the ak135 rows outside the app and got:
- P at 90° in 12 min 59.7 s (10 km source).
- PKIKP at 180° in 20 min 10.8 s.
- The S shadow starting at 100.4° and the P shadow at 99.7°.
- PKP returning from 142.9° and PKIKP from 115.3°.
- S − P at Ankara (43.9°) of 391.7 s; 390 s converts to 43.7°.
- The Ankara P pick 1.6 s later than ak135 predicts.

Almost every number in the text agrees with these. The most important fix is the refraction analogy in "Why the rays curve", which gives the bending the wrong direction. Two smaller jobs follow: make the takeaway (locating and the interior are one measurement) visible in the graphic, and correct the summary's claim that the three Nepal seismograms "took a reading of the whole planet".

## Factual errors
- **Medium**, steps.ts:147. "A wave front that dips into faster rock runs ahead at its lower end, so it turns — exactly as light bends going into glass." Light slows down in glass and bends *towards* the normal. Here the ray speeds up and bends *away* from the vertical, which is the opposite. Step p-shadow (line 174) then uses "like light going into water" for the slowing case, so the two analogies contradict each other. Fix: "…so it turns, just as light bends when it passes out of water into air, where it speeds up." (This follows directly from Snell's law and needs no source.)
- **Medium**, steps.ts:109 and steps.ts:241. "The stored energy goes out as seismic waves", and later "Each ball's volume here is the energy released". Only a few per cent, at most about 10%, of an earthquake's energy is radiated as seismic waves. Most goes into fracturing rock and frictional heat. The magnitude formula used here (log E = 1.5M + 4.8) gives the radiated part only. Fixes:
  - Line 109: "…and part of the stored energy (most of it heats and breaks the rock along the fault) goes out as seismic waves."
  - Line 241: "Each ball's volume here is the energy sent out as seismic waves."
  - Sources: https://pressbooks.cuny.edu/gorokhovich/chapter/causes-of-earthquakes/ and https://link.springer.com/rwe/10.1007/978-3-642-27737-5_627-1 (seismic efficiency "in the order of a few percent").
- **Medium** (moderately confident), steps.ts:227. "This is how earthquakes were located for most of the 20th century." Geiger published the arrival-time least-squares method in 1910 and 1912. Bulletins used travel-time tables and that method by hand, and computer location became routine from about 1960 (Bolt 1960). The three-circle S − P construction is a teaching and graphical method, not the main method of the century. Fix: "This is the idea behind locating an earthquake, and seismologists once drew it on globes by hand." Source: https://link.springer.com/rwe/10.1007/978-3-642-36197-5_184-1
- **Medium**, steps.ts:271. "The same seismograms that told us where the Nepal earthquake struck also took a reading of the whole planet." The three stations are 33–44° away. In the model, the P and S rays that reach them turn about 830–1,050 km down, so they never touch the core. Fix: "The same earthquake was recorded by seismometers all round the world: the ones nearby told us where it struck, and the waves reaching the far side crossed the core. Every recording that locates an earthquake is also a reading of the inside of the Earth."
- **Low**, steps.ts:254. "About a million earthquakes of magnitude 2 or more every year." The USGS estimates 1,300,000 a year of magnitude 2–2.9 alone, so the total for 2 or more is about 1.5 million. Fix: "about one and a half million". Source: https://prod-earthquake.cr.usgs.gov/learn/facts.php
- **Low**, steps.ts:149. "Cut into 1,300 thin shells." `buildShells('ak135')` returns 1,380. Fix: "about 1,400 thin shells".
- **Low**, steps.ts:215. "Filtered only to remove the slow drift of the instrument." The data header says the traces were converted to ground velocity, high-passed at 50 s, rotated to transverse, and reduced to a min/max per second; the scene also compresses the heights. Fix: "converted to ground motion and filtered to remove the slow drift of the instrument (the heights are compressed in the drawing)".

Everything else checks out: Reid, Jeffreys 1926, Oldham 1906, Gutenberg 1914 at 2,900 km, Lehmann 1936, Mohorovičić 1909, Kola at 12.262 km, the ak135 speeds, Hanks–Kanamori, Gutenberg–Richter 1956, the 7.6 Mt and ×89 figures, and the USGS event ids and location.

## Model issues
- **Low**, e2e/earthquakes-model.e2e.ts. steps.ts:3–5 says the e2e test checks the quoted numbers, but several are not asserted:
  - 6½ min → about 44° and 4,900 km
  - 26 min for a uniform Earth to 90°
  - 143° and 115° at the source depth actually drawn (10 km); only depth 0 is tested
  - the Ankara P pick 2 s after ak135
  - about 130 a year of M ≥ 6
  - 4,516 earthquakes in the catalogue

  Add, for example:
  `expect(distanceFor(390)).toBeCloseTo(44, 0); expect(arrivalOf('P', 90, 10, 'uniform')! / 60).toBeCloseTo(26, 0); expect(Math.round(stations[0].rec.pPick - stations[0].pModel)).toBe(2); expect(Math.round(perYearAtLeast(6) / 10) * 10).toBe(130); expect(Math.round(perYearAtLeast(5.5) * 10)).toBe(4516);`
- **Low**, e2e:32–41. PKP (drawn and listed in the station panel) is never compared with the tables; only PKIKP is. Add a PKP row (for example PKPab at 170°) from the same ak135 table page.

The ray tracing, the source-shell handling, the uniform-Earth chord test and the inverse of the magnitude relations all check out.

## Narrative and scene mismatches
- **Low**, steps.ts:201. "Close to the earthquake, P and S arrive a few seconds apart." The seismometer can only go down to 2°, where the model gives S − P = 25 s. Fix: "Close to the earthquake, P and S arrive within seconds of each other (about 25 s apart at 2°, the nearest shown)."
- **Medium**, MagnitudeScene.svelte:194. The readout note says "magnitude 5.5–6, 6–6.5, … 8–8.5: about ten times fewer per step", but the bars are half-magnitude bins. Neighbouring bars therefore differ by about 3×, not 10×. Fix: `note="half-magnitude bins: about three times fewer per bar, ten times fewer per whole magnitude"`.
- **Low**, steps.ts:200. "Underneath, its record shows…". The record is the timeline in the right-hand panel, not under the seismometer. Fix: "Beside the Earth, its record shows…"

## Catalogue requirements
- **Medium**, LocateScene.svelte (lag phase chart, around lines 378–386). The takeaway ("the recordings that locate an earthquake also reveal the layers") is only stated in the text, never shown. Making it visible is cheap. In the uniform Earth the model gives S − P = 556 s at 44°, against 392 s in ak135. Draw a faint dashed second curve for `'uniform'` labelled "if the Earth were the same rock all through". The reader then sees that the same 6½-minute gap would give a very different distance, so locating only works because the waves have measured the interior. Optionally, also mark the three Gorkha stations' distances (33°, 38°, 44°) on the summary slice.

The interaction, the needs (ak135, real GSN recordings, the USGS catalogue) and the prerequisite links are all met.

## Clarity
- **Low/medium**, steps.ts:162. "The outer core … about half the Earth's radius across" is ambiguous: "across" suggests a diameter, and the outer core is a shell 2,260 km thick. Fix: "…molten iron and nickel; the core's radius is a little over half the Earth's."
- **Low**, steps.ts:121. "P still gets through, because a liquid can be squeezed": what carries a P wave is that the liquid pushes back. Fix: "because a liquid pushes back when it is squeezed".

## Sources consulted
- ak135 tables (Kennett): http://rses.anu.edu.au/seismology/ak135/intro.html; model rows re-run locally from `earth.ts`
- NAS memoir of Beno Gutenberg (core at 2,900 km, 1914): https://www.nasonline.org/wp-content/uploads/2024/06/gutenberg-beno.pdf
- USGS Earthquake Facts and Statistics: https://prod-earthquake.cr.usgs.gov/learn/facts.php
- Earthquake Location (Geiger 1910/1912, Bolt 1960), Springer Encyclopedia: https://link.springer.com/rwe/10.1007/978-3-642-36197-5_184-1
- Bormann, "Earthquake: Magnitudes, Energy, and Moment" (seismic efficiency): https://link.springer.com/rwe/10.1007/978-3-642-27737-5_627-1
- CUNY Pressbooks, Causes of Earthquakes (energy budget): https://pressbooks.cuny.edu/gorokhovich/chapter/causes-of-earthquakes/
- Kola Superdeep Borehole: https://en.wikipedia.org/wiki/Kola_Superdeep_Borehole
- APS News, Lehmann 1936: https://www.aps.org/apsnews/2023/08/seismologist-lehmann-earth-inner-core
- Elastic rebound (Reid 1910): https://link.springer.com/rwe/10.1007/978-1-4020-4399-4_110
