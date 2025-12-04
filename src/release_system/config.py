# Path: src/release_system/config.py
from pathlib import Path

# Adjust path: src/release_system/config.py -> src/ -> project_root
PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

# [CHANGED] Không còn Hardcode Order nữa.
# Chỉ cần chỉ định file gốc, script sẽ tự mò ra cây phụ thuộc.
ENTRY_POINT = "assets/app.js"

# Các file không nằm trong import tree nhưng bắt buộc phải có
CRITICAL_ASSETS = ["assets/books/sutta_loader.js"]