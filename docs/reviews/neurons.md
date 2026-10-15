<!-- batch msgbatch_01V11kK5poeu5jttEoCVCLwM, claude-opus-5-5, submitted 2026-10-15T04:42:10.085Z, ~$1.09 in tokens + 9 web searches -->
# Review: neurons

## Verdict
The page is ready after the fixes below. I re-ran the Hodgkin–Huxley membrane and cable model myself, and almost every number the narrative quotes matches it:
- threshold 13.3 µA/cm²
- spike peak +45 mV, back near rest after about 3.3 ms
- refractory cut-off 12.5 ms
- repetitive firing starts at 6.3 µA/cm², about 52/s, rising to about 99/s at 30 µA/cm²
- conduction speed 18.4 m/s
- EPSP 1.9 mV
- the summation and circuit truth tables

The ion figures also check out (−89/+47/−55 mV, GHK −59.7/+38 mV, one in 4 million ions, length constant 7 mm). **The one fix that matters most is the TEA toggle.** Blocking all of HH's potassium conductance also removes the potassium current that holds the cell at rest. In the current model the membrane then fires *on its own* at 2.4 ms, before the pulse arrives, and stays stuck near +4 mV for good. So the scene shows a spontaneous spike that never ends, not a spike that is "prolonged".

## Factual errors
- **Medium**, steps.ts:391 vs steps.ts:405. The two steps contradict each other. The synapse step says, as a fact about real cells, "One synapse alone moves the next cell's voltage by only a millivolt or two". The note on the adding step says "In real cortical neurons a single synapse gives well under 1 mV". Measured unitary EPSPs are usually a fraction of a millivolt; for example, CA3→CA1 pairs range from 30 to 665 µV, mean 131 µV. Fix for line 391: "In this model one synapse moves the next cell's voltage by about 2 mV; in real brain neurons it is usually well under 1 mV. Either way it is far below threshold." Source: https://pubmed.ncbi.nlm.nih.gov/2319304/
- **Low**, steps.ts:269. "Hodgkin and Katz worked out the formula in 1949" leaves out Goldman, whose name the equation carries. Goldman derived the constant-field equation in 1943 (J. Gen. Physiol. 27:37); Hodgkin and Katz extended it to the membrane voltage with several ions. Fix: "Building on Goldman's 1943 theory, Hodgkin and Katz worked out the formula in 1949, the Goldman–Hodgkin–Katz equation." Source: https://rupress.org/jgp/article/149/10/911/43579/The-enduring-legacy-of-the-constant-field-equation
- **Low** (low confidence), steps.ts:272, "close to the 88 mV they measured". I could not confirm the 88 mV figure in the reprint. The paper's introduction gives a resting potential of about −50 mV and an action potential "of the order of 100 mV". Check the figure against Hodgkin & Katz's table, or write "close to the roughly 90–100 mV they recorded". Source: https://static.physoc.org/app/uploads/2019/04/12150238/H-K1.pdf
- **Low**, steps.ts:346, "at much stronger currents the model stops firing altogether, which is why the slider stops at 30". In the model, firing continues to at least 70 µA/cm² (131/s) and stops only between 70 and 80 µA/cm². So the block does not explain a slider that ends at 30. Fix: "at much stronger currents (above about 75 µA/cm² here) the model stops firing altogether: the voltage stays raised and the sodium channels stay inactivated."
- **Low**, steps.ts:417. "are what memory is made of" states a leading hypothesis as settled fact. Fix: "are thought to be what memory is made of."

## Model issues
- **High**, hh.ts:107–117, together with SpikeScene.svelte:55 (`k: tea ? 0 : 1`). Setting the K⁺ block to 0 also removes the resting K⁺ conductance (36·n∞⁴ ≈ 0.37 mS/cm²). That conductance carried 4.4 µA/cm² of outward current at rest. Without it, my re-run gives:
  - V drifts from −60 to −47 mV by 1.9 ms;
  - the cell fires at 2.4 ms with no pulse at all;
  - it then settles permanently at +4.4 mV.

  Simply keeping the resting part is not enough at a 100% block: the sodium window current then holds the cell near −8 mV. Two-part fix:
  1. Model TEA as blocking only the voltage-gated rise of the conductance:
     ```ts
     const kb = block.k ?? 1;
     const gK = HH.gK * (kb * g.n ** 4 + (1 - kb) * RESTING.n ** 4);
     ```
  2. Use a partial block, as real TEA gives: `k: tea ? 0.1 : 1`.

  With this, the spike spends 3.65 ms above −20 mV (normal 1.8 ms), returns to −60 mV, and nothing fires before the pulse. Then:
  - Change steps.ts:317 to: "Block most of the potassium channels instead and the spike still fires but ends much more slowly: it lasts about twice as long."
  - In e2e/neurons-model.e2e.ts, add checks that V is still within 0.5 mV of REST just before the pulse and at t = 40 ms. With `k: 0.1` the width ratio is only 2.03, which barely passes the current "> 2×" test, so relax that test to "> 1.8×".
