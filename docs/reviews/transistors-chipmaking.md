<!-- batch msgbatch_01Vd3QBkoZjG75GmguRDxBiq, claude-opus-5-5, submitted 2026-10-15T04:42:12.752Z, ~$0.68 in tokens + 13 web searches -->
# Review: transistors-chipmaking

## Verdict
The page is ready once a few fixes are made. The model is sound. I recomputed its numbers and they match what the page says:
- 654 µA on-current
- 5.8 pA off-current, an on/off ratio of 1.1 × 10⁸
- 89 mV per decade
- switching point at exactly 0.90 V
- 509 chips drawn on the wafer and 532 from the formula
- k₁ cutoff of 0.256
- a fitted doubling time of 1.995 years over 99 chips

The parameters match Sedra & Smith's 0.18 µm process, and the scanner specs match ASML's pages. The most important fix is the description of exposure as a "single flash" that covers a 26 × 33 mm field. Modern tools are step-and-scan machines: they sweep a narrow slit of light across the field while the mask and the wafer move together. The second fix is a wrong help text on the log-scale toggle in the threshold step: the gridlines there are 100× apart, not 10×.

## Factual errors
- **medium** — steps.ts:165 ("Each flash exposes a field up to 26 × 33 mm at once…") and WaferScene.svelte:369 ("printed by a single flash of light"). Scanners do not expose the whole field at once. The mask and wafer move in sync under a narrow slit of light, and that sweep covers the field. ASML calls 26 × 33 mm the "maximum scanned exposure field". Fix for steps.ts:165: "Each exposure sweeps a narrow slit of light across a field up to **26 × 33 mm**, with mask and wafer moving together (six chips the size of the M1: about a hundred billion transistors); then the wafer steps to the next field." Fix for WaferScene: `'exposure field, 26 × 33 mm: six chips', 'printed in one sweep of the scanner.'`. Sources: https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe3400b, https://www.gaudisite.nl/IRCwaferstepperPaper.pdf
- **medium** — steps.ts:203, "hundreds of process steps, which take a wafer two to three months." KLA puts it at more than a thousand steps per chip. The SIA gives a cycle time of about 12 weeks on average and 14–20 weeks for advanced processes. Fix: "…needs dozens of masks and more than a thousand process steps, which take a wafer about three months, and longer on the most advanced processes." Sources: https://www.kla.com/advance/education/chip-manufacturing-101, https://www.semiconductors.org/chipmakers-are-ramping-up-production-to-address-semiconductor-shortage-heres-why-that-takes-time/
- **medium** — steps.ts:66, "No transistor at room temperature can do better than 60 mV per tenfold." That limit applies to transistors whose carriers go *over* a barrier, which includes every conventional MOSFET. Tunnel FETs have shown slopes below 60 mV/decade. Fix: "No ordinary MOSFET at room temperature can do better than 60 mV per tenfold…". Source: http://large.stanford.edu/courses/2012/ph250/esfandyarpour1/
- **low** — steps.ts:114, "NAND is the cheapest CMOS gate after NOT." NOR also uses four transistors. NAND is preferred because its series transistors are nMOS, which are faster. Fix: "NAND (with NOR) is the cheapest CMOS gate after NOT, and the usual choice, because its series pair is the faster nMOS: an AND gate is…".
- **low** — steps.ts:42, "Past about 0.5 V there are more electrons than holes in a thin skin under the oxide." Electrons already outnumber holes at the surface below threshold (weak inversion). The threshold is where the surface electron density reaches the hole density deep in the bulk. Fix: "Past about **0.5 V** the thin skin under the oxide holds as many electrons as the bulk holds holes: a channel…". Confidence about 80%; this is textbook (strong inversion at ψs = 2φF).
- **low** — steps.ts:203 and ProcessScene.svelte:495 ("each layer above is coarser" / "each coarser than the last"). Modern metal stacks get coarser in groups: several layers share the same pitch. Fix: "the layers above grow coarser in steps".

