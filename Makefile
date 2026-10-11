# The whole workflow in a few targets (see CLAUDE.md). Trunk-based: commit to
# main, `make check` before pushing (the git pre-push hook and the Claude Code
# Stop hook run it too), release by tagging with `make release`.

# Port for the test server (4173 is often taken by another app on this machine).
PW_PORT ?= 4180
export PW_PORT

.PHONY: check format-check lint typecheck test format e2e e2e-full

## Fast checks, under a minute: formatting, lint, types and the model tests.
check: format-check lint typecheck test

format-check:
	npx prettier --check . --log-level warn

lint:
	npx eslint .

typecheck:
	npx svelte-kit sync
	npx svelte-check --tsconfig ./tsconfig.json --fail-on-warnings --output machine

## The model tests (plain Node, no browser).
test:
	npx playwright test -c playwright.models.config.ts

format:
	npx prettier --write .

## Smoke tests for the critical paths, on the production build under the sub-path.
e2e:
	npx playwright test --grep @smoke

## Every browser test (also run by the release workflow).
e2e-full:
	npx playwright test
