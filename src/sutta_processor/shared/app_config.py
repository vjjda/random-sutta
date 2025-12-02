# Path: src/sutta_processor/config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
DATA_API_DIR = PROJECT_ROOT / "data" / "json"  
ASSETS_ROOT = PROJECT_ROOT / "web" / "assets"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

DATA_ROOT_DIR = DATA_ROOT / "root"

OUTPUT_SUTTA_BASE = ASSETS_ROOT / "sutta"
OUTPUT_SUTTA_BOOKS = OUTPUT_SUTTA_BASE / "books"

PROCESS_LIMIT = 0

# [NEW] Cấu hình ưu tiên dịch giả
AUTHOR_PRIORITY = ["sujato", "brahmali", "kelly"]