# Path: src/dict_builder/tools/deconstructed_words.py
from src.dict_builder.db.models import Lookup
from src.dict_builder.tools.word_extractor import extract_words_from_string

def get_components_from_deconstructions(session, target_keys: set[str] = None) -> set[str]:
    """
    Lấy danh sách các từ thành phần từ bảng deconstructions.
    Nếu target_keys được cung cấp, chỉ quét các từ nằm trong đó.
    """
    query = session.query(Lookup).filter(Lookup.deconstructor != "")
    
    if target_keys:
        # Chia nhỏ query nếu danh sách quá lớn, hoặc load hết rồi filter python?
        # SQLite limit variable number is usually 999 or 32766. target_keys can be huge (60k).
        # Better to iterate or fetch in chunks if using IN clause.
        # But here we might just fetch all and filter in python if the table isn't massive (Lookup is big).
        # Or, inverted: iterate target_keys and fetch? No, too many queries.
        
        # Strategy: Fetch keys and deconstructors, then filter.
        # Or don't filter at DB level if we assume we are scanning iteratively.
        pass

    results = query.yield_per(10000)
    words = set()
    
    for r in results:
        if target_keys and r.lookup_key not in target_keys:
            continue
            
        # r.deconstructor_unpack_list is a list of strings like ["a + b", "a + c"]
        parts_list = r.deconstructor_unpack_list
        for part_str in parts_list:
            extracted = extract_words_from_string(part_str)
            words.update(extracted)
            
    return words