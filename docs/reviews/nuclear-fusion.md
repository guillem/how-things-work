<!-- batch msgbatch_01T1HXwuGNW3HELJkRLcjpWS, claude-opus-5-5, submitted 2026-10-15T04:14:06.412Z, ~$0.81 in tokens + 15 web searches -->
# Review: nuclear-fusion

## Verdict
The page is ready once the fixes below are made. The physics core is sound. I recomputed the AME2020 Q-values, the Bosch–Hale cross section and reactivity coefficients, the bremsstrahlung constant, the ignition condition, the Gamow numbers, the ~35 keV fusion peak and the 2.9 × 10²¹ keV s m⁻³ minimum at 14 keV, and all of them check out. The most important fix is the description of NIF's December 2022 shot. The page says it was "the first time a fusion fuel gave out more than was put into it". The fuel itself had already done that in 2013–14. What was new in 2022 was more fusion energy than the laser energy delivered to the target. Two other fixes matter: JET's 1997 gain should be the official 0.67, and the tokamak drawing winds its field line the wrong way round.

## Factual errors
- **High**: steps.ts:230. The sentence "the first time a fusion fuel gave out more than was put into it" is wrong. NIF had already reported fuel gain above 1 in 2014 (Hurricane et al., *Nature* 506, 343). The 2022 milestone was more fusion energy than the laser energy that drove it. Fix: "…gave **3.15 MJ** of fusion: the first time a fusion experiment released more energy than the laser light delivered to its target." Sources: https://www.nature.com/articles/nature13008, https://www.world-nuclear-news.org/Articles/US-researchers-achieve-historic-fusion-ignition
- **Medium**: steps.ts:219, steps.ts:241, ScorecardScene.svelte:24 and :47–50. JET's 1997 record is officially 16 MW of fusion from 24 MW of heating, Q = 0.67, not 25 MW and 0.64. Fix:
  - steps.ts:219: "16 MW for a fraction of a second in 1997 from 24 MW of heating, gave Q ≈ 0.67".
  - steps.ts:241: "about **0.67**".
  - Scorecard: `q: 16 / 24`, `sub: '16 MW from 24 MW of heating'`, and update the source comment to match.
  
  Source: https://www.istp.cnr.it/jet-background-information/
- **Low**: steps.ts:53 (density help). "A millionth of the density of air" is off by a factor of 4 when counting particles: air has about 2.5 × 10²⁵ molecules/m³, so 10²⁰ is 1/250,000 of that. Fix: "10²⁰ is a typical tokamak, about 250,000 times fewer particles than in air." Source: https://spacemath.gsfc.nasa.gov/weekly/RBSP9.pdf
- **Low**: steps.ts:162 and ConfineScene.svelte:222/228. 10–20 keV is 116–232 million K, not 100–200 million. Fix: "about 120–230 million kelvin".
- **Low**: steps.ts:149. The peak at 35 keV is about 1/13 of the 444 keV barrier, not "a tenth". Fix: "but still only about a twelfth of the barrier".
- **Low**: steps.ts:163. Bosch–Hale's D–³He reactivity fit is valid from 0.5 keV, not 0.2. Fix: "(D–³He from 0.5 to 190 keV)".

