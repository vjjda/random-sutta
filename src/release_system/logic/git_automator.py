# Path: src/release_system/logic/git_automator.py
import logging
import subprocess
from pathlib import Path
from typing import List

from ..release_config import PROJECT_ROOT

logger = logging.getLogger("Release.GitAutomator")

def _run_git_cmd(args: List[str]) -> bool:
    try:
        subprocess.run(
            ["git"] + args,
            cwd=PROJECT_ROOT,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Git Error: {' '.join(args)}\n   {e.stderr.strip()}")
        return False
    except FileNotFoundError:
        logger.error("❌ Git not found. Please install Git.")
        return False

def commit_release_artifacts(version_tag: str) -> bool:
    """
    Thực hiện add và commit các file release.
    Chỉ commit:
    1. web/sw.js (Version bump)
    2. release/ (File Zip mới)
    3. assets/books/sutta_loader.js (Nếu có thay đổi danh sách sách)
    """
    logger.info("🐙 Committing release artifacts to Git...")

    # 1. Danh sách file cần commit
    # Lưu ý: Không commit index.html hay app.bundle.js vì chúng sẽ bị cleanup
    files_to_add = [
        "web/sw.js",
        "web/assets/books/sutta_loader.js",
        f"release/{APP_NAME}-{version_tag}.zip" if 'APP_NAME' in globals() else "release/"
    ]

    # 2. Git Add
    # Add từng file/folder, ignore lỗi nếu file không thay đổi
    for path in files_to_add:
        if not _run_git_cmd(["add", path]):
            logger.warning(f"⚠️ Could not add {path} (maybe unchanged or ignored)")

    # 3. Git Commit
    commit_msg = f"release: package {version_tag}"
    if _run_git_cmd(["commit", "-m", commit_msg]):
        logger.info(f"   ✅ Git commit successful: '{commit_msg}'")
        return True
    else:
        logger.warning("   ⚠️ Nothing to commit or commit failed.")
        return False