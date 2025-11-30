# Path: src/sutta_processor/__main__.py
import logging
import sys
from .manager import SuttaManager

if __name__ == "__main__":
    # Setup simple logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    
    try:
        manager = SuttaManager()
        manager.run()
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Fatal Error: {e}")
        sys.exit(1)