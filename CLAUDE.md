# How Things Work — working agreement

A static SvelteKit site of animated explainers, deployed to GitHub Pages at
https://guillem.github.io/how-things-work/. One developer, working with agents. Read
`docs/STATUS.md` (where the work stands) before starting, and `README.md` for the architecture.
`docs/full-picture.html` is the human's one-glance dashboard (open it in a browser); the
markdown files remain the detailed books.

## Workflow: trunk-based, releases by tag

- Commit straight to `main`. No pull requests, no long-lived branches. Push when a piece of work
  is done and `make check` passes. Pushing deploys nothing.
- `make check` (formatting, lint, types, model tests; ~20 s) runs automatically: the Claude Code
  Stop hook runs it before every turn ends and hands failures back, and the git pre-push hook runs
  it before every push. Both skip it when nothing changed since the last pass.
- `make e2e`: smoke tests of the critical paths (~8 s). `make e2e-full`: every browser test
  (~2 min 50 s). Run `make e2e-full` before a release, and whenever a change touches the shared
  framework (`src/lib`) or a scene's behaviour.
- **Release:** `make release` tags `main` (next patch version, or `V=v1.2.3`) and pushes it. The
  tag runs `.github/workflows/release.yml`: checks and all tests on a clean machine, build, deploy,
  then a smoke test of the live site. `make verify` follows the run.
- **Rollback:** `make rollback` redeploys the release before the live one (`TO=v1.2.3` picks one).
  Tags are never moved or deleted.
- Parallel work (e.g. one agent per topic) happens in local git worktrees. Merge their branches
  into `main` locally, delete them, push `main`; local worktree branches aren't pushed (cloud
  sessions do push theirs: see below). In a worktree,
  `node_modules` must be a copy-on-write clone, not a symlink:
  `cp -cR <main checkout>/node_modules node_modules` (a symlink makes svelte-check type-check the
  other checkout; `make check` refuses it).
- Stage files by path, never `git add -A`: the local `package-lock.json` has drift that must not
  be committed.
- **Keep `docs/full-picture.html` in sync** whenever a milestone lands — a release, a merged batch
  or gap round, or a change to what is now/next. Counts come from the `docs/TOPICS.md` checklist,
  release lines from the git tags; update its "updated" date. The user refreshes that page instead
  of asking for status.

## Cloud sessions

Topics are often built in Claude Code cloud sessions (setup in `docs/cloud.md`): one topic per
session, several sessions in parallel. The VM can be reclaimed when the session idles, and only
pushed work survives, so:

- Work on one branch for the topic (the session's own branch, or `topic/<slug>`). **Commit and
  push after every meaningful step** (model and tests, narrative, each scene, review fixes). An
  unpushed hour is an hour that can vanish.
- Commands time out after 2 minutes by default. Run `make e2e-full` in the background, or check
  with `make e2e` plus the topic's own tests while working. The machine has 4 cores: don't start
  parallel subagents that each run the browser suite.
- Write the topic's progress into its commits and a short note in `docs/STATUS.md` under
  "Current development" (one line per topic, to keep merge conflicts small).
- **Finishing:** `git fetch origin && git rebase origin/main`. Resolve the shared registries by
  keeping both sides (`src/lib/topics.ts`, `src/lib/components/TopicArt.svelte`, `src/app.css`,
  the `docs/TOPICS.md` checklist). Run `make check` and `make e2e-full`, then
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
  or Playwright's fake clock with `playUntil()` from `e2e/play.ts`. `make check` stays under a
  minute.
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
