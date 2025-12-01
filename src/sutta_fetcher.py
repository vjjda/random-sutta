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
    "sc_bilara_data/root/pli/ms": "root",
    "sc_bilara_data/html/pli/ms": "html",
    "sc_bilara_data/comment/en": "comment/en",
    "sc_bilara_data/translation/en/brahmali": "translation/en/brahmali",
    "sc_bilara_data/translation/en/kelly": "translation/en/kelly",
    "sc_bilara_data/translation/en/sujato/sutta": "translation/en/sujato/sutta",
}

# Các thư mục cần loại bỏ
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

def _perform_clone():
    """Thực hiện clone mới hoàn toàn."""
    logger.info("   📥 Cloning fresh repository...")
    if CACHE_DIR.exists():
        shutil.rmtree(CACHE_DIR)
    CACHE_DIR.parent.mkdir(parents=True, exist_ok=True)
    
    # Clone depth 1 để nhẹ
    _run_git(PROJECT_ROOT, ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", REPO_URL, str(CACHE_DIR)])
    
    # Cấu hình sparse
    sparse_paths = [path.strip("/") for path in FETCH_MAPPING.keys()]
    _run_git(CACHE_DIR, ["sparse-checkout", "set"] + sparse_paths)
    
    # Checkout master (sc-data default)
    _run_git(CACHE_DIR, ["checkout", "master"])

def _update_existing_repo():
    """Cố gắng update repo hiện có, nếu lỗi sẽ raise exception."""
    if not (CACHE_DIR / ".git").exists():
        raise RuntimeError("Invalid git repository")
        
    logger.info("   🔄 Updating existing repository...")
    
    # Reset sparse config
    try:
        _run_git(CACHE_DIR, ["sparse-checkout", "disable"])
    except:
        pass # Ignore error
        
    # Re-apply sparse config
    sparse_paths = [path.strip("/") for path in FETCH_MAPPING.keys()]
    _run_git(CACHE_DIR, ["sparse-checkout", "set"] + sparse_paths)
    
    # Force sync với remote (tránh lỗi divergent branches)
    _run_git(CACHE_DIR, ["fetch", "origin", "master", "--depth", "1"])
    _run_git(CACHE_DIR, ["reset", "--hard", "origin/master"])

def _setup_repo():
    """Điều phối việc Clone/Update với cơ chế Self-Healing."""
    logger.info("⚡ Setting up data repository...")
    
    if CACHE_DIR.exists():
        try:
            _update_existing_repo()
            logger.info("✅ Repository updated.")
            return
        except Exception as e:
            logger.warning(f"⚠️ Update failed ({e}). Cleaning cache and re-cloning...")
            # Fall through to _perform_clone
    
    # Nếu chưa có cache hoặc update thất bại -> Clone mới
    try:
        _perform_clone()
        logger.info("✅ Repository cloned successfully.")
    except Exception as e:
        logger.error(f"❌ Clone failed: {e}")
        raise e

def _clean_destination():
    if DATA_ROOT.exists():
        logger.info("🧹 Cleaning old data...")
        shutil.rmtree(DATA_ROOT)
    DATA_ROOT.mkdir(parents=True, exist_ok=True)

def _copy_data():
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