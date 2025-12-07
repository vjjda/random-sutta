# Path: src/api_fetcher.py
import json
import os
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Tuple, Set
from src.logging_config import setup_logging

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT_DIR = PROJECT_ROOT / "data" / "bilara" / "root"
DATA_JSON_DIR = PROJECT_ROOT / "data" / "json"
API_TEMPLATE = "https://suttacentral.net/api/suttaplex/{}"

# 1. Các UID bổ sung (Vinaya rules)
EXTRA_UIDS = {
    "pli-tv-bi-pm": "vinaya",
    "pli-tv-bu-pm": "vinaya"
}

# 2. Priority 1: Super Categories (File khổng lồ)
SUPER_TARGETS = ["sutta", "vinaya", "abhidhamma"]

# 3. Priority 2: Large Nikayas (File lớn)
# Dùng Set để tra cứu nhanh O(1)
LARGE_TARGETS: Set[str] = {"dn", "mn", "sn", "an"}

# 4. New: Explicit Order for largest files to ensure they start first (uid, category)
# Based on du -h output, sorted descending. Category corresponds to category_path argument in fetch_book_json.
TOP_PRIORITY_ORDER_LIST = [
    ("sutta", "super"),     # 35M
    ("sn", "sutta"),        # 13M
    ("an", "sutta"),        # 9.0M
    ("vinaya", "super"),    # 9.0M
    ("mn", "sutta"),        # 2.0M
    ("thag", "sutta/kn"),   # 2.0M
    ("tha-ap", "sutta/kn"), # 2.0M
    ("ja", "sutta/kn"),     # 2.0M
    ("abhidhamma", "super"),# 2.0M
]
TOP_PRIORITY_MAP = {item: i for i, item in enumerate(TOP_PRIORITY_ORDER_LIST)}

logger = setup_logging("APIFetcher")

def discover_books() -> List[Tuple[str, str]]:
    """
    Quét thư mục root để tìm sách và sắp xếp theo thứ tự ưu tiên:
    1. TOP_PRIORITY_ORDER_LIST (explicitly defined largest files)
    2. Super (sutta, vinaya...) - remaining
    3. Large (dn, mn, sn, an) - remaining
    4. Normal (kn, etc.) - remaining
    """
    if not DATA_ROOT_DIR.exists():
        logger.error(f"❌ Root data not found at {DATA_ROOT_DIR}. Please run sutta_fetcher.py first.")
        return []

    # --- PHASE 1: Priority 1 (Super) ---
    priority_super_raw = [(uid, "super") for uid in SUPER_TARGETS]
    
    # --- PHASE 2: Scanning ---
    found_raw: List[Tuple[str, str]] = []
    
    # Helper để quét thư mục
    def scan_dir(path: Path, category: str):
        if path.exists():
            for item in path.iterdir():
                if not item.is_dir(): continue
                # Xử lý đệ quy cho Tiểu bộ (KN)
                if item.name == 'kn':
                    for kn_book in item.iterdir():
                        if kn_book.is_dir():
                            found_raw.append((kn_book.name, f"{category}/kn"))
                else:
                    found_raw.append((item.name, category))

    logger.info("   🔍 Scanning directories...")
    scan_dir(DATA_ROOT_DIR / "sutta", "sutta")
    scan_dir(DATA_ROOT_DIR / "vinaya", "vinaya")
    scan_dir(DATA_ROOT_DIR / "abhidhamma", "abhidhamma")

    # Inject Extra UIDs
    for uid, category in EXTRA_UIDS.items():
        found_raw.append((uid, category))

    # --- PHASE 3: Filtering & Sorting (Custom priority based on size) ---
    params_to_ignore = {'xplayground', '__pycache__', '.git', '.DS_Store'}
    
    # Combine all discovered books and filter out ignored ones
    all_discovered_books: List[Tuple[str, str]] = []
    seen_books = set()

    for book, cat in found_raw + priority_super_raw: # Include SUPER_TARGETS in this process
        # book is uid, cat is category_path
        # Special handling for Super targets as their 'uid' is "sutta", "vinaya", "abhidhamma"
        # and their 'cat' is "super". The normal scan categorizes them as "sutta", "vinaya", "abhidhamma".
        # Ensure correct categorization for TOP_PRIORITY_ORDER_LIST matching.
        
        # Adjust category for internal processing if it's a SUPER_TARGET
        processed_cat = cat
        if book in SUPER_TARGETS: processed_cat = "super"

        if book in params_to_ignore or (book, processed_cat) in seen_books:
            continue
        
        seen_books.add((book, processed_cat))
        all_discovered_books.append((book, processed_cat))

    # Split into explicit top priority and remaining
    top_priority_tasks = []
    remaining_books = []
    
    for book_info in all_discovered_books:
        if book_info in TOP_PRIORITY_MAP:
            top_priority_tasks.append(book_info)
        else:
            remaining_books.append(book_info)

    # Sort top priority tasks according to TOP_PRIORITY_ORDER_LIST
    top_priority_tasks.sort(key=lambda x: TOP_PRIORITY_MAP[x])

    # Re-classify remaining books into super, large, normal categories for secondary sorting
    remaining_priority_super = []
    remaining_priority_large = []
    remaining_normal_books = []

    for book, cat in remaining_books:
        if cat == "super": # Already categorized
            remaining_priority_super.append((book, cat))
        elif book in LARGE_TARGETS: # These will have category "sutta" etc.
            remaining_priority_large.append((book, cat))
        else: # Normal books can be in "sutta/kn", "vinaya", "abhidhamma" etc.
            remaining_normal_books.append((book, cat))

    remaining_priority_super.sort(key=lambda x: x[0])
    remaining_priority_large.sort(key=lambda x: x[0])
    remaining_normal_books.sort(key=lambda x: x[0])

    # Final combined and sorted list
    return top_priority_tasks + remaining_priority_super + remaining_priority_large + remaining_normal_books

