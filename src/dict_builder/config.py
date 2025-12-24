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