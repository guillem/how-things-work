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

| Category                | Topic                  | Kind       | Level | Why this one                                                          | State           |
| ----------------------- | ---------------------- | ---------- | ----- | --------------------------------------------------------------------- | --------------- |
| Biology                 | `photosynthesis`       | simulate   | 1     | Already built — the quality reference                                 | published, gaps |
| Body & Medicine         | `epidemics`            | simulate   | 1     | No prerequisites, no data; first agent-based model and live plot      | done            |
| Mathematics             | `unit-circle`          | manipulate | 1     | No prerequisites; first draggable handle + linked graph; unlocks 3    | done            |
| Computing               | `sorting`              | step       | 1     | No prerequisites; first algorithm-stepping topic; unlocks Turing m.   | done            |
| Physics                 | `newtons-laws`         | simulate   | 1     | No prerequisites; unlocks 6 topics in Physics, Space and Energy       | done            |
| Space                   | `sun-earth-moon`       | manipulate | 1     | No prerequisites, no data                                             | done            |
| Information & Networks  | `pagerank`             | build      | 2     | The only topic in the category without prerequisites; first `build`   | done            |
| Artificial Intelligence | `learning-from-data`   | manipulate | 1     | No prerequisites; unlocks gradient descent and reinforcement learning | published, gaps |
| Earth & Climate         | `atmosphere-weather`   | simulate   | 2     | The only topic in the category with neither prerequisites nor `Needs` | built, gaps     |
| Chemistry & Materials   | `atoms-periodic-table` | build      | 1     | The root of the category; needs element data (decide the source)      |                 |
| Energy & Machines       | `bridges-structures`   | build      | 1     | Every topic here has a prerequisite; this one needs only Newton       | done            |

Batch 2 also takes `electric-circuits` (unlocks 4) and `binary` (unlocks 7), per rule 3.

Other wave-1 candidates kept in mind: `chaos-fractals` (first `explore`), `graph-search` (the
catalogue's suggested first `build`), `ecosystems`, `electric-circuits` (unlocks 4 topics),
`binary` (unlocks 7 topics in Computing and Networks).

## Known gaps in built topics

- **photosynthesis** — published before the catalogue existed and not ticked in the checklist.
  Against its entry it still lacks: **CO₂ level and temperature controls** and a readout or plot
  of the **rate of sugar and oxygen production** responding to intensity, colour, CO₂ and
  temperature (limiting factors). Light intensity and colour exist on separate steps. The links
  to prerequisites, related topics and dependents now come from the shared page shell. To finish
  it: add a "limiting factors" step (a rate model checked against a reference), then tick it.

- **learning-from-data** — built and reviewed but **not ticked**: the catalogue entry says
  "Place and drag points", and readers can only drag the 21 generated points, not add new ones.
  Adding click-to-add needs a design decision (it changes the 21/7 training/test wording and the
  sync with the error-curve scene, which averages 40 generated sets). Also: move the duplicated
  `params.pts` parser from both scenes into `fit.ts`.

- **atmosphere-weather** — built and reviewed, **not ticked**: fronts form from the placed lows
  rather than being placed, and the reader sets heat transport and spin rather than the heating
  pattern (open question in STATUS). Smaller: sharp temperature boundaries along the wind get no
  front symbol (no stationary fronts); the Cells globe keeps Earth's temperatures at every spin;
  at spin 0.4 the Coriolis loops overflow their panels; the Held–Hou height is tuned (15 km).

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

## Site and framework work

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
