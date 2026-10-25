# How Things Work

Interactive, animated explanations of how complex things work — science, technology, anything.
Everything runs in the browser; there is no backend. The site is a static build published to
GitHub Pages: **[Explore the explainers](https://guillem.github.io/how-things-work/)**.
See [`docs/STATUS.md`](docs/STATUS.md) for the current release and catalogue progress.

**Stack:** [SvelteKit](https://svelte.dev/docs/kit) (static adapter, every page prerendered),
Svelte 5, TypeScript, plain SVG for the illustrations, [Playwright](https://playwright.dev) for
end-to-end tests. No CSS framework: a small set of design tokens in `src/app.css` drives the
light and dark themes.

## Develop

```sh
nvm use             # match deployment Node version from .nvmrc
npm install
npm run dev          # http://localhost:5173
make changed        # affected static/model/browser checks; no production build for topic edits
make changed TOPIC=electric-circuits  # explicitly validate a topic, including after committing
make changed BASE=HEAD~1             # include changes in the last commit
make changed ARGS=--plan             # inspect the selected scope without running checks
make test-server    # optional: keep test Vite server running for fast repeated runs
make check          # all static/model checks; successful stages cached locally
make check ARGS=--fresh  # bypass successful-stage stamps
make e2e            # production smoke tests (builds the whole site)
make e2e-full       # every production browser test (mandatory in deployment CI)
make format         # prettier --write
npm run build        # static site in ./build
```

The first time you run the browser tests you need the browser: `npx playwright install chromium`.
Traces are recorded only in CI (they cost about a quarter of the run); add `--trace on` to record
one for a failing test locally.
Production browser tests build the site for the `/how-things-work/` sub-path and serve it the way GitHub Pages does
(`scripts/serve-pages.mjs`) on port `PW_PORT` (default 4180). How we work and test is in
[`AGENTS.md`](AGENTS.md); building topics in cloud sessions and reviewing them through the Batch API
is in [`docs/cloud.md`](docs/cloud.md).

The development test server uses `PW_DEV_PORT` (default 4181) and verifies it belongs to
this checkout before reusing it. Use separate ports for simultaneous worktrees. Model,
development-browser and production-browser artifacts use separate folders under `test-results/`.

To look at a scene the way a visitor sees it, run the dev server and take screenshots of the stage
with the helper (every step, both themes, at two different animation times):

```sh
CLIP=stage WAIT=1500 node scripts/shot.mjs shots "http://localhost:5173/photosynthesis/#atp" light
CLIP=stage WAIT=5000 node scripts/shot.mjs shots "http://localhost:5173/photosynthesis/#atp" dark
SET=light:0 CLIP=stage node scripts/shot.mjs shots "http://localhost:5173/photosynthesis/#atp" dark
```

The header of `scripts/shot.mjs` lists all options (`SET=` to preset controls, `GOTO=` to move to
another step afterwards, `REDUCED=1` for the reduced-motion frame). It prints the PNG path and any
console errors.

## Deploy

Releases happen by tag only: `make release` tags `main` (the next patch version, or
`V=v1.2.3`) and pushes it. The tag runs `.github/workflows/release.yml`. On a clean machine it
runs fresh `make check` and every browser test on the `/how-things-work/` production build,
then deploys that exact tested build with GitHub Pages. There is no second build.
`scripts/verify-live.mjs` waits until the live site serves the new build and checks every page and asset. `make verify` follows the run. Pushing to
`main` deploys nothing.

`make rollback` redeploys the release before the live one (`TO=v1.2.3` picks one) by running
the same workflow by hand for that tag, including fresh full tests before deploying. Tags are not moved.

One-time repository settings: **Settings → Pages → Source: GitHub Actions**; **Settings →
Environments → github-pages**: allow the tags `v*` and the branch `main`. The site is served from
`https://<user>.github.io/<repo>/`, so the production test configuration builds with the base path `/<repo>`.
For a custom domain, adjust the base path in both Playwright configurations and the
base-path assertions in the site tests.

## Project layout

```
src/
  app.html                 HTML shell; applies the saved theme before first paint
  app.css                  design tokens (light + dark), base styles, stage palette
  lib/
    site.ts                site name, tagline, repository URL
    catalog.ts             the topic catalogue, parsed from docs/TOPICS.md at build time
    catalog-parse.ts       the pure parser behind it (also run in Node by the catalogue test)
    topics.ts              registry of the built explainers (index page, cross-links)
    theme.svelte.ts        theme state (light / dark / follows the OS)
    progress.svelte.ts     reading progress per explainer, saved in the browser's localStorage
    components/            header, footer, theme toggle, topic cards, explainer page shell
    explainer/             the explainer framework (see below)
    draw/                  SVG drawing primitives shared by all explainers
  routes/
    +page.svelte           index
    photosynthesis/        one directory per explainer
      +page.svelte         page: <ExplainerPage> with the stage
      steps.ts             the narrative: chapters, steps, controls
      PhotosynthesisStage.svelte   picks and lazy-loads a scene per step
      scenes/*.svelte      the animated SVG scenes
docs/TOPICS.md             the topic catalogue: 200 topics in 11 categories (content only)
docs/PATHS.md              ordered reading paths, chapters and authoring rules
docs/STATUS.md             where the work stands and how to resume it (the self-handover)
docs/BACKLOG.md            what to build next, known gaps
docs/full-picture.html     the one-glance status dashboard (open in a browser)
docs/TIMELOG.md            how long each development took
docs/scene-guide.md        the contract every animated scene follows
docs/cloud.md              building topics in Claude Code cloud sessions; Batch API reviews
docs/DATA-SOURCES.md       every external dataset the site ships, with its licence
docs/reviews/              fact-check reports from `make review-fetch` (applied, then deleted)
scripts/shot.mjs           screenshot helper for checking scenes in both themes
scripts/serve-pages.mjs    serves ./build like GitHub Pages, for the browser tests
scripts/release.sh         `make release`; rollback.sh: `make rollback`; verify-live.mjs: live smoke test
scripts/batch-review.ts    `make review` / `make review-fetch`: fact-checks through the Batch API
scripts/validate.mjs      cached checks and conservative affected-topic validation
scripts/validation-plan.mjs topic/test selection, with regression tests
scripts/check-if-changed.sh  affected static/model checks for hooks
scripts/cloud-setup.sh     environment setup for cloud sessions
scripts/data/<slug>/       one-off scripts that built a topic's data files from its sources
.githooks/                 the pre-push hook (enabled by `npm install`)
AGENTS.md                  authoritative workflow and testing philosophy
CLAUDE.md                  entry point for Claude Code (references AGENTS.md)
e2e/                       Playwright tests (navigation, controls, theme, a render check of every step)
```

## How an explainer works

An explainer is a list of **steps** (`ExplainerSpec` in `src/lib/explainer/types.ts`) plus a
**stage** that draws the current step. The `<Explainer>` component provides everything else:

- the layout (stage on the left, narrative on the right, stacked on small screens),
- step navigation with keyboard shortcuts (`←`/`→`, `Space`, `R`, `A`, `F`, `Home`/`End`, `?`),
- a pausable animation clock with 0.5×/1×/2× speed and optional auto-advance,
- deep links (`/photosynthesis/#atp`), a contents list, full screen, reduced-motion support,
- per-step interactive controls (`range`, `toggle`, `select`, `action`) whose values reach the
  stage as `params`. A scene moves a control with `setParam(id, value)`, and a control's
  `disabled: (params) => boolean` greys it out while, say, a "play" toggle drives it.

The stage is a Svelte snippet that receives `StageProps` on every frame: the current `step`, the
elapsed time `t` in seconds, `playing`, `reduced` (prefers-reduced-motion), `dark` and `params`.
Scenes draw everything as a pure function of `t`, so pausing, scrubbing speed and reduced motion
come for free.

### Adding a new explainer

Topics come from the catalogue in `docs/TOPICS.md`: read its preamble and the topic's entry
first. Work on `main` (or in a local worktree for parallel work, see `AGENTS.md`) and update
`docs/STATUS.md` at meaningful milestones.

1. Copy `src/routes/photosynthesis/` to `src/routes/<slug>/`, where `<slug>` is the catalogue
   slug.
2. Write the narrative in `steps.ts`: chapters, steps (HTML strings; use
   `<dfn data-def="…">term</dfn>` for hover definitions) and any controls.
3. Replace the scenes under `scenes/` and the scene map in the stage component, following
   `docs/scene-guide.md`. Reuse the primitives in `src/lib/draw/` (molecules, photons, labels,
   flows, easing and path helpers).
4. Register the explainer in `src/lib/topics.ts`. The index page then lists it under its
   catalogue category, and the page shell (`ExplainerPage.svelte`) shows its category, level and
   links to its prerequisites, related topics and the topics that build on it.
5. `e2e/scenes.e2e.ts` renders every step of every explainer automatically; add a test in
   `e2e/` for any behaviour worth guarding (controls, a model's results), following the testing
   philosophy in `AGENTS.md`.
6. When it meets the catalogue's definition of done, tick it in the `docs/TOPICS.md` checklist
   and log the time in `docs/TIMELOG.md`.

Guidelines that keep scenes consistent (spelled out in `docs/scene-guide.md`): a 960 × 600
coordinate system with a 16 px safe margin, everything that moves a pure function of `t` (no timers
or CSS animations), theme colours only through the CSS variables in `app.css` (`--stage-*`,
`--membrane`, `--stroma`, …), fixed molecule colours from `src/lib/draw/palette.ts`, labels with the
`<Label>` halo so they stay legible over drawings, and `$effect`s that depend only on `$derived`
values of `step`/`params` (never on `t`) with `Tween.set` wrapped in `untrack()`.

## Licence

Code: MIT ([`LICENSE`](LICENSE)). Original text and illustrations: CC BY 4.0. Third-party data keep
their own terms, listed in [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md). Details in
[`LICENSE-CONTENT.md`](LICENSE-CONTENT.md).
