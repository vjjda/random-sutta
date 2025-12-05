# Path: src/release_system/release_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"

# [UPDATED] Cô lập bản build vào thư mục 'dev-offline' để tránh lẫn lộn
BUILD_ROOT = PROJECT_ROOT / "build"
BUILD_DIR = BUILD_ROOT / "dev-offline"

RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

ENTRY_POINT = "assets/app.js"
CRITICAL_ASSETS = ["assets/books/sutta_loader.js"]