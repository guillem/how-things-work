# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-07 22:47 UTC.

## How we work

- [`TOPICS.md`](TOPICS.md) is the catalogue (100 topics, 11 categories; content only). Do not
  change its topics or categories; the only edit we make is ticking a topic in its checklist once
  it meets the catalogue's definition of done. Prettier is told to leave it alone.
- [`BACKLOG.md`](BACKLOG.md) says what to build next and lists known gaps.
  [`TIMELOG.md`](TIMELOG.md) records how long each development took (log each phase as it ends).
- **One development = one branch.** Each new topic is built on its own branch
  (`topic/<slug>`); site work on `site/<name>`. When it is finished and tested locally
  (`npm run check`, `npm run lint`, `npm run test:e2e`, the screenshot review from
  [`scene-guide.md`](scene-guide.md)), push the branch and open a PR to `main`.
- **Merging to `main` deploys** to https://guillem.github.io/how-things-work/ (GitHub Pages).
  When a development is finished, stop and ask the user to validate it locally; once they say it
  is fine, Claude opens the PR and merges it (merge commit), then starts the next topic.
- The quality bar is the photosynthesis explainer: narrative depth, scenes that match the text,
  both themes, reduced motion, every step screenshot-reviewed (method in `scene-guide.md`).
- Never commit the local `package-lock.json` drift (an optional `yaml` entry dropped by a local
  npm run); stage files by path, not with `git add -A`.
- Screenshots go to a scratch directory outside the repository.

## Current state

- `main` (deployed): photosynthesis (published, not ticked — BACKLOG "Known gaps"), epidemics,
  unit-circle (both done, ticked), catalogue-driven index, status/backlog/time log. PRs #1–#3
  merged.
- **Batch in progress (user away, asked 2026-10-07 ~22:05 UTC for 4–5 topics to validate
  together).** Stacked branches, merge in this order after validation:
  1. `topic/sorting` (base `main`) — **done**: reviewed, 91 e2e pass, ticked.
  2. `topic/newtons-laws` (base `topic/sorting`), worked in the git worktree
     `../hiw-newtons` (dev server on port 5174; `node_modules` is a symlink to the main
     checkout's; `svelte-check` there shows one spurious `$types` error in `+layout.svelte` — run
     final checks in the main checkout). Model, narrative, card done; scenes being drafted.
  3. Next candidates: `sun-earth-moon`, `learning-from-data` (then `pagerank` if usage allows).
     When a lower branch changes, rebase the ones above it (`git rebase topic/sorting` on
     `topic/newtons-laws`, etc.).

## Current development: sorting

Catalogue entry `sorting` (Computing, level 1, step, no prerequisites; leads on to
turing-machines). First `step` topic.

Plan (tick as done):

- [x] `sorts.ts`: bubble (early exit), insertion, merge (shown as moves into the merged part),
      quick (last-element pivot); every comparison and move recorded; counts checked against the
      textbook in `e2e/sorting-model.e2e.ts`.
- [x] `playback.ts` (autoplay at a pace, or paused at a scrubbed position), `steps.ts` (10 steps),
      page, stage, registry, colours `--sort-*`, card art.
- [x] BarsScene (problem, bubble, insertion, merge, quick) with a draggable timeline (Handle);
      e2e `e2e/sorting.e2e.ts` (finishes sorted, scrubber steps, freeze on pause).
- [x] RaceScene (race) and GrowthScene (growth, bigo, inputs, machine): drafted by two agents,
      committed; their wording corrections applied; playback re-anchors on speed changes.
- [x] Review round (2 agents) and fixes; race stepping added (catalogue: "stepping or playing");
      all checks pass; ticked; time logged.
- [ ] Review round (adversarial reviewers + whole page/fact-check), all checks, tick, time log,
      then ask the user to validate.

Next action (sorting): none — waits for the user's validation with the rest of the batch.

## Open questions for the user

- None right now. (Answered 2026-10-07: Claude opens and merges PRs after the user validates.)

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch -a                      # in-flight branches are listed above
npm install
npm run dev                        # http://localhost:5173
npm run check && npm run lint && npm run test:e2e
```