## Model issues
- **Low**: model.ts:51–52. The comment "Electrons balance on both sides because the charges do" is false for `Q_FISSION`: 92 electrons go in and 59 + 40 = 99 come out. The result is still right, because using atomic masses accounts for the beta electrons automatically. Fix the comment: "With atomic masses, electrons cancel for charge-conserving reactions, and beta-minus electrons are absorbed into the daughter atoms' masses (electron binding energies neglected)."
- **Low**: model.ts:407–408 together with PlasmaScene.svelte:210–217. The outcome `'steady'` is displayed as "cools: fusion fizzles out". Add a branch: `if (run.outcome === 'steady') return 'holds steady: on the edge of ignition';`.
- Everything else checks out: the Bosch–Hale coefficients and their validity ranges, the D–T cross section, the reactivity tested against UWFDM-1268 table 6, the C_B unit conversion (5.34 × 10⁻³⁷), the ignition and Q formulas, and the 4.29 keV ideal ignition temperature (which agrees with 4.3 keV in https://arxiv.org/pdf/2105.10954). The tests check real published values.

## Narrative and scene mismatches
- **Medium**: ConfineScene.svelte:65–71. The drawn field line goes round the long way once and the short way 3.2 times. That is a safety factor q ≈ 0.3. Real tokamaks run at q > 1 (the Kruskal–Shafranov limit), usually about 3 at the edge, so field lines wind mostly the long way. Fix: trace φ over 3 turns with θ = φ/3, for example `const TURNS = 1/3; const field = Array.from({length: 3*N+1}, (_, i) => { const phi = (i/N)*2*Math.PI; return proj(phi, A*0.62, phi*TURNS); });`. Make the same change in `ions` (`phi = u*6*Math.PI`) and update the comment. Source: https://en.wikipedia.org/wiki/Safety_factor_(plasma_physics)
- **Low**: ReactionScene.svelte:48. The neutron's vertical displacement carries an extra `* 0.25`, so it does not move opposite to the alpha. The scene's own comment promises "equal and opposite momenta". Fix: use one slope for both, e.g. `hePos y: CY - 0.08*heTravel*fly`, `nPos y: CY + 0.08*4*heTravel*fly`.
- **Low**: steps.ts:148 against GamowScene. The text says "multiply the two curves" and the legend says "fusions: the product". The fusion curve actually includes the measured cross section and the speed, so it peaks at 35 keV, while the product of the two plotted curves peaks at about 31 keV. Fix: "Multiply the two (and the real cross section, see Go deeper)…", and change the legend to "fusions (with the real cross section)".
- **Low**: PlasmaScene.svelte:360–366. When the plasma is ignited, the "held steady" bars do not balance (heat in > heat out), yet the title says "held steady". Fix: when `surplus > 0`, change the title to "Power per cubic metre: the alphas out-heat the losses" (or add a "surplus" segment to the heat-out column).
- **Low**: BindingScene.svelte:107. The tritium readout gets `label={undefined}`, so it appears unlabelled in the readout list. Fix: `label={m.text.split('  ')[0]}` for every mark.
- **Low**: steps.ts:8. `fmtKelvin` shows 1 keV as "12 million K", while the help text and the scenes say 11.6. Fix: reuse `kelvinText` from `scenes/settings.ts`.

## Catalogue requirements
- **Medium**: tokamak step (steps.ts:209–219). The entry says "Confine the plasma in a magnetic field and adjust temperature, density and confinement time". On the page, the magnetic-confinement scene has no controls. The adjustable plasma (balance, lawson and ignite steps) sits in a generic box with nothing magnetic about it. Fix: either draw the vessel in PlasmaScene as a tokamak cross-section with field lines and label the τ_E slider "how well the magnetic field holds the heat", or add the temperature, density and τ_E controls to the tokamak step. If neither is wanted, propose rewording the entry.
- The takeaway is visible in the graphics: the energy-per-kilogram bars, the 10–20 keV band, the Lawson U-curve and the heaters-off run. The entry has no Needs or Pitfall to check. The prerequisite (radioactivity) is linked inline.

## Clarity
- **Medium**: steps.ts:110 and :147. MeV is used in the first body but only defined in the Go-deeper note, and keV appears in the tunnelling body without having been defined in any body text. Fix: in step 1, add "(an MeV, mega-electronvolt, is a tiny unit of energy suited to single nuclei)". In the repel body, add "Plasma physicists give temperature in keV: 1 keV is 11.6 million kelvin."
- **Medium**: steps.ts:121. "Momentum is shared out like a gun's recoil, so the light neutron flies off with four-fifths of it" reads as if the neutron takes four-fifths of the momentum. Momentum is in fact split equally. Fix: "The two fly apart with equal and opposite momentum, like a gun and its bullet, so the light neutron carries four-fifths of the energy, 14.05 MeV, …"
- **Low**: steps.ts:147. "1 in 7,000 per collision" should be per head-on collision, since the Gamow factor is an s-wave tunnelling probability. Fix: "per head-on collision".
- **Low**: steps.ts:216. "Can only drift along them" clashes with "drifting out" in the next paragraph, because *drift* means the slow sideways motion. Fix: "and moves freely only along them".
- **Low**: steps.ts:203. "A flame without enough fuel" is misleading: the plasma cools because of losses, not because fuel runs out (fuel is not depleted in the model). Fix: "like a damp log that goes out once the match is taken away".

## Sources consulted
- https://www.istp.cnr.it/jet-background-information/ (JET 1997: 16 MW / 24 MW, Q = 0.67)
- https://euro-fusion.org/eurofusion-news/dte3record/ and https://www.oeaw.ac.at/en/fusion/news/news-1/neuer-energierekord-bei-fusionsforschungsanlage-jet (JET 2023: 69.26 MJ, 5.2 s, 0.21 mg)
- https://www.nature.com/articles/nature13008 (NIF fuel gain > 1, 2014)
- https://www.world-nuclear-news.org/Articles/US-researchers-achieve-historic-fusion-ignition, https://lasers.llnl.gov/about/keys-to-success/nif-sets-power-energy-records (NIF 2022; 8.6 MJ from 2.08 MJ in April 2025)
- https://www.nature.com/immersive/d41586-024-03745-z/index.html (more than 300 MJ to fire the NIF laser)
- https://www.iter.org/node/20687/new-baseline-prioritize-robust-start-exploitation (ITER: D–T in 2039)
- https://arxiv.org/pdf/2105.10954 (ideal ignition temperature 4.3 keV)
- https://en.wikipedia.org/wiki/Safety_factor_(plasma_physics) (Kruskal–Shafranov q > 1)
- https://spacemath.gsfc.nasa.gov/weekly/RBSP9.pdf (number density of air)
- Python recomputation of the model's constants and outputs (Q-values, Gamow energy, fusion peak, Lawson minimum, ideal ignition temperature, default-settings Q)
