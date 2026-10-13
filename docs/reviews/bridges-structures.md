<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.97 in tokens + 11 web searches -->
# Review: bridges-structures

## Verdict
Ready after the fixes below. I ported `structure.ts` to Node and ran it. Every number the narrative quotes matches the model:
- Tube: yields at 113.3 kN; buckles at 57.2 kN (2 m) and 14.3 kN (4 m); the two limits cross at 1.42 m.
- Beam: busiest member 1.29 over a crossing.
- Truss: 0.264, so "a quarter" and "five times better used" (4.9×) hold.
- Arch 0.52 and suspension 0.61, so "steel to spare" holds.

The stiffness matrices, fixed-end loads and moment recovery are textbook-correct, and the tests check them against wL²/8 + PL/4 and the midspan deflection formula. The most important fix is a real-world claim in the compare note: that the truss is the most economical design over 40 m. In practice, girder (beam) bridges are the usual choice for that span. Next, the arch drawing hides the net tension the model computes in the rib, and the page says too softly how much Euler's formula overestimates real columns.

## Factual errors
- **High**, steps.ts:167. "Over a 40 m gap the truss is the most economical of the four." This is only true inside the model. In practice, steel bridges with one span are most economic at about 25–45 m, and plate girders (deep beams) are the widely used solution for 30–100 m spans. Trusses are mainly a niche choice, for example on railways. Fix: "In this model the truss does best. Real 40 m bridges are usually deep steel or concrete girders, which are beams whose cross-section does the work a truss does with triangles. Suspension bridges only pay off over much longer spans." Sources: https://steelconstruction.info/images/1/1c/BCSA_51-10.pdf, https://www.sciencedirect.com/topics/engineering/steel-bridges
- **Medium**, steps.ts:104. "Euler's load is for a perfectly straight post; real ones buckle somewhat earlier." "Somewhat" understates the gap. By the Eurocode 3 buckling curves (curve a, the most favourable), this tube really takes about 47 kN at 2 m, not Euler's 57 kN. At 1.4 m, where the two limits meet, it takes about 75 kN, not 113 kN. Fix: "…real ones buckle earlier: by about a fifth at 2 m, and by up to a third near the length where crushing and buckling meet, because no post is perfectly straight." Source: https://www.steelconstruction.info/Member_design
- **Low**, steps.ts:118. "a square steel box under half a metre deep". After `size()` the beam pieces are 0.39–0.51 m wide, and the midspan pieces are 0.514 m. Fix: "about half a metre deep".

## Model issues
- **Medium**, structure.ts:587–588. Compression members are checked against Euler's load plus bending stress, with no allowance for imperfection and no amplification of the moment. For the bridges' compression members (λ̄ ≈ 1–1.2) this overstates capacity by roughly 30–50%. The comparison still holds: truss ≈ 0.35 instead of 0.26, and the beam still fails. But the note at steps.ts:167 states the simplification only in general terms. Either (a) add to that note "and members are assumed perfectly straight, so they buckle later than real ones would", or (b) replace the Euler term with the EC3 reduction factor χ(λ̄, α = 0.21), which is ten lines of code.
- **Low**, structure.ts:95 together with structure.ts:776–779. `isRoller` frees every member attached at (40, 0). In the suspension design that includes the right tower, so the scene draws the tower standing on a roller. The numerical effect is negligible (the deck holds the tower base, which moves 2.5 µm), but the support is unrealistic. It also contradicts build-step text saying ground points are "fixed" (steps.ts:179). Fix: apply the roller only to deck members, for example by giving the tower its own pinned base joint in `SUSPENSION`, or say in the build text that the road's right end slides.
- **Low**, structure.ts:714. The comment "A Warren-style truss" is wrong. The truss has verticals, and its diagonals slope up toward midspan, which is the Howe layout. The model confirms this: the diagonals are compressed and the verticals pulled under the truck. Fix: "A Howe-type truss". Source: https://en.wikipedia.org/wiki/Howe_truss
- **Low**, tests:
  - e2e:117 is titled "…and the banks are pushed outward" but never checks the outward push. Add a check that `endA`/`endB` at (0, −10) has fx < 0 and at (40, −10) has fx > 0.
  - e2e:112 is a weak threshold (`> length/3`). At x = 20 nearly every truss member is governed by axial force; use `> 0.8 * length`.
  - Nothing pins the numbers the narrative quotes. Add assertions that the beam envelope is within 1.25–1.35, that truss/beam is ≈ 0.2, and that the crossover length is √(π²EI/(A·fy)) ≈ 1.42 m.

