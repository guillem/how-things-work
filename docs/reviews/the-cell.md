<!-- batch msgbatch_01DfdyDAKXUp9YpkBnuBooBG, claude-opus-5-5, submitted 2026-10-14T12:43:27.198Z, ~$1.47 in tokens + 15 web searches -->
# Review: the-cell

## Verdict
The page is ready once the fixes below are made. The zoom machinery is sound: the camera's fixed-point formula is correct, the scale bar is true, and the thin-section counting rule (n × d per area) is applied consistently. The PDB tracings are well sourced and the Interaction and Takeaway are delivered. The most important fix is a number the page quotes that its own model contradicts: the bacterium notes and `Ecoli.svelte` say a slice cuts "about 500" ribosomes, but the model computes about 314. Next in importance: the Alberts volume fractions are misquoted (20%/10% instead of 22%/9%), and the E. coli periplasm uses the old chemically-fixed width (13 nm) instead of the cryo-EM value (21 nm), even though the peptidoglycan thickness comes from that same cryo-EM paper.

## Factual errors
- **high** — steps.ts:219 (notes), frames/Ecoli.svelte:5: "A thin slice through such a cell cuts about 500 of them, as drawn." The model gives V = 1.466 µm³ and a section area of 1.843 µm². That is (10,000 / 1.466) × 0.025 × 1.843 ≈ **314** ribosomes, and the test only checks the formula, not this number. Fix: "…cuts about 300 of them, as drawn." In Ecoli.svelte write "the ≈ 300 ribosomes a thin slice cuts". The figure is still ≈ 300 after the periplasm fix below.
- **medium** — liver.ts:14, 52–53; steps.ts:104–105: these values are attributed to Alberts Table 12-1, but the table gives cytosol **54**, mitochondria **22**, rough ER cisternae **9**, smooth ER + Golgi 6, nucleus 6, and 1% each for peroxisomes, lysosomes and endosomes. The code and notes say 20 / 10 / "50–60". This also contradicts the mitochondria notes (steps.ts:158, "22% of its volume"). Fixes:
  - Code: `mitochondria: 0.22, roughER: 0.09`.
  - Notes (steps.ts:105) and the liver.ts header: "cytosol 54%, mitochondria 22%, rough ER 9%, …".
  - Body (steps.ts:104): "(mitochondria more than a fifth, rough ER almost a tenth)".
  
  With 22% the slice holds ≈ 95 mitochondria instead of ≈ 88, so the "about a hundred" in step 2 becomes accurate. Source: https://www.ncbi.nlm.nih.gov/books/NBK26907/table/A2135/
- **medium** — bacterium.ts:7, 25; structures.ts:569: the periplasm is set to 13 nm (BNID 100016). That entry quotes the 11–15 nm value from conventionally fixed cells and points to BNID 105387, which gives **21 nm** by cryo-TEM of frozen-hydrated sections (Matias et al. 2003). The 6.35 nm peptidoglycan used here (BNID 105385) comes from that same cryo study, so the envelope mixes two methods. The model's envelope is also 26 nm while the card says "≈ 30 nm".
  - Fix: `periplasm: 0.021` (BNID 105387). The envelope becomes ≈ 34 nm, which the card and test already allow.
  - Linked change: with om0 = −32 the inner membrane would end at +2 nm, i.e. in the view's centre. Move the hard-coded 32 nm together in frames.ts:64 (`32 * NM`), molecular.ts:241 (`om0 = -32`) and molecular.ts:280 (`- 32`), e.g. to 40.
  - Sources: https://bionumbers.hms.harvard.edu/bionumber.aspx?id=105387&ver=2, https://bionumbers.hms.harvard.edu/bionumber.aspx?id=100016&ver=8, https://journals.asm.org/doi/10.1128/jb.185.20.6112-6118.2003
