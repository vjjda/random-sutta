# Path: src/release_system/config.py
from pathlib import Path

# Adjust path: src/release_system/config.py -> src/ -> project_root
PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

# Bundle Order (Dependency Graph)
BUNDLE_ORDER = [
    "assets/modules/constants.js",
    "assets/modules/navigator.js",
    "assets/modules/db_manager.js",
    "assets/modules/utils.js",
    "assets/modules/toh_component.js",
    "assets/modules/router.js",
    "assets/modules/loader.js",
    "assets/modules/filters.js",
    "assets/modules/search_component.js",
    "assets/modules/renderer.js",
    "assets/app.js"
]

CRITICAL_ASSETS = BUNDLE_ORDER + ["assets/books/sutta_loader.js"]