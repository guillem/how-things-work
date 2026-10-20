# Paths

Plan for a later session. Implement this file. `docs/qwen_itineraries.md` is a rejected draft: do not implement it, and do not take its journeys, its schema, or its component list.

A path is a hand-ordered list of topics that explains one thing. It has a title, a one-sentence promise, and named chapters. The reading order is the concatenation of the chapters. A topic stays in its category. A topic may be on several paths, or on none.

This change ships one path, "How a language model works", on the index and on each of its explainers.

## Leave for later

- A field on topic entries in `docs/TOPICS.md`. Membership and order live only in `docs/PATHS.md`.
- A route of its own, a second index, search over paths, tags, and difficulty badges.
- An SVG map, a skill tree, and anything from `src/lib/draw/`. That directory draws explainer stages.
- A second progress store, prerequisite gates, and warnings. "Read first" already links prerequisites, and the reader is not blocked.
- Shortest paths between arbitrary topics, versioned curricula, per-level variants, badges, and a leaderboard.
- Further paths. Two candidates are recorded at the end. They are not part of this change.
- `next-word-guessing-game`. It is not in the catalogue yet. When it is promoted, add it at the front of Counting.

## The first path

Id `language-models`. The id matching a topic slug is fine: the index query is `?path=language-models` and the explainer route stays `/language-models/`.

- **Title:** How a language model works
- **Promise:** From a model that only counts the next word to one that is trained, aligned and served.

| #   | Chapter              | Slug                           | Prerequisites left off the path       |
| --- | -------------------- | ------------------------------ | ------------------------------------- |
| 1   | Counting             | learning-from-data             |                                       |
| 2   | Counting             | ngram-text-models              |                                       |
| 3   | The network          | gradient-descent               | calculus                              |
| 4   | The network          | neural-networks                | linear-transformations                |
| 5   | The network          | embeddings                     | linear-transformations                |
| 6   | The model            | language-models                |                                       |
| 7   | The model            | transformers                   |                                       |
| 8   | The model            | tokenization                   | compression                           |
| 9   | The model            | positional-encoding            | unit-circle                           |
| 10  | The model            | residual-stream-logit-lens     |                                       |
| 11  | Training and serving | training-a-tiny-language-model |                                       |
| 12  | Training and serving | scaling-laws                   |                                       |
| 13  | Training and serving | rlhf-alignment                 | reinforcement-learning, bayes-theorem |
| 14  | Training and serving | chain-of-thought-scratchpad    |                                       |
| 15  | Training and serving | kv-cache-inference             | gpu                                   |
| 16  | Training and serving | speculative-decoding           |                                       |

All sixteen are built and registered in `src/lib/topics.ts`. Cards and previous/next links use the explainer title (`topic.title`), the same title `TopicCard` and `TopicLinks` already show.

### Why this order

The order is editorial. The prerequisite graph is only a check on it.

Along a path, a topic comes after any of its prerequisites that are also stops. Prerequisites that are not stops stay off the path. A stop has to be part of the promise. `calculus`, `linear-transformations`, `unit-circle`, `compression`, `reinforcement-learning`, `bayes-theorem`, and `gpu` remain on "Read first" of the page that assumes them.

Checked against `docs/TOPICS.md` on 2026-10-19:

- `ngram-text-models` requires `learning-from-data`, so Counting starts there. The proposal ladder in `docs/TOPICS-PROPOSAL.md` put n-grams first; the page does not.
- `tokenization` requires `language-models` and `compression`. The proposal ladder put tokenization first and called it a prerequisite of transformers. The catalogue says the opposite: `transformers` requires `embeddings` and `neural-networks`, and `tokenization` requires `language-models`.
- `positional-encoding` requires `transformers` and `unit-circle`. It is not a prerequisite of transformers.
- `language-models` and `transformers` require the same two pages. Next-token comes first because that page states what the path is about, and attention is how.
- `scaling-laws` does not require `training-a-tiny-language-model`. It follows that page because the law generalises the training run the reader just watched.
- `chain-of-thought-scratchpad` requires `training-a-tiny-language-model` and `transformers`. It does not require `kv-cache-inference`, so it sits before serving.
- `speculative-decoding` requires `kv-cache-inference`, so it is last.
- `rlhf-alignment` requires `reinforcement-learning`, which stays off the path. Chain-of-thought is not the reinforcement-learning page.

Do not insert the off-path prerequisites into the chapters. Do not restore the proposal ladder's order.

## `docs/PATHS.md`

Create it as the only source of order. Parse it the way `src/lib/catalog.ts` parses `docs/TOPICS.md`: a pure parser, then a module that imports the raw markdown.

