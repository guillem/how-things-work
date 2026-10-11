#!/usr/bin/env bash
# Runs `make check` unless the working tree (tracked and untracked files, minus
# git-ignored ones) is identical to the last tree that passed. Used by the git
# pre-push hook and the Claude Code Stop hook, so a turn that changed nothing
# costs nothing. Output and exit status are those of `make check`.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

# A symlinked node_modules (e.g. in a worktree) makes svelte-check resolve the
# generated types against the other checkout and report a spurious error.
if [ -L node_modules ]; then
	echo "node_modules is a symlink; svelte-check would check another checkout's types." >&2
	echo "Replace it with a copy-on-write clone: rm node_modules && cp -cR $(readlink node_modules) node_modules" >&2
	exit 1
fi

stamp=$(git rev-parse --git-path lean-check-ok)
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
# Snapshot the working tree into a throwaway index; the real index is untouched.
cp "$(git rev-parse --git-path index)" "$tmp" 2>/dev/null || rm -f "$tmp"
tree=$(GIT_INDEX_FILE=$tmp git add -A 2>/dev/null && GIT_INDEX_FILE=$tmp git write-tree 2>/dev/null)

if [ -n "$tree" ] && [ "$(cat "$stamp" 2>/dev/null)" = "$tree" ]; then
	echo "make check: nothing changed since the last pass, skipped."
	exit 0
fi
make -k check || exit $?
[ -n "$tree" ] && echo "$tree" >"$stamp"
exit 0
