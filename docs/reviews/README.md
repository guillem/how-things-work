# Reviews

Fact-check and review reports written by `make review-fetch` (see `scripts/batch-review.ts`).
Each `<slug>.md` is one topic's review. A session applies it: "apply docs/reviews/<slug>.md",
checking each fix against the cited source before changing anything. Delete the report once it
has been applied. `batches/` holds the ids of batches not fetched yet.
