# Path: src/dict_builder/__main__.py
import argparse
from rich import print
from .core import run_builder

def main():
    parser = argparse.ArgumentParser(
        description="DPD Dictionary Builder CLI",
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    group = parser.add_mutually_exclusive_group()
    
    group.add_argument(
        "-t", "--tiny", 
        action="store_true", 
        help="Build [tiny] version (dpd_tiny.db)\n"
             "- Content: JSON Definitions only\n"
             "- Filter: EBTS words only"
    )
    
    group.add_argument(
        "-m", "--mini", 
        action="store_true", 
        help="Build [mini] version (dpd_mini.db) [DEFAULT]\n"
             "- Content: JSON Definitions + Grammar + Examples\n"
             "- Filter: EBTS words only"
    )
    
    group.add_argument(
        "-f", "--full", 
        action="store_true", 
        help="Build [full] version (dpd_full.db)\n"
             "- Content: All Data (JSON)\n"
             "- Filter: None (All headwords)"
    )
    
    group.add_argument(
        "-a", "--all", 
        action="store_true", 
        help="Build ALL versions sequentially (tiny -> mini -> full)"
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
        # [FIXED] Rich markup phải đóng mở trong cùng 1 string print
        print(f"\n[bold yellow]{'='*60}[/bold yellow]")
        print(f"[bold yellow]🚀 TRIGGERING BUILD MODE: {mode.upper()}[/bold yellow]")
        print(f"[bold yellow]{'='*60}[/bold yellow]\n")
        
        try:
            run_builder(mode=mode)
        except Exception as e:
            print(f"[bold red]❌ Critical Error while building {mode}: {e}[/bold red]")

if __name__ == "__main__":
    main()