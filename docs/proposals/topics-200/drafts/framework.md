Nothing below is done in this proposal; it is what adopting it would touch, so the first level-0
and level-3 builds can be planned.

- **Catalogue (`docs/TOPICS.md`).** The Levels table gets the level-0 row; the category table's
  counts change; each promoted entry is copied in under its category, its slug added to the
  checklist, and the links under "Links to add to existing entries" applied. The invariants test
  (`e2e/catalog.e2e.ts`) then checks the result, once the parser accepts level 0.
- **Parser (`src/lib/catalog-parse.ts`).** `Level` becomes `0 | 1 | 2 | 3`, `levelNames` gets
  the level-0 reader, and the parser's level check accepts 0. BACKLOG already notes this as the
  one change a new level needs; the index's Level filter and the cards pick it up from there
  (the filter sorts levels numerically, so 0 lands first).
- **Index.** With 200 topics the Area chips take five rows on a phone (BACKLOG); a menu there may
  be worth it. A "Start here" entry point for level 0 on the index is a small addition: the Level
  filter already does it with `?level=0`.
- **Explainer shell and scene guide.** A level-0 page is the same `ExplainerSpec`, shorter and
  with one control per step; `docs/scene-guide.md` gets a short "level-0 pages" section (no
  formula labels on stage, a single large control, readouts as comparisons). No framework change
  is needed to build the first one; build it and extract what repeats.
- **Level 3 pages.** Several entries ship a small dataset or a tiny trained model (the way
  diffusion-models ships MNIST). Each `Needs` names its source and licence; when built, the
  source goes into `docs/DATA-SOURCES.md`, as today. Entries whose data is not openly licensed
  were rejected during review, so none below should need an unanswered permission.
- **Docs.** README, STATUS and the dashboard say "100 explainers"; they change when the first new
  topic lands, not now.
