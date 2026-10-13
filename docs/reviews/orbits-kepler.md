<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.78 in tokens + 14 web searches -->
# Review: orbits-kepler

## Verdict
Ready after the fixes below. The physics is right: the units (AU, years, GM = 4π²), the orbital elements, vis-viva, the leapfrog integrator and the cannon all check out. I re-ran the integrator and the paths close after one period to within 10⁻³ AU, and the equal-time wedges agree to 0.4% even at the most stretched launch. The most important fix is the two-planet step. The model pins the Sun in place, but the page says "every body pulls every other" and "the star moves too", and the pinned Sun creates ejections that real gravity doesn't produce at 20 Jupiter masses. The step also promises an Earth-mass neighbour that the slider can't produce.

## Factual errors
Checked and correct:
- Neptune was found within 1° of Le Verrier's position in 1846.
- Gravity on the ISS is about 90% of surface gravity.
- Kepler's dates (1609 / 1619), the 88-day and 165-year periods, 29.8 km/s and 42.1 km/s.
- The cannon numbers: 7.7 km/s circular and 10.9 km/s escape at 300 km, and the ground drops 5 m per 8 km.
- The Sun's radius and the planet-to-Sun mass ratios.

Problems:
- **low**, steps.ts:133: "The planets of the Solar System fall exactly on that line" clashes with steps.ts:146, which says the third law needs a correction for the planet's mass. Jupiter's T²/a³ is 0.9987, not 1. Fix: "fall almost exactly on that line".
- **low**, steps.ts:109: "differs from its length by just 0.01%". With e = 0.0167, b/a = √(1−e²) = 0.99986, so the difference is 0.014%. Fix: "by only about 0.014%". Source: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
- **low**, steps.ts:47–56 and OrbitScene.svelte:860: the slider calls a body of up to 30 Jupiter masses a "planet". Above about 13 Jupiter masses the IAU working definition makes it a brown dwarf. Fix: set `max: 13`, or relabel it "Mass of the second body" and add a note: "Above about 13 Jupiters it would be a brown dwarf rather than a planet." Source: https://arxiv.org/abs/2203.09520
- **low**, orbits.ts:167–169: the planet values are credited to the NASA fact sheet, but they are JPL's approximate Keplerian elements (Standish). For Saturn the fact sheet gives 1432.0×10⁶ km ≈ 9.57 AU and 10,747 days. Fix the comment: "JPL approximate Keplerian elements (Standish), J2000". Sources: https://nssdc.gsfc.nasa.gov/planetary/factsheet/ and https://spsweb.fltops.jpl.nasa.gov/portaldataops/mpg/MPG_Docs/Source%20Docs/Standish-KeplerianElements-Planets.txt

## Model issues
- **medium**, orbits.ts:7–9 and 110–125 (two-planet step): the Sun is fixed and doesn't feel the planets. The equations therefore leave out the indirect term, the Sun's own acceleration towards the planets. This contradicts OrbitScene.svelte:455 ("Every body pulls every other") and steps.ts:146 ("the star moves too").
  - What I ran: I ported the integrator and compared it with the correct heliocentric equations over 30 years, from 12 starting phases of the neighbour.
  - Up to 15 Jupiter masses the two models agree (median range of the inner orbit 0.47 AU in both at 10 Jupiters).
  - At 20 Jupiters the fixed-Sun model ejects the inner planet in 6 of 12 runs; the correct equations eject it in none. At the page's own starting phase, the fixed-Sun model flings it to 16.5 AU, while the correct one keeps it between 0.61 and 1.18 AU. So "Flung out of the frame!" at 20 Jupiters is produced by the pinned Sun, not by gravity.
  - Fix: switch to heliocentric equations. Single-planet orbits (m = 0) are unchanged.
    ```ts
    const d = Math.hypot(ri.x, ri.y);
    let ax = (-GM * (1 + bodies[i].m) * ri.x) / d ** 3;
    let ay = (-GM * (1 + bodies[i].m) * ri.y) / d ** 3;
    for (let j = 0; j < n; j++) {
      if (j === i || crashed[j] || bodies[j].m === 0) continue;
      const dx = r[j].x - ri.x, dy = r[j].y - ri.y;
      const dd = Math.hypot(dx, dy) + 1e-4;
      const dj = Math.hypot(r[j].x, r[j].y);
      ax += GM * bodies[j].m * (dx / dd ** 3 - r[j].x / dj ** 3); // direct − indirect (the Sun is pulled too)
      ay += GM * bodies[j].m * (dy / dd ** 3 - r[j].y / dj ** 3);
    }
    ```
  - Also start the neighbour at `Math.sqrt(GM * (1 + m) / R2)` (OrbitScene.svelte:329), and update the header comment of orbits.ts.
