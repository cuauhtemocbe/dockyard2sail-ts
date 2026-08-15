# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Workflow de CI en GitHub Actions (`.github/workflows/ci.yml`): corre `make validate` en cada `push`/`pull_request` (Node 22 + pnpm 9, `--frozen-lockfile`), reportando un status check por PR. Habilita al repo para el layer de auto-merge de meta-projects (`is_automerge_allowed`).
- Workflow `.github/workflows/dependabot-socket-firewall.yml`: gatea las PRs de `dependabot[bot]` contra Socket Firewall Free (`sfw pnpm install --frozen-lockfile`), cerrando automáticamente la PR si `sfw` bloquea un paquete por comportamiento malicioso/comprometido. Cierra el gap de "PRs automatizadas sin revisión humana" (issue #32), portado del patrón ya validado en `dockyard2sail-py`.
- `.github/workflows/ci.yml`: nuevo job `docker-image`, gateado a `push` en `main` (no corre en PRs) y con `needs: [lint, test]` — buildea la imagen de producción (`docker build -f Dockerfile ...`) y la escanea con Trivy (`scan-type: image`, mismo gate HIGH/CRITICAL que `trivy-fs`). Sin push a registry, build+scan en el runner alcanza para atrapar una imagen rota o con CVE antes de deployar. `src/test/ci-workflow.test.ts` extendido con cobertura estructural del job (issue #50).

### Changed

- `.github/dependabot.yml`: agregado un bloque `groups.minor-and-patch` (`update-types: ["minor", "patch"]`) a cada ecosystem (`npm`, `docker`, `github-actions`) para que los bumps menores/patch lleguen agrupados en un solo PR por ecosystem en vez de uno por dependencia. Los bumps `major` quedan fuera del grupo y siguen abriendo PR individual, alineado con la política de nunca auto-mergear majors en meta-projects.
- `.github/workflows/ci.yml`: el job único `validate` (que corría `make validate` secuencial) se divide en jobs independientes (`lock-check`, `lint`, `typecheck`, `test`, `docker-checks`, `audit-and-docs`, `trivy-fs`) que corren en paralelo, más `build` con `needs: [lint, test]` — así una PR muestra qué categoría falló sin leer el log completo. `make validate` no cambia (sigue siendo el comando único para hooks locales); los jobs de CI invocan los `pnpm`/scripts subyacentes por separado. Agrega `src/test/ci-workflow.test.ts` (parsea el YAML con `js-yaml`, nueva devDependency junto con `@types/js-yaml`) que verifica estructuralmente el grafo de jobs (issue #48).
- `scripts/check-docs.sh`: agrega `check_license_exists` (falla si `LICENSE` desaparece del root del repo, issue #49) y `check_readme_docker_pinning` (falla si `README.md` pierde la explicación de por qué la imagen de producción está pineada por digest y la de dev usa tag flotante, issue #47). `README.md` ahora documenta esa asimetría explícitamente en "🐳 Comandos Docker". Ambos chequeos corren dentro de `make validate` (job `audit-and-docs` en CI). Agrega `src/test/check-docs.test.ts`.
- Branch protection de `main`: agrega `required_status_checks` (`strict: false`) con los jobs de `ci.yml` que corren en `pull_request` (`Lockfile in sync`, `Lint`, `Type check`, `Test + coverage`, `Build`, `Docker port-binding checks`, `Dependency audit + doc consistency`, `Trivy filesystem scan`), excluyendo deliberadamente `Build and scan production Docker image` (gateado a `push`+`main`, nunca corre en un PR). `enforce_admins` se mantiene en `false`. Cambio de settings vía `gh api`, verificado re-consultando `branches/main/protection` (issue #51).

### Fixed

- `pnpm.overrides` en `package.json` pinea `nanoid` a `3.3.18`, resolviendo `CVE-2026-67213` (HIGH, DoS por loop infinito en la generación de IDs aleatorios). `nanoid` es dependencia transitiva de `postcss` (vía `vite`/`vitest`/`@vitest/*`), que solo declara `^3.3.16` — sin el override, `pnpm` seguía resolviendo el `3.3.17` vulnerable ya publicado. `main`'s `trivy-fs` job estaba rojo por este hallazgo, sin relación con ninguna PR en curso (issue #58).
- `Dockerfile` (stage `production`): el `pnpm` instalado solo para correr `pnpm add -g serve` (nunca se usa en runtime, se descarta antes de que la imagen se publique) sube de `9.0.0` a `11.21.0` — la versión `9.0.0` traía 27 hallazgos HIGH/CRITICAL propios y de sus dependencias bundleadas (`tar`, `glob`, `minimatch`, `cross-spawn`, entre otras). Se prefirió actualizar `pnpm` en vez de reemplazarlo por `npm` (que igual se remueve de la imagen final) para mantener `pnpm` como la única herramienta de gestión de paquetes usada, alineado con la convención del proyecto. El stage `builder` no se toca — sigue en `pnpm@9.0.0`, en paridad con `packageManager` para la resolución del lockfile. Verificado con `trivy image` (0 hallazgos) y `scripts/docker-port-smoke-test.sh` (issue #56).
- `Dockerfile` (stage `production`): `CMD` y `HEALTHCHECK` pasan de exec-form a shell-form explícito (`["sh", "-c", "... ${PORT:-8080} ..."]`) para que `$PORT` se expanda al arrancar el contenedor — el exec-form array previo nunca pasaba por un shell, así que `ENV PORT=8080` no tenía ningún efecto real y el contenedor siempre escuchaba en 8080 sin importar el `PORT` inyectado por la plataforma de deploy. Agrega `scripts/check-docker-cmd-shell-form.sh` (chequeo estático, sin build) y `scripts/docker-port-smoke-test.sh` (build real + dos escenarios de runtime), ambos corridos por `make validate` (issue #46).

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
