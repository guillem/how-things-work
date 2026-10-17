# Topic proposal: a level 0 and 100 new topics (work in progress)

The self-handover for this piece of work. Read it top to bottom before continuing; the
"Resume" section at the end says exactly what to run next.

Last updated: 2026-10-17 19:10 UTC+2 (phase A, the last generator run, still in flight; see
"Where the runs stand").

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
scribe agents) is `workflows/propose-100-topics-wf_f3cf07b6-3bf.js` in the session's workflow
directory, not in the repository; the three phase scripts share its header (schemas, shared
prompt text, the 19 lens briefs, helpers).

## Where the runs stand

- **Run 1 and run 2 (the single-run script)** both died on the user's usage limit: 5 generator
  lenses finished in run 1, 5 more in run 2 (the resume replayed nothing, see "Lessons"). Their
  results were recovered from the workflow journals into `data/generators-runs-1-2.json`
  (10 lenses: vehicles-and-big-machines, basic-physical-science, chemistry-and-cooking,
  physics-l3, math-l3, earth-sky-weather, numbers-shapes-computers, living-things-and-body,
  home-mechanisms, everyday-technology): 295 candidates after exact-slug dedupe (235 at level 0,
  2 at level 1, 58 at level 3).
- **Run 3 (phase A, the 9 missing lenses: energy-machines-l3, earth-space-l3, ai-l3,
  chemistry-l3, biology-l3, medicine-l3, computing-networks-l3, demand, holes-l1-l2)** was
  launched at 18:5x after the limit reset and is in flight at the time of writing. Its result
  goes to `data/generators-run-3.json` (see Resume). If the session was stopped before it
  finished, its completed agents are still in its journal:
  `~/.claude/projects/-Users-guillem-Development-how-things-work/6ab4727d-d0eb-4d1e-9581-9ca8ca472f63/subagents/workflows/wf_20dc808b-5c1/journal.jsonl`
  (one `{"type":"result",...}` line per finished agent; `label` names the lens).
- Phases B and C have not run. `data/pool.json` and `data/pool/` currently hold the 295
  candidates of runs 1 and 2 only; re-run `prep-pool.mjs` once run 3's results are in.

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
- **Agents' output quality has been good:** entries in the catalogue's voice, curriculum anchors
  with URLs (NGSS, KS2/KS3, MIT OCW), honest `overlapWith` notes. Keep the generator prompt as it
  is (the cached lenses were produced with it).

## Resume

From the repository root, after `npm install`:

1. **Collect run 3.** If the phase-A workflow finished, its result is in the task output file the
   notification named (`.../tasks/<task-id>.output`); otherwise read the journal above. Either
   way, save the result array (one element per lens: `{lens, ok, count, candidates,
reserveDisposition}`) as `docs/proposals/topics-200/data/generators-run-3.json`. From the
   journal: take each `result` line whose `label` starts with `gen:` and wrap it as
   `{lens: <label without "gen:">, ok: true, candidates: result.candidates,
reserveDisposition: result.reserveDisposition}`.
2. **Re-run any lens still missing** with phase A: pass `data/workflow-args.json` as `args`,
   plus `"scratch"` (any directory) and `"doneLenses"` (the lens keys already in
   `generators-runs-1-2.json` and `generators-run-3.json`). `scriptPath` is
   `docs/proposals/topics-200/workflows/phase-a-generate.js`. Append its results to
   `generators-run-3.json` (or a `generators-run-4.json`; `prep-pool.mjs` takes any number of
   files).
3. **Build the pool:** `node docs/proposals/topics-200/scripts/prep-pool.mjs
docs/proposals/topics-200/data/generators-run-3.json` (plus any later run files). It prints the
   pool size by level and category and writes `data/phase-b-args.json`.
4. **Phase B:** launch `workflows/phase-b-judge.js` with `args` = the contents of
   `data/workflow-args.json` merged with `data/phase-b-args.json` (`rows`, `poolDir`,
   `batches`), plus `"scratch"`. Save its result as `data/phase-b.json` (it contains `selected`
   and `runnersUp` rows, `mergedOut`, `rejectedByJudges`, the curator's swaps and notes).
   Expect about 11 + 2 × 23 + 1 agents for ~560 candidates.
5. **Phase C:** launch `workflows/phase-c-verify.js` with `args` = `workflow-args.json` merged
   with `{"selected": <phase-b selected>, "runnersUp": <phase-b runnersUp>, "poolDir": <same as
phase B>}`. Save its result as `data/phase-c.json`.
6. **Assemble and render:** `node docs/proposals/topics-200/scripts/assemble.mjs
docs/proposals/topics-200/data/phase-c.json`, then
   `node docs/proposals/topics-200/scripts/render.mjs docs/proposals/topics-200/data/final.json
src/routes`. Fix every `PROBLEM` it prints (usually by hand in `final.json`: a prerequisite
   above the level, a Related link to a slug that was not selected) until it prints none.
7. **Write `docs/TOPICS-PROPOSAL.md`** from `drafts/skeleton.md`: fill `{{TABLES}}` from
   `data/tables.md`, `{{ENTRIES}}` from `data/entries.md`, `{{CHECKLIST}}` from
   `data/checklist.md`, `{{BACKLINKS}}` from `data/validation.json`, the Reserve table from
   `data/dispositions.json` (one decision per item, reconciled by hand), the categories,
   evenness, waves and method sections from `drafts/prose.md` (fill its placeholders with the
   run's numbers), the framework section from `drafts/framework.md`, and a runners-up section
   from phase C's `runnersUp` (the best 30 or so, as the new Reserve). Read every entry once as
   an editor: the catalogue's voice, no duplicated mechanism, one sentence takeaways.
8. **Document and commit:** update this README's status, the one-paragraph note in
   `docs/STATUS.md` ("Current development") and `docs/BACKLOG.md`, run `make check`, commit by
   path. Do not touch `TOPICS.md`; do not release.

Then ask the user to review the proposal; the open questions for them are listed at the end of
`drafts/skeleton.md`'s summary once written: the level-0 definition, the target split, the
optional "Everyday things" category, the re-levelling footnote, and which Reserve dispositions to
accept.
