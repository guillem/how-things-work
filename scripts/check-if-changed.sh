#!/usr/bin/env bash
# Shared cached static/model validation for the Claude Stop hook and pre-push.
# Without --base, check everything not yet pushed: commits since the upstream branch (or
# origin/main) plus the working tree, so work committed during a turn is checked too.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ $# -eq 0 ]; then
	base=$(git merge-base HEAD '@{upstream}' 2>/dev/null ||
		git merge-base HEAD origin/main 2>/dev/null ||
		git hash-object -t tree /dev/null)
	set -- --base "$base"
fi
exec node scripts/validate.mjs quick "$@"
