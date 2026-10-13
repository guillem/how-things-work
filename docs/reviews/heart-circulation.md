<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.74 in tokens + 13 web searches -->
While the model runs, let me look up the facts.# Review: heart-circulation

## Verdict
The page is ready once the fixes below are made. I ported `circulation.ts` to Python and ran it. It reproduces every number the narrative quotes: 123/78 mmHg, 23/11 lung artery, 75 mL stroke volume, 5.6 L/min, 76 % returning O₂, 47 mL at 150/min (output ×1.26), diastolic 45 at 40/min, mean pressure 101→136 at 90 % width, 201 systolic at 80 %, 51 mL mitral backflow, aortic diastolic 35. The model's equations, constants and units hold up: the elastance and compliance values are in physiological ranges, the Fick arithmetic is right (15 × 1.34 × 10 = 201 mL O₂/L), and the Bernoulli leak formula Q = 50·A·√ΔP is derived correctly. The most important fix is in the "Faster and slower" step. It presents a model result as fact about real hearts, but in people, raising the heart rate alone hardly changes cardiac output. The other main fixes: the "Narrowed arteries" step quotes a mean pressure that no graphic shows, and the definition of systolic pressure puts the peak at the wrong moment.

## Factual errors
- **low**: steps.ts:116, note. "at its peak blood rushes through the open valves about twice as fast as in a real heart". The model has no valve areas, so it cannot say anything about speed; what it computes is flow (peak aortic 1,100 mL/s, peak mitral 900 mL/s). **Fix:** "…so at its peak blood flows through the open valves at about twice the rate it does in a real heart." (I could not find an authoritative peak-flow figure; confidence on the "twice" is moderate.)

The other facts check out, with sources where I searched: 108,000 beats a day; S1 and S2 timing; the role of the SA and AV nodes; P, QRS and T. The left ventricle wall is three times thicker (8-12 mm) than the right. Normal mixed venous saturation is about 70%–75%. Lung artery pressure of 25/10 is within normal (Normal pulmonary blood pressure is 20/10 (mean 15) mm Hg at rest). The Bernoulli relation v = √ΔP/2 and the Poiseuille ratios 1.52 and 2.44 are correct.

## Model issues
- **low**: circulation.ts:135–149. PR is scaled by √RR, which the code comment calls the same as Bazett. Bazett applies to QT, not PR. At 150/min this gives PR = 0.10 s, below the normal lower limit of 0.12 s that the test itself uses, and the fixed P wave (centre 0.05 s, σ 0.022 s) runs into the Q wave at 0.113 s, so the ECG on the rate step loses its PR segment. **Fix:** `const pr = Math.max(0.12, 0.16 * s);`, and keep the P wave inside it (for example centre `0.4 * pr`, σ `0.15 * pr`), with `ecgWaves().p` updated to match.
- **low**: circulation.ts:308–311, 454; scenes/heart.ts:47–49. When `steps = round(rr/DT)` is not a multiple of `every` (for example at 77/min, 1558 steps), the last sample falls before τ = rr. As a result, `sampleAt` divides by `SAMPLE` although the real spacing is 4h, `net()`/`passedAt` lose the last 1–3 steps of venous and lung-vein flow each beat, and the flow dashes jump slightly at the wrap. **Fix:** `const every = Math.round(SAMPLE / DT); const steps = every * Math.max(1, Math.round(T.rr / SAMPLE)); const h = T.rr / steps;` and in `sampleAt`/`backward` use `const dt = beat.timing.rr / (beat.t.length - 1);` in place of `SAMPLE`.
- **low**: e2e/circulation-model.e2e.ts. Several numbers the narrative quotes are not tested:
  - diastolic about 45 mmHg at 40/min;
  - over 200 mmHg at 80 % width (the model gives 201, so the claim breaks under any small retuning);
  - diastolic about 35 for the aortic leak is tested, but the "quarter more" output only within a loose 1.15–1.4.
  
  The leak formula itself is not tested either. **Fix:** add `expect(at({hr:40}).summary.aorta.dia).toBeGreaterThan(40); …toBeLessThan(50)`, `expect(at({width:0.8}).summary.aorta.sys).toBeGreaterThan(195)`, and `expect(leakFlow(1,-100)).toBeCloseTo(-500, -1)`. Also change the note to "about 200 mmHg" (see next section).

