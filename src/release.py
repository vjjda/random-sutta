#!/usr/bin/env python3
# Path: src/release.py
import os
import sys
import zipfile
import shutil
from pathlib import Path

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"
VERSION = "v1.0" # Bạn có thể đổi version ở đây

def main():
    print(f"📦 Starting release build for {APP_NAME} {VERSION}...")

    # 1. Kiểm tra dữ liệu đầu vào
    if not (WEB_DIR / "assets" / "sutta" / "sutta_loader.js").exists():
        print("❌ Error: Sutta data not found! Please run 'python -m src.sutta_processor' first.")
        sys.exit(1)

    # 2. Tạo thư mục release (nếu chưa có)
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)
        print(f"   Created directory: {RELEASE_DIR}")

    # 3. Định nghĩa tên file zip
    zip_filename = RELEASE_DIR / f"{APP_NAME}-{VERSION}.zip"
    
    # Xóa file cũ nếu tồn tại
    if zip_filename.exists():
        os.remove(zip_filename)

    # 4. Thực hiện nén
    print(f"   Zipping content from '{WEB_DIR.name}' into '{APP_NAME}/'...")
    
    try:
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
            # Duyệt qua toàn bộ file trong thư mục web
            for root, dirs, files in os.walk(WEB_DIR):
                for file in files:
                    file_path = Path(root) / file
                    
                    # Bỏ qua các file rác hệ thống
                    if file in [".DS_Store", "Thumbs.db"] or "__pycache__" in root:
                        continue

                    # Tính toán đường dẫn tương đối
                    # Ví dụ: /.../web/index.html -> index.html
                    relative_path = file_path.relative_to(WEB_DIR)
                    
                    # Đổi tên folder gốc trong file zip:
                    # web/index.html -> random-sutta/index.html
                    archive_name = Path(APP_NAME) / relative_path
                    
                    zf.write(file_path, archive_name)
        
        print(f"✅ Build successful!")
        print(f"🚀 Release file ready at: {zip_filename}")
        print(f"   Size: {zip_filename.stat().st_size / (1024*1024):.2f} MB")

    except Exception as e:
        print(f"❌ Error during zipping: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()