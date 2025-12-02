#!/usr/bin/env python3
# Path: src/sutta_fetcher/__main__.py
import sys
from .orchestrator import orchestrate_fetch

if __name__ == "__main__":
    try:
        orchestrate_fetch()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)