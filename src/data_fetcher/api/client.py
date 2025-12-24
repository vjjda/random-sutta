# Path: src/data_fetcher/api/client.py
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Tuple

from src.logging_config import setup_logging
from ..fetcher_config import ApiConfig, BilaraConfig

logger = setup_logging("DataFetcher.API")

class MetadataClient:
    def __init__(self):
        # Pre-calculate priority map for O(1) lookup
        self.priority_map = {item: i for i, item in enumerate(ApiConfig.PRIORITY_ORDER)}

    def discover_books(self) -> List[Tuple[str, str]]:
        # Sử dụng đường dẫn từ BilaraConfig để scan dữ liệu đã tải về
        root_dir = BilaraConfig.DATA_ROOT / "root"
        
        if not root_dir.exists():
            logger.error(f"❌ Root data not found at {root_dir}. Please fetch Bilara data first.")
            return []

        priority_super_raw = [(uid, "super") for uid in ApiConfig.SUPER_TARGET_CATS]
        found_raw: List[Tuple[str, str]] = []

        def scan_dir(path: Path, category: str) -> None:
            if path.exists():
                for item in path.iterdir():
                    if not item.is_dir(): continue
                    if item.name == 'kn':
                        for kn_book in item.iterdir():
                            if kn_book.is_dir():
                                found_raw.append((kn_book.name, f"{category}/kn"))
                    else:
                        found_raw.append((item.name, category))

        logger.info("   🔍 Scanning directories for API targets...")
        scan_dir(root_dir / "sutta", "sutta")
        scan_dir(root_dir / "vinaya", "vinaya")
        scan_dir(root_dir / "abhidhamma", "abhidhamma")

        for uid, category in ApiConfig.EXTRA_UIDS.items():
            found_raw.append((uid, category))

        all_discovered: List[Tuple[str, str]] = []
        seen = set()

        for book, cat in found_raw + priority_super_raw:
            processed_cat = "super" if book in ApiConfig.SUPER_TARGET_CATS else cat
            
            if book in ApiConfig.SYSTEM_IGNORE or (book, processed_cat) in seen:
                continue
            
            seen.add((book, processed_cat))
            all_discovered.append((book, processed_cat))

        # Sorting Logic
        top_priority = []
        remaining = []
        
        for info in all_discovered:
            if info in self.priority_map:
                top_priority.append(info)
            else:
                remaining.append(info)

        top_priority.sort(key=lambda x: self.priority_map[x])
        remaining.sort(key=lambda x: x[0])

        return top_priority + remaining

    def fetch_book_json(self, book_info: Tuple[str, str]) -> str:
        book_id, category_path = book_info
        url = ApiConfig.API_TEMPLATE.format(book_id)
        
        category_dir = ApiConfig.DATA_JSON_DIR / category_path
        category_dir.mkdir(parents=True, exist_ok=True)
        dest_file = category_dir / f"{book_id}.json"
        
        try:
            # Configurable Timeouts
            timeout = ApiConfig.TIMEOUT_DEFAULT
            if category_path == "super": 
                timeout = ApiConfig.TIMEOUT_SUPER
            elif book_id in ApiConfig.LARGE_BOOKS: 
                timeout = ApiConfig.TIMEOUT_LARGE
            
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

    def run(self) -> None:
        logger.info("🚀 Starting Metadata (API) Fetch...")
        
        target_books = self.discover_books()
        if not target_books:
            logger.warning("⚠️ No targets found. Ensure Bilara data is synced first.")
            return

        if not ApiConfig.DATA_JSON_DIR.exists():
            ApiConfig.DATA_JSON_DIR.mkdir(parents=True)

        workers = ApiConfig.get_worker_count()
        logger.info(f"   Using {workers} threads for {len(target_books)} requests...")

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self.fetch_book_json, info): info[0] 
                for info in target_books
            }
            
            for future in as_completed(futures):
                result = future.result()
                logger.info(result)

        logger.info("✨ Metadata API Fetch completed.")

def run_api_fetch() -> None:
    client = MetadataClient()
    client.run()