# Topic proposal: a level 0 and 100 new topics (done, awaiting review)

The record of how [`docs/TOPICS-PROPOSAL.md`](../../TOPICS-PROPOSAL.md) was made, and the
self-handover for any re-run. Read it top to bottom before changing anything here.

Last updated: 2026-10-18. **All phases are done.** `docs/TOPICS-PROPOSAL.md` holds 100 entries
that pass `scripts/render.mjs` with no problems and no warnings. Waiting on the user's review of
the open questions listed at the end of that file. Building started on 2026-10-18
([`build-brief.md`](build-brief.md), [`data/build-order.json`](data/build-order.json)): 24 of the
100 are on `main` as of 2026-10-18, their entries promoted into `TOPICS.md`; none released.

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
- **Target split of the 100 new topics (first plan, superseded by the AI tilt below):** 45 at level 0, 10 at level 1, 3 at level 2, 42 at
  level 3. Today's catalogue is 38 / 56 / 6 at levels 1 / 2 / 3, so the result would be
  45 / 48 / 59 / 48. Perfectly even is unreachable without re-levelling existing level-2 entries;
  the proposal will list a few that read like level 3 (black-holes, big-bang, medical-imaging,
  gps, standard-model) as an optional footnote and re-level nothing.
- **Level 3 per category:** the seven categories with no level-3 topic today (math, chemistry,
  biology, medicine, earth, networks, energy) get most of the 42 slots (targets 5/5/5/4/4/5/5;
  physics 2, space 2, computing 2, ai 3). Level-0 targets per category:
  math 4, physics 6, chemistry 4, biology 4, medicine 5, earth 4, space 3, computing 4,
  networks 3, ai 2, energy 6. At most 12 new topics per category.
- **AI tilt (the user, 2026-10-18):** where the split has to be uneven, lean towards AI, ideally
  with a complete set of explainers for understanding LLMs in detail; the user chose to take those
  slots from level 0. The split became **39 / 10 / 3 / 48**: AI's level-3 target 3 → 9 and its
  level-0 target 2 → 3 (cap 18 instead of 12); level-0 targets physics 5, energy 5, medicine 4,
  math, chemistry, computing and earth 3. AI's level-3 cell is filled one page per LLM-ladder stage
  first (`LADDER` in `scripts/select.mjs`). Every other category keeps its level-3 target, so
  curator and gap swaps that would break a target are refused.
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
`Workflow` tool; scripts in `workflows/`), each run as its own stage under a usage window, with the
heavy data in files the agents read and plain Node scripts in `scripts/` between the stages. Every
stage's agent results are collected from the run's `journal.jsonl` into `data/stages/`, so a run
that dies loses only its unfinished agents.

| Stage      | Workflow (stage arg)                                   | Local script that follows                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generate   | `phase-a-generate.js` (`doneLenses` skips lenses)      | `collect-run.mjs` → `data/generators-run-N.json`; `prep-pool.mjs` built the pool from runs 1–4; `add-candidates.mjs` appended run 5 (the `llm-ladder` lens) as batch 24 without renumbering                                             |
| Merge      | `phase-b-judge.js` (`stage: "merge"`, `cats`)          | `collect-stage.mjs <journal> merge: data/stages/merge-N.json`                                                                                                                                                                           |
| Judge      | `phase-b-judge.js` (`stage: "judge"`, `batchList`)     | `collect-stage.mjs <journal> judge: data/stages/judge-N.json`                                                                                                                                                                           |
| Select     | none                                                   | `select.mjs` → `data/selection.json`: merge drops (restored when a judge rejected the kept one), scores, re-levels, the LLM ladder, quota selection, tie-breaks, curator and editor swaps                                               |
| Curate     | `phase-b-judge.js` (`stage: "curate"`, rows)           | `collect-stage.mjs <journal> curator data/stages/curator-1.json`, then `select.mjs` again                                                                                                                                               |
| Verify     | `phase-c-verify.js` (`stage: "verify"`, `rows`, `tag`) | `collect-stage.mjs <journal> verify: data/stages/verify-TAG.json`; `replace.mjs` → `data/verified.json` and `data/stages/next-verify.json` (the next rows: replacements of refuted topics, or topics with no verdict yet)               |
| Critics    | `phase-c-verify.js` (`stage: "critics"`)               | `collect-stage.mjs <journal> critic: data/stages/critic-1.json`; `replace.mjs` → `data/stages/next-gapverify.json`                                                                                                                      |
| Gap verify | `phase-c-verify.js` (`stage: "gapverify"`, `entries`)  | collected as `data/stages/gapverify-N.json`; the verified entries are written to `pool/batch-25.json` and judged (`stage: "judge"`, `batchList: [25]`), collected as `data/stages/gapjudge-N.json`; `replace.mjs` applies the gap swaps |
| Assemble   | none                                                   | `assemble.mjs` → `data/final.json`: fixes applied, entities decoded, `data/editorial.json` (hand edits by slug) applied, links to unselected candidates dropped, Related made mutual                                                    |
| Render     | none                                                   | `render.mjs data/final.json src/routes` → `entries.md`, `tables.md`, `checklist.md`, `validation.json`; prints every PROBLEM and warning                                                                                                |
| Write      | none                                                   | `write-proposal.mjs` → `docs/TOPICS-PROPOSAL.md` from `drafts/skeleton.md`, the drafts and the data; then `npx prettier --write` it                                                                                                     |

