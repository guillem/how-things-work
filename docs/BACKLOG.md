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

- **learning-from-data** — ticked: the user accepted dragging only (2026-10-08). Still to do:
  move the duplicated `params.pts` parser from both scenes into `fit.ts`.

- **atmosphere-weather** — ticked: the user accepted that fronts form from the placed lows and
  that the reader sets heat transport and spin rather than the heating pattern (2026-10-08).
  Smaller: sharp temperature boundaries along the wind get no front symbol (no stationary
  fronts); the Cells globe keeps Earth's temperatures at every spin; at spin 0.4 the Coriolis
  loops overflow their panels; the Held–Hou height is tuned (15 km).

- **bridges-structures** — beam and truss steps show no support reactions (arch and suspension
  do): add reaction arrows so "loads to the ground" shows on every design. In the arch the posts
  carry little axial force (the continuous deck spans between banks): check against a deck-arch
  reference. A cable from a post on the sliding bearing goes slack (the text now says "on the
  bank"). `addMember` doesn't split a member at a joint it passes through (the build scene does).

- **pagerank** — letter shortcuts (r, j, k…) still reach the explainer while a page is focused;
  with 9–10 pages E's starting rank drops (more pages share the jumps), not mentioned.

- **electric-circuits** — a board full of wires reaches ~520 SVG nodes (one focusable shape per
  gap instead of a group would save ~60).

- **binary** — on the overflow step, the sliders show 0–255 even in the signed view.

- **graph-search** — Dijkstra's cost numbers are 10 px (small on screen); the race maps are
  small (three panels across); on the estimate step the dotted cheapest route runs under the
  found route for two squares.

- **chaos-fractals** — `period(r)` in `chaos.ts` is unreliable right at the splitting points
  (the scene works around it with `DOUBLINGS` and the Lyapunov exponent): make it robust.
  Corner radii differ between the three scenes.

- **orbits-kepler** — on `second` at low speed the wedge labels crowd near aphelion; small
  label overlaps ("Sun (a focus)", orbit lines over "Sun" at 30 Jupiters).

- **ecosystems** — the web step's starting frame is static until the reader switches a species
  off; the cycles chart's two y-axes have unaligned gridlines.

- **oscillations-resonance** — the "10°" label in the pendulum scene is crossed by the rod on
  left swings.

- **logic-gates** — the switches' "0" has low contrast; a challenge message lingers briefly after
  switching challenge.

- **central-limit-theorem** — at 2 rows the landed balls are thin columns in wide bins. The `clt`
  step sets n to 30 on arrival when it is 1 (a scene-side default; a per-step control would be
  cleaner).

- **chemical-bonds** (batch 7) — the builder makes single-centre molecules only, with lone pairs
  drawn only on the centre atom (the text says so); the angle arc looks odd when a bond is seen
  nearly edge-on; in CO₂ the centre's δ+ label sits close to a bond line; the slow auto-turn makes
  clicking an atom fiddly (it pauses on hover).

- **waves-interference** (batch 7) — sources can only be dragged vertically (spacing), not placed
  anywhere in the tank; "move a source" is a speed slider, not a drag. On a slow machine the ripple
  tank's first period paints before its frame cache fills.

- **radioactivity** (batch 7) — control changes snap rather than ease; at a 2 s half-life the
  plot's half-life marks crowd together.

- **linear-transformations** (batch 7) — the F is clipped in the reduced-motion `compose` frame;
  with the zero matrix both handles overlap at the origin (only ĵ can be grabbed); near a flat
  matrix the moved grid becomes a dense hatch (denser since the review raised the line cap so the
  grid always fills the plane).

- **fourier-transform** (batch 7) — `#square` and `#spectrum` are mostly static frames; extreme
  bar edits can clip the rebuilt signal at the top of the graph; a 0 Hz bar below −0.75 is drawn
  cut off (its label is right); the circle-size chart shows k = −20…20 only.

- **e2e flake** — `scenes.e2e.ts` › orbits-kepler › `#two` occasionally fails under the full
  parallel run (passes alone and on rerun): the step's page load sometimes exceeds the 5 s
  expectation. Give that test more time or lighten the step's first render.

- **Suspected bugs found while adding characterization tests (2026-10-11; recorded, not fixed):**
  - **404 page at a nested URL** (confirmed on the live site). At
    `/how-things-work/no/such/page/` the 404 page loads its CSS and JS from `./_app/…`, which
    resolves under the missing path (404), so it shows unstyled. Its "Back to all explainers" link
    (`./`) points at the same missing URL. One level down (`/how-things-work/nope`) works.
    Pinned by the nested-URL test in `e2e/site.e2e.ts`; update that test when this is fixed
    (likely: absolute paths on the 404 page, `paths.relative: false`).
  - **sun-earth-moon `#tilt`.** The June-solstice label says "14 h 51 min of daylight" and the
    chart footer says "14 h 50 min" for the same day. Probably rounding, or two slightly different
    days.
  - **photosynthesis `#summary`.** The light slider changes no text on the stage: both captions
    ("no light → … stalls" and "bright light: … set the pace") are always shown. Possibly only
    visual by design.
  - **photosynthesis `#water` with no light.** The lumen reads "pH ≈ 8.0", the same as the stroma,
    while "about 1000× more acidic than the stroma in bright light" stays on screen. Probably
    intended ("in bright light").
  - **Weak tests worth strengthening.** `entropy` "reversing every velocity…" accepts "every
    velocity reversed", which shows the moment you click, so the return to the start is never
    checked. `sorting` "pausing after stepping…" passes even if playback never moved.

## Site and framework work

- **Promote `sorting/playback.ts`** to `src/lib`: `cpu` imports it across routes for its replay.
- **`Label`'s `size` has no effect** (found by cryptography, 2026-10-12): the stage CSS fixes all
  stage text at 13 px, so topics roll their own text helpers (`Txt`, `T`).
- **Promote `VectorHandle`** (linear-transformations' `scenes/VectorHandle.svelte`, copied from
  complex-numbers' `PointHandle`) into `src/lib/draw`: a 2D draggable point with arrow keys on both
  axes; the shared `Handle` only has one-dimensional keys.

- **Stage text is unreadable on phones (site-wide, found 2026-10-07).** At 390 px wide the
  960-unit stage is drawn at ~0.37 scale, so 11–13 px labels end up ~4–5 px. Needs a design
  decision (a narrow-screen layout per scene, a larger minimum text size, or steering readers to
  full screen / landscape). Affects photosynthesis and epidemics alike.

- **Stage text styling overrides SVG attributes (site-wide, found 2026-10-07).** In
  `src/lib/explainer/Explainer.svelte`, `.stage :global(text) { font-family; fill; font-size: 13px }`
  beats presentation attributes, so every `font-size=`/`fill=` on `<text>` (including `<Axes>` tick
  labels at 11 px and `<Label size>`) renders at 13 px in ink. Photosynthesis was polished under
  this behaviour, so the fix (move the three declarations to `.stage :global(svg)` so they
  inherit) changes every scene's look and needs its own branch with a full screenshot re-review of
  both topics. Until then: `<Label color>` works (it sets `style:fill`), and the epidemics
  threshold/SIR scenes use local snippets with `style:font-size`/`style:fill`; switch them back to
  `<Label>` after the fix.

- **Snap and the slider (unit-circle):** with "snap to special angles" on, the angle slider can
  still set a non-special angle (only the handle and keys snap). Fix in the framework: let a
  control declare allowed values, or round a range while a toggle is on.
- Shared components still to create as their first topic needs them: an algorithm stepper / bar chart (`sorting`), a build palette (`pagerank` or
  `graph-search`), pan/zoom (`chaos-fractals`).
- `rng` (mulberry32) now lives in `src/lib/draw/math.ts`; epidemics, sorting and
  learning-from-data still carry their own copies — switch them over.
- Cards on the index have hand-drawn art only for topics that have a vignette in
  `src/lib/components/TopicArt.svelte`; give each new topic one.
- When a second explainer exists, consider a short "how to use the controls" note shared by all
  pages (keyboard shortcuts are behind `?`).
