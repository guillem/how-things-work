# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-08 03:50 UTC.

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
  user validates the whole batch together). Planned, in stack order (each branch starts from the
  previous one):
  1. `topic/pagerank` — main checkout (dev server port 5173). Model, tests and narrative
     committed; three scene agents (votes, surfer, iterate) at work.
  2. `topic/electric-circuits` — worktree `../hiw-circuits` (port 5174), not started.
  3. `topic/bridges-structures` — not started (needs a 2-D frame solver: beams carry bending).
  4. `topic/binary` — not started.
  5. `topic/atmosphere-weather` — not started; large scope, decide the simplified model first.
- Scene-author briefs used for this batch: a common brief plus one per topic (kept in the
  session scratchpad; the essentials are in `scene-guide.md` and this file).
- Merge method: merge commits (`gh pr merge N --merge`), one PR per topic, in stack order.

## Current development

`topic/pagerank`: `pagerank.ts` (power iteration, random surfer, presets EXAMPLE / TRAPS /
STARTER), `e2e/pagerank-model.e2e.ts` (9 tests), `steps.ts` (10 steps), `geometry.ts` (shared
link arrows). Built web stored per step in `params['web:<stepId>']` (string). Next: review the
scenes, fact-check, screenshot matrix, tick.

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
