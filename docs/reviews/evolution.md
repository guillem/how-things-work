# Review: evolution

## Verdict
Ready after the fixes below. Models, numbers and catalogue requirements hold up. The most important fix is the
date of the carbonaria mutation: van't Hof et al. 2016 give 1819 only as the maximum-likelihood date of a
highly skewed estimate (median 1763, interquartile range 1681–1806), and say the mutation may have sat rare
for a long time. So "around **1819**", followed by "happened to arrive as the soot did", overstates the date
and the timing coincidence. Saying it may be older also makes the catalogue Pitfall clearer: selection acts
on variation that already exists.

## Factual errors
- **medium** — steps.ts:282 and HistoryScene.svelte:129. The mutation is dated firmly to "around 1819", and the text says it "happened to arrive as the soot did". The paper says: "highly skewed (median = 1763, interquartile range = 1681-1806) with a maximum likelihood at 1819", and that the mutation "could have existed undetected at low frequency for hundreds of years". Fix: "most likely around 1819, though it may be decades older: it may have waited, rare and of no use, until the soot made it pay off." Readout: "most likely ≈1819". Source: van't Hof et al. 2016 author manuscript, https://livrepository.liverpool.ac.uk/3002967/1/saccheri_carbonaria_whole_paper_with_figs.pdf
- **medium** — steps.ts:285. The 1848 and 98%-in-1895 figures are cited to Wikipedia. The note also mentions a pre-1811 black specimen "kept in Oxford", which I could not trace to a non-Wikipedia source and which, next to a firm 1819 date, reads as a contradiction. Fix:
  - For 1848, cite Edleston 1864, as noted by van't Hof et al. 2016 ("generally regarded as the first reported sighting").
  - For 98% in 1895, cite Majerus 2009, *Evolution: Education and Outreach* 2: 63–74. I checked that wording only through a search excerpt, so the text keeps "reported".
  - Drop the Oxford specimen.
  - Sources: https://doi.org/10.1007/s12052-008-0107-y and the van't Hof manuscript above.
- **medium** — steps.ts:285. Cook et al. 2012 are misattributed. They say the 9% daily selection explains the long-term *local* decline, and that "the decline rate suggests a selection pressure against melanics of s ≈ 0.1–0.2 per generation (table 2; [3])", citing their own Madingley table and Cook 2003. They do not say "10–20% per generation across Britain". Our least-squares fit of the simple model to the same Madingley shares gives 27%, above their range. Fix: say so openly. For figures across Britain, cite Cook & Saccheri 2013: rates from 8 to 35%, an average of about 12%. Sources: Cook et al. 2012 (Harvard DASH copy), https://pmc.ncbi.nlm.nih.gov/articles/PMC3668657/
- **low** — steps.ts:284. "a site in Cambridge": the experiment ran in Majerus's 1 ha garden near Coton ("suburban Cambridge"). It covered six seasons, 2002–2007. Fix: "near Cambridge". Also, "the birds ate" fits the experiment's own wording ("eaten"), and Majerus saw about a quarter of the disappearances being taken by birds himself. Leave as is.
- **low** — steps.ts:282. "first black peppered moth on record caught alive": "caught alive" comes from Wikipedia. Fix: "The first black peppered moth on record was caught in Manchester in 1848."
- **low** — steps.ts:248. "from a few hundred bacteria each". The course notes give an inoculum of about 10³, and the original could not be checked. Fix: "from a small number of bacteria each".
- **low** — steps.ts:340. "Richard Lenski … has moved a drop … every day since": the experiment moved to Jeffrey Barrick's lab (University of Texas at Austin) in 2022. Fix: "Richard Lenski started 12 flasks … and a drop of each has been moved into fresh food almost every day since (since 2022 in Jeffrey Barrick's lab)".
- Checks out:
  - Kettlewell 1953 (27.5% and 13.1%; Heredity 9: 323–342).
  - MEGA-plate: 120 × 60 cm, bands of 0, 3, 30, 300 and 3,000× MIC, 10 days, a 10,000-fold rise in MIC, the intermediate-step quote, *folA*.
  - Haldane 1927 (2s) and Kimura 1962.
  - Lenski: start date, 6.6 generations a day, 50,000 generations by 2010, frozen every 500, Cit⁺ by 31,500.
  - Majerus: 4,864 moths, 100 of 342 and 963 of 4,522 eaten, 9.1% daily.
  - Madingley shares (table 2).

## Model issues
- None. The Wright–Fisher, Kimura, Luria–Delbrück, MEGA-plate and dominant-selection models are correct. Quoted results reproduce in Node:
  - kimura(200, 0.05) = 9.5%
  - kimura(10, −0.01) = 4.1%
  - advantageFor(2% → 98%, 47) = 0.320
  - fitMadingley = 0.269
  - −ln(11/20)/2·10⁷ = 3·10⁻⁸

## Narrative and scene mismatches
- **low** — steps.ts:199. "Fixation takes on the order of 4N generations". The populations start at a half share. From there the mean time to loss or fixation is −4N[p ln p + (1−p) ln(1−p)] ≈ 2.8N generations; 4N is the time for a single new copy that fixes. Fix: "Starting from half, loss or fixation takes about 2.8N generations on average, so only the smaller populations reach it within the chart."

## Catalogue requirements
- Met. Mutation rate, population size and environment (predators, plus an antibiotic dose on the MEGA-plate) are all controls. The trait histogram shifts. The ingredient switches show the Takeaway. The Pitfall is addressed explicitly in the foresight and blind steps.

## Clarity
- Checks out for level 1.

## Sources consulted
- van't Hof et al. 2016, Nature 534: 102–105 (author manuscript): https://livrepository.liverpool.ac.uk/3002967/1/saccheri_carbonaria_whole_paper_with_figs.pdf
- Cook, Grant, Saccheri & Mallet 2012, Biol. Lett. 8: 609–612: https://doi.org/10.1098/rsbl.2011.1136
- Cook & Saccheri 2013, Heredity 110: 207–212: https://pmc.ncbi.nlm.nih.gov/articles/PMC3668657/
- Majerus 2009, Evo Edu Outreach 2: 63–74 (search excerpt only): https://doi.org/10.1007/s12052-008-0107-y
- Baym et al. 2016, Science 353: 1147–1151 (author manuscript): https://ndownloader.figshare.com/files/56776277
- Luria & Delbrück 1943. The primary PDF could not be fetched. Figures come from S. M. Carr's notes (https://www.mun.ca/biology/scarr/4241smc_Luria-Delbruck_experiment.html). PMC11495157 (2024) corroborates the bulk-culture variance of 15: https://pmc.ncbi.nlm.nih.gov/articles/PMC11495157/
