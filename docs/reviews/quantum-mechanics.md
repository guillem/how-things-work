<!-- batch msgbatch_01EjzxvBTpHfuetSeN7qT1HL, claude-opus-5-5, submitted 2026-10-14T08:30:20.979Z, ~$0.98 in tokens + 12 web searches -->
# Review: quantum-mechanics

## Verdict
The page is ready once the fixes below are made. I checked almost every number in the text against the model, and wrote my own copy of the tunnelling and slit solvers to compare against. The 27% and 2.5% tunnelling figures, ÷2.8 per 0.1 nm, κ = 5.1 and 10.9 nm⁻¹, the ~9× STM factor, 590 km/s, 1.226 nm, 50 pm at 600 V, E₁ = 0.38 eV, the 3.7 fs sloshing period, ±0.13 eV and the factor of 43 for a proton all check out. So do the "about 1%" agreement between simulation and packet average and the constants in quantum.ts. The most important fix is in the free-packet scene. Its 2048-point grid wraps around, so a spreading packet loops back on itself. That makes the "spread σ" readout and the ±σ bar wrong by up to 119%, and this happens on exactly the step that tells the reader "Make it narrower and watch it spread faster".

## Factual errors
- **Medium**, steps.ts:257. "so V² + D² = 1: the duality relation of Englert (1996)". Englert's relation is an inequality. The fringe visibility in a two-way interferometer sets an absolute upper bound on the amount of which-way information that is potentially stored in a which-way detector. It becomes an equality only for pure detector states, which is what the model uses. **Fix:** "so V² + D² ≤ 1, with equality for pure detector states like the ones modelled here: the duality relation of Englert (1996), …". Source: https://doi.org/10.1103/physrevlett.77.2154
- **Low**, steps.ts:194. "molecules of hundreds of atoms" understates the record: 2000 atoms in two places at once: A new record in quantum superposition (Fein et al., 2019). **Fix:** "…neutrons, atoms and molecules of up to about 2,000 atoms too." Source: https://www.nature.com/articles/s41567-019-0663-9
- **Low**, steps.ts:194. The sentence goes straight from Jönsson (1961) to Tonomura (1989), which suggests Tonomura was the first to record single electrons. In fact the Merli–Missiroli–Pozzi experiment was a physics experiment conducted in 1974 that provided the first conclusive evidence of electron interference involving the detection of single electrons. **Fix:** "…in 1974 Pier Giorgio Merli, Gian Franco Missiroli and Giulio Pozzi recorded single electrons building up the fringes, and in 1989 Akira Tonomura's team at Hitachi filmed it dot by dot (both with an electron biprism…)". Source: https://en.wikipedia.org/wiki/Merli%E2%80%93Missiroli%E2%80%93Pozzi_experiment
- **Low**, steps.ts:330. "every interpretation gives the same predictions" is too strong. Objective-collapse models predict deviations, and large-molecule experiments exist precisely to constrain possible modifications to quantum mechanics. **Fix:** "…but the standard interpretations all give the same predictions (proposed modifications that make collapse a physical process are being tested): Born's rule, which is what the counts test." Source: https://www.nature.com/articles/s41567-019-0663-9
- **Low**, steps.ts:241. "big objects never show fringes" sits awkwardly next to 2,000-atom molecules that do. **Fix:** "That is why everyday objects never show fringes: …".

## Model issues
- **High**, PacketScene.svelte:58 (`const g = grid(2048, 0.05)`). The grid spans only ±51.2 nm and is periodic. The animation runs until the packet's centre reaches x = 36 nm, so a wide or fast-spreading packet wraps around the edge. `moments` then counts the wrapped tail at x ≈ −51 instead of x ≈ +53. I compared `moments` against the exact σ(t) on this grid:
  - default settings (1 eV, σ₀ = 1 nm), at the end of the loop: the readout shows 5.75 nm instead of 4.98 nm;
  - 1 eV, σ₀ = 0.4 nm: 26 nm instead of 12 nm, and the ⟨x⟩ dot sits at 25 nm instead of 36 nm;
  - worst error over the slider ranges: 119%.
  
  The total-probability readout still shows 1.0000, so nothing on screen reveals the problem. **Fix:** `const g = grid(8192, 0.05);`. Over the whole energy × σ₀ range this gives a worst error of 5×10⁻⁹, and the cost is one 8192-point FFT pair per frame. Also add a test that `moments(freeEvolve(...)).spread` matches `freeSpread` across the scene's slider ranges up to `loopT`, and change the note at steps.ts:273 from "1024 to 2048 points" to "1024 to 8192 points".
