# Path: src/sutta_processor/config.py
from pathlib import Path

# Base Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# UPDATED: Output directly to the web assets folder
OUTPUT_BASE_DIR = PROJECT_ROOT / "web" / "assets" / "sutta"
OUTPUT_BOOKS_DIR = OUTPUT_BASE_DIR / "books"

# Processing Limits (0 for unlimited)
PROCESS_LIMIT = 0