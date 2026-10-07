# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-07 20:30 UTC.

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

- `main` (deployed): photosynthesis (published, not ticked — BACKLOG "Known gaps"), epidemics
  (done, ticked), catalogue-driven index, status/backlog/time log. PRs #1 and #2 merged
  2026-10-07.
- In flight: **`topic/unit-circle`** (base `main`). State: in progress, see below.

## Current development: unit-circle

Catalogue entry `unit-circle` (Mathematics, level 1, manipulate, no prerequisites; leads on to
complex-numbers, fourier-transform, waves-interference). First `manipulate` topic.

Plan (tick as done):

- [x] Shared draggable point: `src/lib/draw/Handle.svelte` (role=slider, arrows/Shift/Home/End) + `src/lib/draw/pointer.ts` (`toSvg`, `startDrag`). Explainer: keys on a focused handle go
      to the handle; stage is `role="group"`.
- [x] `trig.ts` (exact values, π multiples, angle of a dragged point), `steps.ts` (9 steps:
      angles / sine and cosine / from circle to wave), page, stage, registry, card art, colours
      `--trig-sin` / `--trig-cos`.
- [x] CircleScene (circle, coordinates, triangle, quadrants): written and screenshot-checked.
- [x] e2e `e2e/unit-circle.e2e.ts`: drag sets the angle, keys, snap.
- [x] RadiansScene (radians) and WaveScene (sine, cosine, periodic, oscillation): drafted by two
      agents with their own screenshot matrices and Playwright interaction tests; committed.
- [x] `StageProps.setParam`: scenes change controls through it (writing to `params` triggered
      Svelte's ownership warning). Scene guide updated.
- [ ] Review round running (3 agents: circle+radians, wave, whole page + fact-check). If
      interrupted: scene files may hold uncommitted reviewer fixes — check `git diff`.
- [ ] Review round (adversarial reviewers, whole-page read, definition of done), all checks,
      tick, time log, then ask the user to validate.

Next action: apply the review findings, run all checks, tick, log time, ask the user to validate.

## Open questions for the user

- None right now. (Answered 2026-10-07: Claude opens and merges PRs after the user validates.)

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch -a                      # in-flight branches are listed above
npm install
npm run dev                        # http://localhost:5173
npm run check && npm run lint && npm run test:e2e
```
