# Path: src/tools/text_scanner.py
import json
import pickle
import re
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from typing import Set, List
from rich import print

# Cache file location
CACHE_FILE = Path(".cache/ebts_words_v2.pkl")

def _process_single_file(file_path: Path) -> Set[str]:
    """Hàm worker: Xử lý 1 file và trả về tập từ vựng của file đó."""
    local_words = set()
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Regex để tách từ: chỉ lấy ký tự chữ cái (bao gồm Pali diacritics)
            # Cách này nhanh hơn replace nhiều lần
            pattern = re.compile(r'[a-zA-ZāīūṅñṭḍṇḷṃĀĪŪṄÑṬḌṆḶṂ]+')
            
            for text in data.values():
                # Tìm tất cả các từ trong chuỗi
                words = pattern.findall(text.lower())
                local_words.update(words)
    except Exception:
        pass # Bỏ qua lỗi đọc file lẻ tẻ
    return local_words

def get_ebts_word_set(bilara_root_path: Path, books_filter: List[str]) -> Set[str]:
    """
    Quét text Pali với cơ chế Caching và Multiprocessing.
    """
    # 1. Kiểm tra Cache
    if CACHE_FILE.exists():
        # Kiểm tra xem dữ liệu gốc có mới hơn cache không (Optional - ở đây làm đơn giản)
        # Nếu muốn quét lại, chỉ cần xóa file cache hoặc chạy make clean
        print(f"[cyan]Loading EBTS word set from cache: {CACHE_FILE}")
        try:
            with open(CACHE_FILE, "rb") as f:
                return pickle.load(f)
        except Exception:
            print("[yellow]Cache corrupted, rescanning...")

    print(f"[cyan]Scanning text in {bilara_root_path} (Parallel)...")
    
    if not bilara_root_path.exists():
        print(f"[red]Path not found: {bilara_root_path}")
        return set()

    # 2. Thu thập danh sách file cần quét
    target_files = []
    # Chỉ quét các folder liên quan để nhanh hơn (thay vì rglob toàn bộ)
    # Cấu trúc: root/pli/ms/sutta/dn/dn1...
    # Tuy nhiên để an toàn và đơn giản, ta vẫn rglob nhưng filter nhanh
    for path in bilara_root_path.rglob("*.json"):
        # Check filename startswith books_filter
        if any(path.name.startswith(b) for b in books_filter):
            target_files.append(path)

    print(f"[cyan]Found {len(target_files)} files to process.")

    # 3. Multiprocessing Scan
    final_word_set = set()
    
    # Sử dụng tất cả core CPU
    with ProcessPoolExecutor() as executor:
        # Map xử lý file -> trả về set từ vựng
        results = executor.map(_process_single_file, target_files)
        
        # Gộp kết quả
        for res in results:
            final_word_set.update(res)

    # 4. Lưu Cache
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "wb") as f:
        pickle.dump(final_word_set, f)
    
    print(f"[green]Scanned and cached {len(final_word_set)} unique words.")
    return final_word_set