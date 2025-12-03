# Path: src/sutta_processor/shared/app_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[3]

DATA_ROOT = PROJECT_ROOT / "data" / "bilara"
DATA_API_DIR = PROJECT_ROOT / "data" / "json"  
ASSETS_ROOT = PROJECT_ROOT / "web" / "assets"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

OUTPUT_LOADER_DIR = ASSETS_ROOT
OUTPUT_DB_DIR = ASSETS_ROOT / "books"

DATA_ROOT_DIR = DATA_ROOT / "root"
PROCESS_LIMIT = 0

# [NEW] Super Data Paths
SUPER_TREE_PATH = DATA_ROOT / "tree" / "super-tree.json"
SUPER_META_DIR = DATA_API_DIR / "super" # Nơi chứa sutta.json, vinaya.json...

AUTHOR_PRIORITY = ["sujato", "brahmali", "kelly"]