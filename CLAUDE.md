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
pnpm build             # tsc + vite build
pnpm typecheck         # solo chequeo de tipos
pnpm test              # vitest en modo watch
pnpm test:run          # vitest una sola corrida
pnpm test:coverage     # vitest con cobertura (v8)
pnpm lint              # biome check (lint)
pnpm format            # biome format --write
pnpm format:check      # biome format (sin escribir, para CI/hooks)
pnpm validate          # typecheck + test:run + build (scripts/validate.sh)
```

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
  - A `main`/`develop`: corre `scripts/validate.sh` completo (typecheck + test + build + `pnpm audit`)
  - A otras ramas: solo `pnpm typecheck`
- **`pre-merge-commit`**: validación completa

No usar `--no-verify` para saltar estos hooks salvo pedido explícito del usuario.

---

## Issue Tracking Integration

### GitHub Issues

El repo remoto es `cuauhtemocbe/dockyard2sail-ts` en GitHub. Usar el skill `/user-stories` para crear issues — detecta GitHub automáticamente y usa `gh` o la integración MCP disponible.

### Branch Protection (main)

`main` tiene protección habilitada: sin force-push, sin borrado de la rama. `enforce_admins: false` — decisión deliberada, no descuido: el owner (único colaborador activo) puede seguir pusheando directo cuando hace sentido en un repo solo/bajo tráfico. No hay `required_status_checks` porque no hay CI hosteado — ver la sección siguiente.

---

## Excepciones deliberadas de tooling

Este proyecto se desvía de dos prácticas estándar de forma explícita, no por omisión — documentado acá para que nadie las "corrija" sin contexto (ver referencia de prácticas, `/home/kuautli/Projects/README.md`, secciones 2 y 4).

### CI/CD (GitHub Actions)

No hay workflows de GitHub Actions. Para un repo solo/bajo tráfico como este, `scripts/validate.sh` gateado en `pre-push`/`pre-merge-commit` hacia `main`/`develop` (ver "Git Hooks" arriba) cumple el mismo objetivo — nada roto llega a `main` — sin mantener YAML de CI para un único colaborador. Migrar a Actions en cuanto el repo sume colaboradores activos o pase a producción con usuarios reales.

### Makefile

No hay `Makefile`. Los scripts de `pnpm` (`package.json`) más `scripts/validate.sh` ya son la interfaz única de comandos del proyecto a este tamaño — un `Makefile` envolviendo esos mismos comandos sería una capa redundante. Reconsiderar si el proyecto crece lo suficiente como para necesitar orquestación que `pnpm`/Docker Compose no cubran directamente.

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
- **TypeScript estricto**: respetar la configuración de `tsconfig.json` (ES2022, source maps, path aliases).
- Si el proyecto crece más allá de un boilerplate (agrega dominio de negocio real), introducir separación de capas (presentación / lógica de negocio / infraestructura) recién en ese momento — no antes.

---

## Docker

- **`Dockerfile`**: build multi-stage para producción
- **`Dockerfile.dev`**: entorno de desarrollo (usado por DevContainers y `docker-compose.yml`)
- **`docker-compose.yml`**: levanta el entorno de desarrollo completo — el servicio `app` tiene `healthcheck` (confirma que `pnpm` está disponible), usar `--wait` para no ejecutar comandos contra un contenedor que todavía no está listo

```bash
docker compose up -d --wait
docker compose exec app bash
```

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
