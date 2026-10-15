<!-- batch msgbatch_01DR6FE4Cvtu2CELxkkwLnfX, claude-opus-5-5, submitted 2026-10-15T04:42:18.353Z, ~$0.83 in tokens + 13 web searches -->
# Review: flight

## Verdict
The page is ready once the fixes below are made. The physics core holds up. I re-derived the Joukowski flow, the Kutta circulation Γ = 4πaU sin(α+β), the stream function, thin-airfoil α_L0, the lifting-line slope and the troposphere formula, and they are correct. Every narrative number I recomputed matches its source: ½ρV² = 1621 Pa, C_L,max = 1.54, glide ratio 9.05, C_D0 = 0.051, e = 0.71, 0.905 kg/m³, a stall at 61.7 kt true airspeed at 10 000 ft, 0.0866 per degree, and the slowdown factor of about 160. The Ladson and POH figures match their sources, and the equal-transit pitfall is handled well. **The most important fix is in the pressure step.** It says the air "pulls" where pressure is low, which is a physics misconception on the page that carries the takeaway. Its note also says the pressure drop is "at most about 3%", which only holds near the default 5°; the readout contradicts it at larger angles.

## Factual errors
- **medium**, steps.ts:134. "The arrows on the surface point outward where the air pulls (lower pressure)". Air pressure is always positive, so air only ever pushes; above the wing it pushes *less* than the undisturbed air. Fix: "The arrows point outward where the pressure is below that of the undisturbed air (suction) and inward where it is above."
- **medium**, steps.ts:137. "over the top of the wing the pressure is at most about 3% below that of the air around". This depends on the angle. I recomputed the 12%/2% Joukowski section at 100 kt: the minimum C_p is −1.9 at 5° (−3.0% of 101 kPa), −5.5 at 10° (−8.8%) and −11.4 at 15° (−18%). The "Lowest pressure, top" readout (FlowScene.svelte:279) shows these larger values as the reader tilts the wing. Fix: "At 100 knots ½ρV² is 1.6 kPa; at 5° the suction peak, C_p ≈ −1.9, is only about 3% of atmospheric pressure, and over most of the top much less (ideal flow overstates the peak at large angles)…"
- **medium**, steps.ts:260 and 262. "a little more than the real aeroplane" / "slightly overstates the drag". The glide polar (C_D0 = 0.051, which includes the windmilling propeller) gives 1632 N at 100 kt. A published performance assessment of a 172 gives a powered-flight C_D0 ≈ 0.034. With the same k, that is about 1190 N, so the model is roughly 35–40% high, which is not "a little". I am moderately confident: the source is for an older 172 variant, not the 172S. Fix: "(probably a third more than the real aeroplane: the polar comes from a glide with the propeller windmilling, which adds a lot of drag; see the notes)", and in the notes replace "slightly overstates" with "overstates, perhaps by a third,". Source: http://www.temporal.com.au/c172.pdf
- **low**, steps.ts:233. "the Cessna 172S Skyhawk, the most-built aircraft in history". The record belongs to the 172 family (44,000+ built), not to the S variant. Fix: "the Cessna 172S Skyhawk SP, the current version of the Cessna 172, the most-built aircraft in history." Sources: https://en.wikipedia.org/wiki/Cessna_172, https://www.statista.com/chart/20788/aircraft-models-with-the-highest-estimated-production-figures/
- **low**, steps.ts:234 and PlaneScene.svelte:318. "The largest C_L the 172's wing can reach … 1.54" / "Most the wing can give". This value comes from the whole aircraft's stall speed at forward CG, so it includes the tail's trim load (plane.ts:82 says so correctly). Fix: "the largest C_L the whole aeroplane can reach".
- **low**, steps.ts:235. "With flaps down the stall is at 48 knots". The POH value is 48 KCAS with full flaps, power off. Fix: "With full flaps the stall is at 48 knots calibrated." Source: https://www.befa.org/wp-content/uploads/2019/12/POH-Cessna-172S.pdf
- **low**, steps.ts:122–123. Both the body ("has to give the air … a downward momentum equal to its weight") and the note ("the downward momentum given to that air each second equals the lift") present a contested control-volume result as plain fact. In the real atmosphere the weight is finally passed to the ground as pressure, and how the lift splits between momentum flux and pressure depends on the control volume chosen (McLean, *Understanding Aerodynamics*, 2012). I am moderately confident this matters at level 2. Suggested note: "…the trailing vortices carry a downward impulse that grows at a rate equal to the lift; far below, the weight finally reaches the ground as a very slight rise in pressure." Source: https://www.researchgate.net/publication/285390865_Understanding_Aerodynamics_Arguing_from_the_Real_Physics

Everything else checks out against the sources:
- POH: 68 KIAS best glide, 53/48 KCAS stall speeds, 2550 lb, 174 sq ft, 36 ft 1 in, 730 fpm, 126 kt, 14 000 ft ceiling, 180 hp.
- The 60→62 and 70→70 airspeed calibration points.
- Babinsky, Phys. Educ. 38, 497 (2003).
- Ladson's TM-4074 data as given by the NASA Turbulence Modeling Resource.
- Munk's NACA Report 142.