```markdown
# Paths

Ordered readings of topics that already exist. A topic stays in its category. The reading order of a path is its chapters, concatenated.

## language-models

- **Title:** How a language model works
- **Promise:** From a model that only counts the next word to one that is trained, aligned and served.
- **Chapters:**
  - Counting: learning-from-data, ngram-text-models
  - The network: gradient-descent, neural-networks, embeddings
  - The model: language-models, transformers, tokenization, positional-encoding, residual-stream-logit-lens
  - Training and serving: training-a-tiny-language-model, scaling-laws, rlhf-alignment, chain-of-thought-scratchpad, kv-cache-inference, speculative-decoding
```

`##` is the path id. Title and Promise are single-line fields, same shape as catalogue fields. Chapter lines under `**Chapters:**` are `- Name: slug, slug`. Names and slugs are separated by a colon. Slugs are separated by a comma and a space.

## Parser

`src/lib/paths-parse.ts` is pure, like `catalog-parse.ts`. It returns:

```ts
interface PathChapter {
	title: string;
	slugs: string[];
}

interface TopicPath {
	id: string;
	title: string;
	promise: string;
	chapters: PathChapter[];
}
```

`src/lib/paths.ts` imports `docs/PATHS.md?raw`, parses it, and checks it against `catalog`. Export the list in file order, a `byId` map, and helpers:

- `stops(path)` — chapters concatenated.
- `pathsFor(slug)` — paths that include the slug, in file order.
- `place(path, slug)` — `{ index, chapter }` with `index` starting at 1, or nothing if the slug is absent.
- `neighbours(path, slug)` — `{ previous, next }` as slugs or nothing at the ends.

The structural parse throws on a missing title or promise, a chapter with no slugs, a slug that does not match `[a-z0-9-]+`, or a repeated slug inside one path. An empty file yields an empty list.

`assertPaths(paths, catalog)` throws, naming the path and the slugs, when a stop is not a catalogue entry, or when a stop lists a prerequisite that appears later on the same path. Call it from `paths.ts` so a bad file fails the build, and from the model test so the failure is an assertion.

Adding a path later is a new `##` block. The index and the strips iterate the parsed list. Do not hardcode `language-models` in the components.

## Index

All of this is client state in `src/routes/+page.svelte`, same as area and level. The prerendered HTML still lists every category. After hydration, `onMount` reads the query. There is no path route.

### Query

Add `path` beside `q`, `area`, and `level`. One state variable, a string. An id that is not in `byId` is dropped, the way an unknown area is dropped.

A path and the shelf filters do not combine. Hiding stop 4 would punch a hole in the sequence.

- Choosing a path clears `q`, `areas`, and `levels` in that same handler.
- Typing in the search box, toggling an area, or toggling a level clears `path` in that same handler.
- `clearFilters` clears `path` too.
- The existing `$effect` is the only writer of the address. It already waits for `ready`. Handlers only change state. Svelte batches those writes, so the effect runs once and the address is either `?path=language-models` or the shelf query, never both.

The smoke test in `e2e/index.e2e.ts` expects `?area=physics,biology&level=1` with no path. Keep that.

### Control

A group labelled Path, above Area, one button per path. The button's name is the path title. `aria-pressed` is true while it is selected. Choosing the pressed button turns the path off and restores the categories.

On the wide sidebar the label "Path" is visible, same treatment as "Area". On the narrow bar the path button is its own row under the search and stays visible. Do not put it behind the Area or Level disclose. Those groups stay `display: none` until opened. The phone test in `e2e/index.e2e.ts` depends on that.

### List

While a path is selected, replace the category sections with one section:

- `aria-labelledby` the path title, which is the `h2`.
- The promise as a paragraph.
- A line `N of 16 done`. `N` is how many stops have `progress.status` `done`. The total is every stop, including any later unbuilt one. Started counts as not done. The line follows `progress.loaded`, same as the tally, so it does not flash a stored count during prerender.
- Each chapter is an `h3`, then the existing `TopicCard`s in stop order.

Unbuilt stops have no `Topic`. Render the catalogue title and the words "coming later", not a card and not a link, the way `TopicLinks.svelte` already does. This path has none. Still write the branch.

The "Showing N of M" line stays hidden, because a path is not a filter. The sentence under the list, "N of the M planned topics are written so far", stays.

## Explainer strip

New component `src/lib/components/PathStrip.svelte`, used in `ExplainerPage.svelte` immediately after `header.title` and before `<Explainer>`. Keep it out of `TopicLinks.svelte`. That nav is prerequisites, related topics, and what leads on.

