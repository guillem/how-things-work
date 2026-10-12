# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-12 UTC.

## How we work

- [`TOPICS.md`](TOPICS.md) is the catalogue (100 topics, 11 categories; content only). Do not
  change its topics or categories; the only edit we make is ticking a topic in its checklist once
  it meets the catalogue's definition of done. Prettier is told to leave it alone.
- [`BACKLOG.md`](BACKLOG.md) says what to build next and lists known gaps.
  [`TIMELOG.md`](TIMELOG.md) records how long each development took (log each phase as it ends).
- **The workflow is in [`CLAUDE.md`](../CLAUDE.md)** (since 2026-10-11): trunk-based, commit to
  `main`, `make check` (run by the Stop and pre-push hooks), releases only by tag
  (`make release`), `make rollback` to undo one. No PRs. Pushing `main` deploys nothing.
- **Validate once, locally** (user's rule, 2026-10-08: this isn't a critical system; spend effort
  on content, not on re-validating). When a development is finished, run `make e2e-full` once and
  the screenshot review from [`scene-guide.md`](scene-guide.md), then ask the user to validate it
  locally; once they say it is fine, push `main` and release. Don't poll Actions or re-run suites.
- The quality bar is the photosynthesis explainer: narrative depth, scenes that match the text,
  both themes, reduced motion, every step screenshot-reviewed (method in `scene-guide.md`).
- Never commit the local `package-lock.json` drift (an optional `yaml` entry dropped by a local
  npm run); stage files by path, not with `git add -A`.
- Suspected bugs recorded by characterization tests, not fixed yet: see BACKLOG "Known gaps".
- Screenshots go to a scratch directory outside the repository.

## Current state

- **Cloud and batch tooling (2026-10-11; first real cloud session the same day, see
  `docs/cloud.md` "What we learned"):** `scripts/cloud-setup.sh`
  and `docs/cloud.md` for building topics in cloud sessions; `make review` / `make review-fetch`
  (`scripts/batch-review.ts`) for fact-check reviews through the Batch API. The first real batch
  reviewed photosynthesis (~$0.97 + 15 web searches); a cloud session applied it.
- **Lean workflow live since 2026-10-11** (see `CLAUDE.md`). First release `v0.1.0` deployed
  from its tag and passed the live smoke test; the rollback path was exercised once (redeploying
  v0.1.0). All merged topic/site branches were deleted, local and remote. Rulesets: `main` can't be
  force-pushed or deleted; `v*` tags can't be moved or deleted. The `github-pages` environment
  deploys from `v*` tags and `main` (rollbacks run from main).
- `main` (deployed): photosynthesis (ticked 2026-10-11 after its review and rate model,
  released in v0.1.2 on 2026-10-12) and 16 ticked topics: epidemics, unit-circle, sorting, newtons-laws, sun-earth-moon,
  learning-from-data, pagerank, electric-circuits, bridges-structures, binary,
  atmosphere-weather, graph-search, chaos-fractals, orbits-kepler, ecosystems, bayes-theorem.
  PRs #1–#18 merged (merge commits); #15 removed CI (see "Validate once, locally").
- Batch 6 (9 topics: complex-numbers, electromagnetism, heart-circulation, internet,
  reinforcement-learning, ocean-currents, entropy, primes-modular-arithmetic, error-correction)
  merged via the integration branch `batch/6` (one PR). New process that worked: one agent
  builds a whole topic (model, tests, narrative, scenes) in its own worktree off `main`, a second
  agent reviews, fact-checks and ticks it; then all are merged into `batch/<n>`. The shared files
  (`src/lib/topics.ts`, `TopicArt.svelte`) don't survive a union merge: rebuild them from main
  plus each branch's own entry. Nothing in progress; 30 topics ticked (photosynthesis on 2026-10-11).
- Reading progress (branch `claude/explainer-progress-tracking-qqmcph`): each explainer records
  the reader's current step in `localStorage` (`src/lib/progress.svelte.ts`); reaching the last
  step marks it done. The index shows Done (red) / Continue (yellow, opens the saved step) /
  Start (green) on each card, a counter of each status and a "Clear all progress" button.
- Local testing: other work runs on this machine, so ports can clash (4173 is taken by another
  app). The test server uses `PW_PORT` (default 4180). In a worktree, clone `node_modules`
  (`cp -cR`) rather than symlinking it, or svelte-check checks the other checkout's types.
- Workflow that worked for batches 2–6: one agent builds a whole topic (model, Node tests,
  narrative, scenes) in its own worktree off `main`; a second agent reviews, fact-checks and
  ticks it; the topic branches are then merged into `main` locally (the only conflicts are
  additive, in `src/app.css`, `src/lib/topics.ts` and `TopicArt.svelte`: keep both sides, or
  rebuild those registries from `main` plus each branch's own entry) and deleted.

## Current development

Batch 7 (2026-10-12, local worktrees, one builder agent each): the topics listed at the end of
this section, merged into `main` locally, not pushed until the user validates. Released in v0.1.2 (2026-10-12), built in cloud sessions on 2026-10-11: the
photosynthesis review fixes, then its rate model and "What limits the rate?" step (PROSPECT-D
leaf optics + FvCB C₃ model, `src/routes/photosynthesis/model.ts`); photosynthesis is ticked and
its review report deleted. Built-state params in use: `web:<step>`, `board:build`,
`bridge:build`, `bits:<step>`, `map:<step>`, `view:zoom`, `mol:<step>`.

- waves-interference: merged; ticked; built-state param `probe:tank`. Not reviewed yet.
- chemical-bonds: built in worktree branch `topic/chemical-bonds` (model, 11 steps, 5 scenes, tests), ticked; awaiting merge and review.
- radioactivity: merged; ticked. Not reviewed yet.
- linear-transformations: merged; ticked. Not reviewed yet.

- fourier-transform: built and ticked on branch `topic/fourier-transform` (local worktree), not yet
  merged; built-state params `ft:wave`, `ft:bars`, `ft:curve`.
- fourier-transform: merged; ticked. Not reviewed yet.

## Open questions for the user

None. Answered 2026-10-08: learning-from-data — dragging only is fine (ticked);
atmosphere-weather — the fronts-from-lows and transport/spin controls are accepted (ticked);
atoms-periodic-table — use PubChem's periodic-table data (see BACKLOG). The user also confirmed
that other work may run in parallel on this machine, so ports can clash: use other ports.

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch                         # in-flight work is listed above
npm install                        # also enables the git pre-push hook
npm run dev                        # http://localhost:5173
make check && make e2e-full
```
