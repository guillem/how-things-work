<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.61 in tokens + 12 web searches -->
# Review: entropy

## Verdict
The page is ready once the fixes below are made. I checked every number and named fact: they are right. The physics in the model is also right: the bit-reversible leapfrog integrator, the C(N,k) count of positions, the C(q+n−1,q) count of energy shares, and the claim that this energy count becomes exact for discs moving in a plane. The page is built as the catalogue entry describes, and it avoids the "disorder" pitfall. **The most important fix** is in the "Counting ways to share energy" step. When the two groups have different numbers of particles, the curve's peak is labelled "equal temperatures", but the readout under the handle shows two clearly different temperatures (2.0 and 2.5 for 5 against 100 particles). The text promises the opposite. The cause is that the scene computes temperature as energy ÷ n, while the counting puts the peak where energy ÷ (n − 1) is equal.

## Factual errors
I found no errors. These all check out:
- 137,846,528,820 = C(40, 20).
- 2⁸⁰ ≈ 1.2 × 10²⁴.
- 2.5 × 10²² molecules in a litre of air (Loschmidt constant 2.687 × 10²⁵ m⁻³ at 0 °C).
- 2^(2.5×10²²) = 10^(7.5×10²¹), and "seven and a half thousand billion billion digits".
- Average kinetic energy is k_BT in 2D.
- Boltzmann's tombstone in Vienna carries S = k log W.
- Loschmidt raised the reversibility objection in 1876.
- Levesque & Verlet, J. Stat. Phys. 72, 519 (1993).

- **low**, steps.ts:184: "we remember the past and not the future because the past had lower entropy" is stated as settled fact. It is a widely held view, not an established result. Fix: "…and many physicists think this is also why we remember the past and not the future: the past had lower entropy."

## Model issues
- **medium**, CountScene.svelte:170 (`tempOf`) together with :450. The counting gives Ω ∝ E^(n−1), so the most likely share is where q/(n−1) is equal on both sides. The thermodynamic temperature of this count is also E/(n−1) (1/kT = d ln Ω/dE). But `tempOf` uses q/n. I computed the readout at the peak:
  - 5 vs 100 particles: 2.03 and 2.52
  - 10 vs 100: 2.29 and 2.52
  - 20 vs 100: 2.42 and 2.52

  Fix (it gives exactly 4.0 and 1.0 at the 40/40 start and exactly equal values at the peak; the largest error at the peak is 0.01, at 5 vs 100):
  ```ts
  const tempOf = (q: number, n: number) =>
  	((2.5 * q) / (PACKETS_PER_PARTICLE * (n - 1))) * ((nL + nR - 2) / (nL + nR));
  ```
  Then add to the notes at steps.ts:146: "For a small group the temperature is set by its energy divided by one less than its number of particles; for large groups this is the same as the energy per particle." The arXiv paper by Hilbert, Hänggi and Dunkel listed under Sources discusses how definitions of temperature differ for small isolated systems.
- **low**, BoxScene.svelte:220–222. The drawn wall shrinks during the 0.45 s *before* `wallUntil`, but the physical wall is still full height until `wallUntil`. Particles can be seen bouncing off a gap. Fix: `smoothstep(wallUntil, wallUntil + 0.3, elapsed)`, or remove the physical wall at `wallUntil − 0.45`.
- **low**, e2e/gas-model.e2e.ts:109. `toBeCloseTo(2.45, 0)` passes for any value from 1.95 to 2.95, so it does not check the 2.45 that the notes quote. Fix: `toBeCloseTo(2.45, 1)`.
- **low**, tests. No test checks a real equilibrium property of the gas, and none checks what the energy scene displays at its peak. Two tests to add:
  - After mixing, the kinetic energies of single particles should follow the 2D Maxwell–Boltzmann law. That law is exponential, so the mean and the standard deviation of KE should both be about 2.45·E0.
  - `tempOf` should give equal values (within 0.02) at `mostLikelyShare(nL, nR, Q)` for (5, 100) and (20, 60).

