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

def commit_source_changes(version_tag: str) -> bool:
    """
    Chỉ commit các thay đổi về Source Code (Version bump).
    KHÔNG commit file Zip.
    """
    logger.info("🐙 Committing source changes...")

    # 1. Chỉ add các file source có thay đổi version
    files_to_add = [
        "web/sw.js",
        "web/assets/books/sutta_loader.js",
        "web/index.html" # Nếu bạn quyết định giữ version trong HTML source (tùy chọn)
    ]

    has_changes = False
    for path in files_to_add:
        full_path = PROJECT_ROOT / path
        if full_path.exists():
            # Add file, git sẽ tự bỏ qua nếu không có thay đổi
            if _run_git_cmd(["add", path]):
                has_changes = True

    # Kiểm tra xem thực sự có gì để commit không
    status = subprocess.run(["git", "status", "--porcelain"], cwd=PROJECT_ROOT, capture_output=True, text=True)
    if not status.stdout.strip():
        logger.info("   ℹ️  No source changes to commit.")
        return True

    # 2. Commit
    commit_msg = f"chore(release): bump version to {version_tag}"
    if _run_git_cmd(["commit", "-m", commit_msg]):
        logger.info(f"   ✅ Git commit successful: '{commit_msg}'")
        return True
    
    return False

def push_changes() -> bool:
    """Đẩy commit lên remote để chuẩn bị cho GitHub Release."""
    logger.info("uwu Pushing changes to remote...")
    return _run_git_cmd(["push"])