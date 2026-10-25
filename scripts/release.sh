#!/usr/bin/env bash
# Tags the current main as a release and pushes main and the tag together. The
# tag runs .github/workflows/release.yml: checks, every test, deploy to GitHub
# Pages, then a smoke test of the live site.
#
# Usage: scripts/release.sh [vX.Y.Z]    (default: the next patch version)
set -euo pipefail

V="${1:-}"
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || {
	echo "release: switch to main first." >&2
	exit 1
}
git fetch -q origin main --tags
git merge-base --is-ancestor origin/main HEAD || {
	echo "release: origin/main has commits this main lacks; pull first." >&2
	exit 1
}

if [ -z "$V" ]; then
	last=$(git tag -l 'v*' --sort=-v:refname | head -1)
	if [ -z "$last" ]; then
		V=v0.1.0
	else
		IFS=. read -r major minor patch <<<"${last#v}"
		V="v$major.$minor.$((patch + 1))"
	fi
fi
[[ "$V" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
	echo "release: the version must look like v1.2.3 (got '$V')." >&2
	exit 1
}
if git rev-parse -q --verify "refs/tags/$V" >/dev/null; then
	echo "release: $V already exists." >&2
	exit 1
fi

# The pre-push hook checks affected static/model inputs; CI is the full deployment gate.
git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ] || {
	echo "release: commit or stash working-tree changes first; the tag must identify the code being deployed." >&2
	exit 1
}
git tag -a "$V" -m "Release $V"
date -u +%Y-%m-%dT%H:%M:%SZ >.release-started
git push --atomic origin main "refs/tags/$V"
echo "Released $V. Follow it with: make verify"
