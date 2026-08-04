# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Workflow de CI en GitHub Actions (`.github/workflows/ci.yml`): corre `make validate` en cada `push`/`pull_request` (Node 22 + pnpm 9, `--frozen-lockfile`), reportando un status check por PR. Habilita al repo para el layer de auto-merge de meta-projects (`is_automerge_allowed`).
- Workflow `.github/workflows/dependabot-socket-firewall.yml`: gatea las PRs de `dependabot[bot]` contra Socket Firewall Free (`sfw pnpm install --frozen-lockfile`), cerrando automáticamente la PR si `sfw` bloquea un paquete por comportamiento malicioso/comprometido. Cierra el gap de "PRs automatizadas sin revisión humana" (issue #32), portado del patrón ya validado en `dockyard2sail-py`.

### Changed

- `.github/dependabot.yml`: agregado un bloque `groups.minor-and-patch` (`update-types: ["minor", "patch"]`) a cada ecosystem (`npm`, `docker`, `github-actions`) para que los bumps menores/patch lleguen agrupados en un solo PR por ecosystem en vez de uno por dependencia. Los bumps `major` quedan fuera del grupo y siguen abriendo PR individual, alineado con la política de nunca auto-mergear majors en meta-projects.

## [1.0.0] - 2026-07-15

### Added

- pnpm como package manager principal, con `packageManager`/`engines` en `package.json` y `.npmrc` (ver commit `7bfbcff`)
- Soporte para Node.js 22 LTS en Docker (`Dockerfile`, `Dockerfile.dev`) (ver commit `0847a37`)
- Integración con SonarQube para análisis de calidad de código (ver commit `f5fe3f0`)
- Secret scanning con gitleaks en `pre-commit` (ver commit `70aec14`)

### Changed

- Actualizado Vitest de 2.1.9 a 4.1.5, resolviendo CVEs moderados en esbuild/vite transitivos (ver commit `9f68952`)
- Consolidada la configuración de Vitest dentro de `vite.config.ts`, eliminando `vitest.config.ts` (ver commit `3a842b8`)

### Fixed

- Resueltas múltiples vulnerabilidades de dependencias detectadas por Trivy (RCE en rollup, XSS en postcss, path traversal en vite) (ver commit `53fda82`)
