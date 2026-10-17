# Topic proposal: a level 0 and 100 new topics (work in progress)

The self-handover for this piece of work. Read it top to bottom before continuing; the
"Resume" section at the end says exactly what to run next.

Last updated: 2026-10-17 22:50 UTC. **Phase A (generation) is complete; phase B (judging) is the next
step.** The session was stopped here on purpose; see "Resume".

## What the user asked for

After v1.0.0 (all 100 catalogue topics built), choose the next 100 topics. The user's brief,
2026-10-17: add a **level 0** for more basic material; make the number of explainers per level
more even (level 3 has far too few: 6 of 100); **research and propose 100 new topics; write no
code**. The deliverable is a proposal document, not changes to `docs/TOPICS.md` (the catalogue
changes only when the user promotes entries).

## Decisions taken so far (the user has not reviewed these yet)

- **Level 0 reader:** curious beginner, primary or middle school (about ages 9 to 13; NGSS
  grades 3 to 8, England KS2 and KS3) or an adult with no science background. A level-0 page
  uses no formulas, numbers only as counts and comparisons, one control at a time, 6 to 9 steps,
  starts from an object or experience the reader knows, and the toy is the takeaway. The bar
  (a real model behind the graphic, fact-checked) does not drop. Level-0 prerequisites can only
  be level 0 (catalogue invariant: no prerequisite above the topic's level), so level-0 entries
  carry a non-catalogue "Leads to" note naming the level-1 topics they prepare for.
- **Target split of the 100 new topics:** 45 at level 0, 10 at level 1, 3 at level 2, 42 at
  level 3. Today's catalogue is 38 / 56 / 6 at levels 1 / 2 / 3, so the result would be
  45 / 48 / 59 / 48. Perfectly even is unreachable without re-levelling existing level-2 entries;
  the proposal will list a few that read like level 3 (black-holes, big-bang, medical-imaging,
  gps, standard-model) as an optional footnote and re-level nothing.
- **Level 3 per category:** the seven categories with no level-3 topic today (math, chemistry,
  biology, medicine, earth, networks, energy) get most of the 42 slots (targets 5/5/5/4/4/5/5;
  physics 2, space 2, computing 2, ai 3). Level-0 targets per category:
  math 4, physics 6, chemistry 4, biology 4, medicine 5, earth 4, space 3, computing 4,
  networks 3, ai 2, energy 6. At most 12 new topics per category.
- **Categories:** keep the existing eleven by default; present an optional twelfth, "Everyday
  things", as a re-filing of the level-0 household topics (each candidate carries an `everyday`
  flag so either arrangement is mechanical). Recommendation drafted: keep eleven, add a "Start
  here" link that opens the level-0 filter.
- **The 14 Reserve items** of `TOPICS.md` are each promoted (at an honest level) or dropped,
  explicitly, in the proposal. The generators' dispositions are collected in
  `data/dispositions.json` (several lenses judged the same item; reconcile by hand).
- **Proposal file:** `docs/TOPICS-PROPOSAL.md`, in the catalogue's own entry format grouped by
  category, with proposal notes as indented `>` lines under each entry (dropped on promotion).
  Sections and prose are drafted in `drafts/` (`skeleton.md` is the file's outline with
  `{{PLACEHOLDERS}}`; `prose.md` holds the categories, evenness, waves and method sections;
  `framework.md` the "framework implications" section).
- **Repository hygiene:** do not edit `TOPICS.md`, `STATUS.md`'s release notes or
  `full-picture.html` for this (a proposal is not a milestone). Commit the proposal; the user
  decides when to release anything. `eslint.config.js` ignores `docs/proposals/**` (the workflow
  scripts use a top-level `return`) and `.prettierignore` skips `data/` and `workflows/` here.

## How the research is organised

One agent cannot hold the problem, so it is a pipeline of small workflows (the Claude Code
`Workflow` tool; scripts in `workflows/`), with the heavy data in files that the agents read, and
plain Node scripts in `scripts/` between the phases.

