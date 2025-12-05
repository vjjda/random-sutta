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
    """Commit source changes (version bump)."""
    logger.info("🐙 Committing source changes...")
    
    # [UPDATED] Thay sutta_loader.js bằng file_index.js
    files_to_add = ["web/sw.js", "web/assets/modules/file_index.js"]
    
    for path in files_to_add:
        if (PROJECT_ROOT / path).exists():
            _run_git_cmd(["add", path])

    status = subprocess.run(["git", "status", "--porcelain"], cwd=PROJECT_ROOT, capture_output=True, text=True)
    if not status.stdout.strip():
        logger.info("   ℹ️  No source changes to commit.")
        return True

    commit_msg = f"chore(release): bump version to {version_tag}"
    if _run_git_cmd(["commit", "-m", commit_msg]):
        logger.info(f"   ✅ Git committed: '{commit_msg}'")
        return True
    return False

def push_changes() -> bool:
    logger.info("⬆️  Pushing source code to remote...")
    return _run_git_cmd(["push"])