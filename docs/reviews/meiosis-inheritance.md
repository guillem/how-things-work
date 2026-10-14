<!-- batch msgbatch_01PSCmk2K7yX5fvTLPnXfMxz, claude-opus-5-5, submitted 2026-10-14T13:19:50.260Z, ~$0.73 in tokens + 8 web searches -->
# Review: meiosis-inheritance

## Verdict
The page is ready once the fixes below are made. The model is sound: crossovers fall as a Poisson process of rate 2L per pair, the strand bookkeeping works outward from the centromere, line-ups are independent, and the human-sibling simulation is driven by the real HapMap map. I checked every quoted number and nearly all are right. The most important fix is one botanical error that appears in several places. Seed colour and seed shape belong to the **embryo**, so a seed shows its own genotype, not the genotype of the plant it grew on. "A Yy plant has yellow seeds", "All their offspring had yellow seeds" and the cell scene's "This plant: Rr Yy Aa … seeds: round, yellow" all teach that wrong idea: a selfed Yy plant actually bears seeds in a 3 : 1 ratio, which is the whole point of the next chapter. The second fix is the hard-coded link to `the-cell`, a prerequisite that has not been built yet.

## Factual errors
- **High**: seed traits are given to the parent plant instead of the seed.
  - steps.ts:81 says "A <strong>Yy</strong> plant has yellow seeds, just like <strong>YY</strong>". Replace with "A <strong>Yy</strong> seed is yellow, just like a <strong>YY</strong> one".
  - steps.ts:249 says "All their offspring had yellow seeds". Replace with "All the seeds from that cross were yellow".
  - steps.ts:205 says "A plant with round, yellow seeds (<strong>RrYy</strong>)". Replace with "A hybrid plant (<strong>RrYy</strong>, grown from a round, yellow seed)".
  - CellScene.svelte:173 says `seeds: round, yellow`. Replace with `grew from a round, yellow seed`.
  - Why this matters: Mendel scored his F₂ seeds on the F₁ plants themselves. "258 plants yielded 8023 seeds, 6022 yellow, and 2001 green; their ratio, therefore, is as 3.01: 1. In these two experiments each pod yielded usually both kinds of seed." So a hybrid plant bears both colours. (http://www.mendelweb.org/Mendel.html)
- **Medium**: steps.ts:250 says "When two of them were crossed". Mendel let the hybrids self-pollinate; the result is the same as Yy × Yy. Replace with "When they were left to pollinate themselves (the same as crossing two of them), green came back…". Source: http://www.mendelweb.org/Mendel.html
- **Low**: steps.ts:107 says "at sites chosen by an enzyme (Spo11) that cuts the DNA on purpose". Spo11 makes the cuts, but it does not choose the sites (in mammals, PRDM9 picks the hotspots). Replace with "at places where an enzyme (Spo11) cuts the DNA on purpose".
- **Low**: steps.ts:68 says the two chromosome 1s "carry the same genes, in the same order", which is fine, but nothing warns that X and Y in males are not a matched pair. Add: "(except X and Y in males)".
- Checked and correct:
  - Mendel's counts for the three traits and the dihybrid, the 3.01 / 2.96 / 3.15 ratios, Fisher 1936, Sturtevant 1913, Bateson–Saunders–Punnett 1905.
  - The binomial spread: 21.7% for 4 seeds, 0.68% for 4,000.
  - 2²³ ≈ 8.4 million, and the hg38 chromosome lengths.
  - The linkage groups and lesions: Reid & Ross list R on V (starch branching enzyme 1, 0.8-kb insertion), I on I (stay-green, 6-bp insertion) and A on II (bHLH, splice-site change).
  - Visscher's figures: "4,401 quasi-independent sib pairs", sharing "varied from 0.374 to 0.617 (mean 0.498, standard deviation 0.036)".
  - The mother-to-father crossover ratio: female 4,281 cM against male 2,590 cM, "a ratio of 1.65".

## Model issues
- **Low**: the pea simulation lets a pair have no crossover at all. For the short pair (0.75 M) this happens with probability e⁻¹·⁵ ≈ 22% per meiosis. Yet steps.ts:105 says "Every pair crosses over at least once". The results for unlinked genes are not affected, but the catalogue requires simplifications to be stated on the page. Add to the note at steps.ts:107: "Unlike real cells, it sometimes lets a pair go without a crossover."
- **Low**: no test covers the centromere-side rule that the narrative relies on (steps.ts:106, 129). Add:
  `const p = meiosisOfPair(PEA_CHROMOSOMES[0], rng(1), { crossovers: [0.806], flipped: false }); expect(originAt(p.chromatids[1], SHAPE.at)).toBe(1); expect(originAt(p.chromatids[2], SHAPE.at)).toBe(0); expect(originAt(p.chromatids[1], 0.2)).toBe(0);`
- I checked the sibling SD claim independently by re-implementing the model with these knots in Python (4,000 pairs). I got a mean of 49.9% and an SD of 4.1%, against the 4.3% quoted at steps.ts:264. That is within sampling error of a 400-pair estimate, so no change is needed. Everything else checks out: the Poisson rate, Haldane, the Markov chain for gamete kinds, the tetrad and the IBD averaging.

## Narrative and scene mismatches
- **Medium**: the Punnett-square definition at steps.ts:166 says it "lists one parent's egg cells across the top and the other's pollen down the side". The scene does the opposite: pollen across the top (CrossScene:206), egg cells down the side (CrossScene:213). Replace with "lists one parent's pollen across the top and the other's egg cells down the side".
- **Low**: steps.ts:167 lists "YY, Yy, yY and yy", but both mixed boxes are labelled "Yy" (CrossScene:98 sorts the letters). Either colour the box letters by parent, as CellScene does, or change the text to "YY, Yy (twice) and yy".
- **Low**: in flower-colour breed mode, CrossScene:306 says "Bred: N seeds" while the grid draws flowers, and Mendel's 705 : 224 counts plants. Use `seeds`/`plants` depending on `gene.id === 'A'`.
- **Low**: MeiosisScene:408 says "possible line-ups" for 8. A line-up and its mirror image give the same two cells, so there are 4 distinct line-ups but 8 kinds of cell. Replace with "kinds of egg or pollen cell". steps.ts:118 ("8 different ways to share them out") can stay.

## Catalogue requirements
- **Medium**: steps.ts:68 hard-codes `<a href="../the-cell/">`, but `the-cell` is not built (unticked), so this is a dead link. The shell avoids this by linking only built topics. Either drop the anchor ("In a cell, the <strong>nucleus</strong> holds…") or build `the-cell` first. The suggested build order also says this topic waits for its prerequisite.
- Everything else matches the entry: the Interaction (choosing crossovers and line-ups, Punnett square, breeding hundreds against Mendel), the Takeaway (visible in the pedigree and siblings scenes) and the use of real data (HapMap map, hg38).

## Clarity
- **Medium**: steps.ts:206 says "new combinations … that neither grandparent had", but the page never says who the grandparents were. Add before it: "Mendel crossed a line with round, yellow seeds (RRYY) with one with wrinkled, green seeds (rryy); their hybrids are RrYy."
- **Low**: the linkage step (LinkageScene:31, steps.ts:229) reuses the letter **A**, which earlier meant the flower-colour gene. Use other letters (e.g. **D**/**d** and **E**/**e**) or say "two genes, here called A and B".

## Sources consulted
- Mendel 1866, Bateson translation: http://www.mendelweb.org/Mendel.html
- Reid & Ross 2011, *Genetics* 189:3: https://academic.oup.com/genetics/article-pdf/189/1/3/49438310/genetics0003.pdf
- Visscher et al. 2006, *PLoS Genet* 2:e41: https://journals.plos.org/plosgenetics/article?id=10.1371%2Fjournal.pgen.0020041
- Kong et al. 2002, *Nat Genet* 31:241: https://www.biostat.wisc.edu/~kbroman/teaching/statgen/2004/refs/decodemaps.pdf
- Sato et al. 2007, *PNAS*: https://www.pnas.org/doi/pdf/10.1073/pnas.0705521104
