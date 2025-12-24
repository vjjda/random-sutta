# Path: src/data_fetcher/cli.py
import argparse
import sys
import logging
from src.logging_config import setup_logging
from .api import run_api_fetch
from .bilara import run_bilara_sync
from .dpd import run_dpd_fetch

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

    parser.add_argument(
        "-d", "--dpd",
        action="store_true",
        help="Fetch/Update Digital Pali Dictionary (DPD)"
    )

    args = parser.parse_args()

    # Nếu không có flag nào, hiển thị help
    if not (args.api or args.sutta or args.dpd):
        parser.print_help()
        sys.exit(0)

    try:
        # 1. Fetch DPD (Dictionary) - Độc lập, chạy đầu tiên hoặc song song
        if args.dpd:
            logger.info("🔹 TRIGGERED: DPD Dictionary Update")
            run_dpd_fetch()
            print("-" * 50)

        # 2. Fetch Sutta (Content)
        if args.sutta:
            logger.info("🔹 TRIGGERED: Sutta Content Sync (Bilara)")
            run_bilara_sync()
            print("-" * 50)

        # 3. Fetch API (Metadata) - Cần content trước để discovery
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