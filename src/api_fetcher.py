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
from typing import List, Tuple

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
# Trỏ đúng vào thư mục root chứa text Pali
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

def discover_books() -> List[Tuple[str, str]]:
    """
    Quét thư mục data/bilara/root để tìm ID sách và Category của nó.
    Trả về danh sách các tuple: (book_id, category_path)
    Ví dụ: 
      - ('mn', 'sutta')
      - ('dhp', 'sutta/kn')  <-- Nested folder cho KN
      - ('ds', 'abhidhamma')
    """
    if not DATA_ROOT_DIR.exists():
        logger.error(f"❌ Root data not found at {DATA_ROOT_DIR}. Please run sutta_fetcher.py first.")
        return []

    found_books: List[Tuple[str, str]] = []
    
    # 1. Scan Sutta Pitaka
    sutta_dir = DATA_ROOT_DIR / "sutta"
    if sutta_dir.exists():
        logger.info("   🔍 Scanning Sutta Pitaka...")
        for item in sutta_dir.iterdir():
            if not item.is_dir(): continue
            
            if item.name == 'kn':
                # Khuddaka Nikaya: ID sách nằm bên trong thư mục kn
                # UPDATE: Gán category là 'sutta/kn' để tạo folder con
                for kn_book in item.iterdir():
                    if kn_book.is_dir():
                        found_books.append((kn_book.name, "sutta/kn"))
            else:
                # Các bộ Nikaya chính (dn, mn, sn, an)
                found_books.append((item.name, "sutta"))

    # 2. Scan Vinaya Pitaka
    vinaya_dir = DATA_ROOT_DIR / "vinaya"
    if vinaya_dir.exists():
        logger.info("   🔍 Scanning Vinaya Pitaka...")
        for item in vinaya_dir.iterdir():
            if item.is_dir():
                found_books.append((item.name, "vinaya"))

    # 3. Scan Abhidhamma Pitaka
    abhi_dir = DATA_ROOT_DIR / "abhidhamma"
    if abhi_dir.exists():
        logger.info("   🔍 Scanning Abhidhamma Pitaka...")
        for item in abhi_dir.iterdir():
            if item.is_dir():
                found_books.append((item.name, "abhidhamma"))

    # Loại bỏ rác hệ thống (nếu có)
    params_to_ignore = {'xplayground', '__pycache__', '.git', '.DS_Store'}
    final_list = [
        (book, cat) for book, cat in sorted(found_books) 
        if book not in params_to_ignore
    ]
    
    logger.info(f"✅ Discovered {len(final_list)} books.")
    return final_list

def fetch_book_json(book_info: Tuple[str, str]) -> str:
    """Tải metadata từ API SuttaCentral và lưu vào đúng thư mục category."""
    book_id, category_path = book_info
    url = API_TEMPLATE.format(book_id)
    
    # Tạo đường dẫn thư mục category: data/json/sutta/kn, data/json/vinaya...
    # parents=True giúp tạo các thư mục lồng nhau (như sutta/kn) tự động
    category_dir = DATA_JSON_DIR / category_path
    category_dir.mkdir(parents=True, exist_ok=True)
    
    dest_file = category_dir / f"{book_id}.json"
    
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            if response.status != 200:
                return f"❌ {book_id}: HTTP {response.status}"
            
            data = json.loads(response.read().decode('utf-8'))
            
            # Lưu file
            with open(dest_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
        return f"✅ {category_path}/{book_id}"
        
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return f"⚠️ {category_path}/{book_id}: Not found on API (404)"
        return f"❌ {category_path}/{book_id}: HTTP {e.code}"
    except Exception as e:
        return f"❌ {category_path}/{book_id}: Error {e}"

def orchestrate_api_fetch() -> None:
    logger.info("🚀 Starting Metadata Fetch (Nested Structure)...")
    
    # 1. Khám phá sách
    target_books = discover_books()
    if not target_books:
        logger.warning("⚠️ No books found to fetch.")
        return

    # 2. Chuẩn bị thư mục gốc output
    if not DATA_JSON_DIR.exists():
        DATA_JSON_DIR.mkdir(parents=True)

    # 3. Tải song song
    workers = min(10, os.cpu_count() * 2) 
    logger.info(f"   Using {workers} threads for {len(target_books)} books...")

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