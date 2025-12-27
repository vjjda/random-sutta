# Path: src/dict_builder/__main__.py
import argparse
from .logging_setup import setup_dict_builder_logging
# [UPDATED] Import thêm run_view_injector
from .dict_builder_app import run_builder_with_export, run_view_injector
from .logic.db_converter import DbConverter
from .builder_config import BuilderConfig
from .logic.builder_exporter import BuilderExporter

logger = setup_dict_builder_logging()

def main():
    parser = argparse.ArgumentParser(description="DPD Dictionary Builder CLI")
    
    # Mode selection
    group = parser.add_mutually_exclusive_group()
    group.add_argument("-t", "--tiny", action="store_true", help="Build tiny version")
    group.add_argument("-m", "--mini", action="store_true", help="Build mini version (Default)")
    group.add_argument("-f", "--full", action="store_true", help="Build full version")
    group.add_argument("-a", "--all", action="store_true", help="Build ALL versions sequentially")
    
    # [NEW] View Injection Flag
    parser.add_argument("-v", "--view", action="store_true", help="Inject/Update Search Views ONLY (No Data Rebuild)")

    parser.add_argument("-e", "--export", dest="export_flag", action="store_true", help="Export to web assets")

    args = parser.parse_args()

    # Determine modes
    modes_to_run = []
    if args.all: modes_to_run = ["mini", "tiny", "full"] 
    elif args.tiny: modes_to_run = ["tiny"]
    elif args.full: modes_to_run = ["full"]
    else: modes_to_run = ["mini"] # Default

    # --- LOGIC MỚI: CHỈ UPDATE VIEW ---
    if args.view:
        logger.info(f"[bold magenta]{'='*60}[/bold magenta]")
        logger.info(f"[bold magenta]🔮 VIEW INJECTION MODE (Logic Only)[/bold magenta]")
        logger.info(f"[bold magenta]{'='*60}[/bold magenta]\n")
        
        for mode in modes_to_run:
            run_view_injector(mode=mode)
        return # Kết thúc, không build data
    # ----------------------------------

    # Logic Build Data cũ (giữ nguyên)
    processed_modes = set()
    has_mini = "mini" in modes_to_run

    for mode in modes_to_run:
        if mode in processed_modes: continue

        # Smart Build Logic (Mini -> Tiny)
        if mode == "tiny" and has_mini and "mini" in processed_modes:
            logger.info(f"[bold yellow]⚡ SMART BUILD: Converting MINI -> TINY[/bold yellow]")
            mini_conf = BuilderConfig(mode="mini")
            tiny_conf = BuilderConfig(mode="tiny")
            if DbConverter.create_tiny_from_mini(mini_conf, tiny_conf):
                if args.export_flag:
                    BuilderExporter.export_to_web(tiny_conf.output_path, tiny_conf.WEB_OUTPUT_DIR)
                processed_modes.add("tiny")
                continue

        # Normal Build
        logger.info(f"[bold yellow]🚀 TRIGGERING BUILD MODE: {mode.upper()} (JSON)[/bold yellow]")
        try:
            run_builder_with_export(mode=mode, export_flag=args.export_flag)
            processed_modes.add(mode)
        except Exception as e:
            logger.critical(f"Build failed for {mode}: {e}", exc_info=True)

if __name__ == "__main__":
    main()