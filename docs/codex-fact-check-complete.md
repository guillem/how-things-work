# Complete external factual audit — 2026-10-15

## Scope and method

This is a **standalone, unified adversarial content audit of all 100 built educational topics**, at the source snapshot identified below. It supersedes the current-findings lists in the two earlier audits; neither earlier report is required to understand or act on a finding here. It does not change the educational material.

Coverage is **100 topics and 1,084 narrative steps**: 46 original topics/415 steps, the next 44 topics/548 current steps, and 10 final topics/121 steps. Counts come from actual step-body declarations and the built-topic registry, not incidental occurrences of the word “body” in prose. Topic order follows the registry.

The final 10 topics were reviewed from scratch: GPS, heat engines, solar cells, consensus/blockchains, feedback control, power grid, flight, nuclear fusion, nuclear fission and CRISPR. The previous 53 numbered items were individually reconciled with current source. Git comparisons show every original 46-topic route directory unchanged since `7a8967919f995f923ab98ee49e5bd8ff63f93399`. Of the next 44, 21 had substantive revisions since `c1ec73a830af7116210fcf6bdd250014dbc63722`; their current narratives and relevant model changes were rechecked. During final verification, concurrent attribution-only notes and data headers were also inspected in carbon cycle, deep time, redox batteries, plate tectonics, reaction rates/equilibrium, stars, nuclear fusion and nuclear fission; these did not alter any finding. Unchanged content retains the earlier substantive review, verified by comparison, rather than being falsely described as a new line-by-line review of every old file.

Inspection covers prose, notes, control assumptions, numerical models and selected scene calculations. Authoritative standards, agency documentation and primary research support disputed claims. External sources were consulted in the earlier audits and selectively refreshed on **2026-10-15**, particularly for current numbers, newly added material, clinical statements and resolution counterexamples. Some publishers/agencies blocked full-text retrieval or served scans; an accessible abstract/official excerpt supports only its limited claim. The Held–Hou attribution remains explicitly unverified. Existing repository tests and internal reviews were not accepted as independent evidence.

**Only `docs/codex-fact-check-complete.md` is created by this audit.** The two historical reports are preserved. No implementation fixes, commits, deployments, training jobs or messages to the implementing agent were made. A concurrent documentation commit added `docs/DATA-SOURCES.md` during inspection; it did not alter any topic route. Concurrent working-tree edits subsequently added attribution/licence wording to topic notes, AME data headers and its generation script, and updated the provenance inventory; the paths are listed in the footprint. These changes were inspected without editing them. That provenance inventory is context, not independent evidence of scientific correctness or a licence audit performed here.

This is not a full rendered-browser audit, exhaustive proof of every code path, clinical validation, or independent recovery of every source dataset. A no-finding result means no material factual error found in the stated scope; it is not a certificate of error-free content. Numerical agreement establishes implementation consistency, not empirical truth.

Severity: **High** changes a central mechanism or teaches a materially wrong conclusion; **Medium** is a wrong condition, scope, interpretation or numerical classification; **Low** requests a narrower qualification, historical wording or contextual update. **Unverified** is a source question, not a confirmed error. A disclosed teaching approximation is not automatically an error. Only numbered bullets are formal active findings; other limitations are coverage notes.

## Results at a glance

There are **59 active confirmed findings: 2 High, 32 Medium and 25 Low**, plus **1 unverified attribution**. Five earlier findings are resolved and excluded from active totals. Of the 12 findings added in this final pass, 10 concern the final 10 topics and two concern revisions to previously reviewed topics (NEU-1, MV-1). CP-1 in carbon polymers is partly corrected and remains one active item, not two.

The highest priorities remain **HM-1/HM-2**, both reproduced in the current homeostasis code. The next pass should also address the cancer mechanisms (CAN-1/2/3), Raft/current-term commitment and proof-of-work tie assumptions (BC-1/2), and the reactor-control/coolant generalisations (NFI-1/2). Most other items can be corrected by scoping the prose rather than expanding a model.

The two earlier reports accidentally reused **CP-1** for unrelated topics. Here **COMP-1** means compression (the October 13 report’s CP-1); **CP-1** means carbon polymers (the October 15 report’s CP-1). Other legacy IDs are retained.

