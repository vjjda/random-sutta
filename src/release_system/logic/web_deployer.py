# Path: src/release_system/logic/web_deployer.py
import logging
import shutil
import subprocess
from pathlib import Path
from ..release_config import PROJECT_ROOT, WEB_DIR

logger = logging.getLogger("Release.WebDeployer")

# Thư mục "ma" trung gian
DIST_DIR = PROJECT_ROOT / "dist"
# Thay URL này bằng URL git thật của bạn (SSH hoặc HTTPS có token)
REPO_URL = "https://github.com/vjjda/random-sutta.git" 

def _run_git_cmd(args, cwd):
    """Chạy lệnh git trong thư mục chỉ định."""
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

def deploy_web_to_ghpages(version_tag: str) -> bool:
    logger.info(f"🌍 Starting Manual Web Deployment (v{version_tag})...")

    # 1. Clean & Prepare Ghost Folder (dist/)
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    
    # Copy source từ web/ sang dist/
    # Loại bỏ các file rác không nên public
    shutil.copytree(
        WEB_DIR, 
        DIST_DIR, 
        ignore=shutil.ignore_patterns(".git", "node_modules", ".DS_Store", "*.map", "*.scss")
    )
    logger.info(f"   ✅ Staged web content to {DIST_DIR.name}/")

    # 2. Git Magic: Biến dist thành một repo tạm thời
    try:
        # Init repo mới tinh
        _run_git_cmd(["git", "init"], cwd=DIST_DIR)
        
        # Tạo branch gh-pages (orphan - không có lịch sử cũ)
        _run_git_cmd(["git", "checkout", "-b", "gh-pages"], cwd=DIST_DIR)
        
        # Add tất cả file
        _run_git_cmd(["git", "add", "."], cwd=DIST_DIR)
        
        # Commit
        commit_msg = f"deploy: manual release {version_tag}"
        _run_git_cmd(["git", "commit", "-m", commit_msg], cwd=DIST_DIR)
        
        # Push Force: Ghi đè nhánh gh-pages trên remote
        logger.info("   🚀 Force Pushing to remote gh-pages...")
        _run_git_cmd(["git", "push", REPO_URL, "gh-pages", "--force"], cwd=DIST_DIR)
        
        logger.info("   ✨ Deployed successfully! Site should update shortly.")
        
        # (Optional) Xóa dist sau khi xong để dọn dẹp
        # shutil.rmtree(DIST_DIR) 
        
        return True

    except Exception as e:
        logger.error(f"❌ Deployment failed: {e}")
        return False