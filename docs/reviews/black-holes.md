<!-- batch msgbatch_01LGjXyQnqK5NGi93Qq53u3f, claude-opus-5-5, submitted 2026-10-12T07:08:43.743Z, ~$0.92 in tokens + 13 web searches -->
# Review: black-holes

## Verdict
The page is ready after the fixes below. The geodesic tracer is correct. I checked it against closed forms and spot-checked it numerically: the critical impact parameter is √27, light is captured or escapes correctly down to 10⁻¹⁰ r_s off the critical aim, the 1.75″ solar bending, the 43″ for Mercury, the ISCO and the shadow sizes all come out right. Almost all the quoted numbers check out too. **The most important fix is the probe step.** The "launch speed" slider actually sets angular momentum, and the headline claim depends on that mismatch. The text says that at 4 r_s Newton predicts escape but the real probe is held. But a probe really launched at 1.5× Newton's circular speed, measured on the spot, escapes in general relativity as well. Second, the GPS sentence repeats the "positions drift km a day" claim that the catalogue (gps pitfall) flags as misleading. Three smaller factual fixes: what is inside 1.5 r_s, the M87* mass being circular, and Le Verrier's 38″.

## Factual errors
- **high**, steps.ts:286: "Without correction, positions would drift by kilometres a day." This is the claim the catalogue's gps Pitfall forbids. The shared offset only corrupts the ranges. A receiver that solves for its own clock absorbs it, so the position barely moves and the time is wrong. Fix: "Uncorrected, the net gain of about 38 µs a day would add about 11 km a day to every measured satellite range." Source: Ashby 2003, https://link.springer.com/article/10.12942/lrr-2003-1, and the catalogue's gps entry.
- **high**, steps.ts:271: "inside 1.5 r_s no circular orbit exists at all: only light could go round there." This is wrong. Light can circle only *at* 1.5 r_s, and inside it nothing can circle, not even light. Fix: "And at 1.5 r<sub>s</sub> only light can go round in a circle; inside that, nothing can, not even light."
- **medium**, steps.ts:328 and 330, LensScene.svelte:428, blackhole.ts:55–59: "Both match the shadow size Einstein's equations predict for their masses." For M87* this is circular. The 6.5 ± 0.7 billion is the EHT's own mass, inferred *from* the ring (Paper VI). The independent estimate is stellar dynamics: Gebhardt et al. 2011 found 6.6 ± 0.4 × 10⁹ M☉ at their adopted distance, about 6.2 × 10⁹ rescaled to 16.8 Mpc. Fix (notes): "M87*: the motions of its stars give about 6.2 billion solar masses at 55 million light years, predicting a shadow of about 38 µas. The ring is 42 ± 3 µas, and the EHT's own fit to it gives 6.5 ± 0.7 billion." Make the matching change in the card text and the M87 constants. Sources: https://iopscience.iop.org/article/10.3847/2041-8213/ab1141 and https://www.sciencenews.org/article/m87-black-hole-image-best-mass-estimates-star-motion
- **medium**, steps.ts:246 and blackhole.ts:69–70: the text implies Le Verrier measured the 43″ anomaly in 1859. He found 38″ per century; the 43″ value is Newcomb's (1882). Fix: "the anomaly that had puzzled astronomers since Urbain Le Verrier found it in 1859 (he put it at 38″; the modern value is 43″)". Source: https://www.pbs.org/wgbh/nova/article/hunt-for-vulcan/
- **low**, steps.ts:189: "expeditions led by Frank Dyson and Arthur Eddington". Dyson organised the expeditions but did not go. Eddington and Cottingham went to Príncipe; Crommelin and Davidson went to Sobral. Fix: "expeditions organised by Frank Dyson and Arthur Eddington". Sources: https://www.royalobservatorygreenwich.org/articles.php?article=1283 and https://arxiv.org/pdf/2002.01179
- **low**, steps.ts:272: "heating up to millions of degrees" holds for star-sized holes. Disks around giant holes peak at about 10⁵ K. Fix: "heating up to millions of degrees around star-sized holes (hundreds of thousands around giant ones)". Source: https://arxiv.org/pdf/1709.02845
- **low**, steps.ts:271 (the `dfn` for ISCO): "the slightest disturbance sends the body into the hole" is too strong. A small outward or faster nudge instead sends the body out onto a wide orbit, which is bound or unbound depending on the radius. Fix: "...the slightest disturbance moves the body away from its circle for good, and a slight slowing sends it into the hole."
- **low**, RaysScene.svelte:749: "as a bullet: 0.87″". Half of 1.7505″ is 0.875″, which usually rounds to 0.88″. Fix: compute it, or write "0.88″".

## Model issues
- **high**, RaysScene.svelte:80, steps.ts:96–106 and 258: `L = probeK · √r0` sets the angular momentum, but the slider calls it a speed. For tangential launch L = r·γv, so at 4 r_s with k = 1.5 the locally measured speed is 0.469c, which is 1.32× Newton's circular speed, not 1.5×. With the stated speed, 0.53c, the probe is above the local escape speed √(2GM/r). That escape speed is the same in GR and Newton, and I traced it: the probe escapes. The claim "Newton still says it escapes, but the real probe is held" is an artefact of the convention.
  - Code fix: `const v = probeK * Math.sqrt(1 / r0); const L = (r0 * v) / Math.sqrt(1 - v * v); const LN = r0 * v;` then use `LN` for `newtonU`, `p` and `ecc`.
  - Text fix (steps.ts:258), checked with the tracer at r0 = 8: k = 1.0 and 1.1 are captured, 1.15–1.40 stay in orbit, 1.42 and 1.5 escape. Suggested wording: "Closer still, the difference is not small at all. At 4 r<sub>s</sub>, a probe launched at exactly Newton's circular speed does not circle: it dives into the horizon. It needs about 1.15 times that speed to stay in orbit. Only the escape speed, √(2GM/r) measured on the spot, is the same in both theories."
