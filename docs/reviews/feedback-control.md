# Review: feedback-control

## Verdict
Ready after the fixes below. The physics is sound (Åström & Murray's car with their parameters, an exact second-order drone, the linearised pole condition Kp > g, full two-link arm dynamics), the Ziegler–Nichols rules and citation are correct, and almost every number the narrative quotes is reproduced by the model and tested. The most important fix: the windup step quotes the 116 km/h overshoot for Ki = 3, but the page opens at Ki = 2, where the reader sees about 113 km/h.

## Factual errors
- **low** — src/routes/feedback-control/steps.ts:293 — "most of the controllers in factories, cars and aircraft are this one" overstates it for aircraft; the established claim (Åström & Hägglund) is that the great majority of industrial control loops are PID, mostly PI. Fix: "most of the control loops in factories, and many in cars and aircraft, are this one…". Source: https://www.cds.caltech.edu/~murray/courses/cds101/fa02/caltech/astrom-ch6.pdf
- All other facts check out: A&M §4.1 car (m 1600 kg, Tm 190 N·m, ωm 420 rad/s, β 0.4, αₙ = 10 in top gear, Cr 0.01, ρ 1.3, Cd 0.32, A 2.4 m², PI kp 0.5 ki 0.1); Ziegler & Nichols, Trans. ASME 64: 759–768 (1942), Taylor Instrument Companies; P/PI/PID rules; overshoot e^(−πζ/√(1−ζ²)); derivative on measurement to avoid derivative kick.

## Model issues
- None. Limiting cases checked in Node: P-only drone neutrally stable (period 2π√(m/Kp)); ζ = 1 no overshoot; pole falls below Kp = g and stands above; arm sag ≈ holding torque ÷ Kp; critical delay falls as Kp rises (0.50 s at Kp 2, 0.33 s at 4, 0.19 s at 8).

## Narrative and scene mismatches
- **medium** — steps.ts:255 — "with Ki = 3% per km/h per s, it overshoots to about 116 km/h", but the step's Ki slider starts at 2, where the model peaks at 113.4 km/h (116 needs Ki = 3). Fix: quote the default: "with the starting gains it overshoots to about 113 km/h"; move the model test to Ki = 2.
- **medium** — steps.ts:217 — "past about 130% per km/h … the throttle starts to chatter from fully open to shut": on the hills, after the start-up, the throttle swings between shut and 53% at Kp 130 and 87% at 150 (the slider's top); it never reaches fully open. Fix: "the throttle starts to chatter, slamming shut and opening again".
- **medium** — steps.ts:243 — "Raise Ki to 10 and watch it overshoot 90 by several km/h": on this step's hilly road from 80 km/h the model peaks at 108.9 km/h, almost 20 km/h over. Fix: "overshoot 90 by well over 10 km/h"; add a model test.
- **low** — steps.ts:317 — "At about 0.3 s, with the starting gains (Kp 4, Ki 1, Kd 2)": the readout shows 329 ms. Fix: "At about a third of a second".
- **low** — steps.ts:268 — "a drone in still air is not [held back by drag]": real drones have some drag; the model has none. Fix: "a drone in still air hardly is (this one not at all)".
- Checked and correct: open loop 81–92.5 km/h; A&M PI within 1.35 km/h; 87.4 km/h at Kp 10; 85 km/h and 41 s climb; anti-windup 93 km/h; Ku 133, Tu 2.1 s; ZN 80/76/21, overshoot 0.74, decay 0.25–0.28; 3.1 s swing; 16% at ζ 0.5; 0.74 m sag; gusts within a metre (2.16–3.52 m at Kd 2); 100 ms delay overshoots more (3.77 vs 3.62 m); cart drifts at a steady 0.6 m/s.

## Catalogue requirements
- Met: PID tuned on a drone, P/PI on a car over hills, PD on the pendulum, gains for an arm; delay, noise and gusts added; a two-joint arm reaching for a draggable point; response plotted against target; takeaway stated and visible. The pendulum offers Kp and Kd only (an integral on tilt adds nothing there); acceptable.

## Clarity
- **low** — steps.ts:318 — "the frequency at which its correction is as big as the disturbance it answers" is vague. Fix: "the frequency at which a swing, sent once round the loop, comes back the same size (the loop gain is 1)".

## Sources consulted
- https://python-control.readthedocs.io/en/0.10.1/cruise-control.html (A&M cruise-control parameters, §4.1, PI gains)
- https://www.cds.caltech.edu/~murray/amwiki/Cruise_control.html
- Ziegler & Nichols, "Optimum settings for automatic controllers", Trans. ASME 64 (1942) 759–768
- Model runs in Node (scratch script) for every quoted number
