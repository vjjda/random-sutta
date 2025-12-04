# Path: src/release_system/logic/github_publisher.py
import logging
import subprocess
import shutil
from pathlib import Path

from ..release_config import PROJECT_ROOT, APP_NAME

logger = logging.getLogger("Release.GitHubPublisher")

def _check_gh_cli() -> bool:
    """Kiểm tra xem 'gh' CLI đã được cài đặt và đăng nhập chưa."""
    if not shutil.which("gh"):
        logger.error("❌ GitHub CLI ('gh') not found. Please install it: https://cli.github.com/")
        return False
    
    try:
        # Kiểm tra trạng thái auth
        subprocess.run(
            ["gh", "auth", "status"], 
            cwd=PROJECT_ROOT, 
            check=True, 
            stdout=subprocess.DEVNULL, 
            stderr=subprocess.DEVNULL
        )
        return True
    except subprocess.CalledProcessError:
        logger.error("❌ You are not logged into GitHub CLI. Run 'gh auth login'.")
        return False

def publish_release(version_tag: str) -> bool:
    """
    Tạo GitHub Release và upload file zip.
    Lệnh tương đương: gh release create v1.0 release/app-v1.0.zip --title "v1.0" --notes "Auto release"
    """
    if not _check_gh_cli():
        return False

    zip_path = f"release/{APP_NAME}-{version_tag}.zip"
    full_zip_path = PROJECT_ROOT / zip_path

    if not full_zip_path.exists():
        logger.error(f"❌ Artifact not found: {zip_path}")
        return False

    logger.info(f"🚀 Publishing Release {version_tag} to GitHub...")

    cmd = [
        "gh", "release", "create", version_tag,
        str(zip_path),
        "--title", f"Release {version_tag}",
        "--generate-notes" # Tự động sinh release notes từ commit
    ]

    try:
        subprocess.run(
            cmd,
            cwd=PROJECT_ROOT,
            check=True,
            text=True
        )
        logger.info(f"   ✅ Release {version_tag} published successfully!")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Failed to publish release: {e}")
        return False