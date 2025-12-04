# Path: src/release_system/logic/zip_packager.py
import logging
import os
import zipfile
from pathlib import Path

from ..release_config import WEB_DIR, RELEASE_DIR, APP_NAME # [UPDATED] Import

logger = logging.getLogger("Release.ZipPackager")

def create_zip(version_tag: str) -> bool:
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)

    zip_filename = RELEASE_DIR / f"{APP_NAME}-{version_tag}.zip"
    if zip_filename.exists():
        os.remove(zip_filename)

    logger.info(f"📦 Zipping to {zip_filename.name}...")
    try:
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(WEB_DIR):
                for file in files:
                    if file.endswith((".bak", ".map", ".DS_Store", "Thumbs.db")):
                        continue
                    file_path = Path(root) / file
                    relative_path = file_path.relative_to(WEB_DIR)
                    archive_name = Path(APP_NAME) / relative_path
                    zf.write(file_path, archive_name)
        return True
    except Exception as e:
        logger.error(f"❌ Zip failed: {e}")
        return False