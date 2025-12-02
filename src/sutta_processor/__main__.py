#!/usr/bin/env python3
# Path: src/sutta_processor/__main__.py
import logging
import sys
import argparse
from .manager import SuttaManager

def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )

def main() -> None:
    setup_logging()
    
    parser = argparse.ArgumentParser(description="Sutta Data Processor")
    parser.add_argument(
        "-d", "--dry-run", 
        action="store_true", 
        help="Run in dry-run mode: Output prettified JSON to data/processed without affecting web assets."
    )
    
    args = parser.parse_args()
    
    try:
        manager = SuttaManager(dry_run=args.dry_run)
        manager.run()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)
    except Exception as e:
        logging.error(f"❌ Fatal Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()