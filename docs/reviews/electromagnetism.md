<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.69 in tokens + 12 web searches -->
# Review: electromagnetism

## Verdict
The page is ready once the fixes below are made. The model is sound. It uses the exact loop formulas (elliptic integrals and vector potential), places the Faraday and Lenz signs correctly, has a correct right‑hand convention throughout the scenes, and its tests check real limiting cases. I recomputed the quoted numbers and they all hold: 8.99 µN and 2.25 µN; 50 µT at 2 cm for 5 A; 3.6 mV peak at 1 Hz; 3 m, 12.2 cm and 555 nm. The most important fix is in the "coil" step. Its body says "Every magnetic field comes from moving charge". That contradicts the step's own note on electron spin, and it contradicts the light step, which says a changing electric field also makes a magnetic field. The other fixes worth making are the Maxwell history (he got 310,740 km/s from one measured ratio, not "two numbers") and a note on the page that the wave animation is slowed down and not to scale.

## Factual errors
- **low**, steps.ts:219: "μ₀ = 4π × 10⁻⁷ T·m/A" was exact only before the 2019 SI revision. The CODATA 2022 value is 1.25663706127(20)×10⁻⁶ N/A². Write "μ₀ ≈ 4π × 10⁻⁷ T·m/A". Sources: https://en.wikipedia.org/wiki/Vacuum_permeability and https://physics.nist.gov/constants
- **low**, steps.ts:258: "Mains current alternates 50 or 60 times a second" is ambiguous. 50 Hz means 50 full cycles a second, so the current reverses 100 times a second. Replace with: "Mains current goes through 50 or 60 cycles a second (50 or 60 Hz)."
- **low**, steps.ts:231: "the electrons in iron atoms each act like a tiny circulating current". Most electrons in an atom are paired and cancel each other; only the unpaired ones contribute. Replace with: "some of the electrons in iron atoms (the unpaired ones) each act like a tiny circulating current".

## Model issues
- **low**, em.ts:389 and InductionScene.svelte:146: `R_PICKUP` stays at 10 Ω whatever the turns, so the current on the meter grows in proportion to the turns. With real wire, the coil's resistance also grows with the turns, so the current would grow much less. The narrative only claims the *voltage* grows, which is right. Either state the simplification in the notes at steps.ts:245 ("…10 Ω in all, whatever the number of turns; the coil's own inductance is neglected"), or model R as the meter's resistance plus a resistance per turn.
- **low**, WaveScene.svelte:3: the header says the scene is drawn from "`waveAt` of the model", but it imports only `C` and `wavelength`. It re‑implements the wave as the charge's displacement at the retarded time. That is physically correct: a positive charge's radiated E lies along its displacement. But the tested `waveAt` does not drive the graphic. Either fix the comment, or derive `fieldAt` from a model function and test it. The wave is also drawn with no fall‑off with distance and no near field; see "Catalogue requirements".
- The rest of the model checks out. The elliptic‑integral AGM, the loop B_z/B_ρ formulas, A_φ and the mutual inductance (Jackson), the Ampère‑equivalent magnet, Faraday/Lenz signs, the compass field and c = 1/√(μ₀ε₀) all match. The tests check real properties: inverse square, superposition null, zero divergence, the long‑solenoid limit μ₀nI, the dipole far field, ∮emf dt ≈ 0, and the Maxwell curl relations.

## Narrative and scene mismatches
- **medium**, steps.ts:218: "close compasses swing round, far ones barely notice" doesn't match what the graphic shows. I recomputed the scene's grid at the default 5 A. The farthest compasses are 8–12 cm away, and 11 of those 27 still turn more than 15° (up to 35°, for example at 8.5 cm). Replace with: "close compasses swing right round, farther ones turn only partway towards the circle."
- **low**, steps.ts:232: the note quotes "B = μ₀ n I" for a long coil. The coil on the stage is short (6 cm long, 4 cm across), and its readout at 1 A is 3.3 mT against μ₀nI = 4.2 mT. Add: "The coil here is short, so the field in its middle is about a fifth below μ₀ n I."
- **low**, steps.ts:256: the body opens with "set A's current yourself", but the default drive is "Alternating". Replace with: "Choose “You set it” (or just move coil A's current slider): while you change it, B's meter kicks…"
- **low**, WaveScene.svelte:213: the label "no field here yet" sits next to a lone + charge. A lone charge has a Coulomb field everywhere; what hasn't arrived is the wave. Change it to `'no wave here yet'`.
- Everything else matches. The readouts reproduce the quoted numbers (8.99 µN at the default 10 cm; 50 µT at 2 cm; peak below 4 mV; 3.00 m, 12.2 cm, 555 nm; 299,792 km/s). The Lenz poles, the ⊙/⊗ markers and the field arrows are consistent with the model's sign conventions.

