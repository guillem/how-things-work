<!-- batch msgbatch_01UFq4Tn9dsF5RBKF83nYjzz, claude-opus-5-5, submitted 2026-10-14T18:25:38.305Z, ~$1.47 in tokens + 15 web searches -->
# Review: deep-time

## Verdict

The page is ready once the fixes below are made. Nearly every number I checked against its source is right. That includes the ICS 2024/12 boundaries and colours, the calendar dates and times, the uranium-238 dating, Gough's formula for the Sun, the PhanDA extremes, the Great Oxidation Event dates and the hominin and sapiens dates. The pitfall about early continent positions is handled honestly. The most important fix is in the oxygen track. The "disputed" box for 1,800–800 Ma is drawn exactly over the range from 0.1% to 4% of today's level. That is the one range neither cited estimate supports: one says less than 0.1%, the other more than 4%. A reader looking only at the graphic would come away with the wrong idea. Next in importance are the end-Permian extinction figure and its source, and the date for mammals.

## Factual errors

- **Medium** · steps.ts:196 and :198. The page says "more than half of all the groups (genera) of animals died out" and gives "about 56% of all genera (Mills et al. 2023)". This understates the loss and leaves out the key word "marine". Mills et al. 2023 is a review of oxygen levels, not an extinction tally, so I doubt it is the source (moderate confidence). Published figures are about two-thirds of marine genera, or roughly 79% of genera in the last Permian stage (Payne & Clapham 2012). Fix in the body: "…and about two-thirds of the genera of sea animals, and most of their species, died out." Fix in the notes: "…removed roughly two-thirds or more of marine genera (Payne & Clapham 2012, Annu. Rev. Earth Planet. Sci. 40, 89)." Sources: https://www.nature.com/articles/ngeo2079 and https://people.ucsc.edu/~mclapham/papers/PayneClapham2012.pdf
- **Medium** · deeptime.ts:307 (`mammals.from: 205.7`). The cited fossil is *Kalaallitkigun* (Sulej et al. 2020). PNAS dates it to the mid–late Norian, about 215 Ma, not 205.7 Ma. Fix: `from: 215`, `evidence: 'Kalaallitkigun, a mammal relative from the Late Triassic of Greenland'`. Also rename the row "Mammals and close relatives", because mammaliaforms are not crown mammals. Sources: https://www.pnas.org/doi/10.1073/pnas.2012437117 and https://www.sci.news/paleontology/kalaallitkigun-jenkinsi-08962.html
- **Medium** · steps.ts:150. The cold spells are listed as "one around 300 million years ago, and the one we live in". This leaves out the Late Ordovician (Hirnantian) glaciation, about 445 Ma, which also lines up with the End-Ordovician extinction on the next step. Also, the late Paleozoic icehouse lasted roughly 340–290 Ma; it was not a single moment. Fix: "…are the exception: a short one about 445 million years ago, a long one from about 340 to 290 million years ago, and the one we live in…".
- **Low–medium** · steps.ts:150. "The coldest stage of all is the last ice age, about 11 °C." The 11.4 °C value is PhanDA's average for the whole Upper Pleistocene (129,000–12,000 years ago). That span includes the last interglacial. The peak of the last ice age was colder, about 6 °C below pre-industrial (Tierney et al. 2020, Nature 584, 569; I did not fetch it this session). Fix: "The coldest stage of all is the most recent one before ours, the last 129,000 years of ice-age swings, averaging about 11 °C."
- **Low** · steps.ts:152 (notes). "the swings of the ice ages within the last 2.6 million years show up only as one cold average." PhanDA splits the Quaternary into five stages (deeptime data GMST rows 1–5). Fix: "…show up only as a few stage averages."
- **Low** · steps.ts:211. The flat steps are described as "averages over millions of years". The Quaternary stages last 12,000 years to 1 million years. Fix: "averages over whole geological stages, from thousands to millions of years long".
- **Low** · deeptime.ts:354. The source for "Oldest rocks" (4,030 Ma) is given as Wilde et al. 2001. That paper is about the Jack Hills zircon. The Acasta Gneiss date (4.031 ± 0.003 Ga) comes from Bowring & Williams 1999, Contrib. Mineral. Petrol. 134, 3. Fix: `source: 'Bowring & Williams 1999, Contrib. Mineral. Petrol. 134, 3 (Acasta Gneiss, Canada)'`. Source: https://ncse.ngo/how-old-earth
- **Low** (moderate confidence) · deeptime.ts:270–273 and steps.ts:182. The 571 Ma Avalon fronds are of uncertain biological affinity. *Dickinsonia* (about 558 Ma) is usually taken as the earliest firmly established animal (Bobrovskiy et al. 2018, Science 361, 1246; not fetched). This clashes with "oldest widely accepted fossils" (steps.ts:181). Fix: change the evidence to "large Ediacaran fossils, Newfoundland (probably animals)".
- **Low** · deeptime.ts:153–156. Recent work puts the start of the Marinoan glaciation at about 650 Ma; 639 Ma is only a constraint from Namibia. Consider `base: 650`. Source: https://www.sciencedirect.com/science/article/abs/pii/S0921818123000449
- **Low** · steps.ts:132. "Older ocean floor has all gone back into the mantle" is slightly too strong. Fix: "Almost all older ocean floor has gone back into the mantle…".

