# Path: src/release_system/logic/zip_packager.py
import logging
import os
import zipfile
from pathlib import Path

from ..release_config import RELEASE_DIR, APP_NAME

logger = logging.getLogger("Release.ZipPackager")

def create_zip_from_build(build_dir: Path, version_tag: str) -> bool:
    """Nén toàn bộ thư mục build thành zip."""
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)

    zip_filename = RELEASE_DIR / f"{APP_NAME}-{version_tag}.zip"
    if zip_filename.exists():
        os.remove(zip_filename)

    logger.info(f"📦 Zipping artifacts from {build_dir.name}...")
    
    try:
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(build_dir):
                for file in files:
                    file_path = Path(root) / file
                    # Relative path bên trong zip sẽ bắt đầu từ gốc folder
                    relative_path = file_path.relative_to(build_dir)
                    
                    # Cấu trúc zip: random-sutta/index.html ...
                    archive_name = Path(APP_NAME) / relative_path
                    zf.write(file_path, archive_name)
        return True
    except Exception as e:
        logger.error(f"❌ Zip failed: {e}")
        return False

def create_db_bundle(build_dir: Path) -> bool:
    """
    [NEW] Tạo file db_bundle.zip chứa toàn bộ dữ liệu (meta + content).
    File này sẽ được dùng cho tính năng 'Download Offline' của bản Online.
    """
    db_dir = build_dir / "assets" / "db"
    if not db_dir.exists():
        logger.error(f"❌ DB directory missing: {db_dir}")
        return False

    zip_path = db_dir / "db_bundle.zip"
    logger.info("📦 Creating db_bundle.zip...")

    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf: # Dùng STORED (không nén) hoặc DEFLATED nhẹ để giải nén nhanh
            # Add meta files
            meta_dir = db_dir / "meta"
            if meta_dir.exists():
                for file in meta_dir.glob("*.json"):
                    zf.write(file, arcname=f"meta/{file.name}")
            
            # Add content files
            content_dir = db_dir / "content"
            if content_dir.exists():
                for file in content_dir.glob("*.json"):
                    zf.write(file, arcname=f"content/{file.name}")
        
        # Check size
        size_mb = zip_path.stat().st_size / (1024 * 1024)
        logger.info(f"   ✅ Created db_bundle.zip ({size_mb:.2f} MB)")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to create db_bundle.zip: {e}")
        return False