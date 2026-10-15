# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-15 UTC.

## How we work

- [`TOPICS.md`](TOPICS.md) is the catalogue (100 topics, 11 categories; content only). Do not
  change its topics or categories; the only edit we make is ticking a topic in its checklist once
  it meets the catalogue's definition of done. Prettier is told to leave it alone.
- [`BACKLOG.md`](BACKLOG.md) says what to build next and lists known gaps.
  [`TIMELOG.md`](TIMELOG.md) records how long each development took (log each phase as it ends).
- [`full-picture.html`](full-picture.html) is the user's one-glance dashboard; keep it in sync at
  every milestone (rule in [`CLAUDE.md`](../CLAUDE.md)).
- **The workflow is in [`CLAUDE.md`](../CLAUDE.md)** (since 2026-10-11): trunk-based, commit to
  `main`, `make check` (run by the Stop and pre-push hooks), releases only by tag
  (`make release`), `make rollback` to undo one. No PRs. Pushing `main` deploys nothing.
- **Validate once, locally** (user's rule, 2026-10-08: this isn't a critical system; spend effort
  on content, not on re-validating). When a development is finished, run `make e2e-full` once and
  the screenshot review from [`scene-guide.md`](scene-guide.md), then ask the user to validate it
  locally; once they say it is fine, push `main` and release. Don't poll Actions or re-run suites.
- The quality bar is the photosynthesis explainer: narrative depth, scenes that match the text,
  both themes, reduced motion, every step screenshot-reviewed (method in `scene-guide.md`).
- Never commit the local `package-lock.json` drift (an optional `yaml` entry dropped by a local
  npm run); stage files by path, not with `git add -A`.
- Screenshots go to a scratch directory outside the repository.
- CI runs Node 22 on a slower Linux machine; the laptop runs Node 26. Chaotic simulations
  (states-of-matter) differ between them, and heavy scenes can lose forced clicks there. Before a
  release with new topics, also run `npx playwright test --workers=2` locally.

## Current state

- **All 100 catalogue topics are built, fact-checked and ticked** (done 2026-10-15). `main` is
  deployed as **v0.1.20** (2026-10-15). v0.1.19 carried the user's external audit
  (`docs/codex-fact-check-complete.md`: 59 findings, 2 High, all applied); v0.1.20 the
  housekeeping, the stage-text fix and the public-version polish described below. **The project is in
  maintenance:** no topic work is planned; what is left open is in [`BACKLOG.md`](BACKLOG.md)
  ("Open after the final push" and "Site and framework work").
- Licence: MIT code, CC BY 4.0 content, third-party data under its own terms (`LICENSE`,
  `LICENSE-CONTENT.md`, `docs/DATA-SOURCES.md`).
- Tooling: `scripts/cloud-setup.sh` and `docs/cloud.md` for building in cloud sessions;
  `make review` / `make review-fetch` (`scripts/batch-review.ts`) for fact-check reviews through
  the Batch API (the API credit ran out on 2026-10-15; none until November). Rulesets: `main`
  can't be force-pushed or deleted; `v*` tags can't be moved or deleted. The `github-pages`
  environment deploys from `v*` tags and `main` (rollbacks run from main).
- Reading progress: each explainer records the reader's current step in `localStorage`
  (`src/lib/progress.svelte.ts`); the index shows Done / Continue / Start on each card.
- Local testing: other work runs on this machine, so ports can clash (4173 is taken). The test
  server uses `PW_PORT` (default 4180). In a worktree, clone `node_modules` (`cp -cR`) rather
  than symlinking it, or svelte-check checks the other checkout's types.
- The process that built the topics, for reference: one agent builds a whole topic (model, Node
  tests, narrative, scenes) in its own worktree off `main`; a second agent reviews, fact-checks
  and ticks it; the branches are merged into `main` locally and deleted. The only conflicts are
  additive (`src/app.css`, `src/lib/topics.ts`, `TopicArt.svelte`: keep both sides, or rebuild
  those registries from `main` plus each branch's own entry).

## Current development

**Nothing in progress.** Released as v0.1.20 (2026-10-15), three pieces built in local
worktrees after the completion review and merged into `main`:

- Housekeeping: docs brought in line with the finished state; dead code removed (the `#lib`
  stub, `easeIn`, 27 unused CSS tokens, the nine local mulberry32 copies replaced by `rng` from
  `src/lib/draw/math.ts`); the `prerender_missing_id` build warnings silenced in `vite.config.ts`.
- Stage text: the 13 px rule moved from every `<text>` to the stage `<svg>`, so `font-size=` /
  `fill=` attributes and `<Label size>` work again; the 37 local text helpers and the
  `style:font-size` workarounds are gone (`<Label>` gained `italic`, `mono`, `tabular`, `halo`).
  55 topics' stages changed slightly (Axes ticks at 11 px, authored sizes).
- Public polish: footer licence line, Open Graph and Twitter tags, `sitemap.xml` (prerendered
  endpoint, pointed to from `robots.txt`), an `og-image.png`, the sun-earth-moon card vignette.

**History, newest first:**

- **Final push (2026-10-14/15):** the remaining 54 topics, built by a rolling pool of ~8 builder
  agents, one per topic in its own local worktree, fact-checked through `make review` and, once
  the credit ran out, in-house; released as v0.1.17 (90 ticked), v0.1.18 (all 100) and v0.1.19
  (the external audit applied in 11 worktrees; notable model changes: homeostasis, motors-generators
  torque ratio and braking, gps PDOP). The catalogue entries were reworded to match what was
  built.
- **Phone readouts (2026-10-13 to 10-15, v0.1.15–v0.1.17):** on viewports ≤ 640 px a scene's
  readouts leave the SVG for an HTML panel (option B); 92 of 100 topics converted, the 8 left are
  listed in BACKLOG.
- **Fact-check round (2026-10-13, v0.1.13/v0.1.14):** the 29 built topics never reviewed through
  the Batch API were reviewed (~$18) and every report applied.
- **Gap, bug and review rounds (2026-10-12/13, v0.1.10–v0.1.12):** the "known gaps" backlog
  cleared in seven local worktrees (Kimi and ZCode); a review of that work found three live bugs,
  fixed with tests that failed first.
- **Batches 2–9 and wave 1 (2026-10-07 to 10-12, v0.1.0–v0.1.7):** the first 46 topics; lean
  workflow (trunk-based, releases by tag) since 2026-10-11; CI on Ubicloud since v0.1.8.

Built-state params in use: `web:<step>`, `board:build`, `bridge:build`, `bits:<step>`,
`map:<step>`, `view:zoom`, `mol:<step>`, `probe:tank`, `sources:tank`, `ft:wave`, `ft:bars`,
`ft:curve`, `dope:<step>`, `pick:<step>`.

## Open questions for the user

None. Answered 2026-10-08: learning-from-data — dragging only is fine (ticked);
atmosphere-weather — the fronts-from-lows and transport/spin controls are accepted (ticked);
atoms-periodic-table — use PubChem's periodic-table data (see BACKLOG). The user also confirmed
that other work may run in parallel on this machine, so ports can clash: use other ports.

## Resume

```sh
git fetch && git status && git log --oneline -5
git branch                         # in-flight work is listed above
npm install                        # also enables the git pre-push hook
npm run dev                        # http://localhost:5173
make check && make e2e-full
```