| Phase       | Script                          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Agents                        |
| ----------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A: Generate | `workflows/phase-a-generate.js` | 19 lenses (8 level-0 lenses, 9 level-3 lenses by category, a demand lens, a level-1/2 holes-and-Reserve lens), each reads `TOPICS.md`, searches curricula and demand signals, and returns 26 to 30 candidates in the catalogue's format plus `why` (a URL), `overlapWith`, `needsSource`, `leadsTo`, `everyday`. Takes `doneLenses` so finished lenses are skipped.                                                                                                                                                                                                                      | up to 19, ~250k tokens each   |
| B: Judge    | `workflows/phase-b-judge.js`    | Merge near-duplicates per category (11 agents reading `data/pool/<category>.json`), two judges per batch of 25 (`data/pool/batch-NN.json`): fit-level-distinctness and buildability-data, scores 1 to 5, any rejection removes the candidate, the level judge may re-level. Selection by quota **in code**, then one curator proposes up to 12 same-level swaps. Returns rows (slug, level, category, kind, title, score, notes), not full entries.                                                                                                                                      | 11 + 2 × batches + 1          |
| C: Verify   | `workflows/phase-c-verify.js`   | One sceptical reviewer per batch of 5 selected topics (reads the category pool files): duplicate of an existing page, dishonest level, not a real browser model, data not openly licensed, wrong takeaway. Each verdict is refute / fix (changed fields only) / pass; refuted topics are replaced by the next runner-up in the same level and category and re-verified. Then three completeness critics (primary teacher, university lecturer, search-demand editor) propose gap entries, verified the same way, swapped in for the lowest-scoring topic at the same level (at most 10). | ~22 + replacements + 3 + gaps |
| Assemble    | `scripts/assemble.mjs`          | Applies phase C's fixes to the full entries in `data/pool.json` and writes `data/final.json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | none                          |
| Render      | `scripts/render.mjs`            | Checks the catalogue invariants over existing + proposed (unique slugs, also against `src/routes`; prerequisites exist and never sit above the level; no cycles; mutual Related; level-0 prerequisites only level 0) and writes `data/entries.md` (entries in catalogue format), `data/tables.md` (before/after tables), `data/checklist.md`, `data/validation.json` (problems, warnings, back-links to add to existing entries).                                                                                                                                                        | none                          |

Supporting scripts: `scripts/extract-existing.mjs` (the catalogue as JSON and as the compact
`args` the workflows take, `data/existing.json` and `data/workflow-args.json`);
`scripts/prep-pool.mjs` (merges the generator outputs into `data/pool.json`, writes
`data/pool/<category>.json` and `data/pool/batch-NN.json`, and `data/phase-b-args.json`).

The original single-run script (all phases in one workflow, two refuters per topic, per-category
scribe agents) is `workflows/propose-100-topics-single-run.js` (kept for reference, not to be run again); the three phase scripts share its header (schemas, shared
prompt text, the 19 lens briefs, helpers).

## Where the runs stand

**Phase A is done: all 19 lenses finished, 557 candidates in the pool.** It took four runs:

- Runs 1 and 2 (the original single-run script) died on the usage limit with 5 + 5 generator
  lenses finished; their results were recovered from the workflow journals into
  `data/generators-runs-1-2.json`.
- Run 3 (phase A) finished 7 of the 9 remaining lenses (`data/generators-run-3.json`); the
  limit tripped again on the last two.
- Run 4 (phase A) finished those two, `demand` and `holes-l1-l2`
  (`data/generators-run-4.json`).

The pool (`data/pool.json`, one entry per candidate with `origin` = lens; `data/pool/<category>.json`;
`data/pool/batch-01..23.json`, 25 per batch in category order; `data/phase-b-args.json`) is built
from all four run files: **557 candidates** after exact-slug dedupe (nothing merged yet), by level
247 / 36 / 5 / 269 (levels 0 / 1 / 2 / 3), by category math 58, physics 94, chemistry 58,
biology 56, medicine 56, earth 42, space 30, computing 38, networks 21, ai 38, energy 66; by kind
manipulate 176, simulate 217, step 61, build 62, explore 41; 196 flagged `everyday`. Every
level-0 and level-3 target cell has more candidates than its quota; the level-1 and level-2
slots (10 + 3) draw on 41 candidates, nearly all from the `holes-l1-l2` and `demand` lenses.

`data/dispositions.json` holds 55 generator dispositions covering all 14 Reserve items (most say
"promote", some "merge" into a named candidate); the proposal's Reserve table reconciles them by
hand, one decision per item.

**Phases B and C have not run.** Nothing has been judged, merged or verified; the pool is raw
generator output.

## Lessons from the failed runs (read before launching anything)

- **The usage limit is the binding constraint.** Each run died after roughly 2 to 3 million
  subagent tokens. Run phases as separate workflows and keep each under that; a generator lens
  costs about 250k tokens (it reads `TOPICS.md` and runs web searches), a judge batch roughly
  60 to 100k, a verify batch of five about 80k. The user resets the limit when it trips; ask
  before launching a phase if the window is nearly spent.
- **A resumed workflow replays only the unbroken prefix of agent calls.** If the first-issued
  call failed, nothing is replayed, even for agents with identical prompts. So do not count on
  `resumeFromRunId`; recover finished agents from the run's `journal.jsonl` and pass their
  results on through files (`data/`) and `args`.
- **Workflow `args` must stay small** (the pool is 550 KB; the compact rows are 22 KB). That is
  why phases B and C take rows and read the full entries from `data/pool/`.
- **Phase B as scripted is too big for one usage window.** With 23 batches it launches 11 merge
  agents, 46 judges and a curator (about 4 to 5 million tokens). Split it before running (see
  Resume, step 4): the merge and judge agents depend only on the files in `data/pool/`, so they
  can run as several small workflows whose results are collected from their journals; the
  quota selection is plain code and can move into a local script; the curator is one agent.
  Phase C (about 20 verify batches, the replacement rounds, 3 critics) needs the same treatment.
