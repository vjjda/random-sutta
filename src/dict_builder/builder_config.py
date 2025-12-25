# Path: src/dict_builder/builder_config.py
from pathlib import Path
from typing import List

class BuilderConfig:
    # --- Paths ---
    PROJECT_ROOT: Path = Path(__file__).parents[2]
    DPD_DB_PATH: Path = PROJECT_ROOT / "data" / "dpd" / "dpd.db"
    
    # Thêm đường dẫn cho Web
    LOCAL_OUTPUT_DIR: Path = PROJECT_ROOT / "data" / "dpd"
    WEB_OUTPUT_DIR: Path = PROJECT_ROOT / "web" / "assets" / "db"
    
    TEMPLATES_DIR: Path = Path(__file__).parent / "templates"

    # --- Settings ---
    USE_COMPRESSION: bool = False 

    # --- Batch Sizes ---
    BATCH_SIZE_HEADWORDS: int = 10000
    BATCH_SIZE_DECON: int = 10000
    BATCH_SIZE_GRAMMAR: int = 10000

    # Lấy TOÀN BỘ sách
    EBTS_BOOKS: List[str] = [""]

    def __init__(self, mode: str = "mini", html_mode: bool = False, export_web: bool = False):
        self.mode = mode
        self.html_mode = html_mode
        self.export_web = export_web
        
        # Nếu là export web, bật nén và đổi output dir
        if self.export_web:
            self.USE_COMPRESSION = True
            self.OUTPUT_DIR = self.WEB_OUTPUT_DIR
        else:
            self.OUTPUT_DIR = self.LOCAL_OUTPUT_DIR
            
        prefix = "dpd_html_" if self.html_mode else "dpd_"
        
        if self.mode == "tiny":
            self.DB_NAME = f"{prefix}tiny.db"
        elif self.mode == "full":
            self.DB_NAME = f"{prefix}full.db"
        else:
            self.DB_NAME = f"{prefix}mini.db"
            
        self.output_path = self.OUTPUT_DIR / self.DB_NAME

    @property
    def is_full_mode(self) -> bool:
        return self.mode == "full"
        
    @property
    def is_tiny_mode(self) -> bool:
        return self.mode == "tiny"