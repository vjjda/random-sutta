# Path: src/sutta_processor/shared/app_config.py
from pathlib import Path

# Điều chỉnh lại parents để trỏ đúng về root dự án
# file -> shared -> sutta_processor -> src -> root
PROJECT_ROOT = Path(__file__).parents[3]

DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
DATA_API_DIR = PROJECT_ROOT / "data" / "json"  
ASSETS_ROOT = PROJECT_ROOT / "web" / "assets"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

OUTPUT_SUTTA_BASE = ASSETS_ROOT / "sutta"
OUTPUT_SUTTA_BOOKS = OUTPUT_SUTTA_BASE / "books"

AUTHOR_PRIORITY = ["sujato", "brahmali", "kelly"]