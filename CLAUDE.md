# How Things Work — working agreement

A static SvelteKit site of animated explainers, deployed to GitHub Pages at
https://guillem.github.io/how-things-work/. One developer, working with agents. Read
`docs/STATUS.md` (where the work stands) before starting, and `README.md` for the architecture.

## Workflow: trunk-based, releases by tag

- Commit straight to `main`. No pull requests, no long-lived branches. Push when a piece of work
  is done and `make check` passes. Pushing deploys nothing.
- `make check` (formatting, lint, types, model tests; ~20 s) runs automatically: the Claude Code
  Stop hook runs it before every turn ends and hands failures back, and the git pre-push hook runs
  it before every push. Both skip it when nothing changed since the last pass.
- `make e2e`: smoke tests of the critical paths (~8 s). `make e2e-full`: every browser test
  (~45 s). Run `make e2e-full` before a release, and whenever a change touches the shared
  framework (`src/lib`) or a scene's behaviour.
- **Release:** `make release` tags `main` (next patch version, or `V=v1.2.3`) and pushes it. The
  tag runs `.github/workflows/release.yml`: checks and all tests on a clean machine, build, deploy,
  then a smoke test of the live site. `make verify` follows the run.
- **Rollback:** `make rollback` redeploys the release before the live one (`TO=v1.2.3` picks one).
  Tags are never moved or deleted.
- Parallel work (e.g. one agent per topic) happens in local git worktrees. Merge their branches
  into `main` locally, delete them, push `main`. Don't push topic branches. In a worktree,
  `node_modules` must be a copy-on-write clone, not a symlink:
  `cp -cR <main checkout>/node_modules node_modules` (a symlink makes svelte-check type-check the
  other checkout; `make check` refuses it).
- Stage files by path, never `git add -A`: the local `package-lock.json` has drift that must not
  be committed.

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
- **Characterization tests** record current behaviour, including suspected bugs (marked in a
  comment, e.g. the nested-URL 404 test in `site.e2e.ts`). If one starts failing because the bug
  was fixed, update it.

## Static checks

- TypeScript `strict` plus `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
  `noUnusedParameters` and `noImplicitReturns`.
- ESLint includes typescript-eslint's type-checked rules. Some files have older `no-unsafe-*`
  findings; they are listed in a baseline in `eslint.config.js`. Shrink that list, never grow it.
- `svelte-check` runs with `--fail-on-warnings`.

## Local environment

- Other apps run on this machine: port 4173 is taken. The test server uses `PW_PORT` (default
  4180).
- Screenshot review of scenes: `scripts/shot.mjs` (see README and `docs/scene-guide.md`).
  Screenshots go to a scratch directory outside the repository.
