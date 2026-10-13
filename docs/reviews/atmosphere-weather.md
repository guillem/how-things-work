<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$1.24 in tokens + 15 web searches -->
# Review: atmosphere-weather

## Verdict
The page is ready after the fixes below. The physics is sound: the energy-balance model, Held–Hou, the inertial-motion integrator, geostrophic and friction winds, the DeMaria–Kaplan ceiling and the Saffir–Simpson limits are all implemented correctly. I re-ran the energy-balance model and it matches what the page says: 58 °C at the equator and −58 °C at the poleward band with no transport, 27.8 °C at the equator and a 13.6 °C global mean today, and a peak flow of 5.8 PW at 34°. The most important fix is the hurricane growth rate. With it, every storm over warm water strengthens about twice as fast as the threshold for "rapid intensification" and goes from depression to category 4 in about 1.3 days. Next come the Halley/Hadley history and the note that wrongly claims the 15 km height brings the Hadley cell edge closer to 30°.

## Factual errors
- **Low**, StormScene.svelte:202. `if (w >= 17)` labels 17.0–17.4 m/s as a tropical storm. The threshold is 34 kt, which is 17.5 m/s; a depression is ≤ 33 kt (≤ 17 m/s). Fix: `if (w >= 17.5) return 'Tropical storm';`, and make the same change at line 206 (`v < 17.5`) and line 475. Source: https://en.wikipedia.org/wiki/Saffir%E2%80%93Simpson_scale
- **Low**, steps.ts:153, moderate confidence. "Moving air tends to keep its motion relative to the stars" is the popular explanation. On a real rotating Earth, a freely coasting parcel does not move in a straight line relative to the stars; gravity and the equatorial bulge keep acting on it. The inertial circle the page shows comes out of the rotating-frame equations, not from straight-line motion seen from space. I could not look up a source for this; it is from standard dynamics references (e.g. Persson 1998, Bull. Amer. Meteor. Soc. 79, 1373). Suggested fix: "The Earth turns once a day, and we turn with it. Air set moving over the turning planet does not keep up with the turning ground beneath it, so seen from the ground it seems to be pushed sideways…"

## Model issues
- **Medium**, atmosphere.ts:417–418 and 429–431. With `STORM_GROWTH = 1/12` the logistic curve's fastest growth is vmax·r/4 = 1.56 m/s per hour at 29 °C. That is about 73 kt in 24 hours in every warm-sea storm, against an NHC "rapid intensification" threshold of 30 kt in 24 hours, which only 20–30% of storms ever reach. The model storm becomes a hurricane in 14 h, category 3 in 25 h and category 4 in 31 h. The comment's "typical intensification over 2–4 days" is not what the code does.
  - Fix: `const STORM_GROWTH = 1 / 24;`. Then the peak rate is about 36 kt/day, the storm is a hurricane at about 28 h, category 3 at about 50 h, and reaches 70 m/s at about 98 h; 120 h gives 72.7 m/s, so the "> 70" test still passes.
  - Update e2e:152: at 200 h the storm is still 0.06 m/s short of the ceiling, so either use `stormEvolve(20, 30, 15, 400)` or loosen the precision to `1`.
  - Add a realism test: `expect(stormIntensity(29, 15, 24) - STORM_SEED).toBeLessThan(20);`.
  - Add to the hurricane note (steps.ts:223): "…and most never get near their ceiling."
  - Source: https://en.wikipedia.org/wiki/Rapid_intensification
- **Medium**, atmosphere.ts:404–405 and 434, StormScene.svelte:630–633. The model applies 26.5 °C and 5° as hard on/off switches to a mature storm, but they are thresholds for a storm to form. The readout jumps from "57 m/s (category 3)" at 26.5 °C to "none — too cool for a hurricane" at 26.0 °C, while the page's own DeMaria–Kaplan fit gives 54 m/s at 26 °C. The cheapest fix is honest wording rather than new physics:
  - StormScene line 631 becomes `'none here — too cool to keep a hurricane going'`.
  - Add to the steps.ts:223 note: "In this model 26.5 °C and 5° are sharp switches; real storms weaken more gradually as the water under them cools."
