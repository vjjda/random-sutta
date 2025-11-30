#!/usr/bin/env python3
# Path: src/release.py
import os
import sys
import zipfile
from pathlib import Path

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

def main():
    # 1. Xử lý tham số đầu vào (Arguments)
    if len(sys.argv) < 2:
        print("❌ Error: Missing version number.")
        print("   Usage: python3 src/release.py <version>")
        print("   Example: python3 src/release.py 1.0")
        sys.exit(1)

    input_version = sys.argv[1]
    
    # Tự động thêm tiền tố 'v' nếu chưa có (để đúng chuẩn random-sutta-v1.0)
    if not input_version.startswith("v"):
        version_tag = f"v{input_version}"
    else:
        version_tag = input_version

    print(f"📦 Starting release build for {APP_NAME} {version_tag}...")

    # 2. Kiểm tra dữ liệu đầu vào
    # Kiểm tra file loader quan trọng xem đã build chưa
    if not (WEB_DIR / "assets" / "sutta" / "sutta_loader.js").exists():
        print("❌ Error: Sutta data not found! Please run 'python -m src.sutta_processor' first.")
        sys.exit(1)

    # 3. Tạo thư mục release (nếu chưa có)
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)
        print(f"   Created directory: {RELEASE_DIR}")

    # 4. Định nghĩa tên file zip
    zip_filename = RELEASE_DIR / f"{APP_NAME}-{version_tag}.zip"
    
    # Xóa file cũ nếu tồn tại để tránh lỗi ghi đè
    if zip_filename.exists():
        os.remove(zip_filename)

    # 5. Thực hiện nén
    print(f"   Zipping content from '{WEB_DIR.name}' into '{APP_NAME}/'...")
    
    try:
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
            # Duyệt qua toàn bộ file trong thư mục web
            for root, dirs, files in os.walk(WEB_DIR):
                for file in files:
                    file_path = Path(root) / file
                    
                    # Bỏ qua các file rác hệ thống và cache
                    if file in [".DS_Store", "Thumbs.db"] or "__pycache__" in root:
                        continue

                    # Tính toán đường dẫn tương đối
                    # Ví dụ: /.../web/index.html -> index.html
                    relative_path = file_path.relative_to(WEB_DIR)
                    
                    # Đổi tên folder gốc trong file zip:
                    # Thay vì 'web/index.html' -> sẽ thành 'random-sutta/index.html'
                    archive_name = Path(APP_NAME) / relative_path
                    
                    zf.write(file_path, archive_name)
        
        print(f"✅ Build successful!")
        print(f"🚀 Release file ready at: {zip_filename}")
        
        # In ra kích thước file (MB)
        file_size_mb = zip_filename.stat().st_size / (1024 * 1024)
        print(f"   Size: {file_size_mb:.2f} MB")

    except Exception as e:
        print(f"❌ Error during zipping: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()