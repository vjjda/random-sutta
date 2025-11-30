# Path: src/sutta_processor/config.py
from pathlib import Path

# Base Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
ASSETS_ROOT = PROJECT_ROOT / "web" / "assets"

# Input Dirs
DATA_ROOT_DIR = DATA_ROOT / "root"
DATA_NAME_DIR = DATA_ROOT / "name"

# Output Dirs - Sutta Content
OUTPUT_SUTTA_BASE = ASSETS_ROOT / "sutta"
OUTPUT_SUTTA_BOOKS = OUTPUT_SUTTA_BASE / "books"

# Output Dirs - Names (Tách riêng folder)
OUTPUT_NAMES_BASE = ASSETS_ROOT / "names"

# Processing Limits (0 for unlimited)
PROCESS_LIMIT = 0