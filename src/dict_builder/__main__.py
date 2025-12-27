# Path: src/dict_builder/__main__.py
import argparse
from .logging_setup import setup_dict_builder_logging
from .dict_builder_app import run_builder_with_export
from .logic.db_converter import DbConverter
from .builder_config import BuilderConfig
from .logic.builder_exporter import BuilderExporter

logger = setup_dict_builder_logging()

def main():
    parser = argparse.ArgumentParser(
        description="DPD Dictionary Builder CLI",
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    # Flags chọn chế độ
    group = parser.add_mutually_exclusive_group()
    group.add_argument("-t", "--tiny", action="store_true", help="Build tiny version (JSON Definitions)")
    group.add_argument("-m", "--mini", action="store_true", help="Build mini version (Default)")
    group.add_argument("-f", "--full", action="store_true", help="Build full version")
    group.add_argument("-a", "--all", action="store_true", help="Build ALL versions sequentially")

    # [REMOVED] -H / --html argument

    parser.add_argument(
        "-e", "--export",
        dest="export_flag",
        action="store_true",
        help="Export an optimized version for web into web/assets/db"
    )

    args = parser.parse_args()

    modes_to_run = []
    if args.all:
        modes_to_run = ["mini", "tiny", "full"] 
    elif args.tiny:
        modes_to_run = ["tiny"]
    elif args.full:
        modes_to_run = ["full"]
    elif args.mini:
        modes_to_run = ["mini"]
    else:
        modes_to_run = ["mini"]

    has_mini = "mini" in modes_to_run
    
    processed_modes = set()

    for mode in modes_to_run:
        if mode in processed_modes:
            continue

        # Check Smart Build condition
        if mode == "tiny" and has_mini and "mini" in processed_modes:
            logger.info(f"[bold yellow]{'='*60}[/bold yellow]")
            logger.info(f"[bold yellow]⚡ SMART BUILD: Converting MINI -> TINY[/bold yellow]")
            logger.info(f"[bold yellow]{'='*60}[/bold yellow]\n")
            
            # [UPDATED] Removed html_mode arg
            mini_conf = BuilderConfig(mode="mini")
            tiny_conf = BuilderConfig(mode="tiny")
            
            success = DbConverter.create_tiny_from_mini(mini_conf, tiny_conf)
            
            if success:
                if args.export_flag:
                    BuilderExporter.export_to_web(tiny_conf.output_path, tiny_conf.WEB_OUTPUT_DIR)
                processed_modes.add("tiny")
                continue
            else:
                logger.warning("Smart build failed. Falling back to normal build.")

        # Normal Build
        logger.info(f"[bold yellow]{'='*60}[/bold yellow]")
        logger.info(f"[bold yellow]🚀 TRIGGERING BUILD MODE: {mode.upper()} (JSON)[/bold yellow]")
        logger.info(f"[bold yellow]{'='*60}[/bold yellow]\n")
        
        try:
            # [UPDATED] Removed html_mode arg
            run_builder_with_export(mode=mode, export_flag=args.export_flag)
            processed_modes.add(mode)
        except Exception as e:
            logger.critical(f"[bold red]❌ Critical Error while building {mode}: {e}[/bold red]", exc_info=True)

if __name__ == "__main__":
    main()