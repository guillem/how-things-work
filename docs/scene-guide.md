# Scene authoring guide

A scene is one animated SVG drawing that illustrates one or more steps of an explainer
(SvelteKit 3 + Svelte 5 runes + TypeScript). This is the contract every scene follows, so that
pausing, speed changes, reduced motion, theming and deep links keep working for free.

Run the dev server with `npm run dev` (http://localhost:5173, hot reload).

## Read these first

- `src/lib/explainer/types.ts` — `StageProps` (what a scene receives) and `Step`
- `src/lib/draw/` — `index.ts`, `palette.ts`, `math.ts`, `Molecule.svelte`, `Photon.svelte`,
  `Flow.svelte`, `Label.svelte`: the drawing primitives; use them, do not re-invent them
- `src/routes/<explainer>/steps.ts` — the narrative. A scene must illustrate exactly what the
  text of its steps says (names, directions, counts, numbers, compartments): no more, no less
- `src/routes/photosynthesis/PhotosynthesisStage.svelte` — how scenes are mounted; the shared
  `<defs>` (`#arrowhead`, `#glow`, `#soft-shadow`)
- `src/routes/photosynthesis/scenes/LeafScene.svelte` — the reference scene: match its style
- the bottom of `src/app.css` — the theme CSS variables available to drawings

## Contract

- A scene receives `StageProps` (`step, index, t, playing, reduced, dark, params`) as individual
  props: `let { step, t, params, reduced }: StageProps = $props();` (destructure only what you
  use). The stage passes them explicitly on purpose: a `{...props}` spread is invalidated as a
  whole every frame because `t` changes.
- Render ONE `<g>` root in a 960 × 600 coordinate system. No `<svg>` element and no `<defs>` of
  your own except gradients/clipPaths whose ids are prefixed with the scene name
  (`id="calvin-grad"`).
- Keep a 16 px safe margin: nothing may be cut off at the edges.
- The stage background is `var(--stage-bg)` (light: warm off-white, dark: near-black). Draw
  compartments with the theme variables listed below when you need a background.

## Animation rules

- Everything that moves is a pure function of `t` (seconds since the step started, scaled by the
  playback speed). Looping motion: `cycle(t, period, offset)` → phase 0–1; `along(path, u)` for
  motion along a polyline (build paths with `smooth([...points])`). Fade particles in and out at
  the ends of their paths: `smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u))`.
- Never use `setInterval`, `requestAnimationFrame`, CSS animations, SMIL or `Date.now()`.
- When `reduced` is true, `t` is frozen at 2.5 s: that frame must still read as a complete,
  informative diagram (no half-faded particles parked on labels, no flash frozen mid-way).
- Smooth changes between steps that share a scene (focus, phase, highlight) and smooth reactions
  to controls use `Tween` from `svelte/motion` (600–900 ms, `cubicInOut`) or
  `Tween.of(() => value)`. Inside any `$effect`, depend ONLY on `$derived` values of
  `step`/`params` and wrap `tween.set(...)` in `untrack(...)`. NEVER read `t` inside an
  `$effect` (it changes 60 times a second).
- Control values arrive as `params[id]` (see each step's `controls` in `steps.ts`). React to them
  live, and make a "stopped" state look stopped: when a control switches a process off, fade the
  driven particles out rather than freezing them in mid-air (a frozen frame reads as "paused").
- Two sanctioned exceptions, to be used sparingly and documented in a comment:
  - "What was the control N seconds ago?" (for example carriers already in flight when the light
    is cut): a `Tween` with `delay` is the way to get a delayed copy of a control value. Tweens
    run on wall-clock time, so such delays do not scale with the 0.5×/2× speed control; keep them
    short and non-critical.
  - A quantity that is the integral of a rate which changes with a control (a rotor angle, a ring
    rotation) cannot be a pure function of `t` without snapping when the control moves. A small
    frame-to-frame accumulator inside a `$derived` is tolerated if it ignores `dt ≤ 0` (pause,
    step reset) and stays static under reduced motion. Prefer the pure function whenever a snap
    is acceptable.
- Prefer `$derived` for geometry that depends on `t`; keep per-frame work small: fewer than
  ~400 SVG nodes, no large array allocations per frame, `{#each ... (key)}` with keys everywhere.

## Visual style (match the leaf scene)

- Primitives: `<Molecule kind=… />` (CO2, H2O, O2, electron, proton, ATP, ADP, NADPH, NADP+, Pi,
  sugar with `carbons`/`phosphates`/`compact`), `<Photon />` (optionally `wavelength`),
  `<Flow />` (paths with optional arrowhead and marching dashes), `<Label />` (text with a halo,
  or `pill` for callouts).
- Fixed colours come from `colors` in `palette.ts` (molecules, electron cyan, proton pink, ATP
  orange, NADPH violet, protein complexes `colors.psii`, `colors.psi`, `colors.cytb6f`,
  `colors.atpSynthase`, `colors.rubisco`). Everything theme-dependent MUST use CSS variables:
  `var(--stage-bg)`, `var(--stage-ink)`, `var(--stage-ink-muted)`, `var(--stage-line)`,
  `var(--stage-grid)`, `var(--membrane)`, `var(--membrane-edge)`, `var(--lumen)`,
  `var(--stroma)`, `var(--cell)`, `var(--protein)`, `var(--protein-edge)`, `var(--surface)`,
  `var(--border)`, `var(--leaf)`, `var(--leaf-dark)`, `var(--leaf-vein)`, `var(--sky)`,
  `var(--carbon)`. Never hard-code white, black or grey for backgrounds, lines or text (white text
  on a fixed-colour protein is fine).
- Text: `<text>` inherits the font and `var(--stage-ink)`; use `<Label>` so the halo keeps text
  legible over drawings (`pill` for callouts; a `var(--surface)` card with a `var(--border)`
  stroke when a block of labels has to sit over a busy drawing). Sizes: 12–13 for labels, 11
  `muted` for secondary lines, 14–16 for a title or readout. Use unicode sub- and superscripts in
  SVG text: CO₂ H₂O O₂ NADP⁺ H⁺ e⁻ C₆H₁₂O₆.
- Strokes 1–1.5 px for cells and membranes, 2–3 px for emphasised paths. Rounded corners. Calm
  and uncluttered.
- Focus: the element the current step is about is at full opacity with its callout; everything
  else stays visible but dimmed (opacity 0.35–0.55) so the viewer keeps context. Dimmed parts
  must remain recognisable in BOTH themes.
- Labels must never overlap each other or sit on top of important shapes, and must never be
  crossed by moving particles; text anchored at the right edge must use `anchor="end"`.

## Verification loop (required)

1. Type-check only your scene (other scenes may be in flux while you work):
   `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "ERROR|WARNING" | grep <YourScene>`
   must print nothing.
2. `npx prettier --write src/routes/<explainer>/scenes/<YourScene>.svelte && npx eslint src/routes/<explainer>/scenes/<YourScene>.svelte`
3. Screenshots with the helper, with the dev server running (the explainer deep-links to a step
   with `#<stepId>`). Write them somewhere outside the repository (`shots/` is not ignored):

   ```sh
   CLIP=stage WAIT=1500 node scripts/shot.mjs /tmp/shots "http://localhost:5173/photosynthesis/#atp" light 1280 800 0 atp
   CLIP=stage WAIT=5000 node scripts/shot.mjs /tmp/shots "http://localhost:5173/photosynthesis/#atp" dark 1280 800 0 atp-t5
   SET=light:0 CLIP=stage WAIT=5000 node scripts/shot.mjs /tmp/shots "http://localhost:5173/photosynthesis/#atp" dark 1280 800 0 atp-dark
   SET=carbons:false GOTO=reduction CLIP=stage node scripts/shot.mjs /tmp/shots "http://localhost:5173/photosynthesis/#rubisco" light 1280 800 0 reduction-compact
   REDUCED=1 CLIP=stage node scripts/shot.mjs /tmp/shots "http://localhost:5173/photosynthesis/#atp" light 1280 800 0 atp-reduced
   ```

   `SET=` presets controls, `GOTO=` moves to another step afterwards (controls keep their values
   across steps, so a control that exists on one step can be tested on the others), `REDUCED=1`
   emulates prefers-reduced-motion. `WAIT` is roughly the animation time in milliseconds (it runs
   a few hundred milliseconds ahead under load). The script prints the PNG path and any console
   errors or warnings; there must be none.

   Take the full matrix: every step of the scene × both themes × two WAIT values (for example
   1500 and 5000 ms, to confirm that things move) × every control at its extremes, plus the
   reduced-motion frame. LOOK at every PNG and fix what you see: cut-off or overlapping text,
   illegible contrast in either theme, static-looking frames, misplaced or frozen particles,
   focus that does not follow the step, science that does not match the step text.

4. Repeat until it looks polished in BOTH themes on ALL the scene's steps, then run steps 1 and 2
   again.

## Handing a scene over

When a scene is reviewed or handed to someone else, record: the changes made and why; where the
final screenshot matrix is (both themes, every step); one line per step on what the frame shows
early and late in the step; any mismatch between the drawing and `steps.ts` that could not be
resolved inside the scene (quote the text); wishes for shared files (primitives, `app.css`,
`steps.ts`, `scripts/shot.mjs`) with the exact change; and anything knowingly left imperfect.
