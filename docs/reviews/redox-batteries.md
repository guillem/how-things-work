<!-- batch msgbatch_01UFq4Tn9dsF5RBKF83nYjzz, claude-opus-5-5, submitted 2026-10-14T18:25:38.305Z, ~$0.82 in tokens + 11 web searches -->
# Review: redox-batteries

## Verdict
The page is ready after the fixes below. The constants, standard potentials, Nernst and Faraday arithmetic, the LG M50 figures and the published OCP fits all check out. I recomputed every number the narrative quotes, and each one matches the model. There are two real problems. First, the page uses "uphill" for the spontaneous electron flow (ladder step) and again for the forced flow (charge and summary steps). That contradiction undermines the takeaway. Second, the rundown step and scene say the voltage "collapses" at stops where it is still about 1.0 V. Also worth fixing: the Materials panel shows "empty" voltages that real cells never reach (for example 1.66 V for LiFePO₄/graphite).

## Factual errors
- **medium**, steps.ts:199 ("A flat battery is a reaction that has reached equilibrium… practically every copper ion is gone"). This understates the case and conflicts with step `curve`, which calls the cell empty at 2.5 V. With K = 10^37.3, equilibrium leaves [Cu²⁺] ≈ 10⁻³⁷ mol/L. In 100 mL that is about 6 × 10⁻¹⁵ ions, far less than one. Fix: "A cell that is completely dead has reached <a …>equilibrium</a>: E = 0, no push left. For this cell that means Q = K = 10³⁷, or [Cu²⁺] ≈ 10⁻³⁷ mol/L, which is less than one ion in the whole beaker. Real batteries are called empty well before that, at a cut-off voltage (2.5 V for the lithium-ion cell later on), and a lamp goes out once copper ions can no longer reach the electrode fast enough."
- **low**, steps.ts:211 and CellScene.svelte:411 ("The whole stack is a fifth of a millimetre"). Chen et al. give 75.6 µm and 85.2 µm as *single-sided* coating thicknesses. In the real roll, each foil is coated on both sides, so the repeating unit is about 0.37 mm. Fix (body): "This slice, one layer of each, is a fifth of a millimetre thick. In the real cell each foil is coated on both sides, and the long sheets are rolled up tightly inside the can." Fix (label): `text="one layer of each: 0.2 mm, drawn to scale; rolled up inside a 21 mm × 70 mm can"`. Source: https://iopscience.iop.org/article/10.1149/1945-7111/ab9050
- **low**, steps.ts:172 ("2 × 96 485 C/mol × 1.10 V = 213 kJ"). With 1.10 V the product is 212.3 kJ; 213 kJ needs E° = 1.1037 V. Fix: "× 1.104 V = 213 kJ".
- **low**, steps.ts:276 ("the first commercial cathode (Sony, 1991)"). Rechargeable lithium-metal cells with other cathodes were sold earlier. LiCoO₂ was the cathode of the first commercial *lithium-ion* cell. Fix: "the cathode of the first commercial lithium-ion cell (Sony, 1991)". Source: https://en.wikipedia.org/wiki/History_of_the_lithium-ion_battery

Everything else checks out:
- The standard potentials match the LibreTexts/Bard values (Mg −2.356, Al −1.676, Au 1.52, etc.).
- F, RT/F and 59.16 mV are correct.
- 1.015 V, Q = 3, log K = 37.3, 5.36 Ah, 6 Wh, 0.187 mol, 1.30 g and 270 Wh/kg are all correct. 267 Wh/kg is the published figure for the LG M50.
- 372, 274, 3579 and 3862 mAh/g are correct.
- The ~280 % volume swell of silicon is correct.

## Model issues
- **medium**, model.ts:201–202 and MaterialsScene.svelte:168–174 (vEmpty/vFull readout). Each material's lithium window is fixed on its own, and the graphite window comes from the LG M50's own balancing. Paired with other cathodes, both electrodes reach the steep ends of their windows at the same moment, which gives unrealistic end voltages:

  | Pair | Empty → full (model) |
  |---|---|
  | LFP/graphite | 1.66 V → 3.43 V |
  | LCO/graphite | 2.65 V → 4.14 V |
  | NMC/silicon | 2.75 V → 4.19 V |

  Real LFP cells stop at about 2.0–2.5 V. The mean voltages are barely affected. Fix: show the 10 %–90 % range instead:
  ```svelte
  >{fmtV(cellVoltage(cathode, anode, 0.1), 2)} at 10 % → {fmtV(cellVoltage(cathode, anode, 0.9), 2)} at 90 %</text>
  ```
  (import `cellVoltage`), and update the readout `value` to match. If you keep the end values, add to the `voltage` notes: "Only NMC 811 and graphite were measured in the same cell. In the other pairings the very ends of the curves are not what a real cell reaches: real cells are cut off sooner, an LFP cell at about 2.5 V." Also add a test that LFP/graphite at 10 % is above 2.5 V, so this cannot regress.
- **low**, e2e/redox-batteries-model.e2e.ts:151 and :49. The comment says a whole cell gets "about half", but the page says two-thirds (270 / 423 = 0.64). The comment "magnesium against silver: 3.16 V" has no assertion behind it. Fix: change the comment to "about two-thirds" and add `expect(pairing('mg','ag').voltage).toBeCloseTo(3.156, 3);`.

