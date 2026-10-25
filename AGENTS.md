# How Things Work — working agreement

A static SvelteKit site of animated explainers, deployed to GitHub Pages at
https://guillem.github.io/how-things-work/. One developer, working with agents. Read
`docs/STATUS.md` for current work and `README.md` for the architecture. This file is the
authoritative workflow for all agents; historical status entries do not add requirements.
`docs/full-picture.html` is the human's one-glance dashboard (open it in a browser); the
markdown files remain the detailed books.

## AI usage and delegation

- **Prioritize AI usage over elapsed time.** Default to one builder implementing one topic or
  change at a time, directly on `main`. A request for several topics is a queue to work through
  sequentially, not permission to create a parallel batch.
- Do not automatically spawn topic builders, create worktrees, or add an orchestration agent.
  Use parallel builders when the user explicitly requests parallel work, prioritizes a deadline,
  or authorizes a batch using separately funded cloud credits. Past cloud experiments and free
  credits are historical context, not ongoing authorization.
- Reuse relevant context across straightforward topics. When a conversation becomes crowded,
  use a short handover and a fresh chat or a narrowly scoped helper; sequential work does not
  mean keeping every topic in one indefinitely growing conversation.
- Use delegation selectively when it is likely to reduce total usage or prevent costly errors:
  a bounded scientific/model review, isolated investigation, or verbose research summarized
  back to the builder. Give only the necessary context and request concise, actionable results.
  Do not routinely duplicate the whole implementation or review every file with another agent.
- Prefer batching independent tool calls or running commands in the background to launching an
  agent merely to wait for searches or tests. Waiting time itself does not require ongoing
  model generation; parallel execution mainly improves elapsed time, not usage efficiency.
- Worktree commands themselves are usually cheap; repeated discovery, delegation, reports,
  integration and rework consume AI usage. If parallel work is authorized, keep ownership clear
  and avoid repeated checks or unnecessary coordinator polling.
- Do not claim a fixed token saving or cost multiplier without comparable measurements.
  Historical weekly usage percentages combine different topics and review effort. Evaluate
  usage per completed, validated topic, including coordination and fixes, rather than speed alone.

## Workflow: trunk-based, releases by tag

- Commit straight to `main`; no PRs or long-lived branches. Pushing deploys nothing.
- During development use `make changed`: changed-file formatting, affected-file lint (including unchanged consumers), cached project types,
  affected model tests, and affected browser/scene tests against Vite. Topic selection follows
  imports and browser URLs; shared code, catalogue, configuration and unknown changes fall back
  to full validation. Never claim a targeted run proves the entire site works.
- Changes are compared with `HEAD`, including staged, unstaged and untracked files. After
  committing, use `make changed BASE=<start-commit>` or `make changed TOPIC=<slug>`.
  Explicit topics include formatting and lint for their source files and affected tests.
  Inspect selection with `make changed ARGS=--plan`.
- Start `make test-server` once to reuse the test Vite server (port 4181, override with
  `PW_DEV_PORT`). Production tests keep their separate server on `PW_PORT` (4180).
- Hooks run `make quick` (affected static/model checks, no browsers). The pre-push hook also
  includes commits since upstream. Successful full stages are cached by inputs, tooling and
  Node version; documentation changes do not invalidate types or model checks.
  Type-aware lint uses only whole-stage caching, never ESLint per-file caching. `make check`
  runs full static/model checks; `make check ARGS=--fresh` bypasses successful-stage stamps.
- **Every live deployment must pass fresh full validation first**, including rollback:
  formatting, lint, types, workflow/model tests, and every production browser test. The release
  workflow is the mandatory gate, uploads the tested build and deploys that exact artifact.
  Do not repeat the full suite locally merely because a release is next; CI runs it once.
  `make e2e-full` remains available for broad changes or local investigation.
- Release only when the user requests it: `make release` tags committed, clean `main` and pushes
  it. `make rollback` tests and redeploys an earlier tag. Tags are never moved or deleted.
- Review screenshots of changed scenes in both themes and reduced motion using
  `scripts/shot.mjs` and `docs/scene-guide.md`. Focus review on affected scenes.
- When parallel work is authorized under the policy above, use local git worktrees. Clone `node_modules` with
  `cp -cR <main checkout>/node_modules node_modules`; never symlink it. Merge locally into
  `main`, delete merged branches, and validate the combined affected changes.
- Stage files by path, never `git add -A`: the local `package-lock.json` has drift that must not
  be committed.
- Keep `docs/STATUS.md` current at meaningful milestones, rather than every commit.
  Update `docs/full-picture.html` when a release, merged batch, or roadmap change lands.
