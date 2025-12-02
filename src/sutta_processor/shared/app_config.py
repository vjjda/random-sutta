# Path: src/sutta_processor/shared/app_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[3]

DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
DATA_API_DIR = PROJECT_ROOT / "data" / "json"  
ASSETS_ROOT = PROJECT_ROOT / "web" / "assets"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

# [REFACTORED NAMES]
# Nơi chứa file loader chính (sutta_loader.js) -> Nằm ở root của assets
OUTPUT_LOADER_DIR = ASSETS_ROOT

# Nơi chứa các file dữ liệu chi tiết (.js) của từng cuốn sách
OUTPUT_DB_DIR = ASSETS_ROOT / "books"

DATA_ROOT_DIR = DATA_ROOT / "root"
PROCESS_LIMIT = 0

AUTHOR_PRIORITY = ["sujato", "brahmali", "kelly"]