# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at meaningful milestones**.
The authoritative workflow is [AGENTS.md](../AGENTS.md).

Last updated: 2026-10-30. **v1.3.2 is live with all 200 topics.** The current tooling work is listed below;
the product roadmap is in [`BACKLOG.md`](BACKLOG.md), "After v1.3.0".

## How we work

- [`TOPICS.md`](TOPICS.md) is the catalogue (200 topics, 11 categories; content only): the first
  100, plus the proposal's entries as `proposals/topics-200/scripts/promote.mjs` promotes them
  when their build starts. Do not change its topics or categories otherwise; the only edits we
  make are promoting an entry and ticking it once it meets the catalogue's definition of done.
  Prettier is told to leave it alone.
- [`BACKLOG.md`](BACKLOG.md) says what to build next and lists known gaps.
  [`TIMELOG.md`](TIMELOG.md) records how long each development took (log each phase as it ends).
- [`full-picture.html`](full-picture.html) is the user's one-glance dashboard; keep it in sync at
  every milestone (rule in [AGENTS.md](../AGENTS.md)).
- Follow [AGENTS.md](../AGENTS.md): `make changed` during development; hooks run static/model
  checks only; every release and rollback passes fresh full validation in CI before deployment.
  CI deploys the production build tested by the suite, without rebuilding it.