For each path in `pathsFor(slug)`, one `nav` with `aria-label="Path"`:

- The path title links to the index with `?path=<id>`, built as `resolve('/')` plus the query, so the base path stays correct.
- The chapter title, as text.
- `N of 16`, the one-based index over the full stop list. Gradient descent is 3.
- Previous and next, when they exist. A built neighbour is a link whose accessible name is `Previous: <explainer title>` or `Next: <explainer title>`, using `resolve` the way `TopicCard` does. An unbuilt neighbour is the catalogue title plus "coming later", not a link. Do not skip an unbuilt neighbour.

A topic on no path renders nothing. A topic on two paths renders two navs, in file order. There is no `?path=` on the explainer.

Style it as one wrapping row with the existing tokens. The path title uses `var(--topic-accent)`. No new colours, no stage drawing primitives.

## Progress

Use `src/lib/progress.svelte.ts` as it is. `done` stays sticky once the reader reaches the last step. Do not record which path they clicked, and do not add a completed-set of your own.

## Tests

### `e2e/paths-model.e2e.ts`

This filename is what `make check` runs (`playwright.models.config.ts` matches `*-model.e2e.ts`). The test is pure Node. It parses `docs/PATHS.md` and `docs/TOPICS.md` and asserts `assertPaths`. Also assert that the `language-models` stops are exactly the sixteen slugs in the table above, so a reorder is a deliberate test change. Assert each chapter's title.

### `e2e/paths.e2e.ts`

Drives the production build. Relative URLs, as in `e2e/index.e2e.ts`. Assert what a visitor sees.

Tag one test `@smoke`:

- On `./`, activate "How a language model works".
- The address is `?path=language-models`.
- The region "How a language model works" is visible and contains the promise.
- Headings "Counting", "The network", "The model", and "Training and serving" are visible.
- The region "Biology" is absent.
- The first card is "How machines learn from examples". "How language models write" comes before "Tokenization & byte-pair encoding". The last card is "Speculative decoding".
- The line reads `0 of 16 done`.
- Reload keeps the path and the card count.
- Pressing the path button again restores a category region and drops `path` from the address.
- Typing `Photosynth` into the search box clears the path, shows the photosynthesis card, and leaves `q` in the address without `path`.

A second test, not smoke:

- Open `./gradient-descent/`. The path nav shows "How a language model works", "The network", and "3 of 16".
- Previous is "Counting machines that write" and lands on `./ngram-text-models/`.
- Next is "Neural networks and backpropagation".
- `./learning-from-data/` has no Previous. `./speculative-decoding/` has no Next.
- `./photosynthesis/` has no path nav.
- From the index path, open the first card, press End, return to `./?path=language-models`, and see `1 of 16 done` and that card reading Done. This is the same progress the tally already stores.

Do not assert markup classes, the parsed object from inside the page, or a component prop.

## Files

- `docs/PATHS.md` — new.
- `src/lib/paths-parse.ts` — new.
- `src/lib/paths.ts` — new.
- `src/lib/components/PathStrip.svelte` — new.
- `src/lib/components/ExplainerPage.svelte` — render the strip.
- `src/routes/+page.svelte` — query, control, list.
- `e2e/paths-model.e2e.ts` — new.
- `e2e/paths.e2e.ts` — new.
- `docs/STATUS.md` — extend the index-filters bullet with the path query and where the control sits.
- `docs/full-picture.html` — the line that mentions index search and filters.
- `README.md` — one line in the project tree for `docs/PATHS.md`.

Do not edit `docs/TOPICS.md`, `src/lib/topics.ts`, or `docs/qwen_itineraries.md`.

## Done when

`make check` passes, then `make e2e` (the new smoke test), then `make e2e-full` because the strip and the parser sit in `src/lib` and `ExplainerPage` is shared. Fix failures in the feature. Do not weaken a test.

After that, stop. Do not commit, push, or release unless the user asks.

## Later paths

Not this change. When a second path is added, the control and the strips already loop. Check the new stops against the same rule before writing them in.

- How a computer runs a program: `binary`, `logic-gates`, `transistors-chipmaking`, `cpu`, `cache-memory-hierarchy`. `transistors-chipmaking` also requires `semiconductors`, which would stay off the path.
- How the climate changes: `greenhouse-effect`, `carbon-cycle`, `radiative-convective-column`, `ocean-acidification`, `ice-ages`, `carbonate-silicate-thermostat`. Check their prerequisites before fixing this order. `deep-time` requires `plate-tectonics`, so a path must not open on `deep-time`.
