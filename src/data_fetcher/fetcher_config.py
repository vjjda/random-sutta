# Path: src/data_fetcher/fetcher_config.py
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple, TypedDict

# Định nghĩa kiểu dữ liệu cho Rule quét
class DiscoveryRule(TypedDict):
    path: str           # Đường dẫn tương đối từ ROOT_TEXT_DIR
    category: str       # Category gán cho các item tìm thấy (ví dụ: 'sutta')
    exclude: Set[str]   # Các folder con cần bỏ qua (không coi là Book ID)

class FetcherConfig:
    # --- Global Paths ---
    PROJECT_ROOT: Path = Path(__file__).parents[2]
    DATA_DIR: Path = PROJECT_ROOT / "data"
    CACHE_DIR: Path = Path(".cache/sc_bilara_data")

class BilaraConfig:
    # --- Paths ---
    DATA_ROOT: Path = FetcherConfig.DATA_DIR / "bilara"
    
    # [UPDATED] Trỏ thẳng vào nơi chứa text Pāli (root/pli/ms)
    # Cấu trúc: data/bilara/root/pli/ms
    ROOT_TEXT_DIR: Path = DATA_ROOT / "root" / "pli" / "ms"
    
    # --- Git Settings ---
    REPO_URL: str = "https://github.com/suttacentral/sc-data.git"
    BRANCH_NAME: str = "main"
    
    FETCH_MAPPING: Dict[str, str] = {
        "sc_bilara_data/root/pli/ms": "root/pli/ms",
        "sc_bilara_data/html/pli/ms": "html/pli/ms",
        "sc_bilara_data/html/pli/vri/vinaya": "html/pli/ms/vinaya",
        "sc_bilara_data/comment/en": "comment/en",
        "sc_bilara_data/translation/en/brahmali": "translation/en/brahmali",
        "sc_bilara_data/translation/en/kelly": "translation/en/kelly",
        "sc_bilara_data/translation/en/sujato/sutta": "translation/en/sujato/sutta",
        "structure/tree": "tree",
    }
    
    IGNORE_PATTERNS: Dict[str, List[str]] = {
        "root": ["xplayground"], 
    }

class ApiConfig:
    DATA_JSON_DIR: Path = FetcherConfig.DATA_DIR / "json"
    API_TEMPLATE: str = "https://suttacentral.net/api/suttaplex/{}"

    # --- Discovery Rules (Cơ chế thông minh) ---
    # Thay vì if/else, chúng ta khai báo các vùng cần quét
    DISCOVERY_RULES: List[DiscoveryRule] = [
        # 1. Quét folder 'sutta'. Lấy dn, mn, sn, an. Bỏ qua 'kn' (xử lý sau).
        {
            "path": "sutta", 
            "category": "sutta", 
            "exclude": {"kn"} 
        },
        # 2. Quét folder 'sutta/kn'. Lấy dhp, iti, thag...
        {
            "path": "sutta/kn", 
            "category": "sutta/kn", 
            "exclude": set() 
        },
        # 3. Quét 'vinaya'. Lấy pli-tv-bi-vb, pli-tv-kd...
        {
            "path": "vinaya", 
            "category": "vinaya", 
            "exclude": set() 
        },
        # 4. Quét 'abhidhamma'. Lấy ds, kv, patthana...
        {
            "path": "abhidhamma", 
            "category": "abhidhamma", 
            "exclude": set() 
        }
    ]

    # Các UID bổ sung không có folder tương ứng
    EXTRA_UIDS: Dict[str, str] = {
        "pli-tv-bi-pm": "vinaya",
        "pli-tv-bu-pm": "vinaya"
    }

    SUPER_TARGET_CATS: List[str] = ["sutta", "vinaya", "abhidhamma"]
    LARGE_BOOKS: Set[str] = {"dn", "mn", "sn", "an", "vinaya"}
    SYSTEM_IGNORE: Set[str] = {'xplayground', '__pycache__', '.git', '.DS_Store'}

    # Priority Order (Metadata tải trước để hiển thị sớm)
    PRIORITY_ORDER: List[Tuple[str, str]] = [
        ("sutta", "super"),
        ("dn", "sutta"),
        ("mn", "sutta"),
        ("sn", "sutta"),
        ("an", "sutta"),
        ("dhp", "sutta/kn"),
        ("vinaya", "super"),
        ("abhidhamma", "super"),
    ]

    # Config timeout...
    TIMEOUT_DEFAULT: int = 60
    TIMEOUT_SUPER: int = 120
    TIMEOUT_LARGE: int = 90

    @staticmethod
    def get_worker_count() -> int:
        return min(12, (os.cpu_count() or 1) * 2)