- **medium** — structures.ts:495: Photosystem I is called "A second light-driven pump". PSI does not pump protons; it is a light-driven plastocyanin:ferredoxin oxidoreductase. Placed next to b₆f, which "pumps protons", readers will assume PSI does too. Fix: "A second light-driven machine that lifts electrons high enough to make NADPH." Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC8689207/
- **medium** — steps.ts:251 (sizes body): "a ribosome is a thousandth of the way along, and a water molecule a hundred-thousandth". On the 0–0.3 mm ruler, 30 nm is 1/10,000 of the way and 0.3 nm is 1/1,000,000. The stated fractions are relative to a liver cell, not the ruler. Fix: "on a ruler long enough to show the slice of liver, a ribosome sits a ten-thousandth of the way along, and a water molecule a millionth."
- **low** — steps.ts:176 (membrane notes): "About half of a membrane's area is protein." Measurements put it lower: at least 23% at the bilayer centre in red blood cells, with other estimates of 30–55%. Fix: "Proteins take up roughly a quarter to a half of a membrane's area." Sources: https://www.pnas.org/doi/pdf/10.1073/pnas.0712379105, https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1002431
- **low** — frames/Membrane.svelte:7, 31: the intracellular K⁺ is set to 100 mM. The usual mammalian value is ≈ 140–150 mM. Fix: `kIn: …0.14 * NA…` and "K⁺ 140 mM" in the comment. Source: https://www.nature.com/articles/s42003-018-0269-2
- **low** — steps.ts:172: the potassium channel "lets K⁺ leak back out", but the structure drawn is Kv1.2, a voltage-gated channel. The resting leak runs mostly through other K⁺ channels (K2P, Kir). Fix: add to the notes "Kv1.2, drawn here, is voltage-gated; the resting leak runs mainly through other potassium channels."
- **low** — steps.ts:129: "a hundred times narrower than the nucleus". 100 nm against 8 µm is 80×. Fix: "eighty times narrower than the nucleus".
- **low** — steps.ts:264: "Cells and organelles are drawn by hand to their measured sizes." This contradicts step 2 ("Nothing here is placed by eye"); the layouts are generated by seeded code. Fix: "Cells and organelles are laid out by a program, with seeded random positions, at their measured sizes…"
- **low** — steps.ts:232 (crowded notes): the list of protein kinds leaves out citrate synthase, which is in `MIX` and is the pig-heart structure (1CTS). Fix: "…GroEL, RNA polymerase, free tRNA and citrate synthase (a pig-heart structure standing in for E. coli's)…"

## Model issues
- **medium** — e2e/the-cell-model.e2e.ts:90–123, 140–159: the composition and ribosome tests compare the model with its own constants (VOLUME_FRACTIONS, the n × d formula), so they have locked in the misquoted 20/10 and missed the "≈ 500" claim.
  - Check the constants against the source: e.g. `expect(VOLUME_FRACTIONS.mitochondria).toBe(0.22)`, plus a cytosol test against 0.54 ± 0.03.
  - Assert the numbers the narrative quotes: ribosome profiles ≈ 300 ± 10%, mitochondria in the slice ≈ 100 ± 15%, ER ribosome spacing 1 / (1000 × 0.027) ≈ 37 nm.
- **medium** — molecular.ts:42–80 with frames/Hepatocyte.svelte:149–154, 472–479: nucleosome dots exist only within ±260 nm of the target. The fine layer shows from a 1.6 µm view (`fine` > 0) and stays up to a 0.69 µm view, so the dots end at a visible square edge inside a uniform nucleus. I'm moderately confident; it follows directly from the numbers. Fix: either call `chromatin(900)` (raise `tries` to about 60,000), or wrap the dots in a radial-gradient mask that fades out by 240 nm from the target.
- **low** — molecular.ts:133, 157, 290: `scatter`, `scatterSmall` and `crowd` compute the count from the gross box area, then place it in the area left after exclusions (the crista fold, ribosomes, proteins). This overstates the stated concentration by the excluded fraction, about 10% in the crista view. Fix: estimate the free fraction by sampling `exclude` on a grid and multiply `n` by it.
- **low** — molecular.ts:112–117: `headCentre` puts the F1 head 15 nm from the membrane, but in the traced 6ZPO outline the head group spans y = 2.4–17.4, centred near 10 nm. The ATP-synthase callout therefore lands on the head's far edge. Fix: `const d = 10 * (m.flip ? -1 : 1);`, keeping the `nearHead`/`nearStalk` exclusions as they are.
- Everything else checks out: the camera similarity formula, scale bar, unit formatting, Delesse scaling, nuclear-pore and ER-ribosome slice counts, nucleosome density (1.19 × 10⁵ µm⁻³ → ≈ 1,300 µm⁻²), water density (33.4 nm⁻³), hydrated-ion sizes, Bondi radii, thylakoid repeat (22.4 nm), and photosystem orientations (stroma on the correct side in every membrane).

