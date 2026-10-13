<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.59 in tokens + 8 web searches -->
# Review: oscillations-resonance

## Verdict
The page is ready after the fixes below. The physics is right. I checked the RK4 integrators term by term, and the formulas for the natural frequency, damping ratio, steady amplitude, peak frequency and the decay envelope are all correct. The numbers the page quotes also hold up: 2.006 s for a 1 m pendulum, ×2 for four times the length, 18.0 % slower at 90° (exact elliptic-integral ratio 1.1803), 0.99 Hz, and 2.6 cm of hand travel. The most important fix is the **"your push is right on it" label**. It appears up to 0.12 Hz from the peak, but the peak's half-width is only 0.024 Hz, so the label can show while the swing is about a fifth of its peak size. A close second is the **precompute-and-loop clock**: with light friction it freezes or jumps once the precomputed time runs out. One historical note, the Millennium Bridge, should also be reworded.

## Factual errors
- **low**, steps.ts:122. "Huygens built the first pendulum clock in 1656" is not quite right. Huygens designed it, but Salomon Coster (c. 1620–1659) was a Dutch clockmaker of the Hague, who in 1657 was the first to make a pendulum clock, which had been invented by Dutch mathematician Christiaan Huygens. Replace with: "Christiaan Huygens invented the pendulum clock in 1656, and the Hague clockmaker Salomon Coster built it the next year." Source: https://en.wikipedia.org/wiki/Salomon_Coster
- **low**, steps.ts:121. "kept the world's time for three centuries" overstates slightly. Pendulum clocks led from the year 1656 until the 1930s, which is about 275 years. Replace with "for nearly three centuries". Source: https://simple.wikipedia.org/wiki/Pendulum_clock
- **low**, steps.ts:146. "engineers add damping … so wind and earthquakes can't push them into resonance" is inaccurate. Damping doesn't stop resonance; it lowers the peak, which is what the page's own curve shows. Replace with: "…so that wind and earthquakes pushing at their natural frequency can't build up a large sway."
- **low**, steps.ts:95. "Any object pulled back … by a force that grows with the distance oscillates." The next step shows that heavy friction stops the swing, so this contradicts it. Replace with: "…oscillates, unless friction is strong enough to stop it."
- The Galileo dates (1602 letter, lamp legend about 20 years earlier), the wine glass, radio tuning and soldiers breaking step all check out.

## Model issues
- **medium**, DrivenScene.svelte:61,72 and SpringScene.svelte:65,77–78 (via osc.ts `loopTime`). The motion is computed for 90 s (driven) or 120 s (free). After that, the scene replays the last period, which assumes the motion has already settled. With light friction it hasn't:
  - **Driven, c = 0.05:** about 11 % of the start-up swing is still there at 90 s, and it runs at f₀, not at the push frequency. Each replayed push period therefore ends in a visible jump.
  - **Driven, c = 0:** the swing that "grows without limit" stops changing at 90 s.
  - **Free spring, 4 kg and c = 0.05:** 22 % of the energy is left at 120 s, and the "energy left" readout then stays there for ever.

  Fix: keep the state and integrate forward as the clock advances, instead of replaying a fixed buffer. A cheaper option is to stretch the window to the decay time, e.g. `const END = c > 0 ? Math.min(600, Math.max(90, 8 * 2 * m / c)) : 600;`, and for c = 0 extend the computation in chunks rather than looping.
- **low**, e2e/oscillator-model.e2e.ts:43–46,56. The tests are too loose to catch real errors:
  - `toBeCloseTo(2.006, 1)` allows ±0.05 s, about 2.5 %.
  - The 90° check is only `> 1.15`, while the page claims 18 %.
  - "narrower" is asserted in a comment but never tested.
  - All tests use k = 4π² rather than the k = 39 the page actually uses.

  Add:
  ```ts
  const exact90 = 1.18034; // 2K(sin²45°)/π
  expect(measuredPeriod(pendulumMotion(1, 90, 20, 0, S), S) / pendulumPeriod(1)).toBeCloseTo(exact90, 3);
  expect(measuredPeriod(pendulumMotion(1, 10, 20, 0, S), S) / pendulumPeriod(1)).toBeCloseTo(1.0019, 3);
  const page = { m: 1, k: 39, c: 0.3 };
  expect(naturalFrequency(page)).toBeCloseTo(0.9939, 4);
  // half-width ≈ ζ f₀: amplitude at fp ± ζf₀ ≈ Ap/√2
  const z = dampingRatio(page), fp = peakFrequency(page), Ap = steadyAmplitude(page, { F0: 1, f: fp });
  expect(steadyAmplitude(page, { F0: 1, f: fp + z * naturalFrequency(page) }) / Ap).toBeCloseTo(Math.SQRT1_2, 1);
  ```

