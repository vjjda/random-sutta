# Path: src/sutta_processor/optimizer/config.py
from pathlib import Path
from ..shared.app_config import (
    DIST_DB_DIR, 
    DEV_MIRROR_DB_DIR, 
    DIST_JS_MODULES_DIR,
    DB_CHUNK_SIZE_BYTES,
    CONFIG_PRIMARY_BOOKS
)

# Output Directories
# [UPDATED] Cấu trúc mới: Tách Meta và Content
WEB_DB_DIR = DIST_DB_DIR
WEB_META_DIR = WEB_DB_DIR / "meta"
WEB_CONTENT_DIR = WEB_DB_DIR / "content"
# [NEW] Định nghĩa thư mục Index rõ ràng
WEB_INDEX_DIR = WEB_DB_DIR / "index"

# Mirror (cho Dry-run/Debug)
MIRROR_DB_DIR = DEV_MIRROR_DB_DIR
MIRROR_META_DIR = MIRROR_DB_DIR / "meta"
MIRROR_CONTENT_DIR = MIRROR_DB_DIR / "content"
MIRROR_INDEX_DIR = MIRROR_DB_DIR / "index"

JS_OUTPUT_DIR = DIST_JS_MODULES_DIR

# Settings
CHUNK_SIZE_LIMIT = DB_CHUNK_SIZE_BYTES
PRIMARY_BOOKS_SET = set(CONFIG_PRIMARY_BOOKS)
PRIMARY_BOOKS_LIST = CONFIG_PRIMARY_BOOKS