# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-08 14:00 UTC.

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
- **Validate once, locally** (user's rule, 2026-10-08: this isn't a critical system; spend effort
  on content, not on re-validating). There is no CI: the only GitHub workflow builds and deploys
  `main` (with a 10-minute timeout). While building a topic, run only its Node model tests; run
  `npm run check`, `npm run lint` and the full e2e suite **once**, on the top branch of a batch,
  before asking for validation. After merging, run `npm run verify:deploy` once: it waits for
  the Pages deployment of `origin/main` and checks that the home page and every topic answer.
  Don't poll Actions or re-run suites per branch.
- The quality bar is the photosynthesis explainer: narrative depth, scenes that match the text,
  both themes, reduced motion, every step screenshot-reviewed (method in `scene-guide.md`).
- Never commit the local `package-lock.json` drift (an optional `yaml` entry dropped by a local
  npm run); stage files by path, not with `git add -A`.
- Screenshots go to a scratch directory outside the repository.

## Current state

- `main` (deployed): photosynthesis (published, not ticked — BACKLOG "Known gaps") and 16
  ticked topics: epidemics, unit-circle, sorting, newtons-laws, sun-earth-moon,
  learning-from-data, pagerank, electric-circuits, bridges-structures, binary,
  atmosphere-weather, graph-search, chaos-fractals, orbits-kepler, ecosystems, bayes-theorem.
  PRs #1–#18 merged (merge commits); #15 removed CI (see "Validate once, locally").
- Batch 6 (9 topics: complex-numbers, electromagnetism, heart-circulation, internet,
  reinforcement-learning, ocean-currents, entropy, primes-modular-arithmetic, error-correction)
  merged via the integration branch `batch/6` (one PR). New process that worked: one agent
  builds a whole topic (model, tests, narrative, scenes) in its own worktree off `main`, a second
  agent reviews, fact-checks and ticks it; then all are merged into `batch/<n>`. The shared files
  (`src/lib/topics.ts`, `TopicArt.svelte`) don't survive a union merge: rebuild them from main
  plus each branch's own entry. Nothing in progress; 29 topics ticked.
- Reading progress (branch `claude/explainer-progress-tracking-qqmcph`): each explainer records
  the reader's current step in `localStorage` (`src/lib/progress.svelte.ts`); reaching the last
  step marks it done. The index shows Done (red) / Continue (yellow, opens the saved step) /
  Start (green) on each card, a counter of each status and a "Clear all progress" button.
- Local testing: other work runs on this machine, so ports can clash (4173 is taken by another
  app). The full e2e suite runs with a git-ignored `pw-local.config.ts` (preview on :4180):
  `npx playwright test -c pw-local.config.ts`; a git-ignored `pw-node.config.ts` runs only the
  Node model tests: `npx playwright test -c pw-node.config.ts <name>-model`. Both are listed in
  `.git/info/exclude`; recreate them from this description if missing. Worktree dev servers log
  403s for the Inter font (symlinked `node_modules` outside Vite's `fs.allow`) and svelte-check
  reports a spurious `./$types` error there — run final checks in the main checkout.
- Workflow that worked for batches 2–4: Claude writes each topic's model + Node tests +
  narrative; scene agents write the scenes (briefs: a common one + one per topic, kept in the
  session scratchpad — recreate from `scene-guide.md` and this file); then one combined
  review + fact-check agent per topic (batch 4 showed it is enough); stacked branches in git
  worktrees; rebase later branches with `git rebase --onto topic/<previous> <old-base>` (the
  only conflicts are additive, in `src/app.css` and `TopicArt.svelte`: keep both sides).
- Merge method: merge commits (`gh pr merge N --merge`), one PR per topic, in stack order, then
  `npm run verify:deploy` once.

## Current development

None. Built-state params in use: `web:<step>`, `board:build`, `bridge:build`, `bits:<step>`,
`map:<step>`, `view:zoom`.

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
