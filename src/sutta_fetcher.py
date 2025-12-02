#!/usr/bin/env python3
# Path: src/sutta_fetcher.py
import logging
import shutil
import subprocess
import sys
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Set
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
    
    # [FIXED] Đường dẫn đúng của Tree (nằm ngoài sc_bilara_data)
    "structure/tree": "tree",
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
    logger.info("   📥 Cloning fresh repository...")
    if CACHE_DIR.exists():
        shutil.rmtree(CACHE_DIR)
    CACHE_DIR.parent.mkdir(parents=True, exist_ok=True)
    
    CACHE_DIR.mkdir()
    _run_git(CACHE_DIR, ["init"])
    _run_git(CACHE_DIR, ["remote", "add", "origin", REPO_URL])
    
    _run_git(CACHE_DIR, ["config", "core.sparseCheckout", "true"])
    sparse_path = CACHE_DIR / ".git" / "info" / "sparse-checkout"
    with open(sparse_path, "w") as f:
        for path in FETCH_MAPPING.keys():
            f.write(path.strip("/") + "\n")
            
    logger.info(f"   📥 Fetching {BRANCH_NAME}...")
    _run_git(CACHE_DIR, ["fetch", "--depth", "1", "origin", BRANCH_NAME])
    
    logger.info("   🔨 Resetting to match remote...")
    _run_git(CACHE_DIR, ["reset", "--hard", "FETCH_HEAD"])

def _update_existing_repo():
    if not (CACHE_DIR / ".git").exists():
        raise RuntimeError("Invalid git repository")
        
    logger.info(f"   🔄 Updating existing repository (Target: {BRANCH_NAME})...")
    
    # Cập nhật sparse list (quan trọng để Git biết cần pull thêm folder structure/tree)
    sparse_path = CACHE_DIR / ".git" / "info" / "sparse-checkout"
    with open(sparse_path, "w") as f:
        for path in FETCH_MAPPING.keys():
            f.write(path.strip("/") + "\n")

    _run_git(CACHE_DIR, ["fetch", "--depth", "1", "origin", BRANCH_NAME])
    _run_git(CACHE_DIR, ["reset", "--hard", "FETCH_HEAD"])
    _run_git(CACHE_DIR, ["clean", "-fdx"])

def _setup_repo():
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

# --- Logic mới cho Smart Tree Copy ---

def _get_installed_books_from_cache() -> Set[str]:
    """
    [FIXED] Quét thư mục CACHE để tìm sách.
    Lý do: Thư mục DATA_ROOT/root đã bị xóa bởi _clean_destination trước khi copy chạy.
    """
    # Đường dẫn trong cache: .cache/sc_bilara_data/sc_bilara_data/root/pli/ms
    # Lưu ý: FETCH_MAPPING key cho root là "sc_bilara_data/root/pli/ms"
    root_src_in_cache = CACHE_DIR / "sc_bilara_data/root/pli/ms"
    
    books = set()
    
    if not root_src_in_cache.exists():
        logger.warning(f"⚠️ Cannot find root text in cache at {root_src_in_cache}")
        return books

    # Quét đệ quy tìm tên sách
    for item in root_src_in_cache.rglob("*"):
        if item.is_dir():
            # Chỉ lấy các folder là sách thực sự (có chứa file json hoặc nằm trong kn)
            if item.name not in ["sutta", "vinaya", "abhidhamma", "kn"]:
                 books.add(item.name)
            
    return books

def _smart_copy_tree(src_path: Path, dest_path: Path) -> str:
    """
    Chỉ copy super-tree.json và các *-tree.json tương ứng.
    """
    # Lấy danh sách sách từ Cache nguồn
    valid_books = _get_installed_books_from_cache()
    logger.info(f"   ℹ️  Smart Tree Copy: Found {len(valid_books)} books in cache to filter trees.")

    copied_count = 0
    
    for root, dirs, files in os.walk(src_path):
        for file in files:
            if file == "super-tree.json":
                should_copy = True
            elif file.endswith("-tree.json"):
                # "mn-tree.json" -> "mn"
                book_id = file.replace("-tree.json", "")
                should_copy = book_id in valid_books
            else:
                should_copy = False

            if should_copy:
                abs_src = Path(root) / file
                rel_path = abs_src.relative_to(src_path)
                abs_dest = dest_path / rel_path
                
                abs_dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(abs_src, abs_dest)
                copied_count += 1

    return f"   -> Copied: tree ({copied_count} files)"

# -------------------------------------

def _copy_worker(task: Tuple[str, str]) -> str:
    src_rel, dest_rel = task
    src_path = CACHE_DIR / src_rel
    dest_path = DATA_ROOT / dest_rel
    
    if not src_path.exists():
        return f"⚠️ Source not found (skipped): {src_rel}"

    # ROUTING ĐẶC BIỆT CHO TREE
    if dest_rel == "tree":
        if dest_path.exists():
            shutil.rmtree(dest_path)
        return _smart_copy_tree(src_path, dest_path)

    # Logic copy thông thường
    ignore_list = []
    for key, patterns in IGNORE_PATTERNS.items():
        if dest_rel.startswith(key):
            ignore_list.extend(patterns)
    ignore_func = shutil.ignore_patterns(*ignore_list) if ignore_list else None
    
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    
    if dest_path.exists():
        shutil.rmtree(dest_path)
        
    shutil.copytree(src_path, dest_path, ignore=ignore_func)
    return f"   -> Copied: {dest_rel}"

def _copy_data():
    logger.info("📂 Copying and filtering data (Multi-threaded)...")
    
    workers = min(os.cpu_count() or 4, len(FETCH_MAPPING))
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_copy_worker, item): item 
            for item in FETCH_MAPPING.items()
        }
        
        for future in as_completed(futures):
            try:
                result = future.result()
                logger.info(result)
            except Exception as e:
                logger.error(f"❌ Error copying: {e}")

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