## Model issues

- **High** · deeptime.ts:218–226 with TimeScene.svelte:812–822. The `boring` box is drawn from 1e-3 to 4e-2 PAL as a solid filled band. The two cited estimates are "<0.1%" (Planavsky) and ">4%" (Zhang), so the band covers exactly the values both of them exclude. Fix: make the box span both estimates, for example `lo: 1e-4, hi: 1e-1`. Then mark the two published values inside it as dashed lines labelled "Cr isotopes: < 0.1%" and "trace metals: > 4%".
- **Low** · data/continents.ts:1832–1833. The last two rings are identical (and RING_PLATES ends with `456, 456`). While fading in at 0.75 opacity, that polygon is drawn twice and looks darker. Remove the duplicate in build.mjs.
- **Low** · globe.ts:116–126. `ringAt` picks the containing ring with the fewest vertices, not the smallest area. Where blocks share borders, this can assign a point such as Paris to the wrong plate. Use the spherical area, or the bounding-box area.
- **Low** · TimeScene.svelte:110–116. While "Play a billion years of drift" runs, the slider does not move with the cursor. Either show the played age in the readout's format string or disable the slider while playing.
- **Low** · TimeScene.svelte:155, 191. With `TEMP.hi = 40`, the 95th-percentile bands for the Turonian (43.7 °C) and Coniacian (40.8 °C) spill about 11 px above the track, onto the map-quality strip. Raise `hi` to 45 or clamp the bands.
- The tests check real-world properties: GPlates Web Service positions, ICS boundaries, the quoted ranges for PhanDA and Mills, and the calendar. They do not assert the narrative's other dates or percentages (14 Jan, 20 June, late August, 16 Nov, 13 Dec, 0.06%, 0.0003%, 88%). Adding those would stop the text drifting from the model. Low.

I confirmed the ICS 2024/12 values used (358.86, 372.15, 419.62 Ma): https://stratigraphy.org/ICSchart/ChronostratChart2024-12.pdf

## Narrative and scene mismatches

