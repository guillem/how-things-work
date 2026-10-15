# Review: power-grid

## Verdict
Ready after the small fixes below. The model is sound and every number the narrative quotes matches it when run in Node: ROCOF 0.071 Hz/s and ×3.5 at 80%, nadir 49.71 Hz, settling at 49.83 Hz, back to 50 Hz in about 3–4 minutes, the island trip at 49.81 Hz, the cloud shedding about 2,000 MW, line losses of 2.4/7.8/22%, and 620 GWh for the day. REE's REData API gives 626.18 GWh for the day's mainland demand. The most important fix is the 4 November 2006 note: switching off the line did not split the grid by itself. It removed the N−1 margin, and a cascade of overload trips about half an hour later did the splitting.

## Factual errors
- **medium** — steps.ts:330: "a line switched off in northern Germany split the European grid in three." The manual switch-off of the Conneforde–Diele 380 kV line (21:38, for a ship to pass) left the grid without N−1 security. At 22:10 a small flow change tripped the Landesbergen–Wehrendorf line, and the cascade of trips that followed split UCTE into three areas. The other figures check out: frequency fell to about 49 Hz in the West, more than 15 million households were cut off, and a normal situation was back in less than 2 hours. Fix: "On 4 November 2006 a line in northern Germany was switched off so that a ship could pass beneath it. Neighbouring lines were left overloaded, and about half an hour later they tripped one after another, splitting the European grid in three." Source: UCTE Final Report, 30 Jan 2007, executive summary, https://eepublicdownloads.entsoe.eu/clean-documents/pre2015/publications/ce/otherreports/Final-Report-20070130.pdf
- **medium** — steps.ts:273: "Nuclear runs flat out all day, about 6,100 MW." Mainland nuclear capacity is about 7,100 MW (grid.ts:292, and the game's own slider), so 6,100 MW is steady output, not full output. Fix: "Nuclear runs at a steady 6,100 MW all day."
- **low** — steps.ts:246 and FrequencyScene.svelte:247: "they all turn in step with each other — 3,000 times a minute" and the label "every generator: 3,000 turns a minute." Only two-pole machines turn at 3,000 rpm. Many nuclear turbine-generators are four-pole machines at 1,500 rpm, and hydro generators turn far slower. All of them stay in electrical step. The dfn on the same line already says "a two-pole generator." Fix the body to "a two-pole generator turns 3,000 times a minute for the 50 cycles a second of Europe's grid" and the label to "a two-pole generator: 3,000 turns a minute." Source: Kundur, Power System Stability and Control, §3.1 (synchronous speed = 120 f / poles).
- **low** — steps.ts:356: "at 1,000 MW it is the biggest plant on this grid." Spanish reactors range from about 1,030 to 1,090 MW. Fix: "at about 1,000 MW a reactor is the biggest single unit on this grid." Source: CSN / Foro Nuclear reactor list, https://www.foronuclear.org/
- **low** — steps.ts:274 (dfn): "The largest kind of electricity storage in the world." This holds by stored energy (well over 90% of GWh). By power, batteries are catching up fast. Fix: "By the energy it holds, the largest kind of electricity storage in the world." Source: IEA, Grid-scale storage, https://www.iea.org/energy-system/electricity/grid-scale-storage

## Model issues
- **low** — steps.ts:401: "0.019 Ω per km per phase (aluminium's resistivity at 20 °C; hot wires are a little worse)." The 0.019 Ω/km figure is right: 2.82e-8 Ω·m ÷ 1,500 mm² gives 0.0188 Ω/km, the same as a triple RAIL bundle (0.0597 ÷ 3 ≈ 0.020 Ω/km). But "a little worse" understates the effect of heat. Aluminium's resistance rises about 0.4%/°C, so it is about 12% higher at 50 °C and 22% higher at 75 °C. Fix: "hot wires, at 50–75 °C, are 10–20% worse." No model change is needed.
Otherwise the model checks out: the swing equation, the time constant 2E/(f₀·D) = 14 s, droop plus self-regulation settling at 0.167 Hz, and the UFLS, LFSM-O and RfG thresholds all match the SOGL, the NC ER and the RfG.

## Narrative and scene mismatches
- **low** — steps.ts:369: "Solar power can change much faster than a reactor trips back on." The wording is confusing, because a reactor does not "trip back on." Fix: "Solar power can fall fast too, without anything breaking."
Every other quoted number matches the model (checked in Node).

## Catalogue requirements
All met. The reader dispatches gas, nuclear, hydro, storage and curtailment, trips a plant, sends a cloud, and steps the voltage up and down. The takeaway shows in the frequency dial and in the loss-versus-voltage chart. The data are real (REE). REE's reuse terms (§5.1) are met: the source is named on the stage, the data are not altered, and the latest-update date is given in the notes.

## Clarity
No problems found for level 2. Terms are defined at first use.

## Sources consulted
- UCTE, Final Report – System Disturbance on 4 November 2006: https://eepublicdownloads.entsoe.eu/clean-documents/pre2015/publications/ce/otherreports/Final-Report-20070130.pdf
- REE REData API, demand evolution, peninsular, 2025-04-09: https://apidatos.ree.es/es/datos/demanda/evolucion (626,184.7 MWh)
- REE legal notice §5.1: https://www.ree.es/en/legal-notice-privacy-policy
- Commission Regulations (EU) 2017/1485 (SOGL), 2017/2196 (NC ER), 2016/631 (RfG)
- IEA, Grid-scale storage: https://www.iea.org/energy-system/electricity/grid-scale-storage
