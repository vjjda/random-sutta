# Path: src/release_system/logic/release_versioning.py
import logging
import json
import os
import time
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("Release.Versioning")

def get_clean_version(project_root: Path = None, bump: bool = False) -> str:
    """
    Lấy số version chuẩn (Year.DayOfYear.MinuteOfDay).
    
    Cơ chế Smart Lock:
    - Nếu bump=True: Tạo version mới và khóa trong 15 phút. 
      Nếu đã có lock < 15 phút, dùng lại lock đó để đồng bộ toàn bộ session build.
    - Nếu bump=False: Ưu tiên dùng lock hiện tại. Nếu không có lock, đọc từ package.json.
    """
    lock_file = (project_root / ".version_lock") if project_root else None
    
    # 1. Kiểm tra Lock hiện tại
    if lock_file and lock_file.exists():
        try:
            # Kiểm tra tuổi của lock file (TTL = 15 phút)
            file_age = time.time() - os.path.getmtime(lock_file)
            if file_age < 900: # 15 phút * 60 giây
                with open(lock_file, 'r') as f:
                    cached_version = f.read().strip()
                    if cached_version:
                        logger.info(f"💾 Using locked version (Age: {int(file_age)}s): {cached_version}")
                        return cached_version
            else:
                logger.info("⏳ Version lock expired, generating fresh version...")
        except Exception:
            pass

    # 2. Nếu không có lock hoặc lock hết hạn
    if bump:
        # Tạo số mới
        now = datetime.now()
        year = now.year
        day_of_year = now.timetuple().tm_yday
        minute_of_day = now.hour * 60 + now.minute
        version = f"{year}.{day_of_year}.{minute_of_day}"
        
        # Ghi vào lock
        if lock_file:
            try:
                with open(lock_file, 'w') as f:
                    f.write(version)
            except Exception: pass
        return version
    else:
        # Nếu không bump, đọc từ package.json (Source of Truth cuối cùng)
        return get_version_from_package_json(project_root)

def get_version_from_package_json(project_root: Path) -> str:
    pkg_path = project_root / "package.json"
    if pkg_path.exists():
        try:
            with open(pkg_path, 'r') as f:
                data = json.load(f)
                return data.get("version", "0.0.0")
        except Exception: pass
    return "0.0.0"

def generate_version_tag(project_root: Path = None, bump: bool = False) -> str:
    """Tạo tag v... khớp hoàn toàn với version sẽ dùng."""
    clean_v = get_clean_version(project_root, bump=bump)
    return f"v{clean_v}"

def clear_version_lock(project_root: Path):
    """Xóa lock file thủ công."""
    lock_file = project_root / ".version_lock"
    if lock_file.exists():
        lock_file.unlink()
        logger.info("🧹 Version lock cleared.")
