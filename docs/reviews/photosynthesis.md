<!-- batch msgbatch_01S3QSUCdPJ4fW7ajbtDspPj, claude-opus-5-5, submitted 2026-10-11T20:54:08.070Z, ~$0.97 in tokens + 15 web searches -->
# Review: photosynthesis

## Verdict
**Needs rework.** The biochemistry is mostly accurate and carefully done. The redox potentials, the carbon ledger, the 9 ATP + 6 NADPH cost, the Q-cycle arithmetic and the 14-subunit c-ring all check out. But the page does not build the catalogue's core interaction. There is no CO₂ control, no temperature control, light colour does not change any rate, and no graphic shows the rate of sugar or oxygen production. No model file or tests came with the submission, so the "simulate" behaviour is hand-set animation constants. **Most important fix:** add a real leaf-photosynthesis rate model (Farquhar–von Caemmerer–Berry, the standard model of C₃ photosynthesis) driven by light intensity, colour, CO₂ and temperature, with a live rate plot. The second priority is the spectrum scene: its "whole leaf" curve is a rescaled pigment-extract curve, and it shows a leaf absorbing ≤20% of green light, when real leaves absorb 50–90%.

## Factual errors
- **high** — `steps.ts:91`, `SpectrumScene.svelte:62-69, 316-332, 555`. The body says green light "is absorbed only weakly", and the scene labels its dashed curve "whole leaf (all three combined)". At 550 nm the scene shows 1–2 of 10 photons absorbed and says leaves look green because green is absorbed weakly. The code itself admits the curve is "not the real leaf" (it gives about half at 680 nm, where a real leaf absorbs about 90%). Real leaves absorb 50% (lettuce) to 90% (evergreen trees) at 550 nm, and 80–95% in blue and red. This also contradicts the page's own note at `steps.ts:93`. Fix, either:
  - (a) Use measured leaf absorptance data (McCree 1972 / Inada 1976), document the source, and keep the extract curves as a separate series.
  - (b) Relabel honestly: legend `"pigments in a thin extract"`, pill `"{n}% absorbed by the extract"`, and a leaf demo captioned "pigment extract".

  Either way, change the body to: *"In between, green light (around 500–570 nm) is absorbed least. Pigments in solution barely take it, and even a whole leaf, which absorbs most of it, reflects and transmits more green than any other colour — which is why leaves look green."* Source: Terashima et al. 2009, http://www.esalq.usp.br/lepse/imgs/conteudo_thumb/Green-Light-Drives-Leaf-Photosynthesis-More-Ef--64257--ciently-than-Red-Light-in-Strong-White-Light-Revisiting-the-Enigmatic-Question-of-Why-Leaves-are-Green-2.pdf
