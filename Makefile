# Path: Makefile
.PHONY: help setup sync sync-text sync-api dry data build re dev live serve view-pwa view-sl release zip deploy beta publish clean

# Python command (sử dụng môi trường hiện tại do direnv quản lý)
PYTHON := python3

# ==============================================================================
# 🎯 DEFAULT / HELP
# ==============================================================================
help:
	@echo "📚 RANDOM SUTTA DEVELOPER TOOLS"
	@echo "----------------------------------------------------------------"
	@echo "🛠️  SETUP & SYNC:"
	@echo "  make setup          - Install Git hooks"
	@echo "  make sync           - Sync ALL data (Bilara Text + API Meta)"
	@echo ""
	@echo "⚙️  DATA PROCESSING:"
	@echo "  make data           - Process JSON -> Optimized Assets"
	@echo "  make dry            - Process Data (Dry Run)"
	@echo ""
	@echo "🏗️  BUILD & PREVIEW:"
	@echo "  make build          - Run Full Build (Data + Release)"
	@echo "  make re             - Quick Re-build (Release Only)"
	@echo "  make dev            - Live Source Server (port 8000)"
	@echo "  make serve          - Multi-port Server (Source/PWA/Serverless)"
	@echo "  make view-pwa       - Preview 'PWA' Build (port 8001)"
	@echo "  make view-sl        - Preview 'Serverless' Build (file://)"
	@echo ""
	@echo "🚀 RELEASE & DEPLOY:"
	@echo "  make zip            - Build & Create Zip Artifact"
	@echo "  make deploy         - Build & Deploy 'PWA' to GH-Pages"
	@echo "  make beta           - Publish Pre-release (Commit -> Push -> GH Release)"
	@echo "  make publish        - Publish OFFICIAL (Commit -> Push -> GH Release -> Deploy)"
	@echo ""
	@echo "🧹 MAINTENANCE:"
	@echo "  make clean          - Remove all build artifacts & cache"
	@echo "----------------------------------------------------------------"

# ==============================================================================
# 🛠️ SETUP & SYNC
# ==============================================================================
setup:
	@echo "🔧 Installing Git Hooks..."
	$(PYTHON) src/setup_hooks.py

sync:
	@echo "📥 Syncing Bilara Text..."
	$(PYTHON) -m src.sutta_fetcher
	@echo "📥 Fetching API Metadata..."
	$(PYTHON) -m src.api_fetcher

# ==============================================================================
# ⚙️ BUILD & PROCESS
# ==============================================================================
dry:
	@echo "🧠 Processing Data (Dry Run)..."
	$(PYTHON) -m src.sutta_processor -d

data:
	@echo "🧠 Processing Data..."
	$(PYTHON) -m src.sutta_processor

build: data re

# Chỉ chạy Release System (không chạy lại Data Processor)
re:
	@echo "🔨 Running Release System..."
	$(PYTHON) -m src.release_system

# ==============================================================================
# 🌍 SERVERS & PREVIEW
# ==============================================================================
# Server cho Source Code (web/) - Port 8000
dev:
	@echo "🌍 Starting SOURCE Server..."
	@echo "   👉 http://localhost:8000/"
	$(PYTHON) -m http.server 8000 --directory web

live:
	$(PYTHON) src/live_server.py

serve:
	$(PYTHON) src/multi_server.py

# Preview bản PWA Build (Web/Standard)
view-pwa:
	@echo "🌍 Starting PWA Build Preview..."
	@echo "   👉 http://localhost:8001/"
	$(PYTHON) -m http.server 8001 --directory build/pwa

# Preview bản Serverless Build (Standalone)
view-sl:
	@echo "📂 Opening SERVERLESS Build (file://)..."
	open build/serverless/index.html

# ==============================================================================
# 🚀 RELEASE ACTIONS
# ==============================================================================

# Tạo Zip (Serverless Build)
zip:
	$(PYTHON) -m src.release_system --zip

# Deploy Web (PWA Build -> GH Pages)
deploy:
	$(PYTHON) -m src.release_system --web

# Publish Pre-release
beta:
	@echo "🚀 PUBLISHING BETA..."
	$(PYTHON) -m src.release_system --publish

# Publish Official
publish:
	@echo "🌟 PUBLISHING OFFICIAL..."
	$(PYTHON) -m src.release_system --official --web

# ==============================================================================
# 🧹 CLEANUP
# ==============================================================================
clean:
	@echo "🧹 Cleaning up..."
	rm -rf build/ dist/ release/ tmp/
	rm -rf web/assets/db/ web/assets/modules/data/constants.js
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	@echo "✅ Clean complete."

# Git helpers
noedit:
	@git add . && git commit --amend --no-edit
undo:
	@git reset --soft HEAD~1