# Path: src/sutta_processor/optimizer/io_manager.py
import json
import shutil
import logging
from pathlib import Path
from typing import Any
from .config import WEB_DB_DIR, MIRROR_DB_DIR

logger = logging.getLogger("Optimizer.IO")

class IOManager:
    def __init__(self, dry_run: bool):
        self.dry_run = dry_run

    def setup_directories(self):
        """Reset directories."""
        if MIRROR_DB_DIR.exists():
            shutil.rmtree(MIRROR_DB_DIR)
        MIRROR_DB_DIR.mkdir(parents=True)
        (MIRROR_DB_DIR / "structure").mkdir()
        (MIRROR_DB_DIR / "content").mkdir()

        if not self.dry_run:
            if WEB_DB_DIR.exists():
                shutil.rmtree(WEB_DB_DIR)
            WEB_DB_DIR.mkdir(parents=True)
            (WEB_DB_DIR / "structure").mkdir()
            (WEB_DB_DIR / "content").mkdir()
        else:
            logger.info("   🧪 Dry-run: Skipping Web DB write")

    def get_safe_name(self, relative_path: Path) -> str:
        name = relative_path.name.replace("_book.json", "").replace(".json", "")
        parts = list(relative_path.parent.parts)
        parts.append(name)
        return "_".join(parts)

    def save_dual(self, relative_path: str, data: Any):
        # 1. Mirror (Always)
        try:
            with open(MIRROR_DB_DIR / relative_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ Write Mirror Error {relative_path}: {e}")

        # 2. Web (Prod Only)
        if not self.dry_run:
            try:
                with open(WEB_DB_DIR / relative_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
            except Exception as e:
                logger.error(f"❌ Write Web Error {relative_path}: {e}")