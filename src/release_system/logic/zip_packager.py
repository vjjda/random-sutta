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