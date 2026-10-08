# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-08 05:55 UTC.

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
- **Batch 2 complete, awaiting the user's validation** (asked 2026-10-08 ~03:20 UTC: merge
  batch 1, then another batch; stay clear of 100% of the 5-hour window; the user validates the
  whole batch together; always give clickable localhost URLs). Stacked branches, all pushed,
  **merge in this order** (each PR based on `main` after the previous merge):
  1. `topic/pagerank` — done, ticked. Main checkout, dev server :5173.
  2. `topic/electric-circuits` — done, ticked. Worktree `../hiw-circuits`, :5174.
  3. `topic/bridges-structures` — done, ticked. Worktree `../hiw-bridges`, :5175.
  4. `topic/binary` — done, ticked. Worktree `../hiw-binary`, :5176.
  5. `topic/atmosphere-weather` — done, ticked (departures accepted by the user).
     Worktree `../hiw-atmos`.
- **Batch 3** (started at ~54% of the 5-hour window, on top of batch 2, same rules): 6. `topic/graph-search` — done, ticked. Worktree `../hiw-graph`. 7. `topic/chaos-fractals` — done, ticked. Worktree `../hiw-chaos`. The full e2e suite (306
  tests) passes on this branch, which holds the whole stack.
- The main checkout is **detached at the top of the stack** so its dev server (:5173) shows
  every new topic for validation; `git checkout topic/pagerank` (or `main` after merging) to
  get back on a branch.
- After merging: `git worktree remove ../hiw-<name>` for circuits, bridges, binary, atmos,
  graph and chaos (one per command), and stop any dev servers still running from them.
- Local testing quirks: port 4173 is taken by an unrelated app on this machine, so the full e2e
  suite runs with a git-ignored `pw-local.config.ts` (preview on :4180):
  `npx playwright test -c pw-local.config.ts`. A git-ignored `pw-node.config.ts` runs only the
  Node model tests: `npx playwright test -c pw-node.config.ts <name>-model`. Both are listed in
  `.git/info/exclude`; recreate them from this description if missing. Worktree dev servers log
  403s for the Inter font (symlinked `node_modules` outside Vite's `fs.allow`) and svelte-check
  reports a spurious `./$types` error there — run final checks in the main checkout.
- Merge method: merge commits (`gh pr merge N --merge`), one PR per topic, in stack order.

## Current development

None in progress. Built web/board/bridge/bits/map state is kept per step in params as strings
(`web:<step>`, `board:build`, `bridge:build`, `bits:<step>`, `map:<step>` — also used by
graph-search — and `view:zoom` for the Mandelbrot view).

## Open questions for the user

None. Answered 2026-10-08: learning-from-data — dragging only is fine (ticked);
atmosphere-weather — the fronts-from-lows and transport/spin controls are accepted (ticked);
atoms-periodic-table — use PubChem's periodic-table data (see BACKLOG). The user also confirmed
that other work may run in parallel on this machine, so ports can clash: use other ports.

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch -a                      # in-flight branches are listed above
npm install
npm run dev                        # http://localhost:5173
npm run check && npm run lint && npm run test:e2e
```
