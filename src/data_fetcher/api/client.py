# Path: src/data_fetcher/api/client.py
import json
import os
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Tuple, Set, Dict

from src.logging_config import setup_logging

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parents[3]
DATA_ROOT_DIR = PROJECT_ROOT / "data" / "bilara" / "root"
DATA_JSON_DIR = PROJECT_ROOT / "data" / "json"
API_TEMPLATE = "https://suttacentral.net/api/suttaplex/{}"

# Constants
EXTRA_UIDS: Dict[str, str] = {
    "pli-tv-bi-pm": "vinaya",
    "pli-tv-bu-pm": "vinaya"
}
SUPER_TARGETS: List[str] = ["sutta", "vinaya", "abhidhamma"]
LARGE_TARGETS: Set[str] = {"dn", "mn", "sn", "an"}
TOP_PRIORITY_ORDER_LIST: List[Tuple[str, str]] = [
    ("sutta", "super"),
    ("sn", "sutta"),
    ("an", "sutta"),
    ("vinaya", "super"),
    ("mn", "sutta"),
    ("thag", "sutta/kn"),
    ("tha-ap", "sutta/kn"),
    ("ja", "sutta/kn"),
    ("abhidhamma", "super"),
]
TOP_PRIORITY_MAP = {item: i for i, item in enumerate(TOP_PRIORITY_ORDER_LIST)}

logger = setup_logging("DataFetcher.API")

class MetadataClient:
    def discover_books(self) -> List[Tuple[str, str]]:
        if not DATA_ROOT_DIR.exists():
            logger.error(f"❌ Root data not found at {DATA_ROOT_DIR}. Please fetch Bilara data first.")
            return []

        priority_super_raw = [(uid, "super") for uid in SUPER_TARGETS]
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
        scan_dir(DATA_ROOT_DIR / "sutta", "sutta")
        scan_dir(DATA_ROOT_DIR / "vinaya", "vinaya")
        scan_dir(DATA_ROOT_DIR / "abhidhamma", "abhidhamma")

        for uid, category in EXTRA_UIDS.items():
            found_raw.append((uid, category))

        params_to_ignore = {'xplayground', '__pycache__', '.git', '.DS_Store'}
        all_discovered: List[Tuple[str, str]] = []
        seen = set()

        for book, cat in found_raw + priority_super_raw:
            processed_cat = "super" if book in SUPER_TARGETS else cat
            
            if book in params_to_ignore or (book, processed_cat) in seen:
                continue
            
            seen.add((book, processed_cat))
            all_discovered.append((book, processed_cat))

        # Sorting Logic
        top_priority = []
        remaining = []
        
        for info in all_discovered:
            if info in TOP_PRIORITY_MAP:
                top_priority.append(info)
            else:
                remaining.append(info)

        top_priority.sort(key=lambda x: TOP_PRIORITY_MAP[x])
        remaining.sort(key=lambda x: x[0])

        return top_priority + remaining

    def fetch_book_json(self, book_info: Tuple[str, str]) -> str:
        book_id, category_path = book_info
        url = API_TEMPLATE.format(book_id)
        
        category_dir = DATA_JSON_DIR / category_path
        category_dir.mkdir(parents=True, exist_ok=True)
        dest_file = category_dir / f"{book_id}.json"
        
        try:
            timeout = 60
            if category_path == "super": timeout = 120
            elif book_id in LARGE_TARGETS: timeout = 90
            
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

        if not DATA_JSON_DIR.exists():
            DATA_JSON_DIR.mkdir(parents=True)

        workers = min(12, (os.cpu_count() or 1) * 2)
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