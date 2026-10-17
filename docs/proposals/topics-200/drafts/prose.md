<!-- CATEGORIES -->

Every topic below is filed under one of the existing eleven categories, so the index, the
category table and the checklist keep their shape. The level-0 pages spread across all eleven:
a ten-year-old's questions about a toilet, a magnet, a sleepy afternoon and a sea breeze belong to
Energy & Machines, Physics, Body & Medicine and Earth & Climate respectively, and the Level filter
(`?level=0`) already collects them into one beginner's shelf.

An alternative worth a look is a twelfth category, **Everyday things** (`everyday`), holding the
{{EVERYDAY_COUNT}} level-0 topics flagged as household objects and everyday experiences (listed
below, each with the category it is filed under by default). For it: an obvious front door for
beginners, and a toilet stops sharing a shelf with heat engines. Against it: a twelfth Area chip
on an index that already needs five rows of chips on a phone, and a category defined by audience
rather than by subject, unlike the other eleven. The recommendation is to keep eleven categories
and add a "Start here" link on the index that opens the level-0 filter; the flagged list makes
the other arrangement a mechanical change later.

{{EVERYDAY_LIST}}

<!-- EVENNESS -->

Perfectly even is out of reach with a hundred additions: level 2 already holds 56 topics, more
than a quarter of the 200. The proposal therefore adds almost nothing at level 2 and puts the
weight on level 0 and level 3, which is where the catalogue is thinnest today. Level 3 was also
uneven by category: it existed only in Physics, Space, Computing and AI, so the seven categories
with none (Mathematics, Chemistry, Biology, Body & Medicine, Earth & Climate, Information &
Networks, Energy & Machines) each get four or five new level-3 pages.

The split was first set at 45 / 10 / 3 / 42 (levels 0 / 1 / 2 / 3). On review the user asked
that, where the split has to be uneven, it lean towards AI, ideally with a complete set of
explainers for understanding large language models, and chose to take those slots from level 0.
The proposal is therefore 39 / 10 / 3 / 48, and the 200 would stand at 39 / 48 / 59 / 54. Seven
level-0 slots came from the largest level-0 cells (Physics and Energy & Machines from six to five;
Body & Medicine from five to four; Mathematics, Chemistry, Computing and Earth & Climate from four
to three). One of them went to AI's level-0 target (two to three, for the ladder's door) and six
to AI's level-3 target (three to nine). Every other category kept its level-3 target.

If the user wants level 2 lower still, the honest move is to re-level a few existing level-2
entries whose models are already university material, rather than to add fewer topics there:
black-holes integrates Schwarzschild geodesics, big-bang computes recombination with Peebles'
three-level atom, medical-imaging reconstructs from projections, gps carries the relativistic
corrections, standard-model enforces colour and charge rules. This proposal re-levels nothing;
that list is a footnote for the user to act on or ignore.

<!-- WAVES -->

The rules in `BACKLOG.md` still apply: a topic is ready once its prerequisites are built, and
the first topic of a new kind of page builds the shared pieces that the rest reuse. Three things
are new.

- **A level-0 wave first.** Five level-0 topics, one per interaction kind, with no prerequisites
  and no `Needs`, build the conventions of a level-0 page (one control per step, no formula
  labels, readouts as comparisons, the closing "read next" step) before the other thirty-four
  follow. Suggested: shadows-and-pinholes (manipulate), fireflies-in-sync (simulate),
  barcode-stripes (step), why-triangles-are-stiff (build) and leap-years (explore).
- **A level-3 wave per category.** One level-3 topic in each of the seven categories that have
  none today, each with only existing prerequisites, so each category gets its first university
  page early and the gaps close evenly. Suggested: taylor-series (Mathematics),
  chromatography (Chemistry & Materials), bacterial-chemotaxis (Biology),
  cerebellum-motor-learning (Body & Medicine), ensemble-weather-forecasting (Earth & Climate),
  tcp-congestion-control (Information & Networks) and wind-turbine-aerodynamics (Energy &
  Machines).
- **The LLM ladder in order.** positional-encoding and tokenization need only existing pages and
  no data, so they can start at once; training-a-tiny-language-model follows its level-1
  prerequisite ngram-text-models, and it builds the in-browser training loop that
  chain-of-thought-scratchpad and the second-wave rungs reuse.