def fetch_book_json(book_info: Tuple[str, str]) -> str:
    """Tải metadata từ API."""
    book_id, category_path = book_info
    url = API_TEMPLATE.format(book_id)
    
    category_dir = DATA_JSON_DIR / category_path
    category_dir.mkdir(parents=True, exist_ok=True)
    
    dest_file = category_dir / f"{book_id}.json"
    
    try:
        # Timeout Strategy:
        # - Super (rất nặng): 120s
        # - Large (nặng): 90s
        # - Normal: 60s
        timeout = 60
        if category_path == "super":
            timeout = 120
        elif book_id in LARGE_TARGETS:
            timeout = 90
        
        with urllib.request.urlopen(url, timeout=timeout) as response:
            if response.status != 200:
                return f"❌ {book_id}: HTTP {response.status}"
            
            data = json.loads(response.read().decode('utf-8'))
            
            with open(dest_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
        return f"✅ {category_path}/{book_id}"
        
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return f"⚠️ {category_path}/{book_id}: Not found (404)"
        return f"❌ {category_path}/{book_id}: HTTP {e.code}"
    except Exception as e:
        return f"❌ {category_path}/{book_id}: Error {e}"

def orchestrate_api_fetch() -> None:
    logger.info("🚀 Starting Metadata Fetch...")
    
    target_books = discover_books()
    if not target_books:
        logger.warning("⚠️ No targets found to fetch.")
        return

    if not DATA_JSON_DIR.exists():
        DATA_JSON_DIR.mkdir(parents=True)

    # Tối ưu số lượng worker
    workers = min(12, (os.cpu_count() or 1) * 2)
    logger.info(f"   Using {workers} threads for {len(target_books)} requests...")

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(fetch_book_json, info): info[0] 
            for info in target_books
        }
        
        for future in as_completed(futures):
            result = future.result()
            logger.info(result)

    logger.info("✨ Metadata API Fetch completed.")

if __name__ == "__main__":
    try:
        orchestrate_api_fetch()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)