- **Medium** · steps.ts:197. "Notice how the boundaries of the time scale sit on the extinctions." The track shows only periods. The Late Devonian line (372.15 Ma, a stage boundary) falls in the middle of the Devonian bar. Fix: "Notice how four of the five sit on the boundaries between periods: geologists drew their lines where the fossils change. The fifth, in the Late Devonian, marks a boundary between two stages inside the Devonian."
- **Low** · steps.ts:165. "each faint line up the track is ten times more oxygen than the one below." The faint lines (1e-6, 1e-4, 1e-2) are a factor of 100 apart; the factor of 10 only holds if the dashed, labelled lines are counted too. Fix: "each line up the track, faint or dashed, is ten times more oxygen than the one below."
- **Low** · steps.ts:231. The title "The last hour of the year" does not fit: the step covers all of 31 December, and the hominins appear at 10:34. Fix: "The last day of the year".
- **Low** · steps.ts:133. The text names the colours green, orange and grey, but they come from `--dt-good/fair/none` in CSS, which I could not see. Check they match. The strip's text labels already carry the meaning.

## Catalogue requirements

- Interaction, takeaway and pitfall are all met. The globe stops at 1 Ga with a "?" and the map-quality strip. The sliver highlight and the calendar make the takeaway visible.
- **Low** · steps.ts:134. "Before about a billion years ago, the continents' positions are too poorly known to draw" presents the plate model's own cut-off as a fact about the field. Reconstructions back to about 2 Ga do exist, and they disagree with each other. Fix: "The plate model used here stops a billion years ago; older reconstructions exist, but they disagree so much that we do not draw them."
- **Low** · data/records.ts:3–8. Needs are met with real data. However, the PhanDA and Mills repositories state no licence. Confirm permission to redistribute, or fetch the data at build time.

## Clarity

- **Low** · TimeScene.svelte:586 and steps.ts:150, 152. "Stage", as in "PhanDA stage" and "coldest stage", is never explained for level-1 readers. Add a `<dfn>` at the first use: "the smallest named division of geological time, usually a few million years long".
- **Low** · steps.ts:91 vs :164. Saying the Proterozoic is "when oxygen filled the air" contradicts "for over a billion years oxygen stayed low". Fix: "the Proterozoic, when oxygen first appeared in the air".
- **Low** · steps.ts:212. In "if the whole history were 56 cm wide on your screen, the full bar at that scale would stretch for over 200 km", it is unclear which bar is 56 cm. Fix: "if the last 12,000 years filled a 56 cm screen, the whole history at that scale would stretch for over 200 km."
- **Low** · steps.ts:251. "Complex life" in the takeaway clashes with "complex cells" (1,635 Ma, 36% of the history) used earlier. Fix: "large, many-celled life, and humans most of all, occupy only its last sliver".

## Sources consulted

- ICS chart v2024/12: https://stratigraphy.org/ICSchart/ChronostratChart2024-12.pdf
- ICS chart v2023/04 (earlier Famennian value): https://stratigraphy.org/ICSchart/ChronostratChart2023-04.pdf
- Sulej et al. 2020, PNAS: https://www.pnas.org/doi/10.1073/pnas.2012437117 ; https://www.sci.news/paleontology/kalaallitkigun-jenkinsi-08962.html
- Niedźwiedzki et al. 2010, Nature (the 390 Ma used is acceptable, given the later revision of the date): https://www.nature.com/articles/nature08623 ; https://www.scup.com/doi/10.1111/let.12083
- Mills et al. 2023, abstract: https://discovery.ucl.ac.uk/id/eprint/10171129/
- End-Permian marine genera: https://www.nature.com/articles/ngeo2079 ; https://people.ucsc.edu/~mclapham/papers/PayneClapham2012.pdf
- Oldest rocks and minerals: https://ncse.ngo/how-old-earth ; https://en.wikipedia.org/wiki/Oldest_dated_rocks
- Cryogenian chronology: https://www.sciencedirect.com/science/article/abs/pii/S0921818123000449 ; https://www.researchgate.net/publication/304613992_Duration_and_nature_of_the_end-Cryogenian_Marinoan_glaciation
- From memory, not fetched this session: Tierney et al. 2020, Nature 584, 569 (cooling at the last glacial maximum); Bobrovskiy et al. 2018, Science 361, 1246 (*Dickinsonia*); Gough 1981; Wilde et al. 2001.
