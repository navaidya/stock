#!/usr/bin/env bash
#
# Stage and commit collected market data (COL-6, COL-14, COL-15).
#
# This exists as a script rather than inline workflow YAML so it can be tested.
# The inline version it replaces was subtly wrong in a way that made the whole
# pipeline a no-op:
#
#   git diff --quiet -- data/market.json || git commit -am '...'
#
# `git diff` ignores untracked files and exits 0, so on the first run — when
# market.json is not yet tracked — the `||` short-circuited and nothing was
# committed. `git commit -am` would not have staged an untracked file anyway.
# Every run was green and discarded its own output, permanently: the file never
# became tracked, so the next run repeated the same failure.
#
# The fix is to stage explicitly and then test the *index*, not the worktree.

set -euo pipefail

FILE="${1:-data/market.json}"
MESSAGE="${2:-chore: refresh market data}"

if [ ! -f "$FILE" ]; then
  echo "error: $FILE does not exist — collection did not produce output." >&2
  exit 1
fi

git add -- "$FILE"

# Compare the index against HEAD. An untracked file that was just staged shows
# as a change here, which is exactly the first-run case the old version missed.
if git diff --cached --quiet -- "$FILE"; then
  echo "No change to $FILE; nothing to commit."
  exit 0
fi

# The pathspec keeps this to the data file. The previous `-a` would have swept
# in any other file the job happened to modify.
git commit -q -m "$MESSAGE" -- "$FILE"
echo "Committed $FILE."
