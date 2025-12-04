# Path: src/sutta_fetcher/sync_manager.py
import sys
# [NEW] Import logging config
from src.logging_config import setup_logging

# Import nội bộ
from .vcs.git_wrapper import GitWrapper
from .logic.content_manager import ContentManager

# [CHANGED] Init logger
logger = setup_logging("SuttaFetcher.SyncManager")

def run_sync():
    """Hàm điều phối quá trình đồng bộ dữ liệu từ Git về Local."""
    try:
        # 1. Sync Git Repo
        git_manager = GitWrapper()
        git_manager.sync_repo()
        
        # 2. Process Files
        content_manager = ContentManager()
        content_manager.clean_destination()
        content_manager.copy_data()
        
        logger.info("✨ Sutta Data Sync completed successfully.")
        
    except Exception as e:
        logger.error(f"❌ Critical Error: {e}")
        sys.exit(1)