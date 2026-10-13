<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.58 in tokens + 10 web searches -->
# Review: newtons-laws

## Verdict
The page is ready after the fixes below. Every fact, number and formula I checked is correct. I re-ran the model independently: 6 N on 2 kg gives 3 m/s²; the friction readouts show 0.98 N and 0.49 m/s²; the vacuum range, peak height and flight time formulas are right. With drag, the best angle at 30 m/s and k = 0.05 comes out at 36°, which matches "mid-30s". The default track with μ = 0.08 does trap the car in the valley at x ≈ 5 m, as the narrative says. Nothing on the page is wrong; the issues are in the model's honesty and the tests. The most important fix: `ride()` computes heat as whatever energy is "missing", so the "total never changes" bar is true by construction rather than shown by the model, and the matching test cannot fail. Compute heat as the work done by friction instead.

## Factual errors
- **low** — steps.ts:155. "For two thousand years, since Aristotle, the answer seemed obvious" leaves out impetus theory (Philoponus, Buridan), which already rejected the idea that a moving body needs a mover in contact with it. This is acceptable at level 1, but a softer wording is more accurate: "For nearly two thousand years after Aristotle, most thinkers held that moving things naturally slow down and stop, so something must keep them going." (https://en.wikipedia.org/wiki/Inertia ; https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/aristotelian-physics-impetus-theory-and-mean-speed-theorem)
- **low** — steps.ts:286. "Together with the conservation of momentum, it lets us predict how a motion ends — a crash, a ride — without following every force" claims too much. For a crash you also need the bounciness, and for a ride with friction, energy alone does not tell you where the car stops. Suggested replacement: "…it lets us work out a lot about a motion — the speed at any height on a frictionless track, or what a crash must conserve — without following every force along the way."

Otherwise the facts check out: the three laws, the newton, the apple ≈ 1 N, R = v² sin2θ/g, T = 2v sinθ/g, H = v² sin²θ/(2g), the 45° optimum, the meaning of restitution, the maximum loss in a sticky crash, and the shape of a drag trajectory.

## Model issues
- **medium** — physics.ts:320–322, TrackScene.svelte:147, e2e/newtons-model.e2e.ts:89–90. Heat is defined as `E0 − KE − PE`, so the test `(KE + PE + dissipated)/e0 ≈ 1` passes whatever the friction term does. A wrong sign or a missing cos would never be caught.
  - Fix: build up the friction work inside the RK4 loop, for example `dissipated += mu*m*G*Math.abs(v)*dt/Math.sqrt(1+s*s)` (or with RK4 weights). Use that value in the scene. Keep the residual only as a check: `expect(Math.abs(e0 - s.kinetic - s.potential - s.dissipated)/e0).toBeLessThan(0.005)`.
  - In my port the two quantities agree to about 1e-6 on the default track, so this change will not alter what the reader sees.
- **low** — CartsScene.svelte:238–249. The spring is modelled as a constant 3.33 N for 0.3 s whatever the masses, so every pair gets momentum 1.0 kg·m/s. A real squashed spring stores a fixed amount of energy: its force falls as it extends, and both its impulse and its duration depend on the masses. The lesson is unaffected (equal and opposite forces, speed ∝ 1/m), but the "3.33 N for 0.3 s" readout is an invented constant. Either:
  - model Hooke's law (relative motion is simple harmonic with reduced mass μ = m1m2/(m1+m2); push time = (π/2)√(μ/k)), or
  - say so on the page: add to the `pair` step notes "The spring here is simplified to push with a steady force for 0.3 s."
- **low** — TrackScene.svelte:49. The fallback `params.mu ?? 0.04` disagrees with the control default of 0.08 (steps.ts:128). Use `?? 0.08`.
- **low** — e2e tests. Two things are not tested:
  - The page's claim that drag lowers the best angle to the mid-30s. Add `expect(bestAngle(30, 0.05)).toBeGreaterThanOrEqual(34); expect(bestAngle(30, 0.05)).toBeLessThanOrEqual(38);` (the model gives 36).
  - The static-friction "does not move" case. Add `expect(push(5, 2, 1, 0.05).a).toBe(0)`.

## Narrative and scene mismatches
- **low** — steps.ts:171. "Switch friction on and it slopes back down to zero" is not always true on the 10 s graph. For light carts with strong pushes (e.g. 20 N on 0.5 kg the speed is 39.5 m/s and friction takes about 80 s to stop it), the curve barely slopes and never reaches zero. Fix: "…it slopes back down towards zero: friction is now the only force."
- Everything else matches: quoted numbers, the 1/3 speed ratio, the equal-mass swap, a light cart bouncing back, the 45° marks, the asymmetric drag path (apex at 12.1 m of 22.4 m range, landing at 54°), and turning points that get lower each time.

## Catalogue requirements
- **low** — physics.ts:11–13. Track friction is taken as μ·m·g·cos(slope), ignoring the extra grip from curvature. The file comment says this simplification is "stated on the page", but the `heat` step has no note saying so. Add to that step: `notes: '<p>Friction here is taken as μ × weight × cos(slope); the extra push of the rails in dips and over crests is ignored.</p>'`.
- Apart from that, the Interaction is built as written (projectile with speed, angle and air; carts of different mass pushed and collided; editable track with kinetic, potential and heat bars), and the Takeaway is visible in the graphics. No Pitfall or Needs fields apply.

## Clarity
- **low** — steps.ts:156. "switch it on and the same push dies away" is odd: the push has already ended, and it is the motion that dies away. Fix: "switch it on and, after the same push, the cart slows and stops."
- **low** — steps.ts:284. "each hill it climbs is a little lower than the last" reads as if the hills themselves shrink. Fix: "each time it climbs, it gets a little less high than the time before."

## Sources consulted
I checked the drag claims, the best angle and the track behaviour by re-running the page's own equations.
- https://www.grc.nasa.gov/www/k-12/BGP/newton2.html (second law)
- https://www.grc.nasa.gov/www/k-12/WindTunnel/Activities/first2nd_lawsf_motion.html (first law)
- https://www.nist.gov/pml/special-publication-330/sp-330-section-2 (SI units, the newton)
- https://physicsfundamentals.org/blog/projectile-motion-range (range formula, 45°)
- https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/ (drag ∝ v²)
- https://en.wikipedia.org/wiki/Coefficient_of_restitution (restitution as separation ÷ approach speed)
- https://en.wikipedia.org/wiki/Inelastic_collision (sticky crash loses the most kinetic energy)
- https://en.wikipedia.org/wiki/Inertia ; https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/aristotelian-physics-impetus-theory-and-mean-speed-theorem (history of inertia, impetus theory)
