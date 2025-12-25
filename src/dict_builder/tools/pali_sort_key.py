# Path: src/dict_builder/tools/pali_sort_key.py
import re
from .pali_alphabet import pali_alphabet

# Tạo map ký tự sang số thứ tự (01, 02...) để sort chính xác
# Sử dụng zfill(2) để đảm bảo 01, 02...
letter_to_number = {char: f"{i:02d}" for i, char in enumerate(pali_alphabet)}

def pali_sort_key(word: str) -> str:
    """Chuyển đổi từ Pali thành chuỗi số để sort theo bảng chữ cái Pali."""
    if not isinstance(word, str):
        return str(word)
    
    # [FIXED] Sắp xếp keys theo độ dài giảm dần (Longest Match First)
    # Để đảm bảo 'kh' được match trước 'k', 'ḍh' trước 'ḍ', v.v.
    sorted_keys = sorted(letter_to_number.keys(), key=len, reverse=True)
    
    # Escape các ký tự đặc biệt và join lại
    pattern = "|".join(re.escape(key) for key in sorted_keys)
    
    def replace(match):
        return letter_to_number[match.group(0)]
        
    # Chuyển về lower() trước khi replace
    return re.sub(pattern, replace, word.lower())