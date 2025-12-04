#!/usr/bin/env python3
# Path: src/release_system/__main__.py
import sys
import argparse
from src.logging_config import setup_logging
from .release_orchestrator import run_release_process

def main():
    setup_logging()
    
    parser = argparse.ArgumentParser(description="Random Sutta Release Builder")
    
    parser.add_argument(
        "-g", "--git", 
        action="store_true", 
        help="Commit source changes (version bump) only."
    )
    
    # [CHANGED] Đổi cờ -f thành -p cho đúng ngữ nghĩa
    parser.add_argument(
        "-p", "--publish", 
        action="store_true", 
        help="Full Release: Commit source -> Push -> GitHub Release (Upload generated Zip)."
    )
    
    args = parser.parse_args()

    try:
        # Nếu dùng -p thì tự động bật logic git
        run_release_process(enable_git=args.git, publish_gh=args.publish)
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()