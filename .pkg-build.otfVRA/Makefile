###############################################################################
#  PatchMaster — Product Makefile
#  Commands for building, deploying, and managing the PatchMaster product.
###############################################################################

.PHONY: help dev prod prod-monitoring stop logs status backup restore clean build-release ssl-check

VERSION := 2.0.0
COMPOSE_PROD := docker compose -f docker-compose.prod.yml

help: ## Show this help
	@echo ""
	@echo "  PatchMaster v$(VERSION) — Product Commands"
	@echo "  =========================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Development ──────────────────────────────────────────────────

dev: ## Start development stack (hot-reload)
	docker compose up -d --build

dev-logs: ## Follow development logs
	docker compose logs -f

# ── Production ───────────────────────────────────────────────────

check-env: ## Verify .env has all required values
	@test -f .env || (echo "ERROR: .env file missing. Copy from .env.production" && exit 1)
	@grep -q "^POSTGRES_PASSWORD=$$" .env && echo "ERROR: POSTGRES_PASSWORD not set" && exit 1 || true
	@grep -q "^JWT_SECRET=$$" .env && echo "ERROR: JWT_SECRET not set" && exit 1 || true
	@echo "Environment check passed."

prod: check-env ## Start production stack
	$(COMPOSE_PROD) up -d --build

prod-monitoring: check-env ## Start production stack with monitoring
	$(COMPOSE_PROD) --profile monitoring up -d --build

stop: ## Stop all services
	$(COMPOSE_PROD) down

stop-dev: ## Stop development stack
	docker compose down

# ── Operations ───────────────────────────────────────────────────

status: ## Show service status
	$(COMPOSE_PROD) ps

logs: ## Follow production logs
	$(COMPOSE_PROD) logs -f

logs-backend: ## Follow backend logs only
	$(COMPOSE_PROD) logs -f backend

health: ## Check service health
	@echo "── Backend ──"
	@curl -sf http://localhost:$${BACKEND_PORT:-8000}/api/health && echo " OK" || echo " FAIL"
	@echo "── Frontend ──"
	@curl -sf -o /dev/null -w "%{http_code}" http://localhost:$${FRONTEND_PORT:-3000}/ && echo " OK" || echo " FAIL"
	@echo "── Database ──"
	@$(COMPOSE_PROD) exec -T db pg_isready -U patchmaster && echo " OK" || echo " FAIL"

# ── Backup & Restore ────────────────────────────────────────────

backup: ## Backup database to backups/
	@mkdir -p backups
	$(COMPOSE_PROD) exec -T db pg_dump -U $${POSTGRES_USER:-patchmaster} $${POSTGRES_DB:-patchmaster} \
		| gzip > backups/patchmaster-$$(date +%Y%m%d-%H%M%S).sql.gz
	@echo "Backup saved to backups/"
	@ls -lh backups/ | tail -3

restore: ## Restore database from BACKUP_FILE env var
	@test -n "$(BACKUP_FILE)" || (echo "Usage: make restore BACKUP_FILE=backups/xxx.sql.gz" && exit 1)
	@echo "WARNING: This will overwrite the current database!"
	@read -p "Continue? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	zcat $(BACKUP_FILE) | $(COMPOSE_PROD) exec -T db psql -U $${POSTGRES_USER:-patchmaster} $${POSTGRES_DB:-patchmaster}
	@echo "Database restored from $(BACKUP_FILE)"

# ── Build & Release ──────────────────────────────────────────────

build-release: ## Build distributable tarball
	bash packaging/build-package.sh --output dist/

build-agent: ## Build .deb agent package
	cd agent && ./build-deb.sh

clean: ## Remove build artifacts
	rm -rf dist/*.tar.gz dist/*.sha256
	docker compose down -v --remove-orphans 2>/dev/null || true

# ── SSL ──────────────────────────────────────────────────────────

ssl-check: ## Check if SSL certs are in place
	@CERT_DIR=$${SSL_CERT_DIR:-./certs}; \
	if [ -f "$$CERT_DIR/fullchain.pem" ] && [ -f "$$CERT_DIR/privkey.pem" ]; then \
		echo "SSL certificates found in $$CERT_DIR/"; \
		openssl x509 -in "$$CERT_DIR/fullchain.pem" -noout -subject -dates 2>/dev/null || echo "  (could not read cert details)"; \
	else \
		echo "No SSL certificates found in $$CERT_DIR/"; \
		echo "Place fullchain.pem + privkey.pem there to enable HTTPS."; \
		echo "See certs/README.md for instructions."; \
	fi
