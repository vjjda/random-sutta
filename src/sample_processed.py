# Path: src/sample_processed.py
import json
import argparse
import sys
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
TMP_DIR = PROJECT_ROOT / "tmp"

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("Sampler")

def load_json(path: Path) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"❌ Failed to load {path.name}: {e}")
        return None

def find_book_file(book_id: str) -> Optional[Path]:
    """Tìm file json trong data/processed khớp với book_id."""
    exact_path = DATA_PROCESSED / f"{book_id}_book.json"
    if exact_path.exists():
        return exact_path
    
    for f in DATA_PROCESSED.glob(f"*{book_id}*_book.json"):
        return f
    return None

def infer_book_id(sutta_id: str, available_books: List[str]) -> Optional[str]:
    """Đoán book_id dựa trên tiền tố của sutta_id."""
    sutta_id_lower = sutta_id.lower()
    sorted_books = sorted(available_books, key=len, reverse=True)
    
    for bid in sorted_books:
        if sutta_id_lower.startswith(bid.lower()):
            return bid
    return None

# --- Logic Cắt Tỉa (Pruning) ---

def prune_structure(node: Any, target_uid: str, found_target: bool = False) -> Optional[Any]:
    """
    Đệ quy cắt tỉa cây cấu trúc.
    """
    if isinstance(node, str):
        if node == target_uid or found_target:
            return node
        return None

    if isinstance(node, list):
        new_list = []
        for item in node:
            if found_target:
                new_list.append(item)
            else:
                res = prune_structure(item, target_uid, found_target)
                if res:
                    new_list.append(res)
        return new_list if new_list else None

    if isinstance(node, dict):
        new_dict = {}
        for key, value in node.items():
            if key == target_uid:
                new_dict[key] = value 
                return new_dict

            if found_target:
                new_dict[key] = value
                continue

            res = prune_structure(value, target_uid, found_target)
            if res:
                new_dict[key] = res
        return new_dict if new_dict else None

    return None

def extract_flat_ids(node: Any) -> List[str]:
    """Lấy danh sách tất cả các ID có trong structure đã cắt tỉa."""
    ids = []
    if isinstance(node, str):
        ids.append(node)
    elif isinstance(node, list):
        for item in node:
            ids.extend(extract_flat_ids(item))
    elif isinstance(node, dict):
        for k, v in node.items():
            ids.append(k)
            ids.extend(extract_flat_ids(v))
    return ids

# --- Main Processor ---

