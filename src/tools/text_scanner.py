# Path: src/tools/text_scanner.py
import json
import marshal
import gzip  # [NEW] Thêm gzip để nén
import re
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from typing import Set, List
from rich import print

# Đổi đuôi file cache để đánh dấu phiên bản nén
CACHE_FILE = Path(".cache/ebts_words_v3.marshal.gz")

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
    # 1. Kiểm tra Cache (Marshal + Gzip)
    if CACHE_FILE.exists():
        print(f"[cyan]Loading EBTS word set from cache (Gzip+Marshal)...")
        try:
            # [OPTIMIZED] Đọc file nén cực nhanh
            with gzip.open(CACHE_FILE, "rb") as f:
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

    # 2. Lưu Cache (Marshal + Gzip)
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    print("[cyan]Saving cache (Compressing)...")
    # [OPTIMIZED] Nén dữ liệu trước khi ghi xuống đĩa
    with gzip.open(CACHE_FILE, "wb", compresslevel=5) as f: 
        # compresslevel=5 là điểm cân bằng tốt nhất giữa tốc độ nén và dung lượng
        marshal.dump(list(final_word_set), f)
    
    print(f"[green]Scanned and cached {len(final_word_set)} unique words.")
    return final_word_set