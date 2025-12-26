# Path: src/dict_builder/tools/text_scanner.py
import json
import marshal
import gzip
import re
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from typing import Set, List
from rich import print

# [UPDATED] Cache file located in src/dict_builder/.cache
# Path(__file__).parent is 'tools', parent.parent is 'dict_builder'
BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_FILE = BASE_DIR / ".cache" / "ebts_words_v5.marshal.gz"

def _process_single_file(file_path: Path) -> Set[str]:
    local_words = set()
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Regex bắt ký tự Pali
            pattern = re.compile(r'[a-zA-ZāīūṅñṭḍṇḷṃṁĀĪŪṄÑṬḌṆḶṂṀ]+')
            
            # Ký tự cần xóa bỏ để nối từ (Smart quotes thường dùng trong sandhi ...'ti)
            # [UPDATED] Thêm dấu nháy thẳng " và ' để bao quát hơn
            quotes_remove = str.maketrans("", "", "‘’“”\"'")
            # Ký tự cần thay bằng dấu cách để ngắt từ
            punc_space = str.maketrans("—–-.,;?!:…", "          ")

            for text in data.values():
                # 1. Chuẩn hóa Niggahita
                text = text.replace("ṁ", "ṃ").replace("Ṁ", "Ṃ")
                
                # 2. Xử lý dấu câu thông minh
                # - Xóa quotes để nối sandhi (vd: sāsanan”ti -> sāsananti)
                text = text.translate(quotes_remove)
                # - Thay dấu câu khác bằng space (vd: - -> space)
                text = text.translate(punc_space)

                # 3. Tách từ
                words = pattern.findall(text.lower())
                local_words.update(words)
    except Exception:
        pass 
    return local_words

def get_ebts_word_set(bilara_root_path: Path, books_filter: List[str]) -> Set[str]:
    # 1. Kiểm tra Cache
    if CACHE_FILE.exists():
        print(f"[cyan]Loading EBTS word set from cache ({CACHE_FILE.name})...")
        try:
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

    # 2. Lưu Cache
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    print("[cyan]Saving cache (Compressing)...")
    with gzip.open(CACHE_FILE, "wb", compresslevel=5) as f: 
        marshal.dump(list(final_word_set), f)
    
    print(f"[green]Scanned and cached {len(final_word_set)} unique words.")
    return final_word_set