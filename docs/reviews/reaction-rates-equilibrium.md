<!-- batch msgbatch_01DfdyDAKXUp9YpkBnuBooBG, claude-opus-5-5, submitted 2026-10-14T12:43:27.198Z, ~$0.95 in tokens + 13 web searches -->
# Review: reaction-rates-equilibrium

## Verdict
The page is ready once the fixes below are made. I recomputed every number the narrative quotes from the model's own fits, and all of them hold: E<sub>a</sub> 171 and 183 kJ/mol, ΔH −12.2 kJ/mol, A 3.7 × 10¹¹ L mol⁻¹ s⁻¹, k(700 K) 0.063 L mol⁻¹ s⁻¹, K 52, 61 and 42, 78 % HI, half-lives of 30–31 min, 4.3 min and 4.9 h, factors of ×1.5, ×68, ×31, ×6.9 × 10⁵ and ×196, 1 collision in 5.9 × 10¹², and 0.0087 mol/L at 5.2 × 10²¹ molecules per litre. The catalogue entry is built as written, and the pitfall (a catalyst does not move the equilibrium) is avoided. **The most important fix is a performance bug.** On the "heat" step, switching the gold catalyst on makes `simulate` take 10⁸–10⁹ Runge–Kutta sub-steps every time it runs, which freezes the browser. After that, remove the link to the unbuilt acids-bases page, and make clear that the "700 000 times" speed-up comes from the model, not from a measurement on gold.

## Factual errors
- **Medium**, steps.ts:211–212 and 268. The text says, as a fact about gold, that the full 78 kJ/mol makes the reaction "700 000 times" faster and reach equilibrium "700 000 times sooner". That figure only follows from the page's own simplification (same pre-factor A, same second-order rate law). On gold the decomposition is a surface reaction (Hinshelwood & Prichard's paper is titled "The catalytic decomposition of hydrogen iodide on the surface of gold"). Its textbook rate law is zero order, so the real speed-up depends on the area of gold, not only on the barrier. The notes say this, but the body states the number unconditionally. Fix:
  - line 212: "…the full 78 kJ/mol, <strong>700 000 times</strong>, if nothing else about the reaction changed."
  - line 268: "…in this model the mixture reaches equilibrium about 700 000 times sooner…"
  
  Sources: https://www.mdpi.com/1996-1073/14/24/8539 (reference list), https://link.springer.com/article/10.1007/BF03214632
- **Low**, steps.ts:133. "every number on this page comes from his data" is not true. The gold barrier comes from Hinshelwood & Prichard, the cross-check from Taylor & Crist, the ammonia ΔH from elsewhere, and the gas speeds from kinetic theory. Fix: "every rate and equilibrium number for this reaction comes from his data."
- **Low**, steps.ts:244. "in a real flask, with 10²¹ molecules": at 1 atm and 700 K a litre holds 1.05 × 10²² molecules (step 4 correctly says 5 × 10²¹ of each). Fix: "with 10²² molecules in a litre".
- **Low** (moderate confidence), steps.ts:244. "the law of mass action as Guldberg and Waage stated it in 1864: at equilibrium the forward and reverse rates are equal". Their 1864 paper set two opposing chemical "forces" equal; the rate (dynamic) form came in 1879. Fix: "Guldberg and Waage proposed the law of mass action in 1864 as a balance of two opposing 'forces', and in 1879 recast it as equal forward and reverse rates." Sources: https://en.wikipedia.org/wiki/Law_of_mass_action, https://arxiv.org/pdf/2007.08225
- **Low**, model.ts:99–100 (code comment only). The Hinshelwood & Prichard reference is cited elsewhere as J. Chem. Soc. 127, 1551–1555 (1925), not page 1552. Source: https://link.springer.com/article/10.1007/BF03214632
- **Not verified:** "Taylor and Crist (1941) found 22.3 % of HI split at 730.8 K" (steps.ts:244). I confirmed the paper exists (J. Am. Chem. Soc. 63, 1377–1385) and that it is regarded as the most accurate determination, but I could not reach its table. The K = 48.6 that follows from 22.3 %, and the 47.7 from the model, are both arithmetically right. Please check the 22.3 % against the paper. Sources: https://atct.anl.gov/Thermochemical%20Data/version%201.122o/bibliography/?bib_number_search%5B%5D=611&bib_number_search%5B%5D=977, https://www.osti.gov/pages/servlets/purl/1991587

## Model issues
- **High**, model.ts:249–251 together with FlaskScene.svelte:161–175. **The heat step freezes the browser when gold is on.**
  - The sub-step count is `ceil(dt·λ·20)`, and the heat step uses a fixed lapse of 600 s, so dt = 30 s.
  - With gold, λ at equilibrium is 12 s⁻¹ at 600 K, 211 s⁻¹ at 700 K and 1 206 s⁻¹ at 780 K. That is 7 × 10³ to 7 × 10⁵ RK4 sub-steps per record, over 3 000 records: about 2 × 10⁷ to 2 × 10⁹ iterations, each allocating several objects.
  - The run is rebuilt on every temperature slider tick (and from the start after "Start again" with gold on).
  - The catalyst and catalysteq steps are not affected, because their `'auto'` lapse keeps dt·λ small.
  
  Fix: when an interval is stiff, use the exact solution the model already has, and integrate the gross counts on log-spaced points:
  ```ts
  if ((stop - t) * lambda > 50) {
  	const c = { T, lowering };
  	const m0 = m;
  	const span = stop - t;
  	const h0 = 1 / (20 * lambda);
  	const N = 200;
  	let prevT = 0;
  	let prev = rates(m0, T, lowering);
  	for (let i = 1; i <= N; i++) {
  		const tt = i === N ? span : Math.min(span, h0 * Math.pow(span / h0, i / N));
  		const mi = mixAt(m0, c, tt);
  		const ri = rates(mi, T, lowering);
  		done += ((prev.forward + ri.forward) / 2) * (tt - prevT);
  		undone += ((prev.reverse + ri.reverse) / 2) * (tt - prevT);
  		prev = ri;
  		prevT = tt;
  		m = mi;
  	}
  	t = stop;
  	while (next < todo.length && todo[next].at <= t + 1e-12) apply(todo[next++]);
  	continue;
  }
  ```
  Also add a test: `simulate(equilibriumMix(START, 780), at(780, GOLD_LOWERING), [], 90000, 30)` must finish in well under a second (or count sub-steps and bound them).
