# Path: src/release_system/release_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"

BUILD_ROOT = PROJECT_ROOT / "build"
BUILD_OFFLINE_DIR = BUILD_ROOT / "dev-offline"
BUILD_ONLINE_DIR = BUILD_ROOT / "dev-online"

RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

ENTRY_POINT = "assets/modules/core/app.js"

# [UPDATED] Danh sách các file bắt buộc phải có trước khi Build
# Hệ thống sẽ báo lỗi nếu thiếu các file này (đảm bảo processor đã chạy thành công)
CRITICAL_ASSETS = [
    "assets/db/uid_index.json",          # Master Index mới
    "assets/modules/data/constants.js",  # Config sách generated
    "sw.js"
]

# Biến chung cho tất cả (HTML, SW, v.v.)
VERSION_PLACEHOLDER = "dev-placeholder"