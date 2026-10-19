# Builder brief: one proposed topic, end to end

The brief every builder agent gets for one topic of [`TOPICS-PROPOSAL.md`](../../TOPICS-PROPOSAL.md)
(the user, 2026-10-18: "start building topics, topic by topic; for each topic commit, push and
continue"). The lead session runs one builder at a time, in the main checkout, on `main`.

## Read first

1. `CLAUDE.md` (workflow, testing philosophy, static checks), `README.md` ("How an explainer
   works", "Adding a new explainer"), `docs/scene-guide.md` (the scene contract: follow it
   exactly).
2. `docs/TOPICS.md`: everything above "Checklist", and the entries of the topic's prerequisites
   and related topics.
3. The topic's entry in `docs/TOPICS-PROPOSAL.md`, with its proposal notes (`>` lines: why, data,
   nearest existing page), and its record in `docs/proposals/topics-200/data/final.json` (the
   judges' and reviewer's notes, `verifyNote`, explain what was checked and fixed).
4. One or two built topics of the same kind or category as references (for an AI page,
   `src/routes/transformers/` and `src/routes/language-models/`; read `src/lib/topics.ts`,
   `src/lib/components/TopicArt.svelte` and the end of `src/app.css` for the registry, the card
   vignette and the colour tokens).

## Build

1. **Promote the entry:** `node docs/proposals/topics-200/scripts/promote.mjs <slug>` adds it to
   `docs/TOPICS.md` (unticked) with its reverse links. If the topic promotes an item of the
   catalogue's Reserve list (see the Reserve table in the proposal), remove that item from the
   Reserve section of `TOPICS.md`. If `src/routes/<slug>/` already exists, an earlier builder died:
   run `make check`, read what is there and finish it rather than start over (skip the promotion
   if the entry is already in `TOPICS.md`). If the build shows that the entry must
   change (an interaction that cannot be built as written, a wrong claim), change the entry in
   `TOPICS.md` and say so in the report: do not quietly build something else.
2. **Model first**, in plain TypeScript under `src/routes/<slug>/`, with Node tests in
   `e2e/<slug>-model.e2e.ts` that check real-world results (a law, a limiting case, a number the
   narrative quotes), never a formula re-typed from the code. Real data only, with its source and
   licence: add it to `docs/DATA-SOURCES.md`, and keep any script that built a data file in
   `scripts/data/<slug>/`. If the data the entry needs is not openly available, stop and report.
3. **Narrative** in `steps.ts` at the entry's level, assuming only its prerequisites; a "Go
   deeper" note where the page simplifies. The pitfall in the entry must be avoided explicitly.
4. **Scenes and stage**, following the scene guide; register the explainer in
   `src/lib/topics.ts`, add a card vignette in `TopicArt.svelte` and colour tokens in `app.css`
   if needed (keep both sides of these shared files intact).
5. **Screenshots:** run your own dev server on a free port in the background
   (`npx vite dev --port 5190 --strictPort > /tmp/<slug>-dev.log 2>&1 &`, stop it when done; if
   the port is taken by a dead builder's server, `lsof -ti:5190 | xargs kill` first) and
   take the scene guide's matrix with `scripts/shot.mjs` into a scratch directory outside the
   repository (every step, both themes, two times, controls at extremes, reduced motion, a phone
   width with `TOUCH=1`). Look at every image and fix what is wrong.
6. **Browser test** `e2e/<slug>.e2e.ts` for the behaviour worth guarding (controls, the model's
   visible result), following the testing philosophy (no `waitForTimeout`; reduced motion,
   keyboard or the fake clock). Locate the stage with
   `page.locator('.stage svg > g:not([data-leaving])')`: during a scene cross-fade the outgoing
   scene's `<g>` is still there, marked `data-leaving`.

## Fact-check and finish

7. **External fact-check:** `node scripts/local-review.mjs <slug>` (Codex, GPT 6.1 Sol, read-only
   with web search; takes 5 to 15 minutes; run it in the background and poll for the file). If
   Codex fails, use `grok` (`node scripts/local-review.mjs <slug> grok`) or pi
   (`pi:kimi-coding/k3`). Apply `docs/reviews/<slug>.md` by checking each fix against its source
   (reject a fix that is wrong, and say why in the report), then delete the report.
8. **Done:** tick the topic in the `docs/TOPICS.md` checklist (definition of done), add a row
   to `docs/TIMELOG.md` under the topic table (one row: model, narrative, scenes, tests, review,
   with start and end times and a note).
9. **Checks:** `make check` must pass; then the topic's tests
   (`npx playwright test e2e/<slug>` and `npx playwright test e2e/scenes.e2e.ts -g "<slug>"`,
   plus `e2e/catalog.e2e.ts` via `make check`), then `make e2e-full` once (about 3 minutes; run it
   in the background and start no other Playwright command meanwhile).
10. **Commit and push:** commit locally after each phase (model and tests, narrative, scenes),
    but push only when the topic is done (the pre-push hook would fail on a half-built tree).
    Stage files by path, never `git add -A` (the local `package-lock.json`
    has drift that must not be committed). One or a few commits named `<slug>: ...`, ending with
    the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Then
    `git push origin main` (the pre-push hook runs `make check`). If the push is rejected, `git
pull --rebase origin main` and push again. Do not release.

## Report (your final message)

The commit hashes; one paragraph on what the page does and its model; the fact-check (findings
applied, rejected and why); any change to the catalogue entry; anything knowingly left imperfect;
and whether `make e2e-full` passed. Keep it under 250 words.

## Parallel builds (from 2026-10-18, at the user's request)

Up to three builders run at once, each in its own git worktree on its own branch, and each is
given a number N (1, 2 or 3) by the lead.

- **Setup:** in the worktree, `cp -cR /Users/guillem/Development/how-things-work/node_modules
node_modules` (a copy-on-write clone; a symlink makes `make check` refuse). Use the dev-server
  port `519N` and run every Playwright command with `PW_PORT=418N` (`make e2e-full` too), so
  builders don't collide. Run `make e2e-full` with `--workers=4`
  (`PW_PORT=418N npx playwright test --workers=4`), not the default.
- **Paths:** the brief's commands are relative to the repository root, which is your worktree.
  The fact-check script, the promotion script and the data all live in the worktree too.
- **Landing your topic** (instead of a plain push): `git fetch origin && git rebase origin/main`.
  Shared files conflict when another builder landed first:
  - `docs/TOPICS.md`: take `origin/main`'s version (`git checkout --theirs docs/TOPICS.md` during
    the rebase of the commit that promoted the entry, or `git show origin/main:docs/TOPICS.md`),
    re-run `node docs/proposals/topics-200/scripts/promote.mjs <slug>`, then re-apply your own
    later edits to the file (the tick, any change to your entry).
  - `src/lib/topics.ts`, `src/lib/components/TopicArt.svelte`, `src/app.css`,
    `docs/TIMELOG.md`, `docs/DATA-SOURCES.md`: keep both sides.
  - Then `make check` and your topic's tests again, and `git push origin HEAD:main`. If the push
    is rejected because someone landed meanwhile, fetch, rebase and push again.
- Scratch files (screenshots, helper scripts) go in a directory named after your slug
  (`<scratchpad>/<slug>/`), never at the scratchpad's top level: builders share it.
- Never touch another builder's topic files. Leave the worktree as it is when you finish (the
  lead removes it).
