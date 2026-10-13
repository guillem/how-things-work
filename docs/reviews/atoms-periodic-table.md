<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.88 in tokens + 13 web searches -->
# Review: atoms-periodic-table

## Verdict
The page is ready once the fixes below are made. The model is sound. The hydrogen wave functions, the Madelung order, the 90% radius for 1s, the table layout, and the configurations and ionization energies I spot-checked against NIST are all correct. There are two things to fix first. The most important is the data: for several heavy elements the electronegativity values differ from the CRC/Allred values the page says it uses (for example gold 2.4 instead of 2.54, tungsten 1.7 instead of 2.36, lutetium 1.0 instead of 1.27), so the trend map shows wrong colours under a wrong attribution. Second, the filling sweep's "last electron into …" readout is worked out from the block, so it states false things for Lu, Lr, Gd, Th, Cm and Zn/Cd/Hg. Smaller fixes: the nucleus-size claim is too large, "4s is lower in energy than 3d" is the oversimplified version, "full outer shell" for the noble gases contradicts the page's own shell sizes, and nothing explains the orbital boxes and arrows.

## Factual errors
- **Low** — `elements.ts` masses for Tc, Pm, Po–Ac, Np–Og, labelled at line 11 as "standard atomic weight (IUPAC)". These elements have no standard atomic weight; the numbers are isotope masses or mass numbers (e.g. Po "209.00" in the tile, "209 Da" in the card). **Fix:** set the field note to "standard atomic weight; for elements without one, the mass number of the longest-lived isotope". Display those in brackets (`[209]`) in `AtomScene.svelte:484` and `TableScene.svelte:314`.
- **Low** — `elements.ts:772` (Xe), `:520` (Kr), `:800` (Ba). Xe-124 decay has been observed directly (XENON1T, 2019), as has Kr-78, and there is geochemical evidence for Ba-130. Yet these are listed as stable, while Te-128/130, whose decay has a similar standing, are left out. **Fix:** remove 124 from Xe, 78 from Kr and 130 from Ba, or define the field as "observationally stable or primordial" and apply it consistently. Source: https://www.nature.com/articles/s41586-019-1124-4
- **Low** — `steps.ts:96` "Every atom has … protons and neutrons": hydrogen-1 has no neutron, and it is the first thing a reader gets by pressing "− neutron" on hydrogen. **Fix:** "a nucleus of protons (positive) and, in all but ordinary hydrogen, neutrons (no charge)".

## Model issues
- **Medium** — `AtomScene.svelte:68-77, 181-199` and `atom.ts:150-164`. The model accepts any build and labels it as if it were real. "Hydrogen, ion −50" is shown as an ordinary ion, but no free atom holds even two extra electrons (multiply charged atomic anions are not bound in the gas phase). Carbon with 0 or 40 neutrons is called "radioactive nucleus (it will decay)", but most such nuclei don't hold together at all and have never been observed. **Fix:** when `charge < -1`, show "an isolated atom can't hold this many extra electrons: they would fly off". Add the known isotope range per element (mendeleev's isotopes table) and, outside it, show "no such nucleus has ever been made: it would fall apart at once". Source: https://www.science.org/doi/10.1126/science.270.5239.1160
- **Low** — `e2e/atom-model.e2e.ts`. The tests don't check physical properties of the orbitals or the data against its source. **Fix:** add node checks (`density('2s', 2, 0, 0) ≈ 0`, `density('3p', 0, 0, 6) ≈ 0`, `density('3d', x, 0, z)` zero on the cone cos²θ = 1/3). Add spot checks of a few electronegativities and radii against the cited tables (see above), and a check that every subshell of the measured configuration is in `ORDER`.
- Everything else checks out. ψ for 1s/2s/2p_z/3p_z/3d_z², the sign functions, the rejection sampler, the 1s 90% radius (2.66 a₀), the Madelung order, the exception detection (20 exceptions for Z ≤ 103, matching "a score or so") and the table placement are all correct.