- **medium** — `steps.ts:224`, `CalvinScene.svelte:768, 255-273`. "The rest is exported from the chloroplast and converted into sucrose" says the six-carbon sugar is what leaves the chloroplast. In fact carbon is mainly exported as three-carbon triose phosphate, swapped for Pi, and sucrose is built in the cytosol. Starch is made in the chloroplast from hexose phosphates, not free glucose. Fix the text: *"Some G3P stays in the chloroplast and is built, via six-carbon sugar phosphates, into **starch** grains, a store broken down again at night. Most is exported to the cytosol as three-carbon sugar phosphate and assembled there into **sucrose** — table sugar — which travels through the phloem…"* In the scene, run the sucrose branch from the G3P exit path (labelled "G3P → cytosol → sucrose") instead of from the glucose junction, or label the junction "2 G3P → 6C sugar (accounting)". Source: https://www.sciencedirect.com/topics/biochemistry-genetics-and-molecular-biology/triose
- **medium** — `steps.ts:156`, `MembraneScene.svelte:122, 989`. "Roughly a thousand times more acidic… about three pH units" is the old textbook figure. In vivo estimates put the lumen at pH 5.8–6.5 under normal conditions, dropping below 5 only under excess light, with part of the driving force carried as membrane voltage. Confidence: moderate (some textbooks still quote ΔpH ≈ 3). Fix the text: *"In bright light the lumen becomes some 30–300 times more acidic than the stroma (1.5–2.5 pH units; part of the push also comes from a voltage across the membrane)."* Readout: `const lumenPH = (8 - 2.3 * g).toFixed(1)` (about 5.7 at full light). Label at line 989: `"tens to hundreds of times more acidic than the stroma in bright light"`. Source: Kramer, Sacksteder & Cruz 1999, https://link.springer.com/content/pdf/10.1023/A:1006212014787.pdf
- **medium** — `SummaryScene.svelte:353-363`. The hand-drawn O₂ curve puts post-Great-Oxidation-Event (Proterozoic) oxygen at about 27–33% of today (9–11 px of 33). Proxies show <1% of present levels for much of the mid-Proterozoic, and chromium data suggest ≤0.1%. This also breaks the "never invent data" rule. Fix: plot a published reconstruction (Lyons, Reinhard & Planavsky 2014, *Nature* 506:307), or keep it schematic with Proterozoic values around 1–3 px, a rise at 0.8–0.5 Ga, and a caption "schematic". Source: https://www.science.org/doi/10.1126/science.1258410
- **low** — `steps.ts:248`, `SummaryScene.svelte:317`. "Fixes on the order of a hundred billion tonnes" uses net primary production (NPP, Field 1998: 104.9 Pg C/yr) as if it were total fixation. Gross fixation on land alone is about 123 Pg C/yr. Fix the text: *"…photosynthesis adds about a hundred billion tonnes of carbon to new biomass, after the plants' own respiration (gross fixation is considerably more)"*. Change the tile line 1 to `'of carbon into new biomass every year'`. Sources: https://www.fsl.orst.edu/rna/Documents/publications/Primary%20production%20of%20the%20biosphere%20Integrating%20terrestrial%20and%20oceanic%20components.pdf, https://pubmed.ncbi.nlm.nih.gov/20603496/
- **low** — `SummaryScene.svelte:349`. "~3 billion years ago · first cyanobacteria" states a debated date as fact. Gene-family dating puts some form of oxygenic photosynthesis at about 3.0 Ga, but the cyanobacterial fossil record is inconclusive. Fix: `l2: 'oxygen-making photosynthesis (date debated)'`. Source: https://nph.onlinelibrary.wiley.com/doi/10.1111/nph.16249
- Verified correct, no change needed: Engelmann 1882; PSII/PSI named by discovery; P680⁺ as the strongest biological oxidant; S₀–S₄ states; three Fe–S clusters; 8 → 12 H⁺ per O₂ with the Q-cycle; 14 c-subunits → 3 ATP (Seelert 2000); Mitchell 1961/1978; RuBisCO about 3 s⁻¹ and the most abundant protein (Bar-On & Milo 2019); 4.6% / 6% efficiency ceilings (Zhu, Long & Ort 2008); all Z-scheme potentials; the Calvin ledger.

## Model issues
- **high** — No model file or tests were supplied. Every scene runs on animation constants, so nothing responds to "inputs nobody anticipated", and the catalogue's rates do not exist. Add `model.ts` with a documented Farquhar–von Caemmerer–Berry (FvCB) leaf model:
  ```ts
  // I: PPFD µmol m⁻² s⁻¹, absorbed via leaf absorptance a(λ) and McCree relative quantum yield
  const Iabs = I * leafAbsorptance(nm) * mccree(nm);
  const J = (a2 * Iabs + Jmax(T) - Math.sqrt((a2*Iabs + Jmax(T))**2 - 4*0.7*a2*Iabs*Jmax(T))) / (2*0.7);
  const Ci = 0.7 * Ca;                       // stated simplification
  const Wc = Vcmax(T) * (Ci - G(T)) / (Ci + Kc(T) * (1 + O / Ko(T)));
  const Wj = J * (Ci - G(T)) / (4 * Ci + 8 * G(T));
  const A = Math.min(Wc, Wj) - Rd(T);        // net CO₂ uptake
  const o2 = J / 4; const glucose = (A + Rd(T)) / 6;
  ```
  Use Bernacchi et al. 2001 temperature functions (Γ* = 42.75 µmol mol⁻¹, Kc = 404.9 µmol mol⁻¹, Ko = 278.4 mmol mol⁻¹ at 25 °C; doi:10.1046/j.1365-3040.2001.00668.x). Tests should check:
  - A = −Rd in darkness.
  - A rises with I and saturates.
  - A rises with CO₂ and reaches zero at the compensation point.
  - There is a temperature optimum.
  - Green light gives a lower rate than red, but not near zero.
  - 6 O₂ per glucose.

  Source: https://www.researchgate.net/publication/226907288_Biochemical_Model_of_C3_Photosynthesis
