<!-- batch msgbatch_01XuwfDGdxyMhDDG3Le4gzHm, claude-opus-5-5, submitted 2026-10-14T13:43:56.836Z, ~$0.93 in tokens + 15 web searches -->
# Review: respiration-atp

## Verdict
The page is ready after the fixes below. The biochemistry is correct almost everywhere: stoichiometry, midpoint potentials, proton counts, P/O ratios and the c₈ ring. I ported the kinetic model and ran it. It behaves as the text says: working Δp ≈ 194 mV, P/O ≈ 2.58, cytochrome c fills before ubiquinone and NADH without O₂ (90 % reduced at 0.54 s, 0.62 s and 1.8 s on screen), the block cuts O₂ use to ~2 %, and the uncoupler raises it to 1.9×. The most important fix is the **summary step's ATP sum**. It leaves out the 2 GTP and gives all 10 NADH to the citric acid cycle, so its own numbers add to 28–30, not the 32 it quotes. The text also has two factual slips (antimycin A's origin, how carbon monoxide kills) and the old "sprinting muscle runs out of oxygen" picture of lactate.

## Factual errors
- **Medium**, steps.ts:135 (complex3 notes): "Antimycin A, a fungal poison" is wrong. Antimycin A is an antibiotic made by *Streptomyces* bacteria. Fix: "Antimycin A, an antibiotic made by *Streptomyces* bacteria, blocks complex III; rotenone, a plant insecticide, blocks complex I." Source: https://www.sigmaaldrich.com/US/en/product/sigma/a8674
- **Medium**, steps.ts:150 (oxygen notes): "Cyanide and carbon monoxide kill by binding to complex IV's iron–copper centre" is misleading for CO. CO's main toxic action is binding haemoglobin; blocking complex IV is a secondary effect. Fix: "Cyanide kills by binding to complex IV's iron–copper centre, which has the same effect as taking the oxygen away. Carbon monoxide binds there too, though most of its harm comes from blocking haemoglobin." Sources: https://link.springer.com/chapter/10.1007/978-1-4684-5643-1_84, https://journals.physiology.org/doi/full/10.1152/ajpcell.00022.2021
- **Medium**, steps.ts:263 (fermentation body): "When a sprinting muscle runs short of oxygen, the chain backs up as you saw…" repeats a well-known misconception. Muscle makes lactate mainly because glycolysis runs faster than mitochondria (and the NADH shuttles) can keep up, even when oxygen is adequate. Fix: "When a sprinting muscle makes pyruvate and NADH faster than its mitochondria can take them, or when oxygen runs short and the chain backs up as you saw, NADH piles up in the cytosol and the cell runs out of NAD⁺." Sources: https://journals.biologists.com/jeb/article/208/24/4561/15901/Lactate-a-signal-coordinating-cell-and-systemic, https://journals.physiology.org/doi/full/10.1152/ajpregu.00114.2004
- **Low**, steps.ts:190 (gradient notes): Porcelli et al. measured an intermembrane-space pH of 6.88 ± 0.09; 7.2 is nearer the cytosol. Fix: "the intermembrane space about 6.9". Source: https://pubmed.ncbi.nlm.nih.gov/15607740/
- **Low**, steps.ts:186 (gradient body and the proton-motive-force definition): the ranges are a little narrow. Measured Δp is 180–220 mV, with Δψ 150–180 mV and ΔpH 0.5–1.2 units (0.9 units is already 55 mV). Fix: body "about 180–220 mV"; definition "the pH difference (≈ 0.5–1 unit, ≈ 30–60 mV)". Source: https://rupress.org/jgp/article/139/6/415/43083/
- **Low**, steps.ts:123 (complex1 notes): "Its structure, with that of complexes III and IV, has been solved by cryo-electron microscopy" suggests cryo-EM solved all three. Complexes III and IV were first solved by X-ray crystallography in the 1990s. Fix: "Its structure was solved by cryo-electron microscopy; those of complexes III and IV, by X-ray crystallography in the 1990s." Source: https://www.nature.com/articles/nature13686
- **Low**, steps.ts:67 (invest): "The doubly charged sugar can no longer leave the cell" places the trapping after the second phosphorylation. The first phosphate, added by hexokinase, already traps it. Fix: "Once it carries a phosphate the sugar can no longer leave the cell, and with two it is unstable enough to break."
- **Low**, MapScene.svelte:387: "2,840 kJ/mol of heat". 2,840 is the free energy; the heat a flame gives off is the enthalpy, about 2,803 kJ/mol. Fix: `text="≈ 2,800 kJ/mol, all as heat"`. Source: https://homework.study.com/explanation/the-molar-enthalpy-of-combustion-of-glucose-c6h12o6-is-2803-kj-a-mass-of-1-000-g-glucose-is-combusted-in-a-bomb-calorimeter-if-the-calorimeter-contains-875-g-h2o-and-the-bomb-has-a-heat-capacity.html

