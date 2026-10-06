# How Things Work

Interactive, animated explanations of how complex things work — science, technology, anything.
Everything runs in the browser; there is no backend. The site is a static build published to
GitHub Pages.

**Stack:** [SvelteKit](https://svelte.dev/docs/kit) (static adapter, every page prerendered),
Svelte 5, TypeScript, plain SVG for the illustrations, [Playwright](https://playwright.dev) for
end-to-end tests. No CSS framework: a small set of design tokens in `src/app.css` drives the
light and dark themes.

## Develop

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # type-check (svelte-check)
npm run lint         # prettier + eslint
npm run format       # prettier --write
npm run build        # static site in ./build
npm run preview      # serve ./build on http://localhost:4173
npm run test:e2e     # Playwright tests against the production build
```

The first time you run the tests locally you need the browser: `npx playwright install chromium`.

## Deploy

Pushes to `main` run `.github/workflows/deploy.yml`, which builds the site and publishes it with
GitHub Pages. One-time setup in the repository settings:

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. Push to `main` (or run the workflow manually from the Actions tab).

The site is served from `https://<user>.github.io/<repo>/`, so the build is given the base path
`/<repo>` through the `BASE_PATH` environment variable. If you add a custom domain, or rename the
repository to `<user>.github.io`, set `BASE_PATH` to an empty string in the workflow.

Every other push and every pull request runs `.github/workflows/ci.yml` (type-check, lint, build,
Playwright).

## Project layout

```
src/
  app.html                 HTML shell; applies the saved theme before first paint
  app.css                  design tokens (light + dark), base styles, stage palette
  lib/
    site.ts                site name, tagline, repository URL
    topics.ts              registry of explainers shown on the index page
    theme.svelte.ts        theme state (light / dark / follows the OS)
    components/            header, footer, theme toggle, topic cards
    explainer/             the explainer framework (see below)
    draw/                  SVG drawing primitives shared by all explainers
  routes/
    +page.svelte           index
    photosynthesis/        one directory per explainer
      +page.svelte         page: metadata + <Explainer> with the stage
      steps.ts             the narrative: chapters, steps, controls
      PhotosynthesisStage.svelte   picks and lazy-loads a scene per step
      scenes/*.svelte      the animated SVG scenes
e2e/                       Playwright tests
```

## How an explainer works

An explainer is a list of **steps** (`ExplainerSpec` in `src/lib/explainer/types.ts`) plus a
**stage** that draws the current step. The `<Explainer>` component provides everything else:

- the layout (stage on the left, narrative on the right, stacked on small screens),
- step navigation with keyboard shortcuts (`←`/`→`, `Space`, `R`, `A`, `F`, `Home`/`End`, `?`),
- a pausable animation clock with 0.5×/1×/2× speed and optional auto-advance,
- deep links (`/photosynthesis/#atp`), a contents list, full screen, reduced-motion support,
- per-step interactive controls (`range`, `toggle`, `select`) whose values reach the stage as
  `params`.

The stage is a Svelte snippet that receives `StageProps` on every frame: the current `step`, the
elapsed time `t` in seconds, `playing`, `reduced` (prefers-reduced-motion), `dark` and `params`.
Scenes draw everything as a pure function of `t`, so pausing, scrubbing speed and reduced motion
come for free.

### Adding a new explainer

1. Copy `src/routes/photosynthesis/` to `src/routes/<slug>/`.
2. Write the narrative in `steps.ts`: chapters, steps (HTML strings; use
   `<dfn data-def="…">term</dfn>` for hover definitions) and any controls.
3. Replace the scenes under `scenes/` and the scene map in the stage component. Reuse the
   primitives in `src/lib/draw/` (molecules, photons, labels, flows, easing and path helpers).
4. Register the explainer in `src/lib/topics.ts` so it appears on the index page.
5. Add a test in `e2e/` if the explainer has behaviour worth guarding.

Guidelines that keep scenes consistent: a 960 × 600 coordinate system, theme colours only through
the CSS variables in `app.css` (`--stage-*`, `--membrane`, `--stroma`, …), fixed molecule colours
from `src/lib/draw/palette.ts`, labels with the `<Label>` halo so they stay legible over drawings,
and `$effect`s that depend only on `$derived` values of `step`/`params` (never on `t`).