- **medium** — `SummaryScene.svelte:134`. `saturate = 1.8x/(x+0.8)` is an invented curve with no CO₂ or temperature term, while the ATP-synthase rotor (line 146) and the gauges (line 612) stay linear in light. Replace all three with outputs of the model above (rotor ∝ J, ring ∝ A + Rd).
- **medium** — `SummaryScene.svelte` / `palette.ts` (not supplied). The `absorbance()` spectra have no documented source, and the legend shows them as "N%". If they are fitted Gaussians, replace them with measured spectra (e.g. PhotochemCAD, chlorophyll a/b in diethyl ether) and cite them on the page. Normalised absorbance is not percent absorbed: label the axis "relative absorbance" and drop `pct()` in the legend (`SpectrumScene.svelte:531`).
- **low** — `MembraneScene.svelte:352-353, 389-391`. The drawn fluxes don't balance:
  - Electrons pass at 0.5 e⁻/s, but three plastoquinones cycling every 6 s carry 1 e⁻/s worth of trips.
  - The lumen receives 1.5 H⁺/s (water + b₆f) while ATP synthase drains 2 H⁺/s.

  Set `PQ_PERIOD = 12` and `ROTOR_TURN = 14 / 1.5` (≈ 9.33 s). The ATP:NADPH ratio then comes out at about 1.29, below the Calvin cycle's 1.5. That is a real and teachable shortfall, and it motivates the cyclic-flow note.
- **low** — `SpectrumScene.svelte:58-61`. The comment says chl a : b : car ≈ 3 : 1 : 1, but the weights 0.6 : 0.25 : 0.25 give 2.4 : 1 : 1. Fix one or the other.

## Narrative and scene mismatches
- **medium** — `steps.ts:13` vs `MembraneScene.svelte:47`. The light-slider help promises faster flow "until the machinery saturates", but `speed = light / 70` is linear and never saturates. Either drive `speed` from the model's J (which saturates), or change the help to "More photons per second means faster electron flow."
- **low** — `steps.ts:214` says the Calvin cycle stops "within minutes", while `steps.ts:238` (and the scene, about 5 s) says "within moments". Make them agree: *"they stall within seconds to minutes once the light reactions stop feeding them."*
- **low** — `LeafScene.svelte:761`. "ATP & NADPH out, ADP & NADP⁺ back" leaves out Pi, which the Calvin scene (line 558) and `steps.ts:202` include. Fix: `"ATP & NADPH out; ADP, Pi & NADP⁺ back"`.

## Catalogue requirements
- **high** — Interaction is not built. There are no CO₂ or temperature controls. Light colour (the pigments step) is not linked to any rate. No graphic shows "the rate of sugar and oxygen production". Fix: on the `summary` step (or a new "What limits the rate?" step), add four controls:
  - light intensity
  - wavelength (reuse the spectrum colour)
  - CO₂ in ppm (e.g. 100–1000, default 420)
  - temperature in °C (5–45)

  Drive them through the model above, with a live plot of O₂ and glucose rate over time, and readouts in µmol m⁻² s⁻¹. State the simplifications on the page (fixed Ci/Ca, C₃ leaf).
