#!/usr/bin/env bash
# Redeploys an earlier release: runs the release workflow by hand for that tag
# (build, deploy, live smoke test; its tests passed when it was released).
# Tags are not moved. Without an argument it picks the release just before the
# one that is live now, so running it twice goes two releases back.
#
# Usage: scripts/rollback.sh [vX.Y.Z]
set -euo pipefail

TO="${1:-}"
git fetch -q origin --tags

if [ -z "$TO" ]; then
	# What is live: the newest release run that deployed successfully. Its title
	# is "Release vX.Y.Z" or "Rollback to vX.Y.Z" (see run-name in release.yml).
	live=$(gh run list --workflow release.yml --status success --limit 1 \
		--json displayTitle --jq '.[0].displayTitle' | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || true)
	[ -n "$live" ] || {
		echo "rollback: can't tell which release is live; pass one: make rollback TO=vX.Y.Z" >&2
		exit 1
	}
	TO=$(git tag -l 'v*' --sort=-v:refname | awk -v live="$live" 'found { print; exit } $0 == live { found = 1 }')
	[ -n "$TO" ] || {
		echo "rollback: $live is live and there is no earlier release." >&2
		exit 1
	}
	echo "Live: $live. Rolling back to $TO."
fi
git rev-parse -q --verify "refs/tags/$TO" >/dev/null || {
	echo "rollback: no tag $TO." >&2
	exit 1
}

gh workflow run release.yml --ref main -f tag="$TO"
sleep 3
echo "Started. Follow it with: make verify"
