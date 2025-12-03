# Path: src/release.py
import os
import sys
import zipfile
import re
import logging
import shutil
import subprocess
from pathlib import Path
from typing import List

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("ReleaseBuilder")

PROJECT_ROOT = Path(__file__).parent.parent
WEB_DIR = PROJECT_ROOT / "web"
RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

# Thứ tự ghép file cực kỳ quan trọng (File được import phải đứng trước file import nó)
BUNDLE_ORDER = [
    "assets/modules/constants.js",
    "assets/modules/db_manager.js", # Độc lập
    "assets/modules/utils.js",      # Dùng DB
    "assets/modules/router.js",
    "assets/modules/loader.js",     # Dùng Constants
    "assets/modules/filters.js",    # Dùng Router, Constants
    "assets/modules/search_component.js",
    "assets/modules/renderer.js",   # Dùng DB, Utils
    "assets/app.js"                 # Entry Point
]

CRITICAL_ASSETS = BUNDLE_ORDER + ["assets/books/sutta_loader.js"]

def get_git_version() -> str:
    """Lấy short hash từ git commit gần nhất."""
    try:
        hash_tag = subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'], 
            stderr=subprocess.STDOUT
        ).decode().strip()
        return f"v{hash_tag}"
    except Exception:
        logger.warning("⚠️ Cannot get git version (Git not found or not a repo). Using 'dev-build'.")
        return "v-dev"

def check_critical_assets():
    """Kiểm tra file nguồn có đủ không."""
    logger.info("🔍 Checking source assets...")
    missing = []
    for rel_path in CRITICAL_ASSETS:
        full_path = WEB_DIR / rel_path
        if not full_path.exists():
            missing.append(rel_path)
    
    if missing:
        logger.error(f"❌ FATAL: Missing source files: {missing}")
        return False
    return True

def bundle_javascript() -> bool:
    """
    Gộp các file ES Modules thành một file app.bundle.js duy nhất.
    Loại bỏ từ khóa 'import' và 'export' để chạy được trên file://
    """
    logger.info("🧶 Bundling JavaScript modules...")
    bundle_path = WEB_DIR / "assets" / "app.bundle.js"
    
    try:
        combined_content = ["// Bundled for Offline Use (file:// protocol)"]
        
        for rel_path in BUNDLE_ORDER:
            file_path = WEB_DIR / rel_path
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                
            file_content = []
            for line in lines:
                # 1. Bỏ dòng import
                if line.strip().startswith("import "):
                    continue
                
                # 2. Xóa từ khóa export (giữ lại phần khai báo sau đó)
                # "export const X" -> "const X"
                # "export function Y" -> "function Y"
                line = re.sub(r'^export\s+', '', line)
                
                file_content.append(line)
            
            combined_content.append(f"\n// --- Source: {rel_path} ---")
            combined_content.append("".join(file_content))

        with open(bundle_path, "w", encoding="utf-8") as f:
            f.write("\n".join(combined_content))
            
        logger.info(f"   ✅ Created bundle: {bundle_path.name}")
        return True
    except Exception as e:
        logger.error(f"❌ Bundling failed: {e}")
        return False

def update_file_content(file_path: Path, pattern: str, replacement: str) -> bool:
    if not file_path.exists(): return False
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        new_content = re.sub(pattern, replacement, content)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    except Exception as e:
        logger.error(f"❌ Error updating {file_path.name}: {e}")
        return False

def prepare_html_for_release(version_tag: str) -> bool:
    """
    Sửa index.html để:
    1. Trỏ tới app.bundle.js thay vì app.js
    2. Bỏ type="module"
    3. Thêm version tag
    """
    logger.info("📝 Updating index.html for release...")
    index_path = WEB_DIR / "index.html"
    
    # Backup file gốc trước khi sửa
    shutil.copy(index_path, str(index_path) + ".bak")
    
    # 1. Thay thế Entry Point
    # Tìm: <script type="module" src="assets/app.js..."></script>
    # Thay bằng: <script src="assets/app.bundle.js?v=..."></script>
    success = update_file_content(
        index_path,
        r'<script type="module" src="assets/app.js.*"></script>',
        f'<script src="assets/app.bundle.js?v={version_tag}"></script>'
    )
    
    if not success: return False

    # 2. Update version cho CSS và các file JS khác (nếu còn)
    update_file_content(
        index_path,
        r'(assets\/.*?\.(?:css|js))(?:\?v=[^"\']*)?',
        f'\\1?v={version_tag}'
    )
    
    return True