- **Low**, bodenstein.ts:10–11, and steps.ts:146 ("all of his 19 measurements"). The comment says the values are copied unchanged from every row of Giunta's pages. The kinetics page I retrieved lists 8 decomposition and 9 formation rows. It has no 283 °C row in either table, so it gives 17 measurements, not 19. The extra decomposition value (9.42 × 10⁻⁷) is exactly OpenStax's 555 K value × 2.676, which raises the possibility that it was back-computed from OpenStax, in which case it would be circular inside the `UNIT` calibration. Removing both 283 °C rows changes E<sub>a</sub> by 0.2 kJ/mol and k(700 K) not at all, so the numbers on the page stand. Fix: cite the original 1899 table for the 283 °C rows, or drop them, set T_MIN to 575 K and say "17 measurements". Sources: https://web.lemoyne.edu/giunta/classicalcs/bodenkin.html, https://openstax.org/books/chemistry/pages/12-5-collision-theory
- **Low**, CollideScene.svelte:41. The energy of the rare reacting collision is `EA + energyOf(...) * 0.6`, an excess with mean 0.6 RT. The docstring (lines 10–11) says the excess is exponential like the real distribution, whose mean is RT. Fix: drop the `* 0.6`, or change the comment.
- The rest checks out against a reference in one line: the van 't Hoff and Arrhenius fits, detailed balance (k<sub>r</sub> = k<sub>f</sub>/K), the closed-form `mixAt`, the bisection in `equilibriumMix` (g is monotonic on the interval) and atom conservation. ΔH = −12.2 kJ/mol at about 700 K agrees with thermochemistry (−9.7 kJ/mol at 298 K, plus ΔC<sub>p</sub> ≈ −7 J mol⁻¹ K⁻¹). The decomposition-only fit gives 186 kJ/mol, as the notes say.

## Narrative and scene mismatches
- **Low**, steps.ts:170 ("Each flash is a collision that got over the barrier"). During the 28 s of the rate step at 10 min per second, the box shows about half a dozen pink reverse flashes, and the key under the box labels them 2 HI → H₂ + I₂. The reverse reaction is only introduced three steps later. Fix: add "(the few pink ones are the reaction running backwards, which comes later)".
- Everything else matches what the scenes draw: the readouts, the time-lapse values (600 s and 300 s), the box counts (30 + 30, 60 at equilibrium, 15 or 60 H₂), the log-axis labels and "more than 4 times this chart's width".

## Catalogue requirements
- **Medium**, steps.ts:240. `<a href="../acids-bases/#weak">Acids, bases and pH</a>` links to a topic that is not built (it is unticked in the checklist), so the link is dead. It is also not a prerequisite, so the sentence assumes knowledge the reader may not have. The shell will add the Related link once that page exists. Fix: delete ", as in the weak acids of <a …>Acids, bases and pH</a>".
- The interaction, takeaway and pitfall are all met: the forward and reverse rate curves visibly meet, and the catalyst lands on the same equilibrium line.

## Clarity
- **Medium**, steps.ts:227. "Its rate constant k<sub>r</sub> is 52 times smaller than the forward one, but it grows as HI builds up." Grammatically "it" is the rate constant, which does not change. Fix: "…smaller than the forward one, but the reverse <em>rate</em> grows as HI builds up."
- **Low**, steps.ts:171. The rate definition says "How much reactant is used up (or product made) per litre per second", but here HI is made at twice that rate. Fix: "How many times the reaction happens per litre per second, in mol L⁻¹ s⁻¹ (here HI is made twice as fast)."

## Sources consulted
- Giunta, Bodenstein kinetics (data tables): https://web.lemoyne.edu/giunta/classicalcs/bodenkin.html and teaching notes https://web.lemoyne.edu/giunta/classicalcs/bodenkinnote.html
- OpenStax Chemistry 2e §12.5 (HI decomposition k from 555 to 781 K): https://openstax.org/books/chemistry/pages/12-5-collision-theory
- Sullivan, J. Chem. Phys. 46, 73 (1967): https://pubs.aip.org/aip/jcp/article-pdf/46/1/73/18849327/73_1_online.pdf and C&EN report https://pubs.acs.org/doi/10.1021/cen-v045n003.p040
- Taylor & Crist 1941 bibliographic record (ATcT): https://atct.anl.gov/Thermochemical%20Data/version%201.122o/bibliography/?bib_number_search%5B%5D=611&bib_number_search%5B%5D=977, and its evaluation in https://www.osti.gov/pages/servlets/purl/1991587
- Hinshelwood & Prichard citation: https://link.springer.com/article/10.1007/BF03214632, https://www.mdpi.com/1996-1073/14/24/8539
- Law of mass action history: https://en.wikipedia.org/wiki/Law_of_mass_action, https://arxiv.org/pdf/2007.08225
- My own recomputation of the model's fits, quoted numbers and sub-step counts (a Python port of model.ts).
