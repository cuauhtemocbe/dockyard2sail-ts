# Buenas prácticas de desarrollo

Estándar personal de prácticas de desarrollo, extraído de proyectos concretos (fuentes: [`dockyard2sail-py`](./dockyard2sail-py) para Docker/CI/arquitectura/backend, [`AvocadoDash`](./AvocadoDash) para el proceso de diseño de UI y las variantes KISS de esos mismos puntos en apps más chicas, y [`homicides-rate-visualizer`](./homicides-rate-visualizer) para la variante frontend/TypeScript de estas mismas prácticas — validación graduada por git hooks en vez de CI hosteado, estructura por feature en SPAs, y accesibilidad de movimiento). No es un template ejecutable — es una referencia para arrancar proyectos nuevos con las mismas decisiones ya tomadas, en vez de re-derivarlas cada vez.

Una copia versionada de este documento vive en [`dockyard2sail-py/docs/development-standards.md`](./dockyard2sail-py/docs/development-standards.md), con la intro adaptada para leerse sola dentro de ese repo (sin estos enlaces). Actualizar ahí manualmente al editar acá.

Las prácticas son deliberadamente agnósticas de lenguaje: aplican igual en un backend Python que en un frontend TypeScript. Donde el ejemplo de código es específico de un stack, es solo eso — un ejemplo — no una restricción de la regla.

Cada sección explica **qué** hacer y, cuando importa, **por qué** — para poder juzgar cuándo una regla aplica y cuándo no, en vez de copiarla a ciegas.

## Índice