- **Low**, BarrierScene.svelte:92, 162 and 208. Three code comments no longer match the code:
  - line 92 says "the winner shrinks to a dot", but only the losing side fades;
  - line 162 says "log10 |ψ|² from −6 to 0", but the code clamps to −4…1;
  - line 208 says "10³ (top) to 10⁻³", but the axis runs from 10² to 10⁻⁵.
  
  **Fix:** update the three comments.

Everything else in the model checks out. My independent copy of `tunnel`, `barrierT`, `packetT` and `slits` reproduces its numbers, and it behaves well at E = V₀, with wide barriers above the energy (no probability left inside), and with V₀ = 0. The paraxial slit model is sound: for symmetric slits, the Fresnel phase is shared by both slits, so cos² fringes λL/d apart hold even at λL = d².

## Narrative and scene mismatches
- **Medium**, steps.ts:254. "Their visibility is exactly the overlap γ" doesn't match the panel, which shows both numbers. Because the single-slit envelope dips at the dark fringes, the measured visibility comes out larger than γ. For example, at D = 95% the panel reads visibility 0.33 next to γ = 0.31, and at D = 80% it reads 0.61 next to 0.60. **Fix:** "Their visibility follows the overlap γ of the detector's two states (it equals γ wherever the two waves arrive equally strong; the readout differs slightly because the single-slit hump fades towards the dark fringes):".
- **Low**, steps.ts:314–316. "the curve is a straight line" and "Raise the barrier and the line gets steeper" only hold for V₀ > 1 eV, but the height slider on this step goes down to 0, where the curves become oscillating near 1. Separately, the "÷ 2.8" readout comes from the dashed plane-wave curve, while the solid packet curve and the simulated dot fall by about 2.7 per 0.1 nm. **Fix:** "Away from the thinnest barriers, and as long as the barrier is higher than the electron's energy, the curve is a straight line, …" and label the readout "each extra 0.1 nm (plane wave, thick barrier)".
- **Low**, BarrierScene.svelte:342 and 487. "right: it tunnelled" and "share of |ψ|² that tunnelled" are wrong when the reader lowers the barrier to 1 eV or below: the electron then goes over, not through. **Fix:** use `V0 > E ? 'it tunnelled' : 'it got through'` and "share of |ψ|² that got through".

Everything else matches: each number the text quotes is what the readouts show at the default settings.

## Catalogue requirements
All met:
- **Interaction:** single dots build up into fringes, the which-slit detector removes them, and height and width sliders control a simulated packet tunnelling through the barrier.
- **Takeaway:** the slit amplitudes and the measure step show it in the graphic itself.
- **Pitfall:** avoided. A detector whose record nobody reads still removes the fringes, and the text says the cause is the record, not anyone looking.

## Clarity
- **Low**, steps.ts:302. "even a dip in the barrier's height reflects a little" is ambiguous: "dip" sounds like a well. **Fix:** "even a barrier lower than the electron's energy reflects a little of the wave, which a ball rolling over it would never do."
- **Low**, steps.ts:303. "V₀² sinh²(κa)/4E(V₀ − E)" can be misread. **Fix:** "T = 1/[1 + V₀² sinh²(κa) / (4E(V₀ − E))]".
- **Low**, steps.ts:273. "Each step only turns complex numbers, so their lengths … are kept exactly" is not true point by point: the kinetic step changes |ψ(x)|, and it is the lengths of the wavelength components that stay fixed. **Fix:** "Each step only turns complex numbers (point by point, or wavelength by wavelength), so the total probability is kept exactly."

## Sources consulted
- Englert, PRL 77, 2154 (1996): https://doi.org/10.1103/physrevlett.77.2154
- Fein et al., Nature Physics (2019): https://www.nature.com/articles/s41567-019-0663-9 ; https://phys.org/news/2019-09-atoms-quantum-superposition.html
- Merli–Missiroli–Pozzi experiment: https://en.wikipedia.org/wiki/Merli%E2%80%93Missiroli%E2%80%93Pozzi_experiment ; https://link.springer.com/article/10.1007/s00016-011-0079-0
- Tonomura et al., Am. J. Phys. 57, 117 (1989), DOI 10.1119/1.16104: https://www.semanticscholar.org/paper/fc2afdc4a027fce366ffa105bd88439760d22546
- Jönsson, Z. Phys. 161, 454 (1961): https://link.springer.com/chapter/10.1007/978-3-540-70626-7_56
- Bach et al., NJP 15, 033018 (2013), which confirms the 600 eV / 272 nm scales: https://iopscience.iop.org/article/10.1088/1367-2630/15/3/033018
- STM at IBM Zurich, 1981: https://technav.ieee.org/topic/tunneling/
- CODATA constants: https://physics.nist.gov/cgi-bin/cuu/Results?search_for=planck
- My own NumPy copy of `tunnel`, `barrierT`, `packetT`, `slits` and `freeEvolve`, used to check the quoted numbers, the visibility against γ, and the grid wrap-around.
