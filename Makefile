.PHONY: help up down logs shell clean rebuild-frontend rebuild-backend

# Default target
help:
	@echo "promptforge - Available commands:"
	@echo "  make up               - Start all services"
	@echo "  make down             - Stop all services"
	@echo "  make logs             - View logs from all services"
	@echo "  make rebuild-frontend - Rebuild frontend (preserves DB)"
	@echo "  make rebuild-backend  - Rebuild backend (preserves DB)"

# Start all services (builds automatically if needed)
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

# Safely rebuild frontend only (preserves database)
rebuild-frontend:
	@echo "🔄 Rebuilding frontend container from scratch (database will be preserved)..."
	docker compose stop frontend
	docker compose rm -f frontend
	docker compose build --no-cache frontend
	docker compose up -d frontend
	@echo "✅ Frontend rebuilt successfully!"

# Safely rebuild backend only (preserves database)
rebuild-backend:
	@echo "🔄 Rebuilding backend container from scratch (database will be preserved)..."
	docker compose stop backend
	docker compose rm -f backend
	docker compose build --no-cache backend
	docker compose up -d backend
	@echo "✅ Backend rebuilt successfully!"