- **Low**, atmosphere.ts:39–41. The comment says "~418 at the equator, ~173 at the poles", but the fit with S0 = 1361 gives 422 and 176, which are the numbers the chart shows (418 and 173 are the exact annual means). Fix: "~422 at the equator, ~176 at the poles (exact annual means: ~417 and ~173)".
- **Low**, e2e/atmosphere-model.e2e.ts:90. The comment "after a ~70 km wide loop" is wrong: at 5 m/s and 45° the loop is 2·5/f ≈ 97 km across. Fix: "~100 km wide loop".
- The rest checks out:
  - North's insolation fit and the North et al. A = 203.3, B = 2.09 OLR constants are correct.
  - The tridiagonal solver and the transport formula −2πa²D(1−x²)dT/dx are correct.
  - The RK4 integrator with f taken at the parcel's latitude is correct.
  - The geostrophic sign and units (×0.1 Pa/m), and the friction turn (+30° × sign f), are correct.
  - The DeMaria–Kaplan constants and the exact wind integral are correct.

## Narrative and scene mismatches
- **Low**, steps.ts:195. The note says "The winds drawn are the geostrophic wind above the ground, and near the ground the same turned…". On this step the map draws only the near-ground wind (`surface = !fronts`). Fix: "The arrows show the wind near the ground: the <dfn …>geostrophic wind</dfn>, turned about 30° towards low pressure and slowed by about a third by friction. The closer together the isobars, the stronger the wind."
- **Low**, BalanceScene.svelte:300 and 652. The "pole" readout is the temperature of the last band, centred at 81.5°. It shows −12 °C for today's climate; the real poles average about −18 °C (Arctic) and about −50 °C (Antarctic). Either label it `near the pole (80°) ${fmtT(tPole)}`, or add to the steps.ts:130 note: "The model is the same in both hemispheres, so its polar temperatures are milder than the real Arctic and much milder than Antarctica."
- Everything else matches: the quoted numbers (420 W/m², nearly 60 °C and below −55 °C, 6 PW near 35°, 28 °C and 14 °C, 35°, 24-hour day, loops 160–190 km across, Ro ≈ 3000, 1 and 0.1, ¼° per minute) agree with what the model computes and the scenes show.

## Catalogue requirements
- **Low**. The entry says "Heat a globe unevenly", but the reader cannot change the heating, only the transport. This is acceptable, because the uneven heating is shown and the takeaway is visible in the poleward heat ribbons. If you want the interaction built literally, a slider for the equator-to-pole heating contrast (Δ in `hadleyEdge`) would also make the Hadley cell width respond.
- The fronts form from lows the reader places instead of being placed directly; that is a defensible reading of "place … fronts".
- The spin control, Coriolis deflection, highs and lows, and sea-surface warming are all built. The sink pitfall is handled explicitly in its own step.

## Clarity
- **Low**, steps.ts:155. "pendulum day" is used without a definition. Fix: `<dfn data-def="The time a Foucault pendulum takes to turn once: a sidereal day ÷ sin(latitude), about 34 hours at 45°.">pendulum day</dfn>`.
- **Low**, steps.ts:169. "tropopause" is not defined. Fix: `<dfn data-def="The top of the lowest layer of the atmosphere, where the weather happens: about 16 km high in the tropics, 9 km near the poles.">tropopause</dfn>`.
- **Low**, steps.ts:166–167. The scene labels the "Ferrel cell" and "polar cell", but the step body never names them. Fix: "Beyond it, from about 30° to 60°, lies the Ferrel cell, with the <strong>westerlies</strong> at the ground…; near the poles, the polar cell and its cold easterlies."

## Sources consulted
- https://journals.ametsoc.org/view/journals/atsc/77/4/jas-d-19-0169.1.xml (Hill et al. 2020: the Held & Hou 1980 parameters Δh = 1/3, Ht = 10 km)
- https://climate-dynamics.org/wp-content/uploads/2016/06/lorenz83.pdf (Lorenz, history of general-circulation theory: Halley, Hadley)
- https://en.wikipedia.org/wiki/Rapid_intensification (30 kt in 24 h; 20–30% of storms)
- https://www.nhc.noaa.gov/aboutsshws.php and https://en.wikipedia.org/wiki/Saffir%E2%80%93Simpson_scale (category limits in kt and m/s)
- https://journals.ametsoc.org/jcli/article/10/11/2921/28561/The-Relationship-between-Sea-Surface-Temperatures (DeMaria–Kaplan constants 28.2, 55.8, 0.1813)
- https://journals.ametsoc.org/view/journals/mwre/131/8/_2562.1.xml (the variant A = 34.21 once storm motion is accounted for; the page's 28.2 is the other published DeMaria–Kaplan form, so no change needed)
- https://www.nature.com/articles/srep16661 (peak poleward heat transport about 5.5 PW at 35–40°)
- https://en.wikipedia.org/wiki/Coriolis_force (Shapiro 1962: 2 m tank left to settle for 24 h)
- https://www.visualcapitalist.com/visualizing-global-energy-production-in-2023/ (620 EJ in 2023 ≈ 20 TW, so 6 PW ≈ 300×)
