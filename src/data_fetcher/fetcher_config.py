# Path: src/data_fetcher/fetcher_config.py
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple

class FetcherConfig:
    # --- Global Paths ---
    # File này nằm ở src/data_fetcher/fetcher_config.py -> parents[2] là Project Root
    PROJECT_ROOT: Path = Path(__file__).parents[2]
    DATA_DIR: Path = PROJECT_ROOT / "data"
    
    # Cache Git
    CACHE_DIR: Path = Path(".cache/sc_bilara_data")


class BilaraConfig:
    # --- Paths ---
    # Thư mục gốc chứa toàn bộ data Bilara sau khi sync
    DATA_ROOT: Path = FetcherConfig.DATA_DIR / "bilara"
    
    # [NEW] Thư mục chứa text gốc (root texts) dùng để API scan danh sách sách
    # Tương đương: data/bilara/root
    ROOT_TEXT_DIR: Path = DATA_ROOT / "root"
    
    # --- Git Settings ---
    REPO_URL: str = "https://github.com/suttacentral/sc-data.git"
    BRANCH_NAME: str = "main"
    
    # --- Sparse Checkout Mapping (Source Repo -> Local Destination) ---
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

    # --- Ignore Patterns ---
    IGNORE_PATTERNS: Dict[str, List[str]] = {
        "root": ["xplayground"], 
    }


class ApiConfig:
    # --- Paths ---
    DATA_JSON_DIR: Path = FetcherConfig.DATA_DIR / "json"
    
    # --- Endpoints ---
    API_TEMPLATE: str = "https://suttacentral.net/api/suttaplex/{}"

    # --- Timeouts (Seconds) ---
    TIMEOUT_DEFAULT: int = 60
    TIMEOUT_SUPER: int = 120
    TIMEOUT_LARGE: int = 90

    # --- Discovery Logic ---
    # Các UID đặc biệt cần xử lý thủ công
    EXTRA_UIDS: Dict[str, str] = {
        "pli-tv-bi-pm": "vinaya",
        "pli-tv-bu-pm": "vinaya"
    }

    # Những category được coi là "Super" (lớn/quan trọng)
    SUPER_TARGET_CATS: List[str] = ["sutta", "vinaya", "abhidhamma"]
    
    # Những sách có kích thước lớn cần timeout cao hơn
    LARGE_BOOKS: Set[str] = {"dn", "mn", "sn", "an"}

    # Thứ tự ưu tiên tải xuống (Book ID, Category)
    PRIORITY_ORDER: List[Tuple[str, str]] = [
        ("sutta", "super"),
        ("sn", "sutta"),
        ("an", "sutta"),
        ("vinaya", "super"),
        ("mn", "sutta"),
        ("thag", "sutta/kn"),
        ("tha-ap", "sutta/kn"),
        ("ja", "sutta/kn"),
        ("abhidhamma", "super"),
    ]
    
    # Những file/thư mục hệ thống cần bỏ qua khi scan thư mục
    SYSTEM_IGNORE: Set[str] = {'xplayground', '__pycache__', '.git', '.DS_Store'}

    # --- Concurrency ---
    # Tự động tính toán số luồng dựa trên CPU
    @staticmethod
    def get_worker_count() -> int:
        return min(12, (os.cpu_count() or 1) * 2)