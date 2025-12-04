# Path: src/release_system/release_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"
# [NEW] Thư mục tạm để xử lý build
BUILD_DIR = PROJECT_ROOT / "build" 
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

ENTRY_POINT = "assets/app.js"
CRITICAL_ASSETS = ["assets/books/sutta_loader.js"]