<!-- batch msgbatch_01ByHp9mtCYJjYKNcyp3dSWD, claude-opus-5-5, submitted 2026-10-12T00:46:33.022Z, ~$0.84 in tokens + 14 web searches -->
# Review: chemical-bonds

## Verdict
The page is ready after the fixes below. I checked the facts against CCCBDB, the NIST WebBook, OpenStax and IUPAC. The electronegativities, ΔEN bands, the twelve measured bond angles, the Shannon radii, the 1916 Lewis date and the octet facts are all correct. I ran `relax()` with both its default and its scene parameters, and every count from 2 to 6 settles into the correct VSEPR geometry. The Cl₂O exception is also correct. No high-severity errors. The most important fix is the definition of the **hydrogen bond**. It leaves out the condition that the hydrogen must be bonded to N, O or F. The page's own charge map marks methane's hydrogens δ+, so by that definition methane would form hydrogen bonds, which undercuts the boiling-point argument in the last step. The next most important fix is carbon's four "unpaired" dots, which contradict the electron filling taught in the prerequisite page.

## Factual errors
- **medium**, steps.ts:200 (`hydrogen bonds` dfn). "An especially strong attraction between a δ+ hydrogen on one molecule and a lone pair on an N, O or F atom of another" lets *any* δ+ hydrogen qualify. On this page that includes methane's (MoleculeScene/PropertiesScene tint CH₄'s H atoms δ+ blue), and C–H…O hydrogen bonds are not what raises water's boiling point. IUPAC requires the H to be bonded to a more electronegative atom X. Fix: `data-def="An especially strong attraction between a hydrogen bonded to N, O or F on one molecule (strongly δ+) and a lone pair on an N, O or F atom of another."` Source: https://publications.iupac.org/pac/pdf/2011/pdf/8308x1637.pdf
- **medium**, scenes/RepelScene.svelte:126–127 and 261. The note "third-row atoms only: they can hold more than 8" is wrong: IF₅, XeF₄ and SbCl₅ have central atoms below the third row. It also contradicts steps.ts:132 ("from the third row down"). Fix: `note: 'atoms from the third row down'` for both entries.
- **low**, model.ts:521–530, PropertiesScene.svelte:120. Methane is stored as 111 K, the coarse "111 ± 2 K average" figure. The WebBook's own boiling-point table for methane lists 111.65 K (Pavese et al. 1976, TRC uncertainty 0.002 K) and 111.7 K. As a result the bar reads "111 K". Fix: `kelvin: 111.65` and update the comment. Note that JS `Math.round(111.65 − 273.15)` gives −161, so either show one decimal (`(b.kelvin − 273.15).toFixed(1)`) and change steps.ts:199 to "methane boils at −161.5 °C", or keep −162 and round half away from zero explicitly. Source: https://webbook.nist.gov/cgi/cbook.cgi?ID=C74828&Type=TBOIL
- **low**, model.ts:524–528. Ammonia is computed from the Stull Antoine fit for 164.0–239.6 K, but the answer (240.03 K) lies outside that range. The fit for the next range (239.6–371.5 K) gives 239.46 K, so the two fits bracket the accepted 239.82 K. The −33 °C on the page is right either way. Fix: `kelvin: 239.82` (normal boiling point, −33.3 °C), and say where it comes from, or note in the comment that the Antoine fit is extrapolated. Sources: https://webbook.nist.gov/cgi/cbook.cgi?ID=C7664417&Mask=4&Type=ANTOINE&Plot=on, https://www.engineeringtoolbox.com/ammonia-d_1413.html
- **low**, steps.ts:200. "lets each molecule cling to four neighbours": four is the maximum (as in ice), not what every molecule does. The scene says "up to four" (PropertiesScene:201). Fix: "lets each molecule cling to up to four neighbours".
- **low**, steps.ts:94. "methane, CH₄, natural gas". Fix: "methane, CH₄, the main ingredient of natural gas".

All other numbers check out: the Pauling values, NaCl ΔEN 2.23, HF 1.78, and the CCCBDB angles I spot-checked (NH₃ 106.67, NCl₃ 107.78, HOCl 102.45 r_e, CHCl₃ 110.92).

