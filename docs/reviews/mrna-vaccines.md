<!-- batch msgbatch_01Vd3QBkoZjG75GmguRDxBiq, claude-opus-5-5, submitted 2026-10-15T04:42:12.752Z, ~$0.79 in tokens + 14 web searches -->
# Review: mrna-vaccines

## Verdict
The page is ready after the fixes below. Almost every fact I checked is correct: the 29,903-letter genome, the vaccine's codons, K986P/V987P, PDB 6VSB and 6XRA, Karikó and Weissman, ALC-0315 and SM-102, Gilleron's 1–2%, Ingolia's 5.6 codons a second, Ogata, Polack, and the 13 trillion copies. The step-by-step build, the takeaway and the pitfall all work. **The most important fix is the one fitted number in the model.** The page says the BioNTech/Pfizer vaccine gave 1.7–4.6 times the antibodies of recovered people, but in Walsh et al. that range covers two candidate vaccines together. For BNT162b2 alone it is about 1.7–3.8, so the target should be about 2.5, not 2.8. The dose then needs refitting, and every place that says 2.8 or "almost three times" needs updating. Other fixes:
- The lymph-node scene shows a B cell switched on by fragments displayed on a dendritic cell; B cells recognise whole antigen.
- The model's antigen is at full strength the moment the needle goes in.
- The infection chart calls its virus "the same virus whose spike the vaccine copied", but it is the flu-in-mice virus of the immune-system page.

## Factual errors
- **High**, `model.ts:32-38`, `model.ts:76`, `steps.ts:247` (and `steps.ts:245` "almost three times"): the page says neutralising antibodies after BNT162b2 were 1.7–4.6 times those of recovered people. Walsh et al. say that range covers "the two vaccine candidates at the 30-μg dose level on day 28 or day 35", i.e. BNT162b1 and BNT162b2 together.
  - For BNT162b2, 30 µg, ages 18–55: the GMT 7 days after dose 2 was 360.9, against a convalescent panel GMT of 94. That is 3.8×, and it is the top of the BNT162b2 range; the 4.6 belongs to BNT162b1.
  - The 1.7 at day 35 is, I believe, BNT162b2's (moderately confident; please check the NEJM figure).
  - Fix in code: `export const WALSH = { low: 1.7, high: 3.8, target: Math.sqrt(1.7 * 3.8) } as const;` (≈2.5), then refit `DOSE` with `fitDose()`.
  - Fix in the note: "…neutralising antibodies one to two weeks after the second dose of BNT162b2 were about 1.7 to 3.8 times those of people who had recovered from COVID-19 (Walsh et al., NEJM 2020, adults 18–55); 2.5 is the geometric middle of that range."
  - Fix in the body: replace "almost three times an infection's peak" with the refitted value (about two and a half times).
  - Sources: https://www.nejm.org/doi/full/10.1056/NEJMoa2027906, https://www.fda.gov/media/144246/download, https://cdn.clinicaltrials.gov/large-docs/25/NCT04805125/Prot_SAP_000.pdf
- **Low**, `steps.ts:247`: "2.8 is the middle of that range" is the geometric middle; the arithmetic middle would be 3.15. Say "geometric middle", as `model.ts:37` already does.
- **Medium**, `JourneyScene.svelte:760` ("RNA, not DNA; nothing to copy it into DNA") and `:747` ("no reverse transcriptase"): human cells do make a reverse transcriptase (the LINE-1 enzyme). A disputed cell-line study (Aldén et al. 2022, Huh7 liver cancer cells) reported vaccine mRNA copied into DNA in vitro. The body text (`steps.ts:185`) is correct, because it says the *vaccine* brings no such enzyme; the labels overreach.
  - Fix the label: "RNA, not DNA; the vaccine brings no enzyme to copy it into DNA".
  - Fix the readout: "stays in the cytoplasm: no way into the nucleus; it brings no DNA and no reverse transcriptase".
  - Source: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9164063/

## Model issues
- **Medium**, `model.ts:120-136`: the antigen is `A₀·e^(−δM·t)`, so it is at its maximum at the instant of injection, before any protein has been made. In reality antigen builds up and then falls: the page's own note (`steps.ts:203`, Ogata et al.) says spike in the blood peaked around day 5. The page does say the antigen "fades with the message", but not that it starts at full strength at hour 0.
  - Fix: let the 20.6 h figure set the production rate, and clear the protein separately. Add a state `S` with `dS/dt = kP·mrnaLeft(doses,t) − δS·S` and use `X = V + S` (or the closed form `A₀·δS/(δS−δM)·(e^(−δM t) − e^(−δS t))`). Choose δS so that the peak falls in days 2–5, refit `DOSE`, and state δS on the page.
  - Add a test that the antigen peaks after day 1.
  - Source: https://academic.oup.com/cid/article/74/4/715/6279075
