# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-08 04:00 UTC.

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
  unit-circle, sorting, newtons-laws, sun-earth-moon (done, ticked), learning-from-data
  (published, not ticked — "place points" open question). PRs #1–#7 merged (merge commits).
- **Batch 2 in progress** (user asked 2026-10-08 ~03:20 UTC: merge batch 1, then another batch;
  keep going until close to the session limit but never reach 100% of the 5-hour window; the
  user validates the whole batch together; always give clickable localhost URLs). Stacked
  branches, each started from the previous one; every topic has its model, Node tests and
  narrative committed, scenes written by agents:
  1. `topic/pagerank` — main checkout, dev server :5173. Scenes committed; adversarial review
     running; fact-check applied.
  2. `topic/electric-circuits` — worktree `../hiw-circuits`, :5174. Wire scene done, board
     scene in progress (uncommitted in the worktree).
  3. `topic/bridges-structures` — worktree `../hiw-bridges`, :5175. Frame solver (stiffness
     method, cables tension-only, steel budget shared by demand). Scenes in progress.
  4. `topic/binary` — worktree `../hiw-binary`, :5176. Scenes in progress.
  5. `topic/atmosphere-weather` — worktree `../hiw-atmos`, :5177. Energy-balance model,
     Held–Hou cells, Coriolis parcels, geostrophic winds, frontal advection, hurricane MPI.
     Five scenes in progress (uncommitted placeholders let the page load meanwhile).
- Each worktree's `node_modules` is a symlink to the main checkout's. A git-ignored
  `pw-node.config.ts` (listed in `.git/info/exclude`) runs the Node-only model tests without
  building the site: `npx playwright test -c pw-node.config.ts <name>-model`. The full e2e run
  only works on a branch whose earlier topics all have their scenes.
- When a topic's scenes land: review (adversarial reviewer + fact-check), commit, then rebase
  the later branches onto it (`git rebase topic/<previous>` in each worktree, in order).
- Merge method: merge commits (`gh pr merge N --merge`), one PR per topic, in stack order;
  then `git worktree remove ../hiw-*`.

## Current development

See the list above. Built web/board/bridge/bits state is kept per step in params as strings
(`web:<step>`, `board:build`, `bridge:build`, `bits:<step>`, `map:<step>`).

## Open questions for the user

- learning-from-data: add "place points" (click to add) so it meets the catalogue entry, or
  accept dragging only?
- atoms-periodic-table: which element-data source (e.g. PubChem's periodic table JSON, IUPAC
  atomic weights)? Blocked until chosen (catalogue: never invent data).

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch -a                      # in-flight branches are listed above
npm install
npm run dev                        # http://localhost:5173
npm run check && npm run lint && npm run test:e2e
```
