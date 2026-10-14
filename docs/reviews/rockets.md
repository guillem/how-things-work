<!-- batch msgbatch_01BV1p6aUAsiFtzFKbfs3u11, claude-opus-5-5, submitted 2026-10-14T08:43:27.540Z, ~$1.27 in tokens + 8 web searches -->
# Review: rockets

## Verdict
The page is ready once the fixes below are made. I ran `rockets.ts` and `space.ts` in Node and recomputed every number the page quotes. Almost all of them hold: the rocket-equation examples, the 9.4 km/s → ×23 → 96% chain, Hohmann to GEO (2.45 + 1.48 km/s, 5.3 h), Mars (259 d, 136°, 44°, 780 d, 3.6 and 2.1 km/s), the window dates (minima 17 Nov 2026, 16 Dec 2028, 20 Jan 2031 for a 260-day trip), and the Jupiter flyby (7.4 km/s in, 157° turn, 18.4 km/s out). The most important fix is in the losses step. The text says the early effort of holding the rocket up is the *gravity loss*, but the tally books it as *steering loss*: at T+60 s it shows gravity 0.12 km/s against steering 0.58 km/s. The next fix is the S-IC vacuum exhaust speed, which is set to 317 s, higher than the F-1's real 304 s.

## Factual errors
- **low** — steps.ts:199. "found by Konstantin Tsiolkovsky in 1903": he derived it on 10 May 1897 and published it in 1903. Fix: "derived by Konstantin Tsiolkovsky in 1897 and published in 1903". https://nmspacemuseum.org/inductee/konstantin-e-tsiolkovsky/
- **low** — steps.ts:308. "Pioneer, Voyager, Cassini and New Horizons all used flybys to reach the outer planets with rockets that could never have got there directly": Pioneer 10 flew to Jupiter on a direct trajectory, and New Horizons used Jupiter to shorten its trip, not to make it possible. Fix: "Pioneer 11, the Voyagers, Galileo and Cassini used flybys to reach targets their rockets could not have reached directly, and New Horizons used Jupiter to cut years off its trip to Pluto." https://www.nasa.gov/history/45-years-ago-pioneer-11-explores-jupiter/

