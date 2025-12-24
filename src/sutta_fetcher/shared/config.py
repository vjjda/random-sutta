# Path: src/sutta_fetcher/shared/config.py
from pathlib import Path

# Adjust root path: file -> shared -> sutta_fetcher -> src -> project_root
PROJECT_ROOT = Path(__file__).parents[3]

# Data Paths
CACHE_DIR = Path(".cache/sc_bilara_data")
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# Git Configuration
REPO_URL = "https://github.com/suttacentral/sc-data.git"
BRANCH_NAME = "main"

# Sparse Checkout Mapping (Git Path -> Local Path)
FETCH_MAPPING = {
    "sc_bilara_data/root/pli/ms": "root/pli/ms",
    "sc_bilara_data/html/pli/ms": "html/pli/ms",
    "sc_bilara_data/html/pli/vri/vinaya": "html/pli/ms/vinaya",
    "sc_bilara_data/comment/en": "comment/en",
    "sc_bilara_data/translation/en/brahmali": "translation/en/brahmali",
    "sc_bilara_data/translation/en/kelly": "translation/en/kelly",
    "sc_bilara_data/translation/en/sujato/sutta": "translation/en/sujato/sutta",
    "structure/tree": "tree",
}

# Ignore patterns during copy
IGNORE_PATTERNS = {
    "root": ["xplayground"], 
}