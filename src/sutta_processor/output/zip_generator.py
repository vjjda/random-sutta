# Path: src/sutta_processor/output/zip_generator.py
import logging
import zipfile
import os
from pathlib import Path
from ..shared.app_config import DIST_DB_DIR

logger = logging.getLogger("SuttaProcessor.Output.ZipGen")

def create_db_bundle() -> None:
    """
    Nén toàn bộ folder assets/db thành db_bundle.zip
    để Frontend tải một lần duy nhất.
    """
    if not DIST_DB_DIR.exists():
        logger.warning("⚠️ DB Directory not found, skipping zip bundle.")
        return

    zip_path = DIST_DB_DIR / "db_bundle.zip"
    
    logger.info("📦 Creating optimized DB bundle (db_bundle.zip)...")
    
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # Duyệt qua meta, content và index
            for subdir in ["meta", "content", "index"]:
                target_dir = DIST_DB_DIR / subdir
                if not target_dir.exists(): continue
                
                for file_path in target_dir.glob("*.json"):
                    # Lưu vào zip với cấu trúc: meta/mn.json
                    arcname = f"{subdir}/{file_path.name}"
                    zf.write(file_path, arcname)
        
        size_mb = zip_path.stat().st_size / (1024 * 1024)
        logger.info(f"   ✅ Bundle created: {size_mb:.2f} MB")
        
    except Exception as e:
        logger.error(f"❌ Failed to create DB bundle: {e}")