# Path: src/dict_builder/config.py
from pathlib import Path
from typing import List

class BuilderConfig:
    # --- Paths ---
    PROJECT_ROOT: Path = Path(__file__).parents[2]
    DPD_DB_PATH: Path = PROJECT_ROOT / "data" / "dpd" / "dpd.db"
    OUTPUT_DIR: Path = PROJECT_ROOT / "data" / "dpd"
    TEMPLATES_DIR: Path = Path(__file__).parent / "templates"

    # --- Settings ---
    USE_COMPRESSION: bool = False 
    EBTS_BOOKS: List[str] = [""]

    # EBTS_BOOKS: List[str] = [
    #     "an", "mn", "dn", "sn", "thag", "thig", "iti", "snp", "vbh", "pv", "ps", "ja", "tha-ap", "thi-ap", "ud", "dhp", "mnd", "dnd", "vv", "ds", "dt"
    # ]

    def __init__(self, mode: str = "mini"):
        self.mode = mode
        
        # [FIXED] Logic đặt tên file chính xác cho từng mode
        if self.mode == "tiny":
            self.DB_NAME = "dpd_tiny.db"
        elif self.mode == "full":
            self.DB_NAME = "dpd_full.db"
        else:
            self.DB_NAME = "dpd_mini.db"
            
        self.output_path = self.OUTPUT_DIR / self.DB_NAME

    @property
    def is_full_mode(self) -> bool:
        return self.mode == "full"
        
    @property
    def is_tiny_mode(self) -> bool:
        return self.mode == "tiny"