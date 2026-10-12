<!-- batch msgbatch_01ByHp9mtCYJjYKNcyp3dSWD, claude-opus-5-5, submitted 2026-10-12T00:46:33.022Z, ~$0.66 in tokens + 11 web searches -->
# Review: waves-interference

## Verdict
The page is ready once the fixes below are made. I checked the physics in `waves.ts` against the textbook equations and found it correct: the speed of sound from c = √(γRT/M), 1/√r circular waves, the standing-wave sums, the plucked-string coefficients and the pass-by Doppler shift with sound travel time. The narrative numbers are also right (143 m/s, 482/405 Hz, 70% of the speed of sound, 0.6 m/s per °C). The most important fix is the rule for counting calm lines. The body text and the tank's panel both say it is "how many half-wavelengths fit between the sources", which is off by one for about half of all settings. The panel prints this rule right next to a count and a picture that disagree with it. There are also three smaller errors: the plucked string has two kinks, not one; the Young history is wrong; and one sentence calls the loudest lines "almost still".

## Factual errors
- **medium** — `steps.ts:190` and `TankScene.svelte:578–579`. The text says "the number of calm lines is fixed by how many half-wavelengths fit between them", and the panel says "one for each half-wavelength step that fits between the sources". The model (`quietOrders`) correctly makes the count 2·⌊d/λ + ½⌋. Calm lines always come in pairs, one on each side of the centre, so the count is always even. The number of half-wavelengths that fit can be odd. Examples: λ = 1.6 cm, d = 6 cm draws 8 lines, but 7 half-wavelengths fit. λ = 4 cm, d = 3 cm draws 2 lines, but 1 fits. The default setting (3λ) happens to agree, which hides the bug.
  Fix for the body: "Path differences can't be larger than the distance between the sources, so the spacing fixes how many calm lines there are: one pair, one line either side of the centre, for each of ½, 1½, 2½… wavelengths that is shorter than the spacing."
  Fix for the panel: `one pair for each ½λ, 1½λ, 2½λ…` / `that is shorter than the spacing`.
- **medium** — `steps.ts:236`. "The string's shape… turns into a kink that races back and forth." This is wrong for an ideal plucked string. At release the triangle splits into two half-height copies travelling in opposite directions, so the shape has **two** kinks moving apart and reflecting off the ends. (A single circulating kink is Helmholtz motion, which belongs to a bowed string.) The model's 60-harmonic sum draws two kinks, so the text contradicts the graphic.
  Fix: "…turns into two kinks that race in opposite directions, bounce off the ends and meet again." Source: https://euphonics.org/5-3-synthesising-plucked-strings/
- **medium** — `steps.ts:196`. "Measuring that angle is how the wavelength of light was first measured, with two slits…" This is not right. Young first worked out the wavelengths of light in his 1801 Bakerian Lecture, from Newton's measurements of thin-film colours (Newton's rings), not from two slits.
  Fix: "Measuring that angle, with two slits a fraction of a millimetre apart instead of two dippers, is a classic way to measure the wavelength of light." Source: Mollon, *Phil. Trans. R. Soc. A* 360 (2002), https://vision.psychol.cam.ac.uk/jdmollon/papers/Mollon(2002)Interference.pdf
- **low** — `steps.ts:179`. "Thomas Young's double-slit experiment (1801)". The date is contested. His 1801 lecture was about thin films. His 1803 Bakerian Lecture described fringes made by a narrow card or fibre, and the two-slit arrangement is usually traced to his 1807 *Course of Lectures*.
  Fix: "Thomas Young's double-slit experiment (early 1800s)". Sources: Mollon (above); https://www.lindahall.org/about/news/scientist-of-the-day/thomas-young/
- **low** — `steps.ts:161`. "The ripples in a tank all travel at the same speed." Real ripples disperse. For 1–4 cm wavelengths they are near the minimum of the capillary–gravity speed curve, about 23–27 cm/s in deep water, so the speeds are similar but not equal. I'm fairly confident of that range.
  Fix: "Ripples of these sizes travel at nearly the same speed, so…" Source: https://en.wikipedia.org/wiki/Capillary_wave
