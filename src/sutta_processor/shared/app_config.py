# Path: src/sutta_processor/shared/app_config.py
from pathlib import Path

# --- BASE PATHS ---
PROJECT_ROOT = Path(__file__).parents[3]
_DATA_BASE = PROJECT_ROOT / "data"
_WEB_BASE = PROJECT_ROOT / "web"
_ASSETS_BASE = _WEB_BASE / "assets"

# --- 1. RAW INPUTS (Source of Truth) ---
# Dữ liệu Bilara Git (Text, HTML, Translation)
RAW_BILARA_DIR = _DATA_BASE / "bilara"
RAW_BILARA_TEXT_DIR = RAW_BILARA_DIR / "root"  # Gốc Pali

# Dữ liệu SuttaCentral API (Metadata, Names)
RAW_API_JSON_DIR = _DATA_BASE / "json"
RAW_SUPER_META_DIR = RAW_API_JSON_DIR / "super"

# Cấu trúc cây (Tree)
RAW_SUPER_TREE_FILE = RAW_BILARA_DIR / "tree" / "super-tree.json"

# --- 2. STAGING AREA (Cooked Monolithic JSON) ---
# Nơi chứa các file _book.json đã gộp content + meta (chưa cắt chunk)
STAGE_PROCESSED_DIR = _DATA_BASE / "processed"

# --- 3. DISTRIBUTION OUTPUTS (Production Web) ---
# Database mới (Index + Structure + Chunks)
DIST_DB_DIR = _ASSETS_BASE / "db"

# Code JS tự sinh (constants.js, file_index.js cũ)
DIST_JS_MODULES_DIR = _ASSETS_BASE / "modules"

# [DEPRECATED] Database cũ (Load cả cục) - Giữ lại để tham khảo nếu cần
LEGACY_DIST_BOOKS_DIR = _ASSETS_BASE / "books"

# --- 4. DEV TOOLS (Mirror & Debug) ---
# Bản sao Database dễ đọc cho con người
DEV_MIRROR_DB_DIR = _DATA_BASE / "db_mirror"

# --- 5. LOGIC CONFIGURATION ---
# Giới hạn kích thước mỗi file content chunk (500KB)
DB_CHUNK_SIZE_BYTES = 1500 * 1024 

# Ưu tiên dịch giả
CONFIG_AUTHOR_PRIORITY = ["sujato", "brahmali", "kelly"]

# Danh sách sách chính (Sẽ được sinh ra constants.js)
CONFIG_PRIMARY_BOOKS = [
    "dn", "mn", "sn", "an", 
    "kp", "dhp", "ud", "iti", "snp", "thag", "thig"
]

# Giới hạn số lượng xử lý (0 = Unlimited)
DEBUG_PROCESS_LIMIT = 0