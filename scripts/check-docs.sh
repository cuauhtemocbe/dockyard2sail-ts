#!/bin/bash

# Documentation consistency checks: CHANGELOG version vs package.json, that
# CLAUDE.md still documents the CI/CD (GitHub Actions) setup, that LICENSE
# hasn't disappeared, that README.md still explains the single digest-pinned
# node chain shared by dev and prod (how to refresh it, Dependabot), and that
# every `FROM node:` line in Dockerfile and Dockerfile.dev uses that same chain.

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

check_license_exists() {
  if [ ! -f "LICENSE" ]; then
    echo "❌ LICENSE file not found at repo root"
    FAILED=1
  else
    echo "✅ LICENSE file present"
  fi
}

check_readme_docker_pinning() {
  if ! grep -qi "digest" README.md || ! grep -qi "reproducibles" README.md; then
    echo "❌ README.md: falta la explicación de por qué las imágenes están pineadas por digest (builds reproducibles)"
    FAILED=1
  elif ! grep -qi "misma cadena" README.md; then
    echo "❌ README.md: falta la explicación de que dev y producción usan la misma cadena node:<tag>@sha256:<digest>"
    FAILED=1
  elif ! grep -qi "docker inspect" README.md; then
    echo "❌ README.md: falta la explicación de cómo refrescar la cadena pineada (docker pull + docker inspect)"
    FAILED=1
  elif ! grep -qi "dependabot" README.md; then
    echo "❌ README.md: falta la explicación de que Dependabot (ecosistema docker) mantiene la cadena pineada al día"
    FAILED=1
  else
    echo "✅ README.md documenta la misma cadena pineada en dev y producción, cómo refrescarla y Dependabot"
  fi
}

check_node_from_chain() {
  local file
  local refs=""
  local unpinned
  local distinct

  for file in Dockerfile Dockerfile.dev; do
    if [ ! -f "$file" ]; then
      echo "❌ $file not found at repo root (needed to verify the pinned node chain)"
      FAILED=1
      return
    fi
    refs+="$(grep -iE '^FROM[[:space:]]+node:' "$file" | awk '{print $2}')"$'\n'
  done

  refs=$(printf '%s' "$refs" | sed '/^$/d')

  if [ -z "$refs" ]; then
    echo "❌ Dockerfile / Dockerfile.dev: no se encontró ninguna línea FROM node:"
    FAILED=1
    return
  fi

  unpinned=$(printf '%s\n' "$refs" | grep -vcE '^node:[^@[:space:]]+@sha256:[0-9a-f]{64}$' || true)
  if [ "$unpinned" -ne 0 ]; then
    echo "❌ Dockerfile / Dockerfile.dev: todo FROM node: debe llevar digest (node:<tag>@sha256:<digest>), pero hay $unpinned sin digest:"
    printf '%s\n' "$refs" | sort -u | sed 's/^/   /'
    FAILED=1
    return
  fi

  distinct=$(printf '%s\n' "$refs" | sort -u | wc -l)
  if [ "$distinct" -ne 1 ]; then
    echo "❌ Dockerfile / Dockerfile.dev: todos los FROM node: deben usar la misma cadena node:<tag>@sha256:<digest>, pero hay $distinct distintas:"
    printf '%s\n' "$refs" | sort -u | sed 's/^/   /'
    FAILED=1
    return
  fi

  echo "✅ Dockerfile y Dockerfile.dev usan la misma cadena node:<tag>@sha256:<digest>"
}

check_changelog_version
check_claude_md_exceptions
check_license_exists
check_readme_docker_pinning
check_node_from_chain

exit $FAILED
