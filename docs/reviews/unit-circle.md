<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.50 in tokens + 4 web searches -->
# Review: unit-circle

## Verdict
The page is ready after the small fixes below. I found no factual errors. The maths in `trig.ts` and the scenes is correct: the coordinates (cos θ, sin θ), the radian construction (a radius-length arc bent onto the circle), the wave graph drawn at the same vertical scale as the circle, and A·sin(2πft) in the time phase. The interaction, the takeaway and the levels match the catalogue entry. The most important fix: an angle set on the `periodic` step (−360°…720°) is wrapped back into range only by the wave scene. If the reader then opens a step drawn by the circle or radians scene, the graphic shows the wrapped angle while the 0–360 slider still holds the raw value, such as 600 or −30. A smaller gap: no model tests were included for review.

## Factual errors
- **low**, steps.ts:209. Calling 440 Hz the A "used to tune orchestras" is broadly right, but 440 Hz is the ISO standard and many orchestras tune slightly higher. A440 is the pitch of 440 Hz, which serves as a tuning standard for the A above middle C, and concert pitch may vary from ensemble to ensemble, and has varied widely over time. Fix: "The note A above middle C is standardised at 440 Hz (many orchestras tune a little higher) — far too fast to draw at this speed, but the same curve." Sources: https://en.wikipedia.org/wiki/A440_(pitch_standard), https://en.wikipedia.org/wiki/Concert_pitch

The other claims check out:
- **Babylonian origin of 360°.** Hipparchus is credited as generalizing Hypsicles' idea of dividing the ecliptic into 360 degrees, an idea borrowed from the Babylonian astronomers.
- **1 rad ≈ 57.3° and 2π ≈ 6.28.** Correct: an arc with the same length as the radius subtends 1 radian; the circumference subtends 2π radians.
- **Also correct:** the exact values at the special angles, cos θ = sin(θ+90°), the tangent being undefined at 90° and 270°, and mains at 50/60 Hz.

## Model issues
- **medium**, CircleScene.svelte:46–123 and RadiansScene.svelte:157–175: an out-of-range angle is never written back. `angleParam` wraps `params.angle` for drawing (600 → 240), but only WaveScene (lines 138–148) writes the wrapped value back into `params.angle`. Suppose the reader leaves `periodic` at 600° or −30° and jumps through the chapter navigation to `coordinates`, `triangle`, `quadrants` or `radians`. The point is drawn at 240° or 330°, but the slider (0–360) holds 600 or −30, and its `format` text reads "600° ≈ …" or "-30° …". The snap effect doesn't help either, because 240 is already a special angle. CircleScene.svelte:107 also tests the seam against the raw `params.angle` rather than `theta`. I'm fairly confident of this, though how visible it is depends on how the shell's range control handles an out-of-range value. Fix: add this to both scenes:
  ```ts
  $effect(() => {
  	const shown = theta;
  	untrack(() => {
  		if (Number(params.angle) !== shown) setParam('angle', Math.round(shown));
  	});
  });
  ```
  Then use `theta > 180` instead of `Number(params.angle) > 180` in both `onmove` handlers. A cleaner alternative is to move the normalisation into one shared helper that all three scenes call.
- **medium**, no tests file. The brief calls for the model's tests, and definition of done item 5 requires the model to be checked against a reference, but none were included. Add `trig.test.ts` covering at least:
  - `exact(Math.cos(toRad(a)))` and `exact(Math.sin(…))` for every entry of `SPECIAL_ANGLES` (non-null, correct sign);
  - `radText(-90) === '−π/2'`, `radText(720) === '4π'`, `radText(20) === '0.35'`;
  - `angleParam` wrapping 600 → 240 and −30 → 330 on a 0–360 control;
  - `unwrap(350, 10) === 370` and `unwrap(10, 350) === -10`;
  - `screenAngle` returning 90 for a point straight above the centre (screen y pointing down);
  - cos² + sin² = 1 at random angles.
- **low**, steps.ts:15: the slider label for negative angles uses a hyphen ("-30° = −π/6 rad"), while everywhere else uses "−". Fix: `` return `${num(v, 0)}° ${r.includes('π') || v === 0 ? '=' : '≈'} ${r} rad`; ``, importing `num` from `./trig`.

## Narrative and scene mismatches
- **low**, steps.ts:113: "Drop a line from the point straight down to the *x*-axis". Below the axis (180°–360°) the line goes up, and the scene draws it that way. Fix: "Drop a line from the point straight to the *x*-axis, and another across to the *y*-axis."
- **low**, steps.ts:148–151: the quadrant ranges include their endpoints ("top right (0°–90°): both positive"), but at 0° and 90° one coordinate is 0. The scene correctly says "On an axis" there. Fix: write "between 0° and 90°", "between 90° and 180°" and so on.

Otherwise the text matches the graphics. The scenes show every quoted number and every promised behaviour: the marker following the dragged point, the arrow showing the 90° slide, the bracketed 360° period, negative angles going clockwise, and the 1/f cycle bracket.

## Catalogue requirements
- **low**, steps.ts:68: the page title "Sine, cosine and the unit circle" differs from the catalogue title "Trigonometry & the unit circle". The shell's links use the catalogue title, so the two names will appear side by side. Fix: set `title: 'Trigonometry & the unit circle'`, or propose changing the catalogue entry.

Everything else in the entry is met: the draggable point, the linked sine and cosine graph, the angle in degrees and radians, and a takeaway that is visible in the graphic. The entry has no Pitfall or Needs field.

## Clarity
No problems. Terms (θ, unit circle, radian, hypotenuse, quadrant, period, amplitude, hertz, cos²θ) are defined where they are first used, and the steps build in order at a high-school level.

## Sources consulted
- https://en.wikipedia.org/wiki/Degree_(angle)
- https://sites.math.rutgers.edu/~cherlin/History/Papers2000/hunt.html
- https://en.wikipedia.org/wiki/Radian
- https://en.wikipedia.org/wiki/A440_(pitch_standard)
- https://en.wikipedia.org/wiki/Concert_pitch
