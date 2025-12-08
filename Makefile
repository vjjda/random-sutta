# Path: Makefile
.PHONY: help setup sync sync-text sync-api build-data dev dev-online dev-offline release release-zip release-beta publish clean

# Python command (sử dụng môi trường hiện tại do direnv quản lý)
PYTHON := python3

# ==============================================================================
# 🎯 DEFAULT / HELP
# ==============================================================================
help:
	@echo "📚 RANDOM SUTTA DEVELOPER TOOLS"
	@echo "----------------------------------------------------------------"
	@echo "🛠️  SETUP & SYNC:"
	@echo "  make setup          - Cài đặt Git hooks"
	@echo "  make sync           - Đồng bộ TOÀN BỘ dữ liệu (Bilara Text + API Meta)"
	@echo ""
	@echo "⚙️  BUILD & DEV:"
	@echo "  make build-dry     - Chạy Sutta Processor (Dry Run, không ghi file)"
	@echo "  make build-data     - Chạy Sutta Processor (JSON -> Assets)"
	@echo "  make build-full          - Chạy Full Build (Data + Release)"
	@echo "  make dev            - Server Web gốc (Source)  -> http://localhost:8000"
	@echo "  make dev-online     - Server Build Online      -> http://localhost:8001"
	@echo "  make dev-offline    - Server Build Offline     -> http://localhost:8002"
	@echo ""
	@echo "🚀 RELEASE SYSTEM:"
	@echo "  make release        - Build Local kiểm tra (Không zip, không commit)"
	@echo "  make release-zip    - Build & Tạo file .zip (-z)"
	@echo "  make release-web    - Build & Deploy lên GitHub Pages (-w)"
	@echo "  make release-beta   - PUBLISH PRE-RELEASE (-p) (Commit -> Push -> GH Release)"
	@echo "  make publish        - PUBLISH OFFICIAL (-p -o) (Đánh dấu là Latest Release)"
	@echo ""
	@echo "🧹 MAINTENANCE:"
	@echo "  make clean          - Dọn dẹp file rác, cache, build cũ"
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
# ⚙️ BUILD & DEV
# ==============================================================================
build-dry:
	@echo "🧠 Processing Data..."
	$(PYTHON) -m src.sutta_processor -d

build-data:
	@echo "🧠 Processing Data..."
	$(PYTHON) -m src.sutta_processor

build-full:
	@echo "🧠 Full Build (Data + Release)..."
	$(PYTHON) -m src.sutta_processor
	$(PYTHON) -m src.release_system

# Server cho Source Code (web/) - Port 8000
dev:
	@echo "🌍 Starting SOURCE Server..."
	@echo "   👉 http://localhost:8000/"
	$(PYTHON) -m http.server 8000 --directory web

# Server cho bản Build Online - Port 8001
# Yêu cầu: Phải chạy 'make release' trước để có thư mục build
dev-online:
	@echo "🌍 Starting BUILD ONLINE Server..."
	@echo "   👉 http://localhost:8001/"
	$(PYTHON) -m http.server 8001 --directory build/dev-online

# Server cho bản Build Offline - Mở trực tiếp file HTML
# Giả lập môi trường không mạng, chạy trên protocol file://
dev-offline:
	@echo "📂 Opening BUILD OFFLINE (file://)..."
	open build/dev-offline/index.html

# ==============================================================================
# 🚀 RELEASE SYSTEM (Wrappers for src.release_system)
# ==============================================================================

# 1. Local Build Check (Mặc định)
release:
	$(PYTHON) -m src.release_system

# 2. Tạo Zip Artifact (-z)
release-zip:
	$(PYTHON) -m src.release_system --zip

# 3. Deploy Web GH-Pages (-w)
release-web:
	$(PYTHON) -m src.release_system --web

# 4. [MỚI] Publish Pre-release (-p)
# Dùng cho các bản beta, test, chưa phải official
release-beta:
	@echo "🚀 PUBLISHING PRE-RELEASE (Beta)..."
	$(PYTHON) -m src.release_system --publish

# 5. Publish Official (-p -o)
# Dùng cho bản chính thức (Latest)
publish:
	@echo "🌟 PUBLISHING OFFICIAL RELEASE..."
	$(PYTHON) -m src.release_system --official --publish

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