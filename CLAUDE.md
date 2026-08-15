# CLAUDE.md

Guía de instrucciones para Claude Code al trabajar en este repositorio.

**Proyecto**: `dockyard2sail-ts` — boilerplate TypeScript listo para producción con pnpm, Vite, Vitest y Docker/DevContainers.

---

## Available Skills

Este repositorio incluye los siguientes skills de Claude Code (`.claude/skills/`):

- **`/spec-driven-dev`**: Flujo completo de desarrollo guiado por especificación (idea → spec → plan → tareas → implementación)
- **`/user-stories`**: Escribir y publicar historias de usuario con criterios de aceptación Gherkin en GitHub Issues
- **`/commit-writer`**: Genera conventional commits siguiendo los estándares del proyecto
- **`/testing`**: Flujo TDD con mutation testing, objetivos de cobertura y validación de calidad de tests
- **`/sonar-check`**: Análisis de calidad de código con SonarQube (vía MCP configurado en `.mcp.json`)
- **`/trivy-scan`**: Escaneo de seguridad de vulnerabilidades, secretos, IaC y licencias

Usar estos skills proactivamente cuando sean relevantes para el trabajo en curso.

---

## Package Manager: pnpm (obligatorio)

Este proyecto usa **pnpm exclusivamente**. No usar `npm` ni `yarn` — el `packageManager` en `package.json` y `.npmrc` están configurados para pnpm, y mezclar gestores rompe el lockfile.

```bash
pnpm install
pnpm dev              # servidor de desarrollo (Vite)
pnpm build             # tsc (tsconfig.json) + vite build
pnpm typecheck         # tsc --noEmit sobre tsconfig.json (src) y tsconfig.test.json (tests, rigor relajado)
pnpm test              # vitest en modo watch
pnpm test:run          # vitest una sola corrida
pnpm test:coverage     # vitest con cobertura (v8)
pnpm lint              # biome check (lint)
pnpm format            # biome format --write
pnpm format:check      # biome format (sin escribir, para CI/hooks)
pnpm validate          # alias de `make validate` (ver sección Makefile)
```

---

## Makefile

Interfaz autodocumentada para la validación del proyecto — correr `make` o `make help` sin argumentos lista los targets disponibles (`.DEFAULT_GOAL := help`).

```bash
make help          # lista los targets con su descripción
make up-d           # levanta el contenedor de dev en background, esperando el healthcheck
make lock-check     # pnpm install --frozen-lockfile (vía docker compose exec) — falla si pnpm-lock.yaml no está en sync con package.json
make check-docs     # scripts/check-docs.sh (vía docker compose exec) — versión de CHANGELOG.md en sync + excepciones de CLAUDE.md
make validate       # lock-check + typecheck + test:coverage + build + docker port checks + pnpm audit + check-docs
```