| # | Topic | Current active findings |
|---|---|---|
| 01 | [photosynthesis](#topic-photosynthesis) | PS-1, PS-2 |
| 02 | [epidemics](#topic-epidemics) | EP-1, EP-2 |
| 03 | [unit-circle](#topic-unit-circle) | No numbered finding |
| 04 | [sorting](#topic-sorting) | No numbered finding |
| 05 | [newtons-laws](#topic-newtons-laws) | No numbered finding |
| 06 | [sun-earth-moon](#topic-sun-earth-moon) | SEM-1 |
| 07 | [learning-from-data](#topic-learning-from-data) | No numbered finding |
| 08 | [pagerank](#topic-pagerank) | No numbered finding |
| 09 | [electric-circuits](#topic-electric-circuits) | No numbered finding |
| 10 | [bridges-structures](#topic-bridges-structures) | No numbered finding |
| 11 | [binary](#topic-binary) | No numbered finding |
| 12 | [atmosphere-weather](#topic-atmosphere-weather) | AW-1, AW-2 |
| 13 | [graph-search](#topic-graph-search) | No numbered finding |
| 14 | [chaos-fractals](#topic-chaos-fractals) | No numbered finding |
| 15 | [orbits-kepler](#topic-orbits-kepler) | No numbered finding |
| 16 | [ecosystems](#topic-ecosystems) | No numbered finding |
| 17 | [bayes-theorem](#topic-bayes-theorem) | No numbered finding |
| 18 | [oscillations-resonance](#topic-oscillations-resonance) | OR-1 |
| 19 | [logic-gates](#topic-logic-gates) | No numbered finding |
| 20 | [central-limit-theorem](#topic-central-limit-theorem) | CLT-1 |
| 21 | [atoms-periodic-table](#topic-atoms-periodic-table) | No numbered finding |
| 22 | [chemical-bonds](#topic-chemical-bonds) | CB-1 |
| 23 | [error-correction](#topic-error-correction) | No numbered finding |
| 24 | [entropy](#topic-entropy) | No numbered finding |
| 25 | [internet](#topic-internet) | NET-1 |
| 26 | [primes-modular-arithmetic](#topic-primes-modular-arithmetic) | PM-1, PM-2 |
| 27 | [complex-numbers](#topic-complex-numbers) | No numbered finding |
| 28 | [electromagnetism](#topic-electromagnetism) | EM-1 |
| 29 | [heart-circulation](#topic-heart-circulation) | HC-1 |
| 30 | [reinforcement-learning](#topic-reinforcement-learning) | No numbered finding |
| 31 | [ocean-currents](#topic-ocean-currents) | No numbered finding |
| 32 | [waves-interference](#topic-waves-interference) | No numbered finding |
| 33 | [radioactivity](#topic-radioactivity) | No numbered finding |
| 34 | [linear-transformations](#topic-linear-transformations) | LT-1 |
| 35 | [fourier-transform](#topic-fourier-transform) | FT-1 |
| 36 | [cpu](#topic-cpu) | CPU-1 |
| 37 | [cryptography](#topic-cryptography) | CR-1 |
| 38 | [special-relativity](#topic-special-relativity) | No numbered finding |
| 39 | [semiconductors](#topic-semiconductors) | SC-1 |
| 40 | [motors-generators](#topic-motors-generators) | MG-1 |
| 41 | [light-optics](#topic-light-optics) | No numbered finding |
| 42 | [compression](#topic-compression) | COMP-1 |
| 43 | [calculus](#topic-calculus) | No numbered finding |
| 44 | [states-of-matter](#topic-states-of-matter) | No numbered finding |
| 45 | [black-holes](#topic-black-holes) | No numbered finding |
| 46 | [homeostasis](#topic-homeostasis) | HM-1, HM-2, HM-3, HM-4, HM-5, HM-6, HM-7, HM-8 |
| 47 | [quantum-mechanics](#topic-quantum-mechanics) | No numbered finding |
| 48 | [acids-bases](#topic-acids-bases) | No numbered finding |
| 49 | [gradient-descent](#topic-gradient-descent) | GD-1 |
| 50 | [embeddings](#topic-embeddings) | No numbered finding |
| 51 | [carbon-cycle](#topic-carbon-cycle) | CC-1 |
| 52 | [rockets](#topic-rockets) | No numbered finding |
| 53 | [plate-tectonics](#topic-plate-tectonics) | PT-1 |
| 54 | [the-cell](#topic-the-cell) | CELL-1 |
| 55 | [neural-networks](#topic-neural-networks) | No numbered finding |
| 56 | [quantum-computing](#topic-quantum-computing) | No numbered finding |
| 57 | [reaction-rates-equilibrium](#topic-reaction-rates-equilibrium) | No numbered finding |
| 58 | [exoplanets](#topic-exoplanets) | EX-1 |
| 59 | [greenhouse-effect](#topic-greenhouse-effect) | GH-1 |
| 60 | [vision-color](#topic-vision-color) | No numbered finding |
| 61 | [earthquakes](#topic-earthquakes) | EQ-1 |
| 62 | [dna-to-protein](#topic-dna-to-protein) | No numbered finding |
| 63 | [meiosis-inheritance](#topic-meiosis-inheritance) | No numbered finding |
| 64 | [convolution-vision](#topic-convolution-vision) | CV-1 |
| 65 | [transformers](#topic-transformers) | No numbered finding |
| 66 | [respiration-atp](#topic-respiration-atp) | RA-1 |
| 67 | [standard-model](#topic-standard-model) | SM-1 |
| 68 | [deep-time](#topic-deep-time) | DT-1 |
| 69 | [redox-batteries](#topic-redox-batteries) | No numbered finding |
| 70 | [neurons](#topic-neurons) | NEU-1 |
| 71 | [immune-system](#topic-immune-system) | No numbered finding |
| 72 | [evolution](#topic-evolution) | No numbered finding |
| 73 | [language-models](#topic-language-models) | No numbered finding |
| 74 | [protein-folding](#topic-protein-folding) | No active finding; earlier item resolved |
| 75 | [carbon-polymers](#topic-carbon-polymers) | CP-1 |
| 76 | [tensors](#topic-tensors) | No numbered finding |
| 77 | [ice-ages](#topic-ice-ages) | No numbered finding |
| 78 | [big-bang](#topic-big-bang) | BB-1 |
| 79 | [transistors-chipmaking](#topic-transistors-chipmaking) | No active finding; earlier item resolved |
| 80 | [diffusion-models](#topic-diffusion-models) | No numbered finding |
| 81 | [mrna-vaccines](#topic-mrna-vaccines) | MV-1 |
| 82 | [stars](#topic-stars) | No active finding; earlier item resolved |
| 83 | [dark-matter](#topic-dark-matter) | DM-1 |
| 84 | [gpu](#topic-gpu) | No numbered finding |
| 85 | [medical-imaging](#topic-medical-imaging) | MI-1 |
| 86 | [gravitational-waves](#topic-gravitational-waves) | No active finding; earlier item resolved |
| 87 | [graphics-3d](#topic-graphics-3d) | No numbered finding |
| 88 | [cancer](#topic-cancer) | CAN-1, CAN-2, CAN-3 |
| 89 | [turing-machines](#topic-turing-machines) | No active finding; earlier item resolved |
| 90 | [wireless-signals](#topic-wireless-signals) | No numbered finding |
| 91 | [gps](#topic-gps) | GPS-1 |
| 92 | [heat-engines](#topic-heat-engines) | No numbered finding |
| 93 | [solar-cells](#topic-solar-cells) | No numbered finding |
| 94 | [consensus-blockchains](#topic-consensus-blockchains) | BC-1, BC-2 |
| 95 | [feedback-control](#topic-feedback-control) | FC-1 |
| 96 | [power-grid](#topic-power-grid) | PG-1, PG-2 |
| 97 | [flight](#topic-flight) | No numbered finding |
| 98 | [nuclear-fusion](#topic-nuclear-fusion) | FUS-1 |
| 99 | [nuclear-fission](#topic-nuclear-fission) | NFI-1, NFI-2, NFI-3 |
| 100 | [crispr](#topic-crispr) | No numbered finding |

## Reconciliation of the two earlier reports

Every earlier numbered item appears once below. “Open” retains the finding after checking current source; it does not mean that every model or source was rerun/retrieved in full. “Resolved” is the finding’s current status, not a claim about which agent made the correction. The current descriptions and sources follow in the topic sections.

| Earlier report | Topic | ID | Current disposition |
|---|---|---|---|
| 2026-10-13 | photosynthesis | PS-1 | Open; claim/model issue remains |
| 2026-10-13 | photosynthesis | PS-2 | Open; claim/model issue remains |
| 2026-10-13 | epidemics | EP-1 | Open; claim/model issue remains |
| 2026-10-13 | epidemics | EP-2 | Open; claim/model issue remains |
| 2026-10-13 | sun-earth-moon | SEM-1 | Open; claim/model issue remains |
| 2026-10-13 | atmosphere-weather | AW-1 | Open; claim/model issue remains |
| 2026-10-13 | atmosphere-weather | AW-2 | Unverified; no confirmed factual error asserted |
| 2026-10-13 | oscillations-resonance | OR-1 | Open; claim/model issue remains |
| 2026-10-13 | central-limit-theorem | CLT-1 | Open; claim/model issue remains |
| 2026-10-13 | chemical-bonds | CB-1 | Open; claim/model issue remains |
| 2026-10-13 | internet | NET-1 | Open; claim/model issue remains |
| 2026-10-13 | primes-modular-arithmetic | PM-1 | Open; claim/model issue remains |
| 2026-10-13 | primes-modular-arithmetic | PM-2 | Open; claim/model issue remains |
| 2026-10-13 | electromagnetism | EM-1 | Open; claim/model issue remains |
| 2026-10-13 | heart-circulation | HC-1 | Open; claim/model issue remains |
| 2026-10-13 | linear-transformations | LT-1 | Open; claim/model issue remains |
| 2026-10-13 | fourier-transform | FT-1 | Open; claim/model issue remains |
| 2026-10-13 | cpu | CPU-1 | Open; claim/model issue remains |
| 2026-10-13 | cryptography | CR-1 | Open; claim/model issue remains |
| 2026-10-13 | semiconductors | SC-1 | Open; claim/model issue remains |
| 2026-10-13 | motors-generators | MG-1 | Open; claim/model issue remains |
| 2026-10-13 | compression | COMP-1 | Open; claim/model issue remains |
| 2026-10-13 | homeostasis | HM-1 | Open; claim/model issue remains |
| 2026-10-13 | homeostasis | HM-2 | Open; claim/model issue remains |
| 2026-10-13 | homeostasis | HM-3 | Open; claim/model issue remains |
| 2026-10-13 | homeostasis | HM-4 | Open; claim/model issue remains |
| 2026-10-13 | homeostasis | HM-5 | Open; claim/model issue remains |
| 2026-10-13 | homeostasis | HM-6 | Open; claim/model issue remains |
| 2026-10-13 | homeostasis | HM-7 | Open; claim/model issue remains |
| 2026-10-13 | homeostasis | HM-8 | Open; claim/model issue remains |
| 2026-10-15 | gradient-descent | GD-1 | Open; claim/model issue remains |
| 2026-10-15 | carbon-cycle | CC-1 | Open; claim/model issue remains |
| 2026-10-15 | plate-tectonics | PT-1 | Open; claim/model issue remains |
| 2026-10-15 | the-cell | CELL-1 | Open; claim/model issue remains |
| 2026-10-15 | exoplanets | EX-1 | Open; claim/model issue remains |
| 2026-10-15 | greenhouse-effect | GH-1 | Open; claim/model issue remains |
| 2026-10-15 | earthquakes | EQ-1 | Open; claim/model issue remains |
| 2026-10-15 | convolution-vision | CV-1 | Open; claim/model issue remains |
| 2026-10-15 | respiration-atp | RA-1 | Open; claim/model issue remains |
| 2026-10-15 | standard-model | SM-1 | Open; claim/model issue remains |
| 2026-10-15 | deep-time | DT-1 | Open; claim/model issue remains |
| 2026-10-15 | protein-folding | PF-1 | Resolved; excluded from active totals |
| 2026-10-15 | carbon-polymers | CP-1 | Partly corrected: DNA fixed, protein mechanism still open |
| 2026-10-15 | big-bang | BB-1 | Open; claim/model issue remains |
| 2026-10-15 | transistors-chipmaking | TC-1 | Resolved; excluded from active totals |
| 2026-10-15 | stars | ST-1 | Resolved; excluded from active totals |
| 2026-10-15 | dark-matter | DM-1 | Open; claim/model issue remains |
| 2026-10-15 | medical-imaging | MI-1 | Open; claim/model issue remains |
| 2026-10-15 | gravitational-waves | GW-1 | Resolved; excluded from active totals |
| 2026-10-15 | cancer | CAN-1 | Open; claim/model issue remains |
| 2026-10-15 | cancer | CAN-2 | Open; claim/model issue remains |
| 2026-10-15 | cancer | CAN-3 | Open; claim/model issue remains |
| 2026-10-15 | turing-machines | TM-1 | Resolved; excluded from active totals |

Resolved-item evidence: PF-1 → `src/routes/protein-folding/steps.ts:241,242`; TC-1 → `src/routes/transistors-chipmaking/steps.ts:66`; ST-1 → `src/routes/stars/steps.ts:227`; GW-1 → `src/routes/gravitational-waves/steps.ts:255`; TM-1 → `src/routes/turing-machines/steps.ts:254`. Their scope and counterexample sources are retained in their topic sections. No earlier confirmed finding was silently dropped.

## Topic-by-topic audit

<a id="topic-photosynthesis"></a>

### 01. photosynthesis — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 17 steps and the PROSPECT/FvCB rate implementation. Calvin-cycle carbon bookkeeping (3 CO₂ → one net G3P, 9 ATP and 6 NADPH), water-derived oxygen, and the eight-photon minimum are internally consistent. The rate model explicitly discloses fixed internal CO₂, equal photon weighting and an O₂/CO₂ quotient of one; those are teaching approximations, not independent measurements.

- **PS-1 · Medium · `src/routes/photosynthesis/steps.ts:299`.** “First released in bulk by cyanobacteria some 2.4 billion years ago” conflates atmospheric accumulation at the Great Oxidation Event with the beginning of substantial biological oxygen production. Evidence places oxygenic photosynthesis before that event. Say atmospheric oxygen began accumulating persistently around 2.4 billion years ago; do not date the invention of oxygen production to that event. Sources: [Planavsky et al., evidence for oxygenic photosynthesis before the GOE](https://www.nature.com/articles/ngeo2122), [Kadoya et al., oxygen sources and sinks before the GOE](https://www.nature.com/articles/s41467-020-16493-1).
- **PS-2 · Low · `src/routes/photosynthesis/steps.ts:272`.** The undated present-day reference to about 420 ppm is stale. NOAA’s latest accessible global monthly value is **426.10 ppm for July 2026**, updated October 9; it is preliminary, and is not an annual average or a Mauna Loa value. Date the contextual figure or label 420 ppm as the model’s reference condition. Source: [NOAA globally averaged CO₂](https://gml.noaa.gov/ccgg/trends/global.html).

<a id="topic-epidemics"></a>

### 02. epidemics — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 12 steps and `model.ts`. SIR equations, β = R₀/D, early growth r = (R₀−1)/D, deterministic peak S/N = 1/R₀, and the ideal immune threshold are consistent with the stated well-mixed/perfect-immunity model. Vaccination perfection and contact geometry are explicitly disclosed. Sources: [Kermack and McKendrick (1927)](https://royalsocietypublishing.org/doi/10.1098/rspa.1927.0118), [WHO herd immunity](https://www.who.int/news-room/questions-and-answers/item/herd-immunity-lockdowns-and-covid-19).

- **EP-1 · Low · `src/routes/epidemics/steps.ts:203,207`.** Extinction probability “1 in R₀” needs the condition R₀ > 1 and an early, effectively unlimited susceptible population. For R₀ ≤ 1 eventual extinction is one, not 1/R₀ > 1. This follows from the branching-process fixed point: for geometric offspring, q = 1/(1+R₀−R₀q), whose admissible extinction solution is min(1,1/R₀). The finite crowd/deferred infection timestep is an approximation to that process; avoid calling its probability exact.
- **EP-2 · Low · `src/routes/epidemics/steps.ts:194`.** The displayed final-size equation assumes negligible initial infection and no initial immunity. With finite initial susceptible fraction s₀ and recovered fraction r₀, the exact SIR invariant gives log(s∞/s₀) = −R₀(1−r₀−s∞). Label the simplified equation as the large-population, tiny-seed result, consistent with the comment already in `model.ts`.

<a id="topic-unit-circle"></a>

### 03. unit-circle — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all nine steps, `trig.ts`, exact-angle representations and degree/radian conversions. Coordinate definitions, signs, phase shift, periodicity and A sin(2πft) are consistent. Pendulum sinusoidality is correctly limited to small swings. “Anything … back and forth smoothly” is broader than sinusoidal motion: smooth motion need not be simple harmonic; use “simple harmonic motion” if tightening prose. Source: [NIST DLMF definitions and periodicity](https://dlmf.nist.gov/4.14).

<a id="topic-sorting"></a>

### 04. sorting — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all ten steps and the comparison-cost narrative. Bubble/insertion worst cases, early exit, merge sort's n log n bound and last-pivot quicksort's sorted-input quadratic behavior are correctly distinguished. The numerical quicksort/mergesort comparison is an example at n=1,000, not a universal constant ratio; asymptotically ordinary quicksort uses about 2n ln n comparisons. The animated race explicitly counts a whole merge block move as a tick, so its finishing order is an illustrative operation convention, not a hardware benchmark. Sources: [Princeton quicksort analysis](https://algs4.cs.princeton.edu/23quicksort/index.php), [Princeton algorithm comparison table](https://algs4.cs.princeton.edu/cheatsheet/).

<a id="topic-newtons-laws"></a>

### 05. newtons-laws — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all ten steps and the force, projectile, collision and track model assumptions. Net-force qualification, equal/opposite interaction forces, equal-height 45° range optimum, momentum conservation in the absence of external impulse, and conversion of lost kinetic energy to other forms are correctly explained. The track's omitted wheel rotation and simplified normal-force/friction law are disclosed; do not treat it as a quantitative roller-coaster solver. Source: [OpenStax conservation of linear momentum](https://openstax.org/books/university-physics-volume-1/pages/9-3-conservation-of-linear-momentum).

<a id="topic-sun-earth-moon"></a>

### 06. sun-earth-moon — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all ten steps and season/Moon/tide claims. Axial tilt, perihelion in January, synodic versus sidereal month, eclipse-node requirement and spring/neap alignment are sound. Equilibrium tides and fixed nodes are explicitly disclosed. Sources: [NASA seasons](https://spaceplace.nasa.gov/seasons/en/), [NASA orbital climate cycles](https://science.nasa.gov/science-research/earth-science/climate-science/milankovitch-orbital-cycles-and-their-role-in-earths-climate/).

- **SEM-1 · Low · `src/routes/sun-earth-moon/steps.ts:154`.** “With no tilt at all there would be no seasons” is accurate for the tilt-driven, constant-distance demonstration, but Earth's retained eccentricity still causes annual solar-flux variation (~7% perihelion-to-aphelion). Say there would be no tilt-driven seasons and day length would be constant, rather than eliminating all annual insolation variation. This is a scope correction, not a rejection of the main explanation.

<a id="topic-learning-from-data"></a>

### 07. learning-from-data — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eight steps and the polynomial-fit/error explanation. Nested least-squares models justify nonincreasing optimum training error; squared noise is the expected irreducible MSE for the stated independent-noise model, not a bound on every small test sample. Crucially, the notes already distinguish model-selection validation data from a final untouched test set. The U-shaped error story is presented with a caveat for large models. Source: [Authors' official Introduction to Statistical Learning textbook](https://www.statlearning.com/).

<a id="topic-pagerank"></a>

### 08. pagerank — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all ten steps and `pagerank.ts`. Normalized transition update, dangling-node redistribution, damping/random jumps and long-run visit interpretation agree. The model explicitly distinguishes the original report's conventions. At d=1 unique convergence is not guaranteed; the code comments acknowledge traps/nonuniqueness and use a lazy update, while the text teaches the trapped-surfer case. Source: [Brin and Page's original Google paper](http://infolab.stanford.edu/~backrub/google.html).

<a id="topic-electric-circuits"></a>

### 09. electric-circuits — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all nine steps, fixed-resistance assumptions and circuit/drift descriptions. I = V/R, series/parallel current and voltage, conventional current opposite electron drift, and I/(neA) drift speed are correct: 0.5 A in 1 mm² copper gives about 0.037 mm/s. Near-instant switching is explicitly connected to propagation near light speed rather than fast electrons. Real bulb resistance/brightness are distinguished from the illustrative linear resistor. “Twice as fast” battery depletion assumes the ideal source/capacity convention and should not be used as a measured battery-life prediction. Source: [OpenStax Kirchhoff's rules](https://openstax.org/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules).

<a id="topic-bridges-structures"></a>

### 10. bridges-structures — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eight steps and the structural model's elements, material constants and stated constraints. Euler inverse-square slender-column scaling, truss axial action, arch thrust and tension-only cable behavior are sound. Capacity and “five times better” claims describe the selected 40 m/25 tonne presets, not a general ranking of bridge technologies; notes already explain why real bridges use different cross-sections and safety factors. The opening statement that every part works in just tension/compression is a pedagogical simplification; bending and its tensile/compressive stress distribution are subsequently taught. The report does not independently certify the stress solver or quoted utilization ratios. Source: [FHWA/AISC refined bridge-analysis manual, buckling and imperfections](https://www.aisc.org/media/dl2pzaro/hif18046.pdf).

<a id="topic-binary"></a>

### 11. binary — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all nine steps and numeric/encoding conventions in `binary.ts`. Byte cardinality, two's-complement weights and wraparound, ASCII examples, Latin-1 disclaimer, normal binary32 field layout and 0.1 rounding are correct. The notes explicitly reserve special exponents, so the implicit leading-one description must be read as applying to normalized finite numbers. One Unicode user-perceived character may contain multiple code points; “two to four bytes” applies to one non-ASCII scalar value, not every visual character. Sources: [Unicode encoding FAQ](https://www.unicode.org/faq/utf_bom.html), [Intel subnormal numbers](https://www.intel.com/content/www/us/en/docs/fortran-compiler/developer-guide-reference/2023-0/subnormal-numbers.html).

<a id="topic-atmosphere-weather"></a>

### 12. atmosphere-weather — Corrections requested; source verification also requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all nine steps and the energy-balance, cell-width and Coriolis formulas. f = 2Ω sinφ, inertial period 2π/|f|, geostrophic circulation directions and the distinction between ideal mean cells and transient eddies are consistent. The middle/high-latitude cell-count rule is a sketch, not a Held–Hou prediction; the code says so.

- **AW-1 · Medium · `src/routes/atmosphere-weather/steps.ts:221`.** “It only works over a sea warmer than about 26.5 °C” states a strict real-world requirement. Hurricane Epsilon is a counterexample: it sustained hurricane intensity over cooler water. Notes disclose the model's sharp switch, but do not correct the absolute real-world sentence. Use “typically needs warm water, often quoted around 26.5 °C; atmospheric conditions matter and exceptions occur.” Source: [NHC Epsilon tropical-cyclone report](https://www.nhc.noaa.gov/data/tcr/AL302005_Epsilon.pdf), [NHC contemporaneous discussion](https://www.nhc.noaa.gov/archive/2005/dis/al292005.discus.018.shtml).
- **AW-2 · Unverified · `src/routes/atmosphere-weather/steps.ts:169`; `src/routes/atmosphere-weather/atmosphere.ts:155`.** Both specifically attribute a 10 km layer height to Held and Hou's original paper. The 15 km choice here is clearly disclosed, and the square-root formula does give about 29° at 10 km, but that does not prove the historical parameter attribution. Supply the original paper/table/page or remove “the paper used 10 km.” The [original Held–Hou paper](https://atmos.washington.edu/~dargan/591/papers/helhou80.pdf) was located as a scanned PDF, but this audit did not extract a legible passage confirming that parameter attribution; it is not labelled a confirmed error.

<a id="topic-graph-search"></a>

### 13. graph-search — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eight steps, grid cost/neighbor convention and heuristic assumptions. BFS is correctly restricted to minimum steps; Dijkstra requires nonnegative costs; Manhattan distance times minimum edge cost is admissible and consistent for this four-neighbor map. Importantly, the notes already state the consistency condition for the never-reopen graph-search implementation. Weighted A* is correctly presented as potentially suboptimal. Source: [Hart, Nilsson and Raphael, original A* paper](https://ai.stanford.edu/~nilsson/OnlinePubs-Nils/PublishedPapers/astar.pdf).

<a id="topic-chaos-fractals"></a>

### 14. chaos-fractals — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all six steps and `chaos.ts` double-pendulum, logistic and escape-rule code. The pendulum uses RK4 steps no larger than 1 ms and an independent energy expression; targeted 60 s probes at 10°, 120° and 170° keep relative energy drift below one part per million. That verifies those runs, not indefinitely accurate chaotic trajectories. Logistic bifurcation values and the radius-two Mandelbrot escape criterion are consistent. A finite iteration cap cannot declare mathematical membership; the black rendering should be understood as “not escaped within the budget,” as the notes partly explain. Source: [May's original logistic-map study](https://doi.org/10.1038/261459a0); equations/thresholds were also checked directly by mathematical reasoning.

<a id="topic-orbits-kepler"></a>

### 15. orbits-kepler — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all six steps and `orbits.ts` two-body/heliocentric many-body equations. Circular/escape speeds, energy-based conics, equal-area angular-momentum argument and the mass correction to Kepler's third law are sound. The many-body code includes stellar reflex acceleration through indirect terms; a heliocentric picture does not itself imply a physically pinned Sun. AU/year normalization is a model convention, not an exact statement about modern SI-defined AU and real Earth's year. Sources: [NASA Kepler's laws](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/), [NASA two-body mass-sum derivation](https://imagine.gsfc.nasa.gov/features/yba/CygX1_mass/binary/equation_derive.html).

<a id="topic-ecosystems"></a>

### 16. ecosystems — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all five steps and logistic/Lotka–Volterra formulas in `eco.ts`. Equilibria prey = d/(cb), predator = a/b justify the stated hunting/birth-rate effects. The Yellowstone model correctly discloses invented numerical parameters, omitted predation links, real deer already present, and uncertainty over attribution of willow/beaver recovery. This avoids the common mistake of presenting a toy trophic cascade as settled Yellowstone causation. Source: [National Park Service account of the trophic-cascade debate](https://www.nps.gov/yell/learn/nature/cyclesprocesses.htm).

<a id="topic-bayes-theorem"></a>

### 17. bayes-theorem — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all five steps and `bayes.ts`. The rounded grid is consistent (9 true positives, 89 false positives); the exact posterior is 9.174%, versus rounded-grid 9/98 = 9.184%. At 30% prevalence the posterior is about 81.1%; at 1% prevalence with 99% sensitivity/specificity it is 50%; two positive 90%/91% tests give about 50.25% if their outcomes are conditionally independent given disease status. Use that precise conditional-independence wording when refining the second-test explanation; repeated or correlated tests do not justify the same update. The page already warns that independence is an idealization. Evidence: direct substitution into the displayed Bayes formula and independent arithmetic; no actual clinical test is represented. Reference: [Gigerenzer and Hoffrage, natural-frequency reasoning research](https://pure.mpg.de/pubman/item/item_2543495_5/component/file_2562163/GG_How_1995.pdf).

<a id="topic-oscillations-resonance"></a>

### 18. oscillations-resonance — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all five steps and `oscillator.ts`. Spring frequency, damping ratio, large-angle pendulum slowing and the forced-amplitude equation are correct; the implementation already knows the displaced resonance frequency.

- **OR-1 · Medium · `src/routes/oscillations-resonance/steps.ts:145`.** “A sharp peak at the natural frequency” is not exact for the displayed displacement-amplitude response with nonzero damping. The code correctly uses f_peak = f₀√(1−2ζ²); for ζ ≥ 1/√2 there is no positive-frequency amplitude peak. The allowed damping includes that regime: m=1, k=39, c=15 gives ζ≈1.20 and f_peak=0. Say the peak is near f₀ for light damping, shifts down as damping increases, and disappears for strong damping. This is more than terminology: the paragraph promises a peak that permitted controls remove. Evidence: differentiate the page's own amplitude formula; see `oscillator.ts` function `peakFrequency`. Reference: [MIT practical-resonance notes](https://math.mit.edu/~jorloff/suppnotes/suppnotes03/1803SupplementaryNotes_full.pdf).

<a id="topic-logic-gates"></a>

### 19. logic-gates — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all five steps and truth-table/adder claims. AND/OR/NOT/XOR, half/full adder decomposition, carry propagation, NAND universality and the distinction between combinational circuits and memory feedback are sound. “A real gate switches in around ten trillionths of a second” is a process/load-dependent illustration, not a universal specification; add “a fast on-chip gate may have…” if retaining a numerical delay. This audit does not establish that particular 10 ps value for a named device. Evidence: direct Boolean enumeration of sum = A⊕B⊕Cin and carry = AB + Cin(A⊕B); [MIT digital logic and NAND universality](https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/pages/c4/c4s1/).

<a id="topic-central-limit-theorem"></a>

### 20. central-limit-theorem — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all four steps and binomial/distribution primitives in `clt.ts`. C(12,6)=924, 2¹²=4096, and standard error σ/√n are correct. Notes already disclose independent draws, finite variance and slow convergence for skewed distributions. Source: [NIST central limit theorem](https://csrc.nist.gov/glossary/term/Central_Limit_Theorem).

- **CLT-1 · Low · `src/routes/central-limit-theorem/steps.ts:115,127`.** “Whatever you started from” also permits the user to draw a single nonzero bar. Then variance is zero and every sample mean is identical; no bell curve emerges. Qualify as “a non-degenerate distribution with finite variance,” or explain the single-bar exception. This is directly implied by the discrete sampler and the variance formula, not an empirical counterclaim.

<a id="topic-atoms-periodic-table"></a>

### 21. atoms-periodic-table — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all six steps and `atom.ts` shell/orbital/data conventions. Atomic number, ionic charge, orbital capacities, Hund filling and Madelung exceptions are correctly distinguished. Hydrogen probability-density formulas have the appropriate radial polynomials and angular factors; the display explicitly limits their exactness to hydrogen. Periodic radius/electronegativity trends are broad trends rather than strict monotone laws; exception-aware wording would improve the property step. The broad “chemistry is set by outermost electrons” is most appropriate for the illustrated main-group families; transition-metal d electrons also matter. Reference: [NIST atomic spectra database](https://physics.nist.gov/PhysRefData/ASD/ionEnergy.html); this report does not independently re-source every entry in the bundled element dataset.

<a id="topic-chemical-bonds"></a>

### 22. chemical-bonds — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eleven steps and shape/charge-map conventions. Ionic-crystal stabilization, double/triple bond counting, VSEPR versus measured angles and symmetry cancellation of dipoles are sound. The electronegativity thresholds are explicitly described as rough guides, and colors are disclosed as heuristic rather than ab initio charge densities. Source: [OpenStax molecular structure and polarity](https://openstax.org/books/chemistry-2e/pages/7-6-molecular-structure-and-polarity).

- **CB-1 · Medium · `src/routes/chemical-bonds/steps.ts:27`.** “Pairs that never bond are called lone pairs” makes their status permanent. A lone pair is a pair not participating in bonding in the current structure; it can be donated to form a coordinate bond. Change “never bond” to “are not shared in a bond in this molecule.” The related claim that bond count simply equals electrons short of an octet should be limited to the builder's neutral, closed-shell examples, not chemistry generally. Source: [IUPAC Gold Book, lone electron pair](https://www.old.goldbook.iupac.org/html/L/L03618.html).
The ammonia source note reasonably refers to the missing tabulated normal boiling point, rather than the absence of an ammonia entry; its wording is not classified as a factual error. [NIST ammonia data](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7664417&Mask=4) provide vapor-pressure coefficients but no explicit normal-boiling-point row.

<a id="topic-error-correction"></a>

### 23. error-correction — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eight steps, parity/syndrome construction and channel probabilities. Hamming (7,4) corrects one bit; double flips fool its ordinary single-error decoder; overall parity distinguishes the one-/two-error cases in SECDED. Uncoded success (1−p)⁸ and coded success [(1−p)⁷+7p(1−p)⁶]² give ~66.3% versus ~91.3% at p=5%, and ~92.3% versus ~99.59% at p=1%. The equal-bit-error-rate comparison is explicitly separated from a fixed-power radio link. “ECC does exactly this” should be read as the common 72/64 SECDED arrangement, not every modern ECC implementation. Source: [Hamming's original error-detecting and correcting codes paper](https://doi.org/10.1002/j.1538-7305.1950.tb00463.x); probabilities and syndrome logic checked directly.

<a id="topic-entropy"></a>

### 24. entropy — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all seven steps and the gas integrator/counting assumptions. Equal populations give mean thermal energy near 2.5; soft-disc potential energy accounts for the disclosed kinetic-temperature offset. C(40,20)=137,846,528,820 and log₁₀(2^(2.5×10²²))≈7.53×10²¹ are correct. S=k_B lnΩ, rare downward fluctuations and deliberately reversed entropy-decreasing trajectories are explained together, so the early “never flows the other way” is subsequently qualified rather than a claim of microscopic impossibility. The exact integer update is algebraically reversible. A left/right assignment is a coarse-grained state, not a complete continuous position-and-momentum microstate: “all left in one way” should explicitly mean one assignment of side labels. Reference: [Levesque–Verlet bit reversibility discussed in the JANUS integrator paper](https://academic.oup.com/mnras/article/473/3/3351/4243609).

<a id="topic-internet"></a>

### 25. internet — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all seven steps and `network.ts`'s routing/reliability assumptions. IPv4/IPv6 widths, IP versus TCP numbering, link-state versus BGP, rerouting, end-to-end acknowledgements and finite queues are correctly separated. The network uses selective-repeat behavior rather than implementing TCP; the code says so. The web-loading timeline is a simplified fresh TCP + TLS 1.3 handshake example, not the required cost of every HTTPS request.

- **NET-1 · Medium · `src/routes/internet/steps.ts:138`.** The claim that video-call applications “use UDP and skip the resending” confuses lack of built-in UDP retransmission with absence of application-level retransmission. RTP has a standardized retransmission format; applications can resend packets still useful before a deadline. Say UDP supplies no retransmission itself, and real-time applications may selectively recover losses or discard data that would arrive too late. Sources: [RFC 4588 RTP retransmission](https://www.rfc-editor.org/rfc/rfc4588.html), [RFC 768 UDP](https://www.rfc-editor.org/rfc/rfc768).

<a id="topic-primes-modular-arithmetic"></a>

### 26. primes-modular-arithmetic — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eight steps and the modular arithmetic narrative. Unique prime factorization, the sieve's p² start/√limit stop, coprime inverses, Fermat's little theorem, primitive roots and binary square-and-multiply counts are mathematically consistent.

- **PM-1 · Medium · `src/routes/primes-modular-arithmetic/steps.ts:227,230`.** A 600-digit prime alone does not make discrete logarithms astronomically hard. Security also depends on the base/subgroup order: g=1 yields no hard problem; a smooth-order subgroup admits Pohlig–Hellman decomposition. Qualify the security conclusion as using appropriately selected large prime-order subgroups and parameters, not merely a prime with enough digits. Source: [RFC 7919 safe-prime groups and subgroup checks](https://www.rfc-editor.org/rfc/rfc7919.html).
- **PM-2 · Low · `src/routes/primes-modular-arithmetic/steps.ts:179`.** “Computers do it on every addition” is too universal: fixed-width wrapping integer instructions do, whereas arbitrary-precision integers do not, and language overflow semantics differ. Change to “fixed-width unsigned integer arithmetic commonly wraps modulo 2^w.” This is a scope correction, not an error in the modular example. Source: [ECMAScript BigInt integer type](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types-bigint-type).

<a id="topic-complex-numbers"></a>

### 27. complex-numbers — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eight steps and `complex.ts`. Algebraic addition/multiplication, rotation/scaling, modulus/argument including undefined argument at zero, radian-based Euler identity, Taylor series and compound-limit construction are consistent. The displayed θ=π/n compounding examples agree with direct calculation. Source: [NIST DLMF trigonometric/exponential relations](https://dlmf.nist.gov/4.14); identities were independently checked algebraically.

<a id="topic-electromagnetism"></a>

### 28. electromagnetism — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all seven steps and numerical examples. Coulomb's 8.99 µN example, 50 µT wire field at 5 A/2 cm, Faraday/Lenz signs, c/f wavelength calculations and E/B phase relation agree. Crucially, the final notes already reject a literal delayed chain of E causing B causing E, describing their spatial/time relations instead.

- **EM-1 · Low · `src/routes/electromagnetism/steps.ts:229`.** “Their lines never end: they close on themselves” overstates ∇·B=0. Magnetic field lines have no monopole endpoints, but need not all be closed loops; a uniform ideal field has lines extending to infinity. Say “have no endpoints; in the coil and bar-magnet examples they form loops.” Reference: [OpenStax magnetic field lines](https://openstax.org/books/university-physics-volume-2/pages/11-2-magnetic-fields-and-lines).

<a id="topic-heart-circulation"></a>

### 29. heart-circulation — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all nine steps and the time-varying-elastance/valve model. Cardiac output = heart rate × forward stroke volume, 75×75 mL≈5.6 L/min, systemic/pulmonary pressure distinction and r⁻⁴ resistance scaling are correct. Reflex omissions, excessive instantaneous valve flow and fictional narrowing/leak response are disclosed. The returned waveform is a repeating steady-state beat, not the transient after changing a slider.

- **HC-1 · Medium · `src/routes/heart-circulation/steps.ts:79,165`.** “Must pump exactly the same amount” and “same volume per beat” need a steady-state/time-average qualification. The vascular compartments can temporarily store extra blood, and respiratory/transient changes allow unequal beat-by-beat output. Series connection requires matching long-run net forward flows to prevent continuing accumulation; it does not force equality on every beat. Say “in a steady state, their average net outputs match; this model shows one repeating beat.” Source: [Human respiratory stroke-volume measurements](https://pubmed.ncbi.nlm.nih.gov/3328782/), [study modeling distinct RV/LV respiratory fluctuations](https://pubmed.ncbi.nlm.nih.gov/7810715/).

<a id="topic-reinforcement-learning"></a>

### 30. reinforcement-learning — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all six steps and Q-learning world/update conventions. Terminal transitions remove bootstrapping; reward timing yields 10×0.9¹²≈2.824 at a 13-step distance. The deterministic-world Bellman equation and exploration explanation are correct. Notes correctly attach coverage and learning-rate conditions to the convergence theorem rather than claiming finite training is guaranteed optimal. The quoted 30-run exploration outcomes are project-specific measurements; this audit did not independently reproduce that experiment and does not certify their rates. Source: [Sutton and Barto textbook, Q-learning and cliff walking](https://www.andrew.cmu.edu/course/10-703/textbook/BartoSutton.pdf).

<a id="topic-ocean-currents"></a>

### 31. ocean-currents — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eight steps and `ocean.ts`'s model assumptions. Ekman direction/τ/(ρf), gyre circulation, westward intensification, density changes, salt-advection feedback and Bjerknes feedback are correctly described at this level. The notes explicitly disclose fictitious tipping thresholds, omitted Southern Ocean upwelling/winds and toy geography, rather than forecasting actual AMOC collapse at “1.6×.” The cited IPCC wording matches AR6: medium confidence against abrupt collapse before 2100 is not a guarantee. Distinguish Gulf Stream's wind-driven contribution from overturning, as the text already does. Sources: [NOAA AMOC science fact sheet](https://repository.library.noaa.gov/view/noaa/70414), [NOAA wind/mixing upwelling](https://oceanservice.noaa.gov/facts/conveyor.html), [IPCC AR6 chapter 9](https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-9/).

<a id="topic-waves-interference"></a>

### 32. waves-interference — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all ten steps and `waves.ts` core formulas. v=fλ, dry-air sound speed, linear superposition, path-difference interference, n v/(2L) harmonics, triangular-pluck coefficients and source Doppler shifts are consistent. At 30 m/s a 440 Hz source gives approximately 482 and 405 Hz on the approach/recession axes. The passing-source discussion correctly distinguishes emission position from reception time. Unequal source amplitudes are disclosed for destructive minima; “twice as much” at constructive bands should likewise be understood as the equal-amplitude approximation. Nondispersive ripple speed, no boundary reflections and capped near-source amplitude are disclosed. Source: [OpenStax wave interference and superposition](https://openstax.org/books/university-physics-volume-1/pages/16-5-interference-of-waves).

<a id="topic-radioactivity"></a>

### 33. radioactivity — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eleven steps and the isotope/lifetime conventions in `model.ts`. Exponential survival, binomial fluctuations, alpha/beta-minus/gamma Z/A changes and logarithmic dating arithmetic are sound. The important distinction between the evaluated physical half-life and the conventional 5,568-year radiocarbon-age definition is already present, along with calibration and tree-ring dating caveats. The selected [ENSDF carbon-14 decay record](https://www.nndc.bnl.gov/nudat3/getdecaydataset.jsp?dsid=14c+bM+decay&nucleus=14N) explicitly gives 5,700±30 years and a 156.475 keV endpoint, confirming those values. This audit did not independently extract every other isotope record. “Every atom has … neutrons” should exclude ordinary hydrogen, as the atom topic already does. “Outside the body [alpha particles] are harmless” would be more accurate as “generally cannot penetrate intact skin”; it should not imply every alpha-emitting material has no external hazard. Sources: [NNDC NuDat](https://www.nndc.bnl.gov/nudat3/), [NRC radiation basics](https://www.nrc.gov/facilities-safety/radiation-protection/radiation-and-its-health-effects/radiation-basics).

<a id="topic-linear-transformations"></a>

### 34. linear-transformations — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all thirteen steps and `matrix.ts` conventions. Columns as basis images, Mv, composition order, determinant/eigenvalue formulas and the worked λ=2.5/1 example are correct. The signed-determinant step correctly distinguishes ordinary area scale |det M| from orientation. Power iteration is contextualized by the illustrated diagonalizable matrix and a missing dominant component exception, not a proof for arbitrary matrices. Source: [MIT linear algebra materials](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/).

- **LT-1 · Low · `src/routes/linear-transformations/steps.ts:163`.** The geometric definition “straight lines stay straight” and “parallel … lines stay parallel” needs to allow collapsed lines/points: singular linear maps, explicitly permitted by later steps, do not preserve distinct straight lines. Prefer the exact additivity/homogeneity definition already in the same paragraph, then say lines remain lines or collapse to points.

<a id="topic-fourier-transform"></a>

### 35. fourier-transform — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all ten steps and DFT conventions in `fourier.ts`. Odd square-wave harmonics, 4/π scaling, Gibbs overshoot relative to jump size, DC exception to doubling, phase offset for sine coefficients, inverse reconstruction and signed frequencies for complex drawings are consistent. The amplitude bars alone are explicitly distinguished from the full complex transform.

- **FT-1 · Medium · `src/routes/fourier-transform/steps.ts:196`.** “Two signals with the same bars but different phases sound alike” is too general. Human listeners can detect relative-phase changes in harmonic complexes under documented conditions; phase changes also alter transient/envelope structure. Say phase often affects the appearance more than the perceived steady tone, but can affect sound and must be retained for reconstruction. Source: [Primary human phase-discrimination study](https://pubmed.ncbi.nlm.nih.gov/2808909/).

<a id="topic-cpu"></a>

### 36. cpu — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all ten steps and the toy ISA/assembler conventions in `cpu.ts`. Opcode decoding, PC increment, modulo-256 arithmetic, borrow-as-carry convention, loop sum 55 and overflow example 276→20 are consistent. The distinction between clock ticks and instructions, including superscalar throughput, is correctly explained. The historical i9-14900K 6 GHz/24-core illustration matches Intel's specifications. Source: [Intel launch/specification description](https://www.intel.com/content/www/us/en/newsroom/news/intel-core-14th-gen-desktop-processors.html).

- **CPU-1 · Medium · `src/routes/cpu/steps.ts:121`.** “A real 8-bit processor would make two trips to memory” to fetch a two-byte instruction is not generally true. An 8-bit ALU/register architecture can have a wider instruction fetch path: AVR uses 8-bit data registers but mostly 16-bit instruction words. Say “with an 8-bit-wide instruction-memory bus, fetching two bytes would require two transfers”; do not infer instruction-bus width from processor bitness. Sources: [Microchip AVR architecture](https://onlinedocs.microchip.com/oxy/GUID-78362176-487F-41B9-95C7-B478A9A186EB-en-US-2/GUID-58665E03-55DB-4291-ADAA-2E3A8C9CB261.html), [Microchip instruction timing](https://developerhelp.microchip.com/xwiki/bin/view/products/mcu-mpu/8-bit-avr/structure/instruction-timing/).

<a id="topic-cryptography"></a>

### 37. cryptography — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all fourteen steps and toy-key/SHA-256/paint conventions in `crypto.ts`. One-time-pad conditions, paint analogy's computational loophole, tiny DH insecurity, man-in-the-middle authentication need, RSA arithmetic and textbook-padding caveat are correctly disclosed. The small example computes A=59, B=79 and shared key 37. Hash preimage work is a generic full-entropy-target claim, not protection for predictable passwords; the password note correctly mentions salted slow hashing. Source: [NIST FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final).

- **CR-1 · Medium · `src/routes/cryptography/steps.ts:162,248`.** “Every time” an HTTPS/TLS 1.3 connection opens it runs Diffie–Hellman and uses a server signature is false for all modes. TLS 1.3 explicitly supports PSK-only key establishment; PSK/resumption handshakes also differ in authentication from the certificate-based full handshake. Describe a typical fresh certificate-authenticated (EC)DHE handshake and briefly acknowledge resumption/PSK variants. Source: [RFC 8446 §2 and §4.2.9, psk_ke versus psk_dhe_ke](https://www.rfc-editor.org/rfc/rfc8446.html).

<a id="topic-special-relativity"></a>

### 38. special-relativity — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all twelve steps and `relativity.ts` formulas. Velocity addition, γ, transverse light-clock derivation, simultaneous-endpoint length measurement, 400 ns lightning offset (using the proper 200 m train length), Lorentz axes and invariant interval are consistent. At 0.99c the mean muon range is ~4.6 km; it is correctly described as an average. The GPS note importantly qualifies the common “11 km position error” story by explaining the receiver clock-bias solution. Sources: [Ashby's GPS/relativity explanation](https://physicstoday.aip.org/features/relativity-and-the-global-positioning-system), [BIPM SI brochure, definition of c and metre](https://www.bipm.org/en/publications/si-brochure).

<a id="topic-semiconductors"></a>

### 39. semiconductors — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eleven steps and `model.ts` carrier/mobility/junction formulas. Tight-binding state count under its one-orbital assumption, silicon atomic density, shallow donor/acceptor energies, 0.84 V built-in potential and ~0.15 µm depletion width agree. Ideal-diode forward current at 0.7 V is approximately 0.58 mA with the chosen Is; Is is correctly disclosed as independent of the drawn doping. Source: [Ioffe silicon parameter archive](https://www.ioffe.ru/SVA/NSM/Semicond/Si/index.html).

- **SC-1 · Medium · `src/routes/semiconductors/steps.ts:158,162`; `src/routes/semiconductors/model.ts` function `carriers`.** “Electrons times holes stays fixed” with unchanged ni is extended through a control range up to 10¹⁹ cm⁻³ without a high-doping caveat. The code enforces n·p=ni² exactly and uses a fixed gap/intrinsic density. Heavy doping introduces degeneracy and band-gap narrowing; the lightly doped Boltzmann derivation is not an exact quantitative law across that full range. The ionization caveat in the note does not cover these different omissions. Keep the simple curve but label the high-doping minority-carrier estimates approximate and disclose the missing effects, or restrict that quantitative claim. Sources: [MIT mass-action derivation and assumptions](https://ocw.mit.edu/courses/3-23-electrical-optical-and-magnetic-properties-of-materials-fall-2007/resources/clean13/), [COMSOL semiconductor documentation, effective intrinsic density/band-gap narrowing](https://doc.comsol.com/6.3/doc/com.comsol.help.semicond/semicond_ug_semiconductor.6.58.html).

<a id="topic-motors-generators"></a>

### 40. motors-generators — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all nine steps and `machine.ts`, plus the motor scene's settings. N B I L, N B I A sinθ, Faraday/Lenz sign, split/slip ring behavior and NBAω peak generator voltage are consistent. The starting 3 V motor's quoted speed/current can be reproduced (~0.84 turns/s, ~0.32 A), and its fictional inertia/friction are disclosed. Source: [OpenStax generators and back emf](https://openstax.org/books/university-physics-volume-2/pages/13-6-electric-generators-and-back-emf).

- **MG-1 · Medium · `src/routes/motors-generators/steps.ts:176` (commutator notes).** Mean torque = (2/π)×peak is the constant-current geometric result, not generally the voltage-driven motor plotted on that step. This scene includes back emf, making current vary with angle/speed. A uniformly angle-sampled full turn after settling gives mean torque 0.07351 N·m and peak 0.10628, a ratio 0.69170 rather than 0.63662 (see numerical evidence appendix). Explicitly attach 2/π to fixed current and uniform angular sampling. Likewise, “never goes below zero” assumes current remains in the motoring direction: turning voltage down while retaining rotation can cause regenerative braking, including in this implementation.

<a id="topic-light-optics"></a>

### 41. light-optics — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all ten steps and `optics.ts` material/ray-tracing assumptions. Reflection/Snell angles, refractive-index speed and wavelength change, critical angles, Fresnel reflection, thin versus thick lens mismatch, prism dispersion and primary/secondary rainbow angles are consistent. The fibre is explicitly disclosed as a bare rod in air rather than a telecom core/cladding mode calculation. A 0.2 dB/km loss gives half-power after ~15 km. Exact total reflection and size-independent rainbow angles apply to the ideal ray-optics model; absorption, surface defects and wave/diffraction effects are not computed. Sources: [Corning SMF-28 Ultra specification](https://www.corning.com/content/dam/corning/media/worldwide/coc/documents/Fiber/product-information-sheets/PI-1424-AEN.pdf), [OpenStax refraction](https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction).

<a id="topic-compression"></a>

### 42. compression — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eleven steps and `compression.ts` entropy, Huffman, DCT and quantization conventions. Reproduced default 37-symbol/296-bit input, H≈3.0121 bits/symbol and 114 Huffman-coded bits. The H≤L<H+1 bound is correctly restricted to at least two symbols. Code-table overhead, context versus marginal entropy, nonstandard quality scale and coefficient-only JPEG size are disclosed. Source: [ITU-T T.81 baseline JPEG standard](https://www.itu.int/itu-t/recommendations/rec.aspx?id=2633&lang=en).

- **COMP-1 · Low · `src/routes/compression/steps.ts:139,143`.** “zip, gzip and PNG all end with a Huffman stage” needs “when using compressed DEFLATE blocks.” DEFLATE also allows stored/uncompressed blocks, and ZIP is a container with methods beyond DEFLATE. The intended common pipeline is fine; the universal format claim is not. Source: [RFC 1951 §3.2.3, BTYPE=00 stored blocks](https://www.rfc-editor.org/rfc/rfc1951.html).

<a id="topic-calculus"></a>

### 43. calculus — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all twelve steps and `calculus.ts`. Difference quotient→derivative, x²→2x, Riemann sums, signed areas and both directions of the fundamental theorem agree. The editable curve is a smooth cubic spline, so the theorem's continuity requirements hold for this page. Left sums for x² over [0,3] give 5.90625 at n=4 and 8.86545 at n=100; the exact integral is 9. Simpson numerical integration is a reference approximation, not exact integration of arbitrary functions. “A curved edge has [no formula]” is unnecessarily broad (circles and the later parabola do); “a general curved boundary needs a general method” would be better wording. Source: [OpenStax fundamental theorem of calculus](https://openstax.org/books/calculus-volume-1/pages/5-3-the-fundamental-theorem-of-calculus).

<a id="topic-states-of-matter"></a>

### 44. states-of-matter — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all twelve steps and `phase.ts`, plus the MD/mapping assumptions stated in the notes. Reproduced CO₂ melting −55.59 °C and boiling 14.83 °C at 50 atm; vapor pressures 34.39 atm at 0 °C and 56.54 atm at 20 °C. Water melting at 1,000 atm is −9.08 °C, boiling at 2 atm is 120.63 °C and at Everest's stated 33.7 kPa is 71.79 °C. The given ice/liquid densities imply ~9.1% expansion and ~91.7% submerged volume. The molecular box does not simulate real CO₂ at the displayed physical T/P: remapping and assisted water freezing are explicitly disclosed, including the cooling during pressure-induced condensation. These are substantial teaching interventions but not hidden factual errors. Sources: [IAPWS melting/sublimation release](https://iapws.org/technical-guidance/release/MeltSub), [Span and Wagner CO₂ reference equation](https://doi.org/10.1063/1.555991). Not an independent validation of the chaotic particle simulation.

<a id="topic-black-holes"></a>

### 45. black-holes — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all twelve steps and `blackhole.ts` units/geodesic equations and source conventions. Horizon r_s=2GM/c², photon sphere 1.5r_s, critical impact √27 GM/c²≈2.598r_s, ISCO 3r_s, static-clock factor √(1−r_s/r) and the weak-field deflection are consistent. The probe launch controls stay outside 4r_s; the stated sideways escape-speed comparison is understood within that domain, not a theorem for every launch direction near the horizon. The distinction between static-clock readings and a falling probe is explicit. EHT ring diameters agree with the source reports, and the text/code distinguish independent stellar mass estimates from masses fitted to the same image. The camera-at-30r_s lens map is acknowledged as approximate; this audit does not validate every strong-deflection pixel. Sources: [Research on Schwarzschild photon-sphere trajectories](https://www.nature.com/articles/s41598-021-93595-w), [EHT Sgr A* results](https://eventhorizontelescope.org/publications/first-sagittarius-event-horizon-telescope-results-i-shadow-supermassive-black-hole), [EHT M87 results](https://doi.org/10.3847/2041-8213/ab0ec7).

<a id="topic-homeostasis"></a>

### 46. homeostasis — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all eight steps, controls, `model.ts`, `scenario.ts` and all three scene implementations. Reproduced the advertised model outputs: meal peak 192.76 mg/dL at minute 41, two-hour glucose 120.43; 13.24 mg/dL fasted-run dip; zero-insulin meal peak 614.88 and six-hour value 450.58. These are code-consistency results, not evidence that an average real adult has those responses. The page discloses its calibrated insulin secretion, approximate glucagon strength, absent stress hormones and omitted delayed exercise effects.

- **HM-1 · High · `src/routes/homeostasis/model.ts:282`.** The code multiplies both hypoglycaemia and exercise-induced glucagon responses by insulin-production fraction. At production=0, glucagon remains exactly ×1 with and without exercise. Loss of glucagon response to hypoglycaemia is not loss of all α-cell responses: human research reports preserved exercise-induced release, subject to modulation by antecedent hypoglycaemia and other factors. Decouple those terms or prominently explain the artificial assumption and its consequences. Source: [Human exercise study (2009), stimulus-specific glucagon responses](https://pmc.ncbi.nlm.nih.gov/articles/PMC2731524/), particularly the paragraph beginning “In subjects with type 1 diabetes…”.
- **HM-2 · High · `src/routes/homeostasis/model.ts:313`; `src/routes/homeostasis/scenes/PlotScene.svelte:248`.** Displayed liver output depends only on glucagon, not plasma/action-compartment insulin. For production=0 with basal replacement, changing the rapid dose among 0, 8 and 16 units leaves liver output exactly 0.6 mg/dL/min throughout every run. Insulin only changes the displayed “into cells” flow. This misrepresents one of the central mechanisms taught by the loop: insulin suppresses endogenous glucose production as well as promoting uptake. A lumped glucose balance can be a legitimate teaching model, but its terms cannot then be presented as independently validated anatomical flows. Add hepatic suppression or relabel/explain the lumped term. Source: [Edgerton et al., direct hepatic insulin suppression of glucose production](https://pmc.ncbi.nlm.nih.gov/articles/PMC5358484/).
- **HM-3 · Medium · `src/routes/homeostasis/steps.ts:240`.** Insulin and glucose levels together do not by themselves “tell type 1 from type 2 diabetes.” Residual endogenous insulin in type 1 and advanced insulin deficiency in type 2 overlap. Replace the diagnostic claim with a mechanism comparison and mention clinical context, islet autoantibodies and appropriately interpreted C-peptide. Source: [ADA 2026 classification guidance, including overlapping C-peptide values and autoantibody testing](https://diabetesjournals.org/care/article/49/Supplement_1/S27/163926/2-Diagnosis-and-Classification-of-Diabetes).
- **HM-4 · Medium · `src/routes/homeostasis/scenes/PlotScene.svelte:167`.** The model baseline is exactly 100 mg/dL, but prediabetes labels begin at 100.5; 100 is labelled “edge of normal (under 100).” ADA's fasting impaired-glucose interval begins at 100. A historical model baseline is allowed, but the clinical threshold should not be moved to make it normal. Classify before display rounding and distinguish reference-model baseline from clinical interpretation. Source: [NIDDK diagnostic table](https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis).
- **HM-5 · Medium · `src/routes/homeostasis/steps.ts:166,192,195`.** Fasting ≥126 or two-hour OGTT ≥200 meets a diagnostic threshold, but generally requires confirmation without unequivocal hyperglycaemia. The prose presents an automatic diagnosis. Add the usual confirmation qualification, rather than changing the correct numerical cutoffs. Source: [NIDDK tests and diagnosis, “Usually … a second test to confirm”](https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis).
- **HM-6 · Low · `src/routes/homeostasis/scenes/LoopsScene.svelte:88`.** The described benign-growth/high-calcium disease is primary hyperparathyroidism, not every form of hyperparathyroidism. Rename the example; secondary disease can reflect an appropriate response to another disturbance. Source: [NIDDK primary hyperparathyroidism](https://www.niddk.nih.gov/health-information/endocrine-diseases/primary-hyperparathyroidism).
- **HM-7 · Low · `src/routes/homeostasis/steps.ts:131`.** The brain's “almost entirely on glucose” statement needs ordinary-diet conditions. During prolonged fasting, ketones can become its predominant fuel. This does not eliminate its remaining glucose requirement. Source: [Owen et al., human brain metabolism during fasting](https://www.jci.org/articles/view/105650).
- **HM-8 · Low · `src/routes/homeostasis/steps.ts:227`.** ADA level 1 is <70 **and ≥54** mg/dL; <54 is level 2, not also level 1. Specify the nonoverlapping intervals. Do not call a concentration cutoff the definition of level 3/severe hypoglycaemia, which is based on required assistance; the current visible label uses “level 2,” but the internal constant `severeHypo` invites confusion. Source: [ADA 2026 hypoglycaemia classification](https://diabetesjournals.org/care/article/49/Supplement_1/S132/163927/6-Glycemic-Goals-Hypoglycemia-and-Hyperglycemic).

<a id="topic-quantum-mechanics"></a>

### 47. quantum-mechanics — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 11 steps. Born probabilities, complex-amplitude addition, detector-state overlap, the Schrödinger equation, box energies and rectangular-barrier transmission are consistent with the stated nonrelativistic models. Direct probes reproduce the quoted box and tunnelling numbers. The notes distinguish wave-packet transmission from the plane-wave formula and disclose the paraxial and finite-grid approximations. “Nothing moves” in a stationary state is best read as a statement about the stationary probability density; stationary states can carry current. Likewise, the slit argument excludes an ordinary classical path mixture, not every possible interpretation with trajectories. These are editorial qualifications, not additional numbered findings. Source: [MIT quantum-physics notes, including probability current, stationary states and barriers](https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/pages/lecture-notes/).

<a id="topic-acids-bases"></a>

### 48. acids-bases — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 12 steps and the charge-balance/titration solver. Reproduced pH 2.88088 for 0.1 M acetic acid, pH approximately 4/7/10 at 24.95/25.00/25.05 mL for the strong-acid titration, and pH 8.72754 at acetic-acid equivalence. The temperature dependence of neutrality and the activity-versus-concentration distinction are explicitly addressed. Exactness here means the ideal equilibrium equations, not arbitrary concentrated real solutions. Source: [NIST pH metrology and its activity convention](https://www.nist.gov/programs-projects/ph-metrology).

<a id="topic-gradient-descent"></a>

### 49. gradient-descent — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 13 steps and the line-loss/gradient definitions. The quadratic stability examples, heavy-ball update and mini-batch interpretation are sound within their stated landscapes.

- **GD-1 · Low · `src/routes/gradient-descent/steps.ts:240`.** The parenthesis equating a convex loss with a single bowl overstates uniqueness. A convex loss has no suboptimal local minimum, but can have many minimizers: L(x,y) = x² is convex and every (0,y) minimizes it. The particular line-fit dataset has a unique solution, so retain that example and change the general statement to “every local minimum of a convex loss is global”; use strict convexity when claiming uniqueness. Source: [Boyd and Vandenberghe, Convex Optimization, §4.2.2](https://www.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf).

<a id="topic-embeddings"></a>

### 50. embeddings — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 11 steps and the normalization, cosine and vector-search code. The page correctly measures neighbours in 100 dimensions, warns about projection distortion and input-word exclusion, and demonstrates that averaging loses order. Stanford confirms the 6B-token/400K-word source and PDDL data licence; this should not be confused with the GloVe code's Apache licence. Stored-vector spot checks are reported below. The audit did not redownload the original 822 MB archive or regenerate t-SNE. Source: [Stanford's GloVe release, objective and licences](https://nlp.stanford.edu/projects/glove/).

<a id="topic-carbon-cycle"></a>

### 51. carbon-cycle — Corrections requested

**Current-state check:** The earlier substantive review is retained. The concurrent revision only adds source-attribution/licence wording; the educational claims and model are unchanged and the current finding status was checked.

Reviewed all 12 steps, stock/flux definitions and the historical-versus-forward-model distinction. The GCB 2025 source really does support a revised land sink near 2.4 GtC/year; comparing it with an older budget would produce a false finding. The historical residual is explicitly disclosed: prescribed atmospheric history plus imperfect independently estimated sinks is not a carbon-conserving reconstruction of all emissions. The future scenarios are illustrative and omit warming feedbacks. Sources: [Global Carbon Budget 2025](https://doi.org/10.5194/essd-18-3211-2026), [IPCC AR6 carbon-cycle assessment](https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-5/).

- **CC-1 · Medium · `src/routes/carbon-cycle/steps.ts:258`.** The final claim that only rock weathering returns carbon to the slow loop excludes burial of organic carbon in sediments. The earlier slow-loop section itself describes burial and fossil-fuel formation. IPCC identifies both organic-carbon burial and silicate weathering as long-term sinks. Say that geological processes, including weathering/carbonate burial and organic-carbon burial, eventually transfer carbon into long-lived sedimentary stores. This is a correction to the conclusion, not a demand to add those processes to the thousand-year model. Source: [IPCC AR6 WG1 Chapter 5, long-term carbon sources and sinks](https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter05.pdf).

<a id="topic-rockets"></a>

### 52. rockets — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 11 steps and selected rocket-equation, staging and orbital-transfer functions. The mass ratios, ideal Δv bookkeeping and two-impulse transfer interpretation are consistent. Atmosphere, constant drag, planar trajectories, steering choice and the Saturn V timing mismatch are disclosed. The single-stage impossibility statement belongs to the chosen 10% dry-mass/3 km/s design, not every imaginable kerosene vehicle; keep that context visible. “Exhaust speed” in the thrust and specific-impulse discussion should mean effective exhaust velocity when pressure thrust is included. Sources: [NASA rocket thrust equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/), [NASA specific impulse](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/).

<a id="topic-plate-tectonics"></a>

### 53. plate-tectonics — Corrections requested

**Current-state check:** The earlier substantive review is retained. The concurrent revision only adds source-attribution/licence wording; the educational claims and model are unchanged and the current finding status was checked.

Reviewed all 12 steps and the isostasy/section model assumptions. Decompression melting at ridges, slab dehydration and mantle-wedge melting, lithosphere versus asthenosphere, and the concentration of deep earthquakes at subduction zones are correctly distinguished.

- **PT-1 · Medium · `src/routes/plate-tectonics/steps.ts:212`.** The continent-collision explanation says neither plate goes down and later attributes the lack of a volcanic arc to no plate descending deeply. Buoyant continental crust resists ordinary oceanic-style subduction, but continental lithosphere can underthrust and descend beneath another continent. India underthrusting Eurasia is precisely the example used here; USGS identifies it as the source of Himalayan earthquakes. Describe crustal shortening, thickening and underthrusting, and distinguish the absence of a normal active oceanic subduction arc from an absence of downward plate motion. The existing note only describes the earlier oceanic slab and does not resolve this. Sources: [USGS Himalayan seismicity](https://www.usgs.gov/publications/seismicity-earth-1900-2010-himalaya-and-vicinity), [USGS continental-underthrusting summary](https://pubs.usgs.gov/of/2010/1099/of2010-1099.pdf).

<a id="topic-the-cell"></a>

### 54. the-cell — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 13 steps and selected size/provenance definitions. The stereology caveat for a central nuclear section, ideal molecular slices, species substitutions, and schematic organelle placement are unusually explicit. Nuclear pores, ribosomes, bilayers and rotary ATP synthase have the right orders of magnitude; atomic structures were not independently reprocessed.

- **CELL-1 · Low · `src/routes/the-cell/steps.ts:115`.** Defining a gene as a stretch coding for one protein excludes genes for functional RNAs and implies one gene gives only one protein. Say a gene contains instructions for a functional RNA and, for protein-coding genes, one or more related protein products. This aligns with the more careful wording in `dna-to-protein` (“many genes”). Sources: [NHGRI RNA fact sheet](https://www.genome.gov/about-genomics/educational-resources/fact-sheets/ribonucleic-acid-fact-sheet), [NHGRI alternative splicing](https://www.genome.gov/genetics-glossary/Alternative-Splicing).

<a id="topic-neural-networks"></a>

### 55. neural-networks — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 11 steps and forward/backward functions. Logistic output with binary cross-entropy gives δ = p − y; hidden errors and weight gradients correctly apply the chain rule. A central finite-difference probe over every weight of a small tanh network agrees to 6.7 × 10⁻¹². Activation-free layers compose to an affine map, and the claims about widths/epochs are examples for the chosen seeds, not universal training guarantees. Source: [Rumelhart, Hinton and Williams (1986)](https://doi.org/10.1038/323533a0).

<a id="topic-quantum-computing"></a>

### 56. quantum-computing — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 11 steps and selected state-vector/gate/Grover functions. Bloch-sphere half angles, unobservable global phase, entanglement and measurement limits are correctly explained. The CHSH example explicitly requires settings to vary on both sides. Reproduced S = 2.828427 and Grover's 78.125%/94.53125% successes for one/two rounds at N = 8. Those are simulator predictions, not measurements from quantum hardware. The state-vector exponential-memory example is qualified by alternatives for restricted circuits. Sources: [IBM CHSH tutorial](https://quantum.cloud.ibm.com/docs/en/tutorials/chsh-inequality), [IBM Grover derivation](https://quantum.cloud.ibm.com/learning/en/courses/fundamentals-of-quantum-algorithms/grover-algorithm/grover-algorithm-description).

<a id="topic-reaction-rates-equilibrium"></a>

### 57. reaction-rates-equilibrium — No active material finding

**Current-state check:** The earlier substantive review is retained. The concurrent revision only adds source-attribution/licence wording; the educational claims and model are unchanged and the current finding status was checked.

Reviewed all 13 steps and rate/equilibrium functions. The notes explicitly reject the historical direct H₂–I₂ collision as a literal mechanism and disclose the catalyst's unchanged-prefactor/rate-law assumption. Numerical reproduction gives kf = 0.0632293 L mol⁻¹ s⁻¹, K = 52.14875 and 78.3113% iodine in HI at 700 K; the catalyst leaves the forward/reverse ratio unchanged. Gold's modeled acceleration is a hypothetical barrier-only comparison, not a measured flask performance. Sources: [NIST-JANAF hydrogen thermochemistry, including H₂/I₂/HI equilibrium evidence](https://janaf.nist.gov/pdf/JANAF-FourthEd-1998-Hydrogen.pdf), [ACS contemporary account of Sullivan's mechanism result](https://pubs.acs.org/doi/10.1021/cen-v045n003.p040).

<a id="topic-exoplanets"></a>

### 58. exoplanets — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 11 steps and selected transit/orbit/velocity relations. Area-ratio depths, geometric transit selection, projected Doppler mass and the stated circular/uniform-disc approximations are coherent. Inverting a synthetic curve made with the same model is not independent validation of a real planet's parameters.

- **EX-1 · Medium · `src/routes/exoplanets/steps.ts:139`.** The introduction limits planetary light to reflected starlight. Planets emit thermal infrared radiation, including rocky ones, not only the young giants mentioned in the note. NASA's TRAPPIST-1 b measurement uses precisely this emission. Limit the reflection argument to visible reflected light and explain that intrinsic/reprocessed heat also produces infrared emission. The current note recognizes young planets' heat but leaves the main universal claim false. Sources: [NASA Webb measurement of rocky-planet thermal emission](https://science.nasa.gov/missions/webb/nasas-webb-measures-the-temperature-of-a-rocky-exoplanet/), [NASA explanation of planetary light](https://science.nasa.gov/photojournal/the-language-of-planetary-light/).

<a id="topic-greenhouse-effect"></a>

### 59. greenhouse-effect — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 13 steps and the energy-balance assumptions. The /4 geometry, fixed-albedo 255 K comparison, one-layer limit, collisional thermalisation, distinction from a glass greenhouse and use of total scenario forcing are explained carefully. Calibration to the AR6 assessment is disclosed; reproducing that calibration is not a new climate measurement. Source: [IPCC AR6 WG1 Chapter 7](https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-7/).

- **GH-1 · Low · `src/routes/greenhouse-effect/steps.ts:218`.** The categorical assurance that Stefan–Boltzmann always overcomes feedbacks is true of this stable linear-feedback model and the illustrated warming regime, not a general planetary law. A water-rich atmosphere can impose an outgoing-radiation limit and allow a runaway greenhouse. Scope the sentence to the modeled Earth-like changes; this is not a claim that present anthropogenic forcing is expected to boil the oceans. Source: [Goldblatt et al., radiation limits in runaway-greenhouse climates](https://www.nature.com/articles/ngeo1892).

<a id="topic-vision-color"></a>

### 60. vision-color — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 13 steps and selected eye/cone conventions. Accommodation, refractive corrections, univariance, metamerism and display gamut are consistent. The notes acknowledge the sodium match's small residual/negative-primary requirement, the difference between retinal opponent signals and perceived hues, and illustrative adaptation strength. Outdoor time is described cautiously rather than as a guaranteed myopia cure. Source: [National Eye Institute, myopia and outdoor-time evidence](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/nearsightedness-myopia). Cone curves and geometry were inspected as shipped, not independently remeasured.

<a id="topic-earthquakes"></a>

### 61. earthquakes — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 13 steps and selected ray/magnitude definitions. S-wave exclusion from the liquid outer core, converted-wave exclusions, refraction, shadow zones, epicentre location and energy-versus-intensity distinctions are generally sound. The ray model's agreement with ak135 is reference-model consistency, not a test of all real-Earth structure.

- **EQ-1 · Low · `src/routes/earthquakes/steps.ts:242`.** The note explains magnitude saturation as a seismometer's wiggles saturating. This conflates a magnitude estimator's limited sensitivity at its selected periods with instrumental clipping. Large ruptures add energy at periods that a short-period/local magnitude measure does not capture proportionally, even with an instrument that remains within range. Explain scale saturation separately from a sensor exceeding its dynamic range; retain moment magnitude as the remedy for comparing large sources. Sources: [USGS magnitude types and ranges](https://www.usgs.gov/programs/earthquake-hazards/magnitude-types), [USGS discussion of the 1906 magnitude](https://earthquake.usgs.gov/earthquakes/events/1906calif/18april/magnitude.php).

<a id="topic-dna-to-protein"></a>

### 62. dna-to-protein — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 12 steps, standard-code definitions and HBB sequence conventions. Strand direction, transcription/splicing, triplets, synonymous/missense/nonsense/frame-shift distinctions and the difference between precursor and mature β-globin numbering are consistent. The first-AUG rule is explicitly a simulation simplification, and the notes acknowledge regulatory/splicing effects outside amino-acid substitutions. This audit did not independently resequence HBB or adjudicate every ClinVar record. Sources: [NCBI genetic codes](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi), [NCBI, From RNA to Protein](https://www.ncbi.nlm.nih.gov/books/NBK26829/).

<a id="topic-meiosis-inheritance"></a>

### 63. meiosis-inheritance — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 13 steps and the assortment/recombination assumptions. Chromosome versus chromatid counts, meiosis I/II, Mendelian ratios, linkage and the Haldane map function are coherent. The notes distinguish gametophyte development in plants, sex-averaged human maps and the model's lack of crossover interference. Obligatory crossovers should be understood in the normal paired-chromosome examples, not as a rule for every species and sex. Mendel's quoted yellow/green counts match his paper. Source: [Mendel's original experiments, English translation](https://cs.brown.edu/people/rblumber/MendelWeb/Mendel.html).

<a id="topic-convolution-vision"></a>

### 64. convolution-vision — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 10 steps and filter/convolution functions. The cross-correlation naming convention, receptive fields (5 then 14 pixels), shared weights, ReLU, pooling and the distinction between equivariant filters and a position-sensitive dense classifier are well explained. Training/test performance is a shipped result, not independently rerun training.

- **CV-1 · Low · `src/routes/convolution-vision/steps.ts:186`.** The assertion of exactly preserved translated feature maps needs a boundary condition. With the page's finite, same-size zero-padded arrays, filtering and shifting do not commute at the edges. A one-pixel input at (0,14), shifted left by one, vanishes; shifting its already blurred feature map leaves 1/9 at (0,14). Say the map translates exactly away from boundary/cropping effects, and explain what happens when a digit is moved partly out of frame. Sources: [Kayhan and van Gemert, boundary effects in CNNs](https://openaccess.thecvf.com/content_CVPR_2020/papers/Kayhan_On_Translation_Invariance_in_CNNs_Convolutional_Layers_Can_Exploit_Absolute_CVPR_2020_paper.pdf); direct shipped-code reproduction below.

<a id="topic-transformers"></a>

### 65. transformers — No active material finding

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 12 steps and selected score/softmax/data conventions. Scaled dot-product attention, masking, head dimensions, output projection, residual connections and token-wise MLPs match GPT-2's design. The text discloses fixed prompts, quantized recorded weights, one-based head numbering and the limits of treating attention as causal explanation. The attention-sink and head-role examples should remain observations for these contexts; one head need not always do a single job. The audit did not download GPT-2 or independently regenerate its forward passes. Sources: [Vaswani et al., Attention Is All You Need](https://arxiv.org/abs/1706.03762), [OpenAI's GPT-2 implementation](https://github.com/openai/gpt-2).

<a id="topic-respiration-atp"></a>

### 66. respiration-atp — Corrections requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 14 steps and selected stoichiometric/model assumptions. Glycolysis, pyruvate oxidation, cycle electron carriers, 10/6 proton bookkeeping and the distinction between measured P/O ratios and an ideal c8-ring maximum are coherent. The note correctly prevents readers from identifying the first-turn CO₂ atoms with the incoming acetyl carbons. Dynamic carrier rate constants are disclosed as illustrative.

- **RA-1 · Medium · `src/routes/respiration-atp/steps.ts:50`.** The opening assigns complete oxygen-dependent glucose oxidation to every cell in the body. Mature human red blood cells lack mitochondria and obtain ATP by glycolysis with lactate production; oxygen delivery does not make them respire aerobically. Use “many cells” or introduce aerobic respiration as the main pathway in mitochondria-containing cells, with the red-cell exception alongside the later fermentation section. Source: [NCBI Bookshelf, anaerobic glycolysis and cells without mitochondria](https://www.ncbi.nlm.nih.gov/books/NBK546695/).

<a id="topic-standard-model"></a>

### 67. standard-model — Narrow qualifications requested

**Current-state check:** Current topic route is unchanged from its earlier reviewed baseline; prior substantive review retained and current findings checked.

Reviewed all 14 steps and selected PDG provenance/conservation conventions. The conventional 17-entry count, valence versus sea quarks, colour singlets, virtual W, Higgs versus hadron mass, and caveat about separate lepton numbers are generally sound. The 0.45 eV figure is a direct effective electron-neutrino mass limit, not a direct measurement of three individual masses; keep that meaning when displaying it. Source: [PDG 2026 fixed-edition particle properties](https://pdg.lbl.gov/2026/listings/particle_properties.html).

- **SM-1 · Low · `src/routes/standard-model/steps.ts:132`.** The scale note says a proton drawn to scale would be an invisible speck within a nucleus. The proton-to-nucleus separation is modest: a hydrogen-1 nucleus is a proton, and even a heavy nucleus is only several proton radii across. The enormous scale separation is between nucleus and atom. Remove the proton-within-nucleus claim and retain the atom/nucleus comparison. Source: [PDG particle properties, including the proton](https://pdg.lbl.gov/2026/listings/particle_properties.html). This finding concerns the written scale claim; rendered drawings were not measured.

<a id="topic-deep-time"></a>

### 68. deep-time — Narrow qualifications requested

**Current-state check:** The earlier substantive review is retained. The concurrent revision only adds source-attribution/licence wording; the educational claims and model are unchanged and the current finding status was checked.

Reviewed all 12 steps and time/calendar definitions. The start date is explicitly the oldest Solar-System solids rather than a claim that Earth accreted instantly. Reconstruction uncertainty, coarse geological temperature bins and disputed Precambrian oxygen levels are disclosed.

- **DT-1 · Low · `src/routes/deep-time/steps.ts:135`.** Naming 180-million-year western-Pacific floor as the oldest existing ocean floor is too categorical. Magnetic evidence supports roughly 340-million-year oceanic crust in the eastern Mediterranean, although its nature/age has been debated. Say most surviving ocean floor is younger than roughly 180–200 million years, with possible much older remnants. This preserves the explanation for poor ancient-ocean constraints without asserting a hard maximum. Source: [Granot (2016), Palaeozoic oceanic crust beneath the eastern Mediterranean](https://www.nature.com/articles/ngeo2784).

<a id="topic-redox-batteries"></a>

### 69. redox-batteries — No active material finding

**Current-state check:** The earlier substantive review is retained. The concurrent revision only adds source-attribution/licence wording; the educational claims and model are unchanged and the current finding status was checked.

Reviewed all 12 steps and selected Nernst/Faraday/electrode functions. Reproduced the Daniell cell's 1.1037 V, 5.36030 Ah ideal capacity, and 1.29470 g of lithium moved for 5 Ah. Charge carriers, oxidation/reduction, discharge-based commercial electrode naming and active-material versus finished-cell capacity are carefully separated. Concentrations as activities, open-circuit voltage and unmatched electrode-pair endpoints are explicitly limited. Sources: [Chen et al., LG M50 experimental parameterization](https://doi.org/10.1149/1945-7111/ab9050), [authors' experimental data](https://zenodo.org/records/4032561).

<a id="topic-neurons"></a>

### 70. neurons — Corrections requested

**Current-state check:** Rechecked the blocker implementation, spike/myelin displays and revised notes. The unblocked Hodgkin–Huxley equations retain their stated parameters, but the blocker branch adds an undisclosed fixed conductance (NEU-1 below). The 10 µm myelinated-fibre diameter is now explicitly an outer diameter in the notes.

Reviewed all 13 steps and selected ion/conductance definitions. Nernst/GHK resting potentials, membrane capacitance, sodium activation/inactivation, delayed potassium conductance and regenerative cable conduction have the right mechanisms. Squid-versus-mammal temperatures, fixed reversal potentials, illustrative synapse strengths and estimated unmyelinated speeds are disclosed. Hodgkin–Huxley gating variables are a phenomenological model; their correspondence with later channel structures should not imply four literally independent identical physical gates. Source: [Hodgkin and Huxley (1952), original quantitative model](https://doi.org/10.1113/jphysiol.1952.sp004764).

- **NEU-1 · Medium · `src/routes/neurons/hh.ts:110`; `src/routes/neurons/steps.ts:317,318`.** The revised blocker does not simply block 90% of potassium conductance as the control says. It preserves the removed resting conductance as a fixed, unblocked potassium leak. At the resting gates, `currents(REST, RESTING, {k:0.1}).gK` is **0.366644 mS/cm²**, the same as without blocker, rather than **0.036664** for scaling the published maximum conductance by 0.1. This artificial compensation prevents the resting voltage from shifting and affects the blocked spike. The code comment acknowledges the choice, but the learner’s notes continue to give the original HH conductance and a chemical-blocker interpretation. Either disclose the compensating conductance and limit the quantitative blocker claims, or model the chosen pharmacological approximation consistently. This is not a demand for a fully realistic drug-binding model. Sources: [MIT HH/TEA laboratory model, reducing maximum potassium conductance](https://ocw.mit.edu/courses/6-021j-quantitative-physiology-cells-and-tissues-fall-2004/b4b87eb17edb319471646bd01bbbdddc_manual5.pdf), [Armstrong, TEA interactions with potassium channels](https://pmc.ncbi.nlm.nih.gov/articles/PMC2226036/); direct current-code probe below.

<a id="topic-immune-system"></a>

### 71. immune-system — No active material finding

**Current-state check:** Rechecked revised receptor-count, clonal-expansion and memory wording, plus the library display. Mouse-scale model counts and staggered recruitment are now separated from a single cell’s programmed expansion; no additional material finding.

Reviewed all 12 steps and the model's parameter/memory definitions. Innate versus adaptive responses, receptor diversity, clonal selection, extracellular antibodies versus infected-cell killing, and memory are well distinguished. The charts' mouse-influenza parameters, missing helper cells, added B-cell memory rule and discrete clearance threshold are explicit. The model's six-month reinfection behavior is not a measured human flu prognosis; antibody molecules' short lives must also be distinguished from long-lived plasma cells maintaining titres, as the notes do. Source: [Cao et al. (2016), original influenza model](https://pubmed.ncbi.nlm.nih.gov/28066421/).

<a id="topic-evolution"></a>

### 72. evolution — No active material finding

**Current-state check:** Rechecked the neutral-drift times, Luria–Delbrück provenance, peppered-moth qualifications and Lenski transfer-rate wording. The corrected approximately 2.8N neutral absorption time for starting frequency one-half is distinct from the 4N conditional fixation time. Historical fluctuation-test counts remain a secondary transcription, not independently recovered here from the original tables.

Reviewed all 12 steps and selected population/model definitions. The synthetic six-gene moth is distinguished from real single-locus melanism. Selection, inheritance, drift, neutral fixation and mutation-before-selection are correctly separated. The historical starting frequency and selection estimates are marked as assumptions/fits; model space is not presented as the actual woodland. Haldane's 2s rule and the quoted diffusion approximation require the small-selection/large-population regime rather than being exact for all s and N. Sources: [Cook et al., Majerus's predation experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC3391436/), [van't Hof et al., the carbonaria mutation](https://www.nature.com/articles/nature17951), [Wiser et al., long-term fitness trajectories](https://pubmed.ncbi.nlm.nih.gov/24231808/).

<a id="topic-language-models"></a>

### 73. language-models — No active material finding

**Current-state check:** Rechecked revised byte-tokenisation, tied output embeddings, original GPT-2 training provenance and combined sampling filters. These describe the named GPT-2 model; its vocabulary size is not a universal size for language models. Model weights and hosted comparison outputs were not regenerated.

Reviewed all 13 steps and selected tokenizer/sampling conventions. GPT-2 byte BPE, 256 bytes plus 50,000 merges and one special token, next-token cross-entropy, temperature, truncation and autoregressive generation are coherent. Fixed/precomputed contexts and the curated high-temperature seed are disclosed. “Every answer” and the 50,257-token vocabulary should remain scoped to this autoregressive GPT-2 example; not every language-model architecture or tokenizer has that design. The post-training explanation describes the InstructGPT recipe rather than establishing the private training details of every named current assistant. Sources: [GPT-2's tokenizer implementation](https://github.com/openai/gpt-2/blob/master/src/encoder.py), [Ouyang et al., InstructGPT](https://arxiv.org/abs/2203.02155).

<a id="topic-protein-folding"></a>

### 74. protein-folding — No active material finding

**Current-state check:** Rechecked the Metropolis/crankshaft changes and structure-comparison wording. The corrected p53 text scopes the pictured crystal to its core and disorder to unbound segments, so PF-1 is resolved. PDB 1YCR still provides the useful counterexample of a bound N-terminal peptide. The explicit training-set overlap prevents the illustrated AlphaFold comparisons being presented as a blind test.

Reviewed all 13 steps and selected lattice/structure conventions. The HP model's loss of chemistry and entropy is explicit, as are Metropolis uphill moves, kinetic trapping and the difference between structure prediction and a physical folding trajectory. The later disordered-tail example limits the earlier one-unique-fold shorthand. The audit did not regenerate solvent-accessibility calculations or AlphaFold predictions.

Resolved PF-1: the corrected claim concerns crystallising these flexible regions on their own, rather than declaring every non-core p53 segment absent from all crystal structures. Source: [PDB 1YCR, bound N-terminal p53 peptide](https://www.rcsb.org/structure/1YCR).

<a id="topic-carbon-polymers"></a>

### 75. carbon-polymers — Corrections requested

**Current-state check:** Rechecked geometry-index corrections, compound additions, state interpolation, builder restrictions and rubber-network caveats. Natural rubber’s initial elastic response and later creep are now acknowledged. The molecular property table was not independently reacquired in full. The biosynthetic correction remains incomplete, as CP-1 explains.

Reviewed all 13 steps and selected molecule/polymer definitions. Alkane geometry, unsaturation, constitutional isomers, tetrahedral chirality, hydrogen bonding and the disclosed ideal rubber network are broadly consistent. The single-stereocentre example should not imply that four different groups on one carbon are necessary for all molecular chirality; axial chirality also exists.

- **CP-1 · Medium · `src/routes/carbon-polymers/steps.ts:235,236`.** **Partly corrected, still open for proteins.** The DNA example now correctly names diphosphate/pyrophosphate, removing that part of the earlier error. But the prose and note still group actual protein biosynthesis with reactions releasing a small molecule such as water at each new bond. Ribosomal peptide transfer is aminolysis of an activated peptidyl–tRNA ester: the leaving group is the previous tRNA, not water. Distinguish formal condensation bookkeeping from the activated-substrate mechanisms used in living cells; the DNA correction can stay. Sources: [Steitz, ribosomal peptide-bond mechanism](https://pmc.ncbi.nlm.nih.gov/articles/PMC2783306/), [primary DNA-polymerase study](https://pubmed.ncbi.nlm.nih.gov/29850882/).

<a id="topic-tensors"></a>

### 76. tensors — No active material finding

**Current-state check:** Rechecked RGB/luma qualifications, traction-side convention, principal-stress wording and index transformation rules. The revision now distinguishes BT.601 weights used as a common conversion from the BT.709 primaries of sRGB. No new material finding.

Reviewed all 14 steps and selected array/stress functions. Array-axis count versus vector-space dimension, shape-preserving element counts, reshape versus transpose, contractions and the distinction from physical transformation rules are explained correctly. Reproduced the displayed matrix–vector result (1,4,2), principal angle 22.5° and stresses 92.4264/7.57359 MPa. In the general library discussion, transposing need not physically move all data: it can produce a strided view; the implementation here deliberately copies. Source: [NumPy copies, views, strides and reshaping](https://numpy.org/doc/stable/user/basics.copies.html).

<a id="topic-ice-ages"></a>

### 77. ice-ages — No active material finding

**Current-state check:** Rechecked the local/global temperature distinction, orbital-insolation conventions and future-glaciation wording. A modern June-solstice diagnostic is now distinguished from Milankovitch’s historical summer-half-year measure. The scenario dates remain model-dependent, not forecasts certified by this audit.

Reviewed all 13 steps and selected orbital/record conventions. Local Antarctic versus global temperature, obliquity/precession/eccentricity, seasonal versus global-annual forcing and the unresolved 100,000-year problem are properly separated. The different gas/ice chronologies explicitly prevent a spurious lead/lag inference. The future-glaciation statement is tied to named model scenarios and cumulative emissions, not an exact forecast from a sinusoid. Sources: [NOAA EPICA Dome C record and temperature conversion](https://www.ncei.noaa.gov/access/paleo-search/study/6080), [Ganopolski et al., glacial-inception experiments](https://www.nature.com/articles/nature16494).

<a id="topic-big-bang"></a>

### 78. big-bang — Narrow qualifications requested

**Current-state check:** Rechecked the flat-universe qualifier, acceleration-versus-density-domination epochs, distance labels and light-element bookkeeping. The added cosmology constants derive from the existing expansion model. BB-1 remains open; the rest of the revised statements did not yield a new material finding.

Reviewed all 12 steps and selected expansion/abundance definitions. Expansion without a centre, redshift versus local Doppler motion, scale factor, photon temperature and the three distance measures are coherent within the flat ΛCDM model. The Hubble tension, massless-neutrino approximation and uncertainty at time zero are disclosed. A simple neutron-count abundance match is an approximation, not an independent full nucleosynthesis calculation. Source: [Planck 2018 cosmological-parameter paper](https://doi.org/10.1051/0004-6361/201833910).

- **BB-1 · Low · `src/routes/big-bang/steps.ts:201`.** Saying all other elements were made in stars omits cosmic-ray spallation, important for beryllium and boron and some lithium; the later `stars` topic correctly identifies it. Say most heavier elements were made by stellar processes and their explosions/mergers, with some light nuclei produced by cosmic-ray interactions. Source: [NASA's element-origin teaching material](https://imagine.gsfc.nasa.gov/educators/elements/imagine/element_connections_v1_notes.pdf).

<a id="topic-transistors-chipmaking"></a>

### 79. transistors-chipmaking — No active material finding

**Current-state check:** Rechecked the inversion-charge change, conventional-MOSFET limit, scanning exposure and process-step wording. TC-1 is resolved by the restriction to ordinary MOSFETs. The remaining ideal square-law/EKV model is still a teaching model, not a prediction for every advanced process.

Reviewed all 13 steps and selected MOSFET/lithography definitions. Long-channel square-law behavior is explicitly a circa-2000 teaching device, not a modern-node performance model. Subthreshold leakage, high-k/metal gates, multiple patterning and node names versus feature dimensions are addressed. ASML supports the stated single-exposure k1 floor. Source: [ASML Rayleigh criterion](https://www.asml.com/en/technology/lithography-principles/rayleigh-criterion).

Resolved TC-1: the approximately 60 mV/decade bound is now restricted to ordinary MOSFETs. Source for the excluded mechanism: [Sarkar et al., room-temperature subthermionic tunnel FET](https://www.nature.com/articles/nature15387).

<a id="topic-diffusion-models"></a>

### 80. diffusion-models — No active material finding

**Current-state check:** Rechecked the clean/noise loss-weight equivalence, network-size declaration and posterior-sampling wording. Min(1,5/SNR) multiplying noise-prediction loss equals min(SNR,5) multiplying clean-image loss under the stated parameterisation. No new finding; no retraining or export regeneration was performed.

Reviewed all 13 steps and selected schedule/sampler/training-weight code. The forward Gaussian shortcut, posterior-mean denoising, fresh reverse noise, respacing and classifier-free guidance are coherent. The training really uses min(SNR,5) on the clean-target squared error, equivalent to min(1,5/SNR) on noise-prediction error: that is not a weighting bug. Finite noising leaves a very small signal rather than mathematically erasing every trace; the notes give its actual 0.006 coefficient. The small precomputed digit runs are not a general non-memorisation guarantee for all diffusion models. Sources: [Ho et al., DDPM](https://arxiv.org/abs/2006.11239), [Hang et al., Min-SNR weighting, §4.2](https://arxiv.org/html/2303.09556v1).

<a id="topic-mrna-vaccines"></a>

### 81. mrna-vaccines — Narrow qualifications requested

**Current-state check:** Rechecked the added antigen-clearance curve and calibration revision to approximately 2.5 times the modeled infection peak. The extra one-day protein half-life is identified as an assumption, and mouse influenza parameters remain disclosed. These are not independently validated human COVID response predictions. The new universal mRNA-structure wording needs MV-1.

Reviewed all 14 steps and the response model's stated provenance. Modified nucleosides, lipid delivery, endosomal escape, translated antigen, two-proline stabilisation and adaptive memory have the correct central mechanisms. The codon-optimisation comparison is followed by the two deliberate amino-acid substitutions, so the same-protein shorthand should be understood apart from that disclosed stabilisation.

The charts are explicitly an extension of a **mouse-influenza immune model**, calibrated at one antibody-ratio target; they do **not** independently establish human vaccine effectiveness, the duration of infection protection, or a human reinfection timeline. Likewise, reporter-protein decay after injection in mice is not a universal human vaccine-mRNA half-life. The notes already disclose species, extrapolation, lymph-node persistence, variants and mucosal-immunity limitations, so these are validation limits rather than additional findings. The quoted 95% efficacy is correctly anchored to the original trial's symptomatic-disease endpoint and timing, not current variant-independent sterilising immunity. The closing herd-immunity sentence should remain conditional on sufficiently durable protection against transmission. Sources: [Nobel Committee scientific account of modified mRNA](https://www.nobelprize.org/prizes/medicine/2023/press-release/), [Polack et al., original BNT162b2 trial](https://www.nejm.org/doi/full/10.1056/NEJMoa2034577), [Cao et al., source immune model](https://pubmed.ncbi.nlm.nih.gov/28066421/).

- **MV-1 · Low · `src/routes/mrna-vaccines/steps.ts:104`.** The revised opening assigns a long poly(A) tail to every mRNA in human cells. Replication-dependent histone mRNAs are a well-established exception: they use a stem-loop 3′ end. Say the vaccine has the usual architecture of most cellular mRNAs. Its own cap/UTRs/coding sequence/poly(A) description can remain. Source: [primary cellular and structural study of histone mRNA 3′ processing](https://pubmed.ncbi.nlm.nih.gov/30507380/).

<a id="topic-stars"></a>

### 82. stars — No active material finding

**Current-state check:** Rechecked the catalogue filtering, track end points and element-origin revisions. ST-1 is resolved: white-dwarf explosions are no longer defined by exceeding 1.4 solar masses. The Gaia sample now discloses removal of about 60 points below its adopted main sequence; this is a selected/derived HR diagram, not a blind validation of that sequence or an unfiltered catalogue.

Reviewed all 14 steps and selected track/origin conventions. Hydrostatic support, fusion energy, mass-dependent lifetimes, giant evolution and compact remnants are broadly sound. The solar calibration mismatch, track endpoints, schematic layers and approximate remnant-mass boundaries are disclosed. The attribution of r-process shares to mergers is a chosen origin-table prescription, not a uniquely measured source fraction. Source: [Choi et al., MIST stellar tracks](https://arxiv.org/abs/1604.08592).

Resolved ST-1: accretion or merger until ignition is now described without a compulsory Chandrasekhar crossing. Source: [observational evidence for a sub-Chandrasekhar double detonation](https://www.nature.com/articles/s41550-025-02589-5).

<a id="topic-dark-matter"></a>

### 83. dark-matter — Corrections requested

**Current-state check:** Rechecked fit-parameter bounds, lensing-field scale, rotation-curve history and search-status wording. The qualitative evidence for an unseen component is separate from candidate identity. DM-1 remains open. No reanalysis of the full SPARC catalogue or verification of every latest detector-event claim was performed.

Reviewed all 12 steps and selected rotation/lensing assumptions. Spherical versus disc gravity, mass-to-light uncertainty, synthetic lensing sources, halo-profile alternatives and the distinction from dark energy are disclosed. Rotation curves and the Bullet Cluster constrain gravitating mass; they are not direct particle detections. Source: [Planck cosmological-parameter inference](https://doi.org/10.1051/0004-6361/201833910).

- **DM-1 · Medium · `src/routes/dark-matter/steps.ts:244`.** The exclusion of ordinary hidden matter includes black holes without qualification and applies the baryon budget to all of them. Stellar-remnant black holes originated in baryonic matter; hypothetical primordial black holes can form from early density perturbations before nucleosynthesis and are not constrained in the same way by the baryonic budget. Distinguish those populations. They are not established as the answer, and lensing/other observations constrain their abundance, but this argument does not rule out the entire category. Sources: [NASA Roman's primordial-black-hole search](https://www.nasa.gov/missions/roman-space-telescope/how-nasas-roman-mission-will-hunt-for-primordial-black-holes/), [NASA-hosted primordial-black-hole review, formation and constraints](https://ntrs.nasa.gov/api/citations/20190032582/downloads/20190032582.pdf).

<a id="topic-gpu"></a>

### 84. gpu — No active material finding

**Current-state check:** Rechecked toy-machine versus real-chip comparisons, CPU lane qualifications, dense FP16 tensor accumulation variants and roofline arithmetic. Published peak rates are distinguished from measurements. The Intel export-compliance number is explicitly an estimate basis, not a benchmark of all heterogeneous cores at once.

Reviewed all 12 steps and selected specifications/work-count conventions. The initial CPU/GPU race is explicitly a toy instruction-count model; the later peaks, roofline, memory reuse, divergence and serial-fraction examples are upper bounds/models, not hardware benchmarks. The quoted 165.2 TFLOPS tensor figure is valid for **dense FP16 input with FP32 accumulation** in NVIDIA's table; other precision/accumulation/sparsity choices have different peaks. Adding that qualifier would improve clarity but the number is not wrong. CUDA's 32-thread warp is NVIDIA-specific rather than a universal GPU width. Sources: [NVIDIA Ada whitepaper, Appendix A](https://images.nvidia.com/aem-dam/Solutions/Data-Center/l4/nvidia-ada-gpu-architecture-whitepaper-v2.1.pdf), [CUDA programming guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/).

<a id="topic-medical-imaging"></a>

### 85. medical-imaging — Corrections requested

**Current-state check:** Rechecked attenuation/dose qualifications, CT soft-tissue interpretation, ultrasound timing and CODATA labelling. The dose examples remain approximate average-adult values. MI-1 remains open: RF pulses have finite excitation bandwidth.

Reviewed all 14 steps and selected attenuation/reconstruction/MRI definitions. Beer–Lambert line integrals, sinograms, ramp-filter reconstruction, HU, Poisson noise, impedance echoes, Larmor frequency and spin-echo contrast are coherent within the declared models. Monoenergetic beams, equal MRI proton densities and stationary blood are explicit limitations. The radiology doses are approximate contextual values, not individual risk estimates. Sources: [NIST tissue attenuation tables](https://pml.nist.gov/PhysRefData/XrayMassCoef/tab4.html), [RadiologyInfo dose comparisons](https://www.radiologyinfo.org/info/safety-xray).

- **MI-1 · Medium · `src/routes/medical-imaging/steps.ts:362`.** The resonance explanation says a pulse at any other frequency has no effect. A finite RF pulse excites a band of frequencies; off-resonance response varies with pulse duration, shape and strength. That finite excitation bandwidth is essential to selecting an MRI slice in a gradient. Replace the exact-frequency/no-effect dichotomy with a pulse centred near the Larmor frequency that acts most strongly within its excitation bandwidth. Source: [Siemens MR training, RF bandwidth and slice thickness](https://academy.siemens-healthineers.com/_/en-us/mr-essentials-spatial-resolution-online-training/).

<a id="topic-gravitational-waves"></a>

### 86. gravitational-waves — No active material finding

**Current-state check:** Rechecked strain normalisation, geometric spreading, remnant-spin attribution, redshift factors and chirp-estimate caveats. GW-1 is resolved by explicitly identifying 6GM/c² as a test-particle value used as an estimate for a comparable-mass binary. The Newtonian fit through plunge is now explicitly limited.

Reviewed all 12 steps and selected inspiral/detector conventions. Quadrupole radiation, chirp mass, distance scaling, interferometric readout and the GW150914 masses/time agree with the cited detection. The leading-order fit's biased mass, missing merger waveform and emitted-versus-observed frequencies are explicitly disclosed. The revised text now explicitly distinguishes spherical 1/r amplitude decay from 1/√r tank-ripple decay. Source: [LIGO GW150914 primary detection and materials](https://dcc.ligo.org/P150914/public).

Resolved GW-1: `src/routes/gravitational-waves/steps.ts:255` now explicitly calls the comparable-mass cutoff an estimate. Source: [LIGO-hosted waveform reference distinguishing test-particle ISCO and binary models](https://gwic.ligo.org/assets/docs/theses/santamaria_thesis.pdf).

<a id="topic-graphics-3d"></a>

### 87. graphics-3d — No active material finding

**Current-state check:** Rechecked perspective/FOV wording, twice-triangle-area normalisation, raster boundary caveat and lighting readout. Perspective field of view is now described at fixed camera position. No new material finding; no rendered visual QA was run.

Reviewed all 13 steps and selected transformation/rendering conventions. Homogeneous coordinates, perspective divide, edge functions, depth testing, perspective-correct texture interpolation and secondary rays are coherent. OpenGL's −1-to-1 depth convention is a convention rather than the only possible API range. The page identifies Phong shading, constant ambient, missing distance falloff, opaque glass shadows and truncated bounces as simplifications. Changing field of view at a fixed camera position magnifies/crops the view; the usual change of perspective compression with a longer lens also involves moving the camera. Treat that phrase as photographic shorthand. Sources: [Khronos rendering pipeline](https://wikis.khronos.org/opengl/Rendering_Pipeline_Overview), [OpenGL specification, perspective interpolation](https://registry.khronos.org/OpenGL/specs/gl/glspec13.pdf).

<a id="topic-cancer"></a>

### 88. cancer — Corrections requested

**Current-state check:** Rechecked KRAS mechanism, tissue-model comment, inherited-risk example and treatment claims. CAN-1, CAN-2 and CAN-3 all remain open. The corrected population explanation for sporadic retinoblastoma does not fix the blanket two-hit TP53 statement.

Reviewed all 11 steps and the model's driver/treatment assumptions. Clonal evolution, passenger mutations, normal-tissue clones, the distinction between fitted multistage slopes and literal mutation counts, and model-versus-clinical treatment outcomes are generally well separated. The two-driver tumour, greatly accelerated mutation rate and synthetic drug outcomes are disclosed rather than asserted to reproduce clinical cancer progression.

- **CAN-1 · Medium · `src/routes/cancer/steps.ts:148` and `src/routes/cancer/steps.ts:177`; `src/routes/cancer/model.ts:19`.** The text treats every tumour suppressor as a recessive two-hit brake and a one-hit TP53 cell as unchanged. The classic RB1 loss-of-function model is useful, but some TP53 missense mutations inhibit the remaining wild-type protein through dominant-negative effects; one intact copy does not guarantee normal p53 function. Retain the simplified two-null-hit simulation if desired, label its mutation class, and explain that the general rule has exceptions, especially the named TP53 example. Source: [primary targeted p53 mutation experiments demonstrating dominant-negative inhibition](https://pmc.ncbi.nlm.nih.gov/articles/PMC122453/).
- **CAN-2 · Medium · `src/routes/cancer/steps.ts:250`.** Grouping surgery and radiotherapy as removing/killing cells irrespective of their mutations is false for radiation response. DNA-repair and other alterations can change radiosensitivity; primary work links CREBBP/EP300 mutations to radioresistance. Say these treatments can avoid a particular drug's target-specific resistance mechanism, while radiotherapy still has biological sensitivity/resistance and does not kill every cancer cell regardless of genotype. Source: [primary study of mutant-associated radioresistance and radiosensitisation](https://www.nature.com/articles/s41467-021-26570-8).
- **CAN-3 · Medium · `src/routes/cancer/steps.ts:234`.** The categorical claim that the drug never creates resistant cells conflates non-directed mutation with a constant, treatment-independent mutation process. Resistance can pre-exist, arise during therapy, or involve treatment-induced changes in mutability and cell state. Experiments in colorectal cancer find targeted therapy down-regulates mismatch repair and increases mutagenesis. Say mutations need not arise because they would help, and treatment selects resistant lineages, but some therapies also change the rate/process that generates variation. The model can keep its explicit fixed-rate assumption. Source: [Russo et al., adaptive mutability under targeted therapies](https://pubmed.ncbi.nlm.nih.gov/31699882/).

<a id="topic-turing-machines"></a>

### 89. turing-machines — No active material finding

**Current-state check:** Rechecked universal-machine attribution, general-purpose language/unbounded-memory scope, Rice-property wording, Busy Beaver growth and TSP reduction explanation. TM-1 is resolved. No new material finding in the revised text.

Reviewed all 12 steps and selected simulator/counting functions. The diagonal halting argument, distinction between decidability and complexity, S(n) versus Σ(n), TSP count and distinction between formal proof and a simulation are coherent. The five-state Busy Beaver result is genuinely proved, not still just the 1989 lower bound. Sources: [bbchallenge primary proof paper](https://arxiv.org/abs/2509.12337), [collaboration's July 2024 announcement](https://discuss.bbchallenge.org/t/july-2nd-2024-we-have-proved-bb-5-47-176-870/237).

Resolved TM-1: `src/routes/turing-machines/steps.ts:254` now says general-purpose languages and processors given enough memory. Restricted languages are no longer included by the universal wording. Source for the excluded case: [Dhall’s official total-language guarantees](https://github.com/dhall-lang/dhall-lang/wiki/Safety-guarantees).

<a id="topic-wireless-signals"></a>

### 90. wireless-signals — No active material finding

**Current-state check:** Rechecked FM-bandwidth qualifications, modulation-specific symbol-rate statements, OFDM guard intervals and the added per-subcarrier SNR floor. The floor is an ideal coding bound, not a measured Wi-Fi sensitivity. No additional material finding.

Reviewed all 14 steps and selected modulation/noise/link/capacity formulas. The distinction between Es/N₀ and Eb/N₀ is explicit; comparing the QPSK and BPSK curves at the same displayed symbol SNR therefore is not a 3 dB bug. Raised-cosine zero crossings, occupied versus ideal bandwidth, fixed-gain free-space loss, thermal noise, coding and capacity are consistent with the declared AWGN/isotropic model. Wi-Fi contention, nonrectangular spectra and region-dependent channels/power limits are disclosed. Zero observed errors in a finite sample should not be read as a mathematically zero BER. Sources: [ITU-R SM.328, spectra and occupied bandwidth](https://www.itu.int/rec/R-REC-SM.328/en), [Shannon's original communication paper](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf).

<a id="topic-gps"></a>

### 91. gps — Corrections requested

**Current-state check:** Fresh audit of final topic.

Reviewed all 11 steps, almanac/orbit and clock conventions, Gauss–Newton positioning, DOP calculation and selected sky/fix displays. Four unknowns, receiver-clock bias, the almanac/ephemeris distinction and omitted propagation corrections are clearly explained. Reproduced the net relativistic clock advance of 38.5738 µs/day; the page correctly avoids turning a common range bias into an automatic 11 km/day position drift. Sources: [ESA relativistic clock correction](https://gssc.esa.int/navipedia/index.php/Relativistic_Clock_Correction), [ESA GNSS processing reference](https://gssc.esa.int/navipedia/GNSS_Book/ESA_GNSS-Book_TM-23_Vol_I.pdf).

- **GPS-1 · Medium · `src/routes/gps/steps.ts:242,243`; `src/routes/gps/model.ts:310`.** The text uses GDOP to predict the spread of position fixes. GDOP includes receiver-clock uncertainty; **PDOP** is the 3-D position RMS multiplier, HDOP the horizontal multiplier and VDOP the vertical multiplier, assuming independent equal-variance range errors and the linearised solution. The model already calculates all of them correctly. For one satellite overhead and three on the horizon, it gives GDOP = 1.73205 but PDOP = 1.63299. Use the relevant position DOP for the displayed spatial cloud and reserve GDOP for combined position-and-clock precision. Source: [ESA definitions and error relationships](https://gssc.esa.int/navipedia/index.php/Positioning_Error).

<a id="topic-heat-engines"></a>

### 92. heat-engines — No active material finding

**Current-state check:** Fresh audit of final topic.

Reviewed all 12 steps, ideal-gas cycle equations, steam-table interpolation and real-efficiency provenance. Reproduced Otto efficiency 60.1893%, 493.099 J of work for the specified cycle, ideal Rankine efficiency 43.0051% at 600 °C/46 °C, and the illustrative combined-cycle 62.24%. Constant heat capacities, reversibility and omitted engine losses are disclosed. The Carnot bound is scoped to the two reservoirs; EIA heat rates use higher heating value while the named record plants use lower heating value, and this difference is explicitly warned about. The EIA 2024 source independently matches 10,018/10,443/10,999/7,548 Btu/kWh. No material factual error found in the reviewed scope. Sources: [EIA Table 8.2](https://www.eia.gov/electricity/annual/html/epa_08_02.html), [NIST fluid-property reference](https://webbook.nist.gov/chemistry/fluid/). Manufacturer engine-efficiency claims are presented as attributed claims, not independently measured here.

<a id="topic-solar-cells"></a>

### 93. solar-cells — No active material finding

**Current-state check:** Fresh audit of final topic.

Reviewed all 12 steps, spectrum integration, detailed-balance diode, maximum-power optimisation and record-cell conventions. Reproduced incident power 1000.371 W/m², silicon ideal Voc 0.876596 V and efficiency 33.3894%, with a 33.6791% optimum near 1.34 eV. Ideal absorption/collection, radiative-only loss, the lower real-silicon Auger ceiling and concentration exceptions are disclosed. The official NLR chart independently supports the selected headline 28.1% silicon, 28.0% perovskite, 35.2% perovskite/silicon and 47.6% concentrator figures; these are research cells, not commercial modules. No material factual error found. Sources: [official NLR chart, revision July 17, 2026](https://www.nlr.gov/docs/libraries/pv/cell-pv-eff.pdf), [NLR chart and data definitions](https://www.nlr.gov/pv/cell-efficiency). The complete spreadsheet’s individual record IDs, dates and IV parameters were not independently reconciled; a source-page update date does not automatically date each underlying measurement.

<a id="topic-consensus-blockchains"></a>

### 94. consensus-blockchains — Corrections requested

**Current-state check:** Fresh audit of final topic.

Reviewed all 12 steps, oral-message assumptions, Raft election/replication rules, hash-chain and mining logic, retargeting, forks and attack-probability formulas. The code contains Raft’s current-term commit guard; the explanatory rule omits it. Reproduced the 30%-attacker probabilities at 24 and 32 confirmations under the page’s catch-up-as-success model. Crash faults, Byzantine faults and probabilistic proof-of-work confirmation are distinguished. Sources: [Ongaro and Ousterhout, Raft extended paper](https://raft.github.io/raft.pdf), [Nakamoto, Bitcoin paper](https://bitcoin.org/bitcoin.pdf).

- **BC-1 · Medium · `src/routes/consensus-blockchains/steps.ts:209,314`; `src/routes/consensus-blockchains/consensus.ts:395`.** Majority storage is described as sufficient to commit an arbitrary entry. In Raft, a leader directly commits by counting replicas only for an entry from **its current term**; older entries become committed indirectly when a current-term entry commits. A previous-term entry can be on a majority and still be overwritten: the paper’s Figure 8 is the counterexample. The implementation correctly checks the term, so fix the teaching rule/definition and closing summary rather than removing that guard. Source: [Raft §5.4.2 and Figure 8](https://raft.github.io/raft.pdf).
- **BC-2 · Medium · `src/routes/consensus-blockchains/steps.ts:302,303`; `src/routes/consensus-blockchains/consensus.ts:960`.** The attack description says reaching equal chain length makes everyone switch. Equal accumulated work creates a tie; honest nodes need not abandon the branch they already accepted, as the page’s earlier fork explanation recognises. The race explicitly counts a tie as an attacker win, which is an attacker-favourable catch-up convention, not a deterministic network reorganisation. Say that the curves count reaching a tie as success under that simplifying assumption, and distinguish catching up from subsequently winning propagation/more-work competition. Keep the difference between the Poisson approximation and exact race calculation. Source: [Bitcoin paper §§5 and 11, including first-received tie handling](https://bitcoin.org/bitcoin.pdf).

<a id="topic-feedback-control"></a>

### 95. feedback-control — Narrow qualifications requested

**Current-state check:** Fresh audit of final topic.

Reviewed all 13 steps, plant equations, discrete PID, filtered derivative, saturation/anti-windup, delay and selected scenes. The conditional integral clamp allows unwinding when the error points away from saturation. Reproduced a throttle of 0.233026 to hold 80 km/h and a stable PI run converging to 25.000078 m/s for its 25 m/s target. Simplified drone/pendulum/arm dynamics are identified, and P/PI/PD/PID effects agree with the stated models. Source: [Åström and Murray, PID chapter](https://www.cds.caltech.edu/~murray/books/AM05/pdf/am08-pid_19Jul11.pdf).

- **FC-1 · Low · `src/routes/feedback-control/steps.ts:205`.** The note generalises the toy car’s throttle-only actuator to all cruise control. Adaptive cruise systems can command the brakes. Say “this model uses only the throttle,” or restrict the description to a conventional throttle-only system. No brake actuator needs to be added to the simulation. Source: [Bosch ACC description, including active brake control](https://www.bosch-mobility.com/en/solutions/assistance-systems/adaptive-cruise-control/).

<a id="topic-power-grid"></a>

### 96. power-grid — Corrections requested

**Current-state check:** Fresh audit of final topic.

Reviewed all 13 steps, swing/droop/secondary-control equations, UFLS settings, isolated-Spain dispatch assumptions, energy accounting and line-loss formulas. Reproduced −0.0714286 Hz/s initial RoCoF for a 3 GW loss at the default inertia, and −0.166667 Hz primary steady deviation. The Spanish game’s isolation and illustrative reserve are disclosed; the historical day was not independently downloaded/reconciled in full. The EU source does specify a Continental Europe 45% final UFLS level at 48 Hz, with implementation range, and at least six steps: this is not a finding of an invented 45% rule. Sources: [EU 2017/2196 Annex](https://eur-lex.europa.eu/eli/reg/2017/2196/2017-11-28/eng), [ENTSO-E FCR dimensioning](https://www.entsoe.eu/Documents/nc-tasks/SOGL/SOGL_A118.1_180808_CE%20SAOA%20part%20A_final_180914.pdf).

- **PG-1 · Medium · `src/routes/power-grid/steps.ts:358`.** The note says every grid holds primary reserve at least equal to its largest plant. Interconnected systems share frequency-containment reserve across a synchronous area, and individual control areas have allocated shares; they need not each procure an entire largest-unit loss as local FCR. Continental Europe’s 3 GW reference incident is an area-wide requirement. N−1 is a broader operational-security criterion, including network contingencies, not this universal national-reserve formula. Scope the illustrated 1 GW requirement to the explicitly islanded game and explain pooled FCR for the real interconnected case. Sources: [ENTSO-E synchronous-area dimensioning rule](https://www.entsoe.eu/Documents/nc-tasks/SOGL/SOGL_A118.1_180808_CE%20SAOA%20part%20A_final_180914.pdf), [ENTSO-E FCR allocation/exchange and core shares](https://www.entsoe.eu/network_codes/eb/fcr/).
- **PG-2 · Low · `src/routes/power-grid/steps.ts:387`; `src/routes/power-grid/grid.ts:507`.** The three-phase active-power equation silently assumes balanced sinusoidal operation at **unity power factor**. Generally P = √3 V_line I_line cosφ; √3VI is apparent power. State the unity-power-factor assumption beside the formula and the 1,443 A example. At 0.8 power factor, the same 1 GW/400 kV requires about 1,804 A and 1.5625 times the resistive loss for the same line. The existing simple line model can remain. Source: [Schneider Electric’s Electrical Installation Guide, active/reactive/apparent power equations](https://www.electrical-installation.org/enwiki/Definition_of_reactive_power).

<a id="topic-flight"></a>

### 97. flight — No active material finding

**Current-state check:** Fresh audit of final topic.

Reviewed all 13 steps, Joukowski/Kutta potential flow, lift/pressure conventions, measured NACA0012 comparison and Cessna/standard-atmosphere model. The equal-transit story is correctly rejected. Two-dimensional momentum/pressure accounting, finite-span lift reduction, stall’s absence from inviscid flow and the windmilling-propeller drag polar are explicitly limited. Reproduced CL,max = 1.54104, density 0.904773 kg/m³ at 10,000 ft, true stall speed 61.6700 kt there, and fitted glide ratio 9.05341. No material factual error found within these disclosed assumptions. Sources: [NASA Ladson NACA0012 wind-tunnel report](https://ntrs.nasa.gov/citations/19880019495), [NASA lift-equation reference](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/). The complete handbook transcription and rendered pressure/streamline pictures were not independently certified; the stated climb balance assumes steady flight and thrust along the path.

<a id="topic-nuclear-fusion"></a>

### 98. nuclear-fusion — Narrow qualifications requested

**Current-state check:** Fresh audit of final topic.

Reviewed all 11 steps, mass-energy and momentum partition, Bosch–Hale reactivity, radiative/confinement power balance, ignition curve and gain denominators. Reproduced D–T Q-value 17.5893 MeV, steady Q = 2.37924 at 10 keV/10²⁰ m⁻³/1 s, and minimum ignition triple product 2.93246 × 10²¹ keV s m⁻³ at 14.2404 keV. The zero-dimensional fixed-confinement approximation, parameterisation domain and wall-plug/target gain distinction are disclosed. JET’s 2023 pulse and NIF’s April 2025 8.6 MJ result are historical measurements; ITER 2039 is a stated schedule goal, not an achieved result. Sources: [LLNL 2025 NIF results and energy denominator](https://str.llnl.gov/str-julyaugust-2025/future-ignition), [ITER 2024 research baseline](https://www.iter.org/sites/default/files/media/2024-04/itr-24-004-baseline-ok.pdf).

- **FUS-1 · Low · `src/routes/nuclear-fusion/steps.ts:227`.** The sentence defines NIF ignition as target gain above one. Target energy breakeven and physical ignition are distinct: alpha self-heating can exceed losses and propagate a burn in a transient implosion even when fusion yield is below incident laser energy. LLNL reports that the August 2021 shot met the Lawson ignition criterion at roughly 1.35 MJ, before the December 2022 target-gain milestone. Say NIF achieved a transient self-heating burn and subsequently target gain above one; the contrast with steady magnetic-confinement operation and poor wall-plug gain can remain. Sources: [LLNL account of the 2021 Lawson-criterion result](https://www.llnl.gov/article/48866/GET), [LLNL explanation of self-heating exceeding losses](https://lasers.llnl.gov/news/hurricane-outlines-steps-nifs-fusion-milestone).

<a id="topic-nuclear-fission"></a>

### 99. nuclear-fission — Corrections requested

**Current-state check:** Fresh audit of final topic.

Reviewed all 12 steps, AME mass/binding-energy accounting, stochastic branching, four-factor lattice model, six-group point kinetics and decay-heat approximation. Reproduced design k ≈ 1, 55.1159 s asymptotic period for k = 1.001, 3.12031 kg/day fissile consumption at 3 GW, and the specified Way–Wigner 6.023%/1.013%/0.444% heat fractions at 1 s/1 h/1 day. A teaching approximation to prompt critical k ≈ 1+β is acceptable at this precision; exactly, ρ = β gives k = 1/(1−β). Rod motion, omitted thermal feedback and the decay-heat curve’s limits must remain distinguished from a reactor design calculation.

- **NFI-1 · Medium · `src/routes/nuclear-fission/steps.ts:292`; `src/routes/nuclear-fission/model.ts:468,480`.** The operating slider’s total worth below β is presented as a limit obeyed by real control rods. Real shutdown banks can have many dollars of negative worth, and unsafe withdrawals/ejections are analysed precisely because large positive reactivity can be inserted. NRC’s documented example has total rod worth 7%, much greater than β ≈ 0.65%; the page itself uses a −0.06 scram separately from its 0.006 operating-bank slider. Call the slider a deliberately restricted regulating-bank range and distinguish withdrawal-rate/interlock/operating limits from total shutdown worth. Source: [NRC Issue 185, explicit rod-worth and shutdown-margin example](https://www.nrc.gov/sr0933/section-3-new-generic-issues/issue-185-control-recriticality-following-small-break-loca-pwrs).
- **NFI-2 · Medium · `src/routes/nuclear-fission/steps.ts:262,263,265`.** Cooling with water does not by itself imply a negative coolant-void effect or that loss of coolant removes the moderator. CANDU uses separate heavy-water coolant and moderator and has a positive coolant-void coefficient; graphite-moderated, water-cooled RBMK is another counterexample, already mentioned in the note. Restrict the main explanation to the under-moderated light-water/PWR lattice actually modeled, and distinguish losing coolant from losing all moderator. Keep the decay-heat warning. Source: [Canadian regulator’s CANDU positive-void explanation](https://www.cnsc-ccsn.gc.ca/eng/nuclear-safety-security/science-research-health/scientific-technical-information/safety-analysis/positive-void-coefficient-of-reactivity-candus/).
- **NFI-3 · Low · `src/routes/nuclear-fission/steps.ts:149`.** The split is said always to give one light and one heavy fragment. Asymmetric splits dominate thermal U-235 fission, but symmetric/near-symmetric yields are nonzero; the selected example pairs do not establish a universal exclusion. Use “usually one lighter and one heavier.” Source: [IAEA fission-yield evaluation, symmetric component and measured yields, §4.2 and §5.1](https://www-pub.iaea.org/MTCD/Publications/PDF/te_1168_prn.pdf).

<a id="topic-crispr"></a>

### 100. crispr — No active material finding

**Current-state check:** Fresh audit of final topic.

Reviewed all 12 steps, spacer acquisition/inheritance, RNA/PAM/seed matching, self-target prevention, mutation rules and bacterial/phage population model. The page distinguishes S. thermophilus experimental evidence from the S. pyogenes NGG PAM used by the teaching sequence; it discloses tracrRNA omission, invented sequences, binary mismatch rules and illustrative population rates. Reproduced the target’s three PAM checks (mismatch, mismatch, cut), no self-target with PAM checking, and a self-target when that check is disabled. No material factual error found in this scope. Sources: [Barrangou et al., spacer addition/removal and acquired resistance](https://pubmed.ncbi.nlm.nih.gov/17379808/), [Deveau et al., phage target/PAM escape mutations](https://pmc.ncbi.nlm.nih.gov/articles/PMC2238228/), [Paez-Espino et al., CRISPR-driven phage evolution](https://pmc.ncbi.nlm.nih.gov/articles/PMC4453577/). The six-site population model does not independently establish quantitative real-culture extinction times, and these are explicitly described as illustrative.

## Reproduction evidence and validation limits

The following **fresh probes ran on the current source in this final pass**, with Node v26.11.1. They were pure in-memory imports and calculations. An import resolver supplied `.ts` for extensionless relative imports without editing source. No build, repository test suite or browser session was run.

| Current-code probe | Observed result | Interpretation |
|---|---|---|
| Homeostasis, production 0; doses 0/8/16 | Liver output min = max = 0.6 mg/dL/min in every run | HM-2 persists; no modeled insulin suppression in the anatomical liver term |
| Homeostasis, production 0; exercise intensity 0/65 | Glucagon min = max = 1 in both runs | HM-1 persists; exercise glucagon removed by production multiplier |
| Convolution: left-edge impulse, shift left | filter(shift(input)) = 0; shift(filter(input)) = 0.11111111194 at the edge | CV-1 finite-boundary counterexample |
| Voltage-driven motor, 3 V, full turn after settling, 2,000 uniform angular samples | Mean 0.0735106 N·m; peak 0.106276; ratio 0.691695 vs 2/π = 0.636620 | MG-1 constant-current ratio does not describe this trace |
| Same motor rotating state, voltage changed to zero | Current −0.245411 A; torque −0.0460306 N·m | Regenerative torque is possible in the shipped model |
| Neuron, resting gates, blocker k = 1 versus 0.1 | Both gK = 0.366644 mS/cm²; simple 90% block would be 0.036664 | NEU-1 fixed compensating conductance |
| GPS, one overhead + three horizon satellites 120° apart | GDOP 1.732051; PDOP 1.632993; HDOP = VDOP = 1.154701; TDOP 0.577350 | Distinguishes clock-inclusive and spatial error metrics |
| GPS satellite clock at radius 26,560 km | Gravity +45.787416, speed −7.213601, net +38.573815 µs/day | Relativistic arithmetic reproduces |
| Otto, compression 10, 300 K to 2,500 K | η = 0.601892829; work 493.099118 J; heat in 819.247371 J | Ideal constant-γ cycle bookkeeping |
| Rankine at 873.15/319.15 K; combined cycle 0.41/0.36 | η = 0.430051184; combined η = 0.6224 | Ideal steam-table/interpolation and cascade arithmetic |
| Ideal silicon, Eg = 1.12 eV | Jsc 43.810798 mA/cm²; Voc 0.876596 V; Vmp 0.787440 V; η = 0.333893995 | Detailed-balance model reproduction |
| Solar-cell optimum | Eg ≈ 1.34 eV; η = 0.336791322 | Stated one-sun ideal limit within discretisation |
| 30% attacker, 24 confirmations | Nakamoto 0.000810650; exact race 0.004000671 | Catch-up probability model; neither is a measured reorganisation rate |
| Same attacker, 32 confirmations | Exact race 0.000875915 | Stated sub-0.1% threshold within the assumed race |
| Cruise control, flat road | Throttle 0.233026 at 80 km/h; PI final 25.000078 m/s for 25 m/s target | Stated simplified plant and controller |
| Default 3 GW grid loss | Kinetic energy 1,050,000 MW·s; RoCoF −0.0714286 Hz/s; primary deviation −0.166667 Hz | Swing/droop arithmetic |
| Line, 1 GW over 100 km | 400 kV: 1,443.38 A, 11.75 MW loss; 100 kV: 5,773.50 A, 188 MW loss | Unity-power-factor inverse-voltage/I²R scaling |
| Cessna/standard atmosphere | CL,max 1.541035; 10,000 ft density 0.904773 kg/m³; true stall 61.6700 kt; glide ratio 9.053412 | Quoted airframe model arithmetic |
| D–T plasma at 10 keV, 10²⁰ m⁻³, 1 s | Fusion 800,461.7 W/m³; heating 336,436.6 W/m³; Q 2.379235 | Zero-dimensional power balance |
| D–T ignition | Minimum triple product 2.932461 × 10²¹ at 14.240449 keV; brems floor 4.291246 keV | Fixed-confinement model, not reactor feasibility proof |
| Fission design and kinetics | k = 0.9999999999999999; period 55.115870 s at k = 1.001; β = 0.006502; slider worth 0.006 versus scram −0.06 | Internal model, and operating/shutdown-worth distinction |
| Fission at 3 GW | 3.120312 kg/day; decay fractions 0.0602323 / 0.0101252 / 0.00443786 at 1 s/1 h/1 day | Specified approximate decay curve, not ANS-5.1 compliance |
| CRISPR scan/self-target | PAM stops: mismatch after 1 letter, after 4 letters, then 20-letter cut; self targets 0 with PAM, 1 without | Invented sequence/matching demonstration |

Representative reproducible probes, from the repository root, without source writes:

```sh
node --input-type=module <<'JS'
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) {
  try { return next(s, c); }
  catch (e) {
    if (s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(s + '.ts', c);
    throw e;
  }
}});
const { simulate, basalFor } = await import('./src/routes/homeostasis/model.ts');
for (const dose of [0, 8, 16]) {
  const s = simulate({production: 0, basal: basalFor(100), carbs: 75, dose, doseAt: -15});
  console.log('liver', dose, Math.min(...s.map(x => x.liver)), Math.max(...s.map(x => x.liver)));
}
for (const intensity of [0, 65]) {
  const s = simulate({production: 0, basal: basalFor(100), carbs: 0, intensity, runAt: 0});
  console.log('glucagon', intensity, Math.min(...s.map(x => x.gcg)), Math.max(...s.map(x => x.gcg)));
}
const n = await import('./src/routes/neurons/hh.ts');
console.log('resting K', n.currents(n.REST, n.RESTING).gK,
  n.currents(n.REST, n.RESTING, {k: 0.1}).gK);
const g = await import('./src/routes/gps/model.ts');
const d = g.dop([{elevation: 90, azimuth: 0},
  ...[0,120,240].map(azimuth => ({elevation: 0, azimuth}))]);
console.log('DOP', d.gdop, d.pdop, d.hdop, d.vdop, d.tdop);
const f = await import('./src/routes/nuclear-fission/model.ts');
console.log('period', 1 / f.inhour(f.reactivity(1.001)));
JS
```

EP-1/EP-2, OR-1, LT-1 and GD-1 also have direct analytical counterexamples/derivations in their findings. A failed retrieval or interrupted exploratory comparison is not treated as evidence. No monetary/token-cost estimate is inferred from elapsed time.

Coverage limits: no retraining or independent recovery of all GPT-2/GloVe/MNIST/diffusion exports; no full PDB/AlphaFold, SPARC/Gaia/MIST, nuclear-data or historical-day reconstruction; no RF, aerodynamic, reactor, clinical or biological experiment; no proof of rendering fidelity. Selected numerical examples and source attributions received focused checks. Mutable efficiency charts, schedules, observational catalogues and atmospheric numbers should retain measurement/revision dates. A complete licence/attribution review is outside this factual audit.

## Suggested implementer response

Resolve HM-1/HM-2 first, then the Medium findings, especially cancer mechanisms, consensus safety rules and reactor-control scope. Keep each ID with the correction or a source-backed rebuttal. For a deliberately narrow model, put its condition beside the claim and distinguish measured quantities, fitted calibration and illustrative rates. Reproduce affected control cases when changing numerical behavior; a test merely restating the chosen calibration does not validate it scientifically.

The five resolved items need no repeat correction. CP-1 needs only the remaining protein-biosynthesis explanation. AW-2 needs an original-paper passage or removal of its precise historical attribution; it should not be represented as a confirmed scientific error. Low findings can be handled in an editorial pass. This audit authorises no implementation changes by itself.

## Snapshot and audit footprint

- Final inspected HEAD: `7411257ad42ef99b1037486e7287f45091299a61`. Initial HEAD was `caea89b9aed40da790dc8c71aaaab6777ee53102`; the intervening commit added only `docs/DATA-SOURCES.md`.
- Final working-tree source capture: **2026-10-15 08:32:20 UTC**. This includes the concurrent attribution-only edits listed below; later edits are outside this snapshot.
- Built-topic route fingerprint: SHA-256 `fd6c871729e07c99cc29734fa995966d455ea20a76829dca40f88f7f9271bb4a` over 1,133 sorted files, hashing each repository-relative path, NUL, file bytes, NUL. Registry: `src/lib/topics.ts`.
- Historical report SHA-256 values, preserved:
  - `docs/codex-fact-check-2026-10-15.md`: `0e484d74710ac2e957e09ee849907379750ea7aff43c0675e64a870d1eae5867`.
  - `docs/codex-fact-check-2026-10-13.md`: `1265ae70a86e8886a4dbcc3ad16e6bf1315e58821a59ba9597649fd8c4ffbfd5`.
  - Neither earlier report was kept in the repository; this complete report supersedes them.
- Audit date: **2026-10-15, Europe/Madrid**. Only the requested complete report is newly written by this pass; the final source capture and preserved historical-report hashes were checked at completion. No commit or external message is made.

Concurrent working-tree paths present in the final source capture (changes belong to the other agent):

- `docs/DATA-SOURCES.md`
- `scripts/data/nuclear-fission/build-ame.mjs`
- `src/routes/carbon-cycle/steps.ts`
- `src/routes/deep-time/steps.ts`
- `src/routes/nuclear-fission/ame2020.ts`
- `src/routes/nuclear-fusion/binding.ts`
- `src/routes/nuclear-fusion/steps.ts`
- `src/routes/plate-tectonics/steps.ts`
- `src/routes/reaction-rates-equilibrium/steps.ts`
- `src/routes/redox-batteries/steps.ts`
- `src/routes/stars/steps.ts`
