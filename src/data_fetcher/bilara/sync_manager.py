# Path: src/data_fetcher/bilara/sync_manager.py
import sys
from src.logging_config import setup_logging
from .vcs.git_wrapper import GitWrapper
from .logic.content_manager import ContentManager

logger = setup_logging("DataFetcher.Bilara")

def run_bilara_sync() -> None:
    """Điều phối quá trình đồng bộ dữ liệu Bilara từ Git về Local."""
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
        # Không sys.exit(1) ở đây để Orchestrator có thể xử lý tiếp
        raise e