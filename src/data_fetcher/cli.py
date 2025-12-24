# Path: src/data_fetcher/cli.py
import argparse
import sys
import logging
from src.logging_config import setup_logging
from .api import run_api_fetch
from .bilara import run_bilara_sync

logger = setup_logging("DataFetcher")

def run_cli() -> None:
    parser = argparse.ArgumentParser(
        description="Random Sutta Data Fetcher (Unified Ingestion Pipeline)"
    )
    
    parser.add_argument(
        "-a", "--api", 
        action="store_true", 
        help="Fetch Metadata from SuttaCentral API"
    )
    
    parser.add_argument(
        "-s", "--sutta", 
        action="store_true", 
        help="Sync Sutta Content (Bilara) from GitHub"
    )

    args = parser.parse_args()

    # Nếu không có flag nào, hiển thị help
    if not (args.api or args.sutta):
        parser.print_help()
        sys.exit(0)

    try:
        # 1. Fetch Sutta (Content) trước vì API Discovery cần thư mục root data
        if args.sutta:
            logger.info("🔹 TRIGGERED: Sutta Content Sync (Bilara)")
            run_bilara_sync()
            print("-" * 50)

        # 2. Fetch API (Metadata) sau
        if args.api:
            logger.info("🔹 TRIGGERED: Metadata API Fetch")
            run_api_fetch()
            print("-" * 50)
            
        logger.info("🎉 All requested tasks completed.")

    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Execution failed: {e}")
        sys.exit(1)