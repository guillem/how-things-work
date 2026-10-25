#!/usr/bin/env bash
# Claude Code Stop hook: before Claude ends a turn, run `make quick` (skipped
# when nothing changed since the last pass) and, if it fails, block the stop
# and hand Claude the failure to fix. At most 3 blocks in a row per session;
# then the turn ends with a warning to the user, so a failure Claude can't fix
# never loops. (Claude Code also overrides a run of 8 blocks on its own.)
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
[ -f Makefile ] || exit 0

input=$(cat)
session=$(node -e '
	let s = "";
	process.stdin.on("data", (d) => (s += d)).on("end", () => {
		try { process.stdout.write(String(JSON.parse(s).session_id ?? "")); } catch {}
	});' <<<"$input" | tr -cd 'A-Za-z0-9-')
counter=$(git rev-parse --git-path "lean-stop-blocks-${session:-default}")
MAX=3

if out=$(scripts/check-if-changed.sh 2>&1); then
	rm -f "$counter"
	exit 0
fi

n=$(($(cat "$counter" 2>/dev/null || echo 0) + 1))
if [ "$n" -gt "$MAX" ]; then
	rm -f "$counter"
	node -e 'console.log(JSON.stringify({ systemMessage: process.argv[1] }))' \
		"make quick still fails after $MAX attempts to fix it; the turn ends anyway. Run make quick to see why."
	exit 0
fi
echo "$n" >"$counter"

# Keep the end of the output, where make reports the failure; stay well under
# the 10,000-character limit on hook output.
tail_out=$(printf '%s\n' "$out" | tail -n 120 | cut -c1-300 | tail -c 7000)
node -e 'console.log(JSON.stringify({ decision: "block", reason: process.argv[1] }))' \
	"make quick failed (attempt $n of $MAX). Fix the cause, then finish. Never weaken, skip or delete a test to make it pass; if the test is right and the code is wrong, fix the code.

$tail_out"
exit 0