## Narrative and scene mismatches
- **Medium** — `steps.ts:134`, "coloured by which subshell each element's last electron goes into". The colouring is by block, and for Lu and Lr (coloured f), Th (no f electrons) and Zn/Cd/Hg (last electron into s) that sentence is false for what the reader sees. **Fix:** "coloured by block: the kind of subshell (s, p, d or f) that is filling across that stretch of the table."
- **Low** — `OrbitalScene.svelte:199`, "90% of the time inside here". The 90% is for the sphere. On screen, about 95% of the projected dots fall inside the circle, because dots in front of and behind the sphere also project inside it (I checked by Monte Carlo). **Fix:** "90% of the time inside this sphere".
- **Low** — the group-3 layout (`atom.ts:129-139`, `elements.ts` La/Lu/Ac/Lr). The page puts La/Ac in the d block and Lu/Lr in the f block. That clashes with the page's own electron-filling logic, since Lu (4f¹⁴ 5d¹) is the one filling 5d, and IUPAC's 2021 Group 3 provisional report leaned towards Sc-Y-Lu-Lr. This is a choice of convention, not an error. If you keep it, add a note: "Which elements belong under scandium and yttrium is still debated; IUPAC's Group 3 project leans towards lutetium and lawrencium." Source: https://chemrxiv.org/engage/api-gateway/chemrxiv/assets/orp/resource/item/644df4b36ee8e6b5ed547d1c/original/a-critique-of-the-provisional-report-of-the-iupac-group-3-project.pdf
- **Low** — `steps.ts:111`, "(predicted, for a few of the heaviest)". The card (`TableScene.svelte:313-317`) never marks which configurations are predicted (e.g. Ds, Rg, whose published predictions differ from the data), or which ionization energies are calculated (Rf–Hs). **Fix:** add a `predicted` flag for Z ≥ 104 and show "(predicted)" after those values.

## Catalogue requirements
- **Medium** — Interaction: "Build an atom … electrons fill orbitals in order and the element lights up". In the build step, added electrons only join a cloud; the filling happens in the next step on a separate `fillTo` slider that ignores the atom just built. **Fix:** set `fillTo` from the built atom's proton count on entering the shells step, and show a small shell-count line in the build readout (`shellCounts(protons)`, for a neutral atom).
- The rest is met:
  - Recolouring by radius, ionization energy and electronegativity works.
  - The 3D orbital view works.
  - The takeaway is drawn in the chemistry layer, with outer-electron counts.
  - The planetary-orbit pitfall is avoided, and explicitly countered.
  - Needs: the data is real, from mendeleev, apart from the electronegativity problem above.

## Clarity
- **Medium** — `steps.ts:108-110` against `AtomScene.svelte` (boxes, ↑↓ arrows, Hund's rule). The diagram's boxes and arrows are never explained, and "orbital" is only defined in the next step. **Fix:** add to the shells body: "In the diagram each box is one orbital, a place for two electrons, drawn ↑ and ↓ because their spins are opposite. Within a subshell, electrons spread out one per box before they pair up."
- **Low** — `steps.ts:111`: n and ℓ are used without being defined. **Fix:** 'The order follows the "n + ℓ" (Madelung) rule, where n is the shell number and ℓ is 0, 1, 2, 3 for s, p, d, f: subshells fill in order of n + ℓ, lower n first on a tie.'
- **Low** — `OrbitalScene.svelte:110`, the 2s line "with an empty shell between". The density is zero only on one thin spherical surface (r = 2 a₀), not in a thick empty layer. **Fix:** 'A sphere inside a sphere,' / 'with a surface of zero density between.'

## Sources consulted
- https://www.knowledgedoor.com/2/elements_handbook/pauling_electronegativity.html (Pauling/Allred values: Au 2.54, W 2.36, Pb 2.33/1.87, Lu 1.27)
- https://www.webelements.com/gold/electronegativity.html
- https://www.webelements.com/tungsten/electronegativity.html
- https://www.webelements.com/krypton/electronegativity.html
- https://en.wikipedia.org/wiki/Lutetium
- https://en.wikipedia.org/wiki/Atomic_nucleus (atom-to-nucleus size ratio about 26,600–60,250)
- http://ericscerri.blogspot.com/2012/06/trouble-with-using-aufbau-to-find.html (3d lies below 4s from Sc on)
- https://www.science.org/doi/10.1126/science.270.5239.1160 (gas-phase multiply charged anions)
- https://www.nature.com/articles/s41586-019-1124-4 (Xe-124 decay observed)
- https://chemrxiv.org/engage/api-gateway/chemrxiv/assets/orp/resource/item/644df4b36ee8e6b5ed547d1c/original/a-critique-of-the-provisional-report-of-the-iupac-group-3-project.pdf (IUPAC Group 3 provisional report)
- My own Monte Carlo check of the projected 1s dots: 90.0% fall inside the sphere, 95.0% inside the projected circle.
