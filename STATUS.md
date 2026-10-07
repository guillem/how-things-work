# Hand-off status (2026-10-07)

Session stopped at the user's request; this note records where things stand so work can continue
locally. Delete this file when it is no longer useful.

## Done (committed on `claude/clever-feynman-5aruaf`)

- SvelteKit 3 static site (`@sveltejs/adapter-static`, everything prerendered to `build/`),
  GitHub Pages deploy workflow (`.github/workflows/deploy.yml`, base path from `BASE_PATH`) and a CI
  workflow (`ci.yml`: check, lint, build, Playwright).
- Light/dark theme (no-flash bootstrap in `src/app.html`, tokens in `src/app.css`, toggle persists).
- Index page with topic cards (`src/lib/topics.ts`; three "coming soon" placeholders are easy to remove).
- Explainer framework (`src/lib/explainer/`): stage + narrative layout, step navigation, keyboard
  shortcuts, playback clock with speed and auto-advance, deep links (`#stepId`), per-step controls,
  contents list, full screen, help overlay, reduced-motion handling.
- Drawing primitives (`src/lib/draw/`): molecules, photons, flows, labels, palette, math helpers.
- Photosynthesis explainer: 16-step narrative (`steps.ts`), stage with lazy-loaded scenes, and six
  scenes. `LeafScene` (steps 1–3, continuous zoom leaf → cross-section → chloroplast) is finished and
  reviewed. `SpectrumScene`, `MembraneScene`, `ZSchemeScene`, `CalvinScene`, `SummaryScene` are
  complete first drafts written by parallel agents against `docs/scene-guide.md`; they type-check,
  lint and render in both themes, but have NOT had their review/polish pass yet (see below).
- README, 404 page, favicon, Playwright e2e tests (`e2e/`, 8 tests, all passing at the time of the
  last run), `scripts/shot.mjs` screenshot helper.

## Not finished

1. **Scene polish.** Each of the five agent-built scenes should get a careful look in both themes on
   every step (`npm run dev`, then e.g.
   `WAIT=3000 CLIP=stage node scripts/shot.mjs shots "http://localhost:5173/photosynthesis/#atp" dark`),
   checking label overlaps, legibility, that things move, focus/dimming per step, and the controls
   (`light`, `wavelength`, `carbons`). A visual review of `SpectrumScene` had just started.
2. **Narrative corrections from the fact-check.** 211 claim checks were run (two lenses each);
   13 flags came back, mostly good catches. Suggested edits to `src/routes/photosynthesis/steps.ts`:
   - `pigments`: say green light is absorbed _weakly_ rather than "mostly reflected or passed
     through" (an intact leaf still absorbs most green light thanks to internal scattering); and in
     the notes, say protein-bound chlorophyll's red peak shifts by ~15–20 nm to ~675–680 nm (not "a few
     nanometres").
   - `antenna`: the reaction centre is the protein–pigment core containing the special pair _and_
     the electron-acceptor chain; the special pair is its primary donor.
   - `water`: "waste product" → "by-product; the plant uses some O₂ in its own respiration and the
     surplus leaves through the stomata".
   - `etc` (notes): the Q-cycle doubles the proton yield of the cytochrome b₆f _step_ (1 → 2 H⁺ per
     electron), raising the whole chain from 2 to 3 H⁺ per electron (8 → 12 per O₂), not "nearly
     doubles the chain".
   - `psi`: the electron passes a chlorophyll (A₀) and a phylloquinone (A₁) before the three
     iron–sulfur clusters and ferredoxin.
   - `atp`: "the only way back out" → "the main way back out" (small passive leak exists).
   - `rubisco`: "busiest enzyme" → "most abundant enzyme (and one of the slowest, ~3 CO₂/s)".
   - `reduction` (dfn): "Reduction stores energy; oxidation releases it" is too general; say
     reducing carbon to sugar stores energy and oxidising it back releases it.
   - `sugar`: "two turns of the cycle" → "two rounds of three CO₂" (a textbook "turn" is one CO₂).
3. **Final pass:** `npm run check && npm run lint && npm run build && npx playwright test`
   (locally: `npx playwright install chromium` first), a mobile-width look at every step, then merge
   to `main` and enable Pages (Settings → Pages → Source: GitHub Actions).

## Things worth knowing

- SvelteKit 3 conventions used here: config lives in `vite.config.ts` (`sveltekit({ adapter, paths,
prerender })`), `#lib/...` subpath imports need the file extension (`#lib/site.ts`,
  `#lib/theme.svelte.ts`), `$app/env` replaces `$app/environment`, `resolve()` from `$app/paths`
  is typed against real routes (`Path` type).
- Scenes receive explicit props from `PhotosynthesisStage.svelte` on purpose: spreading `{...props}`
  invalidates every prop each frame (because `t` changes) and re-runs any `$effect` 60×/s. Inside a
  scene, `$effect`s must depend only on `$derived` values of `step`/`params`, and `Tween.set` must be
  wrapped in `untrack()` (see `LeafScene.svelte`).
- Playwright can use a pre-installed Chromium via `PW_CHROMIUM_PATH` (both `playwright.config.ts`
  and `scripts/shot.mjs` honour it).
