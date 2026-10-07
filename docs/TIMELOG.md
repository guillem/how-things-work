# Time log

How long each development took, to estimate the rest of the backlog. Times are UTC wall-clock
from the session's clock (`date -u`). **Elapsed** is start to end; **active** subtracts gaps where
work was waiting on the user or interrupted. The work is done by Claude Code sessions, so these
are agent hours, not human hours; user review time is logged separately when known.

Log one row per phase as it ends (not at the end of the topic), so an interrupted session still
leaves a record.

**Estimating the backlog:** epidemics (a level-1 `simulate` topic, no external data, 5 scenes)
took about one hour of wall-clock with heavy parallelism, plus the user's own review. Assume
roughly 1–1.5 h per comparable topic, more for topics with `Needs` (data to source) or a new
interaction kind (new shared components), less once components exist. 98 topics remain.

## Topics

| Topic          | Phase                                                                                               | Start            | End              | Active     | Notes                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| photosynthesis | whole topic (reconstructed from git)                                                                | 2026-10-06 23:09 | 2026-10-07 17:44 | ?          | Includes scaffolding the site and long idle gaps; first commit to last polish commit. Not a usable per-topic estimate on its own: 6 scenes, 16 steps, written by drafting agents then reviewed and polished scene by scene in parallel. |
| epidemics      | model + theory tests                                                                                | 2026-10-07 18:27 | 2026-10-07 18:34 | 7 min      | includes the proximity-model dead end                                                                                                                                                                                                   |
| epidemics      | narrative, crowd scene, framework bits, deep-link bug fix; 4 scenes + fact-check by parallel agents | 2026-10-07 18:34 | 2026-10-07 19:03 | 29 min     | agents ran ~15–21 min each in parallel                                                                                                                                                                                                  |
| epidemics      | adversarial review (3 parallel reviewers) + fixes, final checks                                     | 2026-10-07 19:03 | 2026-10-07 19:29 | 26 min     | reviewers ran 11–24 min in parallel                                                                                                                                                                                                     |
| epidemics      | **total**                                                                                           | 2026-10-07 18:27 | 2026-10-07 19:29 | **62 min** | 12 steps, 5 scenes, ~2,900 lines; one session, ~10 agents (4 authors, 1 fact-checker, 3 reviewers)                                                                                                                                      |

## Site work (not counted in topic estimates)

| Work                                                | Start            | End              | Active | Notes                                                |
| --------------------------------------------------- | ---------------- | ---------------- | ------ | ---------------------------------------------------- |
| Catalogue-driven index, cross-links, status/backlog | 2026-10-07 18:20 | 2026-10-07 18:27 | 7 min  | Includes reading the codebase and planning epidemics |