- **low**, e2e/orbits-model.e2e.ts:76–99: the two-planet test checks an Earth-mass neighbour, which the page can't show, and it can't catch the missing indirect term. Add a real-world check: in the barycentric frame, total energy and momentum stay constant (to about 1e-5 relative) over 30 years with a 10-Jupiter neighbour.

## Narrative and scene mismatches
- **medium**, steps.ts:146: "With a planet as light as the Earth the effect is tiny" can't be tried. The neighbour slider moves in whole Jupiters from 0 to 30, and even 1 Jupiter moves the inner orbit between about 0.91 and 1.08 AU. Fix: "With no neighbour the orbit stays a circle; even one Jupiter this close makes it swing between about 0.9 and 1.1 AU, and a few Jupiters make the inner orbit visibly wobble — its ellipse stretches, shrinks and turns." Alternatively, add an Earth-mass option to the slider.
- **medium**, steps.ts:95: "the ellipses are not drawn in, they come out". The scene does draw a dashed predicted orbit from the formulas (OrbitScene.svelte:237–261 and 611–633). Fix: "The solid trail is computed step by step from Newton's law of gravity; the dashed curve is the orbit the formulas predict, and the computed path lands right on it."
- **low**, steps.ts:94: "Tilt the launch and the ellipse tilts with it." At a fixed speed, tilting also stretches the orbit (at 29.8 km/s, e = sin(tilt), so 30° gives e = 0.5). The size and the year don't change, as the Period readout shows. Fix: "Tilt the launch and the ellipse turns and stretches, but at the same speed its long axis — and so its year — stays the same."
- **low**: the slider label (steps.ts:22) and PeriodScene.svelte:286 use 29.8 km/s, but the orbit card (OrbitScene.svelte:903) uses 2π × 4.74 = 29.78. At 1.70× the slider reads 50.7 km/s and the card reads 50.6. Fix: compute both from one constant, `(v * circularSpeed(1) * AU_PER_YEAR_KMS).toFixed(1)`.
- **low**, steps.ts:108: "The dashed lines join the planet to both foci", but the predicted orbit is dashed too. Fix: "The two coloured dashed lines…"

## Catalogue requirements
- The interaction is built as written (cannon; speed and direction launch; equal-area wedges; period plot; second planet). The takeaway is visible in the gravity arrow and the takeaway boxes. There is no pitfall to avoid.
- **low**: "see the two disturb each other": only the inner planet's response is shown. The neighbour has no trail, and an Earth-mass inner planet barely moves it. Fix: draw the neighbour's trail, and add: "Each pulls on the other equally hard, but the heavy neighbour hardly notices."
- **low**: the definition of done asks for every simplification to be stated on the page. If the fixed Sun stays, add a note to step `two`: "The Sun is held still here; in reality it wobbles too." Fixing the model as above removes the need.

## Clarity
- **low**, OrbitScene.svelte:373–374: the card shows "escape (parabola / hyperbola)" on step `launch`, but those words are only explained in "Go deeper". For a level-1 reader, add to steps.ts:94: "…it escapes for ever, on an open curve called a hyperbola."

## Sources consulted
- https://www.aps.org/apsnews/2020/08/neptunes-existence-confirmed (Neptune within 1° of the prediction)
- https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html (e = 0.0167, 29.78 km/s)
- https://nssdc.gsfc.nasa.gov/planetary/factsheet/ (planet distances and periods)
- https://spsweb.fltops.jpl.nasa.gov/portaldataops/mpg/MPG_Docs/Source%20Docs/Standish-KeplerianElements-Planets.txt (Standish elements)
- https://en.wikipedia.org/wiki/Kepler%27s_laws_of_planetary_motion (1609 / 1619)
- https://en.wikipedia.org/wiki/Newton%27s_cannonball
- https://starlust.org/why-are-astronauts-weightless-in-space/ (about 90% gravity at ISS height; also checked by calculation: (6371/6791)² = 0.88)
- https://arxiv.org/abs/2203.09520 (IAU working definition of an exoplanet, 13 Jupiter masses)
- https://iauarchive.eso.org/public/themes/measuring/ (definition of the AU)
- My own Python port of `integrate()` with fixed-Sun and heliocentric versions; the numbers are quoted above.
