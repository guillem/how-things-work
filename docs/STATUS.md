# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-08 00:15 UTC.

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
  unit-circle (done, ticked). PRs #1–#3 merged.
- **Batch awaiting the user's validation** (asked 2026-10-07 ~22:05 UTC: 4–5 topics to validate
  together while they are away). Stacked branches, all pushed; **merge in this order**, each PR
  based on `main` after the previous one is merged (or open each with the branch below as its
  base and let GitHub retarget):
  1. `topic/sorting` — done (reviewed, ticked).
  2. `topic/newtons-laws` — done (reviewed, ticked). Built in the git worktree `../hiw-newtons`
     (dev server there on port 5174; remove it with `git worktree remove ../hiw-newtons` once
     merged — its `node_modules` is a symlink).
  3. `topic/sun-earth-moon` — done (reviewed, ticked).
  4. `topic/learning-from-data` — **in progress** (this branch; see below).
     All 123 e2e tests pass on `topic/sun-earth-moon` (the stack so far).
- Merge method: merge commits (`gh pr merge N --merge`), as for #1–#3.

## Current development

None in progress: the batch is complete and waits for the user's validation. After that: PRs
and merges in stack order, then the next wave-1 topics from BACKLOG (`pagerank`,
`atmosphere-weather`, `atoms-periodic-table` — the last needs an element-data source decision).

## Open questions for the user

- learning-from-data: add "place points" (click to add) so it meets the catalogue entry, or
  accept dragging only? (Claude opens and merges PRs after the user validates — answered
  2026-10-07.)

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch -a                      # in-flight branches are listed above
npm install
npm run dev                        # http://localhost:5173
npm run check && npm run lint && npm run test:e2e
```
