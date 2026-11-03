#!/usr/bin/env bash
# Setup script for Claude Code cloud sessions (see docs/cloud.md): the Node in .nvmrc,
# the dependencies and current stable Chrome for the browser tests. Cloud environments
# snapshot the result when this finishes in about five minutes, so later
# sessions start warm. A failure stops it with an error (a broken install must
# not be snapshotted). Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."

# The .nvmrc Node or later, as in the release workflow. If the active Node is
# older and nvm is there, install that version and make it the default, so the session's
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

# Use current stable Chrome rather than Playwright's pinned Chromium. Stop if
# Chrome cannot be installed or does not meet the recorded security floor.
npx playwright install --with-deps --force chrome
node --input-type=module -e "import checkBrowser from './scripts/browser.mjs'; await checkBrowser();"
rm -f .playwright-chromium

git config core.hooksPath .githooks
echo "Setup done: node $(node --version), $(npx playwright --version)."
