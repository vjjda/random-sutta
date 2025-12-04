#!/usr/bin/env python3
# Path: src/release_system/__main__.py
import sys
# [NEW] Import logging config
from src.logging_config import setup_logging
from .orchestrator import run_release_process

if __name__ == "__main__":
    # [CHANGED] Gọi setup một lần ở entrypoint
    setup_logging() 
    try:
        run_release_process()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)