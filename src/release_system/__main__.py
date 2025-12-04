#!/usr/bin/env python3
# Path: src/release_system/__main__.py
import sys
from src.logging_config import setup_logging
from .release_orchestrator import run_release_process

if __name__ == "__main__":
    setup_logging()
    try:
        run_release_process()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)