## Model issues
- **medium** — vehicles.ts:57-58, 75; rockets-model.e2e.ts:60. `veVac = 2598 × 9160/7648` = 3,112 m/s (317 s). The F-1's vacuum specific impulse is 304 s (2.98 km/s); its vacuum-to-sea-level thrust ratio is 1,746/1,522 = 1.15, not 1.20. The stage's thrust rose to about 9.18 M lbf partly because the propellant flow rose too, so treating the whole rise as faster exhaust at the same flow overstates the exhaust speed. As a result, "rocket equation on its masses" reads 9.40 km/s instead of about 9.24 (AscentScene card and title, and the budget's LEO leg), and the test that expects 3.9 km/s for the S-IC encodes the error.
  - I ran it with `veVac = 2982`: the simulated Saturn V cuts off at 7.73 km/s and falls back. So the match with Apollo 11 currently depends on the inflated number.
  - Fix: `veVac: 304 * G0` and test `deltaV(s1.veVac…) ≈ 3.74`.
  - To recover orbit honestly, let the S-IVB burn until the guidance cuts it off, using the propellant it actually kept for translunar injection (its mass at second-burn cutoff from Table 20-9), instead of stopping at the first-burn cutoff mass. Then relax `spare < 300`.
  - Set the budget step's LEO leg to a fixed 9,400 m/s rather than `idealDeltaV(saturnV)`.
  - Confidence: high on the 304 s; medium on the best way to re-calibrate.
  - Sources: https://en.wikipedia.org/wiki/Rocketdyne_F-1 and https://www.thisdayinaviation.com/tag/s-ic/
- **low** — vehicles.ts:94; rockets.ts:225; test line 70. The 191.1 km insertion altitude is a geodetic altitude above the local ellipsoid. On the spherical Earth of radius 6,378.165 km that the model uses, Apollo 11's orbit was 100.4 × 98.9 nmi, i.e. 185.9 × 183.2 km. The model targets 190 km, so its orbit radius is about 5 km too high. Fix: compare the model's perigee and apogee with 183 and 186 km in the test, and use a 185 km target for the Saturn V. The card can keep "191 km up" as the reported insertion altitude. https://history.nasa.gov/SP-4029/Apollo_11a_Summary.htm
- **low** — steps.ts:84 and TransferScene.svelte:113-115. The `burn1` slider stops at 3.2 km/s, but escape from 200 km needs 3.224 km/s, so the verdict "Burn 1 alone escapes the Earth" can never appear. At 3.2 km/s the apogee is 1.48 million km, beyond the Moon and at the edge of Earth's Hill sphere, where an Earth-only orbit is not meaningful. Fix: cap the slider at `max: 3.0` (apogee 150,000 km) and drop the escape verdict, or add the note "beyond about 1 million km the Sun's pull takes over; not modelled".
- The tests otherwise check real properties: the Saturn V against the flight report, the Hohmann figures, the Lambert solver at 180°, window spacing and the Perseverance date, and the flyby. No other model problems found.

## Narrative and scene mismatches
- **medium** — steps.ts:227 (body) and :227's `dfn` for gravity loss, against rockets.ts:386-394. The losses are counted against the inertial velocity, which already points east at 0.41 km/s on the pad. So the vertical climb is booked as steering loss: at T+60 s the tally shows gravity 0.12 and steering 0.58 km/s, and at cutoff 0.87 and 0.82. The text says the opposite ("much of their effort only holds the rocket up against gravity: that is the gravity loss"), and the definition says the gravity loss "is largest early on". The note (line 229) explains the effect, but the body and the bars disagree. Fix the body: "The engines push it straight up at first. That slow, steep climb wastes effort: because the spinning Earth is already carrying the rocket east at 0.4 km/s, a push straight up is at first across its direction of travel, so the tally books it as <dfn…>steering loss</dfn>; once it is climbing, gravity pulling back along the path is the <dfn…>gravity loss</dfn>. So the rocket tilts over as soon as it can…". Change the definition to "…while the rocket is still climbing." and remove "It is largest early on…". The alternative is to count the losses against the air-relative velocity and compute the spin row live as inertial speed minus air-relative speed.
- **medium** — steps.ts:215 (tyranny notes). "The bars are drawn to scale for 1 tonne arriving" — the scene draws nested squares. Fix: "The squares are drawn to scale by area, round 1 tonne arriving at the end."
- **medium** — AscentScene.svelte:342 and header :6. "heights stretched about 8×": the scales give (456 px / 240 km) ÷ (536 px / 3000 km) = 10.6×. Fix: "heights stretched about 11×" in both places.
- **low** — steps.ts:229. "the times differ by up to a minute": the simulated cutoff is at T+10:41 against the real T+11:49, 68 s apart. Fix: "so the simulated flight reaches orbit about a minute early (T+10:41 against T+11:49)". Recheck this after the F-1 fix.
- **low** — MarsScene.svelte:138. `inWindow` compares against the cheapest trip in the whole 5.5-year range, and the windows differ in cost. For a 200-day trip, the bottom of the 2026 window costs 1.15× the 2031 minimum, so it reads "1.2 times the cheapest" instead of "In a launch window". Fix: compare with the nearest local minimum of the sampled curve, e.g. store `{day,total}` for each local minimum in `curve`, then `inWindow = trip && trip.total <= 1.1 * nearest.total && Math.abs(departDay - WINDOW_START - nearest.day) < 90`.
- Everything else matches: the Saturn V tally (engines 9.09 km/s, 7.36 left after losses, 7.77 with spin), "a third stage helps less" (500 t at 3 km/s: 6.70 → 9.30 → 10.02 km/s), two stages on 500 t reaching orbit with 0.30 km/s to spare, and the hard-coded GEO, Mars and Jupiter labels.

## Catalogue requirements
- **low** — steps.ts:165. The title "Rockets and orbital manoeuvres" differs from the catalogue's "Rockets & orbital maneuvers"; the generated links will show the catalogue's title. Fix: `title: 'Rockets & orbital maneuvers'`, or change the catalogue in the same commit.
- Otherwise met: the interaction is built as written (design and fly a rocket, raise an orbit, Mars window, flyby), and the takeaway is visible in the nested squares and the log-scale plot. The entry has no pitfall or needs to check.

## Clarity
- **low** — steps.ts:226. "From the previous topic" — name it: "From Orbits & Kepler's laws:".
- **low** — steps.ts:228. "parking orbit" is not explained. Fix: "entered its parking orbit (a temporary low orbit before heading for the Moon)".
- **low** — steps.ts:265. "Fire the engine forwards" could be read as pointing the nozzle forwards, which would brake. Fix: "Fire the engine to push forwards, along the direction of travel,".

## Sources consulted
- https://en.wikipedia.org/wiki/Rocketdyne_F-1 (F-1 thrust and Isp, sea level and vacuum)
- https://www.thisdayinaviation.com/tag/s-ic/ (S-IC thrust rising from 7,648,000 to 9,180,000 lbf)
- https://history.nasa.gov/SP-4029/Apollo_11a_Summary.htm (Apollo 11 insertion at 000:11:49.33, 25,567.8 ft/s, 100.4 × 98.9 nmi on a spherical Earth)
- https://www.ibiblio.org/apollo/Documents/1APOLLO12.pdf (insertion about 1,429 nmi downrange, which matches the model's ~2,670 km)
- https://nmspacemuseum.org/inductee/konstantin-e-tsiolkovsky/ (rocket equation 1897, published 1903)
- https://www.nasa.gov/history/45-years-ago-pioneer-11-explores-jupiter/ and https://lasp.colorado.edu/outerplanets/missions_pioneers.php (Pioneer 10 direct, Pioneer 11 gravity assist)
- https://en.wikipedia.org/wiki/S-IC and https://en.wikipedia.org/wiki/S-II (stage dry and propellant masses, for the 10% dry share)
- My own Node run of `rockets.ts` and `space.ts` (Saturn V flight, 48 rocket designs, Mars cost curves, two-burn and flyby cases).
