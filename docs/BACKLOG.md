# Backlog

What to build next, and in what order. The list of topics itself lives in
[`TOPICS.md`](TOPICS.md) (the catalogue — content only, never edited except to tick the
checklist); this file is about **order and open work**. Where we are right now is in
[`STATUS.md`](STATUS.md); how long things took is in [`TIMELOG.md`](TIMELOG.md).

## Rules for picking the next topic

1. A topic is ready to build once all its prerequisites are built (catalogue rule).
2. **Wave 1: one topic per category first**, preferring topics with no prerequisites and no
   `Needs` (external data), so each category gets a first page and the shared components appear
   early. Within that, prefer topics that introduce a new interaction kind (`manipulate`,
   `simulate`, `step`, `build`, `explore`) — the first topic of each kind builds the shared
   components that later topics reuse.
3. After wave 1, build whatever has become ready, favouring topics that unlock many others.
4. A topic with a `Needs` field cannot start until the data source is chosen and documented;
   if it is not available, ask the user (catalogue rule: never invent data).

## Wave 1 — one topic per category

| Category                | Topic                  | Kind       | Level | Why this one                                                            | State |
| ----------------------- | ---------------------- | ---------- | ----- | ----------------------------------------------------------------------- | ----- |
| Biology                 | `photosynthesis`       | simulate   | 1     | Already built — the quality reference                                   | done  |
| Body & Medicine         | `epidemics`            | simulate   | 1     | No prerequisites, no data; first agent-based model and live plot        | done  |
| Mathematics             | `unit-circle`          | manipulate | 1     | No prerequisites; first draggable handle + linked graph; unlocks 3      | done  |
| Computing               | `sorting`              | step       | 1     | No prerequisites; first algorithm-stepping topic; unlocks Turing m.     | done  |
| Physics                 | `newtons-laws`         | simulate   | 1     | No prerequisites; unlocks 6 topics in Physics, Space and Energy         | done  |
| Space                   | `sun-earth-moon`       | manipulate | 1     | No prerequisites, no data                                               | done  |
| Information & Networks  | `pagerank`             | build      | 2     | The only topic in the category without prerequisites; first `build`     | done  |
| Artificial Intelligence | `learning-from-data`   | manipulate | 1     | No prerequisites; unlocks gradient descent and reinforcement learning   | done  |
| Earth & Climate         | `atmosphere-weather`   | simulate   | 2     | The only topic in the category with neither prerequisites nor `Needs`   | done  |
| Chemistry & Materials   | `atoms-periodic-table` | build      | 1     | The root of the category; element data from mendeleev (PubChem blocked) | done  |
| Energy & Machines       | `bridges-structures`   | build      | 1     | Every topic here has a prerequisite; this one needs only Newton         | done  |

Batch 2 also takes `electric-circuits` (unlocks 4) and `binary` (unlocks 7), per rule 3.

Batch 3 took `graph-search` and `chaos-fractals` (the first `explore` topic). Other candidates:
`ecosystems`, `electric-circuits` (unlocks 4 topics),
`binary` (unlocks 7 topics in Computing and Networks).

## Open after the backlog round (2026-10-17)

All 100 topics are built and ticked. The backlog round of 2026-10-17 (one agent per package in a
local worktree, merged into `main`) cleared almost everything that was open; what it did is in
`docs/STATUS.md` and the git log. Data licences are listed in [`DATA-SOURCES.md`](DATA-SOURCES.md).

**Still open (not decided, or waiting on someone else)**

- nuclear-fusion: the redrawn q = 3 field line on the confinement step still reads like stacked
  loops. The plasma is drawn as a flat band, not a tube, so a winding line has no surface to read
  against; it needs a real torus outline or a cross-section inset (a design decision; two
  attempts reverted).
- solar-cells: re-run `scripts/data/solar-cells/build-records.mjs` when NLR adds LONGi's newer
  records (re-checked 2026-10-17: the chart is still the 2026-08-14 one).
- photosynthesis: the pigment curves stay smooth Gaussian approximations; PhotochemCAD's measured
  spectra carry only a copyright notice (no permission to redistribute). Ask the authors, or find
  an openly licensed set.
