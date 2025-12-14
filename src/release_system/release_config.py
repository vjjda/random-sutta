# Path: src/release_system/release_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"

BUILD_ROOT = PROJECT_ROOT / "build"

# [REFACTORED] Đổi tên thư mục build rõ nghĩa hơn
# 1. Server Build: Bản Web chuẩn, dùng ESM, Service Worker, cần HTTP Server (GitHub Pages, Nginx...)
BUILD_SERVER_DIR = BUILD_ROOT / "server"

# 2. Serverless Build: Bản Bundle, dùng IIFE, chạy trực tiếp file:// (USB, Local Storage)
BUILD_SERVERLESS_DIR = BUILD_ROOT / "serverless"

RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

ENTRY_POINT = "assets/modules/core/app.js"

CRITICAL_ASSETS = [
    "assets/db/uid_index.json", 
    "assets/modules/data/constants.js",
    "sw.js"
]

VERSION_PLACEHOLDER = "dev-placeholder"