## Narrative and scene mismatches
- **medium**, steps.ts:145. "The peak is where the energy per particle is (very nearly) the same on both sides … Give the two sides different numbers of particles: the peak moves, but it still sits at equal temperatures." With 5 vs 100 particles the energy per particle is 40.8 against 50.5 packets, which is not "very nearly" the same. Once the model fix is in, replace with: "The peak is where the two sides have the same temperature; for groups of more than a few dozen particles, that means very nearly the same energy per particle. Give the two sides different numbers of particles: the peak moves, but it still sits at equal temperatures." Alternatively, raise `countLeft.min` to 20 (steps.ts:55); 5 vs 100 is where the mismatch is worst. Also align the clamp in CountScene.svelte:155–156 (`2`) with the control's minimum.
- **low**, steps.ts:183. "move one particle by a billionth of the box": the nudge is measured in box *heights* (gas.ts:76), and the box is 2 × 1. Fix: "a billionth of the box's height". At steps.ts:82, use `` `10${sup(v)} of the box height` ``.

Everything else matches: the 2.5 / 2.45 temperatures, the "ten million times" figure (10^7.37 in the share scene, 10^7.56 at the box's maximum), the reversal 8 s after the lift with the return at 17 s, and the nudged run failing to return.

## Catalogue requirements
All met. The wall lifts and the temperatures equalise; the arrangements are counted for positions and for energy; the film runs backward exactly and with a nudge. The takeaway is visible in the entropy chart and the microstate readout. Entropy is defined by counting microstates, and "disorder" is explicitly dismissed. The level suits the entry.

## Clarity
- **low**, steps.ts:133. "the same count as for the paths through a Galton board" points to central-limit-theorem, which is not a prerequisite. Fix: append "(see Distributions & the central limit theorem)", or drop the clause.
- **low**, steps.ts:132. "The particles wander at random among all these arrangements": the motion is deterministic, which the arrow-of-time chapter relies on. Fix: "The collisions shuffle the particles so thoroughly that they wander, in effect at random, among all these arrangements…"
- **low**, BoxScene.svelte:439 and :570. The chart's y-axis shows ΔS/k_B ≈ 17, while the readout shows "× 3.6 × 10⁷". Nothing tells the reader that one is the natural log of the other. Fix: add a muted line under the readout, e.g. `` `ΔS ÷ k_B = ln(${ratioText(log10Now)}) = ${sNow.toFixed(1)}` ``.

## Sources consulted
- Levesque & Verlet, "Molecular dynamics and time reversibility", J. Stat. Phys. 72, 519–537 (1993), as cited in https://arxiv.org/html/2402.12910 and https://link.springer.com/article/10.1007/BF02188699
- Loschmidt's 1876 objection: https://arxiv.org/pdf/physics/9803005
- Boltzmann's tombstone, S = k log W: https://www.atlasobscura.com/places/boltzmanns-grave and https://arxiv.org/pdf/1408.5382 (the latter also covers how temperature definitions differ for small systems)
- Loschmidt constant (CODATA 2022): https://physics.nist.gov/cgi-bin/cuu/Category?view=pdf&Physico-chemical=
- Einstein-solid multiplicity C(q+N−1, q) and two interacting systems: https://ccrgpages.rit.edu/~whelan/courses/2004_1sp_A410/notes02.pdf
- Equipartition (k_BT/2 per translational degree of freedom): https://vallance.chem.ox.ac.uk/pdfs/Equipartition.pdf
- I checked these numerically myself: C(40,20); 2⁸⁰; log₁₀ 2^(2.5×10²²) = 7.53 × 10²¹; the peak-to-start ratio of the share curve (10^7.37 at 40/40); the peak positions and readout temperatures for 5/100, 10/100, 20/100 and 20/60, with the current and the proposed `tempOf`.
