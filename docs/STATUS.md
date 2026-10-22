# Status

The self-handover. If work is interrupted, this file alone must be enough to continue: read it
top to bottom, then run the commands under "Resume". **Update it at every commit**, not just at
the end of a development.

Last updated: 2026-10-22, 81 of the proposal's topics built (75 released); **v1.2.3 live** (175 topics; 181 on `main`). Paused to spare the weekly usage; next: the last 19 level-0 topics after the 2026-10-28 reset.

## How we work

- [`TOPICS.md`](TOPICS.md) is the catalogue (124 topics, 11 categories; content only): the first
  100, plus the proposal's entries as `proposals/topics-200/scripts/promote.mjs` promotes them
  when their build starts. Do not change its topics or categories otherwise; the only edits we
  make are promoting an entry and ticking it once it meets the catalogue's definition of done.
  Prettier is told to leave it alone.
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

- **All 100 catalogue topics are built, fact-checked and ticked** (done 2026-10-15). **v1.2.3**
  (2026-10-21) is live: 175 topics, the 100 plus 75 of the proposal's (14 at level 0). Before it,
  v1.2.2 (2026-10-21): 170 topics, the first nine at level 0 with the index's "Start here" link.
  Before that, v1.2.1 (2026-10-20): 155 topics and Paths v1
  (one reading path, language models). Before that, v1.1.2 (2026-10-19): 154 topics. Before it, v1.0.0
  (2026-10-17): the 100 topics plus the index search and filters (a sticky
  sidebar on wide screens), faster browser tests and the overnight backlog round described below.
  Earlier: v0.1.21 (2026-10-15) the housekeeping, stage-text fix and public polish; v0.1.19 the
  user's external audit (`docs/codex-fact-check-complete.md`). **The proposal's topics are being
  built onto `main` (see "Current development").** What is
  left open, and the decisions left for the user, are in [`BACKLOG.md`](BACKLOG.md) ("Open after
  the backlog round").
- Licence: MIT code, CC BY 4.0 content, third-party data under its own terms (`LICENSE`,
  `LICENSE-CONTENT.md`, `docs/DATA-SOURCES.md`).
- Tooling: `scripts/cloud-setup.sh` and `docs/cloud.md` for building in cloud sessions;
  `make review` / `make review-fetch` (`scripts/batch-review.ts`) for fact-check reviews through
  the Batch API (the API credit ran out on 2026-10-15; none until November). Rulesets: `main`
  can't be force-pushed or deleted; `v*` tags can't be moved or deleted. The `github-pages`
  environment deploys from `v*` tags and `main` (rollbacks run from main).
- Reading progress: each explainer records the reader's current step in `localStorage`
  (`src/lib/progress.svelte.ts`); the index shows Done / Continue / Start on each card.
- Index search and filters (`src/routes/+page.svelte`): a search box ("/" focuses it) and
  Area (catalogue category) and Level toggles, multi-select within a group, combined across
  groups; state in the query string (`?q=&area=physics,biology&level=1`). From 1,100 px wide they
  sit in a sticky sidebar with the progress counts (the index is 1,360 px wide so three card
  columns still fit); below that, a compact bar whose Area and Level buttons open the options,
  and the counts show once something is started. The prerendered page still lists everything;
  the options come from the built topics, so new categories and levels appear by themselves.
  Paths use `?path=<id>`, with the Path control above Area in the wide sidebar and on its own
  row under search on narrow screens.
- Local testing: other work runs on this machine, so ports can clash (4173 is taken). The test
  server uses `PW_PORT` (default 4180). In a worktree, clone `node_modules` (`cp -cR`) rather
  than symlinking it, or svelte-check checks the other checkout's types.
- The process that built the topics, for reference: one agent builds a whole topic (model, Node
  tests, narrative, scenes) in its own worktree off `main`; a second agent reviews, fact-checks
  and ticks it; the branches are merged into `main` locally and deleted. The only conflicts are
  additive (`src/app.css`, `src/lib/topics.ts`, `TopicArt.svelte`: keep both sides, or rebuild
  those registries from `main` plus each branch's own entry).

## Current development

**Level-0 round toward v1.3.0 (2026-10-21/22, paused).** The user asked for v1.3.0 with all 200
topics, keeping the weekly usage under 80%. Landed on `main`, not released: hearing-and-the-ear,
cloud-base and qr-codes (local builders, fact-checked by Codex) and blue-sky-red-sunset,
salt-and-ice and ant-trails (Claude Code cloud sessions on the user's trial credit; fact-checked
afterwards on the laptop by grok, because Codex could no longer read files: "timed out negotiating
with the code-mode host"). `make e2e-full` passed on `main` (3,605) before the three grok fixes;
their topics' tests pass. Cost: a level-0 topic took about 5% of the weekly usage locally (19% to
37% for three plus the lead's work), and the cloud sessions spent about $18 of $59 before their
first real commit. The user then paused: 19 left, all level 0 (13 promoted and unticked in
`TOPICS.md`, 6 still in `TOPICS-PROPOSAL.md` only: shapes-that-tile, vibrations-and-sound,
why-metal-feels-cold, dissolving-sugar-and-salt, be-the-bird-camouflage, flocking-birds).

**Overnight builders, 2026-10-21 (stopped ~03:10 CEST at the usage limit; landed on `main` the
same morning):** forest-fire-spread, secret-codes, next-word-guessing-game and leap-years, all
ticked. The five left half-built (monty-hall, floating-sinking-and-boats, magnets-and-poles,
twenty-questions, spam-filter-word-counts) were finished the same day by fresh builders, each
fact-checked by Codex, ticked and landed on `main`; released in v1.2.3. Their old
worktrees are removed. The small issues found then are fixed on `main` too: twenty-questions has
a phone layout (every animal named, readable questions), magnets-and-poles' board fills the phone
stage, floating-sinking-and-boats' block shows in oil and its scales read in dark mode, and
monty-hall's games slider starts at 10, and spam-filter-word-counts drops an ending "'s", so
"mum's" counts as "mum" (2,075 words, not 2,088; unreleased).

**Next topics, proposed for review (2026-10-18, after v1.0.0): a level 0 and 100 new topics.**
The user asked for a researched proposal (no code): a new level 0 for beginners, the levels made
more even (level 3 has 6 topics today), 100 new entries. Done:
[`TOPICS-PROPOSAL.md`](TOPICS-PROPOSAL.md) holds 100 entries in the catalogue's format (39 / 10 / 3
/ 48 at levels 0 to 3, after the user asked to lean towards AI with a ladder for understanding
LLMs and to take those slots from level 0), the Reserve dispositions, the links to add to existing
entries, suggested first waves and the runners-up; the invariants hold over all 200. The open
questions for the user are at the end of that file. How it was made, and every agent's output, is
in [`proposals/topics-200/README.md`](proposals/topics-200/README.md). Its entries are
promoted into `TOPICS.md` as their builds start (next paragraph).

**Building the proposal (from 2026-10-18, the user's go-ahead).** One builder agent per topic
(brief: [`proposals/topics-200/build-brief.md`](proposals/topics-200/build-brief.md)), three at a
time in worktrees, each fact-checked by Codex (`scripts/local-review.mjs`) and pushed to `main`;
the entry is promoted into `TOPICS.md` when its build starts. Order:
`proposals/topics-200/data/build-order.json` (the LLM ladder first, then the level 1–3 topics;
level 0 last, pending the user's answer on its definition). Built so far: 75 of the 100, all released (v1.2.3).

**Resumed 2026-10-18 night on the new machine** (the user's weekly limit is now 98%). Landed
since: ocean-acidification, tsunamis, carbonate-silicate-thermostat, radiative-convective-column,
game-tree-search, lagrange-points-three-body, aperture-synthesis (the Reserve's "Telescopes"
removed), cache-memory-hierarchy, hash-tables-bloom-filters, shazam-audio-fingerprint,
distributed-hash-tables, elliptic-curve-cryptography, kalman-filter, radar-sonar (unreleased). **Paused 2026-10-19 ~03:30
UTC at about 97% of the weekly usage** (resets 2026-10-21 06:00 UTC; no builder running, no
worktree left). Next in `build-order.json`: k-means-clustering, abs-brakes,
bicycle-stability, gas-turbines-combined-cycle, heat-pumps-refrigeration (the Reserve's "Heat
pumps"), then the level-0 groundwork, cellular-automata and the 39 level-0 topics (decided below).

**The user's decisions (2026-10-19):** level 0 as defined in `TOPICS-PROPOSAL.md` ("Level 0":
ages 9–13 or adults with no science background, no formulas, one control at a time, 6–9 steps,
real fact-checked models, level-0 prerequisites only); beginners find it through a "Start here"
link on the index to `?level=0`, with the eleven categories unchanged; the water cycle stays a
runner-up. So cellular-automata and the 39 level-0 topics are unblocked: first the parser change
(`src/lib/catalog-parse.ts` accepts level 0, the Levels table gets its row), the "Start here"
link and a short level-0 section in `docs/scene-guide.md`, then the builds. ocean-acidification
keeps the Orr et al. 2015 cross-check (no PyCO2SYS fixtures). mri-k-space's and
aperture-synthesis' data stay Unconfirmed in `DATA-SOURCES.md`.

**Proposal build, one topic at a time in the main session (2026-10-20/21):** k-means-clustering, abs-brakes, bicycle-stability, gas-turbines-combined-cycle, heat-pumps-refrigeration, cellular-automata, and the level-0 life-on-a-grid (the index's "Start here" link now shows), shadows-and-pinholes, fireflies-in-sync, barcode-stripes and why-triangles-are-stiff done (ticked, fact-checked, pushed; not released). The build order is finished. Next: (leap-years done 2026-10-21, see below) the main session's other level-0 entries (Mathematics, Physics, Chemistry & Materials, Biology; promote each with `promote.mjs`); the overnight session builds the other 21 (below). Run `make e2e-full` before a release.

**Overnight session, second worktree (2026-10-20 22:20 CEST, the user's request):** builds the 21 level-0 topics of Body & Medicine, Earth & Climate, Space (not leap-years), Computing, Information & Networks (not barcode-stripes), Artificial Intelligence and Energy & Machines, all promoted into `TOPICS.md` at once to claim them; each lands on `main` when done. The main session keeps the level-0 topics of Mathematics, Physics, Chemistry & Materials and Biology, plus barcode-stripes and leap-years.

**Level-0 groundwork (2026-10-20, done):** the catalogue parses level 0 (Levels table row and definition in `TOPICS.md`); the index has a "Start here" link to `?level=0`, shown once the first level-0 topic is built; `docs/scene-guide.md` has a "Level-0 scenes" section. Next: the 5 unbuilt topics left in `proposals/topics-200/data/build-order.json` (k-means-clustering, abs-brakes, bicycle-stability, gas-turbines-combined-cycle, heat-pumps-refrigeration) and cellular-automata (now unblocked; still listed under `blocked` there), then the 39 level-0 topics (not yet in the build order's `order`; their entries are in `TOPICS-PROPOSAL.md`).

**Releases v1.2.0–v1.2.1 (2026-10-20).** v1.2.0 failed in CI's e2e-full and deployed nothing;
v1.2.1 is live. Fixed on the way: resampling-inference's shuffle scene tweened under reduced
motion (its test caught a transient label); vision-color's forced checkbox click missed while the
page smooth-scrolled to the step, so the switch input now sits above its track and the suite's
80 `check({ force: true })` calls lost `force`; central-limit-theorem's drag waits for the scroll
to hold still. 51 other `boundingBox()` measurements could still race the scroll on CI.

**Releases v1.1.0–v1.1.2 (2026-10-19, the user asked for one around 150 topics).** v1.1.0 and
v1.1.1 failed in CI and deployed nothing; v1.1.2 is live. What changed on the way:

- The stage cross-fade: the outgoing scene's `<g>` stays during its 160 ms fade, so the strict
  `.stage svg > g` locator saw two (the electromagnetism flake). `SceneStage` now marks it
  `data-leaving` in the outro function itself (outrostart fires a frame too late), and every
  browser test uses `.stage svg > g:not([data-leaving])`.
- CPU load on the CI runner: ecg-arrhythmias' browser tests run one after another in one worker;
  "the chart grows to fit" and the glossary tooltip check poll; on CI assertions wait up to
  15 s (`playwright.config.ts`); the verify job's limit is 35 min (it took 19 min: `make check`
  ~6, browser suite ~13).
- site.e2e found cards by `href$="cryptography/"`, which also matched
  elliptic-curve-cryptography; it now matches the whole path segment.
- Load flakes still seen locally under parallel builds, each passing alone: central-limit-theorem
  "drawing the starting shape", site "follows a live change of the OS preference".

Follow-ups the builders named: a regression test for turing-patterns' flat-dish restart.
`docs/full-picture.html` is current to radar-sonar.

**Released as v1.0.0 (2026-10-17): the backlog round (overnight) and the index work below.** Before
releasing 1.0 the user asked to clear the backlog. One agent per package in a local worktree,
each branch merged into `main` with `make check` and its topics' tests; worktrees removed.
What is still open, and the decisions left for the user, are in `BACKLOG.md` ("Open after the
backlog round").

- Framework: any control takes `disabled: (params) => boolean`; deep-time's slider follows
  "play" and keeps the played age. `startDrag` returns an end function, so a Handle unmounted
  mid-drag releases it.
- Phone readouts in all 100 topics (the last eight converted, desktop pixel-identical), and the
  shared `<Axes>` readable on phones (~10 px ticks, thinned labels; desktop pixel-identical), plus
  per-topic chart fixes in 14 topics (margins, a few shorter titles: epidemics' R₀ title,
  transistors-chipmaking's "1,000", carbon-polymers' "carbons (log)").
- logic-gates: a sixth step, "Build a 4-bit adder", from the reader's own full adder (a
  two-output block, four chained, checked over all 512 inputs).
- Topic extras: the-cell (protein crowds from free space; was 19% high), dna-to-protein ("Letters
  copied"), respiration-atp (yeast and E. coli split), convolution-vision (the editable map builds
  up), quantum-computing (A's axis 0°/90°; B's slider now measures from z), stars (remnant
  marker), oscillations-resonance (stiffness on the driven steps, swing dots), big-bang (Peebles'
  three-level atom: half bound at z ≈ 1272, 87% at z*; headline follows), flight ("160 times
  slower" tested), nuclear-fusion (tokamak cross-section), atmosphere-weather (`frontAt` in the
  model), chemical-bonds (NH₃ angle arc readable).
- Sources and data: vision-color's cones match cvrl.org, and option B (S on the red–green
  channel) landed; evolution's Luria–Delbrück figures from the 1943 paper; crispr checked against
  Barrangou Fig. 3; photosynthesis' `#water` captions; atoms-periodic-table's known isotopes
  (NUBASE2020; licence unconfirmed); embeddings' 8-bit test (GloVe fixture); earthquakes' PKPab
  row (TauP ak135) and Nepal stations; diffusion-models' nearest-training-digit distances (no
  retrain needed; `train.mjs` loads again).
- Cleanup: about 900 exports nothing imports are now private (`knip.json`; 61 unused symbols
  listed in BACKLOG).
- Final tree (2026-10-17 ~04:10 UTC): `make check` green; `make e2e-full` 2,195 passed in 2 min 52 s;
  `npx playwright test --workers=2` (closer to CI) 2,195 passed in 7.9 min.

**Also in v1.0.0** (2026-10-17):

- Index search and filters: search box, Area and Level toggles with live counts, an empty state
  with "Clear filters", the state in the query string; tested in `e2e/index.e2e.ts` (@smoke).
- Faster browser tests: `make e2e-full` 4 min 9 s → 2 min 46 s locally. `scenes.e2e.ts` slept a
  fixed 500 ms after each of its ~1,180 step renders and 150 ms per step of each dark-mode walk
  (about 780 s of its 860 s of test time). It now runs the same 500 ms / 150 ms of timers and
  frames on Playwright's fake clock and waits for requests in flight, so deferred work (the
  Mandelbrot's delayed start, debounced readouts, language-models' fetch) is still checked: an
  error planted in a 250 ms timer fails the test; waiting for a few frames alone missed it.
  Traces are recorded only in CI (about a quarter of the run locally). More workers didn't help:
  the suite is CPU-bound at the default 6.
- `.claude/launch.json`: a `pages` preview (the production build under the sub-path, port 4181)
  for the desktop app's browser pane.

**Released as v0.1.21** (2026-10-15), three pieces built in local worktrees after the
completion review and merged into `main`:

- Housekeeping: docs brought in line with the finished state; dead code removed (the `#lib`
  stub, `easeIn`, 27 unused CSS tokens, the nine local mulberry32 copies replaced by `rng` from
  `src/lib/draw/math.ts`); the `prerender_missing_id` build warnings silenced in `vite.config.ts`.
- Stage text: the 13 px rule moved from every `<text>` to the stage `<svg>`, so `font-size=` /
  `fill=` attributes and `<Label size>` work again; the 37 local text helpers and the
  `style:font-size` workarounds are gone (`<Label>` gained `italic`, `mono`, `tabular`, `halo`).
  55 topics' stages changed slightly (Axes ticks at 11 px, authored sizes).
- The power-grid autopilot test now pauses the fake clock (`page.clock.pauseAt`), as ecosystems
  and logic-gates do: after `page.clock.install()` time still flows in real time, and on the CI
  runner the seconds between setting a control and the next click were simulated minutes.
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

**Fact-check round after v1 (2026-10-20).** Grok audited topics 101–155 at `f72fadb1` (the
report is not kept). Codex fixed 29 findings in the text, Grok reviewed
the diff, and its three follow-ups went in: OA-1 (onset 550–635 ppm), CACHE-1 (now 239 vs 249
cycles, the model's 10-cycle difference; L2 paragraph rewritten), LO-1 (percentages credited to
Ozbudak's fit), TLM-1, and ECG record 100 retitled "Sinus rhythm" (its e2e test updated on
purpose). SD-1 rejected (Leviathan et al. 2023, Table 4 gives c = 0.02); RS-1 unverified (no
GPT-2 weights locally). Gates: `make check`, `make e2e` (245), `make e2e-full` (3,160) all pass.
**Verified by Claude (2026-10-20).** Every "in this model" number recomputed from the models
with the scenes' parameters: all match. Literature added by the second model checked against
the sources: OA-1 reworded (635 ppm / 2070 is Orr's preferred estimate, 550 ppm / 2050 the
equilibrium one), the cochlea's post-mortem loss is 65–80 dB (Robles and Ruggero 2001, not
50–70), one leftover "about 240" in cache-memory-hierarchy's notes now 239; SD-1's rejection
holds (Table 4: c = 0.02). **TP-1 done:** the evidence scene lists feather buds under "mixed",
with a test. The audit report and the untrusted qwen itinerary draft were removed from `docs/`.

**Paths v1 (2026-10-20, committed, unreleased).** Guided reading paths. `docs/PATHS.md` is the
only source: `src/lib/paths-parse.ts` parses it and `src/lib/paths.ts` validates it against the
catalogue at build time (unknown or repeated stops, and on-path prerequisites placed later, fail
the build). One path ships, `language-models` ("How a language model works", 16 stops in four
chapters); every on-path prerequisite comes earlier. The index takes `?path=<id>` (typing in the
search or picking an Area or Level leaves the path); every explainer on a path shows a
`PathStrip` under its title (chapter, position, previous and next, link back to the path).
Built by Codex from `docs/grok_paths.md`, reviewed by Grok (one finding, the sidebar order,
rejected with a regression test); tests in `e2e/paths.e2e.ts` and `e2e/paths-model.e2e.ts`.
`make check` and `make e2e-full` (3,165) green. A climate path needs a prerequisite-safe order
first (carbon-cycle before greenhouse-effect).

**Waiting for Claude's finishing touch** (the user's rule since 2026-10-20: visual and artistic
work is always Claude's, to match the existing style). Both items are done.

1. ~~turing-patterns scene (TP-1)~~: done 2026-10-20.
2. ~~Paths v1 visual design~~: done 2026-10-20. The index's Path control is a labelled chip on
   phones and a row with its stop count in the sidebar; the selected path has a large title,
   the promise as a lede, a 16-segment bar beside "N of 16 done", numbered chapter headings and
   a dashed "Coming later" tile for unbuilt stops (not a card, not a link). `PathStrip` now sits
   after the summary, as the spec places it: a card with the topic's accent edge, "Path · title
   · chapter · Stop N of 16", a dot per stop, and Previous (left) / Next (right) with their titles.
   Wording kept as "Stop N of 16": it reads on its own, where "3 of 16" needs the context.

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