## Model issues
- **Low**, model.ts:424 and steps.ts:150: complex IV ignores Δp (`K.IV * c * c`), yet the oxygen note says "each complex running forward and backward with the ratio set by its drop in redox potential minus the work of pumping". In the model, respiratory control acts only through complexes I and III. Fix: change the note to "complexes I–III run forward and backward…; complex IV, far downhill, is treated as one-way". Alternatively, add a Δp brake such as `* 2 / (1 + Math.exp((dp - 0.19) / 0.012))`. I tried it: working Δp and P/O stay the same and the oxygen test still passes.
- **Low**, model.ts:349: the comment says the constants give "resting Δp ≈ 180 mV". The model settles at 194 mV, and that is what the readout shows. Fix: "≈ 190 mV".
- **Low**, ChainScene.svelte:92–110: with reduced motion on, `steadyChain(cond, WORKING.state)` (80,000 Euler sub-steps) re-runs on every frame, because the same `$derived` also reads `t`. Fix: move it into its own `const steady = $derived(reduced ? steadyChain(cond, WORKING.state) : null);` and compute only the clocks from `t`.
- The tests check real properties: carbon conservation, 6 O₂ per glucose, P/O ratios, the order the carriers fill, respiratory control and uncoupling. They are adequate.

## Narrative and scene mismatches
- **Medium**, steps.ts:283 (summary): "Glycolysis … makes 2 ATP; the citric acid cycle … loading 10 NADH and 2 FADH₂; … ATP synthase turns the proton gradient into some 26–28 more ATP" adds to 28–30. The scene and the last line say 30–32, and 2 of the 10 NADH come from glycolysis. Fix: "Glycolysis in the cytosol splits it, making 2 ATP and 2 NADH; the citric acid cycle in the matrix burns the pieces to CO₂, making 2 GTP and loading 8 more NADH and 2 FADH₂; the chain … and ATP synthase turns the proton gradient into some 26–28 more ATP."
- **Medium**, SynthaseScene.svelte:357–366: the readout "≈ X with transport" also appears for the spinach chloroplast, *E. coli* and Spirulina rings. Those ATP synthases make ATP where it is used (stroma, cytoplasm), so there is no transport proton. Showing 5.7 for spinach is wrong. Fix: give each `C_RINGS` entry a `mito: boolean` (true for cow and yeast). When it is false, show only `{fmt(hAtp)} at the synthase (ATP made where it is used: no transport cost)`.
- **Low**, steps.ts:251 (yield): "The c₈ ring would allow up to about 34–35". The model gives 34.5 with the malate shuttle and 32.4 with the glycerol shuttle. Fix: "up to about 34.5 (32.4 with the glycerol-phosphate shuttle)".
- **Low**, steps.ts:172 (staircase): "Released in one go it could make at most one ATP" is not a physical limit. Fix: "Released in one go, by a reaction coupled to a single ATP, most of it would be wasted as heat."
- **Low**, GlycolysisScene.svelte:315–322: the screen-reader value ("2 ATP spent to split the sugar") differs from the drawn label ("the sugar is primed to split"). Fix: make the label `an investment: 2 ATP spent to split the sugar`.
- **Low**, StaircaseScene.svelte:100 and steps.ts:174: the staircase stores energy at 180 mV, while the chain scene the reader has just seen reads 194 mV. Either use `DP = 0.19` or add "(a typical value)" to the label.

## Catalogue requirements
Everything is met. The reader follows one glucose through glycolysis, the link reaction, the cycle and the chain. The proton pumps, the flow-back toggle, the turning rotor and the "remove oxygen" control all run on the kinetic model. The takeaway shows in the flame-versus-staircase strip, the energy staircase and the turbine, and the prerequisite (the-cell) is respected.

## Clarity
- **Low**, steps.ts:171: "the mirror image of photosynthesis's Z-scheme" assumes the reader knows a topic that is only related, not a prerequisite. Fix: "(if you have read photosynthesis: the mirror image of its Z-scheme)", or drop the clause.
- **Low**, steps.ts:120: "folded into the cristae" uses *cristae* without explaining it. Fix: `folded into <dfn data-def="The folds of the inner mitochondrial membrane, which pack in more of the chain.">cristae</dfn>`.

## Sources consulted
- https://www.sigmaaldrich.com/US/en/product/sigma/a8674 (antimycin A from *Streptomyces*)
- https://link.springer.com/chapter/10.1007/978-1-4684-5643-1_84 and https://journals.physiology.org/doi/full/10.1152/ajpcell.00022.2021 (how CO is toxic)
- https://pubmed.ncbi.nlm.nih.gov/15607740/ (Porcelli 2005: intermembrane-space pH 6.88)
- https://rupress.org/jgp/article/139/6/415/43083/ (Δp 180–220 mV, Δψ 150–180 mV, ΔpH 0.5–1.2)
- https://www.pnas.org/doi/10.1073/pnas.1011099107 (Watt 2010: c₈ ring, 2.7 H⁺ per ATP)
- https://www.sciencedirect.com/science/article/pii/S0005272804002701 (Hinkle 2005 P/O review, studies since 1937)
- https://www.nature.com/articles/nature13686 (cryo-EM of mammalian complex I)
- https://www.researchgate.net/publication/14143706_Direct_observation_of_the_rotation_of_F1-ATPase (Noji 1997)
- https://journals.biologists.com/jeb/article/208/24/4561/15901/ and https://journals.physiology.org/doi/full/10.1152/ajpregu.00114.2004 (lactate is made even with adequate oxygen)
- https://en.wikipedia.org/wiki/Glycerol_phosphate_shuttle (which tissues use which shuttle)
- I also ran a port of `model.ts` under Node 22 to check the steady states, the order the carriers fill, and the blocked and uncoupled cases.
