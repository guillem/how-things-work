#!/usr/bin/env bash
# Follows the release run started by the last `make release` or `make rollback`
# to its end (it ends with a check of the live site). Both record when they
# started in .release-started; a run only counts if GitHub created it after
# that, so a run still being queued is waited for instead of the previous
# release being reported. Without the file, it follows the latest run.
#
# Usage: scripts/verify.sh
set -euo pipefail

since=$(cat .release-started 2>/dev/null || true)
id=
for _ in $(seq 60); do
	id=$(gh run list --workflow release.yml --limit 5 --json databaseId,createdAt \
		--jq "[.[] | select(.createdAt >= \"${since}\")][0].databaseId // empty")
	[ -n "$id" ] && break
	sleep 2
done
if [ -z "$id" ]; then
	echo "verify: no release run created since ${since:-ever} (waited 2 min)." >&2
	exit 1
fi
gh run watch "$id" --exit-status
