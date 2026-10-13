<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.73 in tokens + 6 web searches -->
# Review: epidemics

## Verdict
The page is ready after the small fixes below. Every number, date and citation I checked is correct, the model is a faithful stochastic SIR, and the tests check real properties from theory (final size, peak at S = 1/R₀, extinction chance 1/R₀). The most important fix is the seasonal-flu marker on the herd-immunity chart. It places flu's R ≈ 1.3 on the R₀ axis and labels it "threshold 23%". That contradicts the page's own note that 1.3 already includes existing immunity and so is lower than a true R₀.

## Factual errors
All claims I checked are correct:
- Kermack & McKendrick, 1927.
- Seasonal flu ≈ 1.3, the median of 47 estimates. Biggerstaff et al. report that twenty-four studies gave 47 seasonal R values with a median of 1.28 (IQR 1.19–1.37).
- Measles 12–18. Guerra et al. note that measles R₀ "is often cited to be 12–18".
- WHO's 95% coverage target with two doses. Elimination is "usually achieved with about 95% coverage with two doses".
- Fine, Eames & Heymann 2011 (Clin Infect Dis 52(7):911–916).
- Final sizes of 80% and 94%, the 6% who escape, the thresholds of 50/67/90% and 92–94%, 3¹⁰ = 59,049, the doubling time of 2.4 days, extinction chance 1/R₀ under a geometric offspring count, and the claim that a fixed infectious period gives a lower extinction chance.

## Model issues
- **low**, model.ts:229 and 240–270: **the infectious period is rounded up to whole time steps.** Recovery is only checked at the end of each 0.1-day step, so on average a case stays infectious about DT/2 longer than drawn. That inflates the real R₀ by DT/(2D): about 0.7% at D = 7 and 2.5% at D = 2. I confirmed this by simulation: R₀ = 3, D = 2 gives 3.10 secondary cases per case. **Fix:** only count a meeting if it happens before the case recovers. In `#tick`, draw the meeting time first and use it for both checks:
  ```ts
  const when = day + this.#rand() * DT;
  if (when >= this.recoversAt[k]) continue;
  const infected = this.state[j] === State.Susceptible && this.#rand() < this.#chance && !newly.some(([w]) => w === j);
  if (infected) newly.push([j, k]);
  this.contacts.push({ from: k, to: j, day: when, infected });
  ```
  This also stops the case-view timeline from drawing meetings after "recovered".
- **low**, e2e/epidemics-model.e2e.ts: **no test checks the mean number of secondary cases.** The β test measures infections per infectious person-day, so it cannot see an error in the duration of infection. **Fix:** add a test: in a crowd of 20,000 with 20 initial cases, the mean of `secondary[k]` over the initial cases should be within ±5% of R₀ for (R₀, D) = (3, 7) and (3, 2).
- **low**, model.ts:363: **the doc comment does not match the parameter.** It says "when a share `immune`…", but the parameter is `susceptibleShare`. **Fix:** "Effective reproduction number when a share `susceptibleShare` of people can still be infected."

## Narrative and scene mismatches
- **medium**, ThresholdScene.svelte:125–137 and 334–337: **the flu marker sits on the R₀ axis.** The R₀ step's note (steps.ts:114) says flu's 1.3 is lower than a true R₀ because many people already have some immunity. The chart still puts 1.3 on the axis labelled "R₀: people each case infects when nobody is immune" and gives it a herd-immunity threshold of 23%. **Fix:** keep the ring, change line 334 to `'seasonal flu: R ≈ 1.3'`, and change line 335 to `'already net of existing immunity'`. Or drop the threshold line.
- **low**, CrowdScene.svelte:226: **"never did" leaves out the vaccinated.** In a vaccinated crowd, "Over by day X: 87 caught it, 63 never did" ignores the 150 vaccinated people, who also never caught it. **Fix:** ``: `Over by day ${Math.floor(end)}: ${crowd.counts.r} caught it, ${crowd.counts.s} ${crowd.counts.v > 0 ? 'unvaccinated people ' : ''}never did` ``.

Everything else matches. The quoted numbers (3, 9, 27, 81; the doubling time; 1/R₀; 6%; 1 in R₀) are what the scenes compute, and the controls behave as the text says.

## Catalogue requirements
All met. The interaction is built as written: R₀, infectious period and vaccinated-share sliders, a moving crowd and a live S/I/R plot. The takeaway is visible in the graphic: the "each case now infects" gauge crosses 1, and the threshold chart separates growth from die-out. The well-mixed simplification is stated on the page. The entry has no Pitfall or Needs.

## Clarity
- **low**, steps.ts:91: **the well-mixed rule only appears in the notes.** The body says "Each line is a meeting", but the lines often cross the whole field, and the reason is only in "Go deeper". **Fix:** "While infectious it keeps meeting people, about four a day on average, picked at random from the whole crowd wherever they stand. Each line is a meeting."
- **low**, TreeScene.svelte:367–369 and SirScene.svelte:284–285: **symbols appear in the graphic before the body explains them.** The graphic shows "ln 2 / r" and "β · S · I / N, β = R₀/D", but the body text (level 1) never introduces r, ln or β; only the notes do. **Fix:** in the exponential step body, add "(the chart's r is the growth rate per day)". In the compartments body, change the S → I bullet to end "…many of both. The diagram writes this as β·S·I/N, where β = R₀/D."
- **low**, steps.ts:191: **"keeps going downhill" can be misread.** It could mean cases are falling, not that infections continue on the way down. **Fix:** "So the epidemic keeps infecting people on its way down, pushing the susceptible share well below 1/R₀."
- **low**, steps.ts:220: **the change at 70% is gradual in a crowd of 300.** I simulated 300 runs of a Python re-implementation of the model. At 65% vaccinated (just below the threshold), runs already end after a median of 12 cases, against 9 at 70%. A reader may conclude the threshold sits lower. **Fix:** after "never takes off", add: "In a crowd this small the change is gradual; the next step shows where the line really is."

## Sources consulted
- Biggerstaff et al. 2014, BMC Infect Dis: https://link.springer.com/article/10.1186/1471-2334-14-480
- Guerra et al. 2017, Lancet Infect Dis: https://www.researchgate.net/publication/318751687_The_basic_reproduction_number_R0_of_measles_A_systematic_review
- Fine, Eames & Heymann 2011: https://researchonline.lshtm.ac.uk/1077/ and https://www.mendeley.com/catalogue/88e2f18a-6cca-3a2a-912e-c2bae8017b01/
- Kermack & McKendrick 1927, Proc. R. Soc. A 115:700–721: https://jxshix.people.wm.edu/2009-harbin-course/classic/Kermack-McKendrick-1927-I.pdf
- WHO 95% two-dose target: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7349949/
- My own checks: Python re-implementations of the crowd model (time-step bias; outbreak sizes at 65–80% vaccinated) and analytic checks of `finalSize`, the bisection bracket, the tree arithmetic and 1/(1−R).
