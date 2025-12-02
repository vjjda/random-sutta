# Path: src/sutta_fetcher/orchestrator.py
import logging
import sys

from .vcs.git_wrapper import GitWrapper
from .logic.content_manager import ContentManager

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("SuttaFetcher.Orchestrator")

def orchestrate_fetch():
    try:
        # 1. Sync Git Repo
        git_manager = GitWrapper()
        git_manager.sync_repo()
        
        # 2. Process Files
        content_manager = ContentManager()
        content_manager.clean_destination()
        content_manager.copy_data()
        
        logger.info("✨ Sutta Data Fetch completed successfully.")
        
    except Exception as e:
        logger.error(f"❌ Critical Error: {e}")
        sys.exit(1)