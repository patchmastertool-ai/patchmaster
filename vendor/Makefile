###############################################################################
#  PatchMaster Vendor Portal — Makefile
###############################################################################

.PHONY: help setup dev prod stop logs status backup generate-license ssl-check clean

help: ## Show this help
	@echo ""
	@echo "  PatchMaster Vendor Portal — Commands"
	@echo "  ====================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Setup ────────────────────────────────────────────────────────

setup: ## Initial setup (create .env, data dir)
	@test -f .env || cp .env.example .env
	@mkdir -p data backups
	@echo "Setup complete. Edit .env with your credentials."

# ── Development ──────────────────────────────────────────────────

dev: setup ## Run in development mode (Flask debug)
	python app.py --debug --host 127.0.0.1

# ── Production (Docker) ─────────────────────────────────────────

check-env: ## Verify .env configuration
	@test -f .env || (echo "ERROR: .env missing. Run: make setup" && exit 1)
	@grep -q "^CM_SECRET_KEY=$$" .env && echo "ERROR: CM_SECRET_KEY not set" && exit 1 || true
	@grep -q "^CM_ADMIN_PASS=$$" .env && echo "ERROR: CM_ADMIN_PASS not set" && exit 1 || true
	@echo "Environment check passed."

prod: check-env ## Start production stack (Docker)
	docker compose up -d --build

stop: ## Stop production stack
	docker compose down

restart: ## Restart production stack
	docker compose restart

# ── Operations ───────────────────────────────────────────────────

status: ## Show service status
	docker compose ps

logs: ## Follow application logs
	docker compose logs -f app

health: ## Check service health
	@curl -sf http://localhost:$${VENDOR_PORT:-8080}/api/health && echo "" || echo "UNHEALTHY"

# ── Backup ───────────────────────────────────────────────────────

backup: ## Backup database
	@mkdir -p backups
	./scripts/backup-db.sh

# ── License Tools ────────────────────────────────────────────────

generate-license: ## Generate a testing license key (interactive, 30 days max)
	@echo ""; echo "  PatchMaster License Generator"; echo ""
	@read -p "  Customer name: " CUST; \
	 python generate-license.py --plan testing --customer "$$CUST"

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

# ── Packaging ────────────────────────────────────────────────────

package: ## Create vendor portal package (vendor/dist/)
	bash create-vendor-package.sh 2.0.0

# ── Cleanup ──────────────────────────────────────────────────────

clean: ## Remove build artifacts (keeps data)
	docker compose down -v --remove-orphans 2>/dev/null || true
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
