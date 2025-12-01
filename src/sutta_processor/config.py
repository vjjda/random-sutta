# Path: src/sutta_processor/config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
DATA_API_DIR = PROJECT_ROOT / "data" / "json"  
ASSETS_ROOT = PROJECT_ROOT / "web" / "assets"

DATA_ROOT_DIR = DATA_ROOT / "root"

OUTPUT_SUTTA_BASE = ASSETS_ROOT / "sutta"
OUTPUT_SUTTA_BOOKS = OUTPUT_SUTTA_BASE / "books"
# Đã xóa OUTPUT_NAMES_DIR ở đây

PROCESS_LIMIT = 0