# Path: src/release.py
import os
import sys
import zipfile
import re
from pathlib import Path

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

def update_file_content(file_path: Path, pattern: str, replacement: str) -> bool:
    """Helper để update nội dung file bằng Regex."""
    if not file_path.exists():
        print(f"❌ Error: {file_path.name} not found.")
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        new_content = re.sub(pattern, replacement, content)

        if content == new_content:
             print(f"   ⚠️ No changes made to {file_path.name} (Pattern not found?)")
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
            
        print(f"   ✅ {file_path.name} updated.")
        return True
    except Exception as e:
        print(f"❌ Error updating {file_path.name}: {e}")
        return False

def update_version_tags(version_tag: str):
    """
    Cập nhật version tag cho index.html VÀ sw.js
    """
    print(f"📝 Updating version to '{version_tag}'...")

    # 1. Update index.html (assets links)
    # Pattern: (assets\/.*?\.(?:js|css))(?:\?v=[^"\']*)?
    if not update_file_content(
        WEB_DIR / "index.html",
        r'(assets\/.*?\.(?:js|css))(?:\?v=[^"\']*)?',
        f'\\1?v={version_tag}'
    ): return False
    
    # 2. Update sw.js (Cache Name)
    # Pattern: const CACHE_NAME = '.*';
    # Replacement: const CACHE_NAME = 'sutta-reader-cache-{version_tag}';
    if not update_file_content(
        WEB_DIR / "sw.js",
        r"const CACHE_NAME = '.*';",
        f"const CACHE_NAME = 'sutta-reader-cache-{version_tag}';"
    ): return False

    return True

def main():
    # 1. Xử lý tham số
    if len(sys.argv) < 2:
        print("❌ Error: Missing version number.")
        print("   Usage: python3 src/release.py <version>")
        sys.exit(1)

    input_version = sys.argv[1]
    version_tag = input_version if input_version.startswith("v") else f"v{input_version}"

    print(f"📦 Starting release build for {APP_NAME} {version_tag}...")

    # 2. Kiểm tra dữ liệu
    if not (WEB_DIR / "assets" / "sutta" / "sutta_loader.js").exists():
        print("❌ Error: Sutta data not found! Please run processor first.")
        sys.exit(1)

    # 3. CẬP NHẬT VERSION (HTML & SW)
    if not update_version_tags(version_tag):
        sys.exit(1)

    # 4. Tạo thư mục release
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)

    # 5. Zip file
    zip_filename = RELEASE_DIR / f"{APP_NAME}-{version_tag}.zip"
    if zip_filename.exists():
        os.remove(zip_filename)

    print(f"   Zipping content from '{WEB_DIR.name}' into '{APP_NAME}/'...")
    
    try:
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(WEB_DIR):
                for file in files:
                    file_path = Path(root) / file
                    if file in [".DS_Store", "Thumbs.db"] or "__pycache__" in root:
                        continue
                    
                    relative_path = file_path.relative_to(WEB_DIR)
                    archive_name = Path(APP_NAME) / relative_path
                    zf.write(file_path, archive_name)
        
        print(f"✅ Build successful!")
        print(f"🚀 Release file: {zip_filename}")
    except Exception as e:
        print(f"❌ Error during zipping: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()