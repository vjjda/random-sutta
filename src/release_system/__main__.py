#!/usr/bin/env python3
# Path: src/release_system/__main__.py
import logging
import sys
from .orchestrator import run_release_process

def setup_logging():
    logging.basicConfig(level=logging.INFO, format='%(message)s')

if __name__ == "__main__":
    setup_logging()
    try:
        run_release_process()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)