- **low** — `steps.ts:223`. The definition of *harmonics*, "The frequencies at which a confined wave can vibrate: whole-number multiples…", is too general. Many confined waves, such as drumheads or pipes closed at one end, do not vibrate at whole-number multiples.
  Fix: "The frequencies at which a string held at both ends can vibrate: whole-number multiples of the lowest one, the fundamental."

## Model issues
- **low** — `waves.ts:17–19` vs `steps.ts:162`. The model's docstring promises that the cap on the 1/√r rule near a source is "stated on the page". It isn't stated anywhere, and neither is the equal ripple speed for every wavelength. Append to the ripple-tank notes: "Very close to each dipper the 1/√r rule is capped, since it would grow without limit, and every wavelength is given the same speed."
- **low** — `e2e/waves-interference-model.e2e.ts`. No test pins the calm-line count, which is how the error above slipped through. Add, for example, `expect(quietOrders(6, 1.6)).toHaveLength(8)` together with a check that the count is always even.

Everything else in the model checks out: constants, units, the hyperbola branch sign, the outward-moving phase, the pass-by root and the 1/r loudness.

## Narrative and scene mismatches
- **low** — `RopeScene.svelte:92–94, 269–270`. In the pulses phase the rope is drawn clamped at both ends, but the pulses fade away into the clamps. Chapter 3 says fixed ends send waves back upside down, so the reader sees two behaviours for the same kind of end. Either draw hands at the ends instead of clamps, or add to the notes at `steps.ts:147`: "Here the ends swallow the pulses; on a clamped rope they would bounce back upside down, as you'll see on the guitar string."

Everything else matches: the quoted numbers (2 m/s, 1 Hz at λ = 2 cm, 110 Hz × n, 482/405 Hz, 70%, d/c at closest approach) match what the scenes compute.

## Catalogue requirements
- The interaction, takeaway and prerequisite links are all met: the tank bands move with wavelength and spacing, the harmonics and the pluck can be heard, and the moving source can be seen and heard. The sources can only be dragged as a symmetric pair (spacing only), which is an acceptable reading of "place two sources".

## Clarity
- **medium** — `steps.ts:178`. The sentence "The water there is *almost* still…" comes right after the sentence about the thin yellow lines "where the water heaves most", so "there" reads as referring to the loudest lines. Move it next to the sentence about the calm bands: "…The dashed lines join all the points of half-integer path difference: those are the calm bands. The water there is <em>almost</em> still rather than perfectly still, because the nearer source's ripple is a little stronger. The thin yellow lines join the points of whole-number path difference, where the water heaves most."
- **medium** — `steps.ts:132`. "Sound is the same thing in air" comes straight after the bead "only goes up and down". At level 1 this suggests sound is an up-and-down (transverse) wave.
  Fix: "Sound obeys the same rule in air, though there the air moves back and forth along the direction of travel: a 343 Hz note…"
- **low** — `steps.ts:130`. "In one swing of the hand" could mean half a cycle. Use "In one full swing of the hand (up, down and back)".
- **low** — `steps.ts:195`. The quiet spots occur "where the path difference is half a wavelength". Add "(or 1½, 2½…)", to match the previous step.
- **low** — `steps.ts:225`. "only certain wave patterns fit around the nucleus" suggests a Bohr-style orbit, which the atoms page warns against. Use "fit in the space around the nucleus".

## Sources consulted
- Mollon, J. D. (2002), "The origins of the concept of interference", *Phil. Trans. R. Soc. A*: https://vision.psychol.cam.ac.uk/jdmollon/papers/Mollon(2002)Interference.pdf
- Linda Hall Library, Thomas Young: https://www.lindahall.org/about/news/scientist-of-the-day/thomas-young/
- Euphonics, synthesising plucked strings (two counter-travelling waves): https://euphonics.org/5-3-synthesising-plucked-strings/
- Capillary wave (dispersion, minimum phase speed): https://en.wikipedia.org/wiki/Capillary_wave
- I checked c = √(γRT/M) with the ISO 2533 constants myself: 340.29 m/s at 15 °C, 343.2 m/s at 20 °C, dc/dT ≈ 0.59 m/s per K. I also checked the Doppler numbers (482.1 and 404.6 Hz) and the plucked-string coefficient formula against the standard Fourier series.
