<!-- batch msgbatch_015iU6A13fAXvDTjPRsXXZTk, claude-opus-5-5, submitted 2026-10-15T04:42:16.612Z, ~$0.78 in tokens + 11 web searches -->
# Review: heat-engines

## Verdict
The page is ready once the fixes below are made. The thermodynamic model is correct, and every number the narrative quotes matches it. I recomputed them independently: 29 J of 100 J, the box cycle's 101/51/481 J, the Otto cycle's 754 K and 819/493/326 J, the efficiencies at r = 8/10/13, the Diesel cycle's 953 K and 64%, the Carnot demo's 200-fold squeeze, the Rankine cycle's 43%/63%/80% dry/≈287 °C, and the EIA percentages. There are a few factual slips in the engine history and the real-engine claims. **The most important fix is the knock sentence in the "Squeeze harder" step.** It says knock is the mixture exploding before the spark, which describes pre-ignition, not knock. Next most important: the "best petrol engine ≈ 40%" claim is out of date, and the cylinder's gas temperature jumps from 300 K to 995 K at the start of the exhaust stroke.

## Factual errors
- **high**, steps.ts:258. Knock is the unburned end gas igniting on its own *after* the spark, before the flame front reaches it. Mixture lighting before the spark is pre-ignition. Literature summaries describe knock as the result of autoignition of the end-gas before it is being reached by the flame front emanating from the spark plug. A review of the topic stresses that LSPI and super-knock are separate phenomena. Fix: "…compressing it too much heats it so that, after the spark, the last part of the mixture explodes on its own before the flame reaches it, a destructive knock." Sources: https://sciencedirect.com/topics/engineering/combustion-knock, https://www.sciencedirect.com/science/article/pii/S0360128522000715
- **medium**, steps.ts:270. "Rudolf Diesel's answer to knock (1890s)" gets the history wrong. Diesel was chasing Carnot efficiency: he had originally intended to create an isothermal combustion process in the cylinder, so as to eliminate the heat transfer irreversibilities and thus approach the Carnot cycle thermal efficiency. His patent dates from February 28, 1892. Fix: "Rudolf Diesel's idea (patented 1892), which also sidesteps knock: compress air alone…". Sources: https://www.sciencedirect.com/topics/engineering/rudolf-diesel, https://www.dieselworldmag.com/departments/under-pressure-the-life-and-death-of-rudolf-diesel/
- **medium**, steps.ts:305 and real-data.ts:47–51 (label "Best petrol engine, at its best"). Toyota's 40% from 2016 is no longer the best figure claimed. In 2024 BYD claimed highest engine thermal efficiency (46.06%) for a 1.5 L plug-in-hybrid petrol engine with an ultra-high compression ratio of 16. Toyota's own hybrid version reached 41%. Fix the label to "Toyota 2.5 L petrol engine, at its best". Fix the body to: "Good modern petrol engines reach about 40% at their best speed and load (Toyota, 2016), against 64% for the ideal cycle at their 13 : 1 compression; engines built only for hybrids now claim up to 46% (BYD, 2024)." Sources: https://carnewschina.com/2024/05/28/byds-5th-generation-dm-technology-for-phevs-debuts-in-china/, https://paultan.org/2018/02/26/toyota-reveals-new-2-0l-dynamic-force-engine-2-0l-hybrid-system-direct-shift-cvt-4wd-systems/
- **low**, steps.ts:258. "about 10 : 1 to 14 : 1" is narrow for the same reason (BYD runs at 16 : 1). Fix: "…to about 10 : 1 to 14 : 1; a few recent hybrid engines reach 16 : 1."
- **medium**, steps.ts:305. "because it spends most of its time far from its best operating point" is only part of the reason. The DOE page says The rest of the energy is lost to engine and driveline inefficiencies or used to power accessories. It also counts idle losses separately. Fix: "…because the engine spends most of its time far from its best operating point, and the drivetrain, accessories and idling take their share (US Department of Energy)." Source: https://www.fueleconomy.gov/feg/atv.shtml
- **low**, steps.ts:244 (Otto `dfn`). "built the first four-stroke engine in 1876" is disputed: Beau de Rochas patented the cycle in 1862. Historians do credit Otto's 1876 engine as the first one built. Fix: "who built the first practical four-stroke engine in 1876." Source: https://muse.jhu.edu/article/894458/summary
- Checked and correct: Carnot 1824; Clausius and Kelvin c. 1850; R/c_p = 2/7; the Diesel efficiency formula; Çengel's 12–24 diesel compression range; the Rankine example (43%, x ≈ 0.80); 342 °C boiling point at 150 bar; Bouchain 62.22% and GE's 64% claim; the EIA 2024 heat rates for coal (10,018), nuclear (10,443) and combined cycle (7,548) (https://www.eia.gov/electricity/annual/table.php?t=epa_08_02.html; I did not find the gas-turbine value of 10,999 in my searches); GE's 2014 figures of >41% simple cycle and >61% combined cycle; DOE's 12–30%.

## Model issues
- **medium**, engine.ts:395–397 and 414–415. The cylinder gas temperature is discontinuous. During the `exhaust-open` dwell, `along(c, 3, f)` cools the gas inside the cylinder to 300 K at constant volume. The `exhaust` stroke then sets T = s4.T (995 K). The strokes readout ("Gas temperature") and the `Gas` colour therefore go 995 → 300 → 995 K within a second. This also contradicts the narrative, which says the exhaust carries the waste heat out. The P–V dot can still follow leg 4→1. Only the temperature shown should follow the gas left in the cylinder as it blows down isentropically. Fix:
  ```ts
  } else {
    const p = along(c, 3, f);                       // P falls from P4 to P1 at V = V1
    const T = s4.T * Math.pow(p.P / s4.P, (GAMMA - 1) / GAMMA);
    gas = { ...p, T };
  }
  ```
  For the exhaust stroke, use `T: s4.T * Math.pow(s1.P / s4.P, (GAMMA - 1) / GAMMA)` (≈ 707 K at the defaults). Add a test that `engineAt(c,u).gas.T` has no jump larger than ~50 K between consecutive u.
- **low**, BoxScene.svelte:81 and 237. The chart plots `bar(g.P)` (Pa / 10⁵) on an axis labelled "pressure (atm)", so 1 atm sits at 1.013 and 2 atm at 2.03. Fix: plot `g.P / P_ATM` (import `P_ATM`) in `P()`, `my`, `ang` and the dot, or relabel the axis "pressure (bar)" and the narrative to match.
- **low**, steps.ts:29–47. The ledger's hot-side minimum (300 K) is below the cold-side maximum (400 K), so "hot side" can be colder than "cold side". The model handles this consistently (limit 0, "Impossible"), but the labels then contradict themselves. Fix: set `ledgerHot.min` to 410, or clamp `tCold < tHot` in the scene.
- Everything else checks out: the constants, the adiabatic, isochoric, isobaric and isothermal legs, the entropy expression, the Diesel cut-off cap, the Carnot and carnotAround construction, the crank–rod kinematics, the Rankine cycle on the NIST tables (pump work v·Δp in correct units), and the table ranges matching the sliders. The tests check real laws (first law by enclosed area, Clausius sum, the Carnot bound, the textbook Rankine example).

## Narrative and scene mismatches
- **low**, steps.ts:206 and BoxScene readouts. "101 J out, 51 J back, 51 J gained" reads as bad arithmetic: the exact values are 101.3, 50.7 and 50.7. Fix: "here about 101 J out and 51 J back, so about 51 J gained (half of what it gave)". Alternatively, show one decimal in the loop card (`fmt(cyc.workOut, 1)` etc.).
- **low**, steps.ts:283. "pressures of over 1,000 bar" is true, but the card shows 1,693 bar. Fix: "pressures of about 1,700 bar".
- **low**, PlantScene.svelte:163 vs 33/95. The burner label says "1,400 °C+", while the Carnot row uses 1,600 °C. Fix the label to "up to 1,600 °C".
- **low**, CompareScene.svelte:190–191. The readout label says "Otto = 1 − T₁/T₂" and the on-stage text says "1 − Tc/T₂". Use one form; "1 − T₁/T₂" matches the narrative.
- Everything else matches the model and scenes: stroke order and dwell, the strokes' P–V path, the "loop" corners, the ledger verdicts, and the compare corners ("heat could go in hotter" top-left, "heat leaves hotter than Tc" bottom-right).

## Catalogue requirements
- All met. The four strokes can be played (run toggle) or scrubbed (crank slider), and the dot traces the P–V loop with its area labelled as work. Compression ratio, hot and cold temperatures are all adjustable, and the efficiency is compared with the Carnot limit (Compare step bars; ledger gauge). The takeaway is visible in the graphics: the entropy bars go negative past 1 − Tc/Th, and the Otto bar always sits below the Carnot bar. No pitfall is listed. The steam data are real (NIST/IAPWS-95), and the power-plant figures are sourced.

## Clarity
- **low**, steps.ts:232. "compression climbs the left of the loop … the power stroke slides down the right" does not match the chart. Compression is the lower curve running right to left; the power stroke is the upper curve running left to right. Fix: "compression climbs the lower curve towards small volume, burning jumps it straight up, the power stroke slides down the upper curve to the right…".
- **low**, steps.ts:331. "On its own it turns about 40%" comes one step after a bar showing US gas turbines at 31%. Fix: "The largest modern gas turbines turn about 40% of their heat into work on their own (the US fleet average, full of smaller peaking units, is 31%), but…".
- **low**, steps.ts:259. There is a double space in "replaced).  Higher".

## Sources consulted
- https://www.fueleconomy.gov/feg/atv.shtml (12–30%, where the losses go)
- https://www.eia.gov/electricity/annual/table.php?t=epa_08_02.html and https://large.stanford.edu/courses/2025/ph240/sha2/ (2024 tested heat rates)
- https://carnewschina.com/2024/05/28/byds-5th-generation-dm-technology-for-phevs-debuts-in-china/ (BYD 46.06%, 16 : 1)
- https://paultan.org/2018/02/26/toyota-reveals-new-2-0l-dynamic-force-engine-2-0l-hybrid-system-direct-shift-cvt-4wd-systems/ (Toyota 40%/41%, 13 : 1 and 14 : 1)
- https://sciencedirect.com/topics/engineering/combustion-knock and https://www.sciencedirect.com/science/article/pii/S0360128522000715 (knock vs pre-ignition)
- https://www.sciencedirect.com/topics/engineering/rudolf-diesel and https://www.dieselworldmag.com/departments/under-pressure-the-life-and-death-of-rudolf-diesel/ (Diesel's aims, 1892 patent)
- https://muse.jhu.edu/article/894458/summary (origin of the four-stroke cycle)
- https://www.power-eng.com/gas/turbines/ge-releases-new-9ha-and-7ha-natural-gas-turbines/ and https://www.turbomachinerymag.com/view/market-challenged-ge-continues-to-improve-gas-turbine-efficiency (GE HA ratings, Bouchain 62.22%, 64%)
- https://insights.globalspec.com/article/3099/steam-turbines-a-durable-and-enduring-necessity (share of electricity from steam)
- My own recomputation of the model's figures from engine.ts, steam.ts and steam-data.ts.
