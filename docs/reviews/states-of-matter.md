<!-- batch msgbatch_01BvqqPtzxfWhJdRYCvdSWHi, claude-opus-5-5, submitted 2026-10-12T06:58:04.959Z, ~$0.66 in tokens + 8 web searches -->
# Review: states-of-matter

## Verdict
The page is ready after the fixes below. The phase-diagram data checks out: I re-ran the Span & Wagner and IAPWS equations and they reproduce every number in the text (−55.6 °C and 14.8 °C at 50 atm, 34.4 and 56.5 atm, −78.5 °C, 71.8 °C on Everest, −8.9 °C at 100 MPa). The physics of the simulation is also correctly derived, including the hydrogen-bond forces and torques. The problems are in how the reader's real temperature and pressure are turned into the box's own settings (the mapping). **Most important fix:** that mapping jumps where the real substance changes smoothly. Crossing the dashed line above the critical point (T = 31 °C, P > 72.8 atm) nearly doubles the box's temperature. So the box shows a sudden change on the very path the page says is smooth ("without ever seeing it boil or condense"), and the note blames this on having only 80 molecules, which is not the cause.

## Factual errors
- **medium** — steps.ts:211 (water-diagram notes): "The pressure of a skate's blade lowers the melting point by much less than a degree" overstates the case. Estimates depend on the contact area assumed. The classic estimate (Joly, quoted by Rosenberg) gives "a pressure of 466 atmospheres and a corresponding melting point of −3.5 °C". The conclusion is right; the number is not safe. Fix: "The pressure of a skate's blade lowers the melting point by at most a few degrees, yet people skate at −30 °C, so pressure does not explain why ice is slippery." Source: https://physicstoday.aip.org/features/why-is-ice-slippery
- **low** — steps.ts:105 (gas notes): "about 70 nanometres, a few hundred times its size". The mean free path of about 68 nm is roughly 200 molecular diameters, not "a few hundred". Fix: "…about 70 nanometres, some two hundred times its size, between collisions." Source: https://www.firgelliauto.com/blogs/engineering-calculators/mean-free-path-calculator
- **low** — steps.ts:211: "the vapour pressure from the IAPWS-95 formulation (W. Wagner and A. Pruß, 1993)" mixes up two things. The 1993 paper (J. Phys. Chem. Ref. Data 22, 783) is IAPWS's separate equation for saturation properties; IAPWS-95 itself is Wagner & Pruß 2002. Fix: "the vapour pressure from W. Wagner and A. Pruß (1993), the saturation equation used alongside IAPWS-95". phase.ts:8 says the same thing ("as adopted in IAPWS-95"); change it the same way.
- Everything else checks out: triple and critical points, CO₂ at 0 °C and 20 °C, 2 atm → 120.6 °C (rounds to 121 °C), Everest at 33.7 kPa (West 1983), the ice and water densities, 9% expansion, 92% submerged, ice III above about 2,000 atm, and the Mercedes-Benz parameters.

## Model issues
- **high** — mapping.ts:121–127 against mapping.ts:95–105: the box's settings jump inside the supercritical region.
  - **Liquid side:** a liquid with P ≥ Pc gets Tb = critical.T, so u → 1 as T → Tc and the box runs at T* = 0.45, P* = 0.3.
  - **Supercritical side:** just past Tc the box runs at T* = clamp(0.85·T/Tc) ≥ 0.85 and P* ≥ 0.35.
  - **Effect:** the box's temperature roughly doubles across a line that is not a phase boundary. That takes the box far above its own critical point (T* ≈ 0.46), so the liquid will visibly expand. That last step is inferred from the code (about 80% confident); the jump in settings is certain.
  - **Fix:** blend between the liquid and gas settings around the critical point, so the box goes round its own critical point too:
    ```ts
    case 'supercritical': {
      const a = T / critical.T - 1;               // ≥ 0
      const b = Math.log10(P / critical.P);       // ≥ 0
      const w = a + b === 0 ? 0.5 : a / (a + 0.2 * b); // 1 on the P = Pc edge, 0 on the T = Tc edge
      const gasT = clamp(s.gas * (T / critical.T), s.gas, s.gasMax);
      const gasP = clamp(s.gasP * (P / critical.P), s.gasP, 2 * s.condensedP);
      return { phase, solid: false,
        T: s.liquid[1] + (gasT - s.liquid[1]) * w,
        P: s.condensedP + (gasP - s.condensedP) * w };
    }
    ```
    The P = Pc edge already matches the gas case (T* = 0.85·T/Tc, P* = 0.35). Re-run the box tests after the change.
