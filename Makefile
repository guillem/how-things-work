# The whole workflow in a few targets (see CLAUDE.md). Trunk-based: commit to
# main, `make check` before pushing (the git pre-push hook and the Claude Code
# Stop hook run it too), release by tagging with `make release`.

# Port for the test server (4173 is often taken by another app on this machine).
PW_PORT ?= 4180
export PW_PORT

.PHONY: check format-check lint typecheck test format e2e e2e-full release rollback verify review review-fetch

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

## Tag main and push it: the tag runs the release workflow (checks, tests,
## deploy, live smoke test). V=v1.2.3 to choose the version (default: next patch).
release:
	scripts/release.sh $(V)

## Redeploy the release before the one that is live; TO=v1.2.3 to pick one.
rollback:
	scripts/rollback.sh $(TO)

## Follow the latest release run to its end (it ends with a check of the live site).
verify:
	gh run watch "$$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status

## Review and fact-check topics through the Batch API (half price, results within
## 24 h, usually 1): make review TOPICS="entropy internet". Needs ANTHROPIC_API_KEY.
review:
	node --experimental-strip-types scripts/batch-review.ts submit $(TOPICS)

## Write the reviews of finished batches to docs/reviews/<slug>.md (WAIT=1 to wait).
review-fetch:
	node --experimental-strip-types scripts/batch-review.ts fetch $(if $(WAIT),--wait)
