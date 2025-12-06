# Path: src/sutta_processor/shared/app_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[3]

DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
DATA_API_DIR = PROJECT_ROOT / "data" / "json"
ASSETS_ROOT = PROJECT_ROOT / "web" / "assets"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

# [NEW] DB & Optimization Config
WEB_DB_DIR = ASSETS_ROOT / "db"
MIRROR_DB_DIR = PROJECT_ROOT / "data" / "db_mirror"
CHUNK_SIZE_LIMIT = 500 * 1024 

OUTPUT_LOADER_DIR = ASSETS_ROOT / "modules"
OUTPUT_DB_DIR = ASSETS_ROOT / "books"

# [NEW] Book Definitions
# Danh sách sách chính mặc định (có thể thay đổi tại đây)
PRIMARY_BOOKS = [
    "dn", "mn", "sn", "an", 
    "kp", "dhp", "ud", "iti", "snp", "thag", "thig"
]

DATA_ROOT_DIR = DATA_ROOT / "root"
PROCESS_LIMIT = 0

SUPER_TREE_PATH = DATA_ROOT / "tree" / "super-tree.json"
SUPER_META_DIR = DATA_API_DIR / "super"

AUTHOR_PRIORITY = ["sujato", "brahmali", "kelly"]