## Catalogue requirements
- **medium**, WaveScene.svelte:2–4 and steps.ts:268–272: the wave is drawn slowed down and stretched (one wavelength is always 260 px, one period 2.2 s), and the picture is the same for all three bands. Only the readouts and the spectrum marker change. The catalogue requires simplifications to be stated on the page, and nothing on the page says this. Add to the notes: "The animation is slowed down enormously and is not to scale: the real FM wave oscillates 100 million times a second, green light 540 million million times. The picture is the same for every band; only the wavelength and frequency shown change." A short caption on the stage would also work.
- **low**, steps.ts:172: `title: 'Electricity, magnetism and light'` differs from the catalogue Title "Electromagnetism". Use the catalogue title, or propose the change to the catalogue.
- Everything else in the entry is met. The interaction is built as written: place charges and see the field lines and the force on a test charge; move a magnet through a coil; vary the current in a neighbouring coil. The takeaway is visible in the graphics: field lines, compasses, the induced‑field ring, and a wave that keeps going after the shaking stops. There is no Pitfall or Needs field to check.

## Clarity
- **low**, steps.ts:218: "about 20 µT here": "here" is undefined for a reader who isn't in Europe. Replace with "about 20 µT in much of Europe".
- **low**, steps.ts:257: "…and why mains electricity alternates" skips the reason. Add: "(a transformer only works with a changing current, and stepping the voltage up is what makes sending power over long distances affordable)".
- **low**, steps.ts:269 and WaveScene.svelte:276: the story of "each field makes the other further out" seems to clash with "they rise and fall together". A curious reader would expect one to lag the other. Add to the notes: "It is the change of each field *across space* that goes with the change of the other *in time*, so the two can peak together. The step‑by‑step 'one makes the other' picture is a helpful way to think, not a strict chain of cause and effect: both fields come from the accelerating charge." Source: https://en.wikipedia.org/wiki/Jefimenko's_equations

## Sources consulted
- Maxwell, *A Dynamical Theory of the Electromagnetic Field*, Part VI (v = 310,740,000 m/s; Fizeau's value): https://en.wikisource.org/wiki/A_Dynamical_Theory_of_the_Electromagnetic_Field/Part_VI
- Microwave Journal, the acceptance of Maxwell's theory: https://www.microwavejournal.com/articles/6572-twenty-three-years-the-acceptance-of-maxwell-s-theory
- Ørsted, 1820: https://catalogue.museogalileo.it/multimedia/OerstedsExperimentBis.html
- Faraday's iron ring, 29 August 1831: https://www.edn.com/faraday-discovers-electromagnetic-induction-august-29-1831/
- CODATA 2022, μ₀: https://physics.nist.gov/constants and https://en.wikipedia.org/wiki/Vacuum_permeability
- Hertz's experiments, 1886–89: https://en.wikipedia.org/wiki/Heinrich_Hertz
- NOAA geomagnetism FAQ (field components and magnitudes): https://www.ncei.noaa.gov/products/geomagnetism-frequently-asked-questions. I did not find a single source quoting about 20 µT for Europe's horizontal component, so I left that figure unflagged. Typical published total field and dip angle values for Europe give 15–25 µT, so I'm fairly confident it is right.
- Jefimenko's equations: https://en.wikipedia.org/wiki/Jefimenko's_equations
- My own recalculation with a Python port of `em.ts`: coil centre field, peak emf and current, mutual inductance, and compass deflections at 5 A.
