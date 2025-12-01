#!/usr/bin/env python3
# Path: src/api_fetcher.py
import json
import logging
import os
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Set

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_ROOT_DIR = PROJECT_ROOT / "data" / "bilara" / "root"
DATA_JSON_DIR = PROJECT_ROOT / "data" / "json"
API_TEMPLATE = "https://suttacentral.net/api/suttaplex/{}"

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("APIFetcher")

def discover_books() -> List[str]:
    """
    Quét thư mục data/bilara/root để tìm danh sách các bộ kinh đã tải về.
    Logic:
    - Các bộ chính (dn, mn, sn, an) nằm ngay dưới root.
    - Các bộ tiểu bộ (dhp, iti...) nằm trong thư mục 'kn'.
    """
    if not DATA_ROOT_DIR.exists():
        logger.error(f"❌ Root data not found at {DATA_ROOT_DIR}. Please run sutta_fetcher.py first.")
        return []

    found_books: Set[str] = set()
    
    # Duyệt qua các thư mục trong data/bilara/root
    for item in DATA_ROOT_DIR.iterdir():
        if item.is_dir():
            if item.name == 'kn':
                # Nếu là Khuddaka Nikaya (kn), duyệt tiếp các thư mục con
                logger.info(f"   🔍 Found 'kn', scanning contents...")
                for sub_item in item.iterdir():
                    if sub_item.is_dir():
                        found_books.add(sub_item.name)
            elif item.name in ['ab', 'vi']: 
                 # Tùy chọn: Có thể bỏ qua hoặc xử lý Abhidhamma/Vinaya nếu cần
                 # Hiện tại cứ lấy hết nếu không phải kn
                 found_books.add(item.name)
            else:
                # Các bộ chính: dn, mn, sn, an, vv...
                found_books.add(item.name)

    # Loại bỏ các thư mục rác hệ thống nếu có
    params_to_ignore = {'xplayground', '__pycache__', '.git'}
    final_list = sorted(list(found_books - params_to_ignore))
    
    logger.info(f"✅ Discovered {len(final_list)} books from local data: {', '.join(final_list)}")
    return final_list

def fetch_book_json(book_id: str) -> str:
    """Tải metadata từ API SuttaCentral."""
    url = API_TEMPLATE.format(book_id)
    dest_file = DATA_JSON_DIR / f"{book_id}.json"
    
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            if response.status != 200:
                return f"❌ {book_id}: HTTP {response.status}"
            
            data = json.loads(response.read().decode('utf-8'))
            
            # Lưu file
            with open(dest_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
        return f"✅ {book_id}"
        
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return f"⚠️ {book_id}: Not found on API (404)"
        return f"❌ {book_id}: HTTP {e.code}"
    except Exception as e:
        return f"❌ {book_id}: Error {e}"

def orchestrate_api_fetch() -> None:
    logger.info("🚀 Starting Metadata Fetch (Dynamic Discovery)...")
    
    # 1. Khám phá sách từ dữ liệu đã tải
    target_books = discover_books()
    if not target_books:
        logger.warning("⚠️ No books found to fetch.")
        return

    # 2. Chuẩn bị thư mục output
    if not DATA_JSON_DIR.exists():
        DATA_JSON_DIR.mkdir(parents=True)

    # 3. Tải song song (Concurrency)
    workers = min(10, os.cpu_count() * 2) 
    logger.info(f"   Using {workers} threads for {len(target_books)} requests...")

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(fetch_book_json, book_id): book_id 
            for book_id in target_books
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