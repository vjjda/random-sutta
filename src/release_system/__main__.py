# Path: src/release_system/__main__.py
import sys
import argparse
from src.logging_config import setup_logging
from .release_orchestrator import run_release_process

def main():
    setup_logging()
    
    parser = argparse.ArgumentParser(description="Random Sutta Release Builder")
    
    parser.add_argument("-g", "--git", action="store_true", help="Commit source changes only.")
    parser.add_argument("-p", "--publish", action="store_true", help="Full Release: Commit -> Push -> GitHub Release.")
    parser.add_argument("-o", "--official", action="store_true", help="Mark as Official/Latest release.")
    
    # [NEW] Thêm flag web
    parser.add_argument("-w", "--web", action="store_true", help="Deploy web/ to GitHub Pages (Ghost Folder method).")

    args = parser.parse_args()

    try:
        run_release_process(
            enable_git=args.git, 
            publish_gh=args.publish,
            is_official=args.official,
            deploy_web=args.web # Truyền tham số
        )
    except KeyboardInterrupt:
        print("\n🛑 Stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()