1. [Docker-first](#1-docker-first)
2. [Makefile como interfaz única](#2-makefile-como-interfaz-única)
3. [Git hooks versionados](#3-git-hooks-versionados)
4. [CI/CD (GitHub Actions)](#4-cicd-github-actions)
5. [Calidad de código](#5-calidad-de-código)
6. [Arquitectura hexagonal pragmática](#6-arquitectura-hexagonal-pragmática)
7. [Configuración](#7-configuración)
8. [Flujo de trabajo (TDD)](#8-flujo-de-trabajo-tdd)
9. [Documentación agent-facing y changelog](#9-documentación-agent-facing-y-changelog)
10. [Identidad visual y diseño de UI](#10-identidad-visual-y-diseño-de-ui)
- [Checklist para un proyecto nuevo](#checklist-para-un-proyecto-nuevo)

---

## 1. Docker-first

Todo el código corre dentro de contenedores, incluyendo desarrollo local. Nada de "funciona en mi máquina" — si algo no corre en Docker, no está terminado.

- **`Dockerfile` (producción) vs `Dockerfile.dev` (desarrollo)**, separados. No usar multi-stage con target dev/prod compartido: son necesidades distintas (hot-reload vs imagen mínima) y mezclarlas complica ambas.
- **`docker-compose.yml`** monta el código fuente como volumen (`./src:/app/src`, `./tests:/app/tests`) para hot-reload sin rebuild. El lockfile de dependencias (`poetry.lock`, `package-lock.json`, etc.) también se monta si el gestor de paquetes lo necesita en runtime.
- **Healthcheck** definido tanto en el `Dockerfile` de producción (`HEALTHCHECK`) como en `docker-compose.yml` (`healthcheck:`), apuntando a un endpoint `/health` liviano. Permite `docker compose up -d --wait` para no correr comandos contra un contenedor que todavía no está listo.
- **Usuario no-root** en la imagen de producción (`addgroup`/`adduser` + `USER appuser`). No correr como root en runtime. **La imagen de dev puede correr como root a propósito** cuando el contenedor nunca es alcanzable fuera de localhost: el hardening no-root importa donde hay superficie de ataque real (producción), y correr como root en dev evita que un bind mount propiedad del usuario del host quede no-escribible para un uid de contenedor que no coincide con el del host (ver sección 5, reporte de cobertura). Misma asimetría deliberada que el pinning de base image — documentarla igual de explícito.
- **Build multi-stage en producción**: una etapa `builder` instala dependencias, la etapa final solo copia el artefacto (venv, `node_modules` compilado, binario) y el código fuente — no las herramientas de build.
- **Pinning de base image por digest en producción** (`FROM python:3.13-slim@sha256:...`), para builds reproducibles byte a byte. **La imagen de dev NO se pinea** — usa el tag flotante a propósito, porque en desarrollo local pesa más recibir parches de seguridad automáticos en cada rebuild que la reproducibilidad exacta. Esta asimetría es intencional, no un descuido: documentarla en el README del proyecto para que no la "corrija" alguien sin contexto.
- **Puerto inyectado por variable de entorno** (`PORT`, default `8000`), nunca hardcodeado — los proveedores cloud (Railway, etc.) lo inyectan dinámicamente.
- **Auditar la imagen base y remover lo que no se usa.** Las imágenes oficiales traen herramientas por default que el proyecto puede no necesitar (ej. una imagen `node` trae `npm`/`npx` aunque el proyecto use exclusivamente `pnpm`). Si no se usan, se eliminan en el Dockerfile de producción (`rm -rf` de los binarios/paquetes correspondientes) — menos superficie de ataque, menos CVEs bundled que Trivy reporta sobre código que ni siquiera se ejecuta. No aplicar esto a la imagen de dev si complica el DX sin beneficio real (ahí importa más la velocidad de iteración).
- **`docker-compose.yml` es opcional para apps de un solo servicio.** Si no hay nada que orquestar (DB, cola, cache, etc.), un `Makefile` puede envolver `docker build`/`docker run` directamente — sin Compose de por medio — bind-montando el repo completo (no solo `src/`+`tests/`) para hot-reload. Menos piezas para un caso que no las necesita (ej. AvocadoDash: una sola imagen Dash, sin dependencias externas). Introducir Compose en cuanto aparezca un segundo servicio (DB, worker, etc.), no antes.

---

## 2. Makefile como interfaz única

Un `Makefile` autodocumentado es la puerta de entrada a todos los comandos del proyecto — nadie debería necesitar memorizar flags de `docker compose exec`.

- `.DEFAULT_GOAL := help` — correr `make` sin argumentos muestra la ayuda, no ejecuta nada por accidente.
- Cada target lleva un comentario `## descripción` y un target `help` que los lista con `awk`:

```makefile
help: ## Mostrar esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
```

- Targets que necesitan el servicio corriendo declaran la dependencia (`test: up-d`), así `make test` nunca falla por "conexión rechazada".
- Se documentan explícitamente targets **locales** (`install-local`, `test-local`, sin Docker) como *fallback opcional*, separados del flujo principal — dejan claro que Docker es el camino soportado y lo local es best-effort.

---

## 3. Git hooks versionados

Los hooks viven en `.githooks/` (carpeta versionada en el repo), **no** en `.git/hooks/` (que no se versiona y cada clon empieza vacío).

- Activación explícita vía un target de Makefile, no automática al clonar (git no lo permite sin intervención):

```makefile
install-hooks: ## Habilitar el git hook de pre-commit (lint + format, corre en Docker)
	git config core.hooksPath .githooks
	chmod +x .githooks/pre-commit
```

- El hook delega en `make` (que a su vez corre en Docker), nunca invoca herramientas locales directamente — así funciona igual sin importar si el dev tiene Python/Node instalado en el host.

```sh
#!/bin/sh
set -e
make lint
make format-check
```

- **Alternativa de ecosistema JS/TS: Husky + `prepare` script.** En vez de `.githooks/` + target de Makefile, `husky` versiona los hooks en `.husky/` y se auto-instala vía el script `prepare` del `package.json` (`"prepare": "husky || true"` — corre automático en `pnpm install`, el `|| true` evita que falle en entornos sin git como el build de producción). Es el mismo principio (hooks versionados, activación explícita al instalar dependencias) resuelto con la herramienta idiomática del ecosistema en vez de forzar el patrón Python/Make.
- **Profundidad de validación graduada por rama, no todo-o-nada.** Correr la suite completa (typecheck + test + build + audit) en cada commit es lento y desalienta commits chicos. Alternativa validada: el hook de `pre-commit` no valida nada (commits rápidos en rama de feature), `pre-merge-commit`/`pre-push` corren solo typecheck en ramas de feature, y la validación completa (`scripts/validate.sh` o equivalente) se gatea a merges/pushes hacia ramas protegidas (`main`, `develop`). Esto traslada el costo de validación al momento en que realmente importa (antes de que el código llegue a una rama compartida) en vez de pagarlo en cada iteración local. Combinar con `lint-staged` cuando el check debe correr sobre archivos modificados únicamente, no el repo entero.
- **Script de validación único y reutilizable** (`scripts/validate.sh` o `make validate`): agrupa typecheck + tests + build + `pnpm audit`/`pip-audit` en un solo comando, invocado tanto por los git hooks como manualmente antes de un push. En proyectos sin CI hosteado (ver sección 4), este script *es* el pipeline de validación — debe poder correr standalone, no solo desde un hook.

---

## 4. CI/CD (GitHub Actions)

- **Jobs independientes y paralelos**, no un único job monolítico: `lint`, `test`, `typecheck`, `lock-check`, `license-check`, `trivy-fs`, `build`. Facilita ver de un vistazo qué falló y permite paralelismo real.
- **`lock-check`**: verificar que el lockfile esté sincronizado con el manifiesto de dependencias (`poetry check --lock`, `npm ci --dry-run`, etc.). Evita el caso de "funciona en CI pero el lockfile está desactualizado y nadie lo nota hasta production".
- **`license-check`**: un job trivial (`test -f LICENSE`) que evita que el archivo de licencia desaparezca silenciosamente en un refactor.
- **Escaneo de seguridad con Trivy**, en dos niveles:
  - `trivy-fs` (filesystem: dependencias + secretos + IaC) en cada push.
  - Escaneo de imagen (`scan-type: image`) solo en el build de producción (gateado a `main`), después de que `lint`+`test` pasen — no vale la pena escanear una imagen que ni siquiera compila.
  - `.trivyignore.yaml` para excepciones documentadas, no para silenciar todo.
- **`build` gateado**: `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` + `needs: [lint, test]` — no se construye la imagen de producción en cada PR, solo al mergear a main y solo si el resto pasó.
- **Dependabot** (`.github/dependabot.yml`) para los tres ecosistemas relevantes del proyecto (`pip`/`npm`, `github-actions`, `docker`), intervalo semanal — así el pinning por digest de la imagen base (punto 1) no se vuelve deuda técnica silenciosa.
- **Actions de terceros pineadas por commit SHA, no por tag flotante** (`actions/checkout@<sha>` en vez de `@v4`). Un tag es mutable — el compromiso de `tj-actions/changed-files` en 2025 fue exactamente ese vector: el tag se reapuntó a código malicioso sin que los consumidores lo notaran. Dependabot sabe actualizar SHAs pineados igual que tags, así que esto no cuesta el auto-update.
- **`permissions:` explícito y mínimo por workflow/job**, no el default implícito del `GITHUB_TOKEN` (que en muchos repos es de escritura amplia). Declarar `permissions: read-all` a nivel de workflow y escalar solo el job puntual que lo necesita (ej. publicar un release) limita el blast radius si un step se compromete.
- **Branch protection en `main`**: PRs no mergeables si fallan los checks requeridos (lint, test, typecheck, lock-check, trivy-fs, license-check). El owner del repo puede quedar exceptuado (`enforce_admins: false`) para poder seguir pusheando directo cuando hace sentido — documentar esta excepción explícitamente para que no parezca un descuido de configuración.
- **CI hosteado es el default, no un requisito absoluto.** Para un repo solo/de bajo tráfico donde no hay equipo revisando PRs en paralelo, sustituir GitHub Actions por el script de validación local (sección 3) gateado en `pre-push`/`pre-merge-commit` hacia ramas protegidas es una decisión válida — mismo efecto (nada roto llega a `main`), sin mantener workflows YAML para un solo colaborador. Es una asimetría deliberada según el tamaño del proyecto: documentarla (ej. en el `CLAUDE.md` o el propio README) para que no se lea como "les faltó configurar CI". Migrar a Actions en cuanto haya más de un colaborador activo o el repo pase a producción con usuarios reales.

---

## 5. Calidad de código

- **Un solo linter+formatter** (Ruff para Python; ESLint+Prettier o Biome para JS/TS) con configuración explícita en el manifiesto del proyecto (`pyproject.toml`), no defaults implícitos.
- **Type checking estricto** (`mypy --strict` en Python, `tsc --strict` en TS) sobre el código de producción, con una excepción relajada explícita para tests (menos rigor de tipado ahí es aceptable, no vale la pena el costo).
- **Cobertura mínima enforced, no solo reportada**: `--cov-fail-under=90` en la config de pytest, o el `coverage` provider de Vitest/Jest (o equivalente), para que el número sea un gate real y no un dato decorativo en un dashboard.
- **Targets de cobertura diferenciados por riesgo, no un solo número global**, cuando el perfil de riesgo del código varía dentro del mismo proyecto. Lógica de negocio pura (motores de cálculo, validadores, dominio) exige un target más alto (>90-95%) que componentes de presentación/UI (>80% suele alcanzar) — documentar los targets por capa/módulo explícitamente (en el README o el spec) en vez de forzar un único porcentaje global que termina siendo o muy laxo para lo crítico o muy costoso para lo trivial.
- **SonarQube como herramienta personal de desarrollo local**, no como gate de CI — decisión explícita para no acoplar el pipeline a un servidor externo que el resto del equipo/CI no tiene garantizado. Si se vuelve gate de CI en algún proyecto, debe ser una decisión consciente, no la config por defecto.
- **Generar el reporte de cobertura (`coverage.xml`/`lcov.info`) en una ruta que ya esté bind-montada, no en la raíz del contenedor.** Cuando `docker-compose.yml` monta solo `src/`+`tests/` (patrón de la sección 1) en vez del repo completo, un reporte escrito fuera de esos paths (ej. `/app/coverage.xml`) nunca aparece en el host — y el scanner de SonarQube corre en un contenedor aparte que sí monta el repo completo (`-v $(pwd):/usr/src`), por lo que no lo encuentra y reporta 0% de cobertura sin error explícito. La solución más simple es apuntar `--cov-report=xml:` a una ruta ya montada (ej. `tests/coverage.xml`): el archivo aparece en el host automáticamente, sin pasos extra.
- **Esto requiere que el contenedor pueda escribir en ese bind mount.** Un bind mount conserva los permisos del *host*, no los de la imagen — si el contenedor corre como usuario no-root (sección 1) y el directorio del host no es escribible para ese uid (caso típico: el directorio es `775`, dueño el usuario del host, y el uid del contenedor cae en "other"), escribir ahí falla con `PermissionError` aunque los tests corran bien. Si la imagen de dev corre como root a propósito (asimetría documentada en sección 1), este problema no existe. Si en cambio se mantiene no-root también en dev, las opciones son: construir con el UID/GID del host (`ARG UID`/`GID` + build args), o escribir en una ruta *de la imagen* (ej. `/app`, ya chowneada al usuario del contenedor) y copiar el resultado al host con `docker compose cp` — ahí sí se justifica, no es un workaround a evitar. Verificar el caso propio (root vs. non-root en dev) en vez de asumir cuál de los dos patrones aplica; "los tests corren con cobertura" no confirma que el archivo llegó al host.

```makefile
coverage-xml: up-d ## Generar coverage.xml dentro de Docker, visible en el host sin copiar (ruta ya montada)
	docker compose exec api pytest --cov=app --cov-report=xml:tests/coverage.xml
```

- **Verificar `SONARQUBE_PROJECT_KEY` en `.mcp.json` contra el `sonar.projectKey` real del proyecto**, no copiarlo de otro proyecto al bootstrapear uno nuevo desde este mismo repo de referencia. Las tools del MCP de SonarQube que no aceptan un parámetro de proyecto explícito (ej. `get_component_measures`, `search_files_by_coverage`) usan ese valor como default *sin avisar* si apunta a un proyecto equivocado — un `.mcp.json` mal copiado devuelve en silencio las métricas de otro repo. Sanity-check antes de confiar en los números: comparar el campo `component.key`/`projectKey` de la respuesta contra el proyecto esperado, y preferir siempre las tools que sí aceptan `projectKey` explícito (`get_project_quality_gate_status`, `search_sonar_issues_in_projects`, `search_security_hotspots`) cuando estén disponibles.
- **Manejo de errores por unidad, no un catch-all global**: en apps con múltiples handlers/callbacks independientes (rutas HTTP, callbacks de UI), cada uno encapsula su propio try/except con logging estructurado (`logger.error(msg, exc_info=True)` sobre un `logger = logging.getLogger(__name__)` de módulo — nunca `print`) y degrada con gracia (respuesta de error, figura vacía, estado por default) en vez de dejar que la excepción se propague a la página de error genérica del framework. Así un fallo en un solo widget/endpoint no tira abajo el resto de la página.

---

## 6. Arquitectura hexagonal pragmática

- Separación en capas: **presentación** (`api/`), **dominio** (`domain/`), **lógica de negocio** (`services/`), **infraestructura** (`infrastructure/`).
- **Tipado estructural sobre herencia**: contratos con `typing.Protocol` (Python) o `interface` (TS) en el dominio; las implementaciones cumplen la forma sin heredar explícitamente. Prohibidas las jerarquías de clases abstractas — duck typing nativo del lenguaje.
- **KISS**: funciones puras por sobre clases cuando alcanza. No diseñar para requisitos hipotéticos futuros.
- **Excepción KISS explícita**: si la app es y va a seguir siendo de un solo módulo (ej. una app Dash de una sola página, un script), no forzar las capas de arriba — mantenerla plana (un archivo, funciones que devuelven datos planos en vez de objetos de dominio) y documentar la excepción en el propio `CLAUDE.md` ("este proyecto se queda flat a propósito, no introducir capas a menos que crezca más allá de un solo módulo"). Así queda claro que es una decisión, no deuda técnica sin resolver.
- **Variante frontend/SPA: estructura por feature en vez de `api/domain/infrastructure` literal.** En una SPA (React, Vue, etc.) las capas no necesitan carpetas con esos nombres exactos — el mismo principio (lógica de negocio separada de presentación y de estado) se logra con `components/` (presentación, sin lógica de negocio), un módulo de dominio con nombre propio al caso de uso (ej. `engine/` para un motor de cálculo — funciones puras, 100% unit-testeables sin renderizar nada), `store/` (adaptador de estado global, ej. Zustand/Redux — no es dominio, es infraestructura de UI), y `hooks/` (lógica reutilizable con estado, el punto de conexión entre dominio y presentación). Lo que importa no es el nombre de la carpeta sino que el cálculo/regla de negocio se pueda testear sin montar un componente.
- **Tests colocados junto al archivo que cubren** (`Component.tsx` + `Component.test.tsx` en la misma carpeta) es una alternativa igual de válida a un árbol `tests/` separado — más fácil de mantener sincronizados (mover el componente mueve el test) a costa de mezclar código de producción y de test en el mismo directorio. Elegir una convención por proyecto y aplicarla consistentemente; no mezclar ambas dentro del mismo repo.

---

## 7. Configuración

- **Singleton de settings tipado y validado al arranque** (`pydantic-settings` en Python; equivalente validado con Zod en TS), que lee tanto `.env` local como variables inyectadas por el orquestador (Kubernetes, Railway, etc.). `extra="ignore"` para no romper si el entorno inyecta claves que el proyecto no declara.

```python
# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str
    port: int = 8000

settings = Settings()  # singleton implícito, cacheado en el primer import
```

- **`.env.example` versionado, `.env` gitignorado.** Cualquier archivo con credenciales reales (tokens de MCP servers, API keys) va explícitamente al `.gitignore` — verificar esto al arrancar un proyecto nuevo, no asumirlo.
- **Cualquier config local-only va al `.gitignore`, no solo `.env`.** Archivos que solo tienen sentido en la máquina de un dev específico o dependen de un servicio externo no garantizado para todo el equipo (config de SonarQube local, `.mcp.json` con tokens de servidores MCP, caches de indexado como `.codegraph/`) se gitignorean por el mismo motivo que `.env` — no porque el archivo sea "secreto" per se, sino porque versionarlo acopla el repo a una herramienta/entorno que no todos tienen.
- **`.env` es el punto de partida, no el techo.** Sirve para un dev solo o un proyecto chico, pero no tiene rotación, audit log de quién leyó qué, ni más cifrado en reposo que los permisos del filesystem del host. Cuando el proyecto pasa a manejar datos sensibles o gana colaboradores, migrar a un secret manager real (variables cifradas de Railway, Vault, SOPS, Doppler) es la progresión esperada — no un lujo de "empresa grande".
- **Secret scanning en pre-commit, no solo en CI.** Trivy fs (sección 4) escanea secretos en cada push, pero para entonces el secreto ya salió de la máquina local y quedó en el historial de git del remoto. Un hook de pre-commit liviano (`gitleaks`, `detect-secrets`) corriendo sobre el diff staged lo atrapa antes de que eso pase.

---

## 8. Flujo de trabajo (TDD)

1. Escribir el test primero, a partir de los criterios de aceptación (Gherkin si vienen de una historia de usuario).
2. Correrlo y verificar que falla.
3. Implementar lo mínimo para que pase.
4. Correr toda la suite (`make test`).
5. Lint + format (`make lint`, formatter con `--check` primero, luego aplicar).
6. Type check (`make typecheck`).
7. Commit siguiendo convenciones del proyecto (Conventional Commits u otra, pero consistente).
8. Esperar confirmación explícita antes de hacer push — el push a un remoto es una acción visible para otros, no se automatiza por default.

Para bugfixes: primero un test que reproduzca el bug y falle, después el fix, nunca al revés.

---

## 9. Documentación agent-facing y changelog

Además del `README.md` (para humanos), un `CLAUDE.md` (o equivalente) en la raíz del repo documenta, para agentes de IA:

- Stack y comandos clave (delegando el detalle a `pyproject.toml`/`package.json` y `Makefile`, no duplicándolo).
- Reglas de arquitectura no negociables (con ejemplos de código).
- El flujo de trabajo recomendado (features nuevas vs bugfixes).
- Checklist de "antes de mergear".
- Protocolo de memoria persistente entre sesiones, si se usa (Engram u otro).

**`CHANGELOG.md` versionado**, siguiendo [Keep a Changelog](https://keepachangelog.com/) (secciones `Added`/`Changed`/`Fixed`/`Removed` por versión) y [Semantic Versioning](https://semver.org/) para el número de versión, sincronizado con el campo `version` del manifiesto (`pyproject.toml`/`package.json`). Es historial para humanos (qué cambió y por qué, en lenguaje de producto) — no reemplaza al git log, lo complementa a un nivel de abstracción más alto.

---

## 10. Identidad visual y diseño de UI

Cuando el proyecto tiene superficie visual (dashboard, web app), tratar el diseño como una decisión explícita y no como el default del framework — usar el skill `/frontend-design` (o el proceso equivalente) antes de tocar CSS.

- **La paleta y la tipografía salen del dominio del producto, no de una plantilla genérica.** Derivar los colores de algo literal del proyecto en vez de un patrón reconocible como "dashboard de IA genérico" (ej. AvocadoDash: la paleta se leyó directamente del corte transversal de un aguacate real — piel, pulpa, hueso — descartando explícitamente tanto "cream + serif + acento terracota" como "casi-negro + acento neón", ambos identificados como defaults genéricos). Documentar los tokens resultantes en una tabla (`token → hex → uso`) en el spec o junto al CSS.
- **Un solo elemento de marca memorable, usado con disciplina** (ej. un ícono/motivo propio en vez de un emoji de placeholder), en lugar de decorar cada sección — todo lo demás se mantiene sobrio alrededor de esa única firma.
- **Tipografía por función, no por gusto**: una display (títulos, con moderación), una de cuerpo (texto/labels/UI) y, si el producto muestra datos numéricos, una monoespaciada solo para cifras — alinea dígitos y facilita comparar valores de un vistazo.
- **Accesibilidad: señal redundante además del color.** Cualquier indicador binario (positivo/negativo, éxito/error) debe llevar una segunda señal no cromática (glifo ▲/▼, ícono, texto) — el color solo no alcanza para daltonismo.
- **Accesibilidad: respetar `prefers-reduced-motion`.** Cualquier animación no trivial (transiciones de números, entrada/salida de elementos, loaders animados) debe leer la preferencia del sistema operativo (`window.matchMedia('(prefers-reduced-motion: reduce)')` o el equivalente CSS `@media`) y degradar a una versión estática o instantánea cuando el usuario la tiene activada — no es opcional, es la misma clase de requisito que el contraste de color.
- **Layout fluido, no píxeles fijos.** Anchos/paddings en unidades relativas o `max-width` porcentual, para que no rompa en viewports angostos (evitar `width: 912px` hardcodeado en CSS).
- **Autocrítica documentada en el spec.** Registrar qué alternativas de diseño se consideraron y por qué se descartaron (sección "Self-critique" en el spec de la feature). Deja explícito que el resultado es una decisión deliberada y no la primera idea que funcionó, y evita que alguien sin contexto "corrija" la paleta de vuelta a un default genérico.
- **Un restyle puro se declara display-only.** Si el objetivo es solo visual, el spec debe declarar explícitamente como requisito no funcional que no cambia lógica de negocio/filtrado, y la suite de tests existente debe seguir pasando sin modificarse — separa el riesgo de un cambio visual del de un cambio funcional.

---

## Checklist para un proyecto nuevo

- [ ] `Dockerfile` + `Dockerfile.dev` separados, healthcheck en ambos.
- [ ] `docker-compose.yml` con bind mounts para hot-reload.
- [ ] Imagen de producción pineada por digest y con usuario no-root; imagen de dev con tag flotante y, si nunca es alcanzable fuera de localhost, corriendo como root para que los bind mounts queden escribibles (documentar ambas asimetrías). Herramientas no usadas de la imagen base (ej. `npm` si el proyecto usa `pnpm`) removidas en producción.
- [ ] `Makefile` autodocumentado con `make help` como default.
- [ ] Git hooks versionados (`.githooks/` + target de Makefile, o `Husky` + script `prepare`) con profundidad de validación graduada por rama (liviano en commit/rama de feature, completo en push/merge a ramas protegidas). Script de validación único (`make validate` / `scripts/validate.sh`) reutilizado por los hooks y ejecutable a mano.
- [ ] CI hosteado (GitHub Actions) con jobs separados — lint, test, typecheck, lock-check, license-check, security scan, build gateado a main — **o**, en repos solo/bajo tráfico, el script de validación local gateado a ramas protegidas como sustituto explícito y documentado. Actions de terceros pineadas por commit SHA (no tag flotante) y `permissions:` mínimo explícito por workflow/job.
- [ ] Dependabot configurado para todos los ecosistemas relevantes (si hay CI hosteado).
- [ ] Branch protection en `main`.
- [ ] Linter+formatter con config explícita, type checking estricto, cobertura mínima enforced (no solo reportada) — con targets diferenciados por riesgo si el proyecto tiene lógica de negocio crítica junto a UI/presentación.
- [ ] Si se usa SonarQube local: `SONARQUBE_PROJECT_KEY` en `.mcp.json` verificado contra `sonar.projectKey` (no copiado de otro proyecto); si los tests corren en Docker con bind mount parcial, el reporte de cobertura se genera en una ruta ya montada (`--cov-report=xml:tests/coverage.xml`) — requiere que el contenedor pueda escribir ahí (root en dev, o UID/GID del host si se mantiene no-root); `docker compose cp` solo si ninguna de esas dos aplica.
- [ ] Capas separadas (`api`/`domain`/`services`/`infrastructure`, o estructura por feature en SPA) con contratos por tipado estructural (`Protocol`/`interface`), no herencia — o la excepción KISS flat documentada explícitamente si el proyecto es de un solo módulo.
- [ ] `.env.example` versionado; `.env` y cualquier config local-only (credenciales, tokens MCP, config de herramientas que no todos tienen) en `.gitignore` — verificado, no asumido. Punto de graduación a un secret manager real (Vault, Doppler, variables cifradas) documentado si el proyecto crece; secret scanning en pre-commit además del escaneo en CI.
- [ ] `CLAUDE.md` (o equivalente) con reglas de arquitectura y flujo de trabajo para agentes.
- [ ] `CHANGELOG.md` con formato Keep a Changelog + Semantic Versioning, sincronizado con la versión del manifiesto.
- [ ] Si el proyecto tiene UI: paleta y tipografía derivadas del dominio del producto (no de un template genérico), documentadas con autocrítica de alternativas descartadas.
- [ ] Cualquier indicador binario en la UI (positivo/negativo, éxito/error) lleva una señal redundante además del color; cualquier animación respeta `prefers-reduced-motion`.
