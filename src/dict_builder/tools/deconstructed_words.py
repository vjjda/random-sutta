# Path: src/dict_builder/tools/deconstructed_words.py
from src.dict_builder.db.models import Lookup

def make_words_in_deconstructions(session):
    """Lấy danh sách tất cả các từ xuất hiện trong phân tách từ ghép."""
    # Lấy các entry có deconstructor
    results = session.query(Lookup).filter(Lookup.deconstructor != "").all()
    words = set()
    for r in results:
        # Giả sử format deconstructor_unpack là "word1 + word2" hoặc list
        # Trong model mới ta đã có property deconstructor_unpack_list
        parts = r.deconstructor_unpack_list
        words.update(parts)
    return words