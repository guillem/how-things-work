# Review: gps

## Verdict
Ready after the fixes below. The model is sound (IS-GPS-200 orbit algorithm, Gauss–Newton fix, DOP, Ashby's clock rates) and every relativity number the text quotes matches it (gravity +45.79, speed −7.21, net +38.58 µs/day; crossover 3 167 km above the equator; 10.229 999 995 43 MHz; eccentricity term 48 ns for e = 0.021). Most important fix: the plane scene says the pulses are slowed "100 000 times"; they are slowed about 100 times.

## Factual errors
- **medium** src/routes/gps/steps.ts:213: "never fewer than 7 in this almanac's day" is false for the whole Earth. On a 5°×10° grid every 15 minutes the model finds 6 satellites above 10° at 0.2 % of samples (e.g. 25° S, 110° W at the almanac epoch). The 8-to-12 claim holds (96 % of samples). Fix: "usually 8 to 12 are in view, and rarely fewer than 7". The model test only sampled a coarse grid that misses the dips; make it assert the real minimum.

## Model issues
- None. Checked: period 11 h 57.6 min, speed 3.87 km/s, 20 191 km up, inclinations 53–57°, Φ₀/c² = −6.9693 × 10⁻¹⁰ (Ashby: −6.96927 × 10⁻¹⁰), net rate 4.4647 × 10⁻¹⁰, solving receiver absorbs the drift exactly (−38.575 µs), trusting receiver 16–20 km off after a day (mostly up), eccentricity skipped moves the fix 2–14 m, GDOP median 2.0 with the real sky.

## Narrative and scene mismatches
- **medium** src/routes/gps/scenes/PlaneScene.svelte:472: "Pulses slowed down 100 000 times." The map is 20 km per unit and pulses move 160 units/s (3 200 km/s), against light's 300 000 km/s: about 94 times slower. Fix: "Pulses slowed down about 100 times."

## Catalogue requirements
- All met: draggable receiver and satellites with circles, clock error growing every circle together, solving for the clock with one more satellite (3 on the map, 4 in 3D), relativity switch with 38.6 µs/day ≈ 11.6 km, trusting vs solving receiver.
- **low** src/routes/gps/steps.ts:157: wireless-signals is now built; link the "radio signal" there (carrier step).

## Clarity
- Clear for level 2; no issues.

## Sources consulted
- N. Ashby, Relativity in the Global Positioning System, Living Rev. Relativ. 6, 1 (2003): https://link.springer.com/article/10.12942/lrr-2003-1
- NTS-2 measurement (442.5 × 10⁻¹² measured, ~1 % agreement): https://arxiv.org/pdf/gr-qc/9702010
- IS-GPS-200 (10.22999999543 MHz, F constant, orbit algorithm): https://www.gps.gov/technical/icwg/
- Model runs in Node (tsx) for every quoted number.