- **Agents' output quality has been good:** entries in the catalogue's voice, curriculum anchors
  with URLs (NGSS, KS2/KS3, MIT OCW), honest `overlapWith` notes. Keep the generator prompt as it
  is (the cached lenses were produced with it).

## Resume

Steps 1 to 3 of the earlier plan (collect the generator runs, build the pool) are done; the pool
files are committed. From the repository root, after `npm install`:

1. **Re-read this file and the three workflow scripts** (`workflows/`), and skim
   `data/pool/physics.json` to see what a candidate looks like.
2. **Restructure phase B for the usage window** (one short session of script work, no agents):
   - `workflows/phase-b-judge.js`: give it a `stage` argument. `stage: "merge"` runs only the
     11 merge agents and returns `mergedOut`; `stage: "judge"` with `batchFrom` / `batchTo` runs
     the two judges for those batch numbers only and returns the raw verdicts (slug, lens,
     score, reject, reason, suggestedLevel); `stage: "curate"` takes `selected` and `runnersUp`
     rows and runs only the curator, returning its swaps and overlaps. Keep the prompts as they
     are. The journal of every run records each agent's result, so a run that dies can be
     collected with a small variant of `scripts/collect-run.mjs` (match labels `merge:` /
     `judge:` instead of `gen:`).
   - `scripts/select.mjs` (new): reads the pool rows, the collected merge drops and verdicts,
     computes scores as the script does (mean of the two judges × 3; any `reject` removes the
     candidate; the fit-level judge's `suggestedLevel` re-levels), runs `selectByQuota` (copy it
     from the script: level quotas 45 / 10 / 3 / 42, the per-category level-0 and level-3
     targets, at most 12 per category), applies the curator's same-level swaps, and writes
     `data/selection.json` with `selected` and `runnersUp` rows.
3. **Run phase B in pieces**, collecting each piece into `data/` as it finishes: the merge run
   (11 agents), then judge runs of about 8 batches each (16 agents, roughly 1.2 million tokens
   each; three runs for 23 batches), then `select.mjs`, then the curator run, then `select.mjs`
   again to apply the swaps. `args` for every run = the contents of `data/workflow-args.json`
   plus `data/phase-b-args.json` (`rows`, `poolDir`, `batches`), plus `"scratch"` and the stage
   fields. `poolDir` must be the absolute path of `docs/proposals/topics-200/data/pool`.
4. **Phase C the same way** (`workflows/phase-c-verify.js`): a `stage: "verify"` that takes the
   rows to verify (about 10 batches of 5 per run) and returns verdicts with fixes; a local
   `scripts/replace.mjs` that applies the replacement rule (a refuted topic is replaced by the
   best untried runner-up at the same level, same category first, at most 12 per category) and
   emits the next rows to verify, until nothing is refuted; then a `stage: "gaps"` run (3 critics,
   then one verify run over their candidates) and the gap-swap rule (a verified gap entry replaces
   the lowest-scoring selected topic at the same level, at most 10 swaps). The invariant pass at
   the end of the script is plain code; keep it in the last stage or move it into
   `scripts/assemble.mjs`.
5. **Assemble and render:** `node docs/proposals/topics-200/scripts/assemble.mjs <phase C
output>` writes `data/final.json`; `node docs/proposals/topics-200/scripts/render.mjs
docs/proposals/topics-200/data/final.json src/routes` checks the invariants over existing +
   proposed and writes `data/entries.md`, `data/tables.md`, `data/checklist.md`,
   `data/validation.json`. Fix every `PROBLEM` it prints (by hand in `final.json`) until it
   prints none. (`assemble.mjs` has never run, since there is no phase-C output yet; it expects the
   current script's result shape, `final` rows with `fix` and `gapEntries`; adjust it to
   whatever the restructured stages return. `render.mjs` was smoke-tested on the raw pool.)
6. **Write `docs/TOPICS-PROPOSAL.md`** from `drafts/skeleton.md`: fill `{{TABLES}}` from
   `data/tables.md`, `{{ENTRIES}}` from `data/entries.md`, `{{CHECKLIST}}` from
   `data/checklist.md`, `{{BACKLINKS}}` from `data/validation.json`, the Reserve table from
   `data/dispositions.json` (one decision per item, reconciled by hand), the categories,
   evenness, waves and method sections from `drafts/prose.md` (fill its placeholders with the
   run's numbers), the framework section from `drafts/framework.md`, and a runners-up section
   from phase C's `runnersUp` (the best 30 or so, as the new Reserve). `{{SUMMARY}}` and `{{LEVEL0_FRAMEWORK_NOTE}}` have no draft: write them fresh at the end,
   from the final numbers. Read every entry once as an editor: the catalogue's voice, no
   duplicated mechanism, one-sentence takeaways.
7. **Document and commit:** update this README's status, the one-paragraph note in
   `docs/STATUS.md` ("Current development") and `docs/BACKLOG.md`, run `make check`, commit by
   path. Do not touch `TOPICS.md`; do not release.

Then ask the user to review the proposal; the open questions for them: the level-0 definition,
the target split, the optional "Everyday things" category, the re-levelling footnote, and which
Reserve dispositions to accept.
