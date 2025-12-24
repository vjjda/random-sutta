# Path: src/tools/text_scanner.py
import json
from pathlib import Path
from rich import print

def get_ebts_word_set(bilara_root_path: Path, books_filter: list[str]) -> set[str]:
    """
    Quét toàn bộ file JSON trong thư mục data/bilara/root/pli/ms
    để lấy danh sách các từ (Pali word set).
    Thay thế cho make_cst_text_set/make_sc_text_set cũ.
    """
    word_set = set()
    
    if not bilara_root_path.exists():
        print(f"[red]Path not found: {bilara_root_path}")
        return word_set

    print(f"[cyan]Scanning text in {bilara_root_path}...")
    
    # Walk through directories
    for path in bilara_root_path.rglob("*.json"):
        # Lấy Book ID từ tên file (ví dụ: dn1.json -> dn1)
        book_id = path.stem.split("_")[0] # file thường là dn1_root-pli-ms.json
        
        # Chỉ xử lý các sách nằm trong danh sách EBTS (Mini mode)
        # Check startswith vì books_filter có thể là 'dn1', nhưng file là 'dn1_...'
        is_target = False
        for b in books_filter:
            if path.name.startswith(b):
                is_target = True
                break
        
        if not is_target:
            continue

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Data Bilara dạng: { "dn1:1.1": "evaṃ me sutaṃ...", ... }
                for text in data.values():
                    # Clean text cơ bản và split
                    cleaned = text.replace(".", "").replace(",", "").replace("?", "").replace("!", "").lower()
                    words = cleaned.split()
                    word_set.update(words)
        except Exception as e:
            print(f"[yellow]Error reading {path.name}: {e}")

    return word_set