# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-08 07:15 UTC.

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

- `main` (deployed): photosynthesis (published, not ticked — BACKLOG "Known gaps") and 13
  ticked topics: epidemics, unit-circle, sorting, newtons-laws, sun-earth-moon,
  learning-from-data, pagerank, electric-circuits, bridges-structures, binary,
  atmosphere-weather, graph-search, chaos-fractals. PRs #1–#14 merged (merge commits).
- **Batch 4 complete, awaiting the user's validation** (asked 2026-10-08 ~06:45 UTC: a small
  batch with the remaining ~25% of the 5-hour window). Stacked branches, both pushed; **merge in
  this order**:
  1. `topic/orbits-kepler` — done, ticked. Main checkout.
  2. `topic/ecosystems` — done, ticked. Worktree `../hiw-eco` (dev server :5174). The full e2e
     suite (336 tests) passes on this branch, which holds both.
     After merging: `git worktree remove ../hiw-eco` and stop the dev servers.
- Local testing: other work runs on this machine, so ports can clash (4173 is taken by another
  app). The full e2e suite runs with a git-ignored `pw-local.config.ts` (preview on :4180):
  `npx playwright test -c pw-local.config.ts`; a git-ignored `pw-node.config.ts` runs only the
  Node model tests: `npx playwright test -c pw-node.config.ts <name>-model`. Both are listed in
  `.git/info/exclude`; recreate them from this description if missing. Worktree dev servers log
  403s for the Inter font (symlinked `node_modules` outside Vite's `fs.allow`) and svelte-check
  reports a spurious `./$types` error there — run final checks in the main checkout.
- Workflow that worked for batches 2–4: Claude writes each topic's model + Node tests +
  narrative, scene agents write the scenes (briefs: a common one + one per topic, in the session
  scratchpad), then an adversarial reviewer and a fact-checker (or one combined agent) per topic;
  stacked branches in git worktrees; rebase later branches with
  `git rebase --onto topic/<previous> <old-base>` (the only conflicts are additive, in
  `src/app.css` and `TopicArt.svelte`: keep both sides).
- Merge method: merge commits (`gh pr merge N --merge`), one PR per topic, in stack order.

## Current development

None in progress. Built-state params: `web:<step>`, `board:build`, `bridge:build`,
`bits:<step>`, `map:<step>`, `view:zoom`.

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
