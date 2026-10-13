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

## Known gaps in built topics

- **photosynthesis** — ticked 2026-10-11, after the fact-check review and the rate model
  ("What limits the rate?": PROSPECT-D leaf optics + FvCB, `src/routes/photosynthesis/model.ts`).
  Smaller, left as is: the three pigment curves of the spectrum scene are smooth Gaussian
  approximations of solvent spectra (`absorbance()` in `palette.ts`, labelled relative); measured
  spectra (e.g. PhotochemCAD, chlorophyll a/b in diethyl ether) would be better. The model treats
  every absorbed photon alike (McCree's lower yield for blue is not modelled) and fixes the
  leaf's internal CO₂ at 70% of the air's (no stomata); both are stated on the page.

- **learning-from-data** — ticked: the user accepted dragging only (2026-10-08).

- **oscillations-resonance** — catalogue extras from the fact-check (2026-10-13), not built: a
  stiffness control on the resonance-curve step (the driven spring is fixed at 1 kg on 39 N/m, so
  the peak never moves; reading it there alone would leave the push step on a hidden value), and
  dots at each push frequency tried, at the simulated steady swing, so the reader builds the curve.

- **atmosphere-weather** — ticked: the user accepted that fronts form from the placed lows and
  that the reader sets heat transport and spin rather than the heating pattern (2026-10-08).

- **chemical-bonds** (batch 7) — the builder makes single-centre molecules only, with lone pairs
  drawn only on the centre atom (the text says so); the slow auto-turn pauses while the pointer
  is over the molecule or an atom. In NH₃'s still frame the angle arc joins two H atoms that
  nearly overlap on screen, so it is small and faint.

- **states-of-matter** (batch 9) — the box is chaotic, so its frames differ between machines
  (V8 version, CPU). Water's density anomaly holds on average over starts (~6–7% more room for
  ice) but not in every single run: seed 2 locally shows ice slightly denser. The page uses seed 1
  (3.5–12% more room depending on the machine). Water's freezing is a scripted lattice shortcut.

- **photosynthesis** — at light 0 on `#water` two captions say the same thing on one line (the
  lumen caption and "no light: electron flow stops…"); they may touch at 13 px. On `#summary`
  both light captions stay in the accessibility tree at every light level (only their opacity
  changes).

- **central-limit-theorem** — on small Galton boards (2–10 rows) a falling ball lands at the bin's
  centre, then snaps sideways to its slot in the level; balls on that level re-centre as it fills.

- **atmosphere-weather** — the cold/warm/stationary front classification lives in `MapScene`
  and has no test; moving it into `atmosphere.ts` would allow a model test.

- **waves-interference** — if a step change unmounts a `Handle` mid-drag its end callback never
  fires (Doppler keeps `dragX`; the tank keeps its pre-warm off for that mount).

- **e2e** — `scenes.e2e.ts` gives orbits-kepler `#two` 15 s for its first render (9068ee7); the
  step's model takes ~12 ms, so the cause of the slow load under the parallel run is unknown.

(The gap round of 2026-10-12/13 cleared the rest of this list: chaos-fractals `period(r)`,
orbits-kepler labels and the `#two` flake, ecosystems' static web opening and y-axes,
oscillations-resonance's pendulum label, logic-gates, central-limit-theorem, binary's signed
sliders, electric-circuits' node count, pagerank's note, graph-search, waves-interference's
placeable/draggable sources and frame cache, radioactivity, linear-transformations,
fourier-transform, bridges-structures' reactions and `addMember`, atmosphere-weather's stationary
fronts and Coriolis panels, learning-from-data's parser, the sun-earth-moon tilt mismatch, the
photosynthesis `#summary` captions (fading by design, now tested), and the weak entropy/sorting
tests.)