## Narrative and scene mismatches
- **Medium**, BridgeScene.svelte:388–389 and steps.ts:141–142. The face-colouring rule hides a face whose stress is under 30% of the member's larger face. With the truck at midspan or a quarter-span, the model gives the rib faces like −30 ± 53 MPa, which leaves up to +23 MPa net tension on one face. The rule draws that face as plain steel, so the rib reads as purely red. Meanwhile the text links compression to stone arches. A stone arch this slender would crack under this load, because tension appears once the line of thrust leaves the middle third. Fixes:
  - Replace the relative test with an absolute one: `Math.abs(v) < 0.04 * YIELD ? 0 : Math.sign(v)`. Dead-load rib faces are all compressed, so the arch still reads red when it carries only its own weight.
  - Add to the arch body: "Under a truck on one side, one face of this thin steel rib is even slightly stretched. Stone arches are made thick and heavy so that their own weight keeps every part squeezed."

  Source: https://www.sciencedirect.com/topics/engineering/hinged-arch
- **Low**, steps.ts:90. The text says "A rope holding up a weight is pulled", but the scene shows "a steel tube hanging from a beam" (BasicsScene.svelte:188). Showing the same tube both ways is the point of the step. Fix: "A steel tube hanging from a beam and holding up a weight is **pulled**… The same tube standing on the ground under the same weight is **pushed**…"
- **Low**, steps.ts:129–130. Part of this text doesn't match the drawing. When the truck stands mid-panel (for example at x = 22.5 m), the road piece under it is governed by bending: 51 MPa from bending against 14 MPa axial. That piece is the truss's busiest member at that moment, and it is drawn red and blue. Fix: add "(only the piece of road directly under the truck bends a little)" after "the bottom chord is pulled (blue)". Also change "The busiest member now uses" to "The busiest member, as the truck crosses, uses", so it matches the meter that reads 26%.
- **Low**, steps.ts:179. "the road alone sags under the truck". In the scene it fails (129%, "Fails: … bent past its limit"). Fix: "the road alone bends past its limit under the truck."
- **Low**, steps.ts:24. The help text says "The same steel bar", but the post is the scaffolding tube. Fix: "The same steel tube: only its length changes."

## Catalogue requirements
- The interaction is built as written: palette, connect, drive, colouring by sign and utilisation, and four designs on the same span and budget. Ground points act as the supports.
- **Low**, takeaway "shape matters more than the amount of material". The page shows "same material, different shape" but never shows "more than". The model makes this easy to show: the beam needs about 5× the steel to match the truss (envelope 0.60 at 2×, 0.31 at 4×, 0.22 at 6×). Add to the compare body or the compare chart caption (BridgeScene.svelte:1387): "To do as well as the truss, the beam would need about five times as much steel."

## Clarity
- **Low**, steps.ts:130 and BridgeScene.svelte:692. "Top chord" and "bottom chord" are not defined for a level-1 reader. Fix: "The top chord (the upper row of members) is pushed (red), the bottom chord (the road) is pulled (blue)…"
- **Low**, steps.ts:165–166. For the arch and the suspension bridge, the busiest member is the road bending between posts or hangers. Arch: road 52%, rib 34%. Suspension: road 61%, towers 59%, cables ≤ 12%. A reader may assume the bars measure the rib or the cables. Consider adding: "What is left of their bars is mostly the road bending between its supports."

## Sources consulted
- Euler, 1744, *De curvis elasticis* (confirms the date): https://cfraser.artsci.utoronto.ca/Eulerelastica.pdf
- Eurocode 3 flexural buckling reduction factor χ: https://www.steelconstruction.info/Member_design
- BCSA, *Steel Bridges* (economic single spans 25–45 m): https://steelconstruction.info/images/1/1c/BCSA_51-10.pdf
- Plate girders as the widely used solution for 30–100 m spans: https://www.sciencedirect.com/topics/engineering/steel-bridges
- Longest suspension span, 2,023 m (confirms "about 2 kilometres"): https://www.guinnessworldrecords.com/world-records/longest-bridge-cable-suspension-bridge
- Masonry arches, middle-third rule and tension: https://www.sciencedirect.com/topics/engineering/hinged-arch
- Howe truss (diagonals compressed, verticals in tension): https://en.wikipedia.org/wiki/Howe_truss
- Warren truss (no verticals in the pure form): https://en.wikipedia.org/wiki/Warren_truss
- EN 39 scaffold tube 48.3 × 3.2 mm (supports "often stronger steel"): https://www.wm-scaffold.com/wp-content/uploads/2025/01/EN39-Scaffold-Tube-and-Coupler-Standards.pdf
- My own run of `structure.ts` (Node 22, types stripped), giving the envelopes, member forces, face stresses and budget scaling quoted above.
