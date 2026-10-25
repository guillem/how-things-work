#!/usr/bin/env bash
# Shared cached static/model validation for the Claude Stop hook and pre-push.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec node scripts/validate.mjs quick "$@"
