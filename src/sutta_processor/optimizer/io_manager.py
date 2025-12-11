# Path: src/sutta_processor/optimizer/io_manager.py
import json
import shutil
import logging
from pathlib import Path
from typing import Any
from .config import (
    WEB_DB_DIR, WEB_META_DIR, WEB_CONTENT_DIR,
    MIRROR_DB_DIR, MIRROR_META_DIR, MIRROR_CONTENT_DIR
)

logger = logging.getLogger("Optimizer.IO")

class IOManager:
    def __init__(self, dry_run: bool):
        self.dry_run = dry_run

    def setup_directories(self) -> None:
        """Reset và tạo mới cấu trúc thư mục."""
        # 1. Mirror (Always Reset)
        if MIRROR_DB_DIR.exists():
            shutil.rmtree(MIRROR_DB_DIR)
        
        MIRROR_DB_DIR.mkdir(parents=True)
        MIRROR_META_DIR.mkdir()
        MIRROR_CONTENT_DIR.mkdir()

        # 2. Web (Prod Only)
        if not self.dry_run:
            if WEB_DB_DIR.exists():
                shutil.rmtree(WEB_DB_DIR)
            
            WEB_DB_DIR.mkdir(parents=True)
            WEB_META_DIR.mkdir()
            WEB_CONTENT_DIR.mkdir()
        else:
            logger.info("   🧪 Dry-run: Skipping Web DB write")

    def get_safe_name(self, relative_path: Path) -> str:
        name = relative_path.name.replace("_book.json", "").replace(".json", "")
        parts = list(relative_path.parent.parts)
        parts.append(name)
        return "_".join(parts)

    def save_category(self, category: str, filename: str, data: Any) -> None:
        """
        Lưu file vào category tương ứng ('meta', 'content', hoặc 'root').
        category='root' sẽ lưu trực tiếp vào thư mục db/ (ví dụ uid_index.json).
        """
        # Xác định target path
        mirror_target = None
        web_target = None

        if category == "meta":
            mirror_target = MIRROR_META_DIR / filename
            web_target = WEB_META_DIR / filename
        elif category == "content":
            mirror_target = MIRROR_CONTENT_DIR / filename
            web_target = WEB_CONTENT_DIR / filename
        else: # root
            mirror_target = MIRROR_DB_DIR / filename
            web_target = WEB_DB_DIR / filename

        # 1. Write Mirror (Pretty Print - Dễ đọc)
        try:
            if not mirror_target.parent.exists():
                mirror_target.parent.mkdir(parents=True, exist_ok=True)
                
            with open(mirror_target, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ Write Mirror Error {filename}: {e}")

        # 2. Write Web (Production - Minified tối đa)
        if not self.dry_run and web_target:
            try:
                if not web_target.parent.exists():
                    web_target.parent.mkdir(parents=True, exist_ok=True)
                    
                with open(web_target, "w", encoding="utf-8") as f:
                    # [OPTIMIZED] Luôn dùng separators chặt chẽ cho cả Meta và Content
                    # separators=(',', ':') loại bỏ khoảng trắng sau dấu phẩy và hai chấm
                    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
            except Exception as e:
                logger.error(f"❌ Write Web Error {filename}: {e}")