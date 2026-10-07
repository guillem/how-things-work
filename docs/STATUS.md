# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-07 18:30 UTC.

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
- **Merging to `main` deploys** to https://guillem.github.io/how-things-work/ (GitHub Pages). The
  user decides merges; never merge without being asked.
- The quality bar is the photosynthesis explainer: narrative depth, scenes that match the text,
  both themes, reduced motion, every step screenshot-reviewed (method in `scene-guide.md`).
- Never commit the local `package-lock.json` drift (an optional `yaml` entry dropped by a local
  npm run); stage files by path, not with `git add -A`.
- Screenshots go to a scratch directory outside the repository.

## Current state

- `main`: photosynthesis explainer (published, not ticked — see BACKLOG "Known gaps"), topic
  catalogue.
- In flight, in order:
  1. **`site/catalogue-index`** (base `main`) — index page grouped by catalogue category, showing
     only built topics; catalogue parsed from `docs/TOPICS.md` at build time
     (`src/lib/catalog.ts`); shared explainer page shell with "Read first / Related / Leads on to"
     links (`ExplainerPage.svelte`, `TopicLinks.svelte`); catalogue invariants test; scene tests
     loop over every explainer; these status/backlog/time-log docs. **State: done, tests pass;
     to push and PR.**
  2. **`topic/epidemics`** (base `site/catalogue-index` — it needs the page shell; rebase onto
     `main` once the first PR is merged). **State: not started.**

## Current development: epidemics

Catalogue entry `epidemics` (Body & Medicine, level 1, simulate, no prerequisites; related
`ecosystems`, `mrna-vaccines`).

Plan (tick as done):

- [ ] Model (`src/routes/epidemics/model.ts`): agent-based SIR on a torus with exponential
      infectious periods, R0 calibrated from contact density; deterministic SIR ODE, final-size
      equation, herd-immunity threshold; Node tests comparing agents with theory.
- [ ] Shared chart primitive in `src/lib/draw/` (axes + series as single paths).
- [ ] "Run again" control type in the explainer framework (+ e2e test).
- [ ] Narrative `steps.ts` (3 chapters: spread, the SIR model, herd immunity).
- [ ] Scenes: crowd + live plot; transmission tree (R0); SIR compartments + curves; threshold.
- [ ] Register the topic, card art, e2e coverage.
- [ ] Review: screenshot matrix per scene (both themes, two WAITs, control extremes, reduced
      motion), parallel reviewers, adversarial second look, fact-check of the narrative.
- [ ] Tick `epidemics` in the TOPICS.md checklist; log times; push; PR.

Next action: push `site/catalogue-index`, then branch `topic/epidemics` from it and write the
model.

## Open questions for the user

- Should Claude open the PRs (and merge when asked), or does the user open them? Until answered,
  Claude pushes the branch and stops.

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch -a                      # in-flight branches are listed above
npm install
npm run dev                        # http://localhost:5173
npm run check && npm run lint && npm run test:e2e
```
