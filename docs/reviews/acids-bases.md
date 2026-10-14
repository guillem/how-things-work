<!-- batch msgbatch_01EjzxvBTpHfuetSeN7qT1HL, claude-opus-5-5, submitted 2026-10-14T08:30:20.979Z, ~$0.68 in tokens + 9 web searches -->
# Review: acids-bases

## Verdict
The page is ready after the fixes below. The chemistry engine is solid: it solves the charge balance exactly. I recomputed every titration pH the narrative quotes (1.00, 1.48, 4.0, 7.00, 10.0, 2.88, 4.76, 8.73, 10.05) and all of them match. The indicator constants match the cited Imperial College table exactly. The food, blood and seawater values match their sources. The catalogue's pitfall is clearly avoided: the "equivalence" step shows pH 8.73 for acetic acid against HCl's 7.00. The most important fix is in the `jump` step. The text says that at 24.95 mL "one part in a thousand of the acid is left", but the true figure is one part in 500, and the page's own readout shows "acid left: 0.20 %". After that, the clean-rain value should be computed as an open system (water in contact with the air).

## Factual errors
- **high** — steps.ts:234. "At 24.95 mL only one part in a thousand of the acid is left" is wrong. The 0.05 mL short of 25.00 mL is 0.05/25 = 1/500, which is 0.2 %. The status readout (TitrationScene.svelte:215–221) shows "acid left: 0.20 %" at that moment. Fix: "At 24.95 mL only one part in 500 of the acid is left and the pH is 4.0."
- **medium** — steps.ts:165. "Real pH meters measure activity, which is why a strong acid can read slightly below 0 or a strong base above 14" gives the wrong cause. The pH scale is open-ended even when defined by concentration: any solution with more than 1 mol/L of H⁺ has a negative pH. For example, 37 % HCl is about −1.1 and saturated NaOH is about 15. Together with line 163 ("squeezes … into the numbers 0 to 14"), a reader will conclude that pH is confined to 0–14 by definition. Fix: "…which in concentrated solutions differs from the real one. The scale is not fenced at 0 and 14: any solution with more than 1 mol/L of H⁺ has a negative pH (concentrated hydrochloric acid is about −1), and very strong bases go above 14." Source: K. F. Lim, "Negative pH Does Exist", J. Chem. Educ. 83, 1465 (2006), https://www.researchgate.net/publication/231267213_Negative_pH_Does_Exist
- **medium** — steps.ts:255. "The eye sees a change once about a tenth of the dye has switched, which is why each range spans about two pH units" does not fit the page's own ranges. They span 1.2 units (methyl orange, 3.2–4.4), 1.6 (bromothymol blue) and 1.8 (phenolphthalein). In the model, methyl orange is already 24 % switched at 3.2 and 83 % at 4.4, not 10 % and 90 %. Fix: "The eye only notices the change once a fair share of the dye has switched, roughly within one pH unit either side of pKIn, which is why each range spans one to two pH units." Sources: https://www.chemguide.co.uk/physical/acidbaseeqia/indicators.html and https://www.ch.ic.ac.uk/rzepa/aptonge/mdl/indi/indicator.html
- **low** — steps.ts:190. "about 0.1 lower than before the industrial revolution" is fine. Jiang et al. give a fall of about 0.11 ± 0.03 from 1770 to 2000, and a global average of 8.07 ± 0.02 (https://www.nature.com/articles/s41598-019-55039-4). This is listed only to confirm it; no change needed.

## Model issues
- **medium** — liquids.ts:61 (and the comment at lines 16–21). Clean rain is modelled as a closed system. The code fixes the total of CO₂(aq) + HCO₃⁻ + CO₃²⁻ at K_H·pCO₂. But "in equilibrium with 420 ppm" means the air fixes the dissolved CO₂ (H₂CO₃*) itself, and the bicarbonate comes on top of it. As a result the page computes and displays 5.64 instead of 5.60. With the page's own constants the textbook open-system result is 5.597, and I checked this by running the model. Fix:
  ```ts
  import { fractions, solvePH } from './model';
  // Open system: the air fixes dissolved CO₂ (H₂CO₃*); bicarbonate comes on top.
  const co2aq = HENRY_CO2 * CO2_PPM * 1e-6;
  let rain = 5.6;
  for (let k = 0; k < 20; k++) {
  	const c = co2aq / fractions(CARBONIC, 10 ** -rain)[0];
  	rain = solvePH({ systems: [{ c, z: 0, pKa: CARBONIC }] });
  }
  ```
  This converges to 5.597 within 3 iterations. Also tighten the test at e2e/acids-bases-model.e2e.ts:113 to `toBeCloseTo(5.60, 2)`; the current tolerance of ±0.05 passes the wrong value. Sources: https://faculty.uml.edu/nelson_eby/89.315/Lecture%20pdfs/Chapter%203.pdf and https://www.aqion.de/site/open-co2-system
- **low** — e2e/acids-bases-model.e2e.ts. Several numbers the narrative quotes are not tested. Add `expect(titrationPH(standard(ACIDS.hocl), 25)).toBeCloseTo(10.05, 2)` and `expect(titrationPH(weak, 25)).toBeCloseTo(8.73, 2)`. Also add an assertion that the volume where acetic acid with methyl orange reaches pH 3.7 is about 2 mL (the model gives 2.0 mL).
- The core solver (charge balance, protons lost, monotonic bisection), the constants and the indicator mixing are otherwise correct.

## Narrative and scene mismatches
- **medium** — DissociateScene.svelte:63–69. The drawing shows fewer split molecules than the readout states. There are two reasons. (1) Each slot's molecule is fully re-formed for about 15 % of every cycle (the fade-in and fade-out are not overlapped), so on average only about 0.85 × nSplit H⁺ ions are visible. (2) Slots pick molecule indices independently, so two slots can land on the same molecule. At 0.001 mol/L this hides about 1.5 molecules on average, out of the 25 stated. The text promises that "the share stays the same". Fix: make the slots use disjoint molecules, and cross-fade so that each slot always shows exactly one split molecule:
  ```ts
  const group = Math.floor(N / Math.max(1, nSplit));
  const pick = (j: number, life: number) =>
  	j + nSplit * Math.floor(rng(7000 + j * 131 + life * 7919)() * group);
  for (let j = 0; j < nSplit; j++) {
  	const off = (j * 0.618034) % 1;
  	const life = Math.floor(t / LIFE + off);
  	const u = reduced ? 0.5 : cycle(t, LIFE, -off * LIFE);
  	const out = smoothstep(0.85, 1, u);
  	const a = pick(j, life), b = pick(j, life + 1);
  	s[a] = Math.max(s[a], 1 - out);
  	s[b] = Math.max(s[b], out);
  }
  ```
- **low** — steps.ts:306. "it turns pink at the drop that reaches 25 mL" is slightly off. At 25.00 mL the pH is 8.73, so only 18 % of the phenolphthalein has switched. The drawn tint has an opacity of about 0.05, and the readout says "colour changed at 25.01 mL". The clear pink appears at the next drop (25.05 mL, pH 10.0). Fix: "and it turns pink within a drop of 25 mL."
- Every other quoted number matches the model and the readouts: 60 / 600 / 6 000 ions, 33 billion water molecules, 1 in 550 million, 60 000 OH⁻ and 0.06 H⁺ at pH 10, 60 trillion per litre, ×50 000 for lemon, 1 in 75 (1.3 %), 2 mL and about 8 mL for methyl orange, and 3.5–10.5 for the steep part of the HCl curve.

## Catalogue requirements
All met. The drop-by-drop titration has a live curve and indicator colour. Strong and weak acids are compared. The zoomed cube counts the ions. The 0–14 scale uses sourced or computed liquids. The takeaway (tenfold steps, and the jump at the volume where the base matches the acid) can be seen in the ladder, the ×10 arcs and the last-drops panel. The pitfall is avoided: equivalence pH is shown as 8.73 or 10.05 for the weak acids, against 7.00 for HCl.

## Clarity
- **medium** — IonsScene.svelte:313 against steps.ts:162. In the same step, the text says "Every step **down** the scale means ten times more hydrogen ions" (meaning toward lower pH). The ladder, which has pH 0 at the top, is labelled "each step **up**: ×10 H⁺". The slider help (steps.ts:14) says "Drag down for more acidic", which is ambiguous for a horizontal slider. Fix: label the ladder "each step toward pH 0: ×10 H⁺". Change the text to "Every step down in pH means ten times more hydrogen ions". Change the help to "Lower values are more acidic, higher values more basic."
- **low** — steps.ts:163. "10⁻³ moles of H⁺ per litre" uses "mole" before it is explained; the only definition is in a control on a later step (line 40). For level 1, add the definition at first use: `<dfn data-def="A fixed, very large count of particles: 6.02 × 10²³.">moles</dfn>`.
- **low** — steps.ts:305. "would think the vinegar held…": the flask holds 0.1 mol/L acetic acid, not vinegar (which is nearer 0.8 mol/L). Fix: "would think the sample held less than a tenth of the acid it really does."

## Sources consulted
- W. Locke, Imperial College, "Acid–Base Indicators and Titrations" (indicator constants match the page exactly): https://www.ch.ic.ac.uk/rzepa/aptonge/mdl/indi/indicator.html
- Chemguide, acid–base indicators (change about ±1 pH unit around pK_ind): https://www.chemguide.co.uk/physical/acidbaseeqia/indicators.html
- Jiang et al., Sci. Rep. 9, 18624 (2019): https://www.nature.com/articles/s41598-019-55039-4 and https://www.researchgate.net/publication/337834703_Surface_ocean_pH_and_buffer_capacity_past_present_and_future
- FDA "Approximate pH of Foods and Food Products" (copy): https://www.healthycanning.com/wp-content/uploads/pH-FDAapproximatepHoffoodslacf-phs.pdf
- K. F. Lim, "Negative pH Does Exist", J. Chem. Educ. (2006): https://www.researchgate.net/publication/231267213_Negative_pH_Does_Exist
- Open-system rainwater pH: https://faculty.uml.edu/nelson_eby/89.315/Lecture%20pdfs/Chapter%203.pdf and https://www.aqion.de/site/open-co2-system
- My own runs of model.ts in Node (all the pH values above, the open- and closed-system rain values, and the dissociation shares).