## Model issues
- **medium**, PlaneScene.svelte:336 ("Indicated airspeed") and plane.ts:87. The readout shows calibrated/equivalent airspeed, so at the stall it reads 53 kt. The 172S's actual airspeed indicator reads about 48 kt there, because of its position error (I am moderately confident about the 48; the POH calibration table maps 50 KIAS to 56 KCAS). This is misleading next to the sentence "the 172 stalls at the same indicated speed at any height". Fix: change the label to `Calibrated airspeed (≈ indicated)`, and in steps.ts:247 add "(53 knots calibrated; the 172's indicator, with its small built-in error, shows about 48)". Source: https://www.pprune.org/archive/index.php/t-59735.html
- **low**, LiftScene.svelte:130. The lift arrow uses the *ideal* C_L until the stall and the *measured* value after it. At 16.5° it shows about 2.0 against a measured 1.57, so the drop at the stall looks exaggerated, and it is drawn next to a drag arrow that uses measured data. Fix: `y2={qc[1] - 70 * (phase === 'stall' || stalled ? clMeasured : clIdeal)}`, or use `clMeasured` throughout this scene, since its card is about the measurements.
- **low**, steps.ts:15 / aero.ts:460. `angleWide` goes to 20°, but Ladson's data ends at 19.08°, and above that the last value is just held. Fix: `angle(19)` for the stall step.
- **low**, e2e/flight-model.e2e.ts:244. "the numbers the narrative quotes" does not test the 3% pressure claim (which would have caught the issue above) or the "160 times slower" factor. Fix: add `expect(Math.min(...surfacePressure(flow(section(0.12,0.02),5*DEG),400).map(p=>p.cp)) * dynamicPressure(RHO0,100*KT) / 101325).toBeCloseTo(-0.03, 2)`.

## Narrative and scene mismatches
- **medium**, steps.ts:151 and 146. "Turn the angle to zero on a symmetric wing (next step) and the two halves do arrive together". The transit step has no camber control, and the next step (shape) does not draw the timelines, so the reader cannot see what the text promises. Fix: set `controls: [angleIdeal, camber, speed]` on the transit step, and change the note to "Set the camber and the angle to zero and the two halves do arrive together, because there is then no lift."
- **low**, steps.ts:150. "The air on top is faster because the low pressure there pulls it along". Fix: "…because the air ahead is at lower pressure, so the higher pressure behind pushes it faster, as the last step showed."

Apart from these, every number the text quotes matches what the scenes show.

## Catalogue requirements
The entry is met:
- The reader can change the angle, shape and airspeed.
- Streamlines, a pressure map and lift and measured-drag arrows grow with the angle until a separated stall.
- The four forces can be balanced in steady flight.
- The takeaway (downwash plus low pressure above) is visible in the summary scene.
- The equal-transit pitfall is explicitly debunked with parcel timelines.

## Clarity
- **low**, steps.ts:107. Lift is drawn across the oncoming air, not "up", and the balance step relies on this (L = W cos γ). Fix: "…and the arrow across the stream, the **lift** (by definition at right angles to the oncoming air), grows."
- **low**, steps.ts:219 (body and dfn). "falls with the square of the speed" can be read as "falls in proportion to V²". Fix: "falls as 1/V²: twice as fast, a quarter of the induced drag."
- **low**, steps.ts:218. "grows with ½ρV², like lift": in level flight the lift stays equal to the weight, so this confuses. Fix: "grows with ½ρV² (at a fixed coefficient, like lift)".
- **low**, steps.ts:247. The indicator measures the pitot pressure minus the static pressure. Fix: "from the difference between the air rammed into a forward-facing tube and the still air at a side port".
- **low**, steps.ts:221. "KIAS" is used without being explained. Fix: "68 knots indicated (KIAS)".

## Sources consulted
- Cessna 172S POH (stall 53/48 KCAS, 2550 lb, 126 kt, 730 fpm): https://www.befa.org/wp-content/uploads/2019/12/POH-Cessna-172S.pdf
- 172S POH excerpts (68 KIAS best glide): https://data.ntsb.gov/Docket/Document/docBLOB?ID=40389054&FileExtension=.PDF&FileName=POH+Excerpts-Master.PDF
- AOPA 172S specifications (36 ft 1 in, 174 sq ft, 180 hp): https://www.aopa.org/go-fly/aircraft-and-ownership/aircraft-guide/aircraft/cessna-172
- 172 airspeed calibration table: https://www.pprune.org/archive/index.php/t-59735.html
- Cessna 172 production record: https://en.wikipedia.org/wiki/Cessna_172
- C172 drag estimate (C_D0 ≈ 0.034): http://www.temporal.com.au/c172.pdf
- Babinsky 2003, Phys. Educ. 38(6):497: https://www.semanticscholar.org/paper/How-do-wings-work-Babinsky/ca92c2d05f8e80ce7f176291f73d5ae60356b324
- Ladson data file at the NASA Turbulence Modeling Resource: https://github.com/petebachant/NACAFoil-OpenFOAM (links to turbmodels.larc.nasa.gov/naca0012_val.html)
- Munk, NACA Report 142: https://m-selig.ae.illinois.edu/references/naca-cit-031115.html
- McLean, *Understanding Aerodynamics* (2012): https://www.researchgate.net/publication/285390865_Understanding_Aerodynamics_Arguing_from_the_Real_Physics
- My own recomputation of the Joukowski flow (C_p minima against angle) and of the polar and atmosphere numbers.
