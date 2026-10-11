#!/usr/bin/env bash
# Setup script for Claude Code cloud sessions (see docs/cloud.md): Node 22,
# the dependencies and a Chromium for the browser tests. Cloud environments
# snapshot the result when this finishes in about five minutes, so later
# sessions start warm. A failure stops it with an error (a broken install must
# not be snapshotted). Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."

# Node 22 or later (.nvmrc), as in the release workflow. If the active Node is
# older and nvm is there, install 22 and make it the default, so the session's
# own shells use it too. A machine with a recent Node is left alone.
want=$(cat .nvmrc)
major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$major" -lt "$want" ] && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
	set +u
	# shellcheck disable=SC1091
	. "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
	nvm install "$want" && nvm alias default "$want" && nvm use "$want"
	set -u
fi
major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$major" -lt "$want" ]; then
	echo "Node $want or later is needed; this machine has $(node --version)." >&2
	exit 1
fi

npm ci --no-audit --no-fund
npx svelte-kit sync

# Playwright's own Chromium if its download host is reachable (with the system
# libraries when apt is allowed), otherwise a browser already on the machine.
# The Makefile reads .playwright-chromium.
set +e
npx playwright install --with-deps chromium || npx playwright install chromium
ok=$?
set -e
if [ "$ok" -eq 0 ]; then
	rm -f .playwright-chromium
else
	for b in chromium chromium-browser google-chrome google-chrome-stable; do
		if command -v "$b" >/dev/null; then
			command -v "$b" >.playwright-chromium
			echo "Using the system browser $(cat .playwright-chromium) for the tests."
			break
		fi
	done
	[ -f .playwright-chromium ] || echo "No Chromium available: the browser tests won't run." >&2
fi

git config core.hooksPath .githooks
echo "Setup done: node $(node --version), $(npx playwright --version)."
