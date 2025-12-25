# Path: src/dict_builder/tools/word_extractor.py
import re

def extract_words_from_string(text: str) -> set[str]:
    """
    Tách từ từ chuỗi construction/deconstruction.
    VD: "na > a + √kaṅkh + a" -> {"na", "a", "kaṅkh"} (bỏ suffix ngắn nếu cần?)
    VD: "abbhantara + dhātu" -> {"abbhantara", "dhātu"}
    """
    if not text:
        return set()
    
    # 1. Thay thế các ký tự nối bằng khoảng trắng
    # + : nối
    # > : biến đổi
    # ; : ngăn cách (nếu có trong chuỗi thô)
    text = text.replace("+", " ").replace(">", " ").replace(";", " ")
    
    # 2. Loại bỏ ký tự đặc biệt
    # √ : Căn tố
    # \d : Số (nếu có, thường ít gặp trong construction text thuần, nhưng an toàn)
    text = text.replace("√", "")
    text = re.sub(r"\d+", "", text)
    
    # 3. Split và clean
    raw_words = text.split()
    words = set()
    
    for w in raw_words:
        w = w.strip("., ")
        # Lọc rác:
        # - Phải có ít nhất 1 ký tự
        # - Không phải là ký tự đặc biệt thuần túy
        # - Có thể giữ lại các từ ngắn như 'a', 'na', 'su', 'du' (prefix)
        if len(w) > 0 and w.isalpha(): # Chỉ lấy từ chữ cái
             # Normalize? Lowercase? DPD thường dùng lowercase cho construction
             words.add(w.lower())
             
    return words
