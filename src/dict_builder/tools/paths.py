# Path: src/dict_builder/tools/paths.py
from pathlib import Path
import os

class ProjectPaths:
    def __init__(self):
        # Giả định script chạy từ root dự án
        self.base_dir = Path(os.getcwd())
        # [UPDATED] Trỏ vào data/dpd/dpd.db
        self.dpd_db_path = self.base_dir / "data" / "dpd" / "dpd.db"