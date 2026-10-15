<!-- batch msgbatch_017hL5Evcpu2H2rKrF7BLEhi, claude-opus-5-5, submitted 2026-10-15T04:42:11.927Z, ~$0.89 in tokens + 8 web searches -->
# Review: big-bang

## Verdict

The page is ready once the fixes below are made. I re-ran `cosmology.ts` in Node, and almost every number the page quotes is correct: age 13.795 Gyr, lookback time 7.95 Gyr at z = 1, acceleration from 7.70 Gyr, dark energy dominant from 10.30 Gyr, matter–radiation equality at 50,500 yr, freeze-out at 1.17 s with n/p = 1/5.04, deuterium surviving at 4.41 min with n/p = 1/7.15, Y = 24.55%, last scattering at 371,200 yr and 2,973 K, JADES-GS-z14-0 at 2.22, 13.51 and 33.7 Gly receding at 5.10c then and 2.32c now, horizon 46.1 Gly, c/H₀ = 14.52 Gly, z_re at 672 Myr, and z = 30 / 20 at 99 / 178 Myr. The physics is implemented correctly, including the e± entropy transfer and the integrals. The most important fix is the CMB step's **"Electrons bound in atoms" readout**: it shows 50% at last scattering, when in reality about 90% of electrons are already bound by then. Next is the map legend, whose middle label is wrong.

## Factual errors

- **medium** — steps.ts:202 (helium notes). The note says "24.5–24.7% (the range depends on the reaction rates used)". The range actually comes from two definitions of the helium fraction, not from reaction rates. Planck 2018 VI quotes Y_P ≈ 0.2454 as the true mass fraction and Y_P^BBN ≈ 0.2467 as the nucleon fraction 4n_He/n_b; Aver et al.'s 0.2449 is given on the nucleon basis. Replace the parenthesis with: "(24.5% counted as a true mass fraction, 24.7% counted as nucleons; this page's count is the second kind)". Source: https://www.cosmos.esa.int/documents/387566/387653/Planck_2018_results_L06.pdf/38659860-210c-ffac-3921-e5eac3ae4101
- **medium** — steps.ts:186. "there were a little fewer neutrons than protons". At the default 1 s, the readout itself shows "1 for every 4.5 protons" (e^(−1.293/0.86) = 0.22), which is not "a little". Replace with: "so there were fewer neutrons than protons (…), and fewer and fewer as it cooled".
- **low** — steps.ts:101. "real galaxies are thousands of times more crowded" fits neither measure. Typical galaxy spacing is about 1 million light years, roughly a thousand times closer than the map's 1 Gly; by number per volume the gap is around a billion. Replace with: "(real galaxies are typically a million or so light years apart, about a thousand times closer)". Source: https://pubs.aip.org/books/chapter-pdf/12806783/9780735421141_001.pdf
- **low** — steps.ts:214. "about 970 nm": Wien's law at 2,973 K gives 975 nm, and the test asserts 975. Replace with "about 980 nm" or "just under 1 micrometre".
- **low** — steps.ts:256. "42 million light years": the model gives 41.5 (45.23 Gly ÷ 1,090.92). The readout also shows 42, but only because of double rounding (see the model issues). Replace with "about 41 million light years".
- **low** — steps.ts:201. "The Big Bang made almost nothing heavier, just traces of deuterium, helium-3 and lithium". Deuterium and helium-3 are lighter than helium-4, so "heavier" is wrong for two of the three. Replace with "almost nothing else".
- **low** — steps.ts:169. Friedmann's 1922 paper did not contain this three-term flat form; he had matter and Λ, not radiation, and positive curvature. Replace with: "In 1922 Alexander Friedmann worked out, from Einstein's general relativity, how the expansion rate H depends on what the universe contains. In today's notation, for a flat universe:".
- **low** — steps.ts:228. "one of the most distant confirmed" is still true, but MoM-z14 (z = 14.44, Naidu et al. 2025) has since overtaken JADES-GS-z14-0. Optionally add: "(MoM-z14, at z = 14.44, has since edged past it)". Source: https://en.wikipedia.org/wiki/MoM-z14

## Model issues

- **medium** — TimelineScene.svelte:113, 399–405. `neutral` is a smoothstep across z* ± 100, so "Electrons bound in atoms" reads 50% at z = 1090. Real recombination is half complete at 1 + z ≈ 1270, and only about 10% of electrons are still free at z* (I am about 80% confident of the exact value). The smoothstep is a fair schematic of when light stops scattering (optical depth τ = 1 at z* by definition), but not of how many electrons are bound. There are two ways to fix it:
  - Quick fix: relabel it as what it actually models. Change the readout to `label="Light that has escaped for good"` with text `'Light that has escaped for good'`, and add to the CMB notes: "The switch from opaque to transparent is drawn schematically across z* ± 100."
  - Proper fix: add a Peebles three-level-atom x_e(z) to `cosmology.ts`, drive the readout with it, and test that x_e(1090) is about 0.1 and x_e = 0.5 near z ≈ 1250–1300.

  Source: https://arxiv.org/pdf/hep-ph/0004188
