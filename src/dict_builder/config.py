# Path: src/dict_builder/config.py
from pathlib import Path
from typing import List

class BuilderConfig:
    # --- Paths ---
    PROJECT_ROOT: Path = Path(__file__).parents[2]
    DPD_DB_PATH: Path = PROJECT_ROOT / "data" / "dpd" / "dpd.db"
    OUTPUT_DIR: Path = PROJECT_ROOT / "data" / "dpd"
    DB_NAME: str = "dpd_mini.db"
    TEMPLATES_DIR: Path = Path(__file__).parent / "templates"

    # --- Settings ---
    # [NEW] Flag nén dữ liệu. False = Lưu Text thuần (dễ debug). True = Nén Zlib (nhỏ gọn).
    USE_COMPRESSION: bool = False 

    # Sách EBTS dùng để lọc khi ở chế độ Mini
    EBTS_BOOKS: List[str] = [
        "vin1", "vin2", "vin3", "vin4",
        "dn1", "dn2", "dn3",
        "mn1", "mn2", "mn3",
        "sn1", "sn2", "sn3", "sn4", "sn5",
        "an1", "an2", "an3", "an4", "an5", 
        "an6", "an7", "an8", "an9", "an10", "an11",
        "kn1", "kn2", "kn3", "kn4", "kn5", "kn8", "kn9",
    ]

    def __init__(self, mode: str = "mini"):
        self.mode = mode
        self.output_path = self.OUTPUT_DIR / self.DB_NAME

    @property
    def is_full_mode(self) -> bool:
        return self.mode == "full"