def update_service_worker(version_tag: str):
    # Cập nhật cache name và thêm bundle vào danh sách cache
    sw_path = WEB_DIR / "sw.js"
    
    # 1. Update Version
    update_file_content(
        sw_path,
        r'const CACHE_NAME\s*=\s*["\'].*?["\'];', 
        f'const CACHE_NAME = "sutta-reader-cache-{version_tag}";'
    )
    
    # 2. (Optional) Đảm bảo sw.js cache app.bundle.js thay vì app.js (nếu list hardcode)
    # Vì logic trong sw.js thường dùng CORE_ASSETS, ta cần đảm bảo logic đó đúng.
    # Trong script này, ta tạm thời không can thiệp sâu vào array content của SW
    # mà giả định SW cache tất cả file trong thư mục build.
    pass

def create_zip(version_tag: str):
    if not RELEASE_DIR.exists():
        RELEASE_DIR.mkdir(parents=True)

    zip_filename = RELEASE_DIR / f"{APP_NAME}-{version_tag}.zip"
    if zip_filename.exists():
        os.remove(zip_filename)

    logger.info(f"📦 Zipping to {zip_filename.name}...")
    
    try:
        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(WEB_DIR):
                for file in files:
                    # Bỏ qua file backup và file nguồn modules lẻ (vì đã bundle)
                    if file.endswith(".bak") or file.endswith(".map"):
                        continue
                    
                    # Không zip thư mục modules gốc nữa để file zip gọn nhẹ (Optional)
                    # Nếu muốn zip gọn: if "assets/modules" in root: continue
                    # Nhưng để an toàn cứ giữ lại cũng được.
                    
                    file_path = Path(root) / file
                    
                    # Filter junk
                    if file in [".DS_Store", "Thumbs.db"]:
                        continue
                    
                    relative_path = file_path.relative_to(WEB_DIR)
                    archive_name = Path(APP_NAME) / relative_path
                    zf.write(file_path, archive_name)
        return True
    except Exception as e:
        logger.error(f"❌ Zip failed: {e}")
        return False

def cleanup():
    """Khôi phục môi trường Dev."""
    logger.info("🧹 Cleaning up...")
    
    # 1. Xóa bundle
    bundle_path = WEB_DIR / "assets" / "app.bundle.js"
    if bundle_path.exists():
        os.remove(bundle_path)
        
    # 2. Khôi phục index.html
    index_path = WEB_DIR / "index.html"
    backup_path = index_path.with_name("index.html.bak")
    if backup_path.exists():
        shutil.move(backup_path, index_path)
        logger.info("   ✅ Restored index.html to dev mode.")

def main():
    # 1. Determine Version
    if len(sys.argv) > 1:
        version_tag = sys.argv[1]
    else:
        version_tag = get_git_version()
        
    if not version_tag.startswith("v"):
        version_tag = f"v{version_tag}"

    logger.info(f"🚀 STARTING RELEASE BUILD: {version_tag}")

    if not check_critical_assets():
        sys.exit(1)

    try:
        # 2. Create Bundle
        if not bundle_javascript():
            raise Exception("Bundling failed")

        # 3. Prepare HTML (Switch to bundle)
        if not prepare_html_for_release(version_tag):
            raise Exception("HTML prep failed")
            
        # 4. Update SW
        update_service_worker(version_tag)

        # 5. Zip
        if create_zip(version_tag):
            logger.info("✨ BUILD SUCCESSFUL!")
            
    except Exception as e:
        logger.error(f"❌ BUILD FAILED: {e}")
    finally:
        # 6. Always cleanup to keep dev env clean
        cleanup()

if __name__ == "__main__":
    main()