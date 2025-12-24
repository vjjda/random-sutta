# Path: src/tools/text_scanner.py
import json
import marshal  # [CHANGED] Nhanh hơn pickle cho dữ liệu native
import re
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from typing import Set, List
from rich import print

# Đổi đuôi file cache
CACHE_FILE = Path(".cache/ebts_words_v2.marshal")

def _process_single_file(file_path: Path) -> Set[str]:
    local_words = set()
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Regex bao gồm cả ṁ (chấm trên)
            pattern = re.compile(r'[a-zA-ZāīūṅñṭḍṇḷṃṁĀĪŪṄÑṬḌṆḶṂṀ]+')
            
            for text in data.values():
                words = pattern.findall(text.lower())
                local_words.update(words)
    except Exception:
        pass 
    return local_words

def get_ebts_word_set(bilara_root_path: Path, books_filter: List[str]) -> Set[str]:
    # 1. Kiểm tra Cache (Marshal)
    if CACHE_FILE.exists():
        print(f"[cyan]Loading EBTS word set from cache (Marshal)...")
        try:
            with open(CACHE_FILE, "rb") as f:
                # Marshal load cực nhanh
                return set(marshal.load(f))
        except Exception:
            print("[yellow]Cache corrupted, rescanning...")

    print(f"[cyan]Scanning text in {bilara_root_path} (Parallel)...")
    
    if not bilara_root_path.exists():
        return set()

    target_files = []
    for path in bilara_root_path.rglob("*.json"):
        if any(path.name.startswith(b) for b in books_filter):
            target_files.append(path)

    print(f"[cyan]Found {len(target_files)} files to process.")

    final_word_set = set()
    
    with ProcessPoolExecutor() as executor:
        results = executor.map(_process_single_file, target_files)
        for res in results:
            final_word_set.update(res)

    # Lưu Cache bằng Marshal
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "wb") as f:
        # Chuyển về list để marshal dump được (marshal không support set ở 1 số phiên bản cũ, list an toàn hơn)
        marshal.dump(list(final_word_set), f)
    
    print(f"[green]Scanned and cached {len(final_word_set)} unique words.")
    return final_word_set