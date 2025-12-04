#!/usr/bin/env python3
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
    # Pattern: {book_id}_book.json hoặc các biến thể
    # Ưu tiên tìm chính xác
    exact_path = DATA_PROCESSED / f"{book_id}_book.json"
    if exact_path.exists():
        return exact_path
    
    # Tìm kiếm rộng hơn nếu cần (ví dụ file tên vinaya_pli-tv-bi-pm_book.json)
    for f in DATA_PROCESSED.glob(f"*{book_id}*_book.json"):
        return f
    
    return None

def infer_book_id(sutta_id: str, available_books: List[str]) -> Optional[str]:
    """Đoán book_id dựa trên tiền tố của sutta_id."""
    sutta_id_lower = sutta_id.lower()
    # Sắp xếp available books theo độ dài giảm dần để match chính xác nhất
    # Ví dụ: match 'pli-tv-bi-vb' trước 'pli-tv'
    sorted_books = sorted(available_books, key=len, reverse=True)
    
    for bid in sorted_books:
        if sutta_id_lower.startswith(bid.lower()):
            return bid
    return None

# --- Logic Cắt Tỉa (Pruning) ---

def prune_structure(node: Any, target_uid: str, found_target: bool = False) -> Optional[Any]:
    """
    Đệ quy cắt tỉa cây cấu trúc.
    - Giữ lại đường dẫn cha -> con đến target_uid.
    - Giữ lại toàn bộ cây con cháu của target_uid.
    """
    # 1. Nếu node hiện tại chính là target (Leaf string hoặc Key trong Dict)
    # Logic này được xử lý bên trong các block if/else bên dưới
    
    if isinstance(node, str):
        # Leaf node
        if node == target_uid or found_target:
            return node
        return None

    if isinstance(node, list):
        # List node (thường là danh sách con của một branch)
        new_list = []
        for item in node:
            # Nếu đã tìm thấy target ở cấp cao hơn, giữ lại toàn bộ con cháu
            if found_target:
                new_list.append(item)
            else:
                # Nếu chưa, tiếp tục tìm kiếm
                res = prune_structure(item, target_uid, found_target)
                if res:
                    new_list.append(res)
        return new_list if new_list else None

    if isinstance(node, dict):
        new_dict = {}
        for key, value in node.items():
            # Case A: Key chính là target (Branch này là cái ta cần tìm)
            if key == target_uid:
                # Giữ lại key này và TOÀN BỘ nội dung bên trong nó (found_target=True)
                # Lưu ý: Ta vẫn gọi đệ quy để copy structure, nhưng cờ True sẽ kích hoạt việc copy hết.
                # Hoặc đơn giản là return cả dict này nếu cấu trúc đơn giản.
                # Để an toàn và nhất quán, ta tái tạo lại dict.
                new_dict[key] = value # Lấy nguyên khối
                # (Nếu muốn filter sâu hơn trong con cháu thì phải đệ quy, nhưng yêu cầu là lấy hết con cháu)
                return new_dict

            # Case B: Đã tìm thấy ở trên, đang copy xuống dưới
            if found_target:
                new_dict[key] = value
                continue

            # Case C: Chưa tìm thấy, đi sâu vào tìm
            res = prune_structure(value, target_uid, found_target)
            if res:
                new_dict[key] = res
        
        return new_dict if new_dict else None

    return None

def extract_flat_ids(node: Any) -> List[str]:
    """Lấy danh sách tất cả các ID có trong structure đã cắt tỉa để lọc meta/content."""
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
    
    # 1. [FIX] Dùng rglob để quét đệ quy vào các thư mục con (sutta/, vinaya/...)
    all_book_files = list(DATA_PROCESSED.rglob("*_book.json"))
    
    # Map: book_id -> file_path
    book_map = {}
    for f in all_book_files:
        # Lấy tên file gốc: "an_book.json" -> "an"
        # "pli-tv-bi-pm_book.json" -> "pli-tv-bi-pm"
        # Logic cũ dùng split('_')[-1] là rủi ro nếu tên sách có dấu gạch dưới (dù hiện tại bilara dùng gạch ngang)
        # Logic mới: Chỉ cần bỏ đuôi "_book.json" là ra ID
        b_id = f.name.replace("_book.json", "")
        book_map[b_id] = f

    if not book_map:
        logger.error(f"❌ No processed books found in {DATA_PROCESSED}. Did you run the processor?")
        return
    
    # 2. Xác định Book ID
    target_book_id = None
    target_file = None

    # Cách A: Check trong explicit books
    if explicit_books:
        for b in explicit_books:
            if b in book_map:
                # Kiểm tra sơ bộ xem sutta có vẻ thuộc book này không (optional)
                target_book_id = b
                target_file = book_map[b]
                break
        if not target_file:
            logger.warning(f"   ⚠️ Could not find provided books {explicit_books} in processed data.")

    # Cách B: Tự suy diễn
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

    # 4. Extract Structure (Pruning)
    raw_structure = book_data.get("structure", {})
    pruned_structure = prune_structure(raw_structure, sutta_id)

    if not pruned_structure:
        logger.error(f"   ❌ Sutta ID '{sutta_id}' not found in structure of {target_book_id}.")
        return

    # 5. Extract Meta & Content
    valid_ids = set(extract_flat_ids(pruned_structure))
    
    # Lấy luôn cả sutta_id gốc phòng trường hợp nó là lá và prune_structure trả về string
    valid_ids.add(sutta_id)

    raw_meta = book_data.get("meta", {})
    pruned_meta = {k: v for k, v in raw_meta.items() if k in valid_ids}

    raw_content = book_data.get("content", {})
    
    # Content thường chỉ có ở level Leaf. 
    # Nếu sutta_id là Branch, ta cần lấy content của các con cháu.
    pruned_content = {k: v for k, v in raw_content.items() if k in valid_ids}

    # 6. Output Generation
    output_data = {
        "source_book": target_book_id,
        "root_sutta": sutta_id,
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