def process_request(sutta_id: str, explicit_books: Optional[List[str]]) -> None:
    logger.info(f"🔎 Analyzing request for: {sutta_id}")
    
    # 1. Quét file sách
    all_book_files = list(DATA_PROCESSED.rglob("*_book.json"))
    book_map = {}
    for f in all_book_files:
        b_id = f.name.replace("_book.json", "")
        book_map[b_id] = f

    if not book_map:
        logger.error(f"❌ No processed books found in {DATA_PROCESSED}.")
        return
    
    # 2. Xác định Book ID
    target_book_id = None
    target_file = None

    if explicit_books:
        for b in explicit_books:
            if b in book_map:
                target_book_id = b
                target_file = book_map[b]
                break
        if not target_file:
            logger.warning(f"   ⚠️ Could not find provided books {explicit_books} in processed data.")

    if not target_file:
        inferred = infer_book_id(sutta_id, list(book_map.keys()))
        if inferred:
            target_book_id = inferred
            target_file = book_map[inferred]
            logger.info(f"   ✨ Inferred book: {target_book_id}")
        else:
            logger.error(f"   ❌ Could not infer book_id for '{sutta_id}'. Please specify with -b.")
            return

    # 3. Load Book Data
    logger.info(f"   📖 Loading book: {target_file.name}")
    book_data = load_json(target_file)
    if not book_data:
        return

    # --- [NEW] XỬ LÝ SHORTCUT ---
    # Kiểm tra xem sutta_id có phải là shortcut không trước khi tìm trong structure
    raw_meta = book_data.get("meta", {})
    target_meta_entry = raw_meta.get(sutta_id)
    
    # ID dùng để tìm kiếm trong Structure (Mặc định là sutta_id)
    structure_search_id = sutta_id
    is_shortcut = False
    
    if target_meta_entry and target_meta_entry.get("type") == "shortcut":
        parent_uid = target_meta_entry.get("parent_uid")
        if parent_uid:
            logger.info(f"   ↪️  Shortcut detected: '{sutta_id}' points to parent '{parent_uid}'")
            structure_search_id = parent_uid
            is_shortcut = True
        else:
            logger.warning(f"   ⚠️ Shortcut '{sutta_id}' found but missing 'parent_uid'.")

    # 4. Extract Structure (Pruning)
    # Tìm kiếm dựa trên structure_search_id (là Parent nếu là shortcut)
    raw_structure = book_data.get("structure", {})
    pruned_structure = prune_structure(raw_structure, structure_search_id)

    if not pruned_structure:
        logger.error(f"   ❌ ID '{structure_search_id}' not found in structure of {target_book_id}.")
        # Nếu là shortcut mà tìm parent thất bại thì báo lỗi rõ ràng
        if is_shortcut:
             logger.error(f"      (This implies parent '{structure_search_id}' of shortcut '{sutta_id}' is missing/broken)")
        return

    # 5. Extract Meta & Content
    valid_ids = set(extract_flat_ids(pruned_structure))
    
    # [IMPORTANT] Luôn thêm sutta_id gốc vào danh sách cần lấy
    # Vì nếu là shortcut, nó không nằm trong structure, nên extract_flat_ids sẽ không thấy nó.
    valid_ids.add(sutta_id)
    
    # Nếu là shortcut, thêm cả parent vào để đảm bảo lấy đủ context
    if is_shortcut:
        valid_ids.add(structure_search_id)

    # Filter Meta
    pruned_meta = {k: v for k, v in raw_meta.items() if k in valid_ids}

    # Filter Content
    # Lưu ý: Content thường nằm ở Parent (Leaf), shortcut không có content riêng.
    raw_content = book_data.get("content", {})
    
    # Lấy content của tất cả các ID liên quan (bao gồm cả parent và các anh chị em trong nhánh đó)
    pruned_content = {k: v for k, v in raw_content.items() if k in valid_ids}

    # 6. Output Generation
    output_data = {
        "source_book": target_book_id,
        "request_id": sutta_id,
        "resolved_root": structure_search_id, # ID thực tế tìm trong cây
        "is_shortcut": is_shortcut,
        "structure": pruned_structure,
        "meta": pruned_meta,
        "content": pruned_content
    }

    TMP_DIR.mkdir(exist_ok=True)
    out_filename = f"{sutta_id}-in-{target_book_id}_context.txt"
    out_path = TMP_DIR / out_filename

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"SAMPLE EXTRACT FOR: {sutta_id}\n")
        f.write(f"SOURCE BOOK: {target_book_id}\n")
        if is_shortcut:
            f.write(f"NOTE: '{sutta_id}' is a shortcut to '{structure_search_id}'\n")
        f.write("="*60 + "\n\n")
        f.write(json.dumps(output_data, indent=2, ensure_ascii=False))
    
    logger.info(f"   ✅ Sample extracted to: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Extract sample context from processed books.")
    parser.add_argument("suttas", nargs='+', help="List of Sutta IDs to extract (e.g. mn1 an1.1)")
    parser.add_argument("-b", "--books", nargs='*', help="Optional list of Book IDs to search in")
    
    args = parser.parse_args()

    if not DATA_PROCESSED.exists():
        logger.error(f"❌ Processed data directory not found at {DATA_PROCESSED}")
        sys.exit(1)

    for sid in args.suttas:
        process_request(sid, args.books)

if __name__ == "__main__":
    main()