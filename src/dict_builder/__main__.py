# Path: src/dict_builder/__main__.py
import argparse
from rich import print
from .core import run_builder

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

    # [NEW] Flag HTML output
    parser.add_argument(
        "-h", "--html", 
        dest="html_mode", # Đặt dest rõ ràng
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
        print(f"\n[bold yellow]{'='*60}[/bold yellow]")
        print(f"[bold yellow]🚀 TRIGGERING BUILD MODE: {mode.upper()} ({fmt})[/bold yellow]")
        print(f"[bold yellow]{'='*60}[/bold yellow]\n")
        
        try:
            # [UPDATED] Truyền html_mode vào
            run_builder(mode=mode, html_mode=args.html_mode)
        except Exception as e:
            print(f"[bold red]❌ Critical Error while building {mode}: {e}[/bold red]")

if __name__ == "__main__":
    main()