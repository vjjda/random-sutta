# Path: src/sutta_processor/shared/app_config.py
from pathlib import Path

# file -> shared -> sutta_processor -> src -> root
PROJECT_ROOT = Path(__file__).parents[3]

DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
DATA_API_DIR = PROJECT_ROOT / "data" / "json"  
ASSETS_ROOT = PROJECT_ROOT / "web" / "assets"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

# [CẤU HÌNH OUTPUT MỚI]
# 1. Base: Nơi chứa file sutta_loader.js -> Giờ sẽ nằm ngay trong web/assets/
OUTPUT_SUTTA_BASE = ASSETS_ROOT

# 2. Books: Nơi chứa dữ liệu JSON/JS -> Giờ sẽ là web/assets/books/
OUTPUT_SUTTA_BOOKS = ASSETS_ROOT / "books"

DATA_ROOT_DIR = DATA_ROOT / "root"
PROCESS_LIMIT = 0

AUTHOR_PRIORITY = ["sujato", "brahmali", "kelly"]