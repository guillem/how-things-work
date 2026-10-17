<!-- CATEGORIES -->

Every topic below is filed under one of the existing eleven categories, so the index, the
category table and the checklist keep their shape. The level-0 pages spread across all eleven:
a ten-year-old's questions about a toilet, a magnet, a scab and a thunderstorm belong to Energy
& Machines, Physics, Body & Medicine and Earth & Climate respectively, and the Level filter
(`?level=0`) already collects them into one beginner's shelf.

An alternative worth a look is a twelfth category, **Everyday things** (`everyday`), holding the
{{EVERYDAY_COUNT}} level-0 topics flagged as household objects and mechanisms (listed under "The
optional Everyday things category", each with the category it is filed under by default). For it:
an obvious front door for beginners, and a toilet stops sharing a shelf with heat engines.
Against it: a twelfth Area chip on an index that already needs five rows of chips on a phone,
and a category defined by audience rather than by subject, unlike the other eleven. The
recommendation is to keep eleven categories and add a "Start here" link on the index that
opens the level-0 filter; the flagged list makes the other arrangement a mechanical change
later.

<!-- EVENNESS -->

Perfectly even is out of reach with a hundred additions: level 2 already holds 56 topics, more
than a quarter of the 200. The proposal therefore adds almost nothing at level 2 and puts the
weight on level 0 and level 3, which is where the catalogue is thinnest today. Level 3 was also
uneven by category: it existed only in Physics, Space, Computing and AI, so the seven categories
with none (Mathematics, Chemistry, Biology, Body & Medicine, Earth & Climate, Information &
Networks, Energy & Machines) get most of the new level-3 pages.

If the user wants level 2 lower still, the honest move is to re-level a few existing level-2
entries whose models are already university material, rather than to add fewer topics there:
black-holes integrates Schwarzschild geodesics, big-bang computes recombination with Peebles'
three-level atom, medical-imaging reconstructs from projections, gps carries the relativistic
corrections, standard-model enforces colour and charge rules. This proposal re-levels nothing;
that list is a footnote for the user to act on or ignore.

<!-- WAVES -->

The rules in `BACKLOG.md` still apply: a topic is ready once its prerequisites are built, and
the first topic of a new kind of page builds the shared pieces that the rest reuse. Two things
are new.

- **A level-0 wave first.** Five level-0 topics, one per interaction kind, with no prerequisites
  and no `Needs`, build the conventions of a level-0 page (one control per step, no formula
  labels, readouts as comparisons, the closing "read next" step) before the other forty follow.
  Suggested: {{L0_WAVE}}.
- **A level-3 wave per category.** One level-3 topic in each of the seven categories that have
  none today, chosen with no `Needs` where possible, so each category gets its first university
  page early and the gaps close evenly. Suggested: {{L3_WAVE}}.
- After those two waves, build whatever is ready, favouring topics that unlock others (the
  level-0 roots unlock nothing in the catalogue sense, so order them by demand: the questions
  people ask most first).

<!-- METHOD -->

The list was produced in one orchestrated research run on 2026-10-17 and then checked by hand.

1. **Generation.** Nineteen independent researchers, each with its own lens (eight level-0
   lenses: home mechanisms, everyday technology, basic physical science, living things and the
   body, earth and sky, kitchen chemistry, numbers and computers, vehicles and big machines;
   nine level-3 lenses, one per category or pair of categories; one demand lens over the most
   asked "how does X work" questions; one lens for level-1 and level-2 holes and the Reserve
   list), each reading the catalogue and searching curricula and demand signals, proposed about
   thirty candidates in the catalogue's entry format with a source for each.
   {{GEN_COUNT}} candidates came out after exact duplicates were removed.
2. **Merge.** One pass per category clustered near-duplicates and dropped candidates an
   existing page already covers ({{MERGE_DROPPED}} dropped).
3. **Judging.** Every candidate was scored 1 to 5 by three separate judges: fit and demand;
   buildability as a real client-side model with openly licensed data; honest level and
   distinctness from the existing pages. A rejection by any judge removed the candidate
   ({{JUDGE_REJECTED}} rejected). The level judge could re-level a candidate.
4. **Selection.** In code, by quota: 45 at level 0, 10 at level 1, 3 at level 2, 42 at level 3,
   with per-category targets for the level-0 and level-3 slots and at most twelve new topics per
   category. A curator then reviewed the whole selection against the runners-up and swapped
   {{CURATOR_SWAPS}} topics for coverage and coherence.
5. **Verification.** Each selected topic faced two sceptical reviewers in turn: one trying to
   show it duplicates an existing page or is dishonestly levelled, one trying to show it cannot
   be a real browser model, lacks open data or states something false. Each could reject the
   topic (its slot went to the next runner-up in the same cell) or fix it (re-level, narrow the
   interaction, name the data source). {{VERIFY_REJECTED}} topics were replaced this way.
6. **Completeness.** Three critics (a primary-school teacher, a university lecturer, an editor
   who tracks search demand) looked for must-haves still missing from the existing and proposed
   lists; their verified finds replaced the lowest-scoring topics at the same level
   ({{GAP_SWAPS}} swaps).
7. **Invariants.** The final set was checked in code against the catalogue's rules together
   with the existing 100: unique slugs (also against `src/routes`), prerequisites that exist and
   never sit above the topic's level, no cycles, mutual Related links, and the counts in the
   tables above.

The research run's candidate pool, scores and reviewer notes are not part of the repository;
the runners-up section keeps the strongest candidates that did not make the hundred.
