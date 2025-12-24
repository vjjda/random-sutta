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
        self.priority_map = {item: i for i, item in enumerate(ApiConfig.PRIORITY_ORDER)}

    def discover_books(self) -> List[Tuple[str, str]]:
        """
        Quét thư mục dựa trên DISCOVERY_RULES được định nghĩa trong config.
        """
        root_dir = BilaraConfig.ROOT_TEXT_DIR
        
        if not root_dir.exists():
            logger.error(f"❌ Root text data not found at {root_dir}.")
            logger.error("   👉 Please run 'make sync-text' or 'python -m src.data_fetcher -s' first.")
            return []

        discovered: List[Tuple[str, str]] = []
        logger.info(f"   🔍 Scanning Book IDs in {root_dir.name}...")

        # 1. Rule-based Discovery
        for rule in ApiConfig.DISCOVERY_RULES:
            scan_path = root_dir / rule["path"]
            category = rule["category"]
            exclude_set = rule["exclude"]

            if not scan_path.exists():
                logger.debug(f"   ⚠️ Path not found (skipped): {rule['path']}")
                continue

            # Chỉ lấy các folder con trực tiếp (Immediate subdirectories)
            # Đây là Book ID (ví dụ: dn, mn, sn...)
            count = 0
            for item in scan_path.iterdir():
                if item.is_dir():
                    book_id = item.name
                    # Bỏ qua folder hệ thống và folder nằm trong exclude list (ví dụ: kn)
                    if (book_id in ApiConfig.SYSTEM_IGNORE) or (book_id in exclude_set):
                        continue
                    
                    discovered.append((book_id, category))
                    count += 1
            
            logger.debug(f"   -> Scanned {rule['path']}: found {count} items.")

        # 2. Add Super Targets & Extras
        # Thêm các mục lục lớn (sutta, vinaya...)
        for uid in ApiConfig.SUPER_TARGET_CATS:
            discovered.append((uid, "super"))
            
        # Thêm các mục bổ sung thủ công
        for uid, cat in ApiConfig.EXTRA_UIDS.items():
            discovered.append((uid, cat))

        # 3. Deduplicate & Sort
        # Loại bỏ trùng lặp và sắp xếp theo độ ưu tiên
        seen = set()
        final_list = []
        
        # Priority items first
        priority_candidates = []
        normal_candidates = []

        for info in discovered:
            book_id, cat = info
            unique_key = (book_id, cat)
            
            if unique_key in seen:
                continue
            seen.add(unique_key)

            if info in self.priority_map:
                priority_candidates.append(info)
            else:
                normal_candidates.append(info)

        priority_candidates.sort(key=lambda x: self.priority_map[x])
        normal_candidates.sort(key=lambda x: x[0]) # Sort chữ cái cho phần còn lại

        final_list = priority_candidates + normal_candidates
        
        logger.info(f"   ✅ Discovered {len(final_list)} targets to fetch.")
        return final_list

    def fetch_book_json(self, book_info: Tuple[str, str]) -> str:
        book_id, category_path = book_info
        url = ApiConfig.API_TEMPLATE.format(book_id)
        
        category_dir = ApiConfig.DATA_JSON_DIR / category_path
        category_dir.mkdir(parents=True, exist_ok=True)
        dest_file = category_dir / f"{book_id}.json"
        
        # Check cache logic could be added here later
        
        try:
            timeout = ApiConfig.TIMEOUT_DEFAULT
            if category_path == "super": timeout = ApiConfig.TIMEOUT_SUPER
            elif book_id in ApiConfig.LARGE_BOOKS: timeout = ApiConfig.TIMEOUT_LARGE
            
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
            return

        if not ApiConfig.DATA_JSON_DIR.exists():
            ApiConfig.DATA_JSON_DIR.mkdir(parents=True)

        workers = ApiConfig.get_worker_count()
        logger.info(f"   Using {workers} threads...")

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self.fetch_book_json, info): info[0] 
                for info in target_books
            }
            
            for future in as_completed(futures):
                logger.info(future.result())

        logger.info("✨ Metadata API Fetch completed.")

def run_api_fetch() -> None:
    client = MetadataClient()
    client.run()