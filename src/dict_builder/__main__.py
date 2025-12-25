# Path: src/dict_builder/__main__.py
import argparse
from .logging_setup import setup_dict_builder_logging
from .core import run_builder

logger = setup_dict_builder_logging()

def main():
    parser = argparse.ArgumentParser(
        description="DPD Dictionary Builder CLI",
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    # Flags chọn chế độ
    group = parser.add_mutually_exclusive_group()
    group.add_argument("-t", "--tiny", action="store_true", help="Build tiny version (JSON/HTML Definitions)")
    group.add_argument("-m", "--mini", action="store_true", help="Build mini version (Default)")
    group.add_argument("-f", "--full", action="store_true", help="Build full version")
    group.add_argument("-a", "--all", action="store_true", help="Build ALL versions sequentially")

    # [FIXED] Đổi -h thành -H để tránh trùng với --help
    parser.add_argument(
        "-H", "--html", 
        dest="html_mode", 
        action="store_true", 
        help="Output HTML columns instead of JSON.\nFiles will be named dpd_html_*.db"
    )

    args = parser.parse_args()

    modes_to_run = []
    if args.all:
        modes_to_run = ["tiny", "mini", "full"]
    elif args.tiny:
        modes_to_run = ["tiny"]
    elif args.full:
        modes_to_run = ["full"]
    elif args.mini:
        modes_to_run = ["mini"]
    else:
        modes_to_run = ["mini"]

    for mode in modes_to_run:
        fmt = "HTML" if args.html_mode else "JSON"
        logger.info(f"[bold yellow]{'='*60}[/bold yellow]")
        logger.info(f"[bold yellow]🚀 TRIGGERING BUILD MODE: {mode.upper()} ({fmt})[/bold yellow]")
        logger.info(f"[bold yellow]{'='*60}[/bold yellow]\n")
        
        try:
            run_builder(mode=mode, html_mode=args.html_mode)
        except Exception as e:
            logger.critical(f"[bold red]❌ Critical Error while building {mode}: {e}[/bold red]", exc_info=True)

if __name__ == "__main__":
    main()