- **AI usage takes priority over elapsed time.** Work sequentially with one builder by default;
  several requested topics form a queue. Parallel topic batches require an explicit user reason
  (requested concurrency, a deadline priority, or authorized cloud credits). Use focused review
  selectively; see [AGENTS.md](../AGENTS.md#ai-usage-and-delegation).
- The quality bar is the photosynthesis explainer: narrative depth, scenes that match the text,
  both themes, reduced motion, every step screenshot-reviewed (method in `scene-guide.md`).
- Stage files by path, not with `git add -A`.
- Screenshots go to a scratch directory outside the repository.
- Use the `.nvmrc` Node (26) locally, matching CI. No routine duplicate runs
  at different worker counts; investigate specific failures when needed.

## Current state

- **All 200 catalogue topics are built, reviewed, ticked and live** (v1.3.0, 2026-10-24): the
  original 100 (done 2026-10-15) and the proposal's 100 (39 / 10 / 3 / 48 at levels 0–3).
  v1.3.1 (the same day) adds the review fixes to the last six; v1.3.2 (2026-10-30) the content
  audit of 156–200. Nothing is in development.
  Releases, newest first: v1.3.2 (audit 156–200), v1.3.1 (fixes), v1.3.0 (200 topics), v1.2.5 (194), v1.2.4 (181), v1.2.3 (175), v1.2.2 (170; level 0 and the "Start here" link), v1.2.1 (155; Paths v1),
  v1.1.2 (154), v1.0.0 (the 100 plus index search and filters), v0.1.21 (housekeeping and public
  polish), v0.1.19 (the external audit, `docs/codex-fact-check-complete.md`).
- **What is left** is in [`BACKLOG.md`](BACKLOG.md): "After v1.3.0" (the roadmap), "Open after
  the backlog round" (known gaps) and the decisions waiting for the user.
- Licence: MIT code, CC BY 4.0 content, third-party data under its own terms (`LICENSE`,
  `LICENSE-CONTENT.md`, `docs/DATA-SOURCES.md`).
- Tooling: `scripts/cloud-setup.sh` and `docs/cloud.md` for building in cloud sessions;
  `make review` / `make review-fetch` (`scripts/batch-review.ts`) for fact-check reviews through
  the Batch API (the API credit ran out on 2026-10-15; none until November). Rulesets: `main`
  can't be force-pushed or deleted; `v*` tags can't be moved or deleted. The `github-pages`
  environment deploys from `v*` tags and `main` (rollbacks run from main).
- Reading progress: each explainer records the reader's current step in `localStorage`
  (`src/lib/progress.svelte.ts`); the index shows Done / Continue / Start on each card.
- Index search and filters (`src/routes/+page.svelte`): a search box ("/" focuses it) and
  Area (catalogue category) and Level toggles, multi-select within a group, combined across
  groups; state in the query string (`?q=&area=physics,biology&level=1`). From 1,100 px wide they
  sit in a sticky sidebar with the progress counts (the index is 1,360 px wide so three card
  columns still fit); below that, a compact bar whose Area and Level buttons open the options,
  and the counts show once something is started. The prerendered page still lists everything;
  the options come from the built topics, so new categories and levels appear by themselves.
  Paths use `?path=<id>`, with the Path control above Area in the wide sidebar and on its own
  row under search on narrow screens.
- Local testing: other work runs on this machine, so ports can clash (4173 is taken). The test
  server uses `PW_PORT` (default 4180). In a worktree, clone `node_modules` (`cp -cR`) rather
  than symlinking it, or svelte-check checks the other checkout's types.
- The process that built the topics, for reference: one agent builds a whole topic (model, Node
  tests, narrative, scenes) in its own worktree off `main`; a second agent reviews, fact-checks
  and ticks it; the branches are merged into `main` locally and deleted. The only conflicts are
  additive (`src/app.css`, `src/lib/topics.ts`, `TopicArt.svelte`: keep both sides, or rebuild
  those registries from `main` plus each branch's own entry).

## Current development

Content audit 156–200 (2026-10-30): all 45 topics reviewed and their fixes released in v1.3.2
(CI: 2,275 model and 3,920 browser tests, deploy and live smoke green); the open items are in [`BACKLOG.md`](BACKLOG.md) item 2. The full suite passed after
the shared CSS change (3,920 browser tests); each later topic passed its targeted checks.

Development workflow optimization (2026-10-25): affected-topic checks (`make changed`), a
shared validation cache, hooks on everything not yet pushed, and one full mandatory deployment
gate that deploys the build it tested.

Second review (same day) changed the targeted browser runs: they use the production build (13 s)
through `playwright.changed.config.ts`, because Vite failed 20 of 3,917 tests that pass in
production (hydration races, the 404 page); the Vite test server is gone. Test files covering
many topics run only the selected topics (a sorting change: 30 browser tests, not 341). The
Stop hook now also checks commits made during a turn. Tooling outside the site no longer forces
the full suite. Node 26 everywhere (`.nvmrc`, so CI), with npm 11's lockfile (the old `yaml`
drift is gone) and `upload-artifact@v7` (the Node 20 deprecation warning). Validated on Node 26:
formatting, lint, types (no warnings), 14 workflow tests, 2,271 model tests and all 3,919
production browser tests. No deployment.

**Next development: first real use of the new workflow.** Inspect `make changed ARGS=--plan`
before trusting the selected scope, and include committed changes with
`BASE=<starting-commit>` (or `TOPIC=<slug>`). If selection or caching looks wrong, run the
checks fresh and fix the workflow rather than trust a skipped check. Follow each release with
`make verify`.

CI speed-up (2026-10-30): v1.3.2's build job took 22 min (checks 7.8 min in series, eslint alone
4 min; browser suite 13.7 min on 4 workers). The workflow now builds once and runs `make check`
in parallel with four browser shards (6 workers each) on that build; eslint uses 4 workers and
the model tests 6. The npm cache is off: caches made by a tag's run are scoped to that tag, so
none was ever restored. Tested by redeploying v1.3.2 (whose own code still lints serially): 8 min
end to end, shards 2.9–3.4 min each, `check` the longest at 6.9 min; all green, no cache saved. Known flaky under full-suite load (passed 20/20 alone and in the last full run):
`be-the-bird-camouflage.e2e.ts`, "the twelve-second hunt expires on the pausable stage clock".

v1.3.1 shipped the last topic review fixes (see the history archive).
The next work is in [`BACKLOG.md`](BACKLOG.md), "After v1.3.0". Parallel work (one topic or
package per session) adds one line per item here.

## History

Completed work is archived in [status-history.md](status-history.md). Historical commands
and next steps are not current workflow requirements.

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch                         # in-flight work is listed above
npm install                        # also enables the git pre-push hook
npm run dev                        # http://localhost:5173
make changed BASE=origin/main
```