- **medium** — mapping.ts:106–119 and steps.ts:143 (squeeze step): the gas runs above the box's own critical temperature on purpose ("so it cannot condense by itself"). So squeezing at 0 °C never condenses the box. It condenses only because its temperature drops from about 0.87 to 0.42–0.45 when the dot crosses 34.4 atm. The text's mechanism ("the molecules come closer together… the attraction wins… without touching the temperature") is true of real CO₂, but not of what the box does. At minimum, add a note to the squeeze step: "In the box, crossing the line also cools the box's own temperature, because a gas of 80 molecules in a flat world held at the box's gas temperature cannot condense. Real carbon dioxide condenses at a steady 0 °C, giving off its latent heat." The better fix is to run near-boiling gas below the box's critical temperature, with the piston pressure scaled to the box's own boiling pressure, so that squeezing really does condense it.
- **low** — BoxScene.svelte:353 vs EnergyPanel.svelte:4–6 and :86: the panel says it draws the box's *measured* kinetic energy, but it is passed `sp.T`, the target temperature. Fix: `<EnergyPanel kinetic={frame.kinetic} phase={sp.phase} />`. That value is the mean translational kinetic energy, which equals k_B·T in 2D, as the notes say.
- **low** — the tests (e2e/states-of-matter-model.e2e.ts) check the phase lines against the reference values and check order and density in the box, which is good. Nothing checks that the mapping is continuous where no phase line exists. Add: `setpointFor('co2', Tc − 0.01, 100 atm)` vs `setpointFor('co2', Tc + 0.01, 100 atm)` should differ by < 0.05 in T* and P*. Also add a squeeze test: CO₂ at 0 °C and 40 atm ends up condensed (free < 0.1).

## Narrative and scene mismatches
- **high** — steps.ts:158 (diagram notes): "In the box the change at the critical point looks sharper than it really is: 80 molecules are too few to show the gradual change." The sharp change comes from the mapping (see Model issues). Small systems, if anything, blur transitions rather than sharpen them. After the mapping fix: "The box takes the same path round its own critical point, so it changes gradually there too." If the mapping is left as it is: "The box cannot follow this path: when the dot crosses the dashed line, the box's own temperature jumps, so it seems to boil. That is a limit of the simulation; real carbon dioxide changes smoothly."
- **medium** — steps.ts:131: "The dot is the box's temperature and pressure" contradicts the same step's note (steps.ts:132: "The box can't run at those"). Fix: "The dot is the temperature and pressure you have set; moving the slider moves it sideways." Likewise steps.ts:77 ("presses down on them with that pressure") could add "(in the box, a scaled-down pressure that gives the same state; see the notes in Changing state)".
- **low** — DiagramPanel.svelte:5 says "with the box's temperature and pressure as a dot"; it is the reader's real temperature and pressure. Fix the comment.

## Catalogue requirements
- **medium** — the takeaway "water is unusual because its solid is less dense than its liquid" depends on the piston sinking below the dashed `iceLine` (BoxScene.svelte:213–223). That line has no label, so without the text the reader cannot tell what it means. Add `<Label x={BX + BW + 12} y={iceLine + 4} text="ice level" size={11} anchor="start" muted />`.
- The rest is met: temperature and pressure controls, freeze, melt, boil and condense, the phase diagram, and the water lattice (the freezing shortcut is stated on the page). The entry has no Needs or Pitfall field.

## Clarity
- **low** — steps.ts:116: the attraction is likened to "the slightly charged ends of polar molecules". A level-1 reader who has just read Chemical bonds knows CO₂ is non-polar and may be confused. Fix: "Molecules attract each other weakly when they are close (even non-polar ones like carbon dioxide, whose electrons shift for an instant to make fleeting charged ends), but more weakly than the polar molecules in Chemical bonds."
- **low** — steps.ts:181: "a bond forms only when an arm points straight at a neighbour". The model needs an arm of *each* molecule pointing at the other. Fix: "…forms only when an arm of each molecule points straight at the other."

## Sources consulted
- R. Rosenberg, "Why is ice slippery?", Physics Today 58(12), 50 (2005): https://physicstoday.aip.org/features/why-is-ice-slippery
- IAPWS R14-08(2011), melting and sublimation curves: https://www.iapws.org/relguide/MeltSub2011.pdf
- Span & Wagner (1996) CO₂ constants (triple point 216.592 K, 517.95 kPa; critical point 304.1282 K, 7.3773 MPa): https://www.cc.kyushu-u.ac.jp/scp/system/library/PROPATH/manuals/p-propath/co2_sw.pdf
- Smit & Frenkel, J. Chem. Phys. 94, 5663 (1991): https://pubs.aip.org/aip/jcp/article/94/8/5663/442120/Vapor-liquid-equilibria-of-the-two-dimensional
- Mean free path of air (about 68 nm, about 200 diameters): https://www.firgelliauto.com/blogs/engineering-calculators/mean-free-path-calculator
- I recomputed the boundary equations independently (the Wagner–Pruß, Span–Wagner and IAPWS R14 equations as coded) to check every number quoted in the narrative.
