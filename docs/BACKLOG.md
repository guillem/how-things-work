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
| Body & Medicine         | `epidemics`            | simulate   | 1     | No prerequisites, no data; first agent-based model and live plot      | in progress     |
| Mathematics             | `unit-circle`          | manipulate | 1     | No prerequisites; first draggable handle + linked graph; unlocks 3    | next            |
| Computing               | `sorting`              | step       | 1     | No prerequisites; first algorithm-stepping topic; unlocks Turing m.   |                 |
| Physics                 | `newtons-laws`         | simulate   | 1     | No prerequisites; unlocks 6 topics in Physics, Space and Energy       |                 |
| Space                   | `sun-earth-moon`       | manipulate | 1     | No prerequisites, no data                                             |                 |
| Information & Networks  | `pagerank`             | build      | 2     | The only topic in the category without prerequisites; first `build`   |                 |
| Artificial Intelligence | `learning-from-data`   | manipulate | 1     | No prerequisites; unlocks gradient descent and reinforcement learning |                 |
| Earth & Climate         | `atmosphere-weather`   | simulate   | 2     | The only topic in the category with neither prerequisites nor `Needs` |                 |
| Chemistry & Materials   | `atoms-periodic-table` | build      | 1     | The root of the category; needs element data (decide the source)      |                 |
| Energy & Machines       | `bridges-structures`   | build      | 1     | Every topic here has a prerequisite; this one needs only Newton       | after Newton    |

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

- Shared components still to create as their first topic needs them: draggable handles
  (`unit-circle`), an algorithm stepper / bar chart (`sorting`), a build palette (`pagerank` or
  `graph-search`), pan/zoom (`chaos-fractals`).
- Cards on the index have hand-drawn art only for topics that have a vignette in
  `src/lib/components/TopicArt.svelte`; give each new topic one.
- When a second explainer exists, consider a short "how to use the controls" note shared by all
  pages (keyboard shortcuts are behind `?`).