- deep-time: PhanDA gives one temperature per stage, so the short windows show flat steps (a data
  limit; smoothing it would invent data).
- states-of-matter: the box is chaotic, so its frames differ between machines; water's density
  anomaly holds on average over starts, not in every run (the page uses seed 1).

**For the user to decide** (each is stated on its page, or invisible on stage)

- the-cell: small molecules (ATP in the crista, ions at the membrane) still count from the whole
  box; the protein crowds now count from the free space.
- evolution: the model keeps 20 million cells and 3 × 10⁻⁸ per division; Luria & Delbrück's
  experiment 16 had 5.6 × 10⁸ bacteria per culture and rates of about 1.1 × 10⁻⁸ (the page says so).
- crispr: the model's `added` strain still carries its 2972 spacer next to the leader, so it reads
  as immune to 2972, while Barrangou's Fig. 3 shows construct IV sensitive (the stage only plates
  858).
- vision-color: unique blue is the page's own 475 nm (`UNIQUE_BLUE`), which calibrates the new S
  input on the red–green channel; a sourced value is a one-constant change.
- atmosphere-weather: the model's fronts form rings around the low (outer ring warm to the north
  and west, cold to the east and south), not the textbook wave; the narrative never says where they
  sit.
- logic-gates: once the reader's full adder is packed into a block it can't be edited again
  without a reload (it is always correct by then).

**Known limitations, stated on their pages**

- chemical-bonds: the builder makes single-centre molecules only, with lone pairs drawn only on the
  centre atom.
- photosynthesis: every absorbed photon counts alike (no McCree blue penalty); the leaf's internal
  CO₂ is fixed at 70% of the air's (no stomata).

**Modelling choices, stated on their pages** (kept unless the user decides otherwise)

- acids-bases: Kw rounded to 1.0 × 10⁻¹⁴. rockets: the S-IVB carries its translunar reserve so
  the Saturn V reaches orbit with the F-1's real 304 s. exoplanets: 51 Peg b's revealed mass is a
  true mass from a 2026 inclination. neurons: Hodgkin & Katz concentrations (Nernst −89/+47 mV)
  next to Hodgkin & Huxley's measured −72/+55 mV. big-bang: Planck's H₀ everywhere (the Hubble
  tension in a note). stars: white dwarf < 8 M☉, neutron star to 22 M☉, black hole above.
  mrna-vaccines: the immune-system page's flu-in-mice parameters and one fitted dose parameter.
  feedback-control: a 0.5 s engine lag and a 0.2 s-old speed reading added to Åström & Murray's car.
  gravitational-waves: the leading-order chirp fit gives about 36 suns against the published 30.
  transistors-chipmaking: three of Rupp's unnamed points named by year and count.

**Process note**: the Anthropic API credit for `make review` ran out on 2026-10-15 (none until
November); the last ten fact-checks were done in-house by an agent that reviews with web search
and then applies the fixes.

## Next topics (after v1.0.0)

A level 0 and 100 new topics are proposed, not built: [`TOPICS-PROPOSAL.md`](TOPICS-PROPOSAL.md)
(how it was made: [`proposals/topics-200/README.md`](proposals/topics-200/README.md)). Waiting on
the user's review of its open questions (the level-0 definition, the 39 / 10 / 3 / 48 split and
the LLM ladder's second wave, the optional Everyday things category, the re-levelling footnote,
the Reserve dispositions, the water cycle). Nothing is built until the user promotes entries into
`TOPICS.md`; promoting the first level-0 entry also needs the parser change under "Index search
and filters" below (level 0 in `Level`, `levelNames` and the level check).

## Site and framework work

