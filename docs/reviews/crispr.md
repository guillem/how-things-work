# Review: crispr

## Verdict
Ready after the fixes below. The citations (volumes, pages, years) check out against the papers'
abstracts, and the model behaves as the narrative says. The scan quotes "three letters in before
the fourth fails"; seed and PAM mutations escape and a distal one does not; the flask recovers with
CRISPR and empties without it. The most important fix is in the yogurt experiment. Barrangou et al.
did not add the two phage-858 spacers to the *original* strain: they added them to a survivor of
phage 2972, which 858 still killed. The step, the control, the scene and the model all say
"original".

## Factual errors
- **high** — steps.ts:203, steps.ts:45, scenes/YogurtScene.svelte:26, model.ts:258–270. "Adding
  them to the original strain made it resistant." In the 2007 work the 858-resistant BIM (two new
  spacers, S1 and S2) lost resistance when they were removed. The S1S2 construct was then
  integrated into DGCC7710-R2, a BIM resistant to phage 2972 (one new spacer) but sensitive to 858,
  and that strain became resistant to 858. Fix: the step says "Adding the same two to a survivor of
  phage 2972, which 858 still killed, made it resistant to 858 too". The option label becomes
  "Survivor of 2972 + spacers", the scene row "A survivor of phage 2972, the two spacers added", and
  `strainArray('added')` is built from the original plus a spacer from a made-up phage 2972. Source:
  the strain table of the Danisco patent on this work, which gives DGCC7778 (858 BIM, 2 spacers, R);
  DGCC7778RT (spacers removed, S); DGCC7710-R2 (2972 BIM, 1 spacer, S to 858); and DGCC7710-R2S1S2
  (R to 858). https://patents.google.com/patent/US10066233B2/en ; abstract
  https://doi.org/10.1126/science.1138140
- **medium** — scenes/InfectionScene.svelte:96. "Phages drawn larger than true scale: about a tenth
  of the cell's length". That is the T4/*E. coli* ratio. The notes say the picture is a phage of
  *S. thermophilus*: phage 2972 has a 55 nm head and a 260 nm tail (about 0.3 µm), and the cell is
  about 1 µm across. The drawing (phage 62 units, cell 200) is in fact close to true scale. Fix the
  caption: "(schematic: the yogurt bacterium's phages are about 0.3 µm long, a third of the cell)".
  Lévesque et al. 2005, https://pmc.ncbi.nlm.nih.gov/articles/PMC1169050
- **low** — steps.ts:96 (notes, step phage). The drawn phage has a short, stiff tail. Phages of
  *S. thermophilus* are siphophages with a long, thin, non-contractile tail. Fix: add one sentence to
  the notes saying the drawing is schematic, with the real proportions. Don't redraw. Same source.

## Model issues
- None. The checks agree with the text: scan verdicts (seed mismatch at 1, at 4, full match);
  escapes (seed 0 targets, PAM 0, distal 1); self (no target with the PAM check, one without it);
  flask (recovers to 1e7 with phage 0; without CRISPR, 0); arms race (changes > 0). Cumulative
  phage output across the arms race is past 1e9, so "billions of new phages" holds.

## Narrative and scene mismatches
- **low** — steps.ts:159. "A Cas9 … runs along the phage DNA." Cas9 finds PAMs by binding and
  letting go (3D collisions), not by sliding along. Fix: "tries spot after spot on the phage DNA",
  plus a note that the drawing shows it moving along for clarity. Sternberg et al. 2014,
  https://doi.org/10.1038/nature13011
- **low** — steps.ts:216. "…while the phages, finding no more cells to infect, die out." In the
  model (and in reality) they still meet cells: immune ones cut their DNA. Fix: "while the phages,
  meeting only cells that cut their DNA, die out."
- **low** — scenes/InterfereScene.svelte:170, :473. "no PAM in the array" and "there is no PAM
  anywhere in the array". This is true only of the made-up array. What matters (and what the body
  says) is that no PAM sits next to the spacer. Fix: "no PAM next to the spacer: Cas9 never opens it"
  and "no stops: this made-up array has no PAM at all". The e2e assertion changes with it.
  Sternberg et al. 2014 (above).

## Catalogue requirements
- The entry's Interaction and Takeaway describe gene editing (guide design, repair, off-targets). The
  user chose to scope the page to CRISPR as a natural bacterial immune system, and has accepted the
  replacement interaction (adaptation, PAM self/non-self, escape, yogurt experiment, flask arms
  race) and takeaway. Against that scope, the takeaway is shown on the history stage and in the
  text, and the prerequisite dna-to-protein is linked. No action.

## Clarity
- **low** — steps.ts:149 (notes, express). The body says each crRNA holds "one spacer plus a bit of
  repeat on either side". That is true of the first cut. In Cas9 systems the piece is then trimmed to
  about 20 letters of spacer plus part of one repeat, which is what justifies "spacers are 20
  letters, the length of the part Cas9 uses". Fix: one sentence in the notes. Deltcheva et al. 2011,
  https://doi.org/10.1038/nature09886
- **low** — steps.ts:123. "The new spacer always goes in at the front". Addition is polarized, but
  not without exception. Fix: "nearly always". Horvath et al. 2008,
  https://doi.org/10.1128/JB.01415-07
- **low** — steps.ts:204 (notes, yogurt). "Danisco went on to use the method" needs a source and a
  word on how it was used (selection of natural survivors, no engineering). Fix: "Danisco (part of
  DuPont from 2011) went on to make starter cultures less vulnerable to phages by selecting natural
  survivors with new spacers; the first such culture was sold in 2012." The Scientist, "There's
  CRISPR in your yogurt" (2015),
  https://www.the-scientist.com/news-analysis/theres-crispr-in-your-yogurt-35780 ; ASU Embryo
  Project, https://embryo.asu.edu/pages/crispr-acquired-resistance-against-viruses-2007

## Sources consulted
- Barrangou et al. 2007, Science 315:1709 (abstract via Europe PMC), https://doi.org/10.1126/science.1138140
- US patent 10066233 (Danisco; strain table of the same experiments), https://patents.google.com/patent/US10066233B2/en
- Deveau et al. 2008, J. Bacteriol. 190:1390, https://doi.org/10.1128/JB.01412-07 (30 BIMs, 29–31 nt spacers, NNAGAAW, 20 mutant phages)
- Horvath et al. 2008, J. Bacteriol. 190:1401, https://doi.org/10.1128/JB.01415-07 (3,626 spacers; 77/16/7 %)
- Paez-Espino et al. 2015, mBio 6:e00262-15, https://doi.org/10.1128/mBio.00262-15
- Marraffini & Sontheimer 2010, Nature 463:568, https://doi.org/10.1038/nature08703
- Deltcheva et al. 2011, Nature 471:602, https://doi.org/10.1038/nature09886
- Sternberg et al. 2014, Nature 507:62, https://doi.org/10.1038/nature13011
- Stern et al. 2010, Trends Genet. 26:335, https://doi.org/10.1016/j.tig.2010.05.008 (self-targeting spacers as autoimmunity)
- Lévesque et al. 2005, Appl. Environ. Microbiol. (phage 2972 dimensions), https://pmc.ncbi.nlm.nih.gov/articles/PMC1169050