## Model issues
- **medium**, look.ts:35–36 (`bondLength`), MoleculeScene.svelte:217. Every bond is drawn as the sum of single-bond covalent radii, so C=O in CO₂ and N≡N come out as long as single bonds. That contradicts the note at steps.ts:108 ("Multiple bonds are shorter… than single bonds"). The mendeleev source already includes Pyykkö's double- and triple-bond radii. Fix: export `radius2`/`radius3` (Pyykkö double/triple) in the element extract, and use `bondLength(a, b, px, order)` with `order === 3 ? radius3 : order === 2 ? radius2 : radius`, passing `a.orders[d.ligand]` at line 217. Source: https://chemistry-europe.onlinelibrary.wiley.com/doi/10.1002/chem.200901472
- **low**, e2e/chemical-bonds-model.e2e.ts:131–138. The test runs `relax(n)` with default arguments, but the scene calls `relax(n, 61, 6, 0.02)` (RepelScene:49) and its comment claims it settles by the last frame. I ran both and both settle (scene version by frame 9–36), but no test protects that claim. Fix: add `expect(pairAngles(relax(n, 61, 6, 0.02).at(-1)!).map(a => Math.round(a*2)/2)).toEqual(...)` for n = 2…6.
- The polarity rule, VSEPR shapes, formulas, octet counting and geometry placement (including the HOCl and CH₂Cl₂ special cases) all behave correctly for every molecule the builder allows.

## Narrative and scene mismatches
- **low**, steps.ts:122 (control label) and RepelScene.svelte:244 (`${n} electron pairs`). The text defines the moving objects as electron *domains*, and the scene's legend says a domain can be a double or triple bond, which is more than one pair. Fix: label `'Electron domains around the atom'`, readout `` `${n} electron domains` ``.

Everything else the text describes matches the scenes: the quoted angles, the CO₂/CCl₄ cancellation, the boiling points and the δ labels.

## Catalogue requirements
The catalogue entry's requirements are met: atoms snap into place, lone and shared pairs set a 3D shape you can rotate, the shapes come from a real repulsion calculation, the charge-map toggle works, and the Takeaway can be seen on the stage.

## Clarity
- **medium**, steps.ts:28–30, DotsScene.svelte:37 and 173. Carbon is drawn with four single dots labelled "unpaired electron". The prerequisite page (atoms-periodic-table) fills orbitals, so readers will have seen carbon as 2s²2p², with only two unpaired electrons. Fix: add to the `outer` notes: "Carbon is drawn with four single dots because it makes four bonds. In the lone atom two of them are paired (2s²); when carbon bonds, its four outer electrons rearrange so that all four can pair up with partners (in later courses: hybridisation)."
- **low**, steps.ts:81–82. The text implies the transfer itself satisfies both atoms, which feeds the misconception that Na "wants" to lose its electron. In fact pulling the electron off sodium costs more energy than chlorine releases by taking it. The bond is stable because of the attraction between the ions in the crystal. Fix: add after "Opposite charges attract.": "Moving the electron on its own actually costs energy; it is the strong attraction between the ions, packed into a crystal, that more than repays it." Source: https://openstax.org/books/chemistry-2e/pages/7-2-covalent-bonding (and the following sections of OpenStax chapter 7 on the energy of ionic bonds).

## Sources consulted
- NIST CCCBDB experimental angles: https://cccbdb.nist.gov/expangle2x.asp?descript=aHNH&all=0, https://cccbdb.nist.gov/expangle2x.asp?descript=aClNCl&all=0, https://cccbdb.nist.gov/expangle2x.asp?descript=aHOCl&all=0, https://cccbdb.nist.gov/exp2x.asp?casno=67663&charge=0
- NIST WebBook, methane boiling point: https://webbook.nist.gov/cgi/cbook.cgi?ID=C74828&Type=TBOIL
- NIST WebBook, ammonia Antoine parameters: https://webbook.nist.gov/cgi/cbook.cgi?ID=C7664417&Mask=4&Type=ANTOINE&Plot=on
- Ammonia normal boiling point 239.82 K: https://www.engineeringtoolbox.com/ammonia-d_1413.html
- OpenStax Chemistry 2e §7.2 (Figure 7.8, "general guide… many exceptions"): https://openstax.org/books/chemistry-2e/pages/7-2-covalent-bonding
- IUPAC 2011 definition of the hydrogen bond: https://publications.iupac.org/pac/pdf/2011/pdf/8308x1637.pdf
- Pyykkö & Atsumi 2009, double-bond covalent radii: https://chemistry-europe.onlinelibrary.wiley.com/doi/10.1002/chem.200901472
- I ran `relax()` (ported line by line) with the default and the RepelScene parameters for n = 2…6, and evaluated the Antoine equations for ammonia.