- **Index search and filters — done (2026-10-17).** Adding a reader level later (elementary,
  postgraduate...): add its row to the Levels table in `docs/TOPICS.md` (the user's call), then
  widen `Level` and `levelNames` in `src/lib/catalog-parse.ts` and the parser's level check; the
  index's Level filter and the cards pick it up from there. If levels stop being numbers that sort
  from easiest to hardest, the filter's ordering (numeric) needs a look too. With ~200 topics the
  Area chips take five rows on a phone; collapse them into a menu there if that feels heavy.

- **Stage text on phones — done in all 100 topics (2026-10-17).** On viewports ≤ 640 px a scene's
  `<Readout>`s leave the drawing and are listed in an HTML panel under the stage; the drawing keeps
  numbered badges or short labels, minor labels hide; wider screens render pixel-identically
  (`src/lib/explainer/Readout.svelte`, how-to in `docs/scene-guide.md`, "Phone readouts"). The
  tallest panels: photosynthesis' membrane, epidemics' crowd, the graph-search race and
  waves-interference's path-difference step (4 rows and 6 chips). The shared `<Axes>` adapts too:
  on phones its tick labels and titles render at ~10 px real size, labels that would collide are
  thinned (`spacedLabels` in `chart.ts`), and the x title shares the tick row; desktop is
  pixel-identical. Fourteen topics got per-topic fixes for it
  (margins, shorter titles, the three scenes that draw their own ticks). Left: deep-time's axis
  unit ("million years ago") stays hidden on phones, for lack of a second row.

- **Unused exports — mostly done (2026-10-17).** `knip.json` configures knip with the tests and
  scripts as entry points (`npx knip --include exports,types`). Exports only used inside their own
  file are now private. Left exported, for someone to delete with judgement: 61 symbols used nowhere
  (some are documented constants or helpers kept for a future step): big-bang/cosmology.ts: `redshiftOf`; carbon-cycle/data.ts: `FOSSIL_RESOURCES`; carbon-polymers/structures.ts: `structureMass`; chemical-bonds/model.ts: `fullShell`; consensus-blockchains/consensus.ts: `RaftRun`; cpu/cpu.ts: `MEANINGS`; cryptography/crypto.ts: `DIGESTS_LOG10`; dark-matter/galaxies.ts: `MILKY_WAY`, `haloDensity`, `massForSpeed`; deep-time/deeptime.ts: `ZoomId`; diffusion-models/ddpm.ts: `noiseGuess`, `signalLeft`; earthquakes/earth.ts: `MOHO_DEPTH`, `grazingCore`, `pathXY`; ecosystems/eco.ts: `webMatrix`, `webRates`; entropy/gas.ts: `positionWays`; feedback-control/control.ts: `roadHeight`; gravitational-waves/gw.ts: `LIGO_BASELINE`, `nearbyRedshift`, `orbitalSpeed`; greenhouse-effect/climate.ts: `T_SURFACE`, `mixedLayerWarming`; heart-circulation/scenes/heart.ts: `HEART_H`, `HEART_W`; heat-engines/steam.ts: `T_COND_MAX`, `T_COND_MIN`, `T_STEAM_MAX`, `T_STEAM_MIN`; homeostasis/model.ts: `basalUnitsPerDay`; immune-system/model.ts: `firstAbove`; language-models/steps.ts: `PromptId`; light-optics/optics.ts: `convexThickness`, `wavelengthIn`; light-optics/scenes/ui.ts: `mainPaths`; meiosis-inheritance/model.ts: `haldaneInverse`; motors-generators/machine.ts: `MAINS_HZ`; nuclear-fission/model.ts: `U235_FAST_FISSION`, `meanDelay`; nuclear-fusion/model.ts: `Q_FISSION_PROMPT`; oscillations-resonance/oscillator.ts: `phaseLag`; power-grid/grid.ts: `NUCLEAR_CAPACITY`, `VOLTAGES`, `dayKinetic`, `inverterShareAt`; protein-folding/hp.ts: `Residue`; protein-folding/structure.ts: `BAND_LABEL`; reaction-rates-equilibrium/look.ts: `fmtLapse`; reaction-rates-equilibrium/model.ts: `energyDensity`; reinforcement-learning/qlearning.ts: `worldRows`; semiconductors/model.ts: `NI_GE`; standard-model/scenes/shared.ts: `tokenColour`; stars/star.ts: `TRACK_MASSES`; states-of-matter/phase.ts: `toKelvin`; the-cell/frames.ts: `Branch`; the-cell/liver.ts: `RibosomeOnER`; transformers/attention.ts: `headName`; transistors-chipmaking/model.ts: `TOX_NM`, `vdsSat`. Generated data
  files and the shared `src/lib` types were not touched.
- ~~A short "how to use the controls" note shared by all pages~~ — done: the `?` keyboard
  shortcuts overlay in the explainer shell.
