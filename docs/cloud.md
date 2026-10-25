# Building topics in the cloud

Current validation policy: [AGENTS.md](../AGENTS.md). Use affected checks during
development; every deployment runs a fresh full suite. Timings below are historical.

How to build topics in Claude Code cloud sessions, so the laptop can stay off. The agents' rules
for these sessions are in `AGENTS.md` ("Cloud sessions").

## One-time environment setup

At claude.ai/code, create or edit the environment for this repository:

- **Setup script:** `bash /home/user/how-things-work/scripts/cloud-setup.sh`. The script runs in
  `/home/user`, after the clone, so the path must be absolute. It checks for Node 22 (switching with nvm if
  needed), installs the dependencies and a Chromium for the browser tests, and stops with an
  error rather than snapshot a broken install. The environment snapshots the result, so later
  sessions start warm.
- **Network access:** _Trusted_ allows npm and GitHub. Playwright's own Chromium downloads from
  hosts that aren't in that list. Either choose _Custom_ with the defaults plus
  `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`, or leave _Trusted_: the setup
  script then falls back to a Chromium already on the machine (the cloud image has one in
  `/opt/pw-browsers`, older than Playwright expects). Check the setup
  log the first time.
- **Environment variables:**
  - `BASH_DEFAULT_TIMEOUT_MS=300000` and `BASH_MAX_TIMEOUT_MS=900000`, so the full test suite
    doesn't hit the 2-minute default.
  - Optional: `REVIEW_ANTHROPIC_API_KEY=<key>` to run batch reviews from the cloud. Not
    `ANTHROPIC_API_KEY`: cloud sessions keep that name for Claude Code and hide it from commands.
    The key is visible to the sessions, so use one only for this.

## API key on the laptop

Put the key in a git-ignored `.env` file at the repository root, which only `make review` and
`make review-fetch` read. With the key copied from the Console:

```sh
printf 'ANTHROPIC_API_KEY=%s\n' "$(pbpaste)" > .env && chmod 600 .env
```

Don't export it in your shell profile or put it in Claude Code's settings: Claude Code also reads
`ANTHROPIC_API_KEY`, and would bill the key instead of the subscription.

## An explicitly authorized cloud batch

Local development defaults to sequential work to conserve AI usage. Use this batch procedure
only when the user requests parallel cloud work or authorizes it to use separate cloud credits;
past free-credit experiments do not make parallel batches the default.

1. Start one cloud session per topic, with concurrency set by the authorized batch, each with:

   > Build `<slug>` from docs/TOPICS.md, following AGENTS.md and docs/scene-guide.md. Push after
   > every step. When it passes `make changed BASE=origin/main`, rebase onto main and push it
   > to main.

2. When they have all landed on `main`, review them in one batch (from any session, or locally):

   ```sh
   make review TOPICS="slug-a slug-b slug-c"   # half price; results usually within an hour
   git add docs/reviews/batches && git commit -m "Review batch" && git push
   make review-fetch WAIT=1                    # writes docs/reviews/<slug>.md
   ```

   The batch id is saved in `docs/reviews/batches/`; pushing it lets any later session fetch the
   results, even if the one that submitted them is gone.

3. One session applies the reviews: "Apply the reports in docs/reviews/, then release."
4. Check the live site after the release; if something is wrong, ask for `make rollback`.

If a session can't push to `main` (the cloud proxy may only allow its own branch), it leaves its
branch rebased and passing. Merge it from the GitHub app, or ask a local session to.

## What we learned (first cloud session, 2026-10-11)

- **Setup:** Node 22.22 was already there. With _Trusted_ network access, Playwright's own
  Chromium still installed (into `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, next to the image's
  older one), so no `.playwright-chromium` fallback was needed. The setup script ran (the git
  hooks were set), and the session started warm.
- **Speed:** `make check` takes about 100 s (about 1m45 cold): format 17 s, lint 48 s, types 20 s,
  model tests 12 s. That is roughly 5× the laptop's time, but under the Stop hook's 300 s timeout.
  `make e2e` takes about 33 s and `make e2e-full` about 8 min (766 tests; ~1.5 min locally). Run it in
  the background (`… > log 2>&1 &`) and read the log afterwards, and avoid concurrent runs of the same suite in one checkout.
  Model, development-browser and production-browser artifacts now use separate subdirectories
  under `test-results/`, so these suites no longer delete each other’s output.
- **Network:** with _Trusted_ access, WebFetch and `curl` to arbitrary sites are refused by the
  proxy (403), and only WebSearch works, so fact-checking reads search excerpts, not the papers. Add
  hosts under _Custom_ if a session needs full pages (for example `pmc.ncbi.nlm.nih.gov`,
  `link.springer.com`). The Anthropic API is reachable: `REVIEW_ANTHROPIC_API_KEY` works for
  `make review` / `make review-fetch`.
- **Screenshots:** start the dev server in the background (`npx vite dev --port 5173 &`) and
  write the shots to the session's scratch directory. `scripts/shot.mjs` works unchanged.
- **Pushing:** `git push --dry-run` doesn't prove write access. A real `git push origin HEAD:main`
  from the cloud session worked (the proxy didn't restrict it to the session's branch). The
  pre-push hook runs cached affected static/model checks first.
- **Deleting branches:** the session can't delete a remote branch. `git push origin --delete`
  is cut off by the proxy, and the GitHub API answers 403. So the "delete the topic branch"
  step of finishing (AGENTS.md) is yours: once the session says its branch is on `main`, delete
  it from GitHub's Branches page or with `git push origin --delete <branch>` on the laptop.

## What costs what

- **Cloud sessions** use the cloud credits. Each one is its own 4-core VM, so parallel sessions
  don't slow each other down.
- **Batch reviews** use API credits. They cost half the normal API price, and the cached
  catalogue is shared within a batch. Measured: about $1.10 for photosynthesis, the largest topic (74k tokens of input,
  15 web searches, ~25 minutes); smaller topics cost less. Each report records its cost.
- **Releases** run on GitHub Actions, 10–17 minutes each (the last four, v0.1.16–v0.1.19). That's free for a public repository.
