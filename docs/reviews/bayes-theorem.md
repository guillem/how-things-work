<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.30 in tokens + 4 web searches -->
# Review: bayes-theorem

## Verdict
The page is ready after the fixes below. I re-derived every number the page quotes from the model and the formulas, and all of them are correct: 10 ill / 990 healthy, 9 / 1 / 89 / 901, 9 of 98 ≈ 9.2%, more than 80% at 30% prevalence (81.1%), exactly 50% for a 99%/99% test, and 9.2% → 50.3% after a second positive. The worked example is Gigerenzer's real mammography problem. The most important fix is a drawing bug: for some slider settings, the outline around the positives draws a stray line across non-positive cells (see Model issues). The other fixes are small: wording about the second test, the history of the theorem, and how prevalence is rounded in labels.

## Factual errors
- **low** — steps.ts:59: "Most people — doctors included, in many studies — guess around 90%." In Gigerenzer's study of 160 gynecologists, the most common answers were 81% or 90%, not just 90%. Fix: "Most people — doctors included, in many studies — guess 80–90%." Source: "The response alternatives were 1%, 10%, 81%, and 90%. The majority of gynecologists (60%) thought the chances were 81% or 90%" (https://www.stat.auckland.ac.nz/~iase/publications/icots8/ICOTS8_PL3_GIGERENZER.pdf).
- **low** — steps.ts:104 (text and the `dfn` tooltip): "The counting you just did is Bayes' theorem, published in 1763…" overstates what Bayes published. His essay dealt with one special problem: estimating the probability parameter of a binomial distribution. The general formula in the tooltip came later, from Laplace. The essay was read to the Royal Society in 1763 and printed in the volume dated 1763. Fix: "…is <dfn…>Bayes' theorem</dfn>, named after the minister Thomas Bayes, whose essay on it was read to the Royal Society in 1763, two years after his death; Laplace later gave it its general form:". In the tooltip, replace "Published after the death of Thomas Bayes, in 1763." with "Named after Thomas Bayes (essay read posthumously in 1763); general form due to Laplace." Sources: Bayes' "work was published in 1763 as An Essay Towards Solving a Problem in the Doctrine of Chances. Bayes studied how to compute a distribution for the probability parameter of a binomial distribution" (https://en.wikipedia.org/wiki/Bayes%27_theorem). Laplace's work was "independently rediscovered and further developed by Laplace, who first published their modern formulation in his 1812 Théorie analytique des probabilités" (https://arxiv.org/pdf/1305.0041). Bayes is also described as "known for formulating a specific case of the theorem that bears his name" (https://en.wikipedia.org/wiki/Thomas_Bayes).
- Everything else checks out. The Gigerenzer example really uses 1%, 90% and 9% (https://www.stat.berkeley.edu/~aldous/157/Papers/health_stats.pdf), Bayes was a Presbyterian minister, and Price presented the essay after Bayes's death.

## Model issues
- **medium** — GridScene.svelte:114–128 (`outline`): when the run of positives spans exactly two rows and ends at or left of the column where it starts (`rb === ra + 1 && cb <= ca`), the two pieces don't overlap horizontally. The single polygon then traces a doubled horizontal line between them, across cells that are not positives. You can reproduce it in the sliders step with prevalence 5%, sensitivity 50%, specificity 99%: FN = 25 and about 34 positives, so `ca = 25`, `cb ≈ 19`. Fix: insert this before the final `return`:
  ```ts
  if (rb === ra + 1 && cb <= ca)
  	return (
  		`M${X(ca)} ${Y(ra)}H${X(COLS)}V${Y(ra + 1)}H${X(ca)}Z` +
  		`M${X(0)} ${Y(rb)}H${X(cb)}V${Y(rb + 1)}H${X(0)}Z`
  	);
  ```
- **low** — bayes.ts:67–79 and GridScene.svelte:4–8, 66–73: the model's `grid()` orders the cells tp, fn, fp, tn. The scene ignores it and uses its own order (fn, tp, fp, tn), which keeps the positives in one block. The test at e2e/bayes-model.e2e.ts:27 therefore checks a function the page never uses. Fix: change `grid()` to `[...fn, ...tp, ...fp, ...tn]`, update its doc comment, and have the scene's `groupOf` read from `grid(c)[i]`.
- **low** — e2e/bayes-model.e2e.ts: there are no limiting-case tests. Suggested additions: `ppv({prevalence: 0.01, sensitivity: 0.9, specificity: 1})` is 1 (no false positives); PPV equals prevalence when sensitivity = 1 − specificity (an uninformative test); and PPV rises steadily with prevalence.
- Apart from these, the equations, the rounding (the four groups always add up to n) and the second-test update (the first result becomes the new prior, assuming the tests are independent given disease status) are correct. Within the slider ranges `positives` can never be 0, so there is no NaN.

## Narrative and scene mismatches
- **medium** — steps.ts:107 and GridScene.svelte:339–341: the text says "confirm … with a second, **different** test" and "a second positive from an independent test raises the chance to about 50%". But `secondTest` reuses the same sensitivity and specificity (90%/91%). A different test would have different numbers, so the 50% only holds for an equally accurate one. Fix in steps.ts: "…and a second positive from an independent test that is just as accurate raises the chance to about 50%." Fix the card label to: "After a second positive from an equally" / "accurate, independent test:".
- **low** — steps.ts:13 and GridScene.svelte:143, 322: prevalence moves in steps of 0.1%, but at or above 1% it is shown with no decimals. At 1.5% the control reads "2% (15 in 1,000)" and the card reads "2% ill" while the grid shows 15 ill. Fix: use one decimal below 10% in both places. In steps.ts, `const pct = (v) => \`${+(v * 100).toFixed(v < 0.1 ? 1 : 0)}%\``, and use the same rule in the scene's `pp`.
- Otherwise, the hard-coded card text (test, crowd and positives phases) appears only in non-live phases, which always use EXAMPLE, so it always matches the numbers shown. Every number the narrative quotes matches what the model computes.

## Catalogue requirements
- **low** — steps.ts:42: the page title "What a positive test really means" differs from the catalogue Title "Probability & Bayes' theorem", which the catalogue defines as the display name. Fix: `title: "Probability & Bayes' theorem"`, and keep the current phrase in `summary` or as a subtitle if wanted.
- The Interaction is built as written: three sliders, a grid of 1,000 people coloured into the four groups, and the share read off by counting. The Takeaway is visible in the graphic itself: the outlined positives and the true/false bar. There are no Needs or Pitfall to check.

## Clarity
- **low** — steps.ts:106: "Each part is one of the groups in the grid: true positives on top, all positives below." The formula has three factors, and only their combinations match groups. Fix: "Each side is a group in the grid: the top, chance positive if ill × chance ill, is the share of everyone who are true positives (9 in 1,000); the bottom is the share who test positive (98 in 1,000)."
- **low** — steps.ts:104 (tooltip): the "P(A | B)" notation is not explained, and readers at level 1 may not know it. Fix: add "(read 'the probability of A given B')" after the formula.

## Sources consulted
- Gigerenzer, "Helping Doctors and Patients Make Sense of Health Statistics" (2007): https://www.stat.berkeley.edu/~aldous/157/Papers/health_stats.pdf and https://journals.sagepub.com/doi/full/10.1111/j.1539-6053.2008.00033.x
- Gigerenzer, ICOTS8 plenary: https://www.stat.auckland.ac.nz/~iase/publications/icots8/ICOTS8_PL3_GIGERENZER.pdf
- Stigler, "The True Title of Bayes's Essay", *Statistical Science* 28(3): https://projecteuclid.org/journals/statistical-science/volume-28/issue-3/The-True-Title-of-Bayess-Essay/10.1214/13-STS438.pdf
- https://en.wikipedia.org/wiki/Bayes%27_theorem ; https://en.wikipedia.org/wiki/Thomas_Bayes
- https://arxiv.org/pdf/1305.0041 (on Laplace's modern formulation)
