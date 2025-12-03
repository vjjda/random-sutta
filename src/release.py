# Path: src/release.py
import os
import sys
import zipfile
import re
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("ReleaseBuilder")

PROJECT_ROOT = Path(__file__).parent.parent
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

# [UPDATED] Danh sách các file cốt lõi bắt buộc phải có
CRITICAL_ASSETS = [
    "assets/app.js",
    "assets/modules/loader.js",
    "assets/modules/router.js",
    "assets/modules/utils.js",
    "assets/modules/renderer.js",
    "assets/modules/db_manager.js",   # [NEW] Module quản lý DB
    "assets/books/sutta_loader.js"    # [CHANGED] Đường dẫn mới
]

def update_file_content(file_path: Path, pattern: str, replacement: str) -> bool:
    """
    Tìm và thay thế nội dung trong file dựa trên regex.
    """
    if not file_path.exists():
        logger.error(f"❌ Error: {file_path.name} not found.")
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Thực hiện thay thế
        new_content = re.sub(pattern, replacement, content)

        if content == new_content:
             # Cảnh báo nhẹ nếu không tìm thấy pattern
             logger.warning(f"   ⚠️ No changes in {file_path.name} (Pattern match might be updated already)")
             return True
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
            
        logger.info(f"   ✅ {file_path.name} version tags updated.")
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def check_critical_assets() -> bool:
    """Kiểm tra xem các file quan trọng có tồn tại không"""
    logger.info("🔍 Checking critical assets...")
    missing = []
    for rel_path in CRITICAL_ASSETS:
        full_path = WEB_DIR / rel_path
        if not full_path.exists():
            missing.append(rel_path)
    
    if missing:
        logger.error(f"❌ FATAL: Missing critical files: {missing}")
        return False
    return True

def update_version_tags(version_tag: str) -> bool:
    logger.info(f"📝 Updating version to '{version_tag}'...")

    # 1. Update index.html (Asset versioning)
    # Regex này bắt tất cả các file .js/.css nằm trong thư mục assets/
    if not update_file_content(
        WEB_DIR / "index.html",
        r'(assets\/.*?\.(?:js|css))(?:\?v=[^"\']*)?',
        f'\\1?v={version_tag}'
    ): return False
    
    # 2. Update sw.js (Cache Name)
    if not update_file_content(
        WEB_DIR / "sw.js",
        r'const CACHE_NAME\s*=\s*["\'].*?["\'];', 
        f'const CACHE_NAME = "sutta-reader-cache-{version_tag}";'
    ): return False

    return True

def main() -> None:
    if len(sys.argv) < 2:
        logger.error("❌ Error: Missing version number.")
        logger.info("   Usage: python3 src/release.py <version>")
        sys.exit(1)

    input_version = sys.argv[1]
    version_tag = input_version if input_version.startswith("v") else f"v{input_version}"

    logger.info(f"📦 Starting release build for {APP_NAME} {version_tag}...")

    # 1. Pre-flight Check
    if not check_critical_assets():
        sys.exit(1)

    # 2. Update versions in code
    if not update_version_tags(version_tag):
        sys.exit(1)

    # 3. Create release directory
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)

    # 4. Prepare Zip
    zip_filename = RELEASE_DIR / f"{APP_NAME}-{version_tag}.zip"
    if zip_filename.exists():
        os.remove(zip_filename)

    logger.info(f"   Zipping content from '{WEB_DIR.name}' into '{APP_NAME}/'...")
    
    try:
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(WEB_DIR):
                for file in files:
                    file_path = Path(root) / file
                    
                    # Filter junk files
                    if file in [".DS_Store", "Thumbs.db"] or "__pycache__" in root:
                        continue
                    
                    # Tính toán đường dẫn tương đối để zip không chứa full path
                    relative_path = file_path.relative_to(WEB_DIR)
                    archive_name = Path(APP_NAME) / relative_path
                    zf.write(file_path, archive_name)
        
        logger.info(f"✅ Build successful!")
        logger.info(f"🚀 Release file: {zip_filename}")
    except Exception as e:
        logger.error(f"❌ Error during zipping: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()