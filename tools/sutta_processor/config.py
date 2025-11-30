# Path: tools/sutta_processor/config.py
from pathlib import Path

# Base Paths
# __file__ is inside tools/sutta_processor/config.py -> parent x 3 is project root
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# Output Paths
OUTPUT_BASE_DIR = PROJECT_ROOT / "data" / "sutta"
OUTPUT_BOOKS_DIR = OUTPUT_BASE_DIR / "books"

# Processing Limits (0 for unlimited)
PROCESS_LIMIT = 0