# Path: src/release_system/logic/web_deployer.py
import logging
import shutil
import subprocess
from pathlib import Path
from ..release_config import PROJECT_ROOT

logger = logging.getLogger("Release.WebDeployer")

DIST_DIR = PROJECT_ROOT / "dist"
REPO_URL = "https://github.com/vjjda/random-sutta.git"

def _run_git_cmd(args, cwd):
    # ... (Giữ nguyên hàm này)
    try:
        subprocess.run(
            args, 
            cwd=cwd, 
            check=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Git Error in {cwd}: {e.stderr}")
        raise e

def deploy_web_to_ghpages(source_dir: Path, version_tag: str) -> bool:
    """
    Deploy từ thư mục source_dir (thường là build/dev-online) lên gh-pages.
    """
    logger.info(f"🌍 Starting Web Deployment (Source: {source_dir.name})...")

    # 1. Prepare dist folder
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    
    # Copy từ BUILD DIR (đã xử lý version) sang DIST
    shutil.copytree(
        source_dir, 
        DIST_DIR, 
        ignore=shutil.ignore_patterns(".git", ".DS_Store")
    )
    logger.info(f"   ✅ Staged content to {DIST_DIR.name}/")

    # 2. Git Magic
    try:
        _run_git_cmd(["git", "init"], cwd=DIST_DIR)
        _run_git_cmd(["git", "checkout", "-b", "gh-pages"], cwd=DIST_DIR)
        _run_git_cmd(["git", "add", "."], cwd=DIST_DIR)
        
        commit_msg = f"deploy: release {version_tag}"
        _run_git_cmd(["git", "commit", "-m", commit_msg], cwd=DIST_DIR)
        
        logger.info("   🚀 Force Pushing to remote gh-pages...")
        _run_git_cmd(["git", "push", REPO_URL, "gh-pages", "--force"], cwd=DIST_DIR)
        
        logger.info("   ✨ Deployed successfully!")
        return True

    except Exception as e:
        logger.error(f"❌ Deployment failed: {e}")
        return False