- After those, build whatever is ready, favouring topics that unlock others (the level-0 roots
  unlock nothing in the catalogue sense, so order them by demand: the questions people ask most
  first).

<!-- METHOD -->

The list was produced by a pipeline of small orchestrated research runs on 2026-10-17 and
2026-10-18, with plain scripts between them, and then checked by hand. The scripts, every
agent's output and the scores are in `docs/proposals/topics-200/` (its README explains the
files).

1. **Generation.** Nineteen independent researchers, each with its own lens (eight level-0
   lenses: home mechanisms, everyday technology, basic physical science, living things and the
   body, earth and sky, kitchen chemistry, numbers and computers, vehicles and big machines;
   nine level-3 lenses, one per category or pair of categories; one demand lens over the most
   asked "how does X work" questions; one lens for level-1 and level-2 holes and the Reserve
   list), each reading the catalogue and searching curricula and demand signals, proposed about
   thirty candidates in the catalogue's entry format with a source for each. After the user asked
   for the AI tilt, a twentieth lens proposed the missing rungs of an LLM ladder (16 candidates).
   {{GEN_COUNT}} candidates in all, after exact duplicates were removed.
2. **Merge.** One pass per category clustered near-duplicates and dropped candidates an
   existing page already covers ({{MERGE_DROPPED}} dropped). Where a judge later rejected the
   candidate a merge had kept (twice, each time as a duplicate of the one it absorbed), the
   absorbed candidates came back.
3. **Judging.** Every candidate was scored 1 to 5 by two judges, in batches of 25: one for fit,
   honest level and distinctness from the existing pages, one for buildability as a real
   client-side model with openly licensed data. A rejection by either judge removed the
   candidate ({{JUDGE_REJECTED}} rejected), and the level judge could re-level it
   ({{RELEVELLED}} re-levelled). The score is the mean of the two marks.
4. **Selection.** In code, by quota: 39 at level 0, 10 at level 1, 3 at level 2, 48 at level 3,
   with per-category targets for the level-0 and level-3 slots and at most twelve new topics per
   category (eighteen for AI). AI's level-3 slots were filled first with one page per stage of
   the LLM ladder (the best-scored candidate of each stage). Ties, common with two 1-to-5 marks,
   went to the higher fit mark, then to AI, then to candidates named as the promotion of a
   Reserve item, then to the demand lens, then to a fixed hash of the slug. A curator then
   reviewed the whole selection against the runners-up and proposed five swaps; one went through
   in effect (lasers in, tennis-racket-theorem out), four that would have moved level-3 slots
   from Space or Energy & Machines into AI were refused because they broke the targets the user
   had chosen to keep, and one duplicate it flagged (sink-or-float beside
   floating-sinking-and-boats) was resolved by hand with the alternative it named.
5. **Verification.** Each selected topic faced a sceptical reviewer (one per batch of five) who
   tried to show it duplicates an existing page, is dishonestly levelled, cannot be a real
   browser model, lacks open data or states something false, and either refuted it (its slot
   went to the best untried runner-up at the same level, same category first) or fixed it
   (re-levelled it, narrowed the interaction, named the data source, corrected a takeaway or a
   pitfall). One topic was refuted and replaced; {{VERIFY_FIXED}} were fixed.
6. **Completeness.** Three critics (a primary-school teacher, a university lecturer, an editor
   who tracks search demand) looked for must-haves still missing from the existing and proposed
   lists and proposed 18 candidates. All were verified like the rest, then judged by the same two
   judges, and each could replace the lowest-scored topic at its level only if it outscored it
   and kept the category targets and the ladder intact (one swap; the other seventeen are listed with the runners-up).
7. **Invariants.** The final set was checked in code against the catalogue's rules together
   with the existing 100: unique slugs (also against `src/routes`), prerequisites that exist and
   never sit above the topic's level, no cycles, mutual Related links, every `Needs` naming a
   licence, and the counts in the tables above. Links to candidates that did not make the
   hundred were dropped mechanically, and Related links among the hundred made mutual.