## Narrative and scene mismatches
- **medium**: steps.ts:141 against MonitorScene.svelte:230–257. The text says 10 % narrower arteries "raise the average pressure from about 100 to about 135 mmHg", but the narrow-step card shows only systolic/diastolic (156/114 against 123/78), so the reader cannot see 100 or 135 anywhere. **Fix:** either change the text to "…raise the blood pressure from about 120/80 to about 155/115 mmHg", or add the mean to the card cell: `sub: \`average ${Math.round(m.aorta.mean)}, healthy ${Math.round(h.aorta.mean)}\``.
- **medium**: steps.ts:153 against the leak card. "the pressure backs up into the lungs, which can make a person breathless", but at 0.4 cm² the model raises mean left-atrial pressure only from 7.4 to 9.6 mmHg (peak 11→13). On screen that looks like almost nothing, even though 0.4 cm² is the clinical threshold for severe regurgitation (Severe MR: > 0.40 cm 2). **Fix:** tone the sentence down to what the model shows: "…and the pressure in the left atrium, and behind it in the lungs, rises (only a little in this model, whose atrium and lung veins stretch easily; in a real sudden leak it can rise enough to make a person breathless)." Source: https://www.merckmanuals.com/professional/multimedia/table/grading-of-mitral-regurgitation
- **low**: steps.ts:142. "with arteries at 80% it passes 200 mmHg": the model gives 201/164, which is right on the edge. **Fix:** "it reaches about 200 mmHg".
- **low**: steps.ts:129. "diastolic pressure sinks to about 45 mmHg": the rate-step card has no blood-pressure cell, so the number can only be estimated from the plot. **Fix:** replace the "heart rate" cell (the slider already shows the rate) with `{ id: 'bp', label: 'blood pressure', value: bp(m.aorta), sub: 'systolic/diastolic', color: 'var(--hc-oxy)' }`.

## Catalogue requirements
- **low**: The catalogue says "narrow a vessel", but the page narrows all the small arteries of the body together. The note at steps.ts:142 says so openly, which is the right thing to do, but the catalogue entry and the page now disagree. **Fix:** change the catalogue Interaction to "…narrow the body's small arteries or make a valve leak", or add a single-artery case.
- **low**: The takeaway's "kept in step by an electrical signal" appears in the closing step only as a small ECG strip; the heart there is drawn with `signal={0}` (LoopScene.svelte:264). **Fix:** `signal={phase === 'summary' ? 1 : 0}`, so the conduction system fires on both pumps in the final view.

Everything else in the entry is built: the cross-section with valves, flow and oxygen; the ECG and pressure curves on one clock; and the rate, narrowing and leak controls.

## Clarity
- **medium**: steps.ts:81 and the HeartScene anatomy panel. A level-1 reader meets "98% saturated with oxygen" with no explanation. **Fix:** `<dfn data-def="The share of the blood's oxygen carriers (haemoglobin) that are holding oxygen: 100% means all of them.">saturated</dfn>`.
- **low**: LoopScene.svelte:309–311 shows "lung artery 23/11 mmHg" and the aorta in mmHg on step 2, but mmHg is only defined on step 5. **Fix:** define mmHg at its first mention in the loop step's body (for example, add "pressures are in mmHg, explained later" next to "low pressure"), or move the `dfn` there.
- **low**: MonitorScene.svelte:170. The card sub-label "ventricles on" is cryptic. **Fix:** `sub: 'ventricles active'`.

## Sources consulted
- https://pubmed.ncbi.nlm.nih.gov/22351638/ (atrial pacing: cardiac output unchanged)
- https://www.sciencedirect.com/topics/immunology-and-microbiology/systolic-blood-pressure
- https://www.merckmanuals.com/professional/multimedia/table/grading-of-mitral-regurgitation
- https://www.researchgate.net/publication/356812675_Difference_in_Thickness_Between_Right_Ventricle_and_Left_Ventricle_of_Adult_Human_Heart_A_Cadaveric_Study
- https://accessanesthesiology.mhmedical.com/content.aspx?sectionid=117318221&bookid=1750 (mixed venous saturation and Fick)
- https://www.sciencedirect.com/topics/nursing-and-health-professions/lung-artery-pressure
- https://www.statpearls.com/point-of-care/162972 (QTc and Bazett)
- https://my.clevelandclinic.org/health/body/21648-heart-conduction-system (AV nodal delay)
- My Python re-run of `circulation.ts` (RK4, same constants) for every model number above.
