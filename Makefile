# Path: Makefile
.PHONY: help setup sync sync-text sync-api sync-dpd dry data d de dv dz da dt df build re dev live serve view-pwa view-sl release zip deploy beta official publish clean noedit undo mini

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
	@echo "  make sync           - Sync ALL data (Bilara + API + DPD)"
	@echo "  make sync-text      - Sync ONLY Bilara Text (-s)"
	@echo "  make sync-api       - Sync ONLY API Metadata (-a)"
	@echo "  make sync-dpd       - Sync ONLY DPD Dictionary (-d)"
	@echo ""
	@echo "⚙️  DATA PROCESSING:"
	@echo "  make data           - Process JSON -> Optimized Assets"
	@echo "  make dry            - Process Data (Dry Run)"
	@echo ""
	@echo "📖 DICTIONARY BUILDER:"
	@echo "  make d              - Build Mini Dictionary ONLY (-m)"
	@echo "  make de           - Build Mini Dictionary & Zip (-e)"
	@echo "  make dvz          - Update Search Logic & Zip (-vz)"
	@echo "  make dv             - Update Search Logic ONLY (-v)"
	@echo "  make dz           - Package Existing DB to Web Assets (-z)"
	@echo "  make da           - Build ALL Dictionaries (-a)"
	@echo "  make dt          - Build Tiny Dictionary & Zip (-t)"
	@echo "  make df          - Build Full Dictionary & Zip (-f)"
	@echo "  make mini {word} - Search 'word' in Mini DB (Open CSV)"
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
	@echo "📥 Syncing ALL Data (Bilara + API + DPD)..."
	$(PYTHON) -m src.data_fetcher -s -a -d

sync-text:
	@echo "📥 Syncing Bilara Text only..."
	$(PYTHON) -m src.data_fetcher -s

sync-api:
	@echo "📥 Fetching API Metadata only..."
	$(PYTHON) -m src.data_fetcher -a

sync-dpd:
	@echo "📥 Fetching/Updating DPD Dictionary..."
	$(PYTHON) -m src.data_fetcher -d

# ==============================================================================
# ⚙️ BUILD & PROCESS
# ==============================================================================
dry:
	@echo "🧠 Processing Data (Dry Run)..."
	$(PYTHON) -m src.sutta_processor -d

data:
	@echo "🧠 Processing Data..."
	$(PYTHON) -m src.sutta_processor

# ==============================================================================
# 📖 DICTIONARY BUILDER
# ==============================================================================
d:
	@echo "📖 Building Dictionary Local (Mini)..."
	$(PYTHON) -m src.dict_builder -m

de:
	@echo "📖 Building Dictionary (Mini)..."
	$(PYTHON) -m src.dict_builder -e

dvz:
	@echo "🔮 Updating Dictionary Views & Zip..."
	$(PYTHON) -m src.dict_builder -vz

dv:
	@echo "🔮 Updating Dictionary Views (Logic Only)..."
	$(PYTHON) -m src.dict_builder -v

dz:
	@echo "📦 Packaging Dictionary..."
	$(PYTHON) -m src.dict_builder -z

da:
	@echo "📖 Building ALL Dictionaries..."
	$(PYTHON) -m src.dict_builder -a

dt:
	@echo "📖 Building Dictionary (Tiny)..."
	$(PYTHON) -m src.dict_builder -t

df:
	@echo "📖 Building Dictionary (Full)..."
	$(PYTHON) -m src.dict_builder -f

# Handle arguments for 'mini' command
ifeq (mini,$(firstword $(MAKECMDGOALS)))
  # Get arguments after 'mini'
  MINI_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  # Turn them into do-nothing targets so make doesn't complain
  $(eval $(MINI_ARGS):;@:)
endif

mini:
	@echo "🔍 Searching for '$(MINI_ARGS)' in Mini DB..."
	$(PYTHON) scripts/db_search.py $(MINI_ARGS) -d data/dpd/dpd_mini.db -c

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
official:
	@echo "🚀 PUBLISHING OFFICIAL..."
	$(PYTHON) -m src.release_system --official

# Publish + Deploy
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