## Narrative and scene mismatches
- **medium**, DrivenScene.svelte:140. `Math.abs(f - fp) < 0.12` shows "your push is right on it" and hides the "your push" label far too widely. At the default friction the peak's half-width is only ζf₀ ≈ 0.024 Hz. At 0.88 Hz the steady swing is 12 cm against a 53 cm peak, yet the label still says "right on it". Replace with:
  `const atPeak = $derived(!noPeak && (Number.isFinite(Ap) ? A >= 0.9 * Ap : Math.abs(f - fp) < 0.01));`
- **medium** (moderate confidence: depends on whether the framework keeps slider values between steps), SpringScene.svelte:56–57 with steps.ts:106. The damping step reads `params.mass` and `params.stiffness` but shows neither as a control or readout. If a reader left 4 kg and 160 N/m on step 1, critical damping is 50.6 N·s/m, the friction slider tops out at ζ = 0.30, and the promised "doesn't swing at all" can't be reached. Fix: add `controls: [damping, mass, stiffness, release]` to the damping step. Alternatively, in the damping phase use m = 1 and k = 39, or set the slider's maximum from 2.4·√(km).
- **low**, DrivenScene.svelte:149,190. With c = 0 the card says "steady swing: none", but the curve marker still sits at a finite steady amplitude F₀/|k − mω²|. Fix: when `c === 0`, draw the marker at the top of the axis with the label "no friction: never settles".
- **low**, steps.ts:145. "a sharp peak at the natural frequency" doesn't mention that with heavy friction the scene itself reports the peak sliding lower ("peak at 0.27 Hz", then "no peak"). Append: "More friction flattens it and slides it a little lower."

## Catalogue requirements
- **low**, DrivenScene.svelte:57–59. The driven spring is fixed at 1 kg on 39 N/m, so the reader sees only one oscillator peak at its own natural frequency. That leaves "*every* oscillator has a natural frequency" untested. Fix: add `stiffness` to the curve step's controls, with `k = Number(params.stiffness ?? 39)` and `hand = F0 / k`. The peak would then visibly follow the "natural frequency" readout.
- **low**, DrivenScene.svelte:113–127. The entry says "plot the resulting amplitude against that frequency", but the curve is drawn whole from the formula. Consider adding a dot at each push frequency the reader has tried, at the simulated steady swing (the last 5 s of `motion`). The reader's own results would then build the curve.
- Otherwise the entry is met: the interaction is built as written, the takeaway shows in the graphic, and there is no pitfall or Needs field.

## Clarity
- **low**, SpringScene.svelte:155–157. The card shows "damping ratio 0.024", but the text never explains it. Add to steps.ts:109: "The damping ratio compares the friction with the amount that just stops the swing: below 1 it swings, at 1 or more it creeps back."
- **low**, steps.ts:96. The definition of natural frequency ("when disturbed and left alone") is actually the *damped* frequency, which the damping-step card shows as different ("swings at … / natural …"). Replace with: "The frequency at which an oscillator swings when disturbed and left alone, without friction, in swings per second (hertz, Hz)."
- **low**, steps.ts:120. "a full swing" is ambiguous; many people count one way as a swing. Use "a full swing, there and back".

## Sources consulted
- https://en.wikipedia.org/wiki/Salomon_Coster
- https://simple.wikipedia.org/wiki/Pendulum_clock
- https://www.sciencedaily.com/releases/2021/12/211215204114.htm
- https://advances.sciencemag.org/content/3/11/e1701512
- https://lacasadelaarquitectura.es/en/resource/millennium-bridge-london/d1d01028-97b5-4678-ba10-49738a8d1604
- https://sites.pitt.edu/~pap7/A%20Phenomenology%20of%20Galileos%20Experiments%20with%20Pendulums%20with%20Supporting%20Document.pdf (Galileo's 1602 letter)
- My own calculations: the exact large-angle pendulum period via the complete elliptic integral (T/T₀ = 1.1803 at 90°, 1.0019 at 10°), and the page spring's ζ = 0.024, Q = 20.8, peak 53.4 cm, half-width 0.024 Hz, and start-up swing remaining at 90 s.
