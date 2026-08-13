#!/usr/bin/env bash
#
# Push the local commit(s), rebasing onto origin/main and retrying if another
# workflow landed a commit first (COL-24).
#
# refresh-data.yml and refresh-sp500.yml both commit and push to main from
# their own long-running jobs, and never touch the same file — so a rejected
# push here is always a stale base, never a real conflict. Rebasing and
# retrying is safe; a plain `git push` is not, because it silently drops the
# whole run's collected data when it loses the race.

set -euo pipefail

ATTEMPTS=5

for i in $(seq 1 "$ATTEMPTS"); do
  if git push; then
    exit 0
  fi
  echo "push rejected (attempt $i/$ATTEMPTS) — fetching and rebasing onto origin/main"
  git fetch origin main
  git rebase origin/main
done

echo "error: git push still rejected after $ATTEMPTS attempts" >&2
exit 1
