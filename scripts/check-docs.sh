#!/bin/bash

# Documentation consistency checks: CHANGELOG version vs package.json, and
# that CLAUDE.md still documents the CI/CD (GitHub Actions) setup.

set -e

FAILED=0

check_changelog_version() {
  local pkg_version
  local changelog_version

  pkg_version=$(node -p "require('./package.json').version")
  changelog_version=$(grep -m1 -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' CHANGELOG.md | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')

  if [ -z "$changelog_version" ]; then
    echo "❌ CHANGELOG.md: no dated [x.y.z] section found"
    FAILED=1
    return
  fi

  if [ "$pkg_version" != "$changelog_version" ]; then
    echo "❌ CHANGELOG.md version ($changelog_version) does not match package.json version ($pkg_version)"
    FAILED=1
  else
    echo "✅ CHANGELOG.md version matches package.json ($pkg_version)"
  fi
}

check_claude_md_exceptions() {
  if ! grep -q "CI/CD (GitHub Actions)" CLAUDE.md; then
    echo "❌ CLAUDE.md: missing the documented CI/CD (GitHub Actions) section"
    FAILED=1
  else
    echo "✅ CLAUDE.md documents the CI/CD (GitHub Actions) setup"
  fi
}

check_changelog_version
check_claude_md_exceptions

exit $FAILED