- Use Node from `.nvmrc` (`nvm use`) locally; CI reads the same file. Do not run the suite a
  second time with a different worker count unless investigating an actual failure.

## Cloud sessions

When the user requests Claude Code cloud work (setup in `docs/cloud.md`), use one topic per
session; run several sessions in parallel only when authorized under the policy above. The VM
can be reclaimed when the session idles, and only pushed work survives, so:

- Work on one branch for the topic (the session's own branch, or `topic/<slug>`). **Commit and
  push after every meaningful step** (model and tests, narrative, each scene, review fixes). An
  unpushed hour is an hour that can vanish.
- Commands time out after 2 minutes by default. Use `make changed BASE=origin/main` while
  working. If broad changes require the production suite, run it in the background. The machine
  has 4 cores: don't start parallel subagents that each run the browser suite.
- Write the topic's progress into its commits and a short note in `docs/STATUS.md` under
  "Current development" (one line per topic, to keep merge conflicts small).
- **Finishing:** `git fetch origin && git rebase origin/main`. Resolve the shared registries by
  keeping both sides (`src/lib/topics.ts`, `src/lib/components/TopicArt.svelte`, `src/app.css`,
  the `docs/TOPICS.md` checklist). Run `make changed BASE=origin/main`, then
  `git push origin HEAD:main`; if it is rejected because another session pushed first, rebase
  again and retry. Delete the topic branch on the remote afterwards. If the session can't push to
  `main` (the cloud proxy may only allow its own branch), leave the branch rebased and passing,
  and say so: the user merges it.
- Don't release. The user releases after validating (`make release`), or asks you to.
- Reviews through the Batch API: `make review TOPICS="<slug>"`, then **commit and push
  `docs/reviews/batches/` right away** (the batch id lives there; a reclaimed VM would lose it),
  and later `make review-fetch`, from any session (needs `ANTHROPIC_API_KEY`, or
  `REVIEW_ANTHROPIC_API_KEY` in the cloud). A review the server pauses is continued automatically
  in a follow-up batch; commit `docs/reviews/batches/` again.
  Apply a report in `docs/reviews/<slug>.md` by checking each fix against its source, then delete
  the report.

## Testing philosophy

- **Test behaviour, not implementation.** Assert what a visitor sees and does (text on the stage,
  a control's effect, navigation, the URL), or a model's real-world result (a physical law, a
  number the narrative quotes). Don't assert internal data shapes, private constants, or a formula
  re-typed from the code.
- **Never weaken a failing test to make it pass.** Don't loosen, skip or delete it. If the test is
  right, fix the code. If the behaviour changed on purpose, update the test to the new behaviour
  and say so in the commit.
- **Prune redundant tests.** When a test duplicates another, or asserts arithmetic on literals
  rather than our code, delete it.
- **Keep it fast and deterministic.** No `waitForTimeout`, and no waiting on wall-clock
  animation. Use reduced motion (a frozen complete frame), keyboard controls (End on a scrubber),
  or Playwright's fake clock with `playUntil()` from `e2e/play.ts`. Use affected tests while iterating; full production coverage is mandatory in the deployment workflow.
- **Where tests live** (all Playwright, in `e2e/`):
  - `*-model.e2e.ts`: pure Node tests of a topic's model (`playwright.models.config.ts`).
  - The rest drive the production build, served the way GitHub Pages serves it: under
    `/how-things-work/`, with `404.html` for unknown URLs (`scripts/serve-pages.mjs`). Navigate
    with relative URLs: `page.goto('./sorting/#bubble')`.
  - `scenes.e2e.ts` renders every step of every explainer automatically.
  - Tag a test `{ tag: '@smoke' }` only if it guards a critical path.
- **Characterization tests** record current behaviour, including suspected bugs (say so in a
  comment). If one starts failing because the bug was fixed, turn it into a regression test of
  the fixed behaviour (none are left at the moment).

## Static checks

- TypeScript `strict` plus `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
  `noUnusedParameters` and `noImplicitReturns`.
- ESLint includes typescript-eslint's type-checked rules. Some files have older `no-unsafe-*`
  findings; they are listed in a baseline in `eslint.config.js`. Shrink that list, never grow it.
- `svelte-check` runs with `--fail-on-warnings`.

## Local environment

- Other apps run on this machine: port 4173 is taken. The test server uses `PW_PORT` (default
  4180).
- `rm`, `cp` and `mv` are aliased to their `-i` form in the user's shells, so a plain call that
  removes or overwrites a file waits for a confirmation no script gives (and seems to hang). Once
  you have checked the target, write `rm -f`, `cp -f`, `mv -f`.
- Screenshot review of scenes: `scripts/shot.mjs` (see README and `docs/scene-guide.md`).
  Screenshots go to a scratch directory outside the repository.