- **medium** — GridScene.svelte:145. The legend's middle label reads "0.3", but the colour scale is m = ln(1+z)/ln 2.5, so the middle colour (m = 0.5) is at z = √2.5 − 1 ≈ 0.58. Fix: `text="0.6"`.
- **low** — format.ts:59. `n0(Number((d*1000).toPrecision(3)))` rounds twice: 41.46 becomes 41.5, which becomes 42. Fix:
  ```ts
  if (d < 0.1) return `${n0(d * 1000)} million light years`;
  if (d < 1) return `${n0(Number((d * 1000).toPrecision(3)))} million light years`;
  ```
- **low** — Several scenes hard-code values the model already computes: TimelineScene.svelte:78 (`zEq = 3418`), :98–99 (10.3 Gyr) and :449 (7.7 Gyr). All are correct today but will drift if the parameters change. Derive them instead: `OMEGA_M/OMEGA_R − 1`, `timeAt((OMEGA_M/OMEGA_L)**(1/3))`, and the ä = 0 bisection (move `tAcc` from GridScene into `cosmology.ts` and export it).
- **low** — The tests leave several quoted numbers unpinned. The Y test (0.23–0.26) is looser than the note's "24.5%", and nothing checks the 7.95, 7.7, 10.3, 290 Myr or 2.2 Gly figures the text quotes. Add, for example, `expect(Y).toBeCloseTo(0.245, 3)`, `expect(AGE - timeAt(0.5)).toBeCloseTo(7.95, 2)`, `expect(timeAt(aAcc)).toBeCloseTo(7.7, 1)`, and `expect(far.then).toBeCloseTo(2.2, 1)`.
- **low** — GridView.svelte:73. The comment says arrows show "a quarter of the Hubble time", but `ARROW_TIME = 0.3`. Change the comment to "0.3 of the Hubble time".

## Narrative and scene mismatches

- **medium** — The box in TimelineScene shows 18 photons and up to 12 e± pairs beside 32 nucleons. The real ratio, 1.6 billion photons per nucleon, appears only in a code comment, but the catalogue requires simplifications to be stated on the page. Add to the first-second notes: "The box is a schematic sample, not to scale: in reality there are about 1.6 billion photons for every proton or neutron."
- **low** — steps.ts:188. "a textbook estimate of when the reactions stop (a standard textbook estimate)" says the same thing twice. Delete the parenthesis.
- **low** — GridScene.svelte:285. The axis label reads "distance now", but during the film (3–20 Gyr) it means the distance at the moment shown, and in the last chapter "now" means today. Replace with `text="distance at that moment, billion light years"`.

## Catalogue requirements

All met:
- The expansion runs forward and backward (the film, plus the time slider).
- Any galaxy can be picked as the viewpoint (select box or click).
- Redshift is shown by colour and by the stretch scene.
- The timeline runs from 0.01 s through the CMB and the first stars to today.
- The takeaway is visible in the split view and in the a(t) curve reaching zero.
- The no-centre pitfall is avoided with two side-by-side viewpoints.

## Clarity

- **medium** — steps.ts:172. "which counts double, because of its negative pressure": pressure is never introduced, which is a jump for level 2. Replace with: "(in general relativity pressure also gravitates, and dark energy's pressure is negative, so it pushes with twice the strength of its density)".
- **low** — GridScene.svelte:463. "At a = 0, no limit." is cryptic. Replace with `text="at once. Toward a = 0 they grow without limit."`.

## Sources consulted

- Planck 2018 VI, cosmological parameters (H₀, Ω, z*, z_re, BBN Y_P definitions, Aver 2015): https://www.cosmos.esa.int/documents/387566/387653/Planck_2018_results_L06.pdf/38659860-210c-ffac-3921-e5eac3ae4101
- García-Bellido, "Astrophysics and Cosmology" (recombination at 1 + z ≈ 1270): https://arxiv.org/pdf/hep-ph/0004188
- AIP Publishing, "The Distance Scale of the Universe" (average galaxy separation of about 1 million light years): https://pubs.aip.org/books/chapter-pdf/12806783/9780735421141_001.pdf
- MoM-z14 (z = 14.44): https://en.wikipedia.org/wiki/MoM-z14 and https://www.livescience.com/space/astronomy/previously-unimaginable-james-webb-telescope-breaks-own-record-again-discovering-farthest-known-galaxy-in-the-universe
- I checked the other figures by running `cosmology.ts` unchanged in Node 22, and against standard references (PDG 2024 neutron lifetime of 878.4 s; Wien's law; Ryden's freeze-out treatment).
