<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.90 in tokens + 12 web searches -->
# Review: sun-earth-moon

## Verdict
The page can ship once the fixes below are made. Nearly every number on it checks out against references and against my own recalculation from the model: the tilt, eccentricity, the 3%/7% distance figures, the 147.1/152.1 million km readouts, the eclipse limits, the 12 h 25 min tidal interval, the 0.46 Sun-to-Moon tide ratio, Fundy and Uranus. The geometry is also drawn the right way round: orbit directions, which side of the Moon is lit when waxing, which way the Sun-side bulges face. The most important fix is the sentence in `steps.ts:125` saying the summer hemisphere "gets more than twice as much" sunlight as the winter one. That is only true near the solstice; averaged over the season the ratio is about 1.7×. Next in importance: the Moon slider's help text is wrong on two of the four steps that use it; the eclipse-season strip is tied to the year 2026 but the page never says so; and in the tilt step the reader can't move the Earth, which the catalogue Interaction asks for.

## Factual errors
- **low**, `steps.ts:97` (equinox definition): "day and night are equal everywhere." This contradicts the page's own note on `daylength` and the scene, which says "almost everywhere". Day and night are in fact not exactly equal at the equinox; the word "equilux" is used for the day on which they are. Fix: "…when the Sun is overhead at the equator and day and night are about 12 hours each almost everywhere." Source: https://earthsky.org/astronomy-essentials/are-day-and-night-equal-equinox-september/
- **low**, `steps.ts:152`: "12 hours of daylight everywhere." With no tilt, the poles would have the Sun circling on the horizon permanently; `SunlightScene` already shows "Sun on the horizon" there. Fix: "…with 12 hours of daylight everywhere except at the poles, where the Sun would circle along the horizon."

Everything else checks out:
- 23.44° tilt and 5.145° Moon inclination.
- Perihelion and aphelion: in 2026, perihelion is on January 3 at 147.1 million km, and aphelion on July 6 at about 152.1 million km.
- Uranus has an extreme axial tilt of 97.77 degrees.
- Bay of Fundy: greatest mean spring range 14.5 metres and an extreme range of 16.3 metres.
- Sun's tide: about 46% of the lunar tidal effect.
- Eclipse windows: the page's 17° (solar) and 11° (lunar) sit inside the published ranges; for example, ecliptic limits are not fixed, and for a partial solar eclipse the maximum is 18°.4.
- My own recalculation from the model: 40° N day length 14.8 h in June and 9.2 h in December; midsummer ÷ midwinter sunshine at 40° N is 3.3×; the September equinox lands on day 264–265; eclipse seasons move about 18.6 days earlier each year.

## Model issues
- **medium**, `MoonScene.svelte:400-403` and `steps.ts:198`: `NODE = 333` places the line of nodes where it is in 2026. The four 2026 eclipses do fall inside the model's windows; I checked 17 Feb, 3 Mar, 12 Aug and 28 Aug at 4.7°, 9.4°, 13.7° and 1.7° from a node. These match NASA's list for 2026: an annular solar eclipse on Feb 17 and a total lunar eclipse on Mar 03. But the page never says the strip is for 2026, so from 2027 on it is about 19 days off per year with no warning. Fix:
  - At line 1345, use the title `'Eclipse seasons (nodes as in 2026)'`.
  - In the `tilted` notes, replace "this page keeps them fixed" with "this page keeps them fixed where they are in 2026."

  Source: https://eclipse.gsfc.nasa.gov/OH/OH2026.html
