# Path: src/dict_builder/tools/word_extractor.py
import re

def extract_words_from_string(text: str) -> set[str]:
    """
    Tách từ từ chuỗi construction/deconstruction/commentary.
    VD: "na > a + √kaṅkh + a" -> {"na", "a", "√kaṅkh", "a"}
    VD: "(VIN 2.5.7.9) <b>akaṭ'ānudhammo</b>" -> {"akaṭ'ānudhammo", ...}
    """
    if not text:
        return set()
    
    # 1. Loại bỏ HTML tags (cho commentary)
    text = re.sub(r'<[^>]+>', ' ', text)
    
    # 2. Thay thế các ký tự nối/ngăn cách bằng khoảng trắng
    text = text.replace("+", " ").replace(">", " ").replace(";", " ")
    
    # 3. Loại bỏ ký tự không mong muốn, NHƯNG GIỮ LẠI √ và dấu nháy đơn ' (cho từ Pali)
    # Loại bỏ số (ref numbers)
    text = re.sub(r"\d+", " ", text)
    # Loại bỏ các ký tự đặc biệt khác: .,()[]
    text = re.sub(r"[.,()\[\]]", " ", text)
    
    # 4. Split và clean
    raw_words = text.split()
    words = set()
    
    for w in raw_words:
        w = w.strip("'\"- ") # Strip quotes/dash
        
        if len(w) == 0:
            continue
            
        # Valid Pali word chars: a-z, āīū... (python isalpha handles unicode), plus √ and '
        # ' is used in sandhi e.g. tass'ime
        # √ is for roots
        
        # Check if it looks like a word (at least one alpha or √)
        if any(c.isalpha() or c == '√' for c in w):
             words.add(w.lower())
             
    return words