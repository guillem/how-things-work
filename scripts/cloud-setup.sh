#!/usr/bin/env bash
# Setup script for Claude Code cloud sessions (see docs/cloud.md): installs the
# dependencies and a Chromium for the browser tests. Cloud environments snapshot
# the result when this finishes in about five minutes, so later sessions start
# warm. Safe to run again.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

npm ci --no-audit --no-fund
npx svelte-kit sync

# Playwright's own Chromium, if its download host is reachable; otherwise a
# browser already on the machine. The Makefile reads .playwright-chromium.
if npx playwright install --with-deps chromium; then
	rm -f .playwright-chromium
else
	for b in chromium chromium-browser google-chrome google-chrome-stable; do
		if command -v "$b" >/dev/null; then
			command -v "$b" >.playwright-chromium
			echo "Using the system browser $(cat .playwright-chromium) for the tests."
			break
		fi
	done
	[ -f .playwright-chromium ] || echo "No Chromium available: browser tests (make e2e) won't run." >&2
fi

git config core.hooksPath .githooks
echo "Setup done: node $(node --version), $(npx playwright --version)."