To launch a stage: `node scripts/make-run.mjs workflows/<phase>.js '<stage fields as JSON>' <scratch>/run.js`
(or `@file.json` for long fields), then `Workflow({ scriptPath: <scratch>/run.js })`. `make-run.mjs`
inlines the args (`stage-args.mjs`: `workflow-args.json`, `poolDir`, the category and batch sizes,
and the stage fields), so nothing has to be pasted into the tool call. The original single-run
script is `workflows/propose-100-topics-single-run.js`, kept for reference only.

## How the runs went

- **Generation:** four runs for the first 19 lenses (runs 1–2 died on the usage limit, see below),
  557 candidates; a fifth run, the `llm-ladder` lens after the user's AI request, added 16.
- **Merge:** 3 runs (4, 7 and a re-merge of AI and Computing after batch 24), 16 dropped, 2
  restored. **Judge:** 4 runs of up to 16 judges (batches 1–8, 9–16, 17–23, 24), then the gap
  batch 25; 10 rejected, 6 re-levelled. **Curate:** 1 run (an earlier one was stopped when the
  tie-break and then the AI tilt changed the selection); 5 swaps proposed, 1 in effect, 4 refused
  for breaking targets, 2 editor swaps. **Verify:** 2 runs of 50, then 1 and 6 topics; 1 refuted
  (x-ray-diffraction). **Critics:** 18 candidates, all verified and judged, 1 swapped in.
- Cost: about 7 million subagent tokens for phases B and C on 2026-10-18 (phase A's runs came
  before); on 2026-10-18 the 5-hour window moved
  about 1% per 260k tokens (`mcp__ccd_session_mgmt__get_usage` reports it, so check it before each
  launch instead of guessing).

## Lessons (read before launching anything)

- **The usage limit is the binding constraint.** Runs 1 and 2 died after 2 to 3 million subagent
  tokens. Stages of at most 16 agents (about 1.2 million tokens for 8 judge batches; 0.8 million
  for 10 verify batches of five) never failed. A generator lens costs about 120 to 250k tokens.
- **A resumed workflow replays only the unbroken prefix of agent calls**, so do not count on
  `resumeFromRunId`; collect finished agents from `journal.jsonl` (`collect-stage.mjs` also lists
  the labels that started without a result) and launch the missing ones as a new stage.
- **Scores are coarse.** Two 1-to-5 marks give a handful of distinct scores (mostly 12, 13.5 and
  15), so most quota decisions are ties. An alphabetical tie-break visibly favoured early letters;
  `select.mjs` breaks ties by the fit mark, then AI, then Reserve promotions, then the demand
  lens, then a fixed hash. Changing a tie-break moves whole cells: re-run `replace.mjs` and verify
  the newcomers.
- **Swap rules need the targets.** A curator or a gap rule that ignores the per-category targets
  quietly undoes them; both are guarded in code now.
- **Unjudged gap entries must not get a fixed score.** The first gap pass gave them 15 and swapped
  out stronger topics; judging them like everything else gave one swap instead of ten.
- **Agents' output carries HTML entities** (`&amp;`) and sometimes references to sibling
  candidates that did not make the cut; `assemble.mjs` decodes the first, and `editorial.json`
  holds the hand fixes for the second.

## Resume

Nothing is left to run. If the user changes a decision:

- **A target, a tie-break, the ladder or a swap:** edit `scripts/select.mjs` (and the matching
  targets in `scripts/replace.mjs`), then `node scripts/select.mjs`, `node scripts/replace.mjs`;
  if it reports pending rows, verify them (`make-run.mjs workflows/phase-c-verify.js
@data/stages/next-verify.json ...`, give it a new `tag`), collect, `replace.mjs` again. Then
  `assemble.mjs`, `render.mjs data/final.json ../../../src/routes` (fix every PROBLEM through
  `data/editorial.json`), `write-proposal.mjs`, prettier, and update the counts quoted in
  `drafts/summary.md`, `drafts/level0-note.md` and `drafts/reserve.md`.
- **Promoting entries:** copy them from `docs/TOPICS-PROPOSAL.md` into `TOPICS.md` without the
  `>` notes, with the checklist line, the category count and the back-links listed there. Level 0
  needs the parser change noted in `BACKLOG.md` first.
- **The LLM ladder's second wave** is ready to promote as a follow-on batch: its rows are in the
  proposal's runners-up section and its full entries in `data/pool/ai.json` and
  `data/pool/batch-25.json` (the critics' versions); they have been judged but only the critics'
  ones were verified, so run them through a verify stage first.
