#!/usr/bin/env python3
# Path: src/sutta_fetcher.py
import logging
import shutil
import subprocess
import sys
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Configuration ---
REPO_URL = "https://github.com/suttacentral/sc-data.git"
CACHE_DIR = Path(".cache/sc_bilara_data")
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT = PROJECT_ROOT / "data" / "bilara"

# Branch mục tiêu
BRANCH_NAME = "main"

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
    
    # 1. Init empty repo & add remote
    CACHE_DIR.mkdir()
    _run_git(CACHE_DIR, ["init"])
    _run_git(CACHE_DIR, ["remote", "add", "origin", REPO_URL])
    
    # 2. Configure Sparse Checkout
    _run_git(CACHE_DIR, ["config", "core.sparseCheckout", "true"])
    sparse_path = CACHE_DIR / ".git" / "info" / "sparse-checkout"
    with open(sparse_path, "w") as f:
        for path in FETCH_MAPPING.keys():
            f.write(path.strip("/") + "\n")
            
    # 3. Fetch & Reset to MAIN
    logger.info(f"   📥 Fetching {BRANCH_NAME}...")
    _run_git(CACHE_DIR, ["fetch", "--depth", "1", "origin", BRANCH_NAME])
    
    logger.info("   🔨 Resetting to match remote...")
    _run_git(CACHE_DIR, ["reset", "--hard", "FETCH_HEAD"])

def _update_existing_repo():
    """Cố gắng update repo hiện có."""
    if not (CACHE_DIR / ".git").exists():
        raise RuntimeError("Invalid git repository")
        
    logger.info(f"   🔄 Updating existing repository (Target: {BRANCH_NAME})...")
    
    # Cập nhật sparse list
    sparse_path = CACHE_DIR / ".git" / "info" / "sparse-checkout"
    with open(sparse_path, "w") as f:
        for path in FETCH_MAPPING.keys():
            f.write(path.strip("/") + "\n")

    # Fetch đúng branch và Reset cứng
    _run_git(CACHE_DIR, ["fetch", "--depth", "1", "origin", BRANCH_NAME])
    _run_git(CACHE_DIR, ["reset", "--hard", "FETCH_HEAD"])
    _run_git(CACHE_DIR, ["clean", "-fdx"])

def _setup_repo():
    """Điều phối việc Clone/Update với cơ chế Self-Healing."""
    logger.info("⚡ Setting up data repository...")
    
    if CACHE_DIR.exists():
        try:
            _update_existing_repo()
            logger.info("✅ Repository updated.")
            return
        except Exception as e:
            logger.warning(f"⚠️ Update failed ({e}). Re-cloning...")
    
    try:
        _perform_clone()
        logger.info("✅ Repository synced successfully.")
    except Exception as e:
        logger.error(f"❌ Sync failed: {e}")
        raise e

def _clean_destination():
    if DATA_ROOT.exists():
        logger.info("🧹 Cleaning old data...")
        shutil.rmtree(DATA_ROOT)
    DATA_ROOT.mkdir(parents=True, exist_ok=True)

def _copy_worker(task: Tuple[str, str]) -> str:
    """Worker function để copy một thư mục cụ thể."""
    src_rel, dest_rel = task
    src_path = CACHE_DIR / src_rel
    dest_path = DATA_ROOT / dest_rel
    
    if not src_path.exists():
        return f"⚠️ Source not found (skipped): {src_rel}"

    # Xác định ignore pattern
    ignore_list = []
    for key, patterns in IGNORE_PATTERNS.items():
        if dest_rel.startswith(key):
            ignore_list.extend(patterns)
    ignore_func = shutil.ignore_patterns(*ignore_list) if ignore_list else None
    
    # Đảm bảo thư mục cha tồn tại (Thread-safe enough for mkdir)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Nếu destination đã tồn tại (do run nhiều lần mà không clean), xóa đi
    if dest_path.exists():
        shutil.rmtree(dest_path)
        
    shutil.copytree(src_path, dest_path, ignore=ignore_func)
    return f"   -> Copied: {dest_rel}"

def _copy_data():
    """Copy dữ liệu song song sử dụng ThreadPoolExecutor."""
    logger.info("📂 Copying and filtering data (Multi-threaded)...")
    
    # Số lượng workers tối đa
    workers = min(os.cpu_count() or 4, len(FETCH_MAPPING))
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        # Submit các tasks
        futures = {
            executor.submit(_copy_worker, item): item 
            for item in FETCH_MAPPING.items()
        }
        
        # Chờ và log kết quả khi hoàn thành
        for future in as_completed(futures):
            try:
                result = future.result()
                logger.info(result)
            except Exception as e:
                logger.error(f"❌ Error copying: {e}")
                # Không raise sys.exit ở đây để các luồng khác tiếp tục chạy, 
                # nhưng log lỗi để biết.

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