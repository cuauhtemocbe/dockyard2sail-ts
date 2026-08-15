.DEFAULT_GOAL := help

.PHONY: help up up-d lock-check lint typecheck test build audit check-docs check-docker-cmd-shell-form docker-port-smoke-test validate

help: ## Mostrar esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Levantar el entorno de desarrollo en foreground (logs visibles, Ctrl+C detiene)
	docker compose up --build

up-d: ## Levantar el entorno de desarrollo en background, esperando el healthcheck (dependencia de los demás targets)
	docker compose up -d --build --wait

lock-check: up-d ## Verificar que pnpm-lock.yaml está sincronizado con package.json (corre en Docker)
	@echo "🔒 Checking pnpm-lock.yaml sync..."
	docker compose exec app pnpm install --frozen-lockfile
	@echo "✅ Lockfile in sync"

lint: lock-check ## Lint con Biome (corre en Docker)
	docker compose exec app pnpm lint

typecheck: lock-check ## Type check con tsc (corre en Docker)
	docker compose exec app pnpm run typecheck

test: lock-check ## Tests con cobertura (corre en Docker)
	docker compose exec app pnpm test:coverage

build: lock-check ## Build de producción + verificación de dist/ (corre en Docker)
	docker compose exec app pnpm run build
	@test -d dist && [ -n "$$(ls -A dist)" ] || (echo "❌ Build output directory is empty or missing" && exit 1)

audit: lock-check ## Auditoría de dependencias pnpm (corre en Docker)
	docker compose exec app pnpm audit --audit-level moderate || echo "⚠️  Security audit found issues (continuing...)"

check-docs: lock-check ## Verificar CHANGELOG.md en sync con package.json y excepciones documentadas en CLAUDE.md (corre en Docker)
	docker compose exec app ./scripts/check-docs.sh

check-docker-cmd-shell-form: ## Chequeo estático (grep, sin build) de que CMD/HEALTHCHECK de producción en Dockerfile sigan en shell form con $PORT — corre en el host, no necesita Node/pnpm
	./scripts/check-docker-cmd-shell-form.sh

docker-port-smoke-test: ## Build de la imagen de producción + smoke test de PORT dinámico (build real de Docker, dos escenarios) — corre en el host, necesita el daemon de Docker directo, no Node/pnpm
	./scripts/docker-port-smoke-test.sh

validate: lock-check ## Validación completa: lockfile + typecheck + test:coverage + build + docker port checks + audit + docs (gateado en pre-push/pre-merge-commit a main/develop)
	@echo "📝 Running TypeScript type checking..."
	@$(MAKE) typecheck
	@echo "✅ TypeScript type checking passed"
	@echo "🐳 Checking Dockerfile CMD/HEALTHCHECK shell form..."
	@$(MAKE) check-docker-cmd-shell-form
	@echo "✅ Dockerfile shell-form check passed"
	@echo "🧪 Running tests with coverage..."
	@$(MAKE) test
	@echo "✅ Tests and coverage passed"
	@echo "🏗️  Building project..."
	@$(MAKE) build
	@echo "✅ Build output verified"
	@echo "🐳 Running Docker port smoke test..."
	@$(MAKE) docker-port-smoke-test
	@echo "✅ Docker port smoke test passed"
	@echo "🔒 Running security audit..."
	@$(MAKE) audit
	@$(MAKE) check-docs
	@echo "✅ Documentation checks passed"
	@echo "🎉 All validations completed successfully!"
