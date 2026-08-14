#!/bin/bash

# Static, Docker-build-free regression guard for the production stage's CMD
# and HEALTHCHECK instructions in Dockerfile.
#
# Exec-form CMD/HEALTHCHECK arrays (e.g. ["serve", "-s", "dist", "-l",
# "8080"]) never go through a shell, so ${PORT}-style expansion silently
# never happens even with ENV PORT=8080 set above them. This check fails
# fast (no image build required) if either instruction reverts to that
# hardcoded exec form, catching the regression this project's #46 fixed.
#
# See specs/dynamic-port-binding.md for full context.
#
# Usage: scripts/check-docker-cmd-shell-form.sh [path/to/Dockerfile]

set -euo pipefail

DOCKERFILE="${1:-Dockerfile}"
FAILED=0

if [ ! -f "$DOCKERFILE" ]; then
  echo "❌ $DOCKERFILE not found"
  exit 1
fi

# A line "goes through a shell" if it's either plain shell form (CMD/the
# HEALTHCHECK's nested CMD with no leading JSON array) or an exec-form array
# that explicitly invokes `sh -c "..."`.
shell_form_pattern='"sh"[[:space:]]*,[[:space:]]*"-c"|CMD[[:space:]]+[^["'"'"']'

check_instruction() {
  local label="$1"
  local line="$2"

  if [ -z "$line" ]; then
    echo "❌ No $label instruction found in $DOCKERFILE"
    FAILED=1
    return
  fi

  if ! echo "$line" | grep -qE '\bPORT\b'; then
    echo "❌ $label does not reference PORT — looks like a reverted hardcoded port: $line"
    FAILED=1
    return
  fi

  if ! echo "$line" | grep -qE "$shell_form_pattern"; then
    echo "❌ $label is exec-form without a shell (\$PORT would never expand): $line"
    FAILED=1
    return
  fi

  echo "✅ $label is shell form and references PORT: $line"
}

# Top-level CMD (the production stage's process entrypoint) — anchored to
# start-of-line so it doesn't match the HEALTHCHECK's indented nested CMD.
cmd_line=$(grep -E '^CMD ' "$DOCKERFILE" | tail -n1 || true)
check_instruction "CMD" "$cmd_line"

# HEALTHCHECK's nested CMD — may span two lines via a `\` continuation, so
# grab the HEALTHCHECK line plus the one after it.
healthcheck_block=$(grep -A1 -E '^HEALTHCHECK ' "$DOCKERFILE" | tr '\n' ' ' || true)
check_instruction "HEALTHCHECK" "$healthcheck_block"

exit $FAILED
