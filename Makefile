.DEFAULT_GOAL := help

.PHONY: help lock-check check-docs check-docker-cmd-shell-form docker-port-smoke-test validate

help: ## Mostrar esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

lock-check: ## Verificar que pnpm-lock.yaml está sincronizado con package.json
	@echo "🔒 Checking pnpm-lock.yaml sync..."
	pnpm install --frozen-lockfile
	@echo "✅ Lockfile in sync"

check-docs: ## Verificar CHANGELOG.md en sync con package.json y excepciones documentadas en CLAUDE.md
	./scripts/check-docs.sh

check-docker-cmd-shell-form: ## Chequeo estático (grep, sin build) de que CMD/HEALTHCHECK de producción en Dockerfile sigan en shell form con $PORT
	./scripts/check-docker-cmd-shell-form.sh

docker-port-smoke-test: ## Build de la imagen de producción + smoke test de PORT dinámico (build real de Docker, dos escenarios)
	./scripts/docker-port-smoke-test.sh

validate: lock-check ## Validación completa: lockfile + typecheck + test:coverage + build + docker port checks + audit + docs (gateado en pre-push/pre-merge-commit a main/develop)
	@echo "📝 Running TypeScript type checking..."
	pnpm run typecheck
	@echo "✅ TypeScript type checking passed"
	@echo "🐳 Checking Dockerfile CMD/HEALTHCHECK shell form..."
	@$(MAKE) check-docker-cmd-shell-form
	@echo "✅ Dockerfile shell-form check passed"
	@echo "🧪 Running tests with coverage..."
	pnpm test:coverage
	@echo "✅ Tests and coverage passed"
	@echo "🏗️  Building project..."
	pnpm run build
	@test -d dist && [ -n "$$(ls -A dist)" ] || (echo "❌ Build output directory is empty or missing" && exit 1)
	@echo "✅ Build output verified"
	@echo "🐳 Running Docker port smoke test..."
	@$(MAKE) docker-port-smoke-test
	@echo "✅ Docker port smoke test passed"
	@echo "🔒 Running security audit..."
	@pnpm audit --audit-level moderate || echo "⚠️  Security audit found issues (continuing...)"
	@$(MAKE) check-docs
	@echo "✅ Documentation checks passed"
	@echo "🎉 All validations completed successfully!"
