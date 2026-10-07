# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-07 18:43 UTC.

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
     loop over every explainer; these status/backlog/time-log docs. **State: done, tests pass,
     pushed to origin; PR not opened yet (see open questions).**
  2. **`topic/epidemics`** (base `site/catalogue-index` — it needs the page shell; rebase onto
     `main` once the first PR is merged). **State: in progress, see below.**

## Current development: epidemics

Catalogue entry `epidemics` (Body & Medicine, level 1, simulate, no prerequisites; related
`ecosystems`, `mrna-vaccines`).

Plan (tick as done):

- [x] Model (`src/routes/epidemics/model.ts`) + tests (`e2e/epidemics-model.e2e.ts`, Node only).
      Agent-based SIR with **well-mixed contacts** (anyone can meet anyone; 4 meetings/day;
      chance per meeting = R0 / (4 × D)) and exponential infectious periods, so it matches the
      SIR equations. A first version tied infection to distance; it measured R ≈ 1.7 for a slider
      value of 3 (neighbours stay the same for days), so it was replaced — the page states the
      simplification (notes of the `contacts` step).
- [x] Shared chart primitive: `src/lib/draw/Axes.svelte` + `src/lib/draw/chart.ts`.
- [x] Shared scene loader: `src/lib/explainer/SceneStage.svelte` (photosynthesis uses it too).
- [x] "Run again" control: new `action` control type (value = number of presses);
      `scripts/shot.mjs` `SET=rerun:N` presses it N times. **e2e test still to add.**
- [x] Narrative `steps.ts`: 12 steps, chapters spread / sir / herd. Real-disease R0 figures only
      in notes, with citations.
- [x] CrowdScene (steps outbreak, contacts, curves, vaccination, realworld): written and
      screenshot-checked roughly; full review matrix still to do. Default seeds chosen with a
      script (contacts: seed 150 → first case infectious 8.6 days, 30 meetings, infects 3).
- [ ] TreeScene (r0, exponential), SirScene (compartments, peak, overshoot), RunsScene (chance),
      ThresholdScene (threshold): being drafted by four parallel agents from detailed briefs
      (each verifies with screenshots and reports). If interrupted: the files may hold partial
      drafts — check them with the screenshot helper before trusting them.
- [ ] Card art in `TopicArt.svelte`; e2e test for the action control and the epidemics controls.
- [ ] Review: screenshot matrix per scene (both themes, two WAITs, control extremes, reduced
      motion), parallel reviewers, adversarial second look, fact-check of the narrative.
- [ ] Tick `epidemics` in the TOPICS.md checklist; log times; push; PR.

Next action: integrate the four scene drafts, then the review round.

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