- **low**, `e2e/sky-model.e2e.ts`: several tests are true by construction. `sunLongitude(78.6) ≈ 0` holds because `MEAN_ZERO_DAY` is defined to make it so, and the tide test re-derives `1.46/0.54` from the same constant. Meanwhile the numbers the narrative quotes are not tested. Add:
  ```ts
  test('narrative numbers', () => {
    const r = dailySunshine(40, 23.44) / dailySunshine(40, -23.44);
    expect(r).toBeGreaterThan(3);                     // "over three times"
    const s = Math.sin((23.44 * Math.PI) / 180);
    expect((1 + s) / (1 - s)).toBeGreaterThan(2);     // hemispheres, solstice day
    expect(dayLength(40, -23.44)).toBeCloseTo(9.2, 1);
    expect(sunDistance(185) / sunDistance(3) - 1).toBeCloseTo(0.034, 2); // "about 3%"
    const lunarDay = 24 / (1 - 1 / 29.5306);
    expect(lunarDay / 2).toBeCloseTo(12.42, 2);        // 12 h 25 min
  });
  ```
  A further test could check that the 2026 eclipse dates fall inside `nodeWindow` of `NODE`.

## Narrative and scene mismatches
- **medium**, `steps.ts:61` (help text of the `moon` control): "Moving the slider or the Moon stops time." The control is reused on four steps, and the text is wrong on two of them:
  - In `tilted` nothing runs at all, since there is no `run` toggle.
  - In `spring`, `TidesScene` (`running = params.run !== false`) keeps the Earth turning when the slider or the Moon handle moves. Nothing calls a stop.

  Fix:
  ```ts
  const moonTilted: Control = { ...moon, help: 'Or drag the Moon along its orbit.' };
  const moonTides: Control = { ...moon, help: 'Or drag the Moon. The Earth keeps turning.' };
  ```
  Use `[date, moonTilted]` at line 193 and `[moonTides, spin]` at line 221.

Everything else matches: the readouts (3%/7%, 1.7%, ±1.5°/±1.0° zones, 12 h 25 min, 0.46×, 2.7×) agree with the narrative and with `sky.ts`.

## Catalogue requirements
- **medium**, Interaction "Move the Earth around the Sun with an adjustable axial tilt and see day length and the angle of sunlight at any latitude." The tilt can only be changed in the `tilt` step, and there:
  - the date drifts on its own at one year per 20 s, with no date control and no pause (`steps.ts:149`, `SunlightScene.svelte:512`);
  - the noon Sun angle is not shown.

  Fix:
  - Make the step's controls `[tilt, latitude, date]`.
  - In `SunlightScene`, use `params.day` instead of `drift` when the step has a `day` control: `const tDay = $derived((step.controls ?? []).some(c => c.id === 'day') ? day : drift);`
  - Add the noon altitude to the footer at line 1234: `` · noon Sun ${altText(noonAltitude(lat, dTilt))} ``

Everything else is met. The takeaway can be seen in the graphics, all three pitfalls are explicitly avoided (distance step, "Phases are not a shadow" card, flat-orbit vs tilted-orbit eclipses), there are no prerequisites, and there is no `Needs` field.

## Clarity
- **low**, `steps.ts:211`: "two high tides and two low tides, about 12 hours 25 minutes apart." It is ambiguous which events are 12 h 25 min apart. Fix: "two high tides and two low tides, with the highs about 12 hours 25 minutes apart rather than 12 hours, because…"

Otherwise the wording fits level 1: the terms (solstice, equinox, Arctic circle, nodes, gibbous, synodic month, parallax) are explained before or where they are used.

## Sources consulted
- https://eclipse.gsfc.nasa.gov/OH/OH2026.html (eclipses of 2026)
- https://cosmoquest.org/x/365daysofastronomy/2026/01/31/jan-31st-perihelion-aphelion/ (perihelion and aphelion distances, 2026)
- https://en.wikipedia.org/wiki/Burntcoat_Head,_Nova_Scotia (Fundy tidal range)
- https://serc.carleton.edu/quantskills/activities/13818.html (solar tide ≈ 46% of lunar)
- https://www.ebsco.com/research-starters/astronomy-and-astrophysics/uranus/ (Uranus tilt)
- https://arxiv.org/pdf/2208.10997 (ecliptic limits)
- https://earthsky.org/astronomy-essentials/are-day-and-night-equal-equinox-september/ (day and night at the equinox)
- https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html (Moon's orbit and eclipses)
- My own recalculation of `sky.ts` (day lengths, insolation ratios, node windows, the 2026 eclipse geometry, the lunar day)
