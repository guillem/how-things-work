<!-- batch msgbatch_01T1HXwuGNW3HELJkRLcjpWS, claude-opus-5-5, submitted 2026-10-15T04:14:06.412Z, ~$0.97 in tokens + 15 web searches -->
# Review: nuclear-fission

## Verdict
The page is ready once the fixes below are made. It needs no rework. The physics behind it is sound. I recomputed the masses (AME2020), the energy released by each split, the six delayed-neutron groups, the 55 s inhour period, and the k values the four-factor model gives (1.41 with the rods out, critical at 4% fuel with the rods half in, best natural-uranium k ≈ 0.90). All match what the text says. The most important fix is the energy waterfall: it puts 0.35 MeV of decays that have not happened yet under the label "antineutrinos" (it shows −9.4, while the notes say 9.1). Next in importance:
- the chain step's list of where lost neutrons go contradicts the page's own core model;
- the η bar stops growing above about 1% enrichment, so it no longer moves on the enrichment step;
- after a scram, the operate view labels fission power as "heat" and leaves out decay heat;
- the claim that licensing requires negative void feedback is wrong.

## Factual errors
- **medium**, CurveScene.svelte:136–142 and steps.ts:176. The "antineutrinos escape" row shows `− (E.neutrinos + E.pending)` = −9.4 MeV. In Ma et al., the 0.35 MeV is ΔE_βγ: β and γ energy from long-lived products that has not been released yet at mid-cycle. It is not antineutrino energy. The notes also say 9.1, so the graphic and the text disagree. Fix: set the row label to `'antineutrinos escape, decays still to come'`, or split it into two rows: `{id:'nu', … value:'− 9.1'}` and `{id:'pending', label:'decays not yet happened', value:'− 0.35'}`. Source: https://arxiv.org/pdf/2004.04075 (it quotes Ma et al.'s "ΔE_βγ = (0.35 ± 0.02) MeV" for a PWR cycle), https://arxiv.org/pdf/1212.6625
- **medium**, steps.ts:264. "Reactor licensing now requires the temperature and void feedbacks to be negative" is false as stated. CANDU reactors are licensed with a small positive coolant void coefficient. US rules (GDC 11) require only that the net prompt inherent feedback compensates for a rapid rise in reactivity. Fix: "Regulators now require the overall power feedback to be negative; CANDU reactors, for example, have a small positive void coefficient and rely on fast, independent shutdown systems." Sources: https://www.cnsc-ccsn.gc.ca/eng/resources/research/safety-analysis/positive-void-coefficient-of-reactivity-candus/ , https://en.wikipedia.org/wiki/Void_coefficient
- **medium**, steps.ts:304 and KineticsScene decay view. "About 6% … about 1% after an hour" follows Way–Wigner, but standard figures are about 6.5% at shutdown and about 1.5% after an hour. The value after a day (0.4%) is right. The simple formula is about 30% low at one hour, and it is also being used at t = 1 s, outside the 10 s–100 day range stated in model.ts:501. Fix the text: "about 6–7% of full power, some 200 MW, … about 1 to 1.5% after an hour (the simple formula plotted here gives the lower value), still about 0.4% after a day." Source: https://world-nuclear.org/information-library/nuclear-power-reactors/overview/nuclear-power-reactors , https://en.wikipedia.org/wiki/Decay_heat
- **medium**, steps.ts:161 and CurveScene.svelte:309. "Moves 236 nucleons up the curve by about 0.8 MeV each: about 200 MeV in all" has two problems. First, 0.8 × 236 = 189. Second, the fragments drawn on the curve give only 173–185 MeV at once, because the freed neutrons carry no binding energy. The ~200 MeV comes only after the fragments beta-decay further up the curve. Text fix: "Splitting lifts the nucleons that stay in the fragments up the curve by about 0.8 MeV each: some 170–185 MeV at once, and about 200 MeV once the fragments have decayed to stable nuclei, which sit higher still." Label fix: `"fission: up ≈ 0.8 MeV per nucleon → ≈ 175 MeV at once, ≈ 200 after decays"`.
- **low**, steps.ts:305. At Fukushima, the earthquake cut the grid supply, and the tsunami then flooded the emergency diesel generators and switchgear. Fix: "the earthquake cut the grid supply and the tsunami flooded the emergency generators, so the cooling pumps stopped". I am confident of this, but I could not retrieve a source for it in this session. Reference: https://world-nuclear.org/information-library/safety-and-security/safety-of-plants/fukushima-daiichi-accident
- **low**, steps.ts:303 and KineticsScene `kg` readout. The ~3.1 kg/day figure is fissile nuclei *split*. Part of that is plutonium bred from U-238, and the U-235 actually consumed is about 15% higher because U-235 also captures neutrons without splitting. Fix: "some 3 kg of fissile nuclei a day, mostly uranium-235 (later in the fuel's life also plutonium made from uranium-238)".
- **low**, steps.ts:162. "Just above iron-58 and iron-56 (8.790)": Fe-58 is 8.792 (the page's own AME2020 data, ame2020.ts:58). Fix: "just above iron-58 (8.792) and iron-56 (8.790)".
- **low**, steps.ts:173. "Most of a proton's mass [is] the energy of its gluon field" overstates it. Lattice QCD splits the mass among quark kinetic energy (~32%), gluon field energy (~36%), the trace anomaly (~23%) and the quark condensate (~9%). Fix: "…the energy of its quarks and gluons in motion". I am moderately confident (Yang et al., PRL 121, 212001 (2018), https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.121.212001; not retrieved in this session).
- **low**, steps.ts:277 against the `dfn` at the same line. The body says delayed neutrons come out "a fraction of a second to about a minute" after fission, but the definition says "seconds to a minute". The fastest group has a half-life of 0.23 s. Fix the definition: "…released from a fraction of a second to a few minutes after the fission…".

Everything else I checked is correct:
- U-235 composition and half-life (704 Myr); the beta-decay chains ending at Pr-141 and Zr-92.
- Fragment speed (~4–5% of c) and range (~10 µm).
- Mass converted (0.091%); methane 9.2 eV per molecule; the ×1.5 million figure.
- The thermal constants: ν̄ = 2.425 is the 2017 thermal-neutron-constants value; σf = 587.3 b.
- ξ values (1, 0.93, 0.158); 20 and 115 collisions; fast and thermal neutron speeds.
- Keepin's six groups and β = 0.0065; prompt-only ×22,000 per second.
- AP1000 at 3,415 MWt and 1,117 MWe.

## Model issues
- **medium**, KineticsScene.svelte:405–422 (operate). Point kinetics gives only fission power, but the readout calls it "GW of heat". After a scram it shows about 3% (0.09 GW) at 10 s, while the real heat is about 5–6% from decay heat, which the step's own text mentions ("the fragments keep decaying"). Fix: change the readout to `fission power` (`{fmt(...)} GW from fission`). Alternatively, add the existing `decayHeat(time since scram)` term to the plotted heat after a scram and label the curve "heat (fission + decay)".
- **medium**, chain.ts:67. Lost neutrons are split 60% captured and 40% escaped, so about a quarter of all neutrons leak out of the tree. The core model fixes leakage at 3% (model.ts:222), and the step says "In reactor fuel". Fix: draw the split from the core model's shares at the design point: `hash(...) < 0.93 ? 'captured' : 'escaped'`. That is about 0.03 leakage against about 0.56 absorbed without fission per neutron, from `factors(DESIGN)`.
- **low**, model.ts:277. With water = 0, p = 0, so k is exactly 0 and the readout shows 0.000. Fast fission in U-235 and U-238 would still give a non-zero (though far subcritical) k. Fix: state the simplification on the void step ("with no water this model counts every neutron as lost; in reality a dry core's k is far below 1 but not zero"), or floor the displayed k as "≪ 1".
- **low**, model.ts:152 against steps.ts:58 and CoreScene.svelte:332. `NATURAL = 0.72` is an *atom* percentage, but the slider and `atomFraction` treat enrichment as *weight* percent. Natural uranium is 0.711 wt%. Fix: `export const NATURAL = 0.711; // % by weight (0.720 by atoms)`.
- **low**, chain.ts:13–17 against e2e:193–194. The comment says the seed keeps the critical run within ±10%, but the test only checks ±15%. Make them agree: `toBeLessThan(0.10)` if that holds for seed 227, otherwise change the comment.
- **low**, tests. The decay-heat tests only check the formula against itself. Add a check against reference values (for example `decayHeat(3600)` between 0.009 and 0.016) so a future change to the formula cannot drift unnoticed.

The rest of the model is correct:
- the energy budget from mass excesses (I recomputed B/A for Kr-92, Ba-141 and U-235, and Q = 173.3 MeV);
- the branching mean k;
- η, p (the Hellstrand UO₂ correlation 4.45 + 26.6√(S/M)) and f;
- the backward-Euler point kinetics, the precursors' steady state and the inhour root (55.0 s).

## Narrative and scene mismatches
- **medium**, steps.ts:188. Lost neutrons are said to be "captured … mostly uranium-238 or the hydrogen of the water". The page's own model at the design point says otherwise: per neutron, U-238 takes 26%, the control absorbers 22%, U-235 without splitting 7%, water only 2.3%, and 3% escape. Fix: "some are captured: swallowed by a nucleus that does not split, mostly uranium-238, the absorbers of the control rods, and sometimes uranium-235 itself."
- **medium**, steps.ts:261 against model. "Designed with a little *less* water than would give the most fissions" doesn't match the model, where k peaks at about 300% of the design water (k 1.115 against 1.000), as the same step's last paragraph says. Fix: "designed with less water than would give the most fissions".
- **medium**, CoreScene.svelte:664. The factor bars cap at `Math.min(1.5, row.v)`. η is 1.50 at 1% enrichment and 1.90 at 4%, so on the enrichment step the factor that actually changes most stops moving above about 1%. Fix: `width={(Math.min(2, row.v) / 2) * (GX1 - GX0 - 110)}`.
- **low**, CoreScene.svelte:612–614 against model.ts:306. The green "steady" band on the gauge spans k = 0.995–1.005, but the label says "critical" only within ±0.001. At k = 1.003 the pointer sits in the green band while the label reads "supercritical". Fix: `x={gk(0.999)} width={Math.max(3, gk(1.001) - gk(0.999))}`.
- **low**, steps.ts:290. "The power drifts … over tens of seconds" holds, but only roughly: a 3% rod move gives a period of about 200 s, though the prompt jump plus transient reach ×1.5 within 60 s. No change needed beyond what is above. I mention it only because "minutes" would be just as accurate.

Everything else the text quotes matches the graphic: 0.9^40 ≈ 0.015, 1.1^40 ≈ 45, the 1.18 prompt jump, the 0.92 s off-chart time, scram to <10% within 1 s and ~3% at 10 s, 1.41 with the rods out, 9.25 × 10¹⁹ fissions per second, 180 MW.

## Catalogue requirements
All met. The neutron can be fired and the split shows energy and new neutrons. Fuel, moderator (water) and rods are adjustable, with k and a 50-generation look-ahead showing behaviour just above and below 1. The takeaway (k = 1.000, "critical") is visible in the graphic. Real AME2020 data is used, and the radioactivity prerequisite is linked.

## Clarity
- **medium**, steps.ts:146. "uranium-236, with energy to spare" doesn't say where the energy comes from. A slow neutron brings almost no kinetic energy; the energy is its binding energy (~6.5 MeV), which pushes U-236 over its fission barrier. Without this, the fuel step's "uranium-238, which slow neutrons do not split" has no explanation. Add: "The energy comes not from the neutron's speed but from its being bound into the nucleus: about 6.5 MeV, enough to set uranium-236 splitting. When uranium-238 swallows a slow neutron it gains less, too little to split."
- **low**, steps.ts:160. "MeV" appears in the body but is defined only in the notes. Write `<dfn data-def="A million electronvolts, the energy unit of nuclear physics; a chemical bond holds a few eV.">MeV</dfn>` at its first use.
- **low**, KineticsScene.svelte:438. The operate readout shows "reactivity +0.12%", but "reactivity" is never defined. Either define it in the operate step ("reactivity, (k − 1)/k, about k − 1") or relabel it `k − 1 ≈ …`.

## Sources consulted
- IAEA Neutron Data Standards 2017: https://nds.iaea.org/standards/ ; the thermal-neutron-constants fit giving ν̄_t(²³⁵U) = 2.4250: https://www.researchgate.net/publication/319674034
- ENDF/B-VIII.1 paper (thermal-constants table): https://arxiv.org/pdf/2511.03564
- Ma et al., energy release in fission: https://arxiv.org/pdf/1212.6625 ; a paper quoting Ma et al.'s 202.36 MeV: https://arxiv.org/pdf/1411.6475 ; a paper quoting Ma et al.'s definitions of ΔE_βγ and E_nc: https://arxiv.org/pdf/2004.04075
- World Nuclear Association, nuclear power reactors (decay heat): https://world-nuclear.org/information-library/nuclear-power-reactors/overview/nuclear-power-reactors
- Decay heat: https://en.wikipedia.org/wiki/Decay_heat
- CNSC, positive void coefficient and CANDU: https://www.cnsc-ccsn.gc.ca/eng/resources/research/safety-analysis/positive-void-coefficient-of-reactivity-candus/ ; https://en.wikipedia.org/wiki/Void_coefficient
- AP1000 ratings: https://westinghousenuclear.com/media/gs4fx5qc/30987_wec_-ap1000_flysheet_v5-1.pdf ; https://www-pub.iaea.org/MTCD/publications/PDF/P1500_CD_Web/htm/pdf/topic3/3S05_P.%20Gaio.pdf
- Not retrieved in this session (cited from knowledge): the WNA Fukushima page and Yang et al. PRL 121, 212001 (2018), linked above.
- Own recomputation of the model (masses, Q values, k against water and enrichment, inhour, scram transient) in Python.
