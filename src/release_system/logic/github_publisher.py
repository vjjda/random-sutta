# Path: src/release_system/logic/github_publisher.py
import logging
import subprocess
import shutil
from pathlib import Path

from ..release_config import PROJECT_ROOT, APP_NAME, RELEASE_DIR # [UPDATED] Import RELEASE_DIR

logger = logging.getLogger("Release.GitHubPublisher")

def _check_gh_cli() -> bool:
    if not shutil.which("gh"):
        logger.error("❌ GitHub CLI ('gh') not found.")
        return False
    return True

def publish_release(version_tag: str) -> bool:
    """
    Tạo GitHub Release và upload CHÍNH XÁC file zip vừa tạo.
    """
    if not _check_gh_cli():
        return False

    # [LOGIC] Xác định file zip dựa trên version_tag (có giây)
    # Vì version_tag là duy nhất (v2023...-123456), nên file path là duy nhất.
    zip_filename = f"{APP_NAME}-{version_tag}.zip"
    full_zip_path = RELEASE_DIR / zip_filename

    # Kiểm tra an toàn: File phải tồn tại (đã được tạo bởi zip_packager)
    if not full_zip_path.exists():
        logger.error(f"❌ Artifact not found for upload: {zip_filename}")
        return False

    logger.info(f"🚀 Publishing Release {version_tag} to GitHub...")
    logger.info(f"   📦 Uploading artifact: {zip_filename}")

    cmd = [
        "gh", "release", "create", version_tag,
        str(full_zip_path), # Chỉ upload đúng file này
        "--title", f"Release {version_tag}",
        "--generate-notes"
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