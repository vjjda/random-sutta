# Path: src/setup_hooks.py
import os
import sys
import stat
from pathlib import Path
from logging_config import setup_logging

# Setup logger
logger = setup_logging("SetupHooks")

PROJECT_ROOT = Path(__file__).parent.parent
HOOKS_SOURCE = PROJECT_ROOT / "scripts" / "hooks"
GIT_HOOKS_DIR = PROJECT_ROOT / ".git" / "hooks"

def install_hooks():
    logger.info("🔧 Installing Git Hooks...")

    if not GIT_HOOKS_DIR.exists():
        logger.error("❌ .git directory not found. Are you in the root of the repo?")
        return

    # Danh sách các hook cần cài
    hooks_to_install = ["pre-commit"]

    for hook_name in hooks_to_install:
        source_file = HOOKS_SOURCE / hook_name
        dest_file = GIT_HOOKS_DIR / hook_name

        if not source_file.exists():
            logger.warning(f"⚠️ Source hook '{hook_name}' not found in {HOOKS_SOURCE}")
            continue

        # Cách 1: Copy file (Đơn giản, nhưng sửa source phải copy lại)
        # shutil.copy(source_file, dest_file)

        # Cách 2: Symlink (Khuyên dùng - Sửa source là hook tự cập nhật)
        try:
            if dest_file.exists():
                # Xóa file cũ/link cũ nếu có
                if dest_file.is_symlink() or dest_file.is_file():
                    os.remove(dest_file)
            
            # Tạo symlink: dest -> source
            os.symlink(source_file, dest_file)
            
            # Cấp quyền thực thi (quan trọng trên Linux/Mac)
            current_stat = os.stat(dest_file)
            os.chmod(dest_file, current_stat.st_mode | stat.S_IEXEC)
            
            logger.info(f"   ✅ Linked: {hook_name}")
        except Exception as e:
            logger.error(f"   ❌ Failed to link {hook_name}: {e}")

if __name__ == "__main__":
    install_hooks()