- **Docker-first (issue #53)**: `lock-check`, `lint`, `typecheck`, `test`, `build`, `audit` y `check-docs` corren dentro del contenedor `app` vía `docker compose exec` — cada uno depende del target `up-d` (`docker compose up -d --build --wait`), así que ninguno falla por "conexión rechazada" contra un contenedor que todavía no arrancó. El host solo necesita `make` + Docker instalados, no Node/pnpm.
- **Excepción deliberada**: `check-docker-cmd-shell-form` y `docker-port-smoke-test` siguen invocándose directo en el host, sin pasar por el contenedor — ninguno de los dos necesita Node/pnpm (uno es `grep` puro, el otro solo el CLI/daemon de Docker), y el host ya tiene que tener Docker instalado para todo lo demás. Meterlos en el contenedor exigiría Docker-in-Docker (socket del host montado adentro de `app`) solo para mantener una regla estética de "todo pasa por `docker compose exec`" — complejidad real (permisos non-root, GID variable por host, superficie de escalación de privilegios) sin ninguna ganancia funcional.
- `make validate` es lo que corren `pre-push`/`pre-merge-commit` hacia `main`/`develop` (ver "Git Hooks" abajo) y lo que corre `pnpm validate` como alias.
- Reemplaza al antiguo `scripts/validate.sh` (eliminado) — la lógica vive ahora en el `Makefile`, gateada igual que antes.
- Scope deliberadamente acotado: el Makefile cubre la validación (el único punto donde orquestar varios pasos en secuencia aporta), no envuelve cada script de `pnpm` uno a uno — `pnpm dev`/`pnpm test`/etc. siguen siendo la interfaz directa para el día a día.
- Requiere `make` y Docker en el **host** — los targets Docker-first delegan a `docker compose exec app <cmd>` internamente, así que ya no aplica correr `make` *dentro* del propio contenedor de dev (no tiene el CLI de Docker para recursarse a sí mismo).

---

## Recommended Development Workflow

### Para nuevas features

1. **Spec-Driven Development**: usar `/spec-driven-dev` para transformar ideas en especificaciones estructuradas
   - Fase 1 (Specify): idea → spec en `specs/{feature}.md`
   - Fase 2 (Plan): plan de implementación → `specs/{feature}-plan.md`
   - Fase 3 (Tasks): desglose en tareas → GitHub Issues con `/user-stories`
   - Fase 4 (Implement): ejecutar tareas con TDD usando `/testing`

2. **Implementación**: seguir el ciclo TDD por cada tarea
   - Escribir tests primero (usar escenarios Gherkin de las user stories)
   - Correr tests y verificar que fallan
   - Implementar la funcionalidad
   - Correr tests y verificar que pasan

3. **Quality Gates**: antes de commitear
   - Correr `pnpm typecheck` y `pnpm build`
   - Correr `/sonar-check` para validar calidad de código
   - Correr `/trivy-scan` para el escaneo de seguridad
   - Asegurar que todos los quality gates pasen

4. **Commit**: usar `/commit-writer` para generar conventional commits

5. **Memoria**: guardar aprendizajes en Engram (ver Memory Protocol abajo)

### Para bug fixes

1. Escribir un test que reproduzca el bug (debe fallar)
2. Corregir el bug
3. Verificar que el test pasa
4. Correr quality gates (`/sonar-check`, `/trivy-scan`)
5. Commitear con `/commit-writer`
6. Guardar el bugfix en memoria con `mem_save`

---

## Git Hooks (Husky)

- **`pre-commit`**: corre **gitleaks** (secret scanning sobre el staged diff, ver `.husky/pre-commit` y `.gitleaksignore`) y nada más — deliberadamente rápido, el resto de las validaciones no corren acá.
  - Requiere `gitleaks` instalado en el host (no corre en Docker): [instalación](https://github.com/gitleaks/gitleaks#installing). Si no está instalado, el hook avisa y continúa (no bloquea el commit) — instalarlo es responsabilidad de cada dev.
  - Falsos positivos documentados y justificados van a `.gitleaksignore` (fingerprint por línea), nunca se ignora silenciosamente.
- **`pre-push`**:
  - A `main`/`develop`: corre `make validate` completo (lock-check + typecheck + test:coverage + build + docker port checks + `pnpm audit` + check-docs), Docker-first (issue #53) — sin Node/pnpm en el host
  - A otras ramas: solo `make typecheck` (también vía Docker)
- **`pre-merge-commit`**: mismo split — `make validate` completo a `main`, `make typecheck` en el resto

No usar `--no-verify` para saltar estos hooks salvo pedido explícito del usuario.

---

## Issue Tracking Integration

### GitHub Issues

El repo remoto es `cuauhtemocbe/dockyard2sail-ts` en GitHub. Usar el skill `/user-stories` para crear issues — detecta GitHub automáticamente y usa `gh` o la integración MCP disponible.

### Branch Protection (main)

`main` tiene protección habilitada: sin force-push, sin borrado de la rama. `enforce_admins: false` — decisión deliberada, no descuido: el owner (único colaborador activo) puede seguir pusheando directo cuando hace sentido en un repo solo/bajo tráfico. Desde issue #51, `required_status_checks` está configurado (`strict: false`) con los jobs de `ci.yml` que corren tanto en `push` como en `pull_request`: `Lockfile in sync`, `Lint`, `Type check`, `Test + coverage`, `Build`, `Docker port-binding checks`, `Dependency audit + doc consistency`, `Trivy filesystem scan`. Deliberadamente excluido: `Build and scan production Docker image` (job `docker-image`), gateado a `push`+`main` únicamente (ver "CI/CD (GitHub Actions)" abajo) — nunca corre en un PR, así que exigirlo dejaría todo PR unmergeable. Verificable con `gh api repos/cuauhtemocbe/dockyard2sail-ts/branches/main/protection`.

---

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` corre en cada `push` y `pull_request` sobre `ubuntu-latest`, como **jobs independientes que corren en paralelo** (no un único job monolítico) — así una PR muestra de un vistazo qué categoría falló, sin leer el log completo: `lock-check`, `lint`, `typecheck`, `test`, `docker-checks` (`scripts/check-docker-cmd-shell-form.sh` + `scripts/docker-port-smoke-test.sh`), `audit-and-docs` y `trivy-fs` corren sin dependencias entre sí; `build` declara `needs: [lint, test]` — no vale la pena compilar si el lint o los tests ya fallaron. `docker-image` (build de la imagen de producción + Trivy `scan-type: image`) también declara `needs: [lint, test]`, pero además está gateado con `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` — no corre en PRs, solo al pushear a `main` (sin push a registry, solo build+scan en el runner). Cada job repite su propio checkout (duplicación aceptada: los jobs no comparten filesystem). `src/test/ci-workflow.test.ts` parsea el YAML con `js-yaml` y verifica estructuralmente ese grafo de jobs (nombres presentes, sin `needs` cruzados entre los independientes, `build` y `docker-image` con `needs: [lint, test]`, el gate de `docker-image` a `push`+`main`, y — desde issue #53 — que los 6 jobs Docker-first no usan `setup-node`/`pnpm/action-setup` y sí invocan un target de `make`, mientras `docker-checks`/`trivy-fs`/`docker-image` se quedan sin tocar), así una regresión de la estructura del workflow la atrapa la propia suite de tests.

**Docker-first (issue #53)**: `lock-check`, `lint`, `typecheck`, `test`, `build` y `audit-and-docs` ya no usan `actions/setup-node`/`pnpm/action-setup` — cada uno hace `checkout` y después `run: make <target>` (`make lock-check`, `make lint`, `make typecheck`, `make test`, `make build`; `audit-and-docs` corre `make audit` + `make check-docs`), delegando a `docker compose exec app <cmd>` igual que en local (ver "Makefile" arriba). El runner solo necesita Docker, no Node/pnpm — mismo mecanismo que usan los git hooks. `docker-checks`, `trivy-fs` y `docker-image` quedan **sin cambios**: ninguno usaba `setup-node` para empezar (ya eran Docker puro o Trivy directo), así que no había nada que migrar ahí. `timeout-minutes` de los 6 jobs migrados sube de 10 a 15 para absorber el build de `Dockerfile.dev` en cada corrida.

- `permissions: contents: read` (mínimo privilegio); las actions de terceros que quedan en `ci.yml` (`actions/checkout`, `aquasecurity/trivy-action`) pineadas a commit SHA con comentario de versión (ej. `actions/checkout@<sha> # v4.4.0`) — no a tag flotante, para eliminar el riesgo de que un tag re-apuntado (ej. el compromiso de `tj-actions/changed-files` en 2025) ejecute código distinto sin cambios visibles en este archivo; `.github/dependabot.yml` ya trackea el ecosystem `github-actions`, así que el pineo por SHA no pierde auto-update. `pnpm/action-setup` y `actions/setup-node` ya no aparecen en `ci.yml` — desde issue #53 los jobs Docker-first no las necesitan, `docker compose exec` reemplaza el setup de Node/pnpm que hacían. `timeout-minutes: 10` por job en los jobs sin tocar, `15` en los 6 jobs Docker-first.
- El workflow **ahora comparte el mismo entrypoint** que los git hooks: `pre-push`/`pre-merge-commit` corren `make validate` o `make typecheck` localmente (ver "Git Hooks" arriba), y los jobs de CI invocan los targets granulares del mismo `Makefile` (`make lint`, `make typecheck`, etc.) por separado para poder correr en paralelo y reportar por categoría — mismo mecanismo Docker-first (`docker compose exec app <cmd>`) en ambos lados, ya no dos caminos distintos. CI es la red de seguridad en el server; los hooks son el feedback rápido en el host.
- El job `trivy-fs` (`aquasecurity/trivy-action`, pineado a SHA) corre `scan-type: fs` con `scanners: vuln,secret,config` sobre el repo completo, con `severity: HIGH,CRITICAL` + `exit-code: 1` — falla el job ante cualquier hallazgo HIGH/CRITICAL (dependencias, secretos o misconfigs de IaC/GitHub Actions). Cierra el gap de que `/trivy-scan` es manual-only y de que `pnpm audit` (job `audit-and-docs`) solo cubre CVEs de npm, no secretos ni IaC. Excepciones aceptadas van en `.trivyignore` (formato plano, distinto del `.trivyignore.yaml` estructurado que usa el skill `/trivy-scan` para escaneos locales — ambos conviven, no hay conflicto).
- El job `docker-image` reusa el mismo pin de `aquasecurity/trivy-action` que `trivy-fs`, pero con `scan-type: image` contra la imagen recién buildeada (`docker build -f Dockerfile -t dockyard2sail-ts:${{ github.sha }} .`), mismo `severity: HIGH,CRITICAL` + `exit-code: 1` y mismo `.trivyignore` compartido. Sin push a registry (fuera de scope, issue #50) — build+scan en el runner alcanza para atrapar una imagen rota o con CVE antes de deployar. **Gap conocido**: la imagen de producción instala `pnpm` globalmente solo para poder correr `pnpm add -g serve`, y ese pnpm (con sus deps transitivas) queda bundleado en la imagen final aunque nunca se ejecuta en runtime — 27 hallazgos HIGH/CRITICAL confirmados en un baseline local al implementar #50. Tracking en issue #56 (deliberadamente separado de #50 para no mezclar "agregar el job de CI" con "limpiar la imagen"): hasta que #56 mergee, `docker-image` va a fallar en `main`.

> Nota histórica: hasta esta story, este repo mantenía la **ausencia** de GitHub Actions como excepción deliberada (`make validate` en `pre-push` bastaba para un repo solo/bajo tráfico). Se revirtió esa decisión al incorporar el repo al layer de auto-merge de meta-projects, que exige un `.github/workflows/` con un status check para que un PR sea auto-merge-eligible (`is_automerge_allowed` en `scripts/lib/common.sh`). Habilitar auto-merge y agregar `required_status_checks` a la protección de rama son decisiones separadas y posteriores.

> Nota histórica: hasta la introducción del `Makefile`, este repo tampoco tenía `Makefile` como excepción deliberada — se revirtió esa decisión al introducir `make validate` en reemplazo de `scripts/validate.sh`.

### Dependabot Socket Firewall gate

`.github/workflows/dependabot-socket-firewall.yml` es un workflow separado (no un job dentro de `ci.yml`), gateado a `if: github.actor == 'dependabot[bot]'`: reinstala las dependencias de la PR vía `sfw pnpm install --frozen-lockfile` (Socket Firewall Free) y, si `sfw` bloquea un paquete por comportamiento malicioso/comprometido, cierra la PR automáticamente con `gh pr close` y un comentario explicando el motivo.

- Existe como workflow aparte y no como job de `ci.yml` porque necesita `permissions: pull-requests: write` — `ci.yml` se mantiene en `contents: read` (mínimo privilegio) para cualquier PR humana o de bot.
- Solo corre para PRs de `dependabot[bot]`: son las únicas que proponen bumps de dependencias de terceros sin que nadie las revise línea por línea antes de ser mergeables. PRs humanas no disparan este job.
- El paso `SocketDev/action` está pineado a SHA porque es el componente que corre con permiso de escritura sobre PRs. Sus pasos de `checkout`/`pnpm`/`setup-node` siguen en `@v4` (tag flotante) — decisión deliberada y explícita de este workflow, separada del pineo por SHA que `ci.yml` sí aplica a esas mismas tres actions (issue #29, resuelto ahí).
- Patrón portado del repo hermano `dockyard2sail-py` (commit `89d33ea`), adaptado: ese repo usa Poetry y `sfw` no soporta Poetry directamente, así que exporta el lockfile a `requirements.txt` primero; acá `sfw` soporta pnpm nativamente, así que corre directo contra `pnpm-lock.yaml` sin paso de traducción.
- Alcance: solo dependencias npm (vía pnpm). Los ecosystems `docker` y `github-actions` de `.github/dependabot.yml` no pasan por este gate — `sfw` no tiene modo de escaneo para imágenes Docker (Trivy ya cubre eso, ver "Security Scanning" abajo) ni para bumps de GitHub Actions.

---

## Memory (Engram)

Acceso a memoria persistente vía MCP tools (`mem_save`, `mem_search`, `mem_session_summary`, etc.).

- Guardar proactivamente después de trabajo significativo — no esperar a que se pida.
- Después de cualquier compactación o reset de contexto, llamar `mem_context` para recuperar el estado de sesiones previas antes de continuar.

### Cuándo guardar
- Bugfix terminado → `mem_save` (type: bugfix)
- Decisión de arquitectura o tecnología → `mem_save` (type: decision, topic_key: "architecture/xxx")
- Gotcha o patrón no obvio descubierto → `mem_save` (type: discovery)
- Configuración no trivial → `mem_save` (type: config)
- Preferencia del proyecto o del usuario identificada → `mem_save` (type: preference)

### Al iniciar sesión
1. Llamar `mem_context` para revisar historial reciente (rápido y barato)
2. Si falta contexto relevante, llamar `mem_search` con keywords del tema actual

### Al cerrar sesión
Llamar `mem_session_summary` con estructura:
- Goal: qué se intentaba lograr
- Accomplished: qué se completó
- Discoveries: hallazgos importantes
- Files: archivos relevantes modificados

### En caso de compactación
Si aparece un mensaje de reset o compactación de contexto:
1. Llamar INMEDIATAMENTE `mem_session_summary` con el contenido del resumen compactado
2. Luego llamar `mem_context` para recuperar contexto adicional

No saltear el paso 1 — sin él se pierde todo lo hecho antes de la compactación.

---

## Development Guidelines

### Quality Standards

- **Test Coverage**: usar el skill `/testing` para mantener objetivos de cobertura y mutation scores
- **Code Quality**: usar `/sonar-check` para validar Quality Gates (complejidad, duplicación, mantenibilidad) — proyecto SonarQube `dockyard2sail-ts` configurado en `.mcp.json` / `sonar-project.properties`
- **Security**: usar `/trivy-scan` para detectar vulnerabilidades, secretos y misconfiguraciones
- **Commit Messages**: usar `/commit-writer` para conventional commits con body y co-authoring adecuados

### TDD Cycle (skill `/testing`)

1. **Red**: escribir tests que fallen (usar escenarios Gherkin de `/user-stories` como guía)
2. **Green**: implementar el mínimo código para pasar los tests
3. **Refactor**: mejorar el código manteniendo los tests en verde
4. **Verify**: correr quality gates (`/sonar-check`, `/trivy-scan`)
5. **Commit**: generar commit con `/commit-writer`
6. **Remember**: guardar aprendizajes con `mem_save`

### Antes de mergear

- [ ] Todos los tests pasando (`pnpm test:run`)
- [ ] Cobertura de tests dentro del objetivo (usar `/testing` como guía)
- [ ] `pnpm typecheck` sin errores
- [ ] `pnpm build` exitoso
- [ ] SonarQube Quality Gate aprobado (`/sonar-check`)
- [ ] Escaneo de seguridad limpio (`/trivy-scan`)
- [ ] Mensajes de commit siguen convenciones (`/commit-writer`)
- [ ] User stories actualizadas/cerradas con evidencia (`/user-stories`)

---

## Architecture and Design Rules

Este proyecto es un **boilerplate**, no una aplicación de dominio complejo — mantener esa simplicidad al extenderlo.

**Estructura actual:**
```
src/
├── main.ts          # Punto de entrada
└── test/
    ├── main.test.ts
    └── setup.ts
```

**Principios al agregar código:**
- **KISS**: código plano, fácil de leer y testear. Preferir funciones puras sobre clases cuando sea posible.
- **Structural Typing**: aprovechar el duck typing estructural de TypeScript; usar `interface` en vez de jerarquías de clases.
- **Módulos ES**: `package.json` tiene `"type": "module"` — usar imports ESM, no `require`.
- **TypeScript estricto**: respetar la configuración de `tsconfig.json` (ES2022, source maps, path aliases). `src/test/**` usa `tsconfig.test.json` (extiende la base, relaja `noUnusedLocals`/`noUnusedParameters` — mocks y dobles de test sin usar son aceptables ahí, no vale la pena el costo de rigor).
- Si el proyecto crece más allá de un boilerplate (agrega dominio de negocio real), introducir separación de capas (presentación / lógica de negocio / infraestructura) recién en ese momento — no antes.

---

## Docker

- **`Dockerfile`**: build multi-stage para producción
- **`Dockerfile.dev`**: entorno de desarrollo (usado por DevContainers y `docker-compose.yml`) — incluye `make` (apk) para uso interactivo dentro del contenedor (`docker compose exec app bash` → `make ...`); desde issue #53 el flujo Docker-first invoca `make` desde el **host** (que delega a `docker compose exec app <cmd>`), no al revés. También pre-crea y chownea `/app/node_modules` (`node:node`) antes de cambiar de usuario — el volumen nombrado que lo shadowea (ver abajo) se inicializa root-owned si no, y el usuario non-root `node` no podría escribir ahí.
- **`docker-compose.yml`**: levanta el entorno de desarrollo completo — el servicio `app` tiene `healthcheck` (confirma que `pnpm` está disponible), usar `--wait` para no ejecutar comandos contra un contenedor que todavía no está listo. Volúmenes: `pnpm-store` (caché de pnpm) y, desde issue #53, `node_modules` — ambos nombrados y Docker-only, nunca tocan el filesystem del host. El segundo evita mismatches de binarios nativos (esbuild, etc.) cuando el host es de otro OS/arch que la imagen Linux, y es justo lo que hace posible que `pnpm install` corra en Docker sin dejar artefactos de Node en un host que no debería necesitarlos. `dist/` (build output) sigue bind-mounted normal — a diferencia de `node_modules`, no tiene binarios nativos y es útil tenerlo visible en el host para inspección.

```bash
docker compose up -d --wait
docker compose exec app bash
```

### Dynamic PORT binding (producción)

El stage `production` de `Dockerfile` setea `ENV PORT=8080` y usa `CMD`/`HEALTHCHECK` en shell form explícito (`["sh", "-c", "... ${PORT:-8080} ..."]`) para que `$PORT` se expanda al arrancar el contenedor — el form exec-form array (`CMD ["serve", "-s", "dist", "-l", "8080"]`) nunca pasa por un shell, así que la sustitución de variables nunca ocurría aunque `ENV PORT` estuviera seteado. Sin `PORT` seteado, el contenedor escucha en 8080 (comportamiento por defecto sin cambios); con `PORT=<N>` seteado en `docker run`, escucha en `<N>`.

Dos checks nuevos verifican esto automáticamente, ambos corridos por `make validate` (por lo tanto en `pre-push`/`pre-merge-commit` a `main`/`develop` y en `ci.yml` en cada push):

- **`make check-docker-cmd-shell-form`** (`scripts/check-docker-cmd-shell-form.sh`): chequeo estático vía grep/regex, sin build de Docker — falla rápido si `CMD` o `HEALTHCHECK` vuelven a exec-form hardcodeado o dejan de referenciar `PORT`. Guardia de regresión de feedback instantáneo.
- **`make docker-port-smoke-test`** (`scripts/docker-port-smoke-test.sh`): build real de la imagen de producción, corre dos escenarios (sin `PORT` → espera 8080, con `PORT=3000` → espera 3000), en cada uno hace `curl` desde el host al puerto mapeado dinámicamente y verifica HTTP 200 + `docker inspect --format='{{.State.Health.Status}}'` == `healthy`. Limpia los contenedores/imagen que crea al salir, tanto en éxito como en falla.

---

## Testing Guidelines

Usar el skill `/testing` para guía completa de testing:

- **TDD Workflow**: ciclo Red → Green → Refactor
- **Framework**: Vitest (config integrada en `vite.config.ts`, entorno jsdom, ver `src/test/setup.ts`)
- **Cobertura**: `@vitest/coverage-v8`, reporte en `coverage/lcov.info` (consumido por SonarQube)
- **Mutation Testing**: interpretación de mutation scores y cómo mejorarlos

---

## Security Scanning

Usar el skill `/trivy-scan` para detectar issues de seguridad antes de que lleguen a producción:

**Qué escanea:**
- **Vulnerabilidades**: dependencias npm/pnpm, imagen base de Docker
- **Secretos**: API keys, passwords, tokens commiteados accidentalmente
- **IaC**: `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`
- **Licencias**: compliance de dependencias

**Cuándo correrlo:**
- Antes de commitear (detecta secretos antes de que entren al historial de git)
- Antes de mergear PRs
- Periódicamente (nuevos CVEs en dependencias existentes — este proyecto ya tuvo varias rondas de upgrades por CVEs, ver historial de commits `fix(security)`)

**Ignore workflow**: usar `.trivyignore` para riesgos aceptados (documentar el motivo)

---

## Code Quality Analysis

Usar el skill `/sonar-check` para validar métricas de calidad de código:

**Configuración actual** (`sonar-project.properties`):
- `sonar.projectKey=dockyard2sail-ts`
- `sonar.sources=src`, `sonar.tests=src`
- Cobertura vía `coverage/lcov.info`
- Excluye de cobertura: `main.ts`, `setup.ts`, archivos `*.test.ts`/`*.spec.ts`

**Quality Gates** (ajustar según crezca el proyecto):
- Maintainability Rating: A o B
- Reliability Rating: A
- Security Rating: A
- Coverage: objetivo >= 80%
- Duplication: < 3%

**MCP**: el servidor SonarQube está configurado en `.mcp.json` (vía Docker, `mcp/sonarqube`). Si no está disponible, el skill hace fallback a Docker + `sonar-scanner` CLI.

**Nota**: `.mcp.json` nunca estuvo trackeado en git (está en `.gitignore` desde siempre, `git log --all -- .mcp.json` no devuelve nada) — el token de SonarQube que contiene es local a la máquina de cada dev, no está expuesto en el historial del repo. Mantenerlo gitignored es suficiente; no hace falta rotarlo salvo sospecha concreta de compromiso.

---

## User Stories and Issue Management

Usar el skill `/user-stories` para escribir y gestionar historias de usuario:

- Historias en lenguaje de dominio (no implementación técnica)
- Validación con criterios **INVEST**
- Criterios de aceptación en formato **Gherkin** (Given/When/Then)
- División de historias grandes con **SPIDR**
- Publicación a GitHub Issues (`cuauhtemocbe/dockyard2sail-ts`) con formato y labels adecuados
- Cierre de issues con evidencia (cambios, tests, links a PRs)

**Regla fundamental**: todo criterio de aceptación DEBE tener un test automatizado. Sin excepciones.
