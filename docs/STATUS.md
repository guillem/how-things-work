# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-13 UTC.

## How we work

- [`TOPICS.md`](TOPICS.md) is the catalogue (100 topics, 11 categories; content only). Do not
  change its topics or categories; the only edit we make is ticking a topic in its checklist once
  it meets the catalogue's definition of done. Prettier is told to leave it alone.
- [`BACKLOG.md`](BACKLOG.md) says what to build next and lists known gaps.
  [`TIMELOG.md`](TIMELOG.md) records how long each development took (log each phase as it ends).
- [`full-picture.html`](full-picture.html) is the user's one-glance dashboard; keep it in sync at
  every milestone (rule in [`CLAUDE.md`](../CLAUDE.md)).
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
- CI runs Node 22 on a slower Linux machine; the laptop runs Node 26. Chaotic simulations
  (states-of-matter) differ between them, and heavy scenes can lose forced clicks there. Before a
  release with new topics, also run `npx playwright test --workers=2` locally.

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
- `main` (deployed as v0.1.13): **46 of the 100 catalogue topics ticked** — photosynthesis
  (ticked 2026-10-11, the quality reference), 16 early topics (the list below the wave-1 table),
  and the 29 of batches 6–9, built one agent per topic in local worktrees (the process that
  worked for batches 2–6, still current). PRs #1–#18 were the early merge-commit flow; #15
  removed CI (see "Validate once, locally"); everything since is trunk-based.
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

**Fact-check round (2026-10-13, factual fixes released in v0.1.13):** the 29 built topics never reviewed through
the Batch API were reviewed (batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, ~$18 + ~260 searches; all
"ready after fixes"). Applied so far: every High/Medium factual error (27 items in 17 topics,
each checked against a source, none rejected) and the epidemics flu-marker contradiction. The
rest of each report (Low items, model, narrative, catalogue, clarity) stays in
`docs/reviews/<slug>.md` for the next pass. Phone stage text: option B chosen (see BACKLOG).

**Review round (2026-10-13, released in v0.1.12):** a review of the gap and bug rounds (made with
Kimi and ZCode) found three live bugs and a dozen smaller problems; fixed in four local worktrees
merged into `main`, each fix with a test that failed first (list at the end of BACKLOG's "Known
gaps"). Also: `.claude/worktrees/` is git-ignored so lint and Prettier skip agent worktrees; the
atmosphere note no longer claims a layer height for Held and Hou that no source confirmed.
Deferred items are in BACKLOG.

**Bug round (2026-10-13, released in v0.1.11):** the arch bridge's posts now carry
the road (pin-ended spandrel posts — a new member kind, serialized as `p`; model-tested), the
chemical-bonds pause-on-hover no longer stops between atoms, and the photosynthesis `#water`
caption follows the light level. states-of-matter's between-machine variance is closed as
by-design (chaotic, documented on the page). `docs/full-picture.html` is the new one-glance
dashboard for the user (rule in `CLAUDE.md`: keep it in sync at milestones).

**Gap round (2026-10-12/13):** the "Known gaps in built topics" backlog, worked in seven local
worktrees (`fix/gaps-a`…`-g`) merged into `main`. Kimi started a–e and g; ZCode finished them,
built the never-started f (waves-interference: sources draggable anywhere in the tank +
`sources:tank` param, frame-cache pre-warm, the Doppler source as a handle whose speed becomes
the drag's; radioactivity: eased half-life slider, thinned marks) and b (oscillations-resonance's
pendulum label), completed fourier-transform (chart range, signal clipping, deep 0 Hz bar, live
sweeps on `#square`/`#spectrum`), and committed the main-checkout work (ecosystems' off-balance
web opening and aligned y-axes; sun-earth-moon's tilt footer/sketch agreement; chemical-bonds'
angle-arc fade and δ-label placement; the photosynthesis `#summary` captions recorded as fading
by design). Released in v0.1.10.

**Maintenance (2026-10-12):** fixed nested-URL 404 assets and home navigation by setting
`paths.relative: false`; replaced the characterization test with a regression test. Both focused
404 browser tests pass. Also fixed unit-circle slider snapping with optional permitted range
values, including keyboard navigation; all four unit-circle browser tests pass. `make check`
passes (424 model tests); the full browser suite after the 404 and slider changes passes (759
tests). PageRank keeps keyboard events inside editable graph nodes; all 10 focused PageRank
tests pass, including the new shortcut regression. Released in the next tag.

**Batch 9 (2026-10-12):** calculus, black-holes, states-of-matter, homeostasis, compression. Same
process (builder agent each, `make review` ~$3.50, review-apply agent each). Merged into `main`
locally and ticked; `make e2e-full` green (758 tests). Released in v0.1.7 (v0.1.5 and v0.1.6
failed on CI before deploying: see the two test fixes after them).

Batch 8 (2026-10-12, released in v0.1.4): light-optics, semiconductors, special-relativity, cryptography, cpu,
motors-generators. Same process as batch 7 (one builder agent each in a local worktree, fact-check
via `make review` ~$4.35, one agent each applying its report). All merged into `main` locally and
ticked; `make e2e-full` green (662 tests). Released in v0.1.4 (2026-10-12).

Batch 7 (chemical-bonds, waves-interference, radioactivity, linear-transformations,
fourier-transform) released in v0.1.3 (2026-10-12).

Released in v0.1.2 (2026-10-12): the photosynthesis review fixes, rate model and "What limits the
rate?" step (built in cloud sessions on 2026-10-11).

Built-state params in use: `web:<step>`, `board:build`, `bridge:build`, `bits:<step>`,
`map:<step>`, `view:zoom`, `mol:<step>`, `probe:tank`, `sources:tank`, `ft:wave`, `ft:bars`,
`ft:curve`, `dope:<step>`, `pick:<step>`.

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
