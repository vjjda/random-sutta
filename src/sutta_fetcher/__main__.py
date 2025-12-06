# Path: src/sutta_fetcher/__main__.py
import sys
from .sync_manager import run_sync

if __name__ == "__main__":
    try:
        run_sync()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)