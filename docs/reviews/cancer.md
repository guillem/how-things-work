# Review: cancer

## Verdict
Ready after the small fixes below. The facts, citations and numbers check out (Sender & Milo turnover, Blokzijl's ~40 mutations a year, Prior et al.'s 19% RAS, TCGA's 16% hypermutated, Vogelstein's 2–8 drivers, Armitage–Doll, Knudson's Poisson arithmetic, Goldie–Coldman, Nowell, Tomasetti & Vogelstein's 0.81; SEER fit k = 4.7, elevenfold rise, pancreas 6–7; combo counts 18/30 and 3/30 reproduced by the model tests). The most important fix is a sentence that, read literally, calls tuberculosis and HIV cancers.

## Factual errors
- **medium** steps.ts:219: "A child born with two working copies needs both hits in the same cell, which almost never happens." True per child, but it leaves the impression that sporadic retinoblastoma is rare; in fact about 60% of retinoblastomas are unilateral, and most of those are non-hereditary, so most cases arise from two new hits. Fix: "…which is very rare in any one child; yet, because few children inherit a broken copy, more than half of all retinoblastomas start this way, usually as one tumour in one eye." Source: https://link.springer.com/article/10.1186/1750-1172-1-31 (Aerts et al., Orphanet J Rare Dis 2006).
- **low** steps.ts:151: "each bulges into the pocket where KRAS normally switches itself off." KRAS switches off by splitting its GTP, a reaction a helper protein (a GAP) speeds up some 10⁵-fold; a side chain at codon 12 blocks the GAP's access. Fix: "…and each larger side chain blocks the helper protein that normally makes KRAS switch itself off quickly."

## Model issues
- **low** model.ts:17–18: the header comment says a KRAS cell "tries to divide every generation (b = 1 instead of 0.5)"; the constant B_KRAS is 0.7 (and the notes say 70%). Fix the comment.
- Otherwise the model does what it claims; the tests check real properties (balance, selection, rate dependence, relapse from pre-existing resistance, Erlang slope, SEER fit, Knudson odds, KRAS translation).

## Narrative and scene mismatches
- None found: notes' constants (8% death, 70% vs 50%, ×20 repair, 0.3% resistance, 60% kill, ~1000 cells) match model.ts; fitted range 30–79 matches the scene.

## Catalogue requirements
- Interaction (divide, mutate, growth vs repair genes, treatment and regrowth from resistant cells), Takeaway (recap's last line) and Prerequisites links all met.

## Clarity
- **medium** steps.ts:249: "This is why many cancers, like tuberculosis and HIV, are treated with combinations of drugs." Reads as if TB and HIV were cancers. Fix: "This is why many cancers are treated with combinations of drugs, as tuberculosis and HIV are."
- **low** steps.ts:191: mismatch repair "proofreads every copy": proofreading is strictly the polymerase's own activity; mismatch repair checks the finished copy. Fix: "checks every fresh copy for mismatched letters".

## Sources consulted
- https://www.nature.com/articles/s41591-020-01182-9 (Sender & Milo 2021, abstract: ~90% blood cells of 0.33×10¹²/day)
- https://pubmed.ncbi.nlm.nih.gov/25999502/ (Martincorena 2015: over a quarter of cells carry driver mutations)
- https://link.springer.com/article/10.1186/1750-1172-1-31 (retinoblastoma epidemiology)
- SEER data in data.ts, recomputed with the model tests.
