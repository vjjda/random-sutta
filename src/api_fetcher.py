#!/usr/bin/env python3
# Path: src/api_fetcher.py
import json
import logging
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_JSON_DIR = PROJECT_ROOT / "data" / "json"
API_TEMPLATE = "https://suttacentral.net/api/suttaplex/{}"

TARGET_BOOKS = [
    "bv", "cnd", "cp", "dhp", "iti", "ja", "kp", "mil", "mnd", 
    "ne", "pe", "ps", "pv", "snp", "tha-ap", "thag", "thi-ap", 
    "thig", "ud", "vv", "an", "dn", "mn", "sn"
]

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("APIFetcher")

# --- Core Logic ---

def fetch_book_json(book_id: str) -> str:
    """
    Downloads JSON data for a specific book ID from SuttaCentral API.
    """
    url = API_TEMPLATE.format(book_id)
    dest_file = DATA_JSON_DIR / f"{book_id}.json"
    
    try:
        # Use urllib to avoid external dependencies like requests
        with urllib.request.urlopen(url, timeout=30) as response:
            if response.status != 200:
                return f"❌ {book_id}: HTTP {response.status}"
            
            data = json.loads(response.read().decode('utf-8'))
            
            with open(dest_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
        return f"✅ {book_id}: Downloaded ({dest_file.stat().st_size / 1024:.1f} KB)"
        
    except urllib.error.HTTPError as e:
        return f"❌ {book_id}: HTTP Error {e.code} - {e.reason}"
    except urllib.error.URLError as e:
        return f"❌ {book_id}: Connection Error - {e.reason}"
    except Exception as e:
        return f"❌ {book_id}: Unexpected Error - {e}"

def orchestrate_api_fetch() -> None:
    """
    Manages the parallel download of all target books.
    """
    logger.info(f"🚀 Starting API Fetch for {len(TARGET_BOOKS)} books...")
    logger.info(f"📂 Output directory: {DATA_JSON_DIR}")
    
    # Ensure directory exists
    if DATA_JSON_DIR.exists():
        # Optional: Clean old files? For now, we overwrite.
        pass
    else:
        DATA_JSON_DIR.mkdir(parents=True, exist_ok=True)

    # Execute in parallel
    workers = min(10, os.cpu_count() * 2) # IO-bound, can use more threads
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(fetch_book_json, book_id): book_id 
            for book_id in TARGET_BOOKS
        }
        
        for future in as_completed(futures):
            result = future.result()
            logger.info(result)

    logger.info("✨ API Fetch completed.")

if __name__ == "__main__":
    try:
        orchestrate_api_fetch()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)