Apart from these, the model is sound. The Nernst/Faraday rundown conserves ions correctly ([Zn²⁺] = 1 + u, [Cu²⁺] = 1 − u). The OCP fits reproduce 2.50 V and 4.19 V for the M50. Every fit stays finite and monotonic inside its window.

## Narrative and scene mismatches
- **medium**, steps.ts:198 and DaniellScene.svelte:190–192. The text says "as the last copper ions run out… the voltage falls off a cliff", and the status reads "the voltage collapses" for anything above 99 %. The model actually gives 1.036 V at 99 %, 1.006 V at 99.9 % and 0.976 V at 99.99 %, then 0 V only at exactly 100 %. Fix (body): "Then the copper ions run out. Even at 99.99 % used the voltage is still 0.98 V, because each tenfold drop in copper costs only 0.03 V. It reaches zero only when the copper is down to about 10⁻³⁷ mol/L, which on this plot is the vertical cliff at 5.36 Ah." Fix (status):
  ```ts
  : usedPct > 99 ? 'nearly out of Cu²⁺: −0.03 V per tenfold drop' : 'running';
  ```
- **medium**, steps.ts:258 ("around 3.7 V for most of the way"). The plotted NMC/graphite curve slopes steadily: 3.26 V at 10 %, 3.71 V at 50 %, 4.09 V at 90 %. There is no plateau. Fix: "4.2 V when full, falling steadily through about 3.7 V at half charge (its average), then down to 2.5 V…".
- **low**, steps.ts:246 ("watch the arrows"). CellScene draws no arrows, only moving particles. Fix: "watch the ions and electrons reverse".
- **low**, steps.ts rundown step (no note). A lamp is drawn drawing current, but the readout is the open-circuit voltage, and model.ts says this simplification is "stated on the page". The page only states it for the lithium-ion cell. Fix: add to the rundown `notes`: "The voltages shown are open-circuit values; with the lamp drawing current, a real cell reads a little lower."

## Catalogue requirements
- These all check out. The cross-section is charged and discharged with Li⁺ crossing the separator while electrons go through a lamp or charger. Electrode swaps change the voltage and capacity. The takeaway is visible from the Daniell switch and the summary labels. Both prerequisites are linked. I could not verify that the step anchors (`#ionic`, `#drift`, `#voltage`, `#current`, `#equilibrium`, `#ph`) exist.

## Clarity
- **medium**, steps.ts:169 and LadderScene.svelte:207 versus steps.ts:238 and :309. The ladder step calls the *spontaneous* flow "uphill" ("Electrons run uphill on this ladder", label "electrons climb"). The charge step ("Charging pushes them back uphill") and the summary use "uphill" for the *forced* direction. A reader cannot hold both. Fix (ladder body): "Electrons go <strong>up this ladder</strong>, to the ions that pull harder. For an electron that is downhill in energy, which is why it happens by itself: the metal lower down is oxidised…". Fix (label): `text="electrons go to the stronger pull"`. Keep "uphill" for charging.
- **medium**, steps.ts:172 (water band note). The note says water is split beyond the band, yet zinc (−0.76 V), and every metal shown except Cu, Ag and Au, sits below it, and the Daniell cell uses zinc in water. Fix: append "Zinc sits below the band too but gets away with it: hydrogen forms only slowly on zinc, and the near-neutral solutions shift the band a little lower. Lithium has no such luck." Source: https://chemistry-europe.onlinelibrary.wiley.com/doi/10.1002/batt.202100394

## Sources consulted
- LibreTexts, P1: Standard Reduction Potentials by Element: https://chem.libretexts.org/Ancillary_Materials/Reference/Reference_Tables/Electrochemistry_Tables/P1:_Standard_Reduction_Potentials_by_Element
- LibreTexts (Harvey), 7.13 Standard Reduction Potentials (Al −1.676, Au³⁺ 1.52): https://chem.libretexts.org/Bookshelves/Analytical_Chemistry/Analytical_Chemistry_Volume_II_(Harvey)/07:_Appendix/7.13:_Standard_Reduction_Potentials
- Lumen appendix (Bard et al.; Mg −2.356): https://courses.lumenlearning.com/suny-introductory-chemistry/back-matter/appendix-standard-reduction-potentials-by-value/
- Chen et al., J. Electrochem. Soc. 167, 080534 (2020), layer thicknesses (single-sided): https://iopscience.iop.org/article/10.1149/1945-7111/ab9050
- O'Regan et al., LG M50 thermal-electrochemical parameters (267 Wh/kg): https://chemrxiv.org/doi/pdf/10.26434/chemrxiv-2022-d2q4n
- LG INR21700-M50 specifications (18.2 Wh, ~68 g): https://www.dnkpower.com/lg-inr21700-m50lt/
- Hydrogen overpotential on zinc in aqueous electrolytes: https://chemistry-europe.onlinelibrary.wiley.com/doi/10.1002/batt.202100394
- History of the lithium-ion battery: https://en.wikipedia.org/wiki/History_of_the_lithium-ion_battery
- I recomputed all the model figures (Nernst, K, Faraday capacities, OCP curves, mean voltages and Wh/kg for all nine pairings) independently in Python.