## Narrative and scene mismatches
- **medium** — frames/Hepatocyte.svelte:267–285: the smooth ER is drawn inside `<Part id="golgi">`, so clicking a smooth-ER tubule opens the Golgi card. Fix: add a `smoothER` structure in structures.ts ("Smooth endoplasmic reticulum", tubules ≈ 60 nm, makes lipids and detoxifies drugs; smooth ER and Golgi together 6%, Alberts). Then move the two `serPath` paths into `<Part id="smoothER" …>`.
- **medium** — frames/Cytoplasm.svelte:123–129: every protein in the crowd sits inside one `<Part id="protein">`. The cards for GroEL, RNA polymerase and tRNA, which the "crowded" step names and the callouts label, can never be opened, because callouts have `pointer-events: none`. Fix: render each machine in its own part, `<Part id={({ groEL: 'groEL', rnaPolymerase: 'rnaPolymerase', trna: 'trna' })[p.id] ?? 'protein'} …><Machine …/></Part>`.
- **low** — frames/Ribosome.svelte:90–94: the "Sec61 channel" callout and card exist, but Sec61 is part of the ribosome's Part and cannot be picked. Fix: after the ribosomes, add `<Part id="sec61">` holding a transparent `<rect x={q.x - 3} y={ER.membrane - 3} width="7" height="8" fill="transparent"/>` for each ribosome.
- **low** — steps.ts:250, SizesScene.svelte:35: the ruler is introduced as "everything we have met", but it includes `vesicle`, which no zoom view draws. Its axis also spans 0.1 nm–1 mm (seven decades) while the text says "the line covers six powers of ten". Fixes: drop `'vesicle'` from `IDS` or draw a few vesicles by the Golgi; and change the sentence to "…so the parts we met span six powers of ten…".
- **low** — steps.ts:157: "a fifteenth the height of the machine": 1.4 nm against the traced 22.9 nm is about 1/16. Fix: "about a sixteenth".
- **low (unverified)** — steps.ts:218: "Its ribosomes, the grey dots". The fill is `var(--tc-ribosome)`, which isn't in the files given. Check that it renders grey in both themes.

## Catalogue requirements
- Interaction: continuous zoom, an updating scale bar, click-to-card and a choice of three cell types are all built. "Select any structure" falls short for smooth ER, GroEL, RNA polymerase, tRNA and Sec61 (see above).
- Takeaway: visible without the text, through the crowded cytoplasm view and the powers-of-ten ruler.
- Needs: met with real data. Machines are traced from PDB/OPM structures; cell-scale layouts are schematic at measured sizes, and the page says so.

## Clarity
- Pitched correctly for Level 1. Units are defined in step 1, and each new term has a `dfn`. No issues beyond the wording fixes listed above.

## Sources consulted
- Alberts et al., *Molecular Biology of the Cell*, Table 12-1: https://www.ncbi.nlm.nih.gov/books/NBK26907/table/A2135/
- BioNumbers 105387 (periplasm 21 nm, cryo-TEM): https://bionumbers.hms.harvard.edu/bionumber.aspx?id=105387&ver=2
- BioNumbers 100016 (11–15 nm, conventional fixation): https://bionumbers.hms.harvard.edu/bionumber.aspx?id=100016&ver=8
- BioNumbers 105385 (peptidoglycan 6.35 nm, Matias 2003): https://bionumbers.hms.harvard.edu/bionumber.aspx?s=n&v=2&id=105385
- Matias et al., J. Bacteriol. 2003: https://journals.asm.org/doi/10.1128/jb.185.20.6112-6118.2003
- Dupuy & Engelman, PNAS 2008: https://www.pnas.org/doi/pdf/10.1073/pnas.0712379105
- Membrane protein area estimates: https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1002431
- Intracellular K⁺ ≈ 150 mM: https://www.nature.com/articles/s42003-018-0269-2
- PSI as plastocyanin:ferredoxin oxidoreductase: https://pmc.ncbi.nlm.nih.gov/articles/PMC8689207/
- E. coli ribosomes 6,800–72,000 (Bremer & Dennis): https://onlinelibrary.wiley.com/doi/full/10.1111/j.1365-2958.2006.05046.x
