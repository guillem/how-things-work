# Scene authoring guide

You are building ONE animated SVG scene for an interactive explainer site
(SvelteKit 3 + Svelte 5 runes, TypeScript). The site is in /home/user/how-things-work.
Run the dev server with `npm run dev` (http://localhost:5173, hot reload).

## Read these first

- src/lib/explainer/types.ts — `StageProps` (what your scene receives) and `Step`
- src/lib/draw/index.ts, palette.ts, math.ts, Molecule.svelte, Photon.svelte, Flow.svelte, Label.svelte
- src/routes/photosynthesis/steps.ts — the narrative; your scene must illustrate exactly what the
  text of YOUR steps says (names, directions, counts, numbers)
- src/routes/photosynthesis/PhotosynthesisStage.svelte — how scenes are mounted (defs: #arrowhead, #glow, #soft-shadow)
- src/routes/photosynthesis/scenes/LeafScene.svelte — the finished reference scene: match its style
- src/app.css (bottom) — theme CSS variables available to drawings
- Reference: the finished leaf scene (take screenshots of steps 1–3 with scripts/shot.mjs).

## Contract

- Your component receives `StageProps` (`step, index, t, playing, reduced, dark, params`) as
  individual props: `let { step, t, params, reduced }: StageProps = $props();` (destructure only what you use).
- Render ONE `<g>` root in a 960 × 600 coordinate system. No `<svg>` element, no `<defs>` of your own
  except gradients/clipPaths with ids prefixed by your scene name (e.g. `id="calvin-grad"`).
- Keep a 16 px safe margin; nothing may be cut off at the edges.
- The stage background is `var(--stage-bg)` (light: warm off-white, dark: near-black). Draw compartments
  with the theme variables below when you need a background.

## Animation rules

- Everything that moves is a pure function of `t` (seconds since the step started, scaled by speed).
  Looping motion: `cycle(t, period, offset)` → phase 0–1; `along(path, u)` for motion along a polyline
  (build paths with `smooth([...points])`). Fade particles in/out at the ends of their paths
  (`smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u))`).
- Never use setInterval, requestAnimationFrame, CSS animations, SMIL or `Date.now()`.
- When `reduced` is true, `t` is frozen at 2.5 s: the frame must still read as a complete, informative diagram.
- Smooth changes between steps that share your scene (focus/phase/highlight changes): use
  `Tween` from 'svelte/motion' (duration 600–900 ms, `cubicInOut`), or `Tween.of(() => value)`.
  Inside any `$effect`, depend ONLY on `$derived` values of `step`/`params` and wrap `tween.set(...)` in
  `untrack(...)`. NEVER read `t` inside an `$effect` (it changes 60×/s).
- Control values arrive as `params[id]` (see each step's `controls` in steps.ts). React to them live.
- Prefer `$derived` for geometry that depends on t; keep per-frame work small: < ~400 SVG nodes,
  no large array allocations per frame, `{#each ... (key)}` with keys everywhere.

## Visual style (match the leaf scene)

- Primitives: `<Molecule kind=… />` (CO2, H2O, O2, electron, proton, ATP, ADP, NADPH, NADP+, Pi,
  sugar with `carbons`/`phosphates`/`compact`), `<Photon />` (optionally `wavelength`), `<Flow />` (paths
  with optional arrowhead and marching dashes), `<Label />` (text with halo, or `pill`).
  Use them; do not re-invent molecule drawings.
- Fixed colours come from `colors` in palette.ts (molecules, electron cyan, proton pink, ATP orange,
  NADPH violet, protein complexes: `colors.psii`, `colors.psi`, `colors.cytb6f`, `colors.atpSynthase`,
  `colors.rubisco`). Everything theme-dependent MUST use CSS variables:
  `var(--stage-bg)`, `var(--stage-ink)`, `var(--stage-ink-muted)`, `var(--stage-line)`, `var(--stage-grid)`,
  `var(--membrane)`, `var(--membrane-edge)`, `var(--lumen)`, `var(--stroma)`, `var(--cell)`,
  `var(--protein)`, `var(--protein-edge)`, `var(--surface)`, `var(--border)`, `var(--leaf)`, `var(--leaf-dark)`,
  `var(--sky)`. Never hard-code white/black/grey for backgrounds, lines or text.
- Text: `<text>` already inherits the font and `var(--stage-ink)`; use `<Label>` (halo keeps text legible
  over drawings; `pill` for callouts). Sizes: 12–13 for labels, 11 `muted` for secondary lines, 14–16 for a
  title/readout. Use unicode sub/superscripts in SVG text: CO₂ H₂O O₂ NADP⁺ H⁺ e⁻ C₆H₁₂O₆.
- Strokes 1–1.5 px for cells/membranes, 2–3 px for emphasised paths. Rounded corners. Calm, uncluttered.
- Focus: the element the current step is about is at full opacity with its callout; everything else
  stays visible but dimmed (opacity 0.35–0.55), so the viewer keeps context.
- Labels must never overlap each other or sit on top of important shapes; text anchored at the right
  edge must use `anchor="end"`.

## Verification loop (required — do it, don't skip)

1. `cd /home/user/how-things-work && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "ERROR|WARNING" | grep <YourScene>`
   must print nothing (other scenes may have errors while others work on them — ignore those).
2. `npx prettier --write src/routes/photosynthesis/scenes/<YourScene>.svelte && npx eslint src/routes/photosynthesis/scenes/<YourScene>.svelte`
3. Screenshots with the helper (with the dev server running; the explainer deep-links to a step with `#<stepId>`):
   (from the repository root)
   CLIP=stage WAIT=1500 node scripts/shot.mjs shots/<yourscene> "http://localhost:5173/photosynthesis/#<stepId>" light 1280 800 0 <name>
   CLIP=stage WAIT=4000 node scripts/shot.mjs shots/<yourscene> "http://localhost:5173/photosynthesis/#<stepId>" dark 1280 800 0 <name>-t4
   SET=light:0 CLIP=stage WAIT=2500 node shot.mjs ... (sets a control before the shot; see the header of shot.mjs)
   The script prints the PNG path and any console errors — there must be none. LOOK at every PNG
   (use the Read tool on the path) and fix what you see: cut-off or overlapping text, illegible contrast in
   either theme, static-looking frames, misplaced particles. Take shots at two different WAIT values to
   confirm things move. Repeat until it looks polished in BOTH themes on ALL your steps.
4. Final: run step 1 and 2 again.

## Output

Your final message is data for the orchestrator (not prose for a human): the file you wrote, the
screenshot paths you ended with (light + dark for every step), a 5-line summary of what the scene shows
per step, and any known limitation or primitive you wished existed.
