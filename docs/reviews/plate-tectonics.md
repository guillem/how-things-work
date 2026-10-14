<!-- batch msgbatch_01BV1p6aUAsiFtzFKbfs3u11, claude-opus-5-5, submitted 2026-10-14T08:43:27.540Z, ~$1.75 in tokens + 11 web searches -->
# Review: plate-tectonics

## Verdict
The page is ready once the fixes below are made. The data are real and properly sourced (PB2002, USGS ComCat, GVP). The quoted statistics are recomputed in the tests. I checked the main equations (Airy isostasy, GDH1, McKenzie subsidence, elastic bending at the trench) and they are right. The most important fix is the continental rift. Because the model leaves out the thermal uplift that the notes themselves mention, a rift floods once it has opened about 17 km. Rift volcanoes only appear from 40 km, so the page can never show the dry rift valley with volcanoes that its own East Africa example describes. The step also opens already flooded, 1.7 km below sea level, so "keep pulling… the sea floods in" describes something that has already happened. The other fixes are a handful of factual corrections (the Atlantic's opening age, trench depth, why earthquakes stop near 700 km, intraplate volcanoes "far from any boundary") and some places where the text and the graphic disagree.

## Factual errors
- **Medium**, steps.ts:173. "The Atlantic was born like this: South America and Africa began to split apart about 130 million years ago." The Atlantic as a whole began opening about 200 million years ago, between North America and Africa. Only the South Atlantic dates from about 130–140 million years ago. Replace with: "The South Atlantic was born like this: South America and Africa began to split apart about 130–140 million years ago — which is why their coasts fit together like jigsaw pieces." Source: https://www.britannica.com/place/Pangea
- **Medium**, steps.ts:186. "a deep trench, 8 km or more deep." Trenches lie about 3–4 km below the surrounding sea floor, and their total depth ranges from about 6 to 11 km. Many are shallower than 8 km. Replace with: "…a deep trench, typically 6 to 11 km below sea level." Sources: https://en.wikipedia.org/wiki/Oceanic_trench, https://en.wikipedia.org/wiki/Hadal_zone
- **Medium**, steps.ts:266. "Below about 700 km there are no earthquakes at all: there the rock is too hot and soft to break, even inside the sinking plates." Ordinary brittle failure is already ruled out at 300–700 km. Deep earthquakes are thought to come from the olivine→spinel phase change in cold slabs, which ends near 660 km. Replace with: "Below about 700 km there are no earthquakes at all. Rock that deep cannot crack as it does near the surface; the deep earthquakes are thought to be set off by minerals in the cold sinking plate suddenly changing their crystal structure, and those changes stop near 660–700 km." Sources: https://www.nature.com/articles/s41467-022-33802-y, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9477848/
- **Medium**, steps.ts:277 and MapScene.svelte:306. The text says "12% in the middle of a plate, far from any boundary." GVP's "intraplate" setting is a classification, not a distance. The data include intraplate volcanoes inside the Main Ethiopian Rift and next to the Red Sea, for example [39.4, 8.4], [38.1, 7.1], [38.0, 6.8] and [41.6, 18.4] in volcanoes.ts:24–31, which are within tens of km of PB2002 boundary lines. Replace "far from any boundary" with "that the Smithsonian classes as being within a plate rather than at its edge". Keep "far from any boundary" for Hawaii and Réunion only.
- **Low**, steps.ts:161. "Finding those stripes in the 1960s convinced geologists…" The stripes were mapped in the late 1950s. What came in the 1960s was their interpretation, by Vine and Matthews in 1963. Replace with "Explaining those stripes in the 1960s convinced geologists…".
- **Low**, steps.ts:187. "not at the trench, but 150–300 km inland." The distance from trench to arc varies with slab dip. Syracuse & Abers find that the slab depth beneath arcs ranges from 72 to 173 km. I am moderately confident that 150–300 km is too narrow and suggest "typically 100–300 km inland". The test at e2e:88–89 would need loosening to match. Source: https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2005GC001045
- **Low**, section.ts:20. The code comment reads "105 ± 19 km on average". The abstract gives a global average of 105 km and a range of 72–173 km; the ±19 does not appear in it. Replace with "global average 105 km, range 72–173 km". Source: same as above.

Everything else I checked is correct:
- GVP's count of 1,214 Holocene volcanoes, "the last 12,000 years".
- 52 plates in PB2002.
- GDH1 depths: 2.6 km at the crest, 5.0 km at 50 Myr.
- Isostasy ratios: 0.15/0.85, root 5.6 times the rise.
- Challenger Deep "almost 11 km".
- The Gorkha earthquake of 25 April 2015, M7.8 (it is in the data, day 114).
- The Fiji earthquake of 19 August 2018, M8.2 at 600 km (in the data, day 1326).
- India–Asia collision about 50 million years ago.
- San Andreas offset of more than 300 km.
- Syracuse & Abers's average of 105 km.

## Model issues
- **High**, section.ts:454–497 and 92–100 (`rift`, `riftFloorElevation`). There is no thermal or dome uplift, so the rift floor goes below sea level at β ≈ 1.2, an opening of about 17 km. Rift volcanoes only appear at β > 1.5 (40 km), when the floor is already 0.7 km below sea level. At the default opening of 100 km (β = 2.25) the floor is 1.67 km below sea level, and even the volcanoes' summits stay under water. The notes (steps.ts:174) say East Africa stands on a 1–2 km dome, but the model leaves it out, so the dry-rift stage the page describes never appears. Fix: add the dome to the starting elevation of the stretched continent.
  ```ts
  /** Broad uplift of a young continental rift by hot mantle beneath it (East Africa: 1–2 km), km. */
  export const RIFT_DOME = 1.5;
  export function riftFloorElevation(beta: number, start = CONTINENT_ELEVATION): number {
  	const airFactor = (RHO_HOT - RHO.water) / RHO_HOT;
  	const dropInAir = mckenzieSubsidence(beta) * airFactor;
  	if (dropInAir <= start) return start - dropInAir;
  	return -(dropInAir - start) / airFactor;
  }
  // in rift(): const top0 = CONTINENT_ELEVATION + RIFT_DOME;
  //            const floor = riftFloorElevation(beta, top0);
  //            const z = floor + (top0 - floor) * u;   // shoulders on the dome
  ```
  With this change the floor stays above sea level until β ≈ 3 (160 km) and floods just before break-up at β = 4. That is the Afar/Red Sea sequence the text describes. Also set the default of `riftOpen` to 60 (steps.ts:170), and update the note: "The model adds a broad 1.5 km dome raised by hot mantle, as under East Africa." Add a test, for example: `expect(feature(section(at('continent','continent',60)),'rift')!.z).toBeGreaterThan(0)`, and check that the floor is below 0 just before break-up.
- **Low**, section.ts:65–69 vs 59–63. The depths come from GDH1, which assumes a 95 km plate, but the lithosphere is capped at 125 km (Parsons & Sclater's plate). This has no visible effect at the ages shown. For consistency, cap at 95 km or cite the 125 km source.
- **Low**, e2e/plate-tectonics-model.e2e.ts. The narrative hard-codes "4,516" (steps.ts:117) and "1,214" (steps.ts:119), but the tests only check `> 4000` and `> 1200`. Add `expect(quakes.length).toBe(4516)` and `expect(volcanoes.length).toBe(1214)` so the text cannot drift when the data are rebuilt.

The rest of the model is correct:
- The McKenzie formula and its constants: S(β=2) ≈ 2.2 km.
- Half-space cooling: 101 km at 60 Myr.
- The broken elastic plate: the outer rise is 0.067 w₀ ≈ 200 m at 3πα/4.
- The half-spreading-rate conversion.
- The seismological depth classes.
- The orientation of the subduction teeth: I checked NZ\SA, JF\NA, PA\OK and OK/PA, and all point to the overriding plate.

## Narrative and scene mismatches
- **Medium**, steps.ts:130 vs MapScene.svelte:87. The text says "Seven big ones cover most of the planet", but the map labels nine large plates: PA, AF, NA, EU, AU, SA, NZ, IN, AN. PB2002 also splits India from Australia. Replace with: "Seven or eight big ones cover most of the planet (here India and Australia are counted separately, and the smaller Nazca plate is labelled too); this map, from the geophysicist Peter Bird, has 52 in all."
- **Medium**, steps.ts:172–173 vs the rift scene. The first paragraph describes a dry rift valley with volcanoes, like East Africa. At the default of 100 km, the scene's label reads "rift valley, flooded by the sea", 1.7 km below sea level. The fix is the model fix above, after which the paragraph and the graphic agree.
- **Medium**, steps.ts:147. The note says "The vertical scale… is stretched in its top 30 km." In fact the vertical scale is exaggerated everywhere relative to the horizontal 0.49 px/km: about 12× at the surface, 4× at 30 km, 1.9× at 100 km and 1.6× at 300 km. Slabs therefore look steeper than they are. Replace with: "The cross-section is stretched vertically: twelve times near the surface, easing to about one and a half times at depth (see the depths on the left), or the crust would be too thin to see. Slopes, such as the dip of the sinking plate, look steeper than they really are."
- **Low**, steps.ts:188. "Here the Nazca plate sinks under South America at about 7 cm a year." The subduction step has no speed control, so the clock shows "…at 5 cm a year". Either add `speed` to the controls at steps.ts:184, or write: "In the real Andes the Nazca plate sinks under South America at about 7 cm a year; the clock here assumes 5."
- **Low**, steps.ts:214. "the Nepal earthquake of 2015, magnitude 7.8, is on the map". This step shows the cross-section, not the map. Replace with "was one of the dots on the map at the start".

Everything else the text promises matches what the scenes draw and the model computes:
- The 86% and 17% figures.
- The volcano setting shares of 69%, 18% and 12%.
- Volcanoes 79% within 300 km of a boundary.
- The 2.6 km crest depth.
- Hawaii more than 3,000 km from a boundary.
- The arc waiting until the slab is 100 km deep.

## Catalogue requirements
- **Medium**, section.ts:23–26 vs steps.ts. The model's header says its simplifications are "stated on the page". Several are not: the existing ocean plate is given one age, a continent arriving at a trench is not modelled, erosion and sediments are left out, and the width of mountain belts is schematic. The catalogue requires simplifications to be stated on the page. Add `notes` to the sandbox step (steps.ts:253): "<p>This is a simplified model. The slabs' shapes, the width of the mountains and the sizes of the volcanoes are drawn to a typical pattern; each existing ocean plate is given a single age (60 and 30 million years); an ocean plate can sink for ever, so a continent arriving at a trench is not shown; erosion and sediments are left out.</p>"
- **Low**, data/volcanoes.ts:5–6. GVP's licence terms could not be retrieved. The data are cited as GVP asks, but the licence should be confirmed before release.

Everything else in the entry is met:
- The interaction: drag the plates apart, together or sideways, choose ocean or continent for each plate in the sandbox, and see a world map of boundaries, earthquakes and volcanoes.
- The takeaway is visible in the graphic, through the 86% readout and the dots clustering along the boundary lines.
- The Needs are met with real catalogues.

## Clarity
- **Low**, SectionScene.svelte:941. The sea-floor age labels read "10 Myr". Level 1 readers have not met "Myr", and the body text says "million years". Use `text="{a.age} million yr"`, or "{a.age} My" with a legend.
- **Low**, steps.ts:278. "seamounts" is used without a definition. Add `<dfn data-def="An underwater volcano that does not reach the surface.">seamounts</dfn>`.

## Sources consulted
- Smithsonian GVP, Holocene volcano list (1,214 volcanoes): https://volcano.si.edu/volcanolist_holocene.cfm
- Syracuse & Abers (2006), G³ 7, Q05017, abstract: https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2005GC001045
- Britannica, Pangea (break-up about 200 Ma; South Atlantic about 140 Ma): https://www.britannica.com/place/Pangea
- Oceanic trench (3–4 km below the surrounding floor): https://en.wikipedia.org/wiki/Oceanic_trench
- Hadal zone (trenches about 6 to 11 km below sea level): https://en.wikipedia.org/wiki/Hadal_zone
- Deep-focus earthquakes and the olivine→spinel transformation, 350–660 km: https://www.nature.com/articles/s41467-022-33802-y
- In situ observations of deep faulting during olivine phase transitions: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9477848/
- My own recomputation of the model's equations: the rift floor elevation against opening, the trench-to-arc distance (about 199 km at the default) and the vertical exaggeration.
