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
        help="Auto git add and commit release artifacts (SW, Loader, Zip)"
    )
    
    args = parser.parse_args()

    try:
        run_release_process(enable_git=args.git)
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()