(A review of that round on 2026-10-13 fixed what it got wrong: the chemical-bonds angle arc,
which never drew, and its hover pause, which released over atoms; the fourier-transform
`#spectrum` readout drawn over the title and the draw-wave scale that moved with the slider; the
pendulum label, still crossed at 56–90°; the Doppler source that jumped to mid-stage on release
and stopped on a tap; tank sources pushed out by the spacing slider; the tank pre-warm's cost;
radioactivity's raw half-life and lost quarter mark; ecosystems' fractional ticks and half-empty
chart; the linear-transformations drag offset; `period(r)` near the splits; the orbits-kepler
label search; right-clicks leaving handles held; and a logic-gates test that guarded nothing.)

## Site and framework work

- **Promote `sorting/playback.ts`** to `src/lib`: `cpu` imports it across routes for its replay.
- **`Label`'s `size` has no effect** (found by cryptography, 2026-10-12): the stage CSS fixes all
  stage text at 13 px, so topics roll their own text helpers (`Txt`, `T`).
- **Promote `VectorHandle`** (linear-transformations' `scenes/VectorHandle.svelte`, copied from
  complex-numbers' `PointHandle`) into `src/lib/draw`: a 2D draggable point with arrow keys on both
  axes; the shared `Handle` only has one-dimensional keys.

- **Stage text on phones — decided 2026-10-13: option B, readouts out of the SVG.** At 390 px
  wide the 960-unit stage is drawn at ~0.37 scale, so 13-unit labels end up ~5 px. Two prototypes
  were tried (branch `worktree-agent-a4adc057170ea9048`, local only: `?phone=b` / `?phone=c`
  flags); the user rejected landscape and chose B over C (zoomable stage). B: on screens ≤ 640 px
  a scene's readouts and captions move into an HTML panel under the stage (14–16 px), the drawing
  keeps short labels or numbered badges, minor labels hide. Mechanism: `<Readout id label value
note color marker at opacity>` (`src/lib/explainer/Readout.svelte`) plus the panel in the
  explainer shell; desktop renders pixel-identically. Applied so far to photosynthesis's membrane
  scene and epidemics' SIR scene. Rollout plan: land the B mechanism without the flag (drop C,
  `zoom.svelte.ts` and `e2e/phone-prototypes.e2e.ts`), then convert scenes topic by topic (149
  scenes, ~720 text elements; each needs editorial choices: what moves, what becomes a badge, what
  hides), plus axis ticks in the shared chart helpers. Watch the reading room: the panel made the
  pinned card ~200 px taller on the two prototypes — keep each step's panel short.

- **Stage text styling overrides SVG attributes (site-wide, found 2026-10-07).** In
  `src/lib/explainer/Explainer.svelte`, `.stage :global(text) { font-family; fill; font-size: 13px }`
  beats presentation attributes, so every `font-size=`/`fill=` on `<text>` (including `<Axes>` tick
  labels at 11 px and `<Label size>`) renders at 13 px in ink. Photosynthesis was polished under
  this behaviour, so the fix (move the three declarations to `.stage :global(svg)` so they
  inherit) changes every scene's look and needs its own branch with a full screenshot re-review of
  both topics. Until then: `<Label color>` works (it sets `style:fill`), and the epidemics
  threshold/SIR scenes use local snippets with `style:font-size`/`style:fill`; switch them back to
  `<Label>` after the fix.

- Shared components still to create as their first topic needs them: an algorithm stepper / bar chart (`sorting`), a build palette (`pagerank` or
  `graph-search`), pan/zoom (`chaos-fractals`).
- `rng` (mulberry32) now lives in `src/lib/draw/math.ts`; epidemics, sorting,
  learning-from-data and compression still carry their own copies — switch them over.
- Cards on the index have hand-drawn art only for topics that have a vignette in
  `src/lib/components/TopicArt.svelte` (45 of the 46 built topics do); give each new topic one.
- ~~A short "how to use the controls" note shared by all pages~~ — done: the `?` keyboard
  shortcuts overlay in the explainer shell.
