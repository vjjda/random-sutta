#!/usr/bin/env python3
# Path: src/sutta_processor/__main__.py
import sys
import argparse
# [NEW] Import logging config
from src.logging_config import setup_logging
from .build_manager import BuildManager

def main() -> None:
    # [CHANGED] Sử dụng config chung
    setup_logging("SuttaProcessor")
    
    parser = argparse.ArgumentParser(description="Sutta Data Processor")
    parser.add_argument("-d", "--dry-run", action="store_true", help="Run in dry-run mode")
    
    args = parser.parse_args()
    
    try:
        manager = BuildManager(dry_run=args.dry_run)
        manager.run()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)
    except Exception as e:
        logging.error(f"❌ Fatal Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()