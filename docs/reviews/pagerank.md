<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.51 in tokens + 6 web searches -->
# Review: pagerank

## Verdict
The page is ready once the fixes below are made. The model is correct: it implements normalised PageRank with uniform teleportation and dead ends that spread their rank evenly, and the surfer, the power iteration and the hand-solved test all agree. I recomputed every number the narrative quotes (C 36.5%, A 33.6%, B 20.3%; the 2.5% floor; about six-fold from A's link; about 2.2-fold from a three-page farm; "about six links in a row"), and they all hold. The most important fix is in the "Can you game it?" step. It tells the reader that one vote from an important page "beats a whole farm" and that the farm's effect through E's own links is "a little". In the editor the page gives them, a farm that E links back to beats A's vote, and that loop is exactly how real link farms work.

## Factual errors
- **high**, steps.ts:186–188 (boost body and notes), also pagerank.ts:272–278. The claims "one vote from a page that matters beats a whole farm", "E's own links start to matter a little" and "the only reliable way to rank highly is to be linked to by pages that are themselves well linked" are false under PageRank itself, and false in this page's own model. I computed these on STARTER with d = 0.85 (E starts at 3.0%):
  - A → E alone lifts E 5.98-fold.
  - Five farm pages that only link to E: 2.6-fold.
  - The same five pages with E linking back to each of them (keeping E → A): 6.6-fold.
  - The same, with E → A removed: 9.5-fold.

  The reader can build all of these (10-page limit, erase tool). This is the standard spam-farm result: MMDS Example 5.11 shows that a farm's structure multiplies the target's external rank by 1/(1−β²) ≈ 3.6 at β = 0.85.

  Fix, paragraph 2, last sentence: "Finally, get A, the top page, to link to E: that one vote lifts E about six-fold, far more than three farm pages that only link to E (about 2.2-fold)."

  Fix, paragraph 3: "(There is a catch. Once pages link to E, E's own links matter: if E links back to its farm pages, the rank it gives them comes straight back. Try it: five farm pages that E links back to beat A's vote, and more so if E stops linking to A. That loop is how real link farms work, and it is why search engines learned to detect and discount them.)"

  Fix, notes: "This is the real lesson of PageRank: rank flows along links, so a page gains by being linked to from pages that are themselves well linked — and also by trapping rank in a loop, which is why search engines treat link farms and link swaps as spam. Modern search engines combine…".

  Also update the STARTER doc comment to match. Source: http://infolab.stanford.edu/~ullman/mmds/ch5.pdf (§5.4, spam farms).
- **low**, steps.ts:203 (compute notes). "The 1998 paper" refers to two different papers.
  - The un-normalised PR(A) = (1−d) + d(…) is from "The Anatomy of a Large-Scale Hypertextual Web Search Engine" (Brin & Page, WWW7).
  - The 52 iterations on 322 million links, and setting dangling links aside ("we simply remove them from the system until all the PageRanks are calculated"), are from the technical report "The PageRank Citation Ranking: Bringing Order to the Web" (Page, Brin, Motwani, Winograd).

  Fix: "Brin and Page's 1998 paper on Google writes (1 − d) without dividing by N, which gives the same ranks multiplied by N. Their PageRank technical report set dead ends aside during the calculation; sharing their rank out evenly, as here, is the usual modern convention." Sources: https://www.macs.hw.ac.uk/~dwcorne/Teaching/AnatomyOfSearchEngine.pdf, https://www.seroundtable.com/archives/014335.html, https://pi.math.cornell.edu/~levine/4740/2013/DeeperInsidePageRank.pdf

All other facts check out: Page and Brin as Stanford PhD students, 1998, d = 0.85 ("We usually set d to 0.85"), and 52 rounds on 322 million links.

## Model issues
- **medium**, IterateScene.svelte:53–58, 465. "Total change" is the L1 distance Σ|r_k − r_(k−1)|, but the readout says "X% of all rank moved". Total rank is conserved, so every unit that moves is counted twice: once where it leaves and once where it arrives. Round 1 on EXAMPLE shows "61.4% of all rank moved" when 30.7% actually changed pages. Fix: either compute `0.5 * r.reduce(...)` for the readout and chart, or keep the sum and relabel the line `round ${shownRound}: total change ${…}%`.
- **low**, e2e/pagerank-model.e2e.ts:86–105. The tests check real properties, which is good, but not the numbers the page states.
  - The test comment says "barely do better than double it", but it only asserts `farmed < fromA/2`.
  - Fix: assert `fromA / base` toBeCloseTo(6, 0) and `farmed / base` toBeCloseTo(2.2, 1).
  - Add assertions that C is the top page in EXAMPLE and A the top page in STARTER.
  - Add a test with E linking back to a five-page farm, asserting it exceeds `fromA`. That test would have caught the error above.

## Narrative and scene mismatches
- **medium**, steps.ts:134 (converge). "After thousands of hops, the share … stops changing, and restarting with a new surfer gives the same shares." At the step's default of 60 hops/s, its 24 s cover about 1,440 hops. My Monte Carlo on EXAMPLE puts the median largest error at that point at 0.8 points (90th percentile 1.4); at 20,000 hops it is still 0.2 points. Since the readout shows one decimal, the shares visibly keep moving and restarts disagree. Fix: "After thousands of hops the shares hardly change any more, and a new surfer ends up with nearly the same shares; the longer it runs, the closer they get."
- **low**, steps.ts:200 (compute). The text says "every page passes 85%", but the `damping` param persists from the traps step, where the reader was told to set it to 100%. The compute step can therefore open at 100%. Fix: reset the slider when the compute step is entered, or say "passes a share d of its rank (85% unless you changed the slider)".

The quoted vote counts, the A/B callouts, the 2.5% floor, D+E ≈ 71% at 85%, and convergence ("a handful of rounds", a few dozen giving many decimals; the second eigenvalue is 0.60) all match the model.

## Catalogue requirements
The interaction is built as written: build a web, a random surfer with jumps, visit counts converging to the rank ticks, and a boost task. The takeaway is visible in the bars and page sizes, and the topic has no Needs or Pitfall to satisfy. The only gap is the boost step's lesson (see Factual errors).

## Clarity
- **low**, steps.ts:174. "Make a ring where each page links to the next: every page gets the same rank" only holds if the ring takes in every page and there are no other links, but the starter web already has extra links. Fix: "Make a ring through all the pages, with no other links: every page gets the same rank."

## Sources consulted
- Brin & Page, *The Anatomy of a Large-Scale Hypertextual Web Search Engine* (1998): https://www.macs.hw.ac.uk/~dwcorne/Teaching/AnatomyOfSearchEngine.pdf
- Page, Brin, Motwani, Winograd, *The PageRank Citation Ranking* (52 iterations, dangling links): https://www.academia.edu/122165247/The_PageRank_Citation_Ranking_Bringing_Order_to_the_Web ; https://www.seroundtable.com/archives/014335.html
- Langville & Meyer, *Deeper Inside PageRank* (history, dangling-node handling): https://pi.math.cornell.edu/~levine/4740/2013/DeeperInsidePageRank.pdf
- Leskovec, Rajaraman, Ullman, *Mining of Massive Datasets*, ch. 5 (spam farms): http://infolab.stanford.edu/~ullman/mmds/ch5.pdf
- My own recomputation of the model in Python: exact ranks for all three presets, convergence and eigenvalues, the boost scenarios, and a Monte Carlo of surfer error against hop count.
