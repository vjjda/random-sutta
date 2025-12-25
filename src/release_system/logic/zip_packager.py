# Path: src/release_system/logic/zip_packager.py
import logging
import os
import zipfile
import json
import hashlib
from pathlib import Path

# Import cấu hình từ các module khác nhau
from src.sutta_processor.shared.app_config import DIST_DB_DIR
from ..release_config import RELEASE_DIR, APP_NAME

logger = logging.getLogger("Release.ZipPackager")

# [CONFIG] Thời gian cố định cho mọi file trong Zip (Nén đơn định)
FIXED_DATETIME = (2024, 1, 1, 0, 0, 0)

def _calculate_file_hash(file_path: Path) -> str:
    """Tính SHA-256 hash của một file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def create_zip_from_build(build_dir: Path, version_tag: str) -> bool:
    """
    Nén toàn bộ thư mục build thành zip artifact (Dùng cho Release).
    Giữ nguyên timestamp thực tế vì đây là file phân phối cuối cùng.
    """
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
                    relative_path = file_path.relative_to(build_dir)
                    archive_name = Path(APP_NAME) / relative_path
                    zf.write(file_path, archive_name)
        return True
    except Exception as e:
        logger.error(f"❌ Zip failed: {e}")
        return False

def create_db_bundle(base_dir: Path = None) -> bool:
    """
    Nén assets/db thành db_bundle.zip với Deterministic Hashing.
    Và tạo file db_manifest.json chứa hash.
    
    Args:
        base_dir: Thư mục gốc chứa assets/db (ví dụ: build/pwa). 
                  Nếu None, dùng DIST_DB_DIR (web/assets/db).
    """
    # Xác định thư mục DB đích
    if base_dir:
        db_root = base_dir / "assets" / "db"
    else:
        db_root = DIST_DB_DIR

    if not db_root.exists():
        logger.warning(f"⚠️ DB Directory not found at {db_root}, skipping bundle.")
        return False

    zip_path = db_root / "db_bundle.zip"
    manifest_path = db_root / "db_manifest.json"
    
    logger.info(f"📦 Creating deterministic DB bundle in {db_root.parent.name}/db...")
    
    try:
        # Dùng 'w' để tạo mới, ZIP_DEFLATED để nén
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            
            # Duyệt qua các thư mục con 
            for subdir in ["meta", "content", "index"]:
                target_dir = db_root / subdir
                if not target_dir.exists(): continue
                
                # [CRITICAL 1] Sort file để đảm bảo thứ tự nén luôn giống nhau (A-Z)
                files = sorted(list(target_dir.glob("*.json")))
                
                for file_path in files:
                    # Tên file trong zip (vd: meta/mn.json)
                    arcname = f"{subdir}/{file_path.name}"
                    
                    # [CRITICAL 2] Đọc nội dung binary để nén
                    with open(file_path, "rb") as f:
                        file_data = f.read()
                    
                    # [CRITICAL 3] Tạo ZipInfo thủ công với thời gian cố định
                    zinfo = zipfile.ZipInfo(filename=arcname, date_time=FIXED_DATETIME)
                    
                    # Set quyền truy cập file (rw-r--r--) cho giống nhau trên mọi OS
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
            "generated_at_ts": os.path.getmtime(zip_path)
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

def create_dpd_db_zip(base_dir: Path = None) -> bool:
    """
    Nén file dpd_mini.db thành dpd_mini.db.zip (Deterministic).
    """
    if base_dir:
        db_root = base_dir / "assets" / "db"
    else:
        db_root = DIST_DB_DIR
        
    source_db = db_root / "dpd_mini.db"
    target_zip = db_root / "dpd_mini.db.zip"
    
    if not source_db.exists():
        # [OPTIONAL] Warn only, maybe user hasn't generated dictionary yet
        logger.warning(f"⚠️ dpd_mini.db not found at {source_db}, skipping zip.")
        return False
        
    logger.info(f"📦 Zipping dpd_mini.db...")
    
    try:
        with zipfile.ZipFile(target_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            with open(source_db, "rb") as f:
                file_data = f.read()
            
            # Deterministic ZipInfo
            zinfo = zipfile.ZipInfo(filename="dpd_mini.db", date_time=FIXED_DATETIME)
            zinfo.external_attr = 0o644 << 16
            zinfo.compress_type = zipfile.ZIP_DEFLATED
            
            zf.writestr(zinfo, file_data)
            
        logger.info(f"   ✅ Created {target_zip.name} ({target_zip.stat().st_size / 1024 / 1024:.2f} MB)")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to zip dpd_mini.db: {e}")
        return False