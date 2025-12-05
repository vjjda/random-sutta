# Path: src/release_system/release_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"

BUILD_ROOT = PROJECT_ROOT / "build"
BUILD_OFFLINE_DIR = BUILD_ROOT / "dev-offline"
BUILD_ONLINE_DIR = BUILD_ROOT / "dev-online"

RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

ENTRY_POINT = "assets/app.js"
# [UPDATED] Thay sutta_loader.js bằng file_index.js
CRITICAL_ASSETS = ["assets/modules/file_index.js"]