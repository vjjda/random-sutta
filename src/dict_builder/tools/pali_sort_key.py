# Path: src/dict_builder/tools/pali_sort_key.py
from .pali_alphabet import pali_alphabet

# 1. Tạo bản đồ ánh xạ ký tự sang số thứ tự (00, 01, 02...)
# Dùng zfill(2) để đảm bảo so sánh chuỗi số đúng (02 < 10).
letter_to_number = {char: f"{i:02d}" for i, char in enumerate(pali_alphabet)}

# 2. Xác định các phụ âm ghép (Digraphs) từ bảng chữ cái
# Logic tương tự file JS: tìm các ký tự có thể ghép với 'h' hoặc chính nó nằm trong bảng chữ cái có độ dài > 1
# Tuy nhiên, để chính xác tuyệt đối theo JS reference, ta định nghĩa rõ các ký tự bắt đầu của digraph.
# Trong JS: ["k", "c", "ṭ", "t", "p", "g", "j", "ḍ", "d", "b"] + "h" 
DIGRAPH_STARTS = {"k", "c", "ṭ", "t", "p", "g", "j", "ḍ", "d", "b"}

def tokenize_pali_word(word: str) -> list[str]:
    """
    Phân tách từ Pali thành các đơn vị âm vị (tokens) dùng để sắp xếp.
    Logic được port từ hàm 'tokenize' trong file cc2bda28d4f8a58b@348.js.
    
    Ví dụ: 
      "buddha" -> ['b', 'u', 'd', 'dh', 'a']
      "saṅgha" -> ['s', 'a', 'ṅ', 'gh', 'a']
    """
    tokens = []
    i = 0
    n = len(word)
    
    while i < n:
        c = word[i]
        # Lookahead: Lấy ký tự tiếp theo nếu có
        next_c = word[i+1] if i + 1 < n else ""
        
        # Kiểm tra Digraph (Phụ âm ghép)
        # Logic: Nếu ký tự hiện tại nằm trong danh sách bắt đầu digraph VÀ ký tự sau là 'h'
        if c in DIGRAPH_STARTS and next_c == "h":
            # Kiểm tra kỹ hơn: Cặp này có thực sự nằm trong bảng chữ cái Pali không?
            # (VD: 'ph' có, nhưng 'bh' có, 'kh' có...)
            candidate = c + next_c
            if candidate in letter_to_number:
                tokens.append(candidate)
                i += 2
                continue
        
        # Trường hợp ký tự đơn (hoặc ký tự không phải Pali chuẩn, vẫn giữ nguyên để xử lý sau)
        tokens.append(c)
        i += 1
        
    return tokens

def pali_sort_key(word: str) -> str:
    """
    Chuyển đổi từ Pali thành chuỗi số để sort.
    Sử dụng thuật toán Tokenization để đảm bảo độ chính xác tuyệt đối cho các phụ âm ghép.
    """
    if not isinstance(word, str):
        return str(word)
    
    # Chuyển về chữ thường để xử lý thống nhất
    clean_word = word.lower().strip()
    
    # Bước 1: Tách từ thành các token (cụm âm vị)
    tokens = tokenize_pali_word(clean_word)
    
    # Bước 2: Ánh xạ từng token sang số thứ tự
    # Nếu token không có trong bảng chữ cái (VD: số, dấu chấm, dấu cách), giữ nguyên ký tự đó
    # để đảm bảo tính ổn định (stable sort) cho các từ giống nhau chỉ khác ký tự lạ.
    mapped_tokens = []
    for t in tokens:
        val = letter_to_number.get(t)
        if val:
            mapped_tokens.append(val)
        else:
            # Với ký tự lạ, ta có thể chọn cách bỏ qua hoặc giữ nguyên.
            # Giữ nguyên giúp phân biệt 'word 1' và 'word 2'.
            mapped_tokens.append(t)
            
    return "".join(mapped_tokens)