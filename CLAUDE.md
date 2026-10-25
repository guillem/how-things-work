# Claude Code instructions

Read [AGENTS.md](AGENTS.md), the authoritative project workflow shared by all agents.
Read [docs/STATUS.md](docs/STATUS.md) for current work. The Stop hook runs cached
static/model checks through `scripts/check-if-changed.sh`; browser validation is
run explicitly with `make changed`. Every deployment runs the full suite in CI.
