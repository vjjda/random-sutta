# Path: src/sutta_processor/config.py
from pathlib import Path

# Base Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# Input Dirs
DATA_ROOT_DIR = DATA_ROOT / "root"
DATA_NAME_DIR = DATA_ROOT / "name"  # <--- NEW

# Output Dirs
OUTPUT_BASE_DIR = PROJECT_ROOT / "web" / "assets" / "sutta"
OUTPUT_BOOKS_DIR = OUTPUT_BASE_DIR / "books"
OUTPUT_NAMES_DIR = OUTPUT_BASE_DIR / "names" # <--- NEW

# Processing Limits (0 for unlimited)
PROCESS_LIMIT = 0