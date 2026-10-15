<!-- batch msgbatch_011bSgoLceuzwu7ZSigcp6XB, claude-opus-5-5, submitted 2026-10-15T04:42:11.211Z, ~$1.09 in tokens + 15 web searches -->
# Review: carbon-polymers

## Verdict
The page is ready once the fixes below are made. The data pipeline is careful, the names are checked against PubChem, the chirality test is a real calculation, and the rubber model follows Wood (1976). I re-ran the CHFClBr best fit myself: the RMS comes out at 1.38 Å, which matches the note. The most important fix is in the `link` step body. It says nylon and polyester (and proteins and DNA) are made by "the same trick" as polyethylene, which is false. They are condensation polymers, and the page's own note contradicts the body. After that, the main fixes are: swap the propane CH₂/CH₃ values in `chain3d.ts`, fill the state gaps in the alkane series strip, stop telling readers that "NIST lists no reliable boiling point" when the WebBook does have one, and number the builder's carbons the way the name does.

## Factual errors
- **High**, steps.ts:226. "The same trick with other groups gives nylon, polyester and, in living things, proteins and DNA." Nylon and polyester are not made by opening C=C bonds. They are step-growth (condensation) polymers, and the note on line 227 says so only for proteins and DNA. Replace with: "A different kind of linking, in which each new bond also releases a small molecule such as water (condensation), gives nylon, polyester and, in living things, proteins and DNA." Note line 227: change to "Nylon, polyester, proteins and DNA are made by condensation: each new bond also releases a small molecule (water, or in DNA's case a diphosphate)." Source: https://faculty.ksu.edu.sa/sites/default/files/342chem%20chapter%202.pdf
- **Medium**, steps.ts:268–269 (and the verdict at PolymerScene.svelte:211–215). "pull it and the chains slowly slide past one another, and it never springs back" and "With no cross-links the chains just slide: no network, no stiffness". Uncured natural rubber (Mn about 2×10⁵ g/mol) is heavily entangled. Over short times it has a rubbery-plateau modulus of the order of 0.5 MPa and springs back partly. Over long times it creeps and flows. The note admits that entanglements are ignored, but the body states the model's result as a fact about real rubber. Body fix: "On its own it is a soft gum: its tangled chains spring back a little at first, but under a steady pull they slowly slide past one another and it creeps and stays deformed." After "no network, no stiffness" add: "(in this model, which leaves out tangles between chains)". Sources: https://www.sciencedirect.com/science/article/abs/pii/0032386181900550, https://www.sciencedirect.com/topics/engineering/rubbery-plateau
- **Medium**, steps.ts:215 (note). "NIST has no reliable boiling points beyond C₁₆", but C₁₉ (602.3 K) is in `ALKANES` and plotted. Replace with "NIST gives few reliable boiling points beyond C₁₆ (here only C₁₉)".
- **Low**, steps.ts:225 and PolymerScene.svelte:373. "one of its two shared pairs is used to bond to the next molecule" is not quite how chain growth works. In radical chain growth the second pair of the C=C splits: one electron bonds to the chain's reactive end and the other becomes the new reactive end. Fix: "its second shared pair comes apart: one electron bonds to the chain's reactive end, and the other becomes the new reactive end." Scene label: "each C=C opens: one electron bonds to the chain, the other is the new reactive end".
- **Low**, molecule.ts:67–68. The ring-alkyne refusal also blocks an 8-membered ring. Cyclooctyne is real and can be isolated and stored. Fix: `if (f === 'triple' && b.ring) return b.n < 8 ? 'A triple bond is straight (180°): it would bend a ring this small too far' : 'Cyclooctyne exists, but is too strained for this builder';` (or allow it). Source: https://www.britannica.com/science/cyclooctyne

## Model issues
- **Medium**, chain3d.ts:39–44 and the header on lines 5–6. The CH₂ and CH₃ values for propane are swapped. In CCCBDB, the 1.096 Å bond and the 106.1° angle belong to the centre (methylene) carbon, and Lide gives the same assignment. The code uses them for the methyl groups, and the header says the reverse. Fix:
  ```ts
  /** On the middle CH₂ (CCCBDB "center C") and the end CH₃. */
  CH2: get('propane', 'CH', 'length', 0),   // 1.096
  CH3: get('propane', 'CH', 'length', 1),   // 1.089
  HCH2: get('propane', 'HCH', 'angle', 0),  // 106.1
  HCH3: get('propane', 'HCH', 'angle', 1)   // 107.3
  ```
  Header: "H–C–H 106.1° on a CH₂ and 107.3° on a CH₃". Sources: https://cccbdb.nist.gov/expgeom2.asp?casno=74986, https://doi.org/10.1063/1.1731434
- **Medium**, polymer.ts:94–99 and PolymerScene.svelte:211–215, 528–529. `gelPoint` (Mn = 2Mc) is where Flory's approximate end correction reaches zero. It is not where a network first forms. For random cross-linking of equal chains, a gel already appears at one cross-linked unit per chain, which is half this value (lower still for polydisperse chains). Between the two, the verdict "no network" is wrong; the true statement is that the formula gives no stiffness. Fix the comment to "Cross-links per 100 units at which Flory's ideal-network modulus reaches zero (Mn = 2Mc); a gel first forms at about half this". Fix the verdict to `'too few cross-links: no load-bearing network in this model'` and the readout to `(stiffness from ${gel.toFixed(2)} per 100)`. Source: https://www.sciencedirect.com/topics/engineering/gel-point
- **Medium**, polymer.ts:60–65 used in SeriesScene.svelte:51–63. `stateAt` returns null for C₁₇ (no NIST boiling point; its melting point is below 25 °C) and for C₃₇, C₃₈, C₄₁ and C₄₄ (no melting point). The effects:
  - the strip has gaps;
  - "solid" labels pile up on the tiny runs between C₃₉ and C₄₃, and several Readouts share `id="strip-solid"`;
  - at n = 17 there is no state readout, although the body says liquid from five to seventeen. The tests skip C₁₇ for this reason.

  Fix in SeriesScene, inferring from the monotone trend and saying so in a note:
  ```ts
  // Boiling points rise with n (C16 already boils at 281 °C); melting points rise beyond C18.
  const stateOf = (k: number): State | null =>
  	stateAt(alkaneBoiling(k) ?? (k > 16 ? Infinity : null), alkaneMelting(k)?.k ?? (k > 18 ? Infinity : null));
  ```
  Then drop the `?? (alkaneMelting…)` fallbacks on lines 56 and 73, and key the Readouts `id="strip-{r.s}-{r.from}"`.