Everything else checks out:
- Sedra & Smith parameters
- Wanlass and CMOS in 1963 (https://www.computerhistory.org/siliconengine/complementary-mos-circuit-configuration-is-invented/)
- self-aligned gate in the late 1960s
- high-k metal gates around 2007
- copper wiring (IBM, 1997) and the damascene process
- the 50 kHz tin source
- TSMC N5's 51 nm gate pitch and 210 nm cell height (https://x.com/DrFrederickChen/status/1856352023018648024, quoting https://www.angstronomics.com/p/the-truth-of-tsmc-5nm)
- M1 at about 119 mm² and 16 billion transistors
- ASML resolutions of 110, 38, 13 and 8 nm (https://www.asml.com/en/products/duv-lithography-systems/twinscan-nxt870, https://www.asml.com/en/products/duv-lithography-systems/twinscan-nxt2000i)
- Moore 1965/1975

## Model issues
- **low** — model.ts:89–91, `channelDensity`. Below threshold the softplus makes the charge fall by e per 2nV_T, which is 178 mV per decade. In the EKV model, the inversion charge in weak inversion falls with the same slope as the current, 89 mV per decade. The "electrons in the channel" readout between 0.3 and 0.5 V is therefore several times too high: about 300 per µm² at 0.3 V. Fix:
  ```ts
  const s = softplus((vgs - dev.vt) / twoNVt);
  return (COX * twoNVt * (Math.sqrt(0.25 + s * s) - 0.5)) / Q;
  ```
  This is EKV's q = √(¼ + i_f) − ½. Above threshold it gives C_ox(V − V_t − nV_T), an offset of 39 mV. Relax the 1 % check in the test at 1.5 V to 5 %, or compare against C_ox(1.0 − 0.039 V)/q.

Apart from that, the model holds up. The drain current reduces exactly to Sedra & Smith's triode and saturation laws and has the correct subthreshold slope. The inverter is solved by bisection on equal currents. The aerial image uses the correct Fourier coefficients and pupil test. The die formula and the regression are both correct. The tests check real properties: the square law, pinch-off, the subthreshold slope, monotonicity, cutoff k₁ and phase.

## Narrative and scene mismatches
- **medium** — steps.ts:59 (toggle help: "Each gridline is ten times the one below") against MosfetScene.svelte:447 (`yTicks={[-13, -11, -9, -7, -5, -3]}`). The labelled gridlines are 100× apart. Fix the ticks: `yTicks={[-13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3]}`. If that is too crowded, change the help to "Each gridline is a hundred times the one below."
- **low** — WaferScene.svelte:226–233 against the note at line 369. The violet frame is labelled 26 × 33 mm but is drawn around the 2 × 3 chips, which is 21.8 × 32.7 mm. Either draw it at the real size:
  ```svelte
  x={-0.5 * DIE * PX0 - (FIELD_MM.w - fieldCols * DIE) / 2 * PX0}
  y={-1.5 * DIE * PX0 - (FIELD_MM.h - fieldRows * DIE) / 2 * PX0}
  width={FIELD_MM.w * PX0} height={FIELD_MM.h * PX0}
  ```
  or reword the note to "The violet frame holds the six chips that fit in one 26 × 33 mm exposure field."

Everything else matches: 0.65 mA, 89 mV, a few pA, 0.9 V, 509 and 532, about 8 trillion, about 100 billion per field, 2.0 years, 99 chips, k₁ 0.256 and 0.27–0.36.

## Catalogue requirements
All met. The gate voltage forms a visible channel in cross-section. The inverter (and the NAND) are built from the model. Fabrication steps through deposit, coat, expose, etch, dope and repeat, with a timeline loop. The zoom runs from the wafer down to one transistor. The takeaway is visible in the on/off switch and in the exposure field. Prerequisites are linked, and no topic lists this one as a prerequisite.

## Clarity
- **low** — steps.ts:234–236. The formula uses "half-pitch" before the body explains it; the definition is only in the slider's help text. Fix: "…That is the Rayleigh criterion, for a pattern of equal lines and gaps whose half-pitch is the width of one line:".
- **low** — steps.ts:140, "Every layer of every transistor on a wafer is printed in under a minute." This reads as if the whole chip were printed in a minute. Fix: "Each layer is exposed across the whole wafer in under a minute, the way a photograph is printed…".

## Sources consulted
- https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe3400b
- https://www.gaudisite.nl/IRCwaferstepperPaper.pdf
- https://www.asml.com/en/products/duv-lithography-systems/twinscan-nxt870
- https://www.asml.com/en/products/duv-lithography-systems/twinscan-nxt2000i
- https://www.kla.com/advance/education/chip-manufacturing-101
- https://www.semiconductors.org/chipmakers-are-ramping-up-production-to-address-semiconductor-shortage-heres-why-that-takes-time/
- http://large.stanford.edu/courses/2012/ph250/esfandyarpour1/
- https://www.computerhistory.org/siliconengine/complementary-mos-circuit-configuration-is-invented/
- https://x.com/DrFrederickChen/status/1856352023018648024 (quoting https://www.angstronomics.com/p/the-truth-of-tsmc-5nm)
- https://en.namu.wiki/w/Apple%20Silicon/M%20%EC%8B%9C%EB%A6%AC%EC%A6%88 (M1 at 118.91 mm²; secondary source)
- Recomputed in Python: the drain-current model, the die count, the dies-per-wafer formula, and the Moore fit over the 99 entries in `counts.ts`.