- **high** — The pitfall is only half avoided. "Oxygen comes from water" appears in a "Go deeper" note (`steps.ts:41`) and implicitly in the water step. "Dry mass comes mostly from CO₂, not soil" is never said, and the leaf view's "water from the roots" plus "sugar" can reinforce the soil misconception. Add to the body after `steps.ts:39`: *"<p>Nearly all of a plant's dry mass is built from the carbon in that CO<sub>2</sub> — a tree is made mostly of air, not soil; the soil supplies water and a few percent of minerals. And the O<sub>2</sub> released comes from the water, not from the CO<sub>2</sub>.</p>"* Source: https://www.openbookpublishers.com/books/10.11647/obp.0526/chapters/10.11647/obp.0526.35
- **medium** — Prerequisite `the-cell` is unticked in the checklist, so by the build order this topic is not yet ready. The submitted files contain no "read first" link to it, nor links to `respiration-atp` and `solar-cells` (the ATP step's mitochondria line at `steps.ts:158` is the natural place for the first). Confirm the framework generates these links, and build or stub `the-cell` first.
- Takeaway: visible in the summary system view (water in, O₂ out, CO₂ → sugar). OK.

## Clarity
- **medium** — The page is pitched above Level 1 (high school). The PSI acceptor list (A₀, phylloquinone A₁, three Fe–S clusters, `steps.ts:143`), the Z-scheme in volts, and the S-state/Q-cycle notes are university-level. Move the acceptor list into a note and keep the body as: *"The re-energised electron is passed along to **ferredoxin**, a small protein on the stroma side, and an enzyme (ferredoxin–NADP⁺ reductase, FNR) uses two such electrons…"*. This also names FNR, which the scene labels (`MembraneScene.svelte:1038`) but the text never introduces.
- **low** — `steps.ts:115`. "Oxidising agent" is used without explanation. Wrap it in a definition: `<dfn data-def="Something that pulls electrons away from other molecules.">oxidising agents</dfn>`.
- **low** — `steps.ts:145`. "Reducing power" appears before "reduced" is defined (`steps.ts:201`). Add "(able to *reduce* — add electrons to — other molecules)".
- **low** — `steps.ts:214`. "The 'dark' reactions" debunks a term the reader has never met. Fix: *"The Calvin cycle is sometimes called the 'dark' reactions, but it is not really dark: …"*.

## Sources consulted
- Terashima et al. 2009, *Plant Cell Physiol.* 50:684 — http://www.esalq.usp.br/lepse/imgs/conteudo_thumb/Green-Light-Drives-Leaf-Photosynthesis-More-Ef--64257--ciently-than-Red-Light-in-Strong-White-Light-Revisiting-the-Enigmatic-Question-of-Why-Leaves-are-Green-2.pdf
- Kramer, Sacksteder & Cruz 1999, *Photosynth. Res.* 60:151 — https://link.springer.com/content/pdf/10.1023/A:1006212014787.pdf
- Field et al. 1998, *Science* 281:237 — https://www.fsl.orst.edu/rna/Documents/publications/Primary%20production%20of%20the%20biosphere%20Integrating%20terrestrial%20and%20oceanic%20components.pdf
- Beer et al. 2010, *Science* 329:834 — https://pubmed.ncbi.nlm.nih.gov/20603496/
- Triose phosphate export / sucrose synthesis — https://www.sciencedirect.com/topics/biochemistry-genetics-and-molecular-biology/triose
- Planavsky et al. 2014, *Science* (mid-Proterozoic O₂) — https://www.science.org/doi/10.1126/science.1258410
- Sánchez-Baracaldo & Cardona 2020, *New Phytol.* — https://nph.onlinelibrary.wiley.com/doi/10.1111/nph.16249
- Zhu, Long & Ort 2008 — https://pubmed.ncbi.nlm.nih.gov/18374559/
- Seelert et al. 2000 (c₁₄ ring) — https://www.cell.com/current-biology/fulltext/S0960-9822(00)00765-X
- Bar-On & Milo 2019, *PNAS* — https://www.researchgate.net/publication/331229633_The_global_mass_and_average_rate_of_rubisco
- Kok cycle (S₃ → S₄ → S₀) — https://www.nature.com/articles/s41467-024-50210-6
- FvCB model overview — https://www.researchgate.net/publication/226907288_Biochemical_Model_of_C3_Photosynthesis
- Dry mass from air — https://www.openbookpublishers.com/books/10.11647/obp.0526/chapters/10.11647/obp.0526.35
