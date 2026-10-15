# Review: immune-system

## Verdict
Ready after the fixes below. The model is a faithful implementation of Cao et al. (2016): every
Table 1 value checks out, and every number the narrative quotes (thousandfold rise in 1.5 days,
cleared on day 9, a seventh of the lining, ~63,000 effectors on day 7.6, 3,100 memory cells,
antibody at 9% after six months, 5.25-day second clearance, 183× effectors, 23× antibody, the
~3-month threshold) matches a Node run of the model. The most important fix: the expand step's
arithmetic does not add up (1,300 per cell × 100 cells is 130,000, not 60,000), both in the
narrative and in the scene's label "× 100 cells that fit ≈ 63,000".

## Factual errors
- **low** — steps.ts:115 and scenes/LibraryScene.svelte:244–246, readout at :241: "An adult has
  at least 100 million different T-cell receptors". Qi et al. (PNAS 2014) give that lower bound for
  the naive TCRβ chains of young adults (20–35); older adults have several times fewer. The notes
  already say "young adult". Fix: "A young adult has at least 100 million…" and the readout/label
  "in a young adult". Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC4246948

Everything else checked out: Baccam et al. 2006 (≈6 h delay, ≈11 h infected-cell lifetime, peak day
2–3), Alanio et al. 2010 (0.6 × 10⁻⁶ to 1.3 × 10⁻⁴, i.e. 1 in 8,000 at most), Cao et al. Table 1,
Cn0 = Bn0 = 100, recovery threshold 1 EID₅₀/mL, memory 5% of the peak ≈ 30× the naive pool,
memory τCm = 5 d and pCm = 1.5·pC (Supplementary 0.3), Amanna 2007, PDB 1IGT (Harris 1997) and 1RU7 (Gamblin 2004), Memoli 2014,
Pawelek 2012 (horses). The V(D)J segment counts match the usual textbook figures (not looked up).

- **low** — steps.ts:201: "Cao et al. use 5% for their memory simulations." They simulate memory
  pools of 1% and 5% (Fig. 8a), and 5% of the effector peak in Fig. 8b, which is what this page
  uses. Fix: "Cao et al. use 1% and 5%; the page uses their 5% of the effector peak." Source: Cao et
  al., section "Dependence of the recovery time on the level of memory CD8+ T cells".

## Model issues
None. The equations and parameters match the paper; the delayed terms, the "infection over"
cut-off and the B-cell memory extension are stated on the page. Limiting cases (no innate, no
adaptive, no T cells, early reinfection, a year after clearance) behave as described and are tested.

## Narrative and scene mismatches
- **medium** — steps.ts:141 and scenes/LibraryScene.svelte:380: "each recruited T cell turns into
  about 1,300 killer T cells … so the 100 cells that fit become about 60,000 killers at the peak",
  and the label "× 100 cells that fit ≈ 63,000 at the peak" beside a 1,300-cell clone. 100 × 1,339 =
  134,000. The model's peak is about half that because the 100 naive cells are recruited over
  about three days (half by day 1, 94% by day 3) and effectors die at 0.57/day (half-life ≈ 1.2
  days), so the first are dying as the last arrive. Fix: say so in the text, and change the label
  to "all 100 cells that fit: about 63,000 at the peak" with a second line "(the first are already
  dying as the last arrive)". Tighten the model test to bracket the quoted "about 60,000".
- **low** — steps.ts:199: "Some long-lived plasma cells keep making antibodies, so the blood stays
  armed for a while." In the model all plasma cells die at 0.5/day; what stays is the long-lived
  antibody already made, fading with a 46-day half-life (the second step's notes say so). Fix:
  "The long-lived antibodies made during the fight fade only slowly (and in people, long-lived
  plasma cells keep making more), so the blood stays armed for a while."
- **low** — steps.ts:172: "each cell of the lining in the picture stands for about three million
  real ones" — 7 × 10⁷ / 24, the upper airway of a mouse, while the page has so far spoken of
  "your airways". Fix: add "(of a mouse: the model's numbers are for mice)".

## Catalogue requirements
All met: the pathogen is released into tissue, the fast innate response and the slower selection
and expansion of matching B and T cells are shown, a second infection is compared, and the recap
shows the takeaway's three moves.

## Clarity
Clear for level 2; jargon is defined on first use.

## Sources consulted
- Cao et al., Front. Immunol. 7:611 (2016), Table 1 and section 3.3: https://www.frontiersin.org/articles/10.3389/fimmu.2016.00611/full
- Cao et al., arXiv version with Supplementary 0.3 (τCm, pCm): https://arxiv.org/abs/1609.05977
- Baccam et al., J. Virol. 80:7590 (2006), via BioNumbers: https://bionumbers.hms.harvard.edu/bionumber.aspx?id=101620
- Alanio et al., Blood 115:3718 (2010): https://hal-pasteur.archives-ouvertes.fr/pasteur-01402100
- Qi et al., PNAS 111:13139 (2014): https://pmc.ncbi.nlm.nih.gov/articles/PMC4246948
