# Path: src/tools/pali_sort_key.py
import re
from .pali_alphabet import pali_alphabet

# Tạo map ký tự sang số thứ tự (01, 02...) để sort chính xác
letter_to_number = {char: f"{i:02d}" for i, char in enumerate(pali_alphabet)}

def pali_sort_key(word: str) -> str:
    """Chuyển đổi từ Pali thành chuỗi số để sort theo bảng chữ cái Pali."""
    if not isinstance(word, str):
        return str(word)
    
    # Logic thay thế ký tự bằng số thứ tự
    # Escape các ký tự đặc biệt trong bảng chữ cái (nếu có)
    pattern = "|".join(re.escape(key) for key in letter_to_number.keys())
    
    def replace(match):
        return letter_to_number[match.group(0)]
        
    return re.sub(pattern, replace, word.lower())