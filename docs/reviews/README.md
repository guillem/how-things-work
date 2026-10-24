# Reviews

Fact-check and review reports written by `make review-fetch` (see `scripts/batch-review.ts`).
Each `<slug>.md` is one topic's review. A session applies it: "apply docs/reviews/<slug>.md",
checking each fix against the cited source before changing anything. Delete the report once it
has been applied. `batches/` holds the ids of batches not fetched yet.

For an immediate review through an installed agent, run
`node scripts/local-review.mjs <slug> [codex|claude|grok|pi:<provider/model>]` (default: Codex).
The Claude option uses Claude Code's signed-in account and permits only file reads and web
research. Sign in with `claude /login` first if the CLI reports that it is not logged in.
