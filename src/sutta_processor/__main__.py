# Path: src/sutta_processor/__main__.py
import logging
import sys
import argparse
from .manager import SuttaManager

if __name__ == "__main__":
    # Cấu hình Logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # Cấu hình Argument Parser
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
        print(f"\n❌ Fatal Error: {e}")
        # In full traceback để debug nếu cần
        import traceback
        traceback.print_exc()
        sys.exit(1)