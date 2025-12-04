# Path: src/release_system/release_config.py
from pathlib import Path

# Adjust path: src/release_system/release_config.py -> src/ -> project_root
PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

ENTRY_POINT = "assets/app.js"
CRITICAL_ASSETS = ["assets/books/sutta_loader.js"]