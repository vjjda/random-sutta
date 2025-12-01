# Path: src/release.py
import os
import sys
import zipfile
import re
import logging
from pathlib import Path

# Setup logging (Console Output with Emojis)
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("ReleaseBuilder")

PROJECT_ROOT = Path(__file__).parent.parent
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

def update_file_content(file_path: Path, pattern: str, replacement: str) -> bool:
    """
    Tìm và thay thế nội dung trong file dựa trên regex.
    Chỉ ghi file nếu nội dung thực sự thay đổi.
    """
    if not file_path.exists():
        logger.error(f"❌ Error: {file_path.name} not found.")
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Thực hiện thay thế
        new_content = re.sub(pattern, replacement, content)

        # Kiểm tra xem có thay đổi không
        if content == new_content:
             logger.warning(f"   ⚠️ No changes detected in {file_path.name} (Pattern match failed?)")
             # Trả về True để không chặn quy trình, nhưng cảnh báo
             return True
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
            
        logger.info(f"   ✅ {file_path.name} updated.")
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def update_version_tags(version_tag: str) -> bool:
    logger.info(f"📝 Updating version to '{version_tag}'...")

    # 1. Update index.html (Asset versioning)
    if not update_file_content(
        WEB_DIR / "index.html",
        r'(assets\/.*?\.(?:js|css))(?:\?v=[^"\']*)?',
        f'\\1?v={version_tag}'
    ): return False
    
    # 2. Update sw.js (Cache Name)
    # FIX: Regex chấp nhận cả nháy đơn (') và nháy kép (")
    # Pattern: const CACHE_NAME = ["hoặc']...["hoặc'];
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

    # Check dependencies
    if not (WEB_DIR / "assets" / "sutta" / "sutta_loader.js").exists():
        logger.error("❌ Error: Sutta data not found! Please run processor first.")
        sys.exit(1)

    # Update files
    if not update_version_tags(version_tag):
        sys.exit(1)

    # Create release directory
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)

    # Prepare Zip
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