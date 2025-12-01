#!/usr/bin/env python3
# Path: src/sutta_fetcher.py
import logging
import shutil
import subprocess
import sys
import os
from pathlib import Path
from typing import List, Dict, Optional

# --- Configuration ---
REPO_URL = "https://github.com/suttacentral/sc-data.git"
CACHE_DIR = Path(".cache/sc_bilara_data")
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# Định nghĩa các đường dẫn cụ thể cần lấy từ Git (Sparse Checkout)
FETCH_MAPPING = {
    # 1. Root Texts (Pali)
    "sc_bilara_data/root/pli/ms": "root",
    
    # 2. HTML Markup
    "sc_bilara_data/html/pli/ms": "html",
    
    # 3. Comments (English only as requested)
    "sc_bilara_data/comment/en": "comment/en",
    
    # 4. Translations (Specific Authors)
    "sc_bilara_data/translation/en/brahmali": "translation/en/brahmali",
    "sc_bilara_data/translation/en/kelly": "translation/en/kelly",
    
    # Special Rule for Sujato: Only fetch 'sutta', ignore 'name' etc.
    "sc_bilara_data/translation/en/sujato/sutta": "translation/en/sujato/sutta",
}

# Các thư mục cần loại bỏ trong quá trình copy
IGNORE_PATTERNS = {
    "root": ["xplayground"], 
}

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("SuttaFetcher")

def _run_git(cwd: Path, args: List[str]) -> None:
    """Helper để chạy lệnh git an toàn."""
    try:
        subprocess.run(
            ["git"] + args,
            cwd=cwd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Git command failed: {' '.join(args)}\nError: {e.stderr.strip()}")

def _setup_repo():
    """Clone hoặc Update repo vào thư mục cache với Sparse Checkout."""
    logger.info("⚡ Setting up data repository...")
    
    if CACHE_DIR.exists():
        if (CACHE_DIR / ".git").exists():
            logger.info("   Repo exists. Updating...")
            try:
                # Reset sparse-checkout cũ để tránh xung đột
                _run_git(CACHE_DIR, ["sparse-checkout", "disable"])
            except RuntimeError:
                pass 
        else:
            logger.warning("   Cache dir exists but valid git repo not found. Re-cloning...")
            shutil.rmtree(CACHE_DIR)
            CACHE_DIR.mkdir(parents=True)
            _run_git(PROJECT_ROOT, ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", REPO_URL, str(CACHE_DIR)])
    else:
        logger.info("   Fresh clone...")
        CACHE_DIR.parent.mkdir(parents=True, exist_ok=True)
        _run_git(PROJECT_ROOT, ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", REPO_URL, str(CACHE_DIR)])

    # Cấu hình Sparse Checkout
    sparse_paths = [path.strip("/") for path in FETCH_MAPPING.keys()]
    _run_git(CACHE_DIR, ["sparse-checkout", "set"] + sparse_paths)
    
    # --- Logic xử lý nhánh (Branch Detection) ---
    # Thử lần lượt các nhánh phổ biến vì repo có thể dùng main hoặc master
    branches = ["main", "master"]
    checked_out = False
    
    for branch in branches:
        try:
            # Fetch nhẹ để đảm bảo local biết về remote branch (cần thiết cho depth=1)
            try:
                _run_git(CACHE_DIR, ["fetch", "origin", branch, "--depth", "1"])
            except RuntimeError:
                pass 

            _run_git(CACHE_DIR, ["checkout", branch])
            _run_git(CACHE_DIR, ["pull", "origin", branch])
            logger.info(f"✅ Checked out branch: '{branch}'")
            checked_out = True
            break
        except RuntimeError:
            continue
    
    # Nếu không checkout được main/master cụ thể, thử pull HEAD hiện tại
    if not checked_out:
        try:
             logger.warning("⚠️ Could not explicitly checkout 'main' or 'master'. Trying current HEAD...")
             _run_git(CACHE_DIR, ["pull", "origin", "HEAD"])
        except RuntimeError as e:
            raise RuntimeError(f"Could not checkout any valid branch. Details: {e}")
    
    logger.info("✅ Repository synced.")

def _clean_destination():
    """Xóa thư mục data cũ để đảm bảo sạch sẽ."""
    if DATA_ROOT.exists():
        logger.info("🧹 Cleaning old data...")
        shutil.rmtree(DATA_ROOT)
    DATA_ROOT.mkdir(parents=True, exist_ok=True)

def _copy_data():
    """Copy từ cache sang data/bilara theo mapping và rules."""
    logger.info("📂 Copying and filtering data...")

    for src_rel, dest_rel in FETCH_MAPPING.items():
        src_path = CACHE_DIR / src_rel
        dest_path = DATA_ROOT / dest_rel
        
        if not src_path.exists():
            logger.warning(f"⚠️ Source not found (skipped): {src_rel}")
            continue

        ignore_list = []
        for key, patterns in IGNORE_PATTERNS.items():
            if dest_rel.startswith(key):
                ignore_list.extend(patterns)
        
        ignore_func = shutil.ignore_patterns(*ignore_list) if ignore_list else None
        
        logger.info(f"   -> Copying: {dest_rel}")
        
        if dest_path.exists():
            shutil.rmtree(dest_path)
        shutil.copytree(src_path, dest_path, ignore=ignore_func)

    logger.info(f"✅ Data copied to {DATA_ROOT}")

def orchestrate_fetch():
    try:
        _setup_repo()
        _clean_destination()
        _copy_data()
        logger.info("✨ Sutta Data Fetch completed successfully.")
    except Exception as e:
        logger.error(f"❌ Critical Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    orchestrate_fetch()