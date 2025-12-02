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
    # MỚI: Thêm thư mục tree vào danh sách cần fetch từ Git
    "sc_bilara_data/structure/tree": "tree",
}

# Các thư mục cần loại bỏ (cho copy thông thường)
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

# --- Logic mới cho Smart Tree Copy ---

def _get_installed_books() -> Set[str]:
    """Quét thư mục data/bilara/root để lấy danh sách các sách (mn, dn, dhp...) đang có."""
    root_dir = DATA_ROOT / "root"
    books = set()
    
    if not root_dir.exists():
        return books

    # Quét đệ quy cấp 1 và cấp 2 (cho trường hợp kn/dhp)
    for item in root_dir.rglob("*"):
        if item.is_dir():
            # Tên sách chính là tên thư mục (ví dụ: mn, dn, dhp, pli-tv-bi-vb)
            # Loại bỏ các thư mục cha như 'sutta', 'vinaya', 'kn' nếu chúng không chứa file json trực tiếp
            # Tuy nhiên, cách đơn giản nhất là lấy TẤT CẢ tên thư mục, thừa còn hơn thiếu
            books.add(item.name)
            
    return books

def _smart_copy_tree(src_path: Path, dest_path: Path) -> str:
    """
    Chỉ copy super-tree.json và các *-tree.json tương ứng với sách đã tải.
    Giữ nguyên cấu trúc thư mục gốc của tree (không sort lại vào kn).
    """
    valid_books = _get_installed_books()
    logger.info(f"   ℹ️  Smart Tree Copy: Found {len(valid_books)} installed books to filter trees.")

    copied_count = 0
    
    # Duyệt qua source tree trong cache
    for root, dirs, files in os.walk(src_path):
        for file in files:
            # 1. Luôn lấy super-tree.json
            if file == "super-tree.json":
                should_copy = True
            
            # 2. Lọc file *-tree.json
            elif file.endswith("-tree.json"):
                # Tách book_id từ filename: "mn-tree.json" -> "mn"
                book_id = file.replace("-tree.json", "")
                should_copy = book_id in valid_books
            else:
                should_copy = False

            if should_copy:
                # Tính đường dẫn tương đối để giữ cấu trúc (ví dụ: sutta/mn-tree.json)
                abs_src = Path(root) / file
                rel_path = abs_src.relative_to(src_path)
                abs_dest = dest_path / rel_path
                
                # Tạo thư mục cha nếu chưa có
                abs_dest.parent.mkdir(parents=True, exist_ok=True)
                
                shutil.copy2(abs_src, abs_dest)
                copied_count += 1

    return f"   -> Copied: tree ({copied_count} files filtered by installed books)"

# -------------------------------------

def _copy_worker(task: Tuple[str, str]) -> str:
    """Worker function để copy một thư mục cụ thể."""
    src_rel, dest_rel = task
    src_path = CACHE_DIR / src_rel
    dest_path = DATA_ROOT / dest_rel
    
    if not src_path.exists():
        return f"⚠️ Source not found (skipped): {src_rel}"

    # ROUTING ĐẶC BIỆT CHO TREE
    if dest_rel == "tree":
        # Cần xóa đích trước nếu có để đảm bảo sạch
        if dest_path.exists():
            shutil.rmtree(dest_path)
        return _smart_copy_tree(src_path, dest_path)

    # Logic copy thông thường cho các folder khác
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
    """Copy dữ liệu song song sử dụng ThreadPoolExecutor."""
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