# Path: src/release_system/logic/zip_packager.py
import logging
import zipfile
import os
import json
import hashlib
from pathlib import Path
from ..shared.app_config import DIST_DB_DIR

logger = logging.getLogger("SuttaProcessor.Output.ZipGen")

# [CONFIG] Thời gian cố định cho mọi file trong Zip
# Năm, Tháng, Ngày, Giờ, Phút, Giây
FIXED_DATETIME = (2024, 1, 1, 0, 0, 0)

def _calculate_file_hash(file_path: Path) -> str:
    """Tính SHA-256 hash của một file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        # Đọc từng chunk 4KB để tránh tràn RAM với file lớn
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def create_db_bundle() -> bool:
    """
    Nén assets/db thành db_bundle.zip với Deterministic Hashing.
    Và tạo file db_manifest.json chứa hash.
    """
    if not DIST_DB_DIR.exists():
        logger.warning("⚠️ DB Directory not found, skipping zip bundle.")
        return False

    zip_path = DIST_DB_DIR / "db_bundle.zip"
    manifest_path = DIST_DB_DIR / "db_manifest.json"
    
    logger.info("📦 Creating deterministic DB bundle...")
    
    try:
        # Dùng 'w' để tạo mới, ZIP_DEFLATED để nén
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            
            # Duyệt qua các thư mục con
            for subdir in ["meta", "content", "index"]:
                target_dir = DIST_DB_DIR / subdir
                if not target_dir.exists(): continue
                
                # [CRITICAL 1] Sort file để đảm bảo thứ tự nén luôn giống nhau (A-Z)
                # Nếu không sort, thứ tự file có thể ngẫu nhiên tùy OS -> Sai Hash
                files = sorted(list(target_dir.glob("*.json")))
                
                for file_path in files:
                    # Tên file trong zip (vd: meta/mn.json)
                    arcname = f"{subdir}/{file_path.name}"
                    
                    # [CRITICAL 2] Đọc nội dung binary để nén
                    with open(file_path, "rb") as f:
                        file_data = f.read()
                    
                    # [CRITICAL 3] Tạo ZipInfo thủ công với thời gian cố định
                    # Thay vì dùng zf.write(path) (sẽ lấy giờ hệ thống)
                    zinfo = zipfile.ZipInfo(filename=arcname, date_time=FIXED_DATETIME)
                    
                    # Set quyền truy cập file (rw-r--r--) cho giống nhau trên mọi OS (Win/Lin/Mac)
                    zinfo.external_attr = 0o644 << 16 
                    zinfo.compress_type = zipfile.ZIP_DEFLATED
                    
                    # Ghi data vào zip bằng writestr
                    zf.writestr(zinfo, file_data)
        
        # Check size
        size_mb = zip_path.stat().st_size / (1024 * 1024)
        
        # 2. Generate Hash & Manifest
        file_hash = _calculate_file_hash(zip_path)
        
        manifest_data = {
            "hash": file_hash,
            "size_bytes": zip_path.stat().st_size,
            "generated_at_ts": os.path.getmtime(zip_path) # Timestamp thực tế để debug
        }
        
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)

        logger.info(f"   ✅ Bundle created: {size_mb:.2f} MB")
        logger.info(f"   ✅ Manifest generated: {file_hash[:12]}...")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to create DB bundle: {e}")
        import traceback
        traceback.print_exc()
        return False