- **Medium**, compounds.ts: entries with no `nist` field (heptan-1-ol 1011–1012 area, butan-2-ol 330–334, octan-2-ol, (E)-hept-2-ene, the octanamines, chlorocyclobutane…). For these molecules the NIST lookup failed outright: no entry was matched at all. The WebBook does list 1-heptanol (same InChIKey) and 2-butanol with normal boiling points. Yet BuilderScene.svelte:561 tells the reader "NIST lists no reliable boiling point". I'm fairly confident (about 85%) this is a retrieval failure, not NIST's averaging rule. Fix: re-run `build.mjs` for the keys with no `nist` field. In the scene, show `compound?.nist ? 'NIST lists no reliable boiling point' : 'no NIST value retrieved'`. Sources: https://webbook.nist.gov/cgi/cbook.cgi?ID=C111706&Type=TBOIL, https://webbook.nist.gov/cgi/cbook.cgi?ID=C78922&Type=TBOIL

## Narrative and scene mismatches
- **Medium**, BuilderScene.svelte:443 and StructureView.svelte:277. The carbon numbers drawn are the reader's raw positions, but the name uses the lowest locant. For example, OH placed on carbon 4 of pentane shows "4" beside it while the name reads pentan-2-ol, and a ring with OH on carbon 3 shows "3" for cyclohexanol. This contradicts the hint and the `groups` note ("numbered from the end nearer the group"). Fix: add a `locant?: (k: number) => number` prop to StructureView and render `{locant ? locant(a.carbon) : a.carbon}`. In BuilderScene:
  ```ts
  const locant = $derived.by(() => {
  	if (!build.feature) return (k: number) => k;
  	if (build.ring) return (k: number) => ((k - build.at + build.n) % build.n) + 1;
  	return canonical(build).at === build.at ? (k: number) => k : (k: number) => build.n + 1 - k;
  });
  ```
  Leave `a.carbon` as it is for `onAtom`/`atomLabel`.
- **Medium**, BuilderScene.svelte:456–458. The hint condition is inverted: "Numbers count the carbons from the end nearer the feature" appears only when there is no feature. Fix: `build.feature ? 'Numbers count from the end nearer the feature · click another carbon or bond to move it; click it to take it off' : 'Drag a feature from the palette onto a carbon or a bond'`.
- **Low**, PolymerScene.svelte:541. "M꜀" uses U+A700, a Chinese tone mark, as a fake subscript c. It may render oddly and screen readers will misread it. Use `M<tspan baseline-shift="sub" style:font-size="9px">c</tspan>`, or write "Mc".

## Catalogue requirements
- **Low**, steps.ts:218–228. The Interaction asks the reader to "link monomers into a polymer", but the `link` step is a passive animation with no control. The stretch step does let the reader set chain length and cross-links, and stiffness responds as the entry asks. Optional fix: add an action control "Add a monomer" that advances the chain by one unit instead of the timer. Everything else is met: the builder with names and properties, mirror images that can't be superimposed, and a gallery that makes the Takeaway visible.

## Clarity
- **Low**, steps.ts:79. Moving the double bond to carbon 2 shows "(E)-but-2-ene", but (E) is explained only in Go deeper. Add to the body: "Move it to the middle and the name gains (E)-: the chain continues on opposite sides of the double bond, which can't twist."

## Sources consulted
- https://cccbdb.nist.gov/expgeom2.asp?casno=74986 (propane experimental geometry and its CH₂/CH₃ assignments)
- https://doi.org/10.1063/1.1731434 (Lide 1960, propane: in the CH₂ group, HCH 106.1°)
- https://www.sciencedirect.com/science/article/abs/pii/0022286077870919 (n-butane electron diffraction)
- https://webbook.nist.gov/cgi/cbook.cgi?ID=C111706&Type=TBOIL (1-heptanol in NIST WebBook)
- https://webbook.nist.gov/cgi/cbook.cgi?ID=C78922&Type=TBOIL (2-butanol in NIST WebBook)
- https://nvlpubs.nist.gov/nistpubs/jres/80A/jresv80An3p451_A1b.pdf (Wood 1976, natural rubber modulus and entanglements)
- https://www.sciencedirect.com/science/article/abs/pii/0032386181900550 (creep and recovery of unvulcanized natural rubber)
- https://www.sciencedirect.com/topics/engineering/rubbery-plateau (rubbery plateau modulus)
- https://www.sciencedirect.com/topics/engineering/gel-point (Flory–Stockmayer gel point)
- https://faculty.ksu.edu.sa/sites/default/files/342chem%20chapter%202.pdf (condensation / step-growth polymerisation)
- https://www.britannica.com/science/cyclooctyne (cyclooctyne, the smallest stable cycloalkyne)
