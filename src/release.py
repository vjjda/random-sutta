#!/usr/bin/env python3
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

def update_index_html_version(version_tag):
    """
    Tìm tất cả các file .js và .css trong assets/ và cập nhật tham số ?v=
    """
    index_path = WEB_DIR / "index.html"
    
    if not index_path.exists():
        print("❌ Error: index.html not found.")
        return False

    print(f"   📝 Updating version to '{version_tag}' in index.html...")

    try:
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Regex Explanation:
        # (assets\/.*?\.(?:js|css))  -> Group 1: Bắt đầu bằng 'assets/', tên file kết thúc bằng .js hoặc .css
        # (?:\?v=[^"\']*)?           -> Non-capturing Group: Có thể có hoặc không cụm ?v=... (cho đến khi gặp dấu nháy)
        #
        # Mục đích: Tìm "assets/style.css" hoặc "assets/style.css?v=old"
        # Thay thế bằng: "assets/style.css?v=new_version"
        
        pattern = r'(assets\/.*?\.(?:js|css))(?:\?v=[^"\']*)?'
        replacement = f'\\1?v={version_tag}'
        
        new_content = re.sub(pattern, replacement, content)

        # Ghi lại file
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(new_content)
            
        print("   ✅ index.html updated.")
        return True

    except Exception as e:
        print(f"❌ Error updating HTML: {e}")
        return False

def main():
    # 1. Xử lý tham số đầu vào
    if len(sys.argv) < 2:
        print("❌ Error: Missing version number.")
        print("   Usage: python3 src/release.py <version>")
        print("   Example: python3 src/release.py 1.0")
        sys.exit(1)

    input_version = sys.argv[1]
    
    # Chuẩn hóa version (v1.0)
    if not input_version.startswith("v"):
        version_tag = f"v{input_version}"
    else:
        version_tag = input_version

    print(f"📦 Starting release build for {APP_NAME} {version_tag}...")

    # 2. Kiểm tra dữ liệu
    if not (WEB_DIR / "assets" / "sutta" / "sutta_loader.js").exists():
        print("❌ Error: Sutta data not found! Please run 'python -m src.sutta_processor' first.")
        sys.exit(1)

    # 3. CẬP NHẬT INDEX.HTML (Bước mới)
    if not update_index_html_version(version_tag):
        sys.exit(1)

    # 4. Tạo thư mục release
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)

    # 5. Định nghĩa tên file zip
    zip_filename = RELEASE_DIR / f"{APP_NAME}-{version_tag}.zip"
    
    if zip_filename.exists():
        os.remove(zip_filename)

    # 6. Nén file
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
        print(f"🚀 Release file ready at: {zip_filename}")
        print(f"   Size: {zip_filename.stat().st_size / (1024 * 1024):.2f} MB")
        print(f"⚠️  IMPORTANT: Don't forget to commit the changes to 'web/index.html' to Git!")

    except Exception as e:
        print(f"❌ Error during zipping: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()