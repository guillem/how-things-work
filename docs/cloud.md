# Building topics in the cloud

How to build topics in Claude Code cloud sessions, so the laptop can stay off. The agents' rules
for these sessions are in `CLAUDE.md` ("Cloud sessions").

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

## A batch of topics

1. Start one cloud session per topic (3–4 at a time), each with:

   > Build `<slug>` from docs/TOPICS.md, following CLAUDE.md and docs/scene-guide.md. Push after
   > every step. When it passes `make check` and `make e2e-full`, rebase onto main and push it
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

## What costs what

- **Cloud sessions** use the cloud credits. Each one is its own 4-core VM, so parallel sessions
  don't slow each other down.
- **Batch reviews** use API credits. They cost half the normal API price, and the cached
  catalogue is shared within a batch. Measured: about $1.10 for photosynthesis, the largest topic (74k tokens of input,
  15 web searches, ~25 minutes); smaller topics cost less. Each report records its cost.
- **Releases** run on GitHub Actions, about 7 minutes each. That's free for a public repository.