- **Low**, same mechanism with TTX (`na: 0`). Removing the resting Na⁺ current makes V sag to −61.2 mV before the pulse. This is harmless but visible. Either start TTX runs from the blocked steady state, or move the lost resting current into the leak term.
- **Low**, fibres.ts / MyelinScene. Hursh's d is the *outer* fibre diameter, myelin included. The "bare" lane uses the same d as the axon diameter, although the axon inside a 10 µm fibre is about 6–7 µm (g-ratio about 0.6–0.7). This slightly flatters the bare fibre. Add to the steps.ts:373 note: "(the bare fibre is given the full outer diameter, which slightly flatters it)".
- Otherwise the model is faithful. The rate functions, the vtrap limit, ENa/EK/EL in the new sign convention, φ = 3^((T−6.3)/10), the squid axon constants and the cable discretisation are all correct. The explicit-Euler step (0.0025 ms) is inside its stability limit, about 0.0035 ms. The speed changes by 1.3% when the grid is halved.

## Narrative and scene mismatches
- **Medium**, steps.ts:415–417 vs inputs.ts. "Strengthen the connection from 3 to A and A starts to answer the pattern 1 + 3 as well" leaves out two things the model does:
  - With a single synapse (w3a = 1), A already fires for 1+3 **and for 2+3**.
  - With 3 or 4 synapses, **input 3 alone** fires A, so A no longer detects a pattern at all.

  Fix: "Give the connection from 3 to A even one synapse and A starts to answer 1 + 3 (and 2 + 3) as well: it has learned. Give it three or more and input 3 alone fires A: strengthen too much and the cell stops detecting a pattern at all."
- **Low**, steps.ts:317, "the strongest pulse gives no spike at all". The channels step has no pulse slider; the pulse is fixed at twice the threshold. Fix: "and the same pulse gives no spike at all; neither would a far stronger one."
- **Low**, SpikeScene.svelte:268. The text `${spikes.length} spike, then silence` reads "2 spike, then silence". Between 6 and 6.2 µA/cm² the scene gives 2–3 spikes. Fix: `` `${spikes.length} spike${spikes.length === 1 ? '' : 's'}, then silence` ``. Also change steps.ts:344 "A weak current gives one spike and then nothing" to "one or a few spikes and then nothing".

## Catalogue requirements
All requirements are met:
- The interaction is built as written: current injection with channels opening, the voltage spike, propagation along the cable, myelin, neurotransmitter release, and E/I summation.
- The takeaway can be seen without the text: the all-or-nothing spike in the threshold step, pattern detection by wiring in the circuit step.
- The myelin speeds rest on documented measured data (Hursh 1939) rather than a nodal model, and the page says so.

## Clarity
- **Medium**, MyelinScene.svelte:35–37. With myelin off, the close-up still plays at 36,000× slow motion. One pass then takes about 60 s at 10 µm, and between 26 s (2 µm) and 83 s (20 µm) across the slider range. The reader sees an almost frozen front. Use a separate slow-down factor for the bare fibre, and print it in the subtitle: for example `SLOW = myelin ? 36000 : 3000`, with the label "slowed down {SLOW} times".
- **Low**, steps.ts:300. "Each depolarisation opens…" is the first use of "depolarisation" and it is not explained. Wrap it as `<dfn data-def="A rise of the inside voltage towards zero or above, making it less negative.">depolarisation</dfn>`.
- **Low**, steps.ts:332, "on the next page of the story". This is the next chapter of the same page. Fix: "in the next chapter".

## Sources consulted
- Hodgkin & Katz 1949 (Physiological Society reprint): https://static.physoc.org/app/uploads/2019/04/12150238/H-K1.pdf
- HH computed 18.8 m/s vs 21.2 m/s measured at 18.5 °C (Huxley obituary, J Physiol): https://pubmed.ncbi.nlm.nih.gov/22855053/
- Propagated action potential took about three weeks to compute by hand: https://www.sas.upenn.edu/LabManuals/BBB251/NIA/NEUROLAB/APPENDIX/EQUAT.HH/CALCULAT.HTM
- Goldman 1943 constant-field equation: https://rupress.org/jgp/article/149/10/911/43579/The-enduring-legacy-of-the-constant-field-equation
- Katz & Miledi 1965, synaptic delay at the frog neuromuscular junction: https://royalsocietypublishing.org/doi/abs/10.1098/rspb.1965.0016
- Unitary CA3→CA1 EPSP amplitudes (mean 131 µV): https://pubmed.ncbi.nlm.nih.gov/2319304/
- Numerical checks: an independent Python port of hh.ts, ions.ts and inputs.ts (RK4 for the membrane patch, method of lines for the cable), run with the page's parameters.
