# Path: src/sutta_processor/optimizer/config.py
from pathlib import Path
from ..shared.app_config import ASSETS_ROOT, PROJECT_ROOT, PRIMARY_BOOKS

# Output Directories
WEB_DB_DIR = ASSETS_ROOT / "db"
MIRROR_DB_DIR = PROJECT_ROOT / "data" / "db_mirror"
JS_OUTPUT_DIR = ASSETS_ROOT / "modules"

# Settings
CHUNK_SIZE_LIMIT = 500 * 1024 
PRIMARY_BOOKS_SET = set(PRIMARY_BOOKS)