- **medium**, LensScene.svelte:183 and blackhole.ts:344: the lens map uses b = D sin θ. That is inconsistent with `shadowAngle`, which uses the static-observer relation sin θ = b√(1 − 2/D)/D. At D = 60 the two differ by 1.7%: the painted shadow edge sits at 0.0867 rad while `shadowAngle` gives 0.0853. On top of that, the full bending α(b) is applied, although the ray stops at the camera. The leftover after the camera is about b/D², roughly 1–2% at the ring. The card's "exact bending of every ray" (LensScene.svelte:415) is therefore overstated.
  - Minimal fix: `const b = D * Math.sin(th) / Math.sqrt(1 - 2 / D);`, in both `skyAngle` and the painter.
  - Exact fix: tabulate the sky direction against θ with `flashRay(D, π − θ)`. It already handles a static observer at finite r.
  - Alternatively, change the card to "bending traced exactly; camera treated as distant".
- **medium**, e2e/black-holes-model.e2e.ts:184–187: the M87 test is circular for the same reason as the M87 text above. Test against the stellar-dynamics mass instead, about 6.2 × 10⁹ at 16.8 Mpc, and allow for the ring being about 5–10% larger than the shadow.
- **low**, blackhole.ts:225: "aberration from the lamp's acceleration". Aberration comes from the static observer's velocity relative to free fall, not from acceleration. Fix: "measured by a lamp held at rest (a static observer)".

Everything else in the model matches the reference. I checked the orbit equations, E, dτ and dt, `circularL`, `clockRate`, `escapeCone`, `shadowAngle`, the weak-field series 4/b + 15π/4b², the ISCO threshold (the "tips in at 3.1 r_s" claim holds; the capture band reaches 3.25 r_s) and the loop count of about 1.1 loops per 3 digits.

## Narrative and scene mismatches
- **medium**, RaysScene.svelte:796–807 vs steps.ts:229: "Directions that escape" shows the in-plane fraction (cone/π), while the text talks about "half the sky". The two agree only at 1.5 r_s. At 1.02 r_s the readout says 12% where the true share of the sky is 3%; at 4 r_s it says 81% where the sky share is 91%. Fix: relabel the rows "Directions in this plane that escape" and "...that fall in". Or show the sky share, `(1 − cos(cone))/2`.
- **low**, ClockScene.svelte:75–91: the "far away" clock is drawn at the cable top, y = 110, which is about 6.4 r_s on the height scale. Its rate there would be 0.92, and the flash keeps reddening along the horizontal leg, although at constant height nothing changes. Fix: label the clock "far away (not to scale)" and cut the height marks with a break symbol, or keep the flash colour constant on the horizontal leg.
- **low**, ClockScene.svelte:300 and steps.ts:299: the scene shows a *held* clock, but the card says a "falling clock slows, reddens". A falling clock's light also carries a Doppler shift. Fix: add to the notes "the numbers shown are for a clock held in place; a falling one reddens faster still, but fades out the same way."
- **low**, GlobeScene.svelte:180: the readout "2,224 km" uses a comma as thousands separator, while every other scene uses spaces; the text says 2 200. Fix: use `.replace(/,/g, ' ')`, as in SwapScene.

## Catalogue requirements
All are met:
- the interaction is built as written: fire rays and probes, bend, loop or capture; lower a clock; a star field with lensing;
- the takeaway is visible in the flash and shadow scenes;
- the "does not suck" pitfall is handled explicitly by the swap scene.

The only conflict is with a related entry: the GPS sentence contradicts the gps Pitfall (see Factual errors).

## Clarity
- **medium**, steps.ts:186–190: the bending step's slider and readouts use r_s already, but the body never defines it; only the Go-deeper note does. Fix: add to the body "Distances are measured in r<sub>s</sub> = 2GM/c², a length set by the mass (3 km for the Sun), explained in the next step."
- **low**, all scenes: labels show the raw string "r_s", e.g. "2.6 r_s", "6 r_s", "photon sphere 1.5 r_s". Fix: use "rₛ" (U+209B), or render the s as a subscript `tspan`.

## Sources consulted
- N. Ashby, Relativity in the Global Positioning System, Living Rev. Relativ. 6, 1 (2003): https://link.springer.com/article/10.12942/lrr-2003-1
- EHT Collaboration 2019, Paper VI (shadow and mass of M87*): https://iopscience.iop.org/article/10.3847/2041-8213/ab1141
- Science News on M87* mass versus stellar dynamics: https://www.sciencenews.org/article/m87-black-hole-image-best-mass-estimates-star-motion
- NOVA, "The Ninth Planet That Wasn't" (Le Verrier's 38″): https://www.pbs.org/wgbh/nova/article/hunt-for-vulcan/
- Royal Observatory Greenwich, General Relativity and the 1919 Solar Eclipse: https://www.royalobservatorygreenwich.org/articles.php?article=1283
- 1919 expedition teams: https://arxiv.org/pdf/2002.01179
- AGN versus stellar-mass disk temperatures: https://arxiv.org/pdf/1709.02845
- Catalogue gps entry (Pitfall on the range error versus the position error)
- My own numerical re-runs of the model's RK4 tracer, ported to Python: fates near the critical aim, probe launches at 4 r_s, ISCO threshold.