- **Low**, `model.ts:157-170`: existing antibodies never bind or remove the vaccine's antigen, so the second dose's antigen is not reduced by first-dose antibodies. Ogata found no circulating spike after dose 2 for exactly this reason. Either add a term like `−kS·A·AS` or list it with the stated simplifications (`steps.ts:247`).
- **Medium**, `e2e/mrna-vaccines-model.e2e.ts:101-103` against `steps.ts:259`: the text says leftover antibodies stop the virus "within about five months". The test only checks months 1 and 3 (and its comment says "Within three months"), so the five-month claim is untested; I could not run the model to check it. Fix: add `expect(later(5).stopped).toBe(true)` alongside the existing `later(6).stopped === false`, or change the text to whatever month the model actually gives.
- **Low**, `e2e/…:62-64` against `steps.ts:231`: the test comment says antibodies "appear after about a week", but the page says "from about day 4", and the scene readout (`DisplayScene.svelte:74`) uses the first day antibody exceeds 1 pg/mL. Make the comment match the page, and pin the readout: `expect(Math.round(firstDay)).toBe(4)`.
- **Low**, `e2e/…:79-81`: the hard-coded "31,000" and "1,500" (`steps.ts:231`) are only bounded to a 12–18× window. Tighten the bounds to ±10% of the quoted values, or check that the peak day is about 7 to match "a week after one dose".

The integrator, the quiet-stretch skip, the lag buffers and the dose bookkeeping all look correct.

## Narrative and scene mismatches
- **Medium**, `steps.ts:258` ("the same virus whose spike the vaccine copied") and `ChartScene.svelte:108,120`: the model runs the immune-system page's virus with the parameters of flu in mice. The model header (`model.ts:47-49`) says this is "stated on the page", but the page only says so in a note (`steps.ts:247`), and the body calls it the coronavirus. Readers will take "nine days" to be COVID-19's course. Fix (body): "Now the virus arrives: the model virus of the immune-system page (its numbers come from flu in mice), standing in for the coronavirus whose spike the vaccine copied."
- **Medium**, `DisplayScene.svelte:58-68, 260-267`: in the lymph node, B cells (`b: i % 2 === 0`, including the ringed `i === 2`) are shown switched on by the fragments a dendritic cell displays. B-cell receptors bind intact antigen, not fragments on MHC. The body text (`steps.ts:216-217`) has this right; the scene contradicts it.
  - Fix: make only T cells fit the dendritic cell (e.g. `fit: i === 9 || i === 13 || i === 3`, all odd). Show the one ringed B cell holding a whole spike that has drained in with the lymph.
  - Relabel the readout: "a dendritic cell shows spike fragments to T cells; B cells catch whole spikes that drain in; only the few that fit are switched on".
  - Source: https://www.cell.com/immunity/fulltext/S1074-7613(07)00185-9
- **Low**, `JourneyScene.svelte:396-407`: the dendritic cell in the muscle close-up is drawn in `--im-tcell`, the colour the next chapter uses for T cells; in `DisplayScene` the dendritic cell is `--mv-ribosome`. Use one colour, e.g. `var(--mv-ribosome)` in both.

Everything else matches: codon readouts, the proline toggle, the fading percentages (8.9% at day 3, 0.35% at day 7), the 5.6 codons a second counter, and the one-dose and two-dose readouts.

## Catalogue requirements
- **Low**, `steps.ts:74`: the title "How vaccines work — and what an mRNA vaccine does inside you" differs from the catalogue's Title "Vaccines & mRNA". Use the catalogue title, or propose the change in the catalogue.

The Interaction is built as written. The Takeaway is visible in the infection chart. The Pitfall is avoided: the mRNA stays outside the nucleus, does not alter DNA, and is broken down within days. Both prerequisites are linked.

## Clarity
- **Low**, `ChartScene.svelte:109` ("at its peak … doses per mL") and `:120` (peak numbers with no unit): the virus axis says "free virus per mL", and "doses" here (egg infectious doses) clashes with vaccine doses. Fix: `sub: \`at its peak ${count(outU.peakV)} virus per mL\``, and add "per mL" after both peaks at line 120.
- **Low**, `MessageScene.svelte:45` and `steps.ts:104`: "tail section" (the 3′ untranslated region) sits right next to "poly(A) tail", and readers will confuse the two. Rename it "3′ end section (not translated)" in the label and "a stretch after the code" in the body.

## Sources consulted
- Walsh et al., NEJM 2020: https://www.nejm.org/doi/full/10.1056/NEJMoa2027906
- FDA VRBPAC briefing document, 10 Dec 2020 (GMT 360.9 vs convalescent 94): https://www.fda.gov/media/144246/download
- Pfizer protocol / statistical analysis plan (same figures): https://cdn.clinicaltrials.gov/large-docs/25/NCT04805125/Prot_SAP_000.pdf
- Pardi et al. 2015, J Control Release: https://www.researchgate.net/publication/280997102 and, for the ~20 h intramuscular half-life, https://www.science.org/doi/10.1126/sciadv.ade1444
- Ogata et al., Clin Infect Dis 2022: https://academic.oup.com/cid/article/74/4/715/6279075
- Gilleron et al., Nat Biotechnol 2013: https://www.researchgate.net/publication/241692914
- Ingolia, Lareau & Weissman, Cell 2011: https://www.cell.com/fulltext/S0092-8674%2811%2901192-5
- Röltgen et al. 2022, as summarised in: https://pmc.ncbi.nlm.nih.gov/articles/PMC9641982/
- Merchant, comment on Aldén et al. 2022: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9164063/
- Pape et al., Immunity 2007 (B cells take up whole antigen in the follicles): https://www.cell.com/immunity/